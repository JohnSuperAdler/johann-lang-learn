<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Route } from '../lib/router.svelte';
  import { settings, updateSettings } from '../lib/settings.svelte';
  import type { LangCode } from '../lib/types';

  let { route, children }: { route: Route; children: Snippet } = $props();

  const navItems = [
    { key: 'home', label: '首頁', href: '#/', icon: '⌂' },
    { key: 'course', label: '課程', href: '#/ko', icon: '≡' },
    { key: 'settings', label: '設定', href: '#/settings', icon: '⚙' },
  ] as const;

  const activeKey = $derived(
    route.page === 'home' || route.page === 'review' ? 'home'
      : route.page === 'settings' || route.page === 'stats' ? 'settings'
      : 'course',
  );

  // 課程分頁的連結跟隨目前語言篩選；全部時預設韓語。
  const courseHref = $derived(settings.langFilter === 'pt' ? '#/pt' : '#/ko');

  function setFilter(f: LangCode | 'all') {
    updateSettings({ langFilter: f });
  }
</script>

<div class="shell">
  <header class="topbar">
    <a class="brand" href="#/">語言學習</a>
    <div class="langswitch" role="group" aria-label="語言篩選">
      <button class:active={settings.langFilter === 'ko'} onclick={() => setFilter('ko')}>韓</button>
      <button class:active={settings.langFilter === 'pt'} onclick={() => setFilter('pt')}>葡</button>
      <button class:active={settings.langFilter === 'all'} onclick={() => setFilter('all')}>全部</button>
    </div>
  </header>

  <main class="content">
    {@render children()}
  </main>

  <nav class="bottomnav" aria-label="主選單">
    {#each navItems as item}
      <a href={item.key === 'course' ? courseHref : item.href} class:active={activeKey === item.key}>
        <span class="icon" aria-hidden="true">{item.icon}</span>
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>
</div>

<style>
  .shell { min-height: 100dvh; display: flex; flex-direction: column; }
  .topbar {
    position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px; background: var(--surface); border-bottom: 1px solid var(--border);
  }
  .brand { font-weight: 700; }
  .langswitch { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
  .langswitch button { padding: 6px 12px; min-width: 44px; }
  .langswitch button.active { background: var(--primary); color: #fff; }
  .content { flex: 1; width: 100%; max-width: 760px; margin: 0 auto; padding: 16px 16px calc(var(--nav-h) + 24px); }
  .bottomnav {
    position: fixed; bottom: 0; left: 0; right: 0; height: calc(var(--nav-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom); display: flex; background: var(--surface);
    border-top: 1px solid var(--border); z-index: 10;
  }
  .bottomnav a { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 0.75rem; color: var(--muted); }
  .bottomnav a.active { color: var(--primary); font-weight: 600; }
  .bottomnav .icon { font-size: 1.25rem; line-height: 1; }
  @media (min-width: 900px) {
    .shell { flex-direction: row; }
    .topbar { position: static; flex-direction: column; align-items: flex-start; gap: 12px; width: 200px; border-bottom: 0; border-right: 1px solid var(--border); }
    .bottomnav { position: static; flex-direction: column; height: auto; width: 160px; order: -1; border-top: 0; border-right: 1px solid var(--border); padding-top: 16px; }
    .bottomnav a { flex: 0 0 auto; flex-direction: row; justify-content: flex-start; gap: 10px; padding: 10px 16px; font-size: 0.95rem; }
    .content { padding-bottom: 24px; }
  }
</style>
