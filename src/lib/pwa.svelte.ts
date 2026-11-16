// PWA 狀態：是否可安裝、離線快取是否就緒。Service worker 的註冊在 main.ts（測試環境不載入）。
interface InstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>; }

export const pwa = $state({
  supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  secure: typeof window !== 'undefined' && window.isSecureContext,
  offlineReady: false,
  installable: false,
  installed: typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches,
});

let deferred: InstallPromptEvent | null = null;

export function initPwa(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    pwa.installable = true;
  });
  window.addEventListener('appinstalled', () => { pwa.installed = true; pwa.installable = false; deferred = null; });
  // 之前已經快取過：有 service worker 在控制頁面就代表離線可用。
  if (pwa.supported && navigator.serviceWorker.controller) pwa.offlineReady = true;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  pwa.installable = false;
  return outcome === 'accepted';
}
