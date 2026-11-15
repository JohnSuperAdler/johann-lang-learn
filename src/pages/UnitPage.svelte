<script lang="ts">
  import Loading from '../components/Loading.svelte';
  import { findUnit, loadCourse } from '../lib/content';
  import { getExamsByUnit } from '../lib/db';
  import type { LangCode } from '../lib/types';

  let { lang, unitId }: { lang: LangCode; unitId: string } = $props();

  async function load(l: LangCode, id: string) {
    const course = await loadCourse(l);
    const found = findUnit(course, id);
    if (!found) throw new Error(`找不到單元 ${id}`);
    const exams = await getExamsByUnit(id);
    const best = exams.reduce<number | null>((b, e) => (b === null || e.score > b ? e.score : b), null);
    const last = exams.at(-1) ?? null;
    return { course, ...found, exams, best, last };
  }
</script>

{#key `${lang}/${unitId}`}
  {#await load(lang, unitId)}
    <Loading />
  {:then { stage, unit, best, last }}
    <p class="muted" style="margin: 0"><a href={`#/${lang}`}>‹ {stage.name}</a></p>
    <h1>{unit.id} {unit.name}</h1>
    {#if unit.description}<p class="muted">{unit.description}</p>{/if}

    <section class="stack" style="margin: 16px 0">
      {#if unit.lessons.length === 0}
        <p class="empty">本單元教材準備中。</p>
      {/if}
      {#each unit.lessons as lesson, i (lesson.id)}
        <a class="card row" href={`#/${lang}/lesson/${lesson.id}`} style="justify-content: space-between">
          <span><span class="muted">第 {i + 1} 課</span>　{lesson.name}</span>
          <span class="muted">{lesson.itemIds.length} 項 ›</span>
        </a>
      {/each}
    </section>

    <section class="card stack">
      <div class="row" style="justify-content: space-between">
        <strong>單元考試</strong>
        <span class="muted">{best === null ? '尚未考過' : `最高 ${best} 分・最近 ${last?.score} 分`}</span>
      </div>
      <p class="muted" style="margin: 0">需先學完本單元全部課程（S4 實作考試）。</p>
      <div class="row">
        <a class="btn primary" href={`#/${lang}/exam/${unit.id}`} style="flex: 1">開始考試</a>
        <a class="btn" href={`#/review/lesson/${unit.id}`} style="flex: 1">練習模式</a>
      </div>
    </section>
  {:catch error}
    <Loading {error} />
  {/await}
{/key}
