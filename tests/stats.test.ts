import { describe, expect, it } from 'vitest';
import { computeStreak } from '../src/lib/stats';
import type { DayStat } from '../src/lib/types';

const d = (date: string, reviewed: number, cleared = false): DayStat => ({ date, reviewed, correct: reviewed, newLearned: 0, cleared });

describe('computeStreak', () => {
  it('今天已完成：含今天連續計數', () => {
    const days = [d('2026-11-13', 25), d('2026-11-14', 0, true), d('2026-11-15', 20)];
    expect(computeStreak(days, '2026-11-15')).toBe(3);
  });
  it('今天未完成：從昨天算，不中斷', () => {
    const days = [d('2026-11-13', 25), d('2026-11-14', 30), d('2026-11-15', 5)];
    expect(computeStreak(days, '2026-11-15')).toBe(2);
  });
  it('昨天缺席則歸零', () => {
    const days = [d('2026-11-12', 25), d('2026-11-13', 25)];
    expect(computeStreak(days, '2026-11-15')).toBe(0);
  });
  it('少於 20 張且未清空不算完成', () => {
    expect(computeStreak([d('2026-11-14', 19)], '2026-11-15')).toBe(0);
    expect(computeStreak([d('2026-11-14', 3, true)], '2026-11-15')).toBe(1);
  });
});

import { cardBreakdown, examSummary, lastNDays, niceMax, totals, weakItems } from '../src/lib/statsData';
import type { CardRecord, ExamRecord } from '../src/lib/types';

describe('statsData', () => {
  const card = (itemId: string, dir: string, patch: Partial<CardRecord>): CardRecord => ({
    cardId: `${itemId}#${dir}`, itemId, lang: 'ko', direction: 'recognize', state: 'review', interval: 3, ease: 2.5,
    due: '2026-11-20', reps: 2, lapses: 0, lastReviewed: null, ...patch,
  });
  it('lastNDays 補齊缺日且以今天結尾', () => {
    const out = lastNDays([{ date: '2026-11-15', reviewed: 5, correct: 4, newLearned: 2 }], '2026-11-16', 30);
    expect(out).toHaveLength(30);
    expect(out.at(-1)?.date).toBe('2026-11-16');
    expect(out.at(-2)?.reviewed).toBe(5);
    expect(out[0].date).toBe('2026-10-18');
  });
  it('totals 計算正確率，無資料時為 null', () => {
    expect(totals([]).accuracy).toBeNull();
    expect(totals([{ date: 'a', reviewed: 10, correct: 8, newLearned: 1 }, { date: 'b', reviewed: 10, correct: 7, newLearned: 0 }]).accuracy).toBe(0.75);
  });
  it('cardBreakdown 依狀態與間隔分類', () => {
    const b = cardBreakdown([
      card('a', 'r', { state: 'new' }), card('a', 'p', { state: 'relearning' }), card('b', 'r', { interval: 5 }),
      card('c', 'r', { interval: 30 }), card('d', 'r', { lang: 'pt' }),
    ], 'ko');
    expect(b).toEqual({ items: 3, cards: 4, fresh: 1, learning: 1, young: 1, mature: 1 });
  });
  it('weakItems 加總同項目的 lapses 並排序', () => {
    const w = weakItems([card('a', 'r', { lapses: 1 }), card('a', 'p', { lapses: 2 }), card('b', 'r', { lapses: 2 }), card('c', 'r', {})]);
    expect(w.map((x) => [x.itemId, x.lapses])).toEqual([['a', 3], ['b', 2]]);
  });
  it('examSummary 取最高、最近與是否通過', () => {
    const e = (id: string, score: number, passed: boolean): ExamRecord => ({ id, unitId: 'K-A1', lang: 'ko', date: '2026-11-16', score, total: 20, passed, wrongItemIds: [], durationSec: 1 });
    const s = examSummary([e('2', 60, false), e('1', 90, true)]).get('K-A1');
    expect(s).toMatchObject({ attempts: 2, best: 90, last: 60, passed: true });
  });
  it('niceMax', () => { expect([3, 10, 11, 47, 60, 120].map(niceMax)).toEqual([10, 10, 20, 50, 100, 200]); });
});
