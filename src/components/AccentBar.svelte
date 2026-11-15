<script lang="ts">
  // 葡語重音字母快速鍵列（F3.4）。
  let { onpick }: { onpick: (ch: string) => void } = $props();
  const CHARS = ['á', 'â', 'ã', 'à', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú', 'ç'];
</script>

<div class="bar" lang="pt-BR">
  {#each CHARS as ch (ch)}
    <button type="button" onclick={() => onpick(ch)}>{ch}</button>
  {/each}
</div>

<style>
  .bar { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; justify-content: center; }
  .bar button { min-width: 40px; min-height: 40px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); font-size: 1.1rem; }
  .bar button:active { background: var(--primary-soft); }
</style>
