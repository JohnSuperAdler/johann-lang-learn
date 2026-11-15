// 進度彙整：給首頁與單元列表用（S3、S4 會再擴充解鎖與 streak 邏輯）。
import { allUnits, countItems } from './content';
import { getAllCards, getAllExams, getDueCards } from './db';
import { todayKey } from './settings.svelte';
import type { Course, LangCode, Unit } from './types';

export type UnitStatus = 'locked' | 'available' | 'passed';

export interface LangProgress {
  lang: LangCode;
  learned: number;      // 至少建立過卡片的項目數
  total: number;        // 課程總項目數
  unitsPassed: number;
  unitsTotal: number;
  due: number;          // 今日到期卡數
  passedUnitIds: Set<string>;
  nextUnit: Unit | null; // 第一個可學且未通過的單元
}

export async function getLangProgress(course: Course): Promise<LangProgress> {
  const lang = course.lang;
  const [cards, exams, dueCards] = await Promise.all([getAllCards(), getAllExams(), getDueCards(todayKey())]);
  const learnedItems = new Set(cards.filter((c) => c.lang === lang).map((c) => c.itemId));
  const passedUnitIds = new Set(exams.filter((e) => e.lang === lang && e.passed).map((e) => e.unitId));
  const units = allUnits(course);
  const nextUnit = units.find(({ unit }) => unitStatus(unit, passedUnitIds) === 'available')?.unit ?? null;
  return {
    lang,
    learned: learnedItems.size,
    total: countItems(course),
    unitsPassed: units.filter(({ unit }) => passedUnitIds.has(unit.id)).length,
    unitsTotal: units.length,
    due: dueCards.filter((c) => c.lang === lang).length,
    passedUnitIds,
    nextUnit,
  };
}

export function unitStatus(unit: Unit, passedUnitIds: Set<string>): UnitStatus {
  if (passedUnitIds.has(unit.id)) return 'passed';
  const unlocked = unit.requires.every((id) => passedUnitIds.has(id));
  return unlocked ? 'available' : 'locked';
}

export const STATUS_LABEL: Record<UnitStatus, string> = {
  locked: '鎖定', available: '可學', passed: '已通過',
};
