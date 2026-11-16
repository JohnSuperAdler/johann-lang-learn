<script lang="ts">
  // 跨單元搜尋（F1.7）：原文、拼音／音標、中文釋義、文法標題。
  import Loading from '../components/Loading.svelte';
  import SpeakButton from '../components/SpeakButton.svelte';
  import { allUnits, loadCourse, loadUnitItems } from '../lib/content';
  import { itemSpeechText } from '../lib/speech.svelte';
  import type { Item, LangCode } from '../lib/types';

  let { q }: { q: string } = $props();
  let text = $state('');
  $effect(() => { text = q; });

  interface Entry { item: Item; lang: LangCode; lessonId: string; where: string; hay: string; label: string; sub: string; meaning: string; }
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toLowerCase();

  let indexPromise: Promise<Entry[]> | null = null;
  function buildIndex(): Promise<Entry[]> {
    indexPromise ??= (async () => {
      const out: Entry[] = [];
      for (const lang of ['ko', 'pt'] as LangCode[]) {
        const course = await loadCourse(lang);
        await Promise.all(allUnits(course).filter(({ unit }) => unit.lessons.length).map(async ({ unit }) => {
          const byId = new Map((await loadUnitItems(lang, unit)).map((it) => [it.id, it]));
          for (const lesson of unit.lessons) for (const id of lesson.itemIds) {
            const item = byId.get(id);
            if (!item) continue;
            const label = item.type === 'grammar' ? item.title : item.text;
            const sub = item.type === 'grammar' ? item.pattern ?? '' : item.type === 'word' ? item.roman ?? item.ipa ?? '' : item.roman;
            const meaning = item.type === 'word' ? item.meaning : item.type === 'letter' ? item.name : '';
            out.push({ item, lang, lessonId: lesson.id, where: `${unit.id} ${lesson.name}`, label, sub, meaning, hay: fold([label, sub, meaning].join('\n')) });
          }
        }));
      }
      return out.sort((a, b) => a.item.id.localeCompare(b.item.id));
    })();
    return indexPromise;
  }

  const LIMIT = 50;
  async function search(query: string) {
    const needle = fold(query.trim());
    if (!needle) return null;
    const hits = (await buildIndex()).filter((e) => e.hay.includes(needle));
    // 原文或釋義完全相同的排前面，其次是開頭相符。
    const rank = (e: Entry) => (fold(e.label) === needle || fold(e.meaning) === needle ? 0 : fold(e.label).startsWith(needle) ? 1 : 2);
    hits.sort((a, b) => rank(a) - rank(b));
    return { total: hits.length, hits: hits.slice(0, LIMIT) };
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    location.hash = `#/search?q=${encodeURIComponent(text.trim())}`;
  }
</script>

<h1>搜尋</h1>
<form class="row" onsubmit={submit}>
  <input type="search" bind:value={text} placeholder="原文、拼音或中文" style="flex: 1; min-width: 0; padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: inherit; font: inherit" />
  <button class="btn primary" type="submit">搜尋</button>
</form>

{#if q.trim()}
  {#await search(q)}
    <Loading />
  {:then result}
    {#if !result || result.total === 0}
      <p class="empty">找不到「{q}」。</p>
    {:else}
      <p class="muted">共 {result.total} 筆{result.total > LIMIT ? `，顯示前 ${LIMIT} 筆` : ''}</p>
      <div class="stack" style="gap: 8px">
        {#each result.hits as e (e.item.id)}
          <div class="card row hit" style="padding: 10px 12px">
            {#if e.item.type !== 'grammar'}<SpeakButton text={itemSpeechText(e.item)} lang={e.lang} audio={e.item.audio ?? null} size="sm" />{/if}
            <a href={`#/${e.lang}/lesson/${e.lessonId}`} style="flex: 1; min-width: 0">
              <strong lang={e.lang}>{e.label}</strong>
              {#if e.sub}<span class="muted">　{e.sub}</span>{/if}
              <br />
              <span>{e.meaning}</span>
              <span class="muted" style="font-size: 0.85rem">{e.meaning ? '　' : ''}{e.where}</span>
            </a>
            <span class="tag" style="background: color-mix(in srgb, var(--{e.lang}) 18%, transparent)">{e.lang === 'ko' ? '韓' : '葡'}</span>
          </div>
        {/each}
      </div>
    {/if}
  {:catch error}
    <Loading {error} />
  {/await}
{:else}
  <p class="empty">輸入韓文、葡文、拼音或中文釋義，搜尋全部課程。</p>
{/if}
