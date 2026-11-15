<script lang="ts">
  import { speak, speechStatus } from '../lib/speech.svelte';
  import type { LangCode } from '../lib/types';

  let {
    text, lang, audio = null, slow = false, label = '播放', size = 'md',
  }: { text: string; lang: LangCode; audio?: string | null; slow?: boolean; label?: string; size?: 'sm' | 'md' | 'lg' } = $props();

  let failed = $state(false);

  async function play(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    failed = false;
    const src = await speak(text, { lang, audio, slow });
    failed = src === 'none';
  }
</script>

<button class="speak {size}" class:failed onclick={play} aria-label={label} title={failed ? '此裝置沒有對應語音' : label}>
  <span aria-hidden="true">{slow ? '🐢' : speechStatus.speaking ? '🔊' : '🔈'}</span>
  {#if size !== 'sm'}<span>{label}</span>{/if}
</button>

<style>
  .speak { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: var(--surface); border-radius: 999px; padding: 6px 12px; min-height: 36px; }
  .speak.lg { font-size: 1.1rem; padding: 10px 18px; min-height: 48px; }
  .speak.sm { padding: 4px 8px; min-height: 32px; min-width: 32px; }
  .speak.failed { border-color: var(--danger); color: var(--danger); }
</style>
