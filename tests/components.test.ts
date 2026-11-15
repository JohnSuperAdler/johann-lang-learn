// @vitest-environment jsdom
// 元件冒煙測試：實際掛載並操作，抓 svelte-check 抓不到的執行期錯誤（如 state_unsafe_mutation）。
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ka1Raw from '../public/content/ko/items/K-A1.json';
import ExamQuestion from '../src/components/ExamQuestion.svelte';
import ReviewSession from '../src/components/ReviewSession.svelte';
import { newCard } from '../src/lib/cards';
import { generateExam, type ChoiceQ, type MatchQ, type Question, type TypedQ } from '../src/lib/quiz';
import type { Item, SessionResult } from '../src/lib/types';

const ka1 = ka1Raw as Item[];
let app: ReturnType<typeof mount> | null = null;
afterEach(() => { if (app) unmount(app); app = null; document.body.innerHTML = ''; });

const click = (el: Element | null | undefined) => { (el as HTMLElement).click(); flushSync(); };
const btn = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text));

function mountQ(q: Question) {
  const answers: { score: number; wrongItemIds: string[] }[] = [];
  let nexts = 0;
  app = mount(ExamQuestion, { target: document.body, props: { q, isLast: false, onAnswer: (r) => answers.push(r), onNext: () => { nexts += 1; } } });
  flushSync();
  return { answers, nexts: () => nexts };
}

describe('ExamQuestion', () => {
  const qs = generateExam(ka1, 'ko', { questionCount: 20, questionTypes: ['choice', 'listen-choice', 'compose', 'match', 'dictation'] });
  const pick = <T extends Question>(k: Question['kind']) => qs.find((q) => q.kind === k) as T;

  it('選擇題：答對與答錯', () => {
    const q = pick<ChoiceQ>('choice');
    let r = mountQ(q);
    click(document.querySelectorAll('.opt')[q.answer]);
    expect(r.answers).toEqual([{ score: 1, wrongItemIds: [] }]);
    expect(document.body.textContent).toContain('正確');
    click(btn('下一題'));
    expect(r.nexts()).toBe(1);
    unmount(app!); document.body.innerHTML = '';
    r = mountQ(q);
    click(document.querySelectorAll('.opt')[(q.answer + 1) % q.options.length]);
    expect(r.answers[0]).toEqual({ score: 0, wrongItemIds: q.itemIds });
    expect(document.body.textContent).toContain('正解');
  });

  it('聽音選擇題可掛載並作答', () => {
    const q = pick<ChoiceQ>('listen-choice');
    const r = mountQ(q);
    click(document.querySelectorAll('.opt')[q.answer]);
    expect(r.answers[0].score).toBe(1);
  });

  it('音節拼合題：用螢幕鍵盤輸入', () => {
    const q = pick<TypedQ>('compose');
    const r = mountQ(q);
    for (const j of q.prompt!.split(' ＋ ')) click([...document.querySelectorAll('.kb button')].find((b) => b.textContent === j));
    expect((document.querySelector('input.answer') as HTMLInputElement).value).toBe(q.answers[0]);
    click(btn('送出'));
    expect(r.answers).toEqual([{ score: 1, wrongItemIds: [] }]);
  });

  it('配對題：全部配對正確得滿分，配錯一次半分', () => {
    const q = pick<MatchQ>('match');
    const r = mountQ(q);
    const cols = () => document.querySelectorAll('.col');
    const left = (i: number) => cols()[0].querySelectorAll('button')[i];
    const right = (pairIdx: number) => cols()[1].querySelectorAll('button')[q.rightOrder.indexOf(pairIdx)];
    click(left(0)); click(right(1)); // 故意配錯一次
    q.pairs.forEach((_, i) => { click(left(i)); click(right(i)); });
    expect(r.answers).toHaveLength(1);
    expect(r.answers[0].score).toBe(0.5);
    expect(r.answers[0].wrongItemIds.sort()).toEqual([q.pairs[0].itemId, q.pairs[1].itemId].sort());
  });

  it('句子重組題', () => {
    const q: Question = { id: 'r', kind: 'reorder', lang: 'pt', itemIds: ['x'], prompt: '我是學生', tokens: ['sou', 'Eu', 'estudante'], answer: 'Eu sou estudante', correctText: 'Eu sou estudante' };
    const r = mountQ(q);
    for (const w of ['Eu', 'sou', 'estudante']) click([...document.querySelectorAll('.bank .chip')].find((b) => b.textContent === w));
    click(btn('送出'));
    expect(r.answers).toEqual([{ score: 1, wrongItemIds: [] }]);
  });
});

describe('ReviewSession（練習模式，不寫入）', () => {
  it('忘記的卡會重排，全部記得後結束', () => {
    const items = new Map(ka1.slice(0, 2).map((it) => [it.id, it]));
    const cards = [...items.values()].map((it) => newCard(it, 'ko', 'recognize', '2026-11-15'));
    let result: SessionResult | null = null;
    app = mount(ReviewSession, { target: document.body, props: { cards, items, persist: false, title: '測試', onFinish: (r: SessionResult) => { result = r; } } });
    flushSync();
    const grade = async (label: string) => {
      click(document.querySelector('.flashcard'));
      click([...document.querySelectorAll('.grade')].find((b) => b.textContent?.includes(label)));
      await new Promise((r) => setTimeout(r, 0)); flushSync();
    };
    return (async () => {
      await grade('忘記');
      expect(document.body.textContent).toContain('剩餘 2');
      await grade('記得');
      await grade('記得');
      expect(result).toEqual({ graded: 3, correct: 2, forgotten: 1, cards: 2 });
    })();
  });
});
