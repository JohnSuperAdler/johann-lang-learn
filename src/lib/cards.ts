// 由學習項目建立卡片（F5.6）：word → recognize＋produce；letter → recognize＋listen；grammar → recognize。
import { allUnits, loadCourse, loadUnitItems } from './content';
import { getCardsByItem, putCards } from './db';
import { EASE_START } from './scheduler';
import type { CardDirection, CardRecord, Course, Item, LangCode, Unit } from './types';

export function directionsFor(item: Item): CardDirection[] {
  switch (item.type) {
    case 'word': return ['recognize', 'produce'];
    case 'letter': return ['recognize', 'listen'];
    case 'grammar': return ['recognize'];
  }
}

export const cardIdOf = (itemId: string, dir: CardDirection) => `${itemId}#${dir}`;

export function newCard(item: Item, lang: LangCode, dir: CardDirection, today: string): CardRecord {
  return {
    cardId: cardIdOf(item.id, dir), itemId: item.id, lang, direction: dir,
    state: 'new', interval: 0, ease: EASE_START, due: today, reps: 0, lapses: 0, lastReviewed: null,
  };
}

/** 確保這些項目的卡片都存在；回傳全部（既有＋新建）卡片。 */
export async function ensureCards(items: Item[], lang: LangCode, today: string): Promise<CardRecord[]> {
  const result: CardRecord[] = [];
  const toCreate: CardRecord[] = [];
  for (const item of items) {
    const existing = await getCardsByItem(item.id);
    for (const dir of directionsFor(item)) {
      const found = existing.find((c) => c.direction === dir);
      if (found) result.push(found);
      else { const c = newCard(item, lang, dir, today); toCreate.push(c); result.push(c); }
    }
  }
  if (toCreate.length) await putCards(toCreate);
  return result;
}

/** 項目 id → 所屬單元（供每日複習把卡片對回教材）。 */
export function itemUnitIndex(course: Course): Map<string, Unit> {
  const map = new Map<string, Unit>();
  for (const { unit } of allUnits(course)) {
    for (const lesson of unit.lessons) for (const id of lesson.itemIds) map.set(id, unit);
  }
  return map;
}

/** 載入一批卡片對應的 Item；找不到教材的卡會被略過。 */
export async function loadItemsForCards(cards: CardRecord[]): Promise<Map<string, Item>> {
  const items = new Map<string, Item>();
  const langs = [...new Set(cards.map((c) => c.lang))];
  for (const lang of langs) {
    const course = await loadCourse(lang);
    const index = itemUnitIndex(course);
    const unitsNeeded = new Map<string, Unit>();
    for (const c of cards.filter((x) => x.lang === lang)) {
      const unit = index.get(c.itemId);
      if (unit) unitsNeeded.set(unit.id, unit);
    }
    for (const unit of unitsNeeded.values()) {
      for (const it of await loadUnitItems(lang, unit)) items.set(it.id, it);
    }
  }
  return items;
}
