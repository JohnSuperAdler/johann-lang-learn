import { describe, expect, it } from 'vitest';
import { href, parseHash, type Route } from '../src/lib/router.svelte';

describe('parseHash', () => {
  it('空 hash 為首頁', () => {
    expect(parseHash('')).toEqual({ page: 'home' });
    expect(parseHash('#/')).toEqual({ page: 'home' });
  });
  it('語言、單元、課程、考試', () => {
    expect(parseHash('#/ko')).toEqual({ page: 'units', lang: 'ko' });
    expect(parseHash('#/pt/unit/P-B6')).toEqual({ page: 'unit', lang: 'pt', unitId: 'P-B6' });
    expect(parseHash('#/ko/lesson/K-A1-L1')).toEqual({ page: 'lesson', lang: 'ko', lessonId: 'K-A1-L1' });
    expect(parseHash('#/ko/exam/K-A1')).toEqual({ page: 'exam', lang: 'ko', unitId: 'K-A1' });
  });
  it('複習、搜尋、統計、設定', () => {
    expect(parseHash('#/review')).toEqual({ page: 'review' });
    expect(parseHash('#/review/lesson/K-A1-L1')).toEqual({ page: 'review', lessonId: 'K-A1-L1' });
    expect(parseHash('#/search?q=%E6%8B%9B%E5%BC%8F')).toEqual({ page: 'search', q: '招式' });
    expect(parseHash('#/stats')).toEqual({ page: 'stats' });
    expect(parseHash('#/settings')).toEqual({ page: 'settings' });
  });
  it('未知路徑與未知語言', () => {
    expect(parseHash('#/jp')).toEqual({ page: 'notfound', path: '/jp' });
    expect(parseHash('#/ko/foo')).toEqual({ page: 'notfound', path: '/ko/foo' });
  });
  it('href 與 parseHash 互逆', () => {
    const routes: Route[] = [
      { page: 'home' }, { page: 'units', lang: 'pt' }, { page: 'unit', lang: 'ko', unitId: 'K-A1' },
      { page: 'lesson', lang: 'ko', lessonId: 'K-A1-L1' }, { page: 'review' }, { page: 'review', lessonId: 'X' },
      { page: 'exam', lang: 'pt', unitId: 'P-C1' }, { page: 'search', q: 'ginga' }, { page: 'stats' }, { page: 'settings' },
    ];
    for (const r of routes) expect(parseHash(href(r))).toEqual(r);
  });
});
