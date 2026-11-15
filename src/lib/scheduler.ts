// 間隔重複排程（規格 F5.3，SM-2 簡化版）。純函式，無 I/O，可被 FSRS 等替換（F5.8）。
import type { CardRecord, CardState } from './types';

/** 四級自評：1 忘記、2 困難、3 記得、4 很簡單 */
export type Grade = 1 | 2 | 3 | 4;
export const GRADE_LABEL: Record<Grade, string> = { 1: '忘記', 2: '困難', 3: '記得', 4: '很簡單' };

export const EASE_START = 2.5;
export const EASE_MIN = 1.3;
export const EASE_MAX = 3.0;

/** YYYY-MM-DD 加 n 天（以 UTC 計算避免夏令時間問題）。 */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + n * 86400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** 兩個 YYYY-MM-DD 相差天數（b − a）。 */
export function diffDays(a: string, b: string): number {
  const p = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(b) - p(a)) / 86400_000);
}

const clampEase = (e: number) => Math.min(EASE_MAX, Math.max(EASE_MIN, Math.round(e * 100) / 100));

/** 「記得」時的基準下一間隔：首次 1 天、第二次 3 天、之後 × ease。 */
function baseInterval(card: Pick<CardRecord, 'state' | 'interval' | 'ease'>): number {
  if (card.state !== 'review') return 1;          // new / learning / relearning 畢業 → 1 天
  if (card.interval < 1) return 1;
  if (card.interval < 3) return 3;
  return Math.max(card.interval + 1, Math.round(card.interval * card.ease));
}

export interface ScheduleResult {
  state: CardState; interval: number; ease: number; due: string;
  reps: number; lapses: number; lastReviewed: string;
}

/**
 * 依評分計算卡片的下一個狀態。
 * @param today 以換日點計算的今天（YYYY-MM-DD）
 * @param nowIso 複習時間（ISO 字串）
 */
export function schedule(card: CardRecord, grade: Grade, today: string, nowIso: string): ScheduleResult {
  const wasReview = card.state === 'review' || card.state === 'relearning';
  let state: CardState = card.state;
  let interval = card.interval;
  let ease = card.ease;
  let lapses = card.lapses;

  switch (grade) {
    case 1: { // 忘記：間隔歸零，當天再出現；已畢業的卡算一次 lapse
      interval = 0;
      if (wasReview) { state = 'relearning'; lapses += 1; ease = clampEase(ease - 0.2); }
      else state = 'learning';
      break;
    }
    case 2: { // 困難：記得但吃力
      const base = baseInterval(card);
      interval = card.state === 'review' ? Math.max(1, Math.round(card.interval * 1.2)) : base;
      ease = clampEase(ease - 0.15);
      state = 'review';
      break;
    }
    case 3: { // 記得
      interval = baseInterval(card);
      state = 'review';
      break;
    }
    case 4: { // 很簡單
      const base = baseInterval(card);
      interval = Math.max(Math.round(base * 1.3), base + 1);
      ease = clampEase(ease + 0.15);
      state = 'review';
      break;
    }
  }

  return {
    state, interval, ease, lapses,
    due: addDays(today, interval),
    reps: card.reps + 1,
    lastReviewed: nowIso,
  };
}

export function applySchedule(card: CardRecord, grade: Grade, today: string, nowIso: string): CardRecord {
  return { ...card, ...schedule(card, grade, today, nowIso), dirty: true };
}

/** 給按鈕顯示的下次間隔文字，例如 "<1 天"、"3 天"。 */
export function previewInterval(card: CardRecord, grade: Grade, today: string): string {
  const r = schedule(card, grade, today, '');
  if (r.interval <= 0) return '<1 天';
  if (r.interval >= 30) return `${Math.round(r.interval / 30)} 個月`;
  return `${r.interval} 天`;
}

/** 每日隊列排序：lapses 多（含考試錯題）優先，其次到期最久。 */
export function sortDue(cards: CardRecord[], today: string): CardRecord[] {
  return [...cards].sort((a, b) => {
    const pa = a.priority ?? 0, pb = b.priority ?? 0;
    if (pa !== pb) return pb - pa;
    const da = diffDays(a.due, today), db = diffDays(b.due, today);
    if (da !== db) return db - da;
    return a.cardId.localeCompare(b.cardId);
  });
}
