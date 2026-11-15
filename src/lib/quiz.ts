// 出題（規格 F3.1、F3.2）：依單元的 questionTypes 與項目類型隨機產生考題。純函式。
import { decompose } from './hangul';
import type { Item, LangCode, QuestionType } from './types';

export interface Opt { text: string; foreign: boolean; }
interface QBase {
  id: string; lang: LangCode; itemIds: string[];
  correctText: string;       // 回饋時顯示的正解
  reveal?: string;           // 作答後播放的正解語音
  audio?: string | null;
}
export interface ChoiceQ extends QBase {
  kind: 'choice' | 'listen-choice';
  prompt?: string; promptForeign?: boolean; speak?: string;
  options: Opt[]; answer: number;
}
export interface TypedQ extends QBase {
  kind: 'dictation' | 'spell' | 'fill' | 'compose';
  prompt?: string; promptForeign?: boolean; speak?: string; answers: string[];
}
export interface ReorderQ extends QBase { kind: 'reorder'; prompt: string; tokens: string[]; answer: string; }
export interface MatchQ extends QBase {
  kind: 'match'; pairs: { itemId: string; left: string; right: string }[]; rightOrder: number[];
}
export type Question = ChoiceQ | TypedQ | ReorderQ | MatchQ;

export const KIND_LABEL: Record<QuestionType, string> = {
  'choice': '選擇', 'listen-choice': '聽音選擇', 'dictation': '聽寫', 'spell': '拼寫',
  'match': '配對', 'fill': '填空', 'reorder': '句子重組', 'compose': '音節拼合',
};

type Rng = () => number;
export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

interface Triple { speak: string; foreign: string; native: string; typed: string[] | null; }
/** 每個項目的「發音／原文／中文」三元組，選擇與配對題共用。 */
export function tripleOf(item: Item): Triple | null {
  if (item.type === 'letter') {
    const say = item.tts ?? item.text;
    return { speak: say, foreign: item.text, native: item.roman, typed: [say] };
  }
  if (item.type === 'word') {
    return { speak: item.text, foreign: item.text, native: item.meaning, typed: [item.text, ...(item.accepted ?? [])] };
  }
  const ex = item.examples[0];
  return ex ? { speak: ex.text, foreign: ex.text, native: ex.meaning, typed: null } : null;
}

function makeOptions(correct: string, pool: string[], foreign: boolean, rng: Rng): { options: Opt[]; answer: number } | null {
  const distractors = shuffle([...new Set(pool.filter((p) => p !== correct))], rng).slice(0, 3);
  if (distractors.length < 1) return null;
  const texts = shuffle([correct, ...distractors], rng);
  return { options: texts.map((text) => ({ text, foreign })), answer: texts.indexOf(correct) };
}

function candidatesFor(item: Item, all: Item[], lang: LangCode, types: Set<QuestionType>, rng: Rng): Question[] {
  const out: Question[] = [];
  const t = tripleOf(item);
  const peers = all.filter((x) => x.type === item.type && x.id !== item.id).map(tripleOf).filter((x): x is Triple => !!x);
  const base = { lang, itemIds: [item.id], audio: item.type === 'grammar' ? null : item.audio ?? null };

  if (t && types.has('choice')) {
    const a = makeOptions(t.native, peers.map((p) => p.native), false, rng);
    if (a) out.push({ ...base, id: `${item.id}:choice:f2n`, kind: 'choice', prompt: t.foreign, promptForeign: true, ...a, correctText: `${t.foreign} ＝ ${t.native}`, reveal: t.speak });
    const b = makeOptions(t.foreign, peers.map((p) => p.foreign), true, rng);
    if (b) out.push({ ...base, id: `${item.id}:choice:n2f`, kind: 'choice', prompt: t.native, ...b, correctText: `${t.native} ＝ ${t.foreign}`, reveal: t.speak });
  }
  if (t && types.has('listen-choice')) {
    const useForeign = item.type === 'letter';
    const correct = useForeign ? t.foreign : t.native;
    const o = makeOptions(correct, peers.map((p) => (useForeign ? p.foreign : p.native)), useForeign, rng);
    if (o) out.push({ ...base, id: `${item.id}:listen`, kind: 'listen-choice', speak: t.speak, ...o, correctText: `${t.foreign} ＝ ${t.native}`, reveal: t.speak });
  }
  if (t?.typed && types.has('dictation')) {
    out.push({ ...base, id: `${item.id}:dictation`, kind: 'dictation', speak: t.speak, answers: t.typed, correctText: t.typed[0], reveal: t.speak });
  }
  if (item.type === 'word' && t?.typed && types.has('spell')) {
    out.push({ ...base, id: `${item.id}:spell`, kind: 'spell', prompt: t.native, answers: t.typed, correctText: t.typed[0], reveal: t.speak });
  }
  if (item.type === 'letter' && lang === 'ko' && item.tts && types.has('compose')) {
    const parts = decompose(item.tts);
    if (parts.length >= 2) {
      out.push({ ...base, id: `${item.id}:compose`, kind: 'compose', prompt: parts.join(' ＋ '), promptForeign: true, answers: [item.tts], correctText: `${parts.join(' ＋ ')} ＝ ${item.tts}`, reveal: item.tts });
    }
  }
  if (item.type === 'grammar') {
    (item.drills ?? []).forEach((d, i) => {
      if (d.type === 'fill' && types.has('fill')) {
        out.push({ ...base, id: `${item.id}:fill:${i}`, kind: 'fill', prompt: d.text, promptForeign: true, answers: d.answer.split('|'), correctText: d.text.replace(/_+/, d.answer.split('|')[0]), reveal: d.text.replace(/_+/, d.answer.split('|')[0]) });
      } else if (d.type === 'choice' && d.options && types.has('choice')) {
        const texts = shuffle(d.options, rng);
        out.push({ ...base, id: `${item.id}:drillchoice:${i}`, kind: 'choice', prompt: d.text, promptForeign: true, options: texts.map((text) => ({ text, foreign: true })), answer: texts.indexOf(d.answer), correctText: d.answer });
      } else if (d.type === 'reorder' && types.has('reorder')) {
        const q = makeReorder(`${item.id}:reorder:d${i}`, base, d.text, d.answer, rng);
        if (q) out.push(q);
      }
    });
  }
  if (types.has('reorder')) {
    (item.examples ?? []).forEach((ex, i) => {
      const q = makeReorder(`${item.id}:reorder:e${i}`, base, ex.meaning, ex.text, rng);
      if (q) out.push(q);
    });
  }
  return out;
}

function makeReorder(id: string, base: Pick<QBase, 'lang' | 'itemIds' | 'audio'>, prompt: string, answer: string, rng: Rng): ReorderQ | null {
  const words = answer.trim().split(/\s+/);
  if (words.length < 3) return null;
  let tokens = shuffle(words, rng);
  for (let k = 0; k < 5 && tokens.join(' ') === words.join(' '); k++) tokens = shuffle(words, rng);
  return { ...base, audio: null, id, kind: 'reorder', prompt, tokens, answer: words.join(' '), correctText: words.join(' '), reveal: answer };
}

function makeMatch(items: Item[], lang: LangCode, n: number, seq: number, rng: Rng): MatchQ | null {
  const pairs: MatchQ['pairs'] = [];
  const seen = new Set<string>();
  for (const it of shuffle(items, rng)) {
    const t = tripleOf(it);
    if (!t || seen.has(t.native) || seen.has(t.foreign)) continue;
    seen.add(t.native); seen.add(t.foreign);
    pairs.push({ itemId: it.id, left: t.foreign, right: t.native });
    if (pairs.length >= n) break;
  }
  if (pairs.length < 4) return null;
  return {
    id: `match:${seq}:${pairs.map((p) => p.itemId).join(',')}`, lang, kind: 'match', itemIds: pairs.map((p) => p.itemId),
    pairs, rightOrder: shuffle(pairs.map((_, i) => i), rng), correctText: pairs.map((p) => `${p.left} ＝ ${p.right}`).join('、'),
  };
}

export interface ExamSpecLite { questionCount: number; questionTypes: QuestionType[]; }

/** 產生一份考題。每個項目輪流出題，題型盡量平均；題庫不足時允許重複題型。 */
export function generateExam(items: Item[], lang: LangCode, spec: ExamSpecLite, rng: Rng = Math.random): Question[] {
  const types = new Set(spec.questionTypes);
  const count = Math.max(1, spec.questionCount);
  const out: Question[] = [];
  const kindUse = new Map<QuestionType, number>();
  const bump = (k: QuestionType) => kindUse.set(k, (kindUse.get(k) ?? 0) + 1);

  if (types.has('match')) {
    const n = Math.min(3, Math.max(1, Math.round(count / 8)));
    for (let k = 0; k < n; k++) {
      const m = makeMatch(items, lang, 5, k, rng);
      if (m) { out.push(m); bump('match'); }
    }
  }

  const order = shuffle(items, rng);
  let used = new Set<string>();
  for (let round = 0; round < 50 && out.length < count; round++) {
    let progressed = false;
    for (const it of order) {
      if (out.length >= count) break;
      const cands = shuffle(candidatesFor(it, items, lang, types, rng).filter((c) => !used.has(c.id)), rng)
        .sort((a, b) => (kindUse.get(a.kind) ?? 0) - (kindUse.get(b.kind) ?? 0));
      if (cands.length === 0) continue;
      out.push(cands[0]); used.add(cands[0].id); bump(cands[0].kind); progressed = true;
    }
    if (!progressed) {
      if (used.size === 0) break; // 完全沒有可出的題
      used = new Set();           // 題庫用完，允許重複
    }
  }
  return shuffle(out, rng);
}
