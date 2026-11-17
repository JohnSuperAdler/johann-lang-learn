// 跨裝置同步的合併規則（規格書 F7：任何一邊的進度都不倒退；首次登入合併而非覆蓋）。
import { describe, expect, it } from 'vitest';
import { chunk, fromRemote, mergeDay, newerCard, planCards, planDays, planExams, toRemote } from '../src/lib/syncMerge';
import type { CardRecord, DayStat, ExamRecord } from '../src/lib/types';

const card = (patch: Partial<CardRecord> = {}): CardRecord => ({
  cardId: 'ko.letter.a#recognize', itemId: 'ko.letter.a', lang: 'ko', direction: 'recognize', state: 'review',
  interval: 3, ease: 2.5, due: '2026-11-20', reps: 2, lapses: 0, lastReviewed: '2026-11-17T10:00:00.000Z', ...patch,
});
const day = (patch: Partial<DayStat> = {}): DayStat => ({ date: '2026-11-17', reviewed: 10, correct: 8, newLearned: 3, ...patch });
const exam = (id: string): ExamRecord => ({ id, unitId: 'K-A1', lang: 'ko', date: '2026-11-17', score: 90, total: 20, passed: true, wrongItemIds: [], durationSec: 60 });

describe('newerCard', () => {
  it('本機沒有 → 遠端', () => { expect(newerCard(undefined, card())).toBe('remote'); });
  it('最後複習時間較新者勝', () => {
    expect(newerCard(card({ lastReviewed: '2026-11-17T10:00:00.000Z' }), card({ lastReviewed: '2026-11-18T08:00:00.000Z' }))).toBe('remote');
    expect(newerCard(card({ lastReviewed: '2026-11-18T08:00:00.000Z' }), card({ lastReviewed: '2026-11-17T10:00:00.000Z' }))).toBe('local');
  });
  it('從未複習（null）輸給有複習紀錄的', () => {
    expect(newerCard(card({ lastReviewed: null, reps: 0 }), card())).toBe('remote');
    expect(newerCard(card(), card({ lastReviewed: null, reps: 0 }))).toBe('local');
  });
  it('時間相同時複習次數多者勝，完全相同保留本機', () => {
    expect(newerCard(card({ reps: 2 }), card({ reps: 3 }))).toBe('remote');
    expect(newerCard(card(), card())).toBe('local');
  });
  it('考試錯題（priority 1、提早到期）會同步到另一台', () => {
    expect(newerCard(card(), card({ priority: 1, due: '2026-11-17' }))).toBe('remote');
    expect(newerCard(card({ priority: 1, due: '2026-11-17' }), card())).toBe('local');
  });
});

describe('planCards', () => {
  it('遠端較新 → 寫回本機且不標 dirty；本機較新 → 上傳；相同 → 不動', () => {
    const local = new Map([
      ['a', card({ cardId: 'a', lastReviewed: '2026-11-17T00:00:00.000Z' })],
      ['b', card({ cardId: 'b', lastReviewed: '2026-11-18T00:00:00.000Z', interval: 7 })],
      ['c', card({ cardId: 'c' })],
    ]);
    const plan = planCards(local, [
      card({ cardId: 'a', lastReviewed: '2026-11-18T00:00:00.000Z', interval: 8 }),
      card({ cardId: 'b', lastReviewed: '2026-11-17T00:00:00.000Z' }),
      card({ cardId: 'c' }),
      card({ cardId: 'd' }),
    ]);
    expect(plan.toLocal.map((c) => [c.cardId, c.interval, c.dirty])).toEqual([['a', 8, false], ['d', 3, false]]);
    expect(plan.toPush).toEqual(['b']);
  });
  it('進度不倒退：兩台各自複習不同卡片，合併後兩邊的進度都保留', () => {
    const desktop = new Map([['x', card({ cardId: 'x', interval: 7, lastReviewed: '2026-11-18T09:00:00.000Z' })], ['y', card({ cardId: 'y', interval: 1, lastReviewed: '2026-11-10T00:00:00.000Z' })]]);
    const phone = [card({ cardId: 'x', interval: 1, lastReviewed: '2026-11-10T00:00:00.000Z' }), card({ cardId: 'y', interval: 9, lastReviewed: '2026-11-18T10:00:00.000Z' })];
    const plan = planCards(desktop, phone);
    expect(plan.toLocal.map((c) => [c.cardId, c.interval])).toEqual([['y', 9]]);
    expect(plan.toPush).toEqual(['x']);
  });
});

describe('planExams', () => {
  it('考試紀錄只增不減：只把本機沒有的寫回', () => {
    const plan = planExams(new Map([['e1', exam('e1')]]), [exam('e1'), exam('e2')]);
    expect(plan.toLocal.map((e) => e.id)).toEqual(['e2']);
  });
});

describe('mergeDay / planDays', () => {
  it('同一天各欄位取較大值，cleared 取聯集', () => {
    expect(mergeDay(day({ reviewed: 20, correct: 15, newLearned: 2 }), day({ reviewed: 12, correct: 12, newLearned: 5, cleared: true })))
      .toEqual({ date: '2026-11-17', reviewed: 20, correct: 15, newLearned: 5, cleared: true });
  });
  it('合併結果比遠端大 → 寫回本機並標 dirty、排入上傳；遠端較大 → 只寫回本機', () => {
    const plan = planDays(new Map([['2026-11-17', day({ reviewed: 20 })], ['2026-11-16', day({ date: '2026-11-16', reviewed: 3 })]]), [
      day({ reviewed: 10, newLearned: 6 }),
      day({ date: '2026-11-16', reviewed: 30 }),
    ]);
    expect(plan.toLocal.map((d) => [d.date, d.reviewed, d.newLearned, d.dirty])).toEqual([['2026-11-17', 20, 6, true], ['2026-11-16', 30, 3, false]]);
    expect(plan.toPush).toEqual(['2026-11-17']);
  });
  it('兩邊相同 → 什麼都不做', () => {
    const plan = planDays(new Map([['2026-11-17', day()]]), [day()]);
    expect(plan).toEqual({ toLocal: [], toPush: [] });
  });
});

describe('toRemote / fromRemote / chunk', () => {
  it('上傳前去掉 dirty 與 undefined，讀回時去掉 syncedAt', () => {
    const r = toRemote({ ...card(), dirty: true, priority: undefined });
    expect('dirty' in r).toBe(false);
    expect('priority' in r).toBe(false);
    expect(fromRemote<CardRecord>({ ...r, syncedAt: { seconds: 1 } })).toEqual(r);
  });
  it('每批最多 400 筆', () => {
    expect(chunk(Array.from({ length: 901 }, (_, i) => i), 400).map((c) => c.length)).toEqual([400, 400, 101]);
  });
});
