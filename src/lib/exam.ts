// 考試的解鎖判定與結果寫入（F3.1、F3.6–F3.8）。
import { getAllCards, getCardsByItem, putCards, putExam } from './db';
import type { CardRecord, ExamRecord, LangCode, Unit } from './types';

export interface UnlockInfo { unlocked: boolean; lessonsTotal: number; lessonsDone: number; }

/** 單元內每一課的全部項目都建立過卡片（＝學完並做過課後複習）才解鎖考試。 */
export function examUnlock(unit: Unit, learnedItemIds: Set<string>): UnlockInfo {
  const lessons = unit.lessons.filter((l) => l.itemIds.length > 0);
  const done = lessons.filter((l) => l.itemIds.every((id) => learnedItemIds.has(id))).length;
  return { unlocked: lessons.length > 0 && done === lessons.length, lessonsTotal: lessons.length, lessonsDone: done };
}

export async function learnedItemIds(): Promise<Set<string>> {
  return new Set((await getAllCards()).map((c) => c.itemId));
}

export interface ExamOutcome { score: number; passed: boolean; record: ExamRecord; }

/** 寫入考試紀錄，並把錯題的卡片排到每日複習最前面（priority 1、當天到期）。 */
export async function saveExamResult(p: {
  unitId: string; lang: LangCode; points: number; total: number; passRate: number;
  wrongItemIds: string[]; durationSec: number; today: string;
}): Promise<ExamOutcome> {
  const score = p.total > 0 ? Math.round((p.points / p.total) * 100) : 0;
  const passed = p.total > 0 && p.points / p.total >= p.passRate - 1e-9;
  const wrong = [...new Set(p.wrongItemIds)];
  const record: ExamRecord = {
    id: `${p.unitId}@${new Date().toISOString()}`, unitId: p.unitId, lang: p.lang, date: p.today,
    score, total: p.total, passed, wrongItemIds: wrong, durationSec: p.durationSec,
  };
  await putExam(record);
  const updates: CardRecord[] = [];
  for (const itemId of wrong) {
    for (const c of await getCardsByItem(itemId)) updates.push({ ...c, priority: 1, due: p.today <= c.due ? p.today : c.due, dirty: true });
  }
  if (updates.length) await putCards(updates);
  return { score, passed, record };
}
