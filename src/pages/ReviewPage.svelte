<script lang="ts">
  // #/review：每日複習；#/review/lesson/:id：課後複習（id 為課程）或練習模式（id 為單元，不寫入排程）。
  import Loading from '../components/Loading.svelte';
  import ReviewSession from '../components/ReviewSession.svelte';
  import { ensureCards, loadItemsForCards, newCard, directionsFor } from '../lib/cards';
  import { findLesson, findUnit, loadCourse, loadIndex, loadUnitItems } from '../lib/content';
  import { getDueCards } from '../lib/db';
  import { sortDue } from '../lib/scheduler';
  import { settings, todayKey } from '../lib/settings.svelte';
  import { bumpDay } from '../lib/stats';
  import type { CardRecord, Item, LangCode, SessionResult } from '../lib/types';

  let { lessonId }: { lessonId?: string } = $props();

  interface Prepared {
    mode: 'daily' | 'lesson' | 'practice';
    title: string; cards: CardRecord[]; items: Map<string, Item>;
    backHref: string; nextHref?: string; nextLabel?: string; remainingDue?: number;
  }

  let result = $state<SessionResult | null>(null);

  async function prepare(id: string | undefined): Promise<Prepared> {
    result = null;
    const today = todayKey();
    if (!id) {
      const all = await getDueCards(today);
      const filtered = settings.langFilter === 'all' ? all : all.filter((c) => c.lang === settings.langFilter);
      const sorted = sortDue(filtered, today);
      const cards = sorted.slice(0, settings.dailyLimit);
      const items = await loadItemsForCards(cards);
      return { mode: 'daily', title: '每日複習', cards, items, backHref: '#/', remainingDue: sorted.length - cards.length };
    }
    // 判斷是課程還是單元
    const idx = await loadIndex();
    for (const entry of idx.languages) {
      const lang = entry.lang as LangCode;
      const course = await loadCourse(lang);
      const lessonHit = findLesson(course, id);
      if (lessonHit) {
        const all = await loadUnitItems(lang, lessonHit.unit);
        const lessonItems = lessonHit.lesson.itemIds.map((i) => all.find((x) => x.id === i)).filter((x): x is Item => !!x);
        const cards = await ensureCards(lessonItems, lang, today);
        const items = new Map(lessonItems.map((it) => [it.id, it]));
        const lessons = lessonHit.unit.lessons;
        const pos = lessons.findIndex((l) => l.id === id);
        const next = lessons[pos + 1];
        return {
          mode: 'lesson', title: `課後複習：${lessonHit.lesson.name}`, cards, items,
          backHref: `#/${lang}/unit/${lessonHit.unit.id}`,
          nextHref: next ? `#/${lang}/lesson/${next.id}` : `#/${lang}/unit/${lessonHit.unit.id}`,
          nextLabel: next ? `下一課：${next.name}` : '回到單元（可以考試了）',
        };
      }
      const unitHit = findUnit(course, id);
      if (unitHit) {
        const all = await loadUnitItems(lang, unitHit.unit);
        const ids = new Set(unitHit.unit.lessons.flatMap((l) => l.itemIds));
        const unitItems = all.filter((it) => ids.has(it.id));
        const cards = unitItems.flatMap((it) => directionsFor(it).map((d) => newCard(it, lang, d, today)));
        return {
          mode: 'practice', title: `練習：${unitHit.unit.name}`, cards: shuffle(cards),
          items: new Map(unitItems.map((it) => [it.id, it])), backHref: `#/${lang}/unit/${unitHit.unit.id}`,
        };
      }
    }
    throw new Error(`找不到課程或單元 ${id}`);
  }

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  async function finish(p: Prepared, r: SessionResult) {
    result = r;
    if (p.mode === 'daily' && (p.remainingDue ?? 0) === 0) await bumpDay(todayKey(), { cleared: true });
  }
</script>

{#key lessonId ?? 'daily'}
  {#await prepare(lessonId)}
    <Loading />
  {:then p}
    {#if result}
      <h1>{p.mode === 'practice' ? '練習完成' : '複習完成'}</h1>
      <section class="card stack">
        <div class="row" style="justify-content: space-around; text-align: center">
          <div><div class="num">{result.cards}</div><div class="muted">張卡</div></div>
          <div><div class="num">{result.graded ? Math.round((result.correct / result.graded) * 100) : 0}%</div><div class="muted">正確率</div></div>
          <div><div class="num">{result.forgotten}</div><div class="muted">忘記次數</div></div>
        </div>
        {#if p.mode === 'daily'}
          <p class="muted" style="margin: 0; text-align: center">
            {#if (p.remainingDue ?? 0) > 0}今天還有 {p.remainingDue} 張超過上限的卡，可再按一次「開始複習」。{:else}今天的隊列已清空。{/if}
          </p>
        {:else if p.mode === 'lesson'}
          <p class="muted" style="margin: 0; text-align: center">這些項目已排入每日複習，明天會再出現。</p>
        {:else}
          <p class="muted" style="margin: 0; text-align: center">練習模式不影響排程。</p>
        {/if}
        {#if p.nextHref}<a class="btn primary big" href={p.nextHref}>{p.nextLabel}</a>{/if}
        {#if p.mode === 'daily' && (p.remainingDue ?? 0) > 0}
          <a class="btn primary big" href="#/review" onclick={() => (result = null)}>繼續複習</a>
        {/if}
        <a class="btn big" href={p.backHref}>{p.mode === 'daily' ? '回首頁' : '回到單元'}</a>
      </section>
    {:else if p.cards.length === 0}
      <h1>{p.title}</h1>
      <p class="empty">{p.mode === 'daily' ? '今天沒有到期的卡片。' : '沒有可複習的項目。'}</p>
      <a class="btn" href={p.backHref}>返回</a>
    {:else}
      <ReviewSession cards={p.cards} items={p.items} persist={p.mode !== 'practice'} title={p.title} onFinish={(r) => finish(p, r)} />
    {/if}
  {:catch error}
    <Loading {error} />
  {/await}
{/key}

<style>
  .num { font-size: 2rem; font-weight: 700; }
</style>
