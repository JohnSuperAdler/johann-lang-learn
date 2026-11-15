
import { describe, expect, it } from 'vitest';
import ka1Raw from '../public/content/ko/items/K-A1.json';
import { gradeTyped, normalizeAnswer } from '../src/lib/grader';
import { backspace, compose, decompose, typeJamo } from '../src/lib/hangul';
import { generateExam } from '../src/lib/quiz';
import type { Item, WordItem } from '../src/lib/types';

const ka1 = ka1Raw as Item[];

describe('hangul', () => {
  it('compose / decompose', () => {
    expect(compose(['ㅇ', 'ㅏ'])).toBe('아');
    expect(compose(['ㅎ', 'ㅏ', 'ㄴ', 'ㄱ', 'ㅡ', 'ㄹ'])).toBe('한글');
    expect(compose(['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ'])).toBe('닭');
    expect(compose(['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ', 'ㅇ', 'ㅣ'])).toBe('닭이');
    expect(compose(['ㄱ', 'ㅗ', 'ㅏ'])).toBe('과');
    expect(compose(['ㅇ', 'ㅜ', 'ㅇ', 'ㅠ'])).toBe('우유');
    expect(decompose('닭')).toEqual(['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ']);
    expect(decompose('과')).toEqual(['ㄱ', 'ㅗ', 'ㅏ']);
  });
  it('typeJamo / backspace', () => {
    let v = '';
    for (const j of ['ㅇ', 'ㅏ', 'ㄴ', 'ㄴ', 'ㅕ', 'ㅇ']) v = typeJamo(v, j);
    expect(v).toBe('안녕');
    expect(backspace(v)).toBe('안녀');
    expect(backspace('아')).toBe('ㅇ');
  });
});

describe('grader', () => {
  it('忽略大小寫、空白、句末標點', () => {
    expect(gradeTyped('  Bom  Dia! ', ['bom dia'])).toBe('correct');
    expect(normalizeAnswer('Olá, tudo bem?')).toBe('olá tudo bem');
  });
  it('重音符號錯誤為 close，完全不同為 wrong', () => {
    expect(gradeTyped('bencao', ['bênção'])).toBe('close');
    expect(gradeTyped('ola', ['olá'])).toBe('close');
    expect(gradeTyped('adeus', ['olá'])).toBe('wrong');
    expect(gradeTyped('', ['olá'])).toBe('wrong');
  });
  it('多重答案與韓文', () => {
    expect(gradeTyped('au', ['aú', 'au'])).toBe('correct');
    expect(gradeTyped('아', ['아'])).toBe('correct');
    expect(gradeTyped('어', ['아'])).toBe('wrong');
  });
});

describe('generateExam', () => {
  const spec = { questionCount: 20, questionTypes: ['choice', 'listen-choice', 'compose', 'match'] as const };
  it('K-A1：題數正確、至少四種題型、每題有正解', () => {
    const qs = generateExam(ka1, 'ko', { ...spec, questionTypes: [...spec.questionTypes] });
    expect(qs).toHaveLength(20);
    expect(new Set(qs.map((q) => q.kind)).size).toBeGreaterThanOrEqual(4);
    for (const q of qs) {
      expect(q.correctText).toBeTruthy();
      if (q.kind === 'choice' || q.kind === 'listen-choice') {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(new Set(q.options.map((o) => o.text)).size).toBe(q.options.length);
      }
      if (q.kind === 'compose') expect(q.answers[0]).toMatch(/^[가-힣]$/);
      if (q.kind === 'match') expect(q.pairs.length).toBeGreaterThanOrEqual(4);
    }
    const covered = new Set(qs.flatMap((q) => q.itemIds));
    expect(covered.size).toBe(ka1.length);
  });
  it('連續兩次考試題目不完全相同', () => {
    const a = generateExam(ka1, 'ko', { ...spec, questionTypes: [...spec.questionTypes] }).map((q) => q.id + JSON.stringify((q as { options?: unknown }).options ?? ''));
    const b = generateExam(ka1, 'ko', { ...spec, questionTypes: [...spec.questionTypes] }).map((q) => q.id + JSON.stringify((q as { options?: unknown }).options ?? ''));
    expect(a.join('|')).not.toBe(b.join('|'));
  });
  it('單字：聽寫、拼寫、句子重組', () => {
    const words: WordItem[] = ['olá|你好', 'obrigado|謝謝', 'água|水', 'roda|圈', 'ginga|搖擺步'].map((s, i) => {
      const [text, meaning] = s.split('|');
      return { id: `pt.word.${i}`, type: 'word', text, meaning, examples: [{ text: `Eu gosto de ${text} sempre`, meaning: `我總是喜歡${meaning}` }] };
    });
    const qs = generateExam(words, 'pt', { questionCount: 20, questionTypes: ['choice', 'listen-choice', 'dictation', 'spell', 'match', 'reorder'] });
    const kinds = new Set(qs.map((q) => q.kind));
    for (const k of ['dictation', 'spell', 'reorder', 'match', 'choice', 'listen-choice']) expect(kinds.has(k as never)).toBe(true);
    const r = qs.find((q) => q.kind === 'reorder')!;
    if (r.kind === 'reorder') expect([...r.tokens].sort().join(' ')).toBe(r.answer.split(' ').sort().join(' '));
  });
  it('沒有可出的題時回傳空陣列而不當機', () => {
    expect(generateExam([], 'ko', { questionCount: 10, questionTypes: ['choice'] })).toEqual([]);
  });
});
