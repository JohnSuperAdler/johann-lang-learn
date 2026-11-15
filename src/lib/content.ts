// content-loader：載入 content/ 下的靜態 JSON，記憶體快取，單元教材按需載入。
import type { ContentIndex, Course, Item, LangCode, Lesson, Unit, Stage } from './types';

const BASE = `${import.meta.env.BASE_URL}content/`;

const cache = {
  index: null as Promise<ContentIndex> | null,
  courses: new Map<LangCode, Promise<Course>>(),
  units: new Map<string, Promise<Item[]>>(),
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`載入失敗：${path}（HTTP ${res.status}）`);
  return (await res.json()) as T;
}

export function loadIndex(): Promise<ContentIndex> {
  if (!cache.index) cache.index = fetchJson<ContentIndex>('index.json');
  return cache.index;
}

export async function loadCourse(lang: LangCode): Promise<Course> {
  let p = cache.courses.get(lang);
  if (!p) {
    p = loadIndex().then((idx) => {
      const entry = idx.languages.find((l) => l.lang === lang);
      if (!entry) throw new Error(`index.json 沒有語言 ${lang}`);
      return fetchJson<Course>(entry.course);
    });
    cache.courses.set(lang, p);
  }
  return p;
}

/** 單元教材檔：預設路徑 `${lang}/items/${unitId}.json`，可由 unit.itemsFile 覆寫。 */
export async function loadUnitItems(lang: LangCode, unit: Unit): Promise<Item[]> {
  const key = `${lang}/${unit.id}`;
  let p = cache.units.get(key);
  if (!p) {
    const path = unit.itemsFile ?? `${lang}/items/${unit.id}.json`;
    p = fetchJson<Item[]>(path).catch((err) => {
      // 教材尚未撰寫時回傳空陣列，讓頁面仍可顯示單元結構。
      console.warn(err);
      return [] as Item[];
    });
    cache.units.set(key, p);
  }
  return p;
}

export interface UnitLocator { stage: Stage; unit: Unit; }
export interface LessonLocator extends UnitLocator { lesson: Lesson; }

export function findUnit(course: Course, unitId: string): UnitLocator | null {
  for (const stage of course.stages) {
    const unit = stage.units.find((u) => u.id === unitId);
    if (unit) return { stage, unit };
  }
  return null;
}

export function findLesson(course: Course, lessonId: string): LessonLocator | null {
  for (const stage of course.stages) {
    for (const unit of stage.units) {
      const lesson = unit.lessons.find((l) => l.id === lessonId);
      if (lesson) return { stage, unit, lesson };
    }
  }
  return null;
}

export function allUnits(course: Course): UnitLocator[] {
  return course.stages.flatMap((stage) => stage.units.map((unit) => ({ stage, unit })));
}

/** 課程總項目數（以 lessons 的 itemIds 計，教材未寫時為 0）。 */
export function countItems(course: Course): number {
  return allUnits(course).reduce(
    (n, { unit }) => n + unit.lessons.reduce((m, l) => m + l.itemIds.length, 0), 0);
}
