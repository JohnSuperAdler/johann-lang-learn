// 教材整體測試：每個有課程的單元都要能出滿考題，且題目結構正確。
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gradeTyped } from '../src/lib/grader';
import { drillQuestions, generateExam } from '../src/lib/quiz';
import type { Course, Item, LangCode } from '../src/lib/types';

const root = resolve(process.cwd(), 'public/content');
const read = <T>(rel: string) => JSON.parse(readFileSync(resolve(root, rel), 'utf8')) as T;

for (const lang of ['ko', 'pt'] as LangCode[]) {
  const course = read<Course>(`${lang}/course.json`);
  describe(`教材 ${lang}`, () => {
    it('course.json 結構可讀取', () => { expect(course.lang).toBe(lang); expect(course.stages).toHaveLength(3); });
    for (const stage of course.stages) {
      for (const unit of stage.units) {
        if (unit.lessons.length === 0 || !existsSync(resolve(root, `${lang}/items/${unit.id}.json`))) continue;
        const all = read<Item[]>(`${lang}/items/${unit.id}.json`);
        const ids = new Set(unit.lessons.flatMap((l) => l.itemIds));
        const items = all.filter((it) => ids.has(it.id));

        it(`${unit.id}：可出滿 ${unit.exam.questionCount} 題且結構正確`, () => {
          for (let round = 0; round < 3; round++) {
            const qs = generateExam(items, lang, unit.exam);
            expect(qs).toHaveLength(unit.exam.questionCount);
            expect(new Set(qs.map((q) => q.kind)).size).toBeGreaterThanOrEqual(2);
            for (const q of qs) {
              expect(q.correctText).toBeTruthy();
              if (q.kind === 'choice' || q.kind === 'listen-choice') {
                expect(q.options.length).toBeGreaterThanOrEqual(2);
                expect(q.answer, q.id).toBeGreaterThanOrEqual(0);
                expect(new Set(q.options.map((o) => o.text)).size, q.id).toBe(q.options.length);
              } else if (q.kind === 'match') {
                expect(new Set(q.pairs.map((p) => p.right)).size).toBe(q.pairs.length);
                expect(new Set(q.pairs.map((p) => p.left)).size).toBe(q.pairs.length);
              } else if (q.kind === 'reorder') {
                expect(gradeTyped(q.answer, [q.answer])).toBe('correct');
                expect(q.tokens.length).toBeGreaterThanOrEqual(3);
              } else if ('answers' in q) {
                expect(q.answers.length).toBeGreaterThan(0);
                expect(gradeTyped(q.answers[0], q.answers), q.id).toBe('correct');
              }
            }
          }
        });

        const grammar = items.filter((it) => it.type === 'grammar');
        if (grammar.length) {
          it(`${unit.id}：每個文法項目至少有 3 題即時練習，例句至少 2 句`, () => {
            for (const g of grammar) {
              expect(drillQuestions(g, lang).length, g.id).toBeGreaterThanOrEqual(3);
              if (g.type === 'grammar') expect(g.examples.length, g.id).toBeGreaterThanOrEqual(2);
            }
          });
        }
      }
    }
  });
}
