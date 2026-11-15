// Hash 路由（規格書第 7 節）：
// #/、#/:lang、#/:lang/unit/:id、#/:lang/lesson/:id、#/review、#/review/lesson/:id、
// #/:lang/exam/:unitId、#/search?q=、#/stats、#/settings
import type { LangCode } from './types';

export type Route =
  | { page: 'home' }
  | { page: 'units'; lang: LangCode }
  | { page: 'unit'; lang: LangCode; unitId: string }
  | { page: 'lesson'; lang: LangCode; lessonId: string }
  | { page: 'review'; lessonId?: string }
  | { page: 'exam'; lang: LangCode; unitId: string }
  | { page: 'search'; q: string }
  | { page: 'stats' }
  | { page: 'settings' }
  | { page: 'notfound'; path: string };

const isLang = (s: string): s is LangCode => s === 'ko' || s === 'pt';

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const seg = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = new URLSearchParams(queryPart);

  if (seg.length === 0) return { page: 'home' };
  if (seg[0] === 'review') {
    return seg[1] === 'lesson' && seg[2] ? { page: 'review', lessonId: seg[2] } : { page: 'review' };
  }
  if (seg[0] === 'search') return { page: 'search', q: query.get('q') ?? '' };
  if (seg[0] === 'stats') return { page: 'stats' };
  if (seg[0] === 'settings') return { page: 'settings' };
  if (isLang(seg[0])) {
    const lang = seg[0];
    if (seg.length === 1) return { page: 'units', lang };
    if (seg[1] === 'unit' && seg[2]) return { page: 'unit', lang, unitId: seg[2] };
    if (seg[1] === 'lesson' && seg[2]) return { page: 'lesson', lang, lessonId: seg[2] };
    if (seg[1] === 'exam' && seg[2]) return { page: 'exam', lang, unitId: seg[2] };
  }
  return { page: 'notfound', path: pathPart };
}

export function href(route: Route): string {
  switch (route.page) {
    case 'home': return '#/';
    case 'units': return `#/${route.lang}`;
    case 'unit': return `#/${route.lang}/unit/${route.unitId}`;
    case 'lesson': return `#/${route.lang}/lesson/${route.lessonId}`;
    case 'review': return route.lessonId ? `#/review/lesson/${route.lessonId}` : '#/review';
    case 'exam': return `#/${route.lang}/exam/${route.unitId}`;
    case 'search': return `#/search?q=${encodeURIComponent(route.q)}`;
    case 'stats': return '#/stats';
    case 'settings': return '#/settings';
    case 'notfound': return '#/';
  }
}

export function navigate(route: Route): void {
  location.hash = href(route);
}

// Svelte 5 rune 狀態，供元件讀取目前路由（檔名需為 .svelte.ts 才能使用 rune）。
export const router = $state<{ route: Route }>({
  route: typeof location !== 'undefined' ? parseHash(location.hash) : { page: 'home' },
});

export function startRouter(): () => void {
  const update = () => { router.route = parseHash(location.hash); };
  window.addEventListener('hashchange', update);
  update();
  return () => window.removeEventListener('hashchange', update);
}
