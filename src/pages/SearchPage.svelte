<script lang="ts">
  let { q }: { q: string } = $props();
  let text = $state('');
  $effect(() => { text = q; });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    location.hash = `#/search?q=${encodeURIComponent(text.trim())}`;
  }
</script>

<h1>搜尋</h1>
<form class="row" onsubmit={submit}>
  <input type="search" bind:value={text} placeholder="原文、拼音或中文" style="flex: 1; padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: inherit; font: inherit" />
  <button class="btn primary" type="submit">搜尋</button>
</form>
{#if q}
  <p class="empty">「{q}」的搜尋結果（選用功能 F1.7，尚未實作）。</p>
{/if}
