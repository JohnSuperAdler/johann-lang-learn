<script lang="ts">
  // 螢幕韓文鍵盤（兩列式配置）。shift 切換雙子音與 ㅒ ㅖ。
  import { backspace, typeJamo } from '../lib/hangul';

  let { value, onchange }: { value: string; onchange: (v: string) => void } = $props();
  let shift = $state(false);

  const ROWS = [
    ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
    ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
    ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ'],
  ];
  const SHIFT: Record<string, string> = { 'ㅂ': 'ㅃ', 'ㅈ': 'ㅉ', 'ㄷ': 'ㄸ', 'ㄱ': 'ㄲ', 'ㅅ': 'ㅆ', 'ㅐ': 'ㅒ', 'ㅔ': 'ㅖ' };

  function press(k: string) {
    onchange(typeJamo(value, shift ? SHIFT[k] ?? k : k));
    shift = false;
  }
</script>

<div class="kb" lang="ko">
  {#each ROWS as row, r (r)}
    <div class="krow">
      {#if r === 2}<button type="button" class="wide" class:on={shift} onclick={() => (shift = !shift)} aria-label="Shift">⇧</button>{/if}
      {#each row as k (k)}
        <button type="button" onclick={() => press(k)}>{shift ? SHIFT[k] ?? k : k}</button>
      {/each}
      {#if r === 2}<button type="button" class="wide" onclick={() => onchange(backspace(value))} aria-label="倒退">⌫</button>{/if}
    </div>
  {/each}
  <div class="krow">
    <button type="button" class="space" onclick={() => onchange(value + ' ')}>空白</button>
  </div>
</div>

<style>
  .kb { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; user-select: none; }
  .krow { display: flex; gap: 4px; justify-content: center; }
  .krow button { flex: 1; max-width: 48px; min-height: 44px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); font-size: 1.15rem; padding: 0; }
  .krow button.wide { max-width: 64px; flex: 1.5; }
  .krow button.on { background: var(--primary); color: #fff; }
  .krow button.space { max-width: 240px; font-size: 0.9rem; }
  .krow button:active { background: var(--primary-soft); }
</style>
