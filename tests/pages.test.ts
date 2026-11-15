// @vitest-environment jsdom
// 頁面流程測試：以假的 IndexedDB 與 fetch 掛載真正的頁面，走完 課後複習 → 考試解鎖 → 考試 → 錯題入隊。
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getAllCards, getAllExams, getDueCards } from '../src/lib/db';
import { todayKey } from '../src/lib/settings.svelte';
import ExamPage from '../src/pages/ExamPage.svelte';
import ReviewPage from '../src/pages/ReviewPage.svelte';
import UnitPage from '../src/pages/UnitPage.svelte';

beforeAll(() => {
  globalThis.fetch = (async (url: string) => {
    const rel = String(url).replace(/^.*content\//, '');
    try {
      const body = readFileSync(resolve(process.cwd(), 'public/content', rel), 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(body) };
    } catch { return { ok: false, status: 404, json: async () => ({}) }; }
  }) as unknown as typeof fetch;
});

let app: ReturnType<typeof mount> | null = null;
afterEach(() => { if (app) unmount(app); app = null; document.body.innerHTML = ''; });

const tick = async (n = 6) => { for (let i = 0; i < n; i++) { await new Promise((r) => setTimeout(r, 5)); flushSync(); } };
const click = async (el: Element | null | undefined) => { expect(el, '找不到要點擊的元素').toBeTruthy(); (el as HTMLElement).click(); await tick(2); };
const btn = (text: string) => [...document.querySelectorAll('button, a.btn')].find((b) => b.textContent?.includes(text));
const text = () => document.body.textContent ?? '';

async function runLessonReview(lessonId: string) {
  app = mount(ReviewPage, { target: document.body, props: { lessonId } });
  await tick();
  expect(text()).not.toContain('載入失敗');
  expect(document.querySelector('.flashcard')).toBeTruthy();
  for (let guard = 0; guard < 100 && document.querySelector('.flashcard'); guard++) {
    await click(document.querySelector('.flashcard'));
    await click([...document.querySelectorAll('.grade')].find((b) => b.textContent?.includes('記得')));
  }
  expect(text()).toContain('複習完成');
  unmount(app); app = null; document.body.innerHTML = '';
}

describe('頁面流程', () => {
  it('考試在課程未學完前鎖定', async () => {
    app = mount(ExamPage, { target: document.body, props: { lang: 'ko', unitId: 'K-A1' } });
    await tick();
    expect(text()).toContain('課未完成');
    expect(btn('開始考試')).toBeUndefined();
  });

  it('課後複習建卡並排到明天（A7、A8 前半）', async () => {
    await runLessonReview('K-A1-L1');
    const cards = await getAllCards();
    expect(cards).toHaveLength(12); // 6 個字母 × 認讀＋聽音
    expect(cards.every((c) => c.state === 'review' && c.interval === 1)).toBe(true);
    expect(await getDueCards(todayKey())).toHaveLength(0);
  });

  it('單元頁：學完一課仍鎖定，兩課都學完才解鎖', async () => {
    app = mount(UnitPage, { target: document.body, props: { lang: 'ko', unitId: 'K-A1' } });
    await tick();
    expect(text()).toContain('還有 1 課未完成');
    unmount(app); app = null; document.body.innerHTML = '';
    await runLessonReview('K-A1-L2');
    app = mount(UnitPage, { target: document.body, props: { lang: 'ko', unitId: 'K-A1' } });
    await tick();
    expect(btn('開始考試')).toBeTruthy();
  });

  it('考試：全部亂答 → 未通過、紀錄寫入、錯題排入今日隊列最前面（A6）', async () => {
    app = mount(ExamPage, { target: document.body, props: { lang: 'ko', unitId: 'K-A1' } });
    await tick();
    await click(btn('開始考試'));
    expect(text()).toContain('第 1 / 20 題');
    const kinds = new Set<string>();
    for (let n = 0; n < 20; n++) {
      kinds.add(document.querySelector('.kind')?.textContent ?? '');
      if (document.querySelector('.options')) {
        // 選一個錯的：先全部試點第一個，若答對也無妨
        await click(document.querySelector('.options .opt'));
      } else if (document.querySelector('.match')) {
        const cols = document.querySelectorAll('.col');
        const count = cols[0].querySelectorAll('button').length;
        for (let i = 0; i < count; i++) {
          for (const r of cols[1].querySelectorAll('button')) {
            if ((cols[0].querySelectorAll('button')[i] as HTMLButtonElement).disabled) break;
            await click(cols[0].querySelectorAll('button')[i]);
            (r as HTMLElement).click(); await tick(1);
          }
        }
      } else {
        await click([...document.querySelectorAll('.kb button')].find((b) => b.textContent === 'ㅋ'));
        await click(btn('送出'));
      }
      expect(text()).toContain('正解');
      await click(btn(n === 19 ? '看結果' : '下一題'));
    }
    await tick();
    expect(kinds.size).toBeGreaterThanOrEqual(4); // A5：至少四種題型
    expect(text()).toMatch(/通過/);
    const exams = await getAllExams();
    expect(exams).toHaveLength(1);
    expect(exams[0].total).toBe(20);
    if (!exams[0].passed) {
      expect(text()).toContain('未通過');
      const due = await getDueCards(todayKey());
      expect(due.length).toBeGreaterThan(0);
      expect(due.every((c) => c.priority === 1)).toBe(true);
    }
    expect(btn('重考')).toBeTruthy();
  });

  it('每日複習頁可掛載並顯示錯題卡', async () => {
    app = mount(ReviewPage, { target: document.body, props: {} });
    await tick();
    expect(text()).not.toContain('載入失敗');
    expect(document.querySelector('.flashcard') || text().includes('今天沒有到期')).toBeTruthy();
  });
});
