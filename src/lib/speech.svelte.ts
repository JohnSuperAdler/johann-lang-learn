// 語音播放（規格 F2）：音檔優先，Web Speech API 備援；ko-KR / pt-BR 聲音偵測。
import { settings } from './settings.svelte';
import type { Item, LangCode } from './types';

export const LOCALE: Record<LangCode, string> = { ko: 'ko-KR', pt: 'pt-BR' };

export interface VoiceInfo { name: string; voiceURI: string; lang: string; local: boolean; }

export const speechStatus = $state({
  supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
  ready: false,                                  // 聲音清單已取得
  voices: { ko: [] as VoiceInfo[], pt: [] as VoiceInfo[] },
  speaking: false,
  lastSource: 'none' as 'audio' | 'tts' | 'none',
});

let allVoices: SpeechSynthesisVoice[] = [];
let currentAudio: HTMLAudioElement | null = null;

function matchLang(v: SpeechSynthesisVoice, lang: LangCode): boolean {
  const l = v.lang.toLowerCase().replace('_', '-');
  return lang === 'ko' ? l.startsWith('ko') : l.startsWith('pt');
}

/** pt-BR 排前面，其次任何 pt；本機聲音優先。 */
function rank(v: SpeechSynthesisVoice, lang: LangCode): number {
  const l = v.lang.toLowerCase().replace('_', '-');
  let r = 0;
  if (lang === 'pt' && l === 'pt-br') r -= 10;
  if (v.localService) r -= 1;
  return r;
}

export function refreshVoices(): void {
  if (!speechStatus.supported) return;
  allVoices = speechSynthesis.getVoices();
  for (const lang of ['ko', 'pt'] as LangCode[]) {
    speechStatus.voices[lang] = allVoices
      .filter((v) => matchLang(v, lang))
      .sort((a, b) => rank(a, lang) - rank(b, lang))
      .map((v) => ({ name: v.name, voiceURI: v.voiceURI, lang: v.lang, local: v.localService }));
  }
  if (allVoices.length > 0) speechStatus.ready = true;
}

let inited = false;
export function initSpeech(): void {
  if (inited || !speechStatus.supported) return;
  inited = true;
  refreshVoices();
  speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  // 部分瀏覽器第一次 getVoices 為空，稍後再試一次。
  setTimeout(refreshVoices, 500);
  setTimeout(refreshVoices, 2000);
}

export function hasVoice(lang: LangCode): boolean {
  return speechStatus.voices[lang].length > 0;
}

function pickVoice(lang: LangCode): SpeechSynthesisVoice | null {
  const wanted = settings.voice[lang];
  if (wanted) {
    const v = allVoices.find((x) => x.voiceURI === wanted || x.name === wanted);
    if (v) return v;
  }
  const first = speechStatus.voices[lang][0];
  return first ? allVoices.find((x) => x.voiceURI === first.voiceURI) ?? null : null;
}

export function stopSpeech(): void {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if (speechStatus.supported) speechSynthesis.cancel();
  speechStatus.speaking = false;
}

export interface SpeakOptions { rate?: number; slow?: boolean; audio?: string | null; lang: LangCode; }

/** 以 TTS 唸 text。找不到對應語言的聲音時不播放，回傳 false（規格風險表：避免被英文聲音亂唸）。 */
function speakTts(text: string, lang: LangCode, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (!speechStatus.supported) return resolve(false);
    const voice = pickVoice(lang);
    if (!voice) return resolve(false);
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang || LOCALE[lang];
    u.rate = rate;
    u.onstart = () => { speechStatus.speaking = true; };
    u.onend = () => { speechStatus.speaking = false; resolve(true); };
    u.onerror = (e) => {
      speechStatus.speaking = false;
      resolve(e.error === 'interrupted' || e.error === 'canceled');
    };
    speechSynthesis.speak(u);
  });
}

function playAudio(url: string, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    stopSpeech();
    const a = new Audio(url);
    a.playbackRate = rate;
    currentAudio = a;
    a.onplay = () => { speechStatus.speaking = true; };
    a.onended = () => { speechStatus.speaking = false; resolve(true); };
    a.onerror = () => { speechStatus.speaking = false; resolve(false); };
    a.play().catch(() => { speechStatus.speaking = false; resolve(false); });
  });
}

/**
 * 播放一段文字：有音檔先播音檔，失敗或沒有則用 TTS。
 * 回傳實際來源：'audio' | 'tts' | 'none'。
 */
export async function speak(text: string, opts: SpeakOptions): Promise<'audio' | 'tts' | 'none'> {
  const rate = opts.slow ? 0.6 : (opts.rate ?? settings.rate);
  if (opts.audio) {
    const url = `${import.meta.env.BASE_URL}content/${opts.lang}/${opts.audio}`;
    if (await playAudio(url, rate)) { speechStatus.lastSource = 'audio'; return 'audio'; }
  }
  const ok = await speakTts(text, opts.lang, rate);
  speechStatus.lastSource = ok ? 'tts' : 'none';
  return ok ? 'tts' : 'none';
}

/** 學習項目要唸的字串：tts 欄位優先，否則 text / title。 */
export function itemSpeechText(item: Item): string {
  if (item.tts) return item.tts;
  return item.type === 'grammar' ? item.title : item.text;
}

export function speakItem(item: Item, lang: LangCode, slow = false) {
  return speak(itemSpeechText(item), { lang, audio: item.audio ?? null, slow });
}

export const INSTALL_HINTS: Record<string, string> = {
  windows: 'Windows：設定 → 時間與語言 → 語言與地區 → 新增語言（韓文／葡萄牙文（巴西）），勾選「文字轉語音」後安裝。',
  android: 'Android：設定 → 系統 → 語言與輸入 → 文字轉語音輸出 → Google 語音服務 → 安裝語音資料，下載韓文與葡萄牙文（巴西）。',
  ios: 'iPhone／iPad：設定 → 輔助使用 → 朗讀內容 → 聲音 → 韓文／葡萄牙文，下載一個聲音。',
  mac: 'Mac：系統設定 → 輔助使用 → 朗讀內容 → 系統聲音 → 管理聲音，下載韓文與葡萄牙文（巴西）。',
};

export function platformHint(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone|iPad|iPod/.test(ua)) return INSTALL_HINTS.ios;
  if (/Android/.test(ua)) return INSTALL_HINTS.android;
  if (/Macintosh/.test(ua)) return INSTALL_HINTS.mac;
  return INSTALL_HINTS.windows;
}
