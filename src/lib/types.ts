// 內容資料模型（規格書第 5 節）與學習紀錄型別。

export type LangCode = 'ko' | 'pt';
export type StageKind = 'alphabet' | 'vocab' | 'grammar';
export type ItemType = 'letter' | 'word' | 'grammar';
export type QuestionType =
  | 'choice' | 'listen-choice' | 'dictation' | 'spell' | 'match' | 'fill' | 'reorder' | 'compose';

export interface LangIndexEntry { lang: LangCode; name: string; ttsLocale: string; course: string; }
export interface ContentIndex { version: number; languages: LangIndexEntry[]; }

export interface ExamSpec { questionCount: number; passRate: number; questionTypes: QuestionType[]; }
export interface Lesson { id: string; name: string; itemIds: string[]; }
export interface Unit {
  id: string; name: string; description?: string; optional?: boolean;
  requires: string[]; lessons: Lesson[]; exam: ExamSpec; itemsFile?: string;
}
export interface Stage { id: string; name: string; kind: StageKind; units: Unit[]; }
export interface Course { lang: LangCode; name: string; ttsLocale: string; stages: Stage[]; }

export interface Example { text: string; meaning: string; audio?: string | null; }
interface ItemBase { id: string; type: ItemType; audio?: string | null; tags?: string[]; }
export interface LetterItem extends ItemBase {
  type: 'letter'; text: string; roman: string; name: string; note?: string; examples?: Example[];
}
export interface WordItem extends ItemBase {
  type: 'word'; text: string; roman?: string; ipa?: string; pos?: string; meaning: string;
  accepted?: string[]; examples?: Example[]; image?: string | null;
}
export interface Drill { type: QuestionType; text: string; answer: string; options?: string[]; }
export interface GrammarItem extends ItemBase {
  type: 'grammar'; title: string; explanation: string; pattern?: string;
  examples: Example[]; pitfalls?: string[]; drills?: Drill[];
}
export type Item = LetterItem | WordItem | GrammarItem;

// 學習紀錄（IndexedDB）
export type CardDirection = 'recognize' | 'produce' | 'listen';
export type CardState = 'new' | 'learning' | 'review' | 'relearning';
export interface CardRecord {
  cardId: string;              // `${itemId}#${direction}`
  itemId: string;
  lang: LangCode;
  direction: CardDirection;
  state: CardState;
  interval: number;            // 天
  ease: number;
  due: string;                 // YYYY-MM-DD
  reps: number;
  lapses: number;
  lastReviewed: string | null; // ISO 時間
  dirty?: boolean;             // 待同步（S11 使用）
}
export interface ExamRecord {
  id: string; unitId: string; lang: LangCode; date: string; score: number; total: number;
  passed: boolean; wrongItemIds: string[]; durationSec: number;
}
export interface DayStat { date: string; reviewed: number; correct: number; newLearned: number; }

export interface Settings {
  voice: Partial<Record<LangCode, string>>;
  rate: number;
  autoplay: boolean;
  dailyLimit: number;
  passRate: number;
  reminderTime: string | null;
  langFilter: LangCode | 'all';
  dayCutoffHour: number;
}
