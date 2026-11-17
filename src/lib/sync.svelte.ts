// 跨裝置同步（規格書 F7、6.1）：本機 IndexedDB 是主要資料來源，這裡只把變更鏡像到 Firestore、
// 再把遠端變更合併回本機。未登入、離線或 Firebase 出錯時，網頁照常運作。
// Firebase SDK 以動態 import 載入：沒用同步功能的人不會下載它。
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';
import { clearDirty, getAllCards, getAllDays, getAllExams, getMeta, onLocalChange, putSynced, setMeta } from './db';
import { firebaseConfig } from './firebase-config';
import { applyRemoteSettings, settings, settingsUpdatedAt } from './settings.svelte';
import { chunk, fromRemote, planCards, planDays, planExams, toRemote } from './syncMerge';
import type { CardRecord, DayStat, ExamRecord, Settings } from './types';

export type SyncStatus = 'off' | 'connecting' | 'idle' | 'syncing' | 'offline' | 'error';

export const sync = $state({
  status: 'off' as SyncStatus,
  user: null as { uid: string; name: string; email: string } | null,
  lastSync: null as string | null, // ISO
  pending: 0,                      // 待上傳筆數
  error: '',
});

const ENABLED_KEY = 'lang-learning.sync.enabled';
const BATCH = 400;
const DEBOUNCE_MS = 15_000;
/** 拉取時往回多抓一分鐘，避免時間邊界漏資料（重複抓到的會被判定相同而略過）。 */
const PULL_OVERLAP_MS = 60_000;

const enabled = () => { try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; } };
const setEnabled = (on: boolean) => { try { localStorage.setItem(ENABLED_KEY, on ? '1' : '0'); } catch { /* ignore */ } };

// ---------- Firebase 載入 ----------
type FB = {
  auth: typeof import('firebase/auth'); fs: typeof import('firebase/firestore/lite');
  a: Auth; db: Firestore;
};
let fbPromise: Promise<FB> | null = null;
function loadFirebase(): Promise<FB> {
  fbPromise ??= (async () => {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import('firebase/app'), import('firebase/auth'), import('firebase/firestore/lite'),
    ]);
    const app = initializeApp(firebaseConfig);
    const fb: FB = { auth, fs, a: auth.getAuth(app), db: fs.getFirestore(app) };
    fb.auth.onAuthStateChanged(fb.a, (u) => onUser(u));
    return fb;
  })();
  fbPromise.catch(() => { fbPromise = null; });
  return fbPromise;
}

/** 設定頁開啟時先載入，讓登入按鈕按下後能立刻跳出 Google 視窗（避免被當成非使用者觸發而擋掉）。 */
export function preloadFirebase(): void {
  if (import.meta.env.MODE === 'test' || typeof navigator === 'undefined' || !navigator.onLine) return;
  loadFirebase().catch(() => { /* 離線或被擋，按登入時再試 */ });
}

function onUser(u: User | null): void {
  if (u) {
    sync.user = { uid: u.uid, name: u.displayName ?? '', email: u.email ?? '' };
    sync.status = 'idle';
    sync.error = '';
    void getMeta<string>(`sync.lastSync.${u.uid}`).then((t) => { if (t) sync.lastSync = t; });
    void syncNow();
  } else {
    sync.user = null;
    sync.status = 'off';
  }
}

// ---------- 啟動與觸發 ----------
let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;

/** App 啟動時呼叫。只有曾經登入過的裝置才會載入 Firebase。 */
export function initSync(): void {
  if (started) return;
  started = true;
  onLocalChange(() => {
    void refreshPending();
    if (!sync.user) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void syncNow(); }, DEBOUNCE_MS);
  });
  window.addEventListener('online', () => { if (sync.user) void syncNow(); });
  window.addEventListener('offline', () => { if (sync.user) sync.status = 'offline'; });
  document.addEventListener('visibilitychange', () => {
    if (!sync.user) return;
    // 離開頁面時把還沒上傳的先送出；回到頁面時拉取其他裝置的更新。
    if (document.visibilityState === 'hidden' && sync.pending > 0) void syncNow();
    if (document.visibilityState === 'visible') void syncNow();
  });
  void refreshPending();
  if (enabled()) {
    sync.status = 'connecting';
    loadFirebase().catch((err) => fail(err));
  }
}

export async function signIn(): Promise<void> {
  sync.error = '';
  try {
    const fb = await loadFirebase();
    setEnabled(true);
    await fb.auth.signInWithPopup(fb.a, new fb.auth.GoogleAuthProvider());
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') { if (!sync.user) setEnabled(false); return; }
    if (!sync.user) setEnabled(false);
    fail(err);
  }
}

export async function signOut(): Promise<void> {
  const fb = await loadFirebase();
  await fb.auth.signOut(fb.a);
  setEnabled(false);
  sync.user = null;
  sync.status = 'off';
  sync.lastSync = null;
}

function fail(err: unknown): void {
  const code = (err as { code?: string }).code ?? '';
  const msg = err instanceof Error ? err.message : String(err);
  if (typeof navigator !== 'undefined' && !navigator.onLine) { sync.status = 'offline'; return; }
  sync.status = 'error';
  sync.error =
    code === 'permission-denied' ? '雲端拒絕存取：請確認 Firestore 安全規則已發布。'
    : code === 'auth/unauthorized-domain' ? '這個網址沒有加入 Firebase 的授權網域。'
    : code === 'auth/popup-blocked' ? '登入視窗被瀏覽器擋住了，請允許彈出視窗後再試一次。'
    : code === 'unavailable' || code === 'auth/network-request-failed' ? '連不上雲端，稍後會自動再試。'
    : `同步失敗：${msg}`;
  console.warn('sync', err);
}

export async function refreshPending(): Promise<void> {
  try {
    const [c, e, d] = await Promise.all([getAllCards(), getAllExams(), getAllDays()]);
    sync.pending = c.filter((x) => x.dirty).length + e.filter((x) => x.dirty).length + d.filter((x) => x.dirty).length;
  } catch { /* 資料庫尚未就緒 */ }
}

// ---------- 同步本體 ----------
let running: Promise<void> | null = null;
let again = false;

/** 立即同步；同步中再呼叫會在這一輪結束後再跑一次。 */
export function syncNow(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      do { again = false; await runOnce(); } while (again);
    } finally { running = null; }
  })();
  return running;
}

async function runOnce(): Promise<void> {
  const user = sync.user;
  if (!user) return;
  if (!navigator.onLine) { sync.status = 'offline'; return; }
  sync.status = 'syncing';
  try {
    const fb = await loadFirebase();
    const { fs, db } = fb;
    const base = ['users', user.uid] as const;
    const pullKey = `sync.lastPull.${user.uid}`;
    const lastPull = (await getMeta<number>(pullKey)) ?? 0;
    const first = lastPull === 0;
    // 先取得「伺服器時間」當作這一輪的起點：下次只拉取這個時間之後的變更（不用裝置時鐘，避免各裝置時間不準）。
    const clock = fs.doc(db, ...base, 'meta', 'clock');
    await fs.setDoc(clock, { at: fs.serverTimestamp() });
    const startedAt = ((await fs.getDoc(clock)).data()?.at as { toMillis(): number } | undefined)?.toMillis() ?? 0;

    async function pull<T>(name: 'cards' | 'exams' | 'days'): Promise<T[]> {
      const col = fs.collection(db, ...base, name);
      const q = first ? col : fs.query(col, fs.where('syncedAt', '>', fs.Timestamp.fromMillis(lastPull - PULL_OVERLAP_MS)));
      const snap = await fs.getDocs(q);
      return snap.docs.map((d) => fromRemote<T>(d.data()));
    }

    // 1. 拉取並合併
    const [rCards, rExams, rDays] = await Promise.all([pull<CardRecord>('cards'), pull<ExamRecord>('exams'), pull<DayStat>('days')]);
    const [lCards, lExams, lDays] = await Promise.all([getAllCards(), getAllExams(), getAllDays()]);
    const cardMap = new Map(lCards.map((c) => [c.cardId, c]));
    const examMap = new Map(lExams.map((e) => [e.id, e]));
    const dayMap = new Map(lDays.map((d) => [d.date, d]));
    const pc = planCards(cardMap, rCards), pe = planExams(examMap, rExams), pd = planDays(dayMap, rDays);
    await Promise.all([putSynced('cards', pc.toLocal), putSynced('exams', pe.toLocal), putSynced('days', pd.toLocal)]);

    // 2. 決定要上傳的：本機 dirty ＋ 合併時判定本機較新 ＋ 第一次同步時雲端沒有的
    const [cards, exams, days] = await Promise.all([getAllCards(), getAllExams(), getAllDays()]);
    const remoteCardIds = new Set(rCards.map((c) => c.cardId));
    const remoteExamIds = new Set(rExams.map((e) => e.id));
    const remoteDays = new Set(rDays.map((d) => d.date));
    const pushCardIds = new Set(pc.toPush);
    const pushDays = new Set(pd.toPush);
    const upCards = cards.filter((c) => c.dirty || pushCardIds.has(c.cardId) || (first && !remoteCardIds.has(c.cardId)));
    const upExams = exams.filter((e) => e.dirty || (first && !remoteExamIds.has(e.id)));
    const upDays = days.filter((d) => d.dirty || pushDays.has(d.date) || (first && !remoteDays.has(d.date)));

    // 3. 上傳（每批最多 400 筆）
    const writes: { path: string[]; data: Record<string, unknown> }[] = [
      ...upCards.map((c) => ({ path: ['cards', c.cardId], data: toRemote(c) })),
      ...upExams.map((e) => ({ path: ['exams', e.id], data: toRemote(e) })),
      ...upDays.map((d) => ({ path: ['days', d.date], data: toRemote(d) })),
    ];
    for (const part of chunk(writes, BATCH)) {
      const batch = fs.writeBatch(db);
      for (const w of part) batch.set(fs.doc(db, ...base, ...w.path), { ...w.data, syncedAt: fs.serverTimestamp() });
      await batch.commit();
    }
    await Promise.all([
      clearDirty('cards', upCards, (c) => c.cardId),
      clearDirty('exams', upExams, (e) => e.id),
      clearDirty('days', upDays, (d) => d.date),
    ]);

    // 4. 設定：較新的一方勝；聲音是各裝置自己的，不同步
    const sref = fs.doc(db, ...base, 'settings', 'main');
    const snap = await fs.getDoc(sref);
    const remote = snap.exists() ? (snap.data() as { settings: Partial<Settings>; updatedAt: string }) : null;
    const localAt = settingsUpdatedAt();
    if (remote && remote.updatedAt > localAt) {
      const { voice: _v, ...rest } = remote.settings;
      applyRemoteSettings(rest, remote.updatedAt);
    } else if (localAt && (!remote || localAt > remote.updatedAt)) {
      const { voice: _v, ...rest } = JSON.parse(JSON.stringify(settings)) as Settings;
      await fs.setDoc(sref, { settings: rest, updatedAt: localAt });
    }

    const now = new Date().toISOString();
    if (startedAt > 0) await setMeta(pullKey, startedAt);
    await setMeta(`sync.lastSync.${user.uid}`, now);
    sync.lastSync = now;
    sync.status = 'idle';
    sync.error = '';
    await refreshPending();
  } catch (err) {
    fail(err);
  }
}

/** 刪除雲端上這個帳號的全部學習紀錄（設定頁「重置學習進度」在登入時使用）。 */
export async function deleteRemoteData(): Promise<void> {
  const user = sync.user;
  if (!user) return;
  const { fs, db } = await loadFirebase();
  for (const name of ['cards', 'exams', 'days', 'settings', 'meta']) {
    const snap = await fs.getDocs(fs.collection(db, 'users', user.uid, name));
    for (const part of chunk(snap.docs, BATCH)) {
      const batch = fs.writeBatch(db);
      for (const d of part) batch.delete(d.ref);
      await batch.commit();
    }
  }
}
