<script lang="ts">
  import ExamQuestion from '../components/ExamQuestion.svelte';
  import Loading from '../components/Loading.svelte';
  import { findUnit, loadCourse, loadUnitItems } from '../lib/content';
  import { examUnlock, learnedItemIds, saveExamResult, type ExamOutcome, type UnlockInfo } from '../lib/exam';
  import { generateExam, tripleOf, type Question } from '../lib/quiz';
  import { settings, todayKey } from '../lib/settings.svelte';
  import type { Item, LangCode, Unit } from '../lib/types';

  let { lang, unitId }: { lang: LangCode; unitId: string } = $props();

  interface Data { unit: Unit; items: Item[]; unlock: UnlockInfo; }
  let data = $state<Data | null>(null);
  let error = $state<unknown>(null);
  let phase = $state<'intro' | 'running' | 'done'>('intro');
  let questions = $state<Question[]>([]);
  let index = $state(0);
  let points = $state(0);
  let wrongIds = $state<string[]>([]);
  let startedAt = 0;
  let outcome = $state<ExamOutcome | null>(null);

  $effect(() => {
    const l = lang, id = unitId;
    data = null; error = null; phase = 'intro'; outcome = null;
    (async () => {
      const course = await loadCourse(l);
      const found = findUnit(course, id);
      if (!found) throw new Error(`找不到單元 ${id}`);
      const all = await loadUnitItems(l, found.unit);
      const ids = new Set(found.unit.lessons.flatMap((x) => x.itemIds));
      data = { unit: found.unit, items: all.filter((it) => ids.has(it.id)), unlock: examUnlock(found.unit, await learnedItemIds()) };
    })().catch((e) => (error = e));
  });

  function start() {
    if (!data) return;
    questions = generateExam(data.items, lang, data.unit.exam);
    index = 0; points = 0; wrongIds = []; outcome = null;
    startedAt = Date.now();
    phase = questions.length ? 'running' : 'intro';
  }

  function onAnswer(r: { score: number; wrongItemIds: string[] }) {
    points += r.score;
    wrongIds = [...wrongIds, ...r.wrongItemIds];
  }

  async function next() {
    if (index + 1 < questions.length) { index += 1; return; }
    outcome = await saveExamResult({
      unitId, lang, points, total: questions.length, passRate: settings.passRate,
      wrongItemIds: wrongIds, durationSec: Math.round((Date.now() - startedAt) / 1000), today: todayKey(),
    });
    phase = 'done';
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
  const wrongItems = $derived(data && outcome ? data.items.filter((it) => outcome!.record.wrongItemIds.includes(it.id)) : []);
</script>

<p class="muted" style="margin: 0"><a href={`#/${lang}/unit/${unitId}`}>‹ 返回單元</a></p>

{#if error}
  <Loading {error} />
{:else if !data}
  <Loading />
{:else if phase === 'intro'}
  <h1>單元考試：{data.unit.id} {data.unit.name}</h1>
  <section class="card stack">
    <div>共 {data.unit.exam.questionCount} 題，每次題目隨機。通過標準 {Math.round(settings.passRate * 100)}％。</div>
    <div class="muted">作答後立即顯示正解；錯題會排到每日複習最前面。</div>
    {#if data.unlock.unlocked}
      <button class="btn primary big" onclick={start}>開始考試</button>
    {:else if data.unlock.lessonsTotal === 0}
      <p class="empty" style="padding: 8px">本單元教材準備中，尚無法考試。</p>
    {:else}
      <p class="warn">還有 {data.unlock.lessonsTotal - data.unlock.lessonsDone} 課未完成（需學完並做過課後複習）才能考試。</p>
      <a class="btn big" href={`#/${lang}/unit/${unitId}`}>回單元繼續學習</a>
    {/if}
  </section>
{:else if phase === 'running'}
  <div class="row" style="justify-content: space-between; margin: 8px 0">
    <strong>第 {index + 1} / {questions.length} 題</strong>
    <span class="muted">{data.unit.id}</span>
  </div>
  <div class="progress" style="margin-bottom: 16px"><span style={`width:${(index / questions.length) * 100}%`}></span></div>
  {#key index}
    <ExamQuestion q={questions[index]} isLast={index === questions.length - 1} {onAnswer} onNext={next} />
  {/key}
{:else if outcome}
  <h1>{outcome.passed ? '通過！' : '未通過'}</h1>
  <section class="card stack">
    <div class="row" style="justify-content: space-around; text-align: center">
      <div><div class="num" class:pass={outcome.passed} class:fail={!outcome.passed}>{outcome.score}</div><div class="muted">分</div></div>
      <div><div class="num">{fmtTime(outcome.record.durationSec)}</div><div class="muted">用時</div></div>
      <div><div class="num">{wrongItems.length}</div><div class="muted">錯題項目</div></div>
    </div>
    <p class="muted" style="margin: 0; text-align: center">
      {outcome.passed ? '下一個單元已解鎖。' : `需達 ${Math.round(settings.passRate * 100)} 分才能解鎖下一單元，可以立即重考。`}
    </p>
    {#if wrongItems.length}
      <div>
        <strong>錯題清單</strong><span class="muted">（已排入每日複習最前面）</span>
        <ul class="wrong">
          {#each wrongItems as it (it.id)}
            {@const t = tripleOf(it)}
            <li><span lang={lang === 'ko' ? 'ko' : 'pt-BR'} style="font-size: 1.2rem">{t?.foreign ?? it.id}</span>　<span class="muted">{t?.native ?? ''}</span></li>
          {/each}
        </ul>
      </div>
    {/if}
    <div class="row" style="flex-wrap: wrap">
      <button class="btn" style="flex: 1" class:primary={!outcome.passed} onclick={start}>重考</button>
      {#if wrongItems.length}<a class="btn" style="flex: 1" href="#/review">複習錯題</a>{/if}
      <a class="btn" style="flex: 1" class:primary={outcome.passed} href={`#/${lang}`}>單元列表</a>
    </div>
  </section>
{/if}

<style>
  .num { font-size: 1.6rem; font-weight: 700; }
  .num.pass { color: #16a34a; font-size: 2.4rem; }
  .num.fail { color: var(--danger); font-size: 2.4rem; }
  .wrong { margin: 8px 0 0; padding-left: 20px; }
  .warn { background: color-mix(in srgb, var(--danger) 10%, transparent); border: 1px solid var(--danger); border-radius: 10px; padding: 10px 12px; margin: 0; }
</style>
