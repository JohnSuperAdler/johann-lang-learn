// 韓文字母（jamo）與音節的組合／拆解，供螢幕鍵盤與 compose 題使用。
export const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
export const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const VCOMB: Record<string, string> = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' };
const CCOMB: Record<string, string> = { 'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ' };
const VSPLIT = Object.fromEntries(Object.entries(VCOMB).map(([k, v]) => [v, [...k]]));
const CSPLIT = Object.fromEntries(Object.entries(CCOMB).map(([k, v]) => [v, [...k]]));

const isCho = (c: string) => CHO.includes(c);
const isVowel = (c: string) => JUNG.includes(c);

/** 把字串拆成單一 jamo（複合母音與複合終聲也拆開）；非韓文字元原樣保留。 */
export function decompose(str: string): string[] {
  const out: string[] = [];
  for (const ch of str) {
    const code = ch.codePointAt(0)! - 0xac00;
    if (code >= 0 && code <= 11171) {
      const cho = CHO[Math.floor(code / 588)];
      const jung = JUNG[Math.floor((code % 588) / 28)];
      const jong = JONG[code % 28];
      out.push(cho, ...(VSPLIT[jung] ?? [jung]));
      if (jong) out.push(...(CSPLIT[jong] ?? [jong]));
    } else if (VSPLIT[ch]) out.push(...VSPLIT[ch]);
    else if (CSPLIT[ch]) out.push(...CSPLIT[ch]);
    else out.push(ch);
  }
  return out;
}

/** 把 jamo 序列組成音節（兩列式輸入法的規則）。 */
export function compose(jamos: string[]): string {
  let out = '';
  let i = 0;
  const n = jamos.length;
  const nextIsVowel = (k: number) => k < n && isVowel(jamos[k]);
  while (i < n) {
    const c = jamos[i];
    if (isCho(c) && nextIsVowel(i + 1)) {
      const cho = c;
      let jung = jamos[i + 1];
      i += 2;
      if (i < n && VCOMB[jung + jamos[i]]) { jung = VCOMB[jung + jamos[i]]; i += 1; }
      let jong = '';
      if (i < n && JONG.includes(jamos[i]) && jamos[i] !== '' && !nextIsVowel(i + 1)) {
        jong = jamos[i]; i += 1;
        if (i < n && CCOMB[jong + jamos[i]] && !nextIsVowel(i + 1)) { jong = CCOMB[jong + jamos[i]]; i += 1; }
      }
      out += String.fromCodePoint(0xac00 + CHO.indexOf(cho) * 588 + JUNG.indexOf(jung) * 28 + JONG.indexOf(jong));
    } else if (isVowel(c) && i + 1 < n && VCOMB[c + jamos[i + 1]]) {
      out += VCOMB[c + jamos[i + 1]]; i += 2;
    } else { out += c; i += 1; }
  }
  return out;
}

/** 在現有文字後輸入一個 jamo。 */
export const typeJamo = (value: string, jamo: string): string => compose([...decompose(value), jamo]);

/** 倒退鍵：刪掉最後一個 jamo。 */
export function backspace(value: string): string {
  const d = decompose(value);
  d.pop();
  return compose(d);
}
