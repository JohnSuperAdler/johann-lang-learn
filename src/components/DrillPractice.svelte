<script lang="ts">
  // 文法課的即時練習（F1.5）：出該文法點的 3–5 題，不計分、不寫入紀錄。父層以 {#key item.id} 重建。
  import ExamQuestion from './ExamQuestion.svelte';
  import { drillQuestions, type Question } from '../lib/quiz';
  import type { Item, LangCode } from '../lib/types';

  let { item, lang }: { item: Item; lang: LangCode } = $props();

  // svelte-ignore state_referenced_locally
  let qs = $state<Question[]>(drillQuestions(item, lang));
  let idx = $state(0);
  let right = $state(0);
  let round = $state(0);

  function again() {
    qs = drillQuestions(item, lang);
    idx = 0; right = 0; round += 1;
  }
</script>

{#if qs.length > 0}
  <section class="card drill">
    <div class="row" style="justify-content: space-between; margin-bottom: 8px">
      <strong>即時練習</strong>
      <span class="muted">{Math.min(idx + 1, qs.length)} / {qs.length}</span>
    </div>
    {#if idx < qs.length}
      {#key `${round}/${idx}`}
        <ExamQuestion q={qs[idx]} isLast={idx === qs.length - 1} autofocus={false}
          nextLabel={idx === qs.length - 1 ? '完成練習' : '下一題'}
          onAnswer={(r) => { if (r.score === 1) right += 1; }} onNext={() => (idx += 1)} />
      {/key}
    {:else}
      <p style="text-align: center; margin: 8px 0">練習完成，答對 {right} / {qs.length} 題。</p>
      <button class="btn big" onclick={again}>再練一次</button>
    {/if}
  </section>
{/if}

<style>
  .drill { margin-top: 12px; }
</style>
