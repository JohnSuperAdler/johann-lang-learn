<script lang="ts">
  import DrillPractice from '../components/DrillPractice.svelte';
  import ItemCard from '../components/ItemCard.svelte';
  import SyllableComposer from '../components/SyllableComposer.svelte';
  import Loading from '../components/Loading.svelte';
  import { findLesson, loadCourse, loadUnitItems } from '../lib/content';
  import { settings } from '../lib/settings.svelte';
  import { hasVoice, speakItem, stopSpeech } from '../lib/speech.svelte';
  import type { Item, LangCode } from '../lib/types';

  let { lang, lessonId }: { lang: LangCode; lessonId: string } = $props();

  let index = $state(0);
  let items = $state<Item[]>([]);

  async function load(l: LangCode, id: string) {
    const course = await loadCourse(l);
    const found = findLesson(course, id);
    if (!found) throw new Error(`找不到課程 ${id}`);
    const all = await loadUnitItems(l, found.unit);
    items = found.lesson.itemIds
      .map((iid) => all.find((it) => it.id === iid))
      .filter((it): it is Item => it !== undefined);
    index = 0;
    return found;
  }

  const current = $derived(items[index]);
  const isLast = $derived(items.length > 0 && index === items.length - 1);

  // 卡片切換時自動發音（F2.5）。
  $effect(() => {
    const it = current;
    if (it && settings.autoplay) void speakItem(it, lang);
  });

  function go(delta: number) {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    stopSpeech();
    index = next;
  }

  function onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'r' || e.key === 'R' || e.key === ' ') { e.preventDefault(); if (current) void speakItem(current, lang); }
  }

  let touchX = 0;
  function onTouchStart(e: TouchEvent) { touchX = e.changedTouches[0].clientX; }
  function onTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  }

  $effect(() => () => stopSpeech());
</script>

<svelte:window onkeydown={onKey} />

{#key `${lang}/${lessonId}`}
  {#await load(lang, lessonId)}
    <Loading />
  {:then { unit, lesson }}
    <p class="muted" style="margin: 0"><a href={`#/${lang}/unit/${unit.id}`}>‹ {unit.id} {unit.name}</a></p>
    <h1>{lesson.name}</h1>

    {#if items.length === 0}
      <p class="empty">本課教材尚未撰寫。</p>
    {:else}
      {#if !hasVoice(lang)}
        <p class="warn">此裝置沒有{lang === 'ko' ? '韓語' : '葡萄牙語'}語音，無法發音。<a href="#/settings">到設定查看安裝方式 ›</a></p>
      {/if}
      <div class="progress" style="margin-bottom: 12px"><span style={`width:${((index + 1) / items.length) * 100}%`}></span></div>
      <div class="muted" style="text-align: center; margin-bottom: 8px">{index + 1} / {items.length}</div>

      <div role="group" aria-label="學習卡片，左右滑動切換" ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
        {#key current?.id}
          <ItemCard item={current} {lang} />
        {/key}
      </div>

      {#if current?.type === 'grammar'}
        {#key current.id}<DrillPractice item={current} {lang} />{/key}
      {/if}
      {#if lang === 'ko' && current?.type === 'letter'}
        <details class="card" style="margin-top: 12px">
          <summary>音節拼合練習：子音＋母音</summary>
          <SyllableComposer />
        </details>
      {/if}

      <div class="row" style="margin-top: 16px">
        <button class="btn" style="flex: 1" onclick={() => go(-1)} disabled={index === 0}>‹ 上一項</button>
        {#if isLast}
          <a class="btn primary" style="flex: 2" href={`#/review/lesson/${lesson.id}`}>完成，進入課後複習 ›</a>
        {:else}
          <button class="btn primary" style="flex: 2" onclick={() => go(1)}>下一項 ›</button>
        {/if}
      </div>
      <p class="muted" style="text-align: center; font-size: 0.85rem">鍵盤：← → 切換，空白鍵或 R 重播；手機左右滑動切換</p>
    {/if}
  {:catch error}
    <Loading {error} />
  {/await}
{/key}

<style>
  .warn { background: color-mix(in srgb, var(--danger) 10%, transparent); border: 1px solid var(--danger); border-radius: 10px; padding: 10px 12px; }
</style>
