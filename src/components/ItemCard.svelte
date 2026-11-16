<script lang="ts">
  import SpeakButton from './SpeakButton.svelte';
  import { itemSpeechText } from '../lib/speech.svelte';
  import type { Item, LangCode } from '../lib/types';

  let { item, lang }: { item: Item; lang: LangCode } = $props();
  const say = $derived(itemSpeechText(item));
</script>

<article class="card itemcard">
  {#if item.type === 'letter'}
    <div class="glyph" lang={lang === 'ko' ? 'ko' : 'pt-BR'}>{item.text}</div>
    <div class="roman">{item.roman}</div>
    <div class="name">{item.name}</div>
    {#if item.tts && item.tts !== item.text}<div class="muted">唸作「{item.tts}」</div>{/if}
    <div class="row" style="justify-content: center; margin: 12px 0">
      <SpeakButton text={say} {lang} audio={item.audio ?? null} size="lg" />
      <SpeakButton text={say} {lang} audio={item.audio ?? null} slow label="慢速" />
    </div>
    {#if item.note}<p class="note">{item.note}</p>{/if}
  {:else if item.type === 'word'}
    <div class="word" lang={lang === 'ko' ? 'ko' : 'pt-BR'}>{item.text}</div>
    <div class="roman">{item.roman ?? ''}{item.ipa ? ` [${item.ipa}]` : ''}{item.pos ? `　${item.pos}` : ''}</div>
    <div class="meaning">{item.meaning}</div>
    <div class="row" style="justify-content: center; margin: 12px 0">
      <SpeakButton text={say} {lang} audio={item.audio ?? null} size="lg" />
      <SpeakButton text={say} {lang} audio={item.audio ?? null} slow label="慢速" />
    </div>
    {#if item.note}<p class="note">{item.note}</p>{/if}
  {:else}
    <h2 style="text-align: center">{item.title}</h2>
    {#if item.pattern}<div class="pattern">{item.pattern}</div>{/if}
    <p>{item.explanation}</p>
    {#if item.pitfalls?.length}
      <p class="muted"><strong>常見錯誤：</strong>{item.pitfalls.join('；')}</p>
    {/if}
  {/if}

  {#if item.examples?.length}
    <ul class="examples">
      {#each item.examples as ex (ex.text)}
        <li>
          <SpeakButton text={ex.text} {lang} audio={ex.audio ?? null} size="sm" label="播放例句" />
          <span class="ex-text" lang={lang === 'ko' ? 'ko' : 'pt-BR'}>{ex.text}</span>
          <span class="muted">{ex.meaning}</span>
        </li>
      {/each}
    </ul>
  {/if}
</article>

<style>
  .itemcard { text-align: center; padding: 24px 16px; }
  .glyph { font-size: 128px; line-height: 1.1; font-weight: 500; }
  .word { font-size: 2.4rem; font-weight: 600; line-height: 1.2; }
  .roman { color: var(--muted); font-size: 1.1rem; margin-top: 4px; }
  .name { font-size: 1.2rem; font-weight: 600; margin-top: 4px; }
  .meaning { font-size: 1.3rem; margin-top: 8px; }
  .note { text-align: left; background: var(--bg); border-radius: 10px; padding: 12px; margin: 8px 0 0; white-space: pre-line; }
  .pattern { display: inline-block; font-family: ui-monospace, monospace; background: var(--primary-soft); padding: 4px 12px; border-radius: 8px; margin-bottom: 8px; }
  .examples { list-style: none; padding: 0; margin: 16px 0 0; text-align: left; display: flex; flex-direction: column; gap: 8px; }
  .examples li { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; border-top: 1px solid var(--border); padding-top: 8px; }
  .ex-text { font-size: 1.15rem; font-weight: 500; }
</style>
