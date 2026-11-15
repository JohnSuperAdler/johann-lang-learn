<script lang="ts">
  import Loading from '../components/Loading.svelte';
  import { findUnit, loadCourse } from '../lib/content';
  import { getExamsByUnit } from '../lib/db';
  import { examUnlock, learnedItemIds } from '../lib/exam';
  import type { LangCode } from '../lib/types';

  let { lang, unitId }: { lang: LangCode; unitId: string } = $props();

  async function load(l: LangCode, id: string) {
    const course = await loadCourse(l);
    const found = findUnit(course, id);
    if (!found) throw new Error(`找不到單元 ${id}`);
    const [exams, learned] = await Promise.all([getExamsByUnit(id), learnedItemIds()]);
    exams.sort((a, b) => a.id.localeCompare(b.id));
    const best = exams.reduce<number | null>((b, e) => (b === null || e.score > b ? e.score : b), null);
    const last = exams.at(-1) ?? null;
    const passed = exams.some((e) => e.passed);
    return { ...found, best, last, passed, learned, unlock: examUnlock(found.unit, learned), attempts: exams.length };
  }
</script>

{#key `${lang}/${unitId}`}
  {#await load(lang, unitId)}
    <Loading />
  {:then { stage, unit, best, last, passed, learned, unlock, attempts }}
    <p class="muted" style="margin: 0"><a href={`#/${lang}`}>‹ {stage.name}</a></p>
    <h1>{unit.id} {unit.name}</h1>
    {#if unit.description}<p class="muted">{unit.description}</p>{/if}

    <section class="stack" style="margin: 16px 0">
      {#if unit.lessons.length === 0}
        <p class="empty">本單元教材準備中。</p>
      {/if}
      {#each unit.lessons as lesson, i (lesson.id)}
        {@const done = lesson.itemIds.length > 0 && lesson.itemIds.every((id) => learned.has(id))}
        <a class="card row" href={`#/${lang}/lesson/${lesson.id}`} style="justify-content: space-between">
          <span><span class="muted">第 {i + 1} 課</span>　{lesson.name}</span>
          <span class="muted">{done ? '✓ 已學・' : ''}{lesson.itemIds.length} 項 ›</span>
        </a>
      {/each}
    </section>

    {#if unit.lessons.length > 0}
      <section class="card stack">
        <div class="row" style="justify-content: space-between">
          <strong>單元考試{passed ? '　✓ 已通過' : ''}</strong>
          <span class="muted">{best === null ? '尚未考過' : `最高 ${best} 分・最近 ${last?.score} 分・共 ${attempts} 次`}</span>
        </div>
        {#if !unlock.unlocked}
          <p class="muted" style="margin: 0">還有 {unlock.lessonsTotal - unlock.lessonsDone} 課未完成，學完並做過課後複習後解鎖考試。</p>
        {/if}
        <div class="row">
          {#if unlock.unlocked}
            <a class="btn primary" href={`#/${lang}/exam/${unit.id}`} style="flex: 1">{attempts ? '再考一次' : '開始考試'}</a>
          {:else}
            <button class="btn" style="flex: 1" disabled>考試未解鎖</button>
          {/if}
          <a class="btn" href={`#/review/lesson/${unit.id}`} style="flex: 1">練習模式</a>
        </div>
      </section>
    {/if}
  {:catch error}
    <Loading {error} />
  {/await}
{/key}
