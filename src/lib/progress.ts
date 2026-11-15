// 進度彙整：給首頁與單元列表用。
import { allUnits, countItems } from './content';
import { getAllCards, getAllExams, getDueCards } from './db';
import { todayKey } from './settings.svelte';
import { getStreak } from './stats';
import type { Course, LangCode, Unit } from './types';

export type UnitStatus = 'locked' | 'available' | 'inprogress' | 'passed';

export interface LangProgress {
  lang: LangCode;
  learned: number;       // 至少建立過卡片的項目數
  total: number;         // 課程總項目數
  unitsPassed: number;
  unitsTotal: number;
  due: number;           // 今日到期卡數
  streak: number;
  passedUnitIds: Set<string>;
  inProgressUnitIds: Set<string>;
  nextUnit: Unit | null; // 第一個進行中或可學且未通過的單元
}

export async function getLangProgress(course: Course): Promise<LangProgress> {
  const lang = course.lang;
  const today = todayKey();
  const [cards, exams, dueCards, streak] = await Promise.all([getAllCards(), getAllExams(), getDueCards(today), getStreak(today)]);
  const learnedItems = new Set(cards.filter((c) => c.lang === lang).map((c) => c.itemId));
  const passedUnitIds = new Set(exams.filter((e) => e.lang === lang && e.passed).map((e) => e.unitId));
  const units = allUnits(course);
  const inProgressUnitIds = new Set(
    units.filter(({ unit }) => unit.lessons.some((l) => l.itemIds.some((id) => learnedItems.has(id)))).map(({ unit }) => unit.id));
  const statusOf = (u: Unit) => unitStatus(u, passedUnitIds, inProgressUnitIds);
  const nextUnit =
    units.find(({ unit }) => statusOf(unit) === 'inprogress')?.unit
    ?? units.find(({ unit }) => statusOf(unit) === 'available' && unit.lessons.length > 0)?.unit
    ?? units.find(({ unit }) => statusOf(unit) === 'available')?.unit
    ?? null;
  return {
    lang,
    learned: learnedItems.size,
    total: countItems(course),
    unitsPassed: units.filter(({ unit }) => passedUnitIds.has(unit.id)).length,
    unitsTotal: units.length,
    due: dueCards.filter((c) => c.lang === lang).length,
    streak,
    passedUnitIds,
    inProgressUnitIds,
    nextUnit,
  };
}

export function unitStatus(unit: Unit, passedUnitIds: Set<string>, inProgressUnitIds: Set<string> = new Set()): UnitStatus {
  if (passedUnitIds.has(unit.id)) return 'passed';
  if (inProgressUnitIds.has(unit.id)) return 'inprogress';
  const unlocked = unit.requires.every((id) => passedUnitIds.has(id));
  return unlocked ? 'available' : 'locked';
}

export const STATUS_LABEL: Record<UnitStatus, string> = {
  locked: '鎖定', available: '可學', inprogress: '進行中', passed: '已通過',
};
