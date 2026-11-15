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
