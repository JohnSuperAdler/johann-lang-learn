// @vitest-environment jsdom
// 規格書第 9 節驗收項目中，可以自動檢查的部分（A1、A2、A5、A6、A8、A10）。
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportData, importData, parseBackup } from '../src/lib/backup';
import { clearAll, getAllCards, getAllDays, getAllExams, putCards, putDay, putExam } from '../src/lib/db';
import { unitStatus } from '../src/lib/progress';
import { generateExam } from '../src/lib/quiz';
import { schedule } from '../src/lib/scheduler';
import { newCard } from '../src/lib/cards';
import type { CardRecord, Course, Item, LangCode } from '../src/lib/types';

const root = resolve(process.cwd(), 'public/content');
const read = <T>(rel: string) => JSON.parse(readFileSync(resolve(root, rel), 'utf8')) as T;
const courses = { ko: read<Course>('ko/course.json'), pt: read<Course>('pt/course.json') };
const unitItems = (lang: LangCode, id: string) => read<Item[]>(`${lang}/items/${id}.json`);

describe('驗收', () => {
  it('A1：兩個語言都有字母、單字、文法三階段，且每個單元都有課程', () => {
    for (const course of Object.values(courses)) {
      expect(course.stages.map((s) => s.kind)).toEqual(['alphabet', 'vocab', 'grammar']);
      for (const st of course.stages) for (const u of st.units) expect(u.lessons.length, u.id).toBeGreaterThan(0);
    }
  });

  it('A2：K-A1~K-A6、P-A1~P-A5 內容齊全，每個項目都有可發音的文字', () => {
    const ids: [LangCode, string][] = [
      ...['K-A1', 'K-A2', 'K-A3', 'K-A4', 'K-A5', 'K-A6'].map((u) => ['ko', u] as [LangCode, string]),
      ...['P-A1', 'P-A2', 'P-A3', 'P-A4', 'P-A5'].map((u) => ['pt', u] as [LangCode, string]),
    ];
    for (const [lang, id] of ids) {
      const unit = courses[lang].stages[0].units.find((u) => u.id === id)!;
      const items = new Map(unitItems(lang, id).map((it) => [it.id, it]));
      for (const lesson of unit.lessons) for (const itemId of lesson.itemIds) {
        const it = items.get(itemId);
        expect(it, itemId).toBeTruthy();
        const say = it!.type === 'grammar' ? it!.examples[0]?.text : it!.tts ?? it!.text;
        expect(say, itemId).toBeTruthy();
      }
    }
  });

  it('A5：連續兩次考試的題目不完全相同', () => {
    const unit = courses.ko.stages[0].units[0];
    const items = unitItems('ko', unit.id);
    const sig = () => generateExam(items, 'ko', unit.exam).map((q) => q.id).join('|');
    expect(new Set([sig(), sig(), sig()]).size).toBeGreaterThan(1);
  });

  it('A6：前置單元通過後下一單元解鎖，未通過時維持鎖定', () => {
    const next = courses.ko.stages[0].units.find((u) => u.id === 'K-A2')!;
    expect(next.requires).toContain('K-A1');
    expect(unitStatus(next, new Set())).toBe('locked');
    expect(unitStatus(next, new Set(['K-A1']))).toBe('available');
  });

  it('A8：課後複習記得 → 隔天到期；隔天再記得 → 3 天後到期', () => {
    const c0 = newCard(unitItems('ko', 'K-A1')[0], 'ko', 'recognize', '2026-11-16');
    const c1 = { ...c0, ...schedule(c0, 3, '2026-11-16', '2026-11-16T10:00:00Z') };
    expect(c1.due).toBe('2026-11-17');
    const c2 = { ...c1, ...schedule(c1, 3, '2026-11-17', '2026-11-17T10:00:00Z') };
    expect(c2.due).toBe('2026-11-20');
  });

  it('A10：匯出 → 清空 → 匯入後，卡片進度、到期日、考試與每日紀錄完全一致', async () => {
    const cards: CardRecord[] = [
      { cardId: 'ko.letter.a#recognize', itemId: 'ko.letter.a', lang: 'ko', direction: 'recognize', state: 'review', interval: 3, ease: 2.35, due: '2026-11-20', reps: 4, lapses: 1, lastReviewed: '2026-11-17T10:00:00.000Z', priority: 1 },
      { cardId: 'pt.word.pao#produce', itemId: 'pt.word.pao', lang: 'pt', direction: 'produce', state: 'learning', interval: 0, ease: 2.5, due: '2026-11-16', reps: 1, lapses: 0, lastReviewed: null },
    ];
    await clearAll();
    await putCards(cards);
    await putExam({ id: 'K-A1@1', unitId: 'K-A1', lang: 'ko', date: '2026-11-16', score: 85, total: 20, passed: true, wrongItemIds: ['ko.letter.eo'], durationSec: 120 });
    await putDay({ date: '2026-11-16', reviewed: 24, correct: 20, newLearned: 10, cleared: true });
    const before = await exportData();
    const json = JSON.stringify(before);
    await clearAll();
    expect(await getAllCards()).toHaveLength(0);
    await importData(parseBackup(json));
    const strip = (c: CardRecord) => { const { dirty: _dirty, ...rest } = c; return rest; };
    expect((await getAllCards()).map(strip)).toEqual(before.cards.map(strip));
    expect(await getAllExams()).toEqual(before.exams);
    expect(await getAllDays()).toEqual(before.days);
  });
});
