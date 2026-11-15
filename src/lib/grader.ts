// 寬鬆比對（規格 F3.3）：忽略大小寫、首尾與多餘空白、句末標點；重音符號差異視為「接近」給半分。
export type Verdict = 'correct' | 'close' | 'wrong';

export function normalizeAnswer(s: string): string {
  return s.normalize('NFC').toLowerCase()
    .replace(/[.,!?¡¿;:。，！？]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 去掉重音符號（ã → a、ç → c）；韓文不受影響。 */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

export function gradeTyped(input: string, answers: string[]): Verdict {
  const a = normalizeAnswer(input);
  if (!a) return 'wrong';
  const norm = answers.map(normalizeAnswer);
  if (norm.includes(a)) return 'correct';
  const bare = stripAccents(a);
  if (norm.some((x) => stripAccents(x) === bare)) return 'close';
  return 'wrong';
}

export const scoreOf = (v: Verdict): number => (v === 'correct' ? 1 : v === 'close' ? 0.5 : 0);
export const VERDICT_LABEL: Record<Verdict, string> = { correct: '正確', close: '接近（重音符號有誤，給半分）', wrong: '錯誤' };
