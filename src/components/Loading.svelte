<script lang="ts">
  let { error = null }: { error?: unknown } = $props();
</script>

{#if error}
  <div class="card" style="border-color: var(--danger)">
    <strong>載入失敗</strong>
    <p class="muted">{error instanceof Error ? error.message : String(error)}</p>
  </div>
{:else}
  <p class="empty">載入中…</p>
{/if}
