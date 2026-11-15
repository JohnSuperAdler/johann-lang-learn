<script lang="ts">
  // 閱卡流程（F4.2–F4.4、F5.2）：課後複習、每日複習、練習模式共用。
  import SpeakButton from './SpeakButton.svelte';
  import { putCard } from '../lib/db';
  import { applySchedule, GRADE_LABEL, previewInterval, type Grade } from '../lib/scheduler';
  import { settings, todayKey } from '../lib/settings.svelte';
  import { itemSpeechText, speakItem, stopSpeech } from '../lib/speech.svelte';
  import { bumpDay } from '../lib/stats';
  import type { CardRecord, Item, SessionResult } from '../lib/types';

  let {
    cards, items, persist = true, title, onFinish,
  }: {
    cards: CardRecord[]; items: Map<string, Item>; persist?: boolean; title: string;
    onFinish: (r: SessionResult) => void;
  } = $props();

  const today = todayKey();

  // 佇列：忘記的卡推到最後，直到每張都至少「記得」一次。
  // cards 只在掛載時讀一次（父層以 {#key} 重建元件），故忽略 state_referenced_locally。
  // svelte-ignore state_referenced_locally
  let queue = $state<CardRecord[]>(cards.filter((c) => items.has(c.itemId)));
  let flipped = $state(false);
  let graded = $state(0);
  let correct = $state(0);
  let forgotten = $state(0);
  let busy = $state(false);
  // svelte-ignore state_referenced_locally
  const initialNew = new Set(cards.filter((c) => c.state === 'new').map((c) => c.cardId));
  // svelte-ignore state_referenced_locally
  const total = cards.length;

  const current = $derived(queue[0]);
  const item = $derived(current ? items.get(current.itemId) : undefined);
  const lang = $derived(current?.lang ?? 'ko');
  const doneCount = $derived(total - queue.length);

  // 正面提示內容
  const front = $derived.by(() => {
    if (!item || !current) return { kind: 'text', text: '' } as const;
    if (current.direction === 'listen') return { kind: 'listen', text: itemSpeechText(item) } as const;
    if (current.direction === 'produce') {
      return { kind: 'text', text: item.type === 'word' ? item.meaning : item.type === 'letter' ? item.name : item.title } as const;
    }
    return { kind: 'text', text: item.type === 'grammar' ? item.title : item.text, lang: true } as const;
  });

  $effect(() => {
    // 聽音卡正面自動播放；翻面後自動播放（F2.5）
    const it = item; const c = current; const f = flipped;
    if (!it || !c) return;
    if (!f && c.direction === 'listen' && settings.autoplay) void speakItem(it, c.lang);
    if (f && c.direction !== 'listen' && settings.autoplay) void speakItem(it, c.lang);
  });

  function flip() { if (!flipped) flipped = true; }

  async function grade(g: Grade) {
    if (!current || !item || busy) return;
    busy = true;
    stopSpeech();
    const now = new Date().toISOString();
    const wasNew = initialNew.has(current.cardId);
    let next = applySchedule(current, g, today, now);
    if (g >= 3) next = { ...next, priority: 0 };
    graded += 1;
    if (g >= 3) correct += 1; else if (g === 1) forgotten += 1;
    if (persist) {
      await putCard(next);
      await bumpDay(today, { reviewed: 1, correct: g >= 3 ? 1 : 0, newLearned: wasNew && current.reps === 0 ? 1 : 0 });
    }
    const rest = queue.slice(1);
    queue = g === 1 ? [...rest, next] : rest;
    flipped = false;
    busy = false;
    if (queue.length === 0) onFinish({ graded, correct, forgotten, cards: total });
  }

  function onKey(e: KeyboardEvent) {
    if (!current) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!flipped) flip(); else if (item) void speakItem(item, lang); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); if (item) void speakItem(item, lang); }
    else if (flipped && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); void grade(Number(e.key) as Grade); }
  }

  $effect(() => () => stopSpeech());
</script>

<svelte:window onkeydown={onKey} />

{#if current && item}
  <div class="row" style="justify-content: space-between; margin-bottom: 8px">
    <span class="tag {lang}">{lang === 'ko' ? '韓' : '葡'}</span>
    <span class="muted">{title}・剩餘 {queue.length}</span>
    <a class="muted" href="#/" aria-label="關閉">✕</a>
  </div>
  <div class="progress" style="margin-bottom: 12px"><span style={`width:${(doneCount / total) * 100}%`}></span></div>

  <button class="card flashcard" onclick={flip} aria-label={flipped ? '卡片背面' : '點擊翻面'}>
    <div class="face">
      {#if front.kind === 'listen'}
        <div class="muted">聽音，選出對應的字</div>
        <div class="big">🔊</div>
        <SpeakButton text={front.text} {lang} audio={item.audio ?? null} size="lg" label="再聽一次" />
      {:else}
        <div class="muted">{current.direction === 'produce' ? '這個怎麼說？' : '這是什麼意思？'}</div>
        <div class="big" lang={front.lang ? (lang === 'ko' ? 'ko' : 'pt-BR') : undefined}>{front.text}</div>
        {#if current.direction === 'recognize' && item.type !== 'grammar'}
          <SpeakButton text={itemSpeechText(item)} {lang} audio={item.audio ?? null} size="sm" label="播放" />
        {/if}
      {/if}
    </div>

    {#if !flipped}
      <div class="hint muted">點擊或按空白鍵翻面</div>
    {:else}
      <div class="back">
        {#if item.type === 'letter'}
          <div class="answer" lang={lang === 'ko' ? 'ko' : 'pt-BR'}>{item.text}</div>
          <div>{item.name}・{item.roman}{item.tts && item.tts !== item.text ? `・唸作 ${item.tts}` : ''}</div>
        {:else if item.type === 'word'}
          <div class="answer" lang={lang === 'ko' ? 'ko' : 'pt-BR'}>{item.text}</div>
          <div class="muted">{item.roman ?? ''}{item.ipa ? ` [${item.ipa}]` : ''}{item.pos ? `　${item.pos}` : ''}</div>
          <div style="font-size: 1.2rem">{item.meaning}</div>
        {:else}
          {#if item.pattern}<div class="answer" style="font-size: 1.4rem">{item.pattern}</div>{/if}
          <div style="text-align: left">{item.explanation}</div>
        {/if}
        <div class="row" style="justify-content: center; margin-top: 8px">
          <SpeakButton text={itemSpeechText(item)} {lang} audio={item.audio ?? null} />
          <SpeakButton text={itemSpeechText(item)} {lang} audio={item.audio ?? null} slow label="慢速" />
        </div>
        {#if item.examples?.[0]}
          <div class="muted" style="margin-top: 8px"><span lang={lang === 'ko' ? 'ko' : 'pt-BR'}>{item.examples[0].text}</span>　{item.examples[0].meaning}</div>
        {/if}
      </div>
    {/if}
  </button>

  <div class="grades" class:hidden={!flipped}>
    {#each [1, 2, 3, 4] as const as g (g)}
      <button class="grade g{g}" onclick={() => grade(g)} disabled={!flipped || busy}>
        <span>{GRADE_LABEL[g]}</span>
        <small>{previewInterval(current, g, today)}</small>
      </button>
    {/each}
  </div>
  <p class="muted" style="text-align: center; font-size: 0.85rem">鍵盤：空白鍵翻面，1–4 評分，R 重播</p>
{:else}
  <p class="empty">沒有可複習的卡片。</p>
{/if}

<style>
  .flashcard { display: block; width: 100%; text-align: center; min-height: 320px; padding: 24px 16px; cursor: pointer; }
  .face { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .big { font-size: 3rem; font-weight: 600; line-height: 1.2; word-break: break-word; }
  .hint { margin-top: 24px; font-size: 0.9rem; }
  .back { border-top: 1px dashed var(--border); margin-top: 16px; padding-top: 16px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .answer { font-size: 2.4rem; font-weight: 600; }
  .grades { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 16px; }
  .grades.hidden { visibility: hidden; }
  .grade { display: flex; flex-direction: column; align-items: center; padding: 10px 4px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); min-height: 56px; }
  .grade small { color: var(--muted); font-size: 0.75rem; }
  .grade.g1 { border-color: var(--danger); } .grade.g1 span { color: var(--danger); }
  .grade.g3 { border-color: var(--primary); } .grade.g3 span { color: var(--primary); font-weight: 600; }
  .grade:disabled { opacity: 0.5; }
</style>
