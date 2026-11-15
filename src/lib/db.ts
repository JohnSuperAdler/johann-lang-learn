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
export async function putCard(card: CardRecord): Promise<void> {
  await (await getDb()).put('cards', card);
}
export async function putCards(cards: CardRecord[]): Promise<void> {
  const tx = (await getDb()).transaction('cards', 'readwrite');
  await Promise.all([...cards.map((c) => tx.store.put(c)), tx.done]);
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
  await (await getDb()).put('exams', exam);
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
  await (await getDb()).put('days', stat);
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

/** 清空全部學習紀錄（設定頁「重置進度」用，需二次確認）。 */
export async function clearAll(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['cards', 'exams', 'days', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('cards').clear(), tx.objectStore('exams').clear(),
    tx.objectStore('days').clear(), tx.objectStore('meta').clear(), tx.done,
  ]);
}
