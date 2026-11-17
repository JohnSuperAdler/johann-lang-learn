// 跨裝置同步的合併規則（規格書 F7、6.1）：純函式，不碰 IndexedDB 與 Firebase。
// 原則：任何一邊的進度都不倒退。
import type { CardRecord, DayStat, ExamRecord } from './types';

/** 卡片：最後複習時間較新者勝；都沒複習過或時間相同時，複習次數多者勝；再相同則保留本機。 */
export function newerCard(local: CardRecord | undefined, remote: CardRecord): 'local' | 'remote' {
  if (!local) return 'remote';
  const lt = local.lastReviewed ?? '', rt = remote.lastReviewed ?? '';
  if (lt !== rt) return rt > lt ? 'remote' : 'local';
  if (local.reps !== remote.reps) return remote.reps > local.reps ? 'remote' : 'local';
  // 考試錯題會把卡設成 priority 1、提早到期，但不改 lastReviewed：讓提早的到期日也能同步。
  if ((remote.priority ?? 0) > (local.priority ?? 0)) return 'remote';
  if (remote.due < local.due && (remote.priority ?? 0) === (local.priority ?? 0) && (remote.priority ?? 0) > 0) return 'remote';
  return 'local';
}

/** 兩筆卡片內容是否相同（忽略 dirty）。 */
export function sameCard(a: CardRecord, b: CardRecord): boolean {
  const keys: (keyof CardRecord)[] = ['state', 'interval', 'ease', 'due', 'reps', 'lapses', 'lastReviewed', 'priority'];
  return keys.every((k) => (a[k] ?? null) === (b[k] ?? null));
}

/** 每日統計：同一天各欄位取較大值，cleared 取聯集。 */
export function mergeDay(local: DayStat | undefined, remote: DayStat): DayStat {
  if (!local) return { ...remote };
  return {
    date: remote.date,
    reviewed: Math.max(local.reviewed, remote.reviewed),
    correct: Math.max(local.correct, remote.correct),
    newLearned: Math.max(local.newLearned, remote.newLearned),
    ...(local.cleared || remote.cleared ? { cleared: true } : {}),
  };
}

export function sameDay(a: DayStat, b: DayStat): boolean {
  return a.reviewed === b.reviewed && a.correct === b.correct && a.newLearned === b.newLearned && !!a.cleared === !!b.cleared;
}

export interface MergePlan<T> {
  /** 要寫回本機的紀錄（遠端較新或合併後有變），寫入時不標 dirty。 */
  toLocal: T[];
  /** 本機較新、需要上傳的紀錄 id。 */
  toPush: string[];
}

export function planCards(local: Map<string, CardRecord>, remote: CardRecord[]): MergePlan<CardRecord> {
  const plan: MergePlan<CardRecord> = { toLocal: [], toPush: [] };
  for (const r of remote) {
    const l = local.get(r.cardId);
    if (newerCard(l, r) === 'remote') {
      if (!l || !sameCard(l, r)) plan.toLocal.push({ ...r, dirty: false });
    } else if (l && !sameCard(l, r)) {
      plan.toPush.push(l.cardId);
    }
  }
  return plan;
}

/** 考試紀錄只增不減：雙方聯集。 */
export function planExams(local: Map<string, ExamRecord>, remote: ExamRecord[]): MergePlan<ExamRecord> {
  return { toLocal: remote.filter((r) => !local.has(r.id)).map((r) => ({ ...r, dirty: false })), toPush: [] };
}

export function planDays(local: Map<string, DayStat>, remote: DayStat[]): MergePlan<DayStat> {
  const plan: MergePlan<DayStat> = { toLocal: [], toPush: [] };
  for (const r of remote) {
    const l = local.get(r.date);
    const m = mergeDay(l, r);
    if (!l || !sameDay(l, m)) plan.toLocal.push({ ...m, dirty: !sameDay(m, r) });
    if (!sameDay(m, r)) plan.toPush.push(r.date);
  }
  return plan;
}

/** 上傳到 Firestore 前去掉本機專用欄位，並把 undefined 換成不存在（Firestore 不接受 undefined）。 */
export function toRemote<T extends object>(rec: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) if (k !== 'dirty' && v !== undefined) out[k] = v;
  return out;
}

/** 從 Firestore 讀回的資料去掉同步欄位。 */
export function fromRemote<T>(data: Record<string, unknown>): T {
  const { syncedAt: _s, ...rest } = data;
  return rest as T;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
