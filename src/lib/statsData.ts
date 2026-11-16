// 統計頁用的純函式（F6.2、F6.3）：不碰 IndexedDB，方便測試。
import { addDays } from './scheduler';
import type { CardRecord, DayStat, ExamRecord, LangCode } from './types';

export const MATURE_DAYS = 21;

/** 以 today 為最後一天，補齊沒有紀錄的日期。 */
export function lastNDays(days: DayStat[], today: string, n = 30): DayStat[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const out: DayStat[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    out.push(byDate.get(date) ?? { date, reviewed: 0, correct: 0, newLearned: 0 });
  }
  return out;
}

export interface Totals { reviewed: number; correct: number; newLearned: number; activeDays: number; accuracy: number | null; }
export function totals(days: DayStat[]): Totals {
  const reviewed = days.reduce((n, d) => n + d.reviewed, 0);
  const correct = days.reduce((n, d) => n + d.correct, 0);
  return {
    reviewed, correct,
    newLearned: days.reduce((n, d) => n + d.newLearned, 0),
    activeDays: days.filter((d) => d.reviewed > 0).length,
    accuracy: reviewed ? correct / reviewed : null,
  };
}

export interface Breakdown { items: number; cards: number; fresh: number; learning: number; young: number; mature: number; }
/** 卡片狀態分布：新卡／學習中（含重學）／熟悉中（間隔 < 21 天）／已熟（≥ 21 天）。 */
export function cardBreakdown(cards: CardRecord[], lang: LangCode): Breakdown {
  const mine = cards.filter((c) => c.lang === lang);
  const b: Breakdown = { items: new Set(mine.map((c) => c.itemId)).size, cards: mine.length, fresh: 0, learning: 0, young: 0, mature: 0 };
  for (const c of mine) {
    if (c.state === 'new') b.fresh += 1;
    else if (c.state === 'learning' || c.state === 'relearning') b.learning += 1;
    else if (c.interval >= MATURE_DAYS) b.mature += 1;
    else b.young += 1;
  }
  return b;
}

export interface WeakItem { itemId: string; lang: LangCode; lapses: number; ease: number; }
/** 最常忘記的項目：同一項目各方向的 lapses 加總，取前 limit 名。 */
export function weakItems(cards: CardRecord[], limit = 10): WeakItem[] {
  const map = new Map<string, WeakItem>();
  for (const c of cards) {
    if (!c.lapses) continue;
    const cur = map.get(c.itemId) ?? { itemId: c.itemId, lang: c.lang, lapses: 0, ease: c.ease };
    cur.lapses += c.lapses;
    cur.ease = Math.min(cur.ease, c.ease);
    map.set(c.itemId, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.lapses - a.lapses || a.ease - b.ease || a.itemId.localeCompare(b.itemId))
    .slice(0, limit);
}

export interface ExamSummary { unitId: string; lang: LangCode; attempts: number; best: number; last: number; lastDate: string; passed: boolean; }
export function examSummary(exams: ExamRecord[]): Map<string, ExamSummary> {
  const map = new Map<string, ExamSummary>();
  for (const e of [...exams].sort((a, b) => a.id.localeCompare(b.id))) {
    const cur = map.get(e.unitId);
    map.set(e.unitId, {
      unitId: e.unitId, lang: e.lang,
      attempts: (cur?.attempts ?? 0) + 1,
      best: Math.max(cur?.best ?? 0, e.score),
      last: e.score, lastDate: e.date,
      passed: (cur?.passed ?? false) || e.passed,
    });
  }
  return map;
}

/** 圖表 y 軸上限：取 1、2、5 × 10ⁿ 中不小於 max 的最小值（至少 10）。 */
export function niceMax(max: number): number {
  if (max <= 10) return 10;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}
