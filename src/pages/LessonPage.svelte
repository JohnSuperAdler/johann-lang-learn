<script lang="ts">
  import Loading from '../components/Loading.svelte';
  import { findLesson, loadCourse, loadUnitItems } from '../lib/content';
  import type { LangCode } from '../lib/types';

  let { lang, lessonId }: { lang: LangCode; lessonId: string } = $props();

  async function load(l: LangCode, id: string) {
    const course = await loadCourse(l);
    const found = findLesson(course, id);
    if (!found) throw new Error(`找不到課程 ${id}`);
    const items = await loadUnitItems(l, found.unit);
    const lessonItems = found.lesson.itemIds
      .map((iid) => items.find((it) => it.id === iid))
      .filter((it) => it !== undefined);
    return { ...found, lessonItems };
  }
</script>

{#key `${lang}/${lessonId}`}
  {#await load(lang, lessonId)}
    <Loading />
  {:then { unit, lesson, lessonItems }}
    <p class="muted" style="margin: 0"><a href={`#/${lang}/unit/${unit.id}`}>‹ {unit.id} {unit.name}</a></p>
    <h1>{lesson.name}</h1>
    <p class="muted">本課 {lesson.itemIds.length} 項，已載入 {lessonItems.length} 項教材。課程卡片與語音在 S2 實作。</p>
    <ul class="muted">
      {#each lessonItems as item (item.id)}
        <li>{item.id}</li>
      {/each}
    </ul>
  {:catch error}
    <Loading {error} />
  {/await}
{/key}
