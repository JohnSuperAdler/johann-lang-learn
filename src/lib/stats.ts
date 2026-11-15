// 每日統計與連續天數（F5.5、F6）。
import { getAllDays, getDay, putDay } from './db';
import { addDays } from './scheduler';
import type { DayStat } from './types';

export const STREAK_MIN_REVIEWS = 20;

export async function bumpDay(date: string, patch: Partial<Pick<DayStat, 'reviewed' | 'correct' | 'newLearned'>> & { cleared?: boolean }): Promise<DayStat> {
  const cur = (await getDay(date)) ?? { date, reviewed: 0, correct: 0, newLearned: 0 };
  const next: DayStat = {
    ...cur,
    reviewed: cur.reviewed + (patch.reviewed ?? 0),
    correct: cur.correct + (patch.correct ?? 0),
    newLearned: cur.newLearned + (patch.newLearned ?? 0),
    cleared: cur.cleared || patch.cleared || undefined,
  };
  await putDay(next);
  return next;
}

export const dayDone = (d: DayStat | undefined): boolean =>
  !!d && (d.cleared === true || d.reviewed >= STREAK_MIN_REVIEWS);

/** 連續完成天數：從今天往回數；今天尚未完成時從昨天算起（不中斷）。 */
export function computeStreak(days: DayStat[], today: string): number {
  const byDate = new Map(days.map((d) => [d.date, d]));
  let cursor = dayDone(byDate.get(today)) ? today : addDays(today, -1);
  let n = 0;
  while (dayDone(byDate.get(cursor))) { n += 1; cursor = addDays(cursor, -1); }
  return n;
}

export async function getStreak(today: string): Promise<number> {
  return computeStreak(await getAllDays(), today);
}
