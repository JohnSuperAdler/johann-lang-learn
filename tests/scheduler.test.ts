import { describe, expect, it } from 'vitest';
import { addDays, applySchedule, diffDays, previewInterval, schedule, sortDue } from '../src/lib/scheduler';
import type { CardRecord } from '../src/lib/types';

const TODAY = '2026-11-15';
const NOW = '2026-11-15T10:00:00+08:00';

function card(p: Partial<CardRecord> = {}): CardRecord {
  return {
    cardId: 'ko.letter.a#recognize', itemId: 'ko.letter.a', lang: 'ko', direction: 'recognize',
    state: 'new', interval: 0, ease: 2.5, due: TODAY, reps: 0, lapses: 0, lastReviewed: null, ...p,
  };
}

describe('日期工具', () => {
  it('addDays / diffDays', () => {
    expect(addDays('2026-11-15', 1)).toBe('2026-11-16');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-11-10', '2026-11-15')).toBe(5);
  });
});

describe('schedule：新卡', () => {
  it('記得 → 1 天後到期，進入 review', () => {
    const r = schedule(card(), 3, TODAY, NOW);
    expect(r).toMatchObject({ state: 'review', interval: 1, due: '2026-11-16', reps: 1, lapses: 0, ease: 2.5 });
  });
  it('忘記 → 間隔 0、當天再出現、仍為 learning、不算 lapse', () => {
    const r = schedule(card(), 1, TODAY, NOW);
    expect(r).toMatchObject({ state: 'learning', interval: 0, due: TODAY, lapses: 0, ease: 2.5 });
  });
  it('困難 → 1 天，ease −0.15', () => {
    const r = schedule(card(), 2, TODAY, NOW);
    expect(r).toMatchObject({ state: 'review', interval: 1, ease: 2.35 });
  });
  it('很簡單 → 2 天，ease +0.15', () => {
    const r = schedule(card(), 4, TODAY, NOW);
    expect(r).toMatchObject({ state: 'review', interval: 2, ease: 2.65 });
  });
});

describe('schedule：複習中的卡', () => {
  it('第二次記得 → 3 天', () => {
    const r = schedule(card({ state: 'review', interval: 1, reps: 1 }), 3, TODAY, NOW);
    expect(r.interval).toBe(3);
    expect(r.due).toBe('2026-11-18');
  });
  it('之後 × ease', () => {
    const r = schedule(card({ state: 'review', interval: 3, reps: 2 }), 3, TODAY, NOW);
    expect(r.interval).toBe(8); // round(3 × 2.5)
    const r2 = schedule(card({ state: 'review', interval: 8, reps: 3 }), 3, TODAY, NOW);
    expect(r2.interval).toBe(20);
  });
  it('困難 → ×1.2，ease −0.15', () => {
    const r = schedule(card({ state: 'review', interval: 10, reps: 4 }), 2, TODAY, NOW);
    expect(r.interval).toBe(12);
    expect(r.ease).toBe(2.35);
  });
  it('很簡單 → ×1.3 於基準之上，ease +0.15', () => {
    const r = schedule(card({ state: 'review', interval: 10, reps: 4 }), 4, TODAY, NOW);
    expect(r.interval).toBe(33); // base 25 × 1.3 = 32.5 → 33
    expect(r.ease).toBe(2.65);
  });
  it('忘記 → relearning、lapses+1、ease −0.2、當天到期', () => {
    const r = schedule(card({ state: 'review', interval: 10, reps: 4 }), 1, TODAY, NOW);
    expect(r).toMatchObject({ state: 'relearning', interval: 0, lapses: 1, ease: 2.3, due: TODAY });
  });
  it('relearning 再記得 → 從 1 天重新起算', () => {
    const r = schedule(card({ state: 'relearning', interval: 0, lapses: 1, ease: 2.3 }), 3, TODAY, NOW);
    expect(r).toMatchObject({ state: 'review', interval: 1, due: '2026-11-16' });
  });
  it('ease 下限 1.3、上限 3.0', () => {
    const low = schedule(card({ state: 'review', interval: 5, ease: 1.35 }), 1, TODAY, NOW);
    expect(low.ease).toBe(1.3);
    const high = schedule(card({ state: 'review', interval: 5, ease: 2.95 }), 4, TODAY, NOW);
    expect(high.ease).toBe(3.0);
  });
  it('間隔永不倒退：ease 很低時仍至少 +1 天', () => {
    const r = schedule(card({ state: 'review', interval: 5, ease: 1.3 }), 3, TODAY, NOW);
    expect(r.interval).toBeGreaterThan(5);
  });
});

describe('applySchedule / previewInterval / sortDue', () => {
  it('applySchedule 保留識別欄位並標 dirty', () => {
    const c = applySchedule(card(), 3, TODAY, NOW);
    expect(c.cardId).toBe('ko.letter.a#recognize');
    expect(c.dirty).toBe(true);
    expect(c.lastReviewed).toBe(NOW);
  });
  it('previewInterval 文字', () => {
    expect(previewInterval(card(), 1, TODAY)).toBe('<1 天');
    expect(previewInterval(card(), 3, TODAY)).toBe('1 天');
    expect(previewInterval(card({ state: 'review', interval: 30, ease: 2.5 }), 3, TODAY)).toBe('3 個月');
  });
  it('sortDue：priority 高者優先，其次到期最久', () => {
    const a = card({ cardId: 'a', due: '2026-11-14' });
    const b = card({ cardId: 'b', due: '2026-11-10' });
    const c = card({ cardId: 'c', due: '2026-11-15', priority: 1 });
    expect(sortDue([a, b, c], TODAY).map((x) => x.cardId)).toEqual(['c', 'b', 'a']);
  });
});
