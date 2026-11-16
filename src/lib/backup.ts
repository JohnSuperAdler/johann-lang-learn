// 匯出／匯入與資料版本遷移（F6.4、N5）。
import { getAllCards, getAllDays, getAllExams, getMeta, replaceAll, setMeta } from './db';
import { DEFAULT_SETTINGS, settings, updateSettings } from './settings.svelte';
import type { CardRecord, DayStat, ExamRecord, Settings } from './types';

/** 學習紀錄的資料格式版本。格式有變時 +1，並在 MIGRATIONS 補上對應的轉換。 */
export const DATA_VERSION = 1;

export interface Backup {
  app: 'lang-learning';
  version: number;
  exportedAt: string;
  settings: Settings;
  cards: CardRecord[];
  exams: ExamRecord[];
  days: DayStat[];
}

type Records = Pick<Backup, 'cards' | 'exams' | 'days'>;
/** MIGRATIONS[n] 把版本 n 的資料轉成版本 n+1。目前只有版本 1，所以是空的。 */
const MIGRATIONS: Record<number, (r: Records) => Records> = {};

export function migrate(records: Records, from: number): Records {
  let cur = records;
  for (let v = from; v < DATA_VERSION; v++) cur = MIGRATIONS[v]?.(cur) ?? cur;
  return cur;
}

export async function exportData(): Promise<Backup> {
  const [cards, exams, days] = await Promise.all([getAllCards(), getAllExams(), getAllDays()]);
  return {
    app: 'lang-learning', version: DATA_VERSION, exportedAt: new Date().toISOString(),
    settings: JSON.parse(JSON.stringify(settings)) as Settings, cards, exams, days,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 解析並檢查備份檔內容；格式不對時丟出說明原因的錯誤。回傳已遷移到目前版本的資料。 */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('檔案不是有效的 JSON。'); }
  if (!isObj(raw) || raw.app !== 'lang-learning') throw new Error('這不是本網頁匯出的備份檔。');
  const version = raw.version;
  if (typeof version !== 'number' || version < 1) throw new Error('備份檔缺少版本資訊。');
  if (version > DATA_VERSION) throw new Error(`備份檔版本（${version}）比目前程式（${DATA_VERSION}）新，請先更新網頁。`);
  for (const key of ['cards', 'exams', 'days'] as const) {
    if (!Array.isArray(raw[key])) throw new Error(`備份檔缺少 ${key}。`);
  }
  const cards = raw.cards as unknown[], exams = raw.exams as unknown[], days = raw.days as unknown[];
  const badCard = cards.findIndex((c) => !isObj(c) || typeof c.cardId !== 'string' || typeof c.itemId !== 'string'
    || (c.lang !== 'ko' && c.lang !== 'pt') || typeof c.due !== 'string' || !DATE.test(c.due)
    || typeof c.interval !== 'number' || typeof c.ease !== 'number');
  if (badCard >= 0) throw new Error(`第 ${badCard + 1} 張卡片的資料不完整。`);
  const badExam = exams.findIndex((e) => !isObj(e) || typeof e.id !== 'string' || typeof e.unitId !== 'string' || typeof e.score !== 'number');
  if (badExam >= 0) throw new Error(`第 ${badExam + 1} 筆考試紀錄的資料不完整。`);
  const badDay = days.findIndex((d) => !isObj(d) || typeof d.date !== 'string' || !DATE.test(d.date) || typeof d.reviewed !== 'number');
  if (badDay >= 0) throw new Error(`第 ${badDay + 1} 筆每日紀錄的資料不完整。`);
  const records = migrate({ cards: cards as CardRecord[], exams: exams as ExamRecord[], days: days as DayStat[] }, version);
  return {
    app: 'lang-learning', version: DATA_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    settings: { ...DEFAULT_SETTINGS, ...(isObj(raw.settings) ? (raw.settings as Partial<Settings>) : {}) },
    ...records,
  };
}

/** 以備份內容「取代」目前全部學習紀錄與設定。卡片標成待同步。 */
export async function importData(input: Backup): Promise<void> {
  // 先轉成純資料：呼叫端若傳入 Svelte 響應式物件（Proxy），IndexedDB 會拒絕儲存。
  const backup = JSON.parse(JSON.stringify(input)) as Backup;
  await replaceAll({
    cards: backup.cards.map((c) => ({ ...c, dirty: true })),
    exams: backup.exams, days: backup.days,
  });
  await setMeta('dataVersion', DATA_VERSION);
  updateSettings(backup.settings);
}

/** 啟動時呼叫：本機資料若是舊版本，就地遷移到目前版本。 */
export async function runMigrations(): Promise<void> {
  const from = (await getMeta<number>('dataVersion')) ?? DATA_VERSION;
  if (from < DATA_VERSION) {
    const [cards, exams, days] = await Promise.all([getAllCards(), getAllExams(), getAllDays()]);
    await replaceAll(migrate({ cards, exams, days }, from));
  }
  if (from !== DATA_VERSION || (await getMeta<number>('dataVersion')) === undefined) await setMeta('dataVersion', DATA_VERSION);
}

export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `lang-learning-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}
