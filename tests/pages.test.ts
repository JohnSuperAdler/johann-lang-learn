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
import LessonPage from '../src/pages/LessonPage.svelte';
import UnitList from '../src/pages/UnitList.svelte';
import UnitPage from '../src/pages/UnitPage.svelte';
import StatsPage from '../src/pages/StatsPage.svelte';
import SearchPage from '../src/pages/SearchPage.svelte';
import SettingsPage from '../src/pages/SettingsPage.svelte';
import { exportData, importData, parseBackup } from '../src/lib/backup';
import { clearAll, getAllDays } from '../src/lib/db';
import { settings } from '../src/lib/settings.svelte';

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

  it('階段總複習考：未通過全部必修單元前鎖定；單元列表顯示入口狀態', async () => {
    app = mount(ExamPage, { target: document.body, props: { lang: 'ko', unitId: 'stage-K-A' } });
    await tick();
    expect(text()).toContain('字母階段總複習考');
    expect(text()).toContain('需先通過本階段全部必修單元');
    expect(btn('開始考試')).toBeUndefined();
    unmount(app); app = null; document.body.innerHTML = '';
    app = mount(UnitList, { target: document.body, props: { lang: 'ko' } });
    await tick();
    expect(text()).toContain('階段總複習考');
    expect(text()).toContain('未開放');
  });

  it('字母課：音節拼合練習可操作', async () => {
    app = mount(LessonPage, { target: document.body, props: { lang: 'ko', lessonId: 'K-A1-L1' } });
    await tick();
    expect(text()).toContain('音節拼合練習');
    await click([...document.querySelectorAll('.composer .keys button')].find((b) => b.textContent === 'ㄱ'));
    await click([...document.querySelectorAll('.composer .keys button')].find((b) => b.textContent === 'ㅗ'));
    expect(document.querySelector('.syll')?.textContent).toBe('고');
  });

  it('單字課：顯示釋義與例句，可切到下一項', async () => {
    app = mount(LessonPage, { target: document.body, props: { lang: 'ko', lessonId: 'K-B1-L1' } });
    await tick();
    expect(text()).toContain('一（漢字數字）');
    expect(text()).toContain('1 / 10');
    await click(btn('下一項'));
    expect(text()).toContain('二（漢字數字）');
  });

  it('文法課：說明、例句與即時練習可作答到完成', async () => {
    app = mount(LessonPage, { target: document.body, props: { lang: 'ko', lessonId: 'K-C1-L1' } });
    await tick();
    expect(text()).toContain('基本語序');
    expect(text()).toContain('即時練習');
    for (let guard = 0; guard < 10 && !text().includes('練習完成'); guard++) {
      if (document.querySelector('.drill .options')) await click(document.querySelector('.drill .options .opt'));
      else if (document.querySelector('.drill .bank')) {
        for (const c of document.querySelectorAll('.drill .bank .chip')) await click(c);
        await click(btn('送出'));
      } else {
        await click([...document.querySelectorAll('.drill .kb button')].find((b) => b.textContent === 'ㄱ'));
        await click(btn('送出'));
      }
      expect(text()).toContain('正解');
      await click([...document.querySelectorAll('.drill button')].find((b) => /下一題|完成練習/.test(b.textContent ?? '')));
    }
    expect(text()).toContain('練習完成');
  });

  it('文法與單字課的課後複習、單字單元考試可完成', async () => {
    await runLessonReview('K-C1-L1');
    await runLessonReview('K-B1-L1');
    const cards = await getAllCards();
    expect(cards.filter((c) => c.itemId.startsWith('ko.grammar.'))).toHaveLength(3);  // 文法單向
    expect(cards.filter((c) => c.itemId.startsWith('ko.word.'))).toHaveLength(20);    // 單字雙向
    app = mount(ExamPage, { target: document.body, props: { lang: 'ko', unitId: 'K-C1' } });
    await tick();
    await click(btn('開始考試'));
    expect(text()).toContain('第 1 / 15 題');
  });

  it('統計頁：顯示數字卡、圖表、語言進度與考試紀錄', async () => {
    app = mount(StatsPage, { target: document.body, props: {} });
    await tick(10);
    expect(text()).not.toContain('載入失敗');
    expect(text()).toContain('連續天數');
    expect(document.querySelector('svg')).toBeTruthy();
    expect(text()).toContain('K-A1');
    expect(text()).toContain('最常忘記的項目');
    document.querySelector('svg rect')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(2);
    expect(document.querySelector('.tip')).toBeTruthy();
  });

  it('搜尋頁：可用中文、韓文、無重音的葡文找到項目', async () => {
    for (const [q, expected] of [['泡菜', '김치'], ['학교', '學校'], ['coracao', 'coração'], ['過去式', 'P-C7']]) {
      app = mount(SearchPage, { target: document.body, props: { q } });
      await tick(12);
      expect(text(), q).toContain(expected);
      unmount(app); app = null; document.body.innerHTML = '';
    }
    app = mount(SearchPage, { target: document.body, props: { q: 'zzzzqqq' } });
    await tick(6);
    expect(text()).toContain('找不到');
  });

  it('依序解鎖：開啟後必修單元被擋、選修單元不擋', async () => {
    settings.enforceLocks = true;
    app = mount(UnitPage, { target: document.body, props: { lang: 'ko', unitId: 'K-A3' } });
    await tick();
    expect(text()).toContain('本單元尚未解鎖');
    unmount(app); app = null; document.body.innerHTML = '';
    app = mount(UnitPage, { target: document.body, props: { lang: 'pt', unitId: 'P-A5' } });
    await tick();
    expect(text()).not.toContain('本單元尚未解鎖');
    settings.enforceLocks = false;
  });

  it('設定頁可掛載；匯出 → 清空 → 匯入後資料還原', async () => {
    app = mount(SettingsPage, { target: document.body, props: {} });
    await tick();
    expect(text()).toContain('匯出備份檔');
    const before = await exportData();
    expect(before.cards.length).toBeGreaterThan(0);
    const json = JSON.stringify(before);
    await clearAll();
    expect(await getAllCards()).toHaveLength(0);
    await importData(parseBackup(json));
    expect(await getAllCards()).toHaveLength(before.cards.length);
    expect(await getAllExams()).toHaveLength(before.exams.length);
    expect(await getAllDays()).toHaveLength(before.days.length);
    expect(() => parseBackup('{"app":"other"}')).toThrow('不是本網頁');
    expect(() => parseBackup('not json')).toThrow('JSON');
    expect(() => parseBackup(JSON.stringify({ ...before, version: 99 }))).toThrow('請先更新');
    expect(() => parseBackup(JSON.stringify({ ...before, cards: [{ cardId: 'x' }] }))).toThrow('第 1 張卡片');
  });
});
