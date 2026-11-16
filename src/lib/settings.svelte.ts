// 使用者設定：localStorage 持久化，Svelte 5 rune 狀態。
import type { Settings } from './types';

const KEY = 'lang-learning.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  voice: {},
  rate: 0.9,
  autoplay: true,
  dailyLimit: 60,
  passRate: 0.8,
  reminderTime: null,
  langFilter: 'all',
  dayCutoffHour: 4,
  enforceLocks: false,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const settings = $state<Settings>(typeof localStorage !== 'undefined' ? load() : { ...DEFAULT_SETTINGS });

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('設定無法儲存', err);
  }
}

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  saveSettings();
}

export function resetSettings(): void {
  Object.assign(settings, DEFAULT_SETTINGS);
  saveSettings();
}

/** 以 dayCutoffHour 為換日點的「今天」（YYYY-MM-DD，本地時間）。 */
export function todayKey(now: Date = new Date()): string {
  const d = new Date(now.getTime() - settings.dayCutoffHour * 3600_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
