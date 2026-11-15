<script lang="ts">
  let { lessonId }: { lessonId?: string } = $props();
</script>

<h1>{lessonId ? '課後複習' : '每日複習'}</h1>
{#if lessonId}<p class="muted">範圍：{lessonId}</p>{/if}
<p class="empty">複習閱卡在 S3 實作。</p>
<a class="btn" href="#/">回首頁</a>
