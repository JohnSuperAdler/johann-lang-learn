#!/usr/bin/env node
// 教材格式檢查：npm run validate
// 檢查 index.json → course.json → items/*.json 的一致性；有錯誤時 exit 1。
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'content');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function readJson(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) { err(`檔案不存在：${rel}`); return null; }
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { err(`JSON 解析失敗：${rel}（${e.message}）`); return null; }
}

const QUESTION_TYPES = new Set(['choice', 'listen-choice', 'dictation', 'spell', 'match', 'fill', 'reorder', 'compose']);
const ITEM_REQUIRED = {
  letter: ['text', 'roman', 'name'],
  word: ['text', 'meaning'],
  grammar: ['title', 'explanation', 'examples'],
};

const index = readJson('index.json');
if (index) {
  if (!Array.isArray(index.languages) || index.languages.length === 0) err('index.json 的 languages 為空');
  for (const entry of index.languages ?? []) checkCourse(entry);
}

function checkCourse(entry) {
  const course = readJson(entry.course);
  if (!course) return;
  const lang = course.lang;
  if (lang !== entry.lang) err(`${entry.course}: lang ${lang} 與 index.json 的 ${entry.lang} 不符`);

  const unitIds = new Set();
  const lessonIds = new Set();
  const units = [];
  for (const stage of course.stages ?? []) {
    if (!['alphabet', 'vocab', 'grammar'].includes(stage.kind)) err(`${lang} 階段 ${stage.id}: kind 無效 ${stage.kind}`);
    for (const unit of stage.units ?? []) {
      if (unitIds.has(unit.id)) err(`${lang} 單元 id 重複：${unit.id}`);
      unitIds.add(unit.id);
      units.push(unit);
      if (!Array.isArray(unit.requires)) err(`${lang} ${unit.id}: 缺 requires 陣列`);
      if (!unit.exam || typeof unit.exam.questionCount !== 'number' || typeof unit.exam.passRate !== 'number') err(`${lang} ${unit.id}: exam 欄位不完整`);
      for (const qt of unit.exam?.questionTypes ?? []) if (!QUESTION_TYPES.has(qt)) err(`${lang} ${unit.id}: 題型無效 ${qt}`);
      for (const lesson of unit.lessons ?? []) {
        if (lessonIds.has(lesson.id)) err(`${lang} 課程 id 重複：${lesson.id}`);
        lessonIds.add(lesson.id);
        if (!lesson.id.startsWith(unit.id + '-')) warn(`${lang} 課程 ${lesson.id} 的 id 建議以 ${unit.id}- 開頭`);
        if (!Array.isArray(lesson.itemIds) || lesson.itemIds.length === 0) err(`${lang} ${lesson.id}: itemIds 為空`);
      }
    }
  }
  for (const unit of units) {
    for (const req of unit.requires ?? []) if (!unitIds.has(req)) err(`${lang} ${unit.id}: requires 指向不存在的單元 ${req}`);
  }

  // 單元教材檔
  const seenItemIds = new Set();
  for (const unit of units) {
    const rel = unit.itemsFile ?? `${lang}/items/${unit.id}.json`;
    const hasLessons = (unit.lessons ?? []).length > 0;
    if (!existsSync(join(root, rel))) {
      if (hasLessons) err(`${lang} ${unit.id}: 有課程但缺教材檔 ${rel}`);
      continue;
    }
    const items = readJson(rel);
    if (!Array.isArray(items)) { err(`${rel}: 應為陣列`); continue; }
    const ids = new Set();
    for (const it of items) {
      if (!it.id || !it.type) { err(`${rel}: 項目缺 id 或 type（${JSON.stringify(it).slice(0, 60)}）`); continue; }
      if (!it.id.startsWith(`${lang}.`)) warn(`${rel}: ${it.id} 建議以 ${lang}. 開頭`);
      if (ids.has(it.id)) err(`${rel}: id 重複 ${it.id}`);
      if (seenItemIds.has(it.id)) err(`${lang}: 項目 id 跨檔重複 ${it.id}`);
      ids.add(it.id); seenItemIds.add(it.id);
      const req = ITEM_REQUIRED[it.type];
      if (!req) { err(`${rel}: ${it.id} type 無效 ${it.type}`); continue; }
      for (const f of req) if (it[f] === undefined || it[f] === '' ) err(`${rel}: ${it.id} 缺欄位 ${f}`);
      for (const ex of it.examples ?? []) if (!ex.text || !ex.meaning) err(`${rel}: ${it.id} 例句缺 text 或 meaning`);
      for (const d of it.drills ?? []) {
        if (!QUESTION_TYPES.has(d.type)) err(`${rel}: ${it.id} drill 題型無效 ${d.type}`);
        if (!d.text || d.answer === undefined) err(`${rel}: ${it.id} drill 缺 text 或 answer`);
      }
    }
    const referenced = new Set();
    for (const lesson of unit.lessons ?? []) {
      for (const iid of lesson.itemIds ?? []) {
        referenced.add(iid);
        if (!ids.has(iid)) err(`${lang} ${lesson.id}: itemId ${iid} 不在 ${rel}`);
      }
    }
    for (const id of ids) if (!referenced.has(id)) warn(`${rel}: ${id} 沒有被任何課程引用`);
    if (!hasLessons) warn(`${lang} ${unit.id}: 有教材檔但 lessons 為空`);
  }
  console.log(`${lang}: ${units.length} 單元、${lessonIds.size} 課、${seenItemIds.size} 個項目`);
}

for (const w of warnings) console.log('警告：' + w);
for (const e of errors) console.error('錯誤：' + e);
console.log(errors.length === 0 ? `通過（${warnings.length} 個警告）` : `失敗：${errors.length} 個錯誤`);
process.exit(errors.length === 0 ? 0 : 1);
