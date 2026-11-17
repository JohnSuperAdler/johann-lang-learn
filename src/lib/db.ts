// IndexedDB 封裝（idb）：cards、exams、days 三個 store；meta 存資料版本。
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CardRecord, DayStat, ExamRecord, LangCode } from './types';

export const DB_NAME = 'lang-learning';
export const DB_VERSION = 1;

interface Schema extends DBSchema {
  cards: {
    key: string; value: CardRecord;
    indexes: { 'by-due': string; 'by-item': string; 'by-lang': LangCode };
  };
  exams: { key: string; value: ExamRecord; indexes: { 'by-unit': string } };
  days: { key: string; value: DayStat };
  meta: { key: string; value: { key: string; value: unknown } };
}

// ---- 變更通知（同步模組訂閱，用來在本機資料改變後排程上傳）----
type Listener = () => void;
const listeners = new Set<Listener>();
export function onLocalChange(fn: Listener): () => void { listeners.add(fn); return () => listeners.delete(fn); }
function changed(): void { for (const fn of listeners) fn(); }

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function getDb(): Promise<IDBPDatabase<Schema>> {
  if (!dbPromise) {
    dbPromise = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const cards = db.createObjectStore('cards', { keyPath: 'cardId' });
          cards.createIndex('by-due', 'due');
          cards.createIndex('by-item', 'itemId');
          cards.createIndex('by-lang', 'lang');
          const exams = db.createObjectStore('exams', { keyPath: 'id' });
          exams.createIndex('by-unit', 'unitId');
          db.createObjectStore('days', { keyPath: 'date' });
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        // 之後的版本在此加 if (oldVersion < N) 遷移（規格 N5）。
      },
    });
  }
  return dbPromise;
}

// ---- cards ----
export async function getCard(cardId: string): Promise<CardRecord | undefined> {
  return (await getDb()).get('cards', cardId);
}
// 以下 put* 是「本機產生的變更」：一律標 dirty（待上傳）並通知同步模組。
// 同步模組從雲端寫回本機時改用 putSynced，不標 dirty、不通知。
export async function putCard(card: CardRecord): Promise<void> {
  await (await getDb()).put('cards', { ...card, dirty: true });
  changed();
}
export async function putCards(cards: CardRecord[]): Promise<void> {
  const tx = (await getDb()).transaction('cards', 'readwrite');
  await Promise.all([...cards.map((c) => tx.store.put({ ...c, dirty: true })), tx.done]);
  changed();
}
export async function getCardsByItem(itemId: string): Promise<CardRecord[]> {
  return (await getDb()).getAllFromIndex('cards', 'by-item', itemId);
}
export async function getAllCards(): Promise<CardRecord[]> {
  return (await getDb()).getAll('cards');
}
/** 到期日 <= today 的卡（today 為 YYYY-MM-DD）。 */
export async function getDueCards(today: string): Promise<CardRecord[]> {
  return (await getDb()).getAllFromIndex('cards', 'by-due', IDBKeyRange.upperBound(today));
}
export async function countCardsByLang(lang: LangCode): Promise<number> {
  return (await getDb()).countFromIndex('cards', 'by-lang', lang);
}

// ---- exams ----
export async function putExam(exam: ExamRecord): Promise<void> {
  await (await getDb()).put('exams', { ...exam, dirty: true });
  changed();
}
export async function getExamsByUnit(unitId: string): Promise<ExamRecord[]> {
  return (await getDb()).getAllFromIndex('exams', 'by-unit', unitId);
}
export async function getAllExams(): Promise<ExamRecord[]> {
  return (await getDb()).getAll('exams');
}

// ---- days ----
export async function getDay(date: string): Promise<DayStat | undefined> {
  return (await getDb()).get('days', date);
}
export async function putDay(stat: DayStat): Promise<void> {
  await (await getDb()).put('days', { ...stat, dirty: true });
  changed();
}

// ---- 同步用 ----
type SyncStore = 'cards' | 'exams' | 'days';
type RecordOf<S extends SyncStore> = S extends 'cards' ? CardRecord : S extends 'exams' ? ExamRecord : DayStat;
/** 從雲端合併回來的紀錄：照原樣寫入（dirty 由呼叫端決定），不觸發變更通知。 */
export async function putSynced<S extends SyncStore>(store: S, records: RecordOf<S>[]): Promise<void> {
  if (!records.length) return;
  const tx = (await getDb()).transaction(store, 'readwrite');
  await Promise.all([...records.map((r) => tx.store.put(r as never)), tx.done]);
}
/** 上傳成功後清除 dirty；若上傳期間紀錄又被改過（與 sent 不同）就保留 dirty。 */
export async function clearDirty<S extends SyncStore>(store: S, sent: RecordOf<S>[], keyOf: (r: RecordOf<S>) => string): Promise<void> {
  if (!sent.length) return;
  const tx = (await getDb()).transaction(store, 'readwrite');
  await Promise.all([
    ...sent.map(async (s) => {
      const cur = (await tx.store.get(keyOf(s) as never)) as RecordOf<S> | undefined;
      if (cur && cur.dirty && JSON.stringify({ ...cur, dirty: true }) === JSON.stringify({ ...s, dirty: true })) {
        await tx.store.put({ ...cur, dirty: false } as never);
      }
    }),
    tx.done,
  ]);
}
export async function getAllDays(): Promise<DayStat[]> {
  return (await getDb()).getAll('days');
}

// ---- meta ----
export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await (await getDb()).get('meta', key);
  return row?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('meta', { key, value });
}

/** 以整批資料取代 cards / exams / days（匯入與遷移用），單一交易完成。 */
export async function replaceAll(data: { cards: CardRecord[]; exams: ExamRecord[]; days: DayStat[] }): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['cards', 'exams', 'days'], 'readwrite');
  const cards = tx.objectStore('cards'), exams = tx.objectStore('exams'), days = tx.objectStore('days');
  await Promise.all([
    cards.clear(), exams.clear(), days.clear(),
    ...data.cards.map((c) => cards.put(c)), ...data.exams.map((e) => exams.put(e)), ...data.days.map((d) => days.put(d)),
    tx.done,
  ]);
}

/** 清空全部學習紀錄（設定頁「重置進度」用，需二次確認）。 */
export async function clearAll(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['cards', 'exams', 'days', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('cards').clear(), tx.objectStore('exams').clear(),
    tx.objectStore('days').clear(), tx.objectStore('meta').clear(), tx.done,
  ]);
}
