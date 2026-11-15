<script lang="ts">
  import type { LangCode } from '../lib/types';
  let { lang, unitId }: { lang: LangCode; unitId: string } = $props();
</script>

<p class="muted" style="margin: 0"><a href={`#/${lang}/unit/${unitId}`}>‹ 返回單元</a></p>
<h1>單元考試：{unitId}</h1>
<p class="empty">考試在 S4 實作。</p>
