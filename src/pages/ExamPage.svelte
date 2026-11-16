<script lang="ts">
  // 單元考試（unitId 為單元）與階段總複習考（unitId 為 `stage-<階段 id>`，F3.9）。
  import ExamQuestion from '../components/ExamQuestion.svelte';
  import Loading from '../components/Loading.svelte';
  import { findUnit, loadCourse, loadUnitItems } from '../lib/content';
  import { getAllExams } from '../lib/db';
  import { examUnlock, learnedItemIds, saveExamResult, type ExamOutcome } from '../lib/exam';
  import { generateExam, tripleOf, type ExamSpecLite, type Question } from '../lib/quiz';
  import { settings, todayKey } from '../lib/settings.svelte';
  import type { Item, LangCode, QuestionType } from '../lib/types';

  let { lang, unitId }: { lang: LangCode; unitId: string } = $props();

  interface Data {
    title: string; label: string; isStage: boolean; spec: ExamSpecLite; items: Item[];
    unlocked: boolean; lockMsg: string; backHref: string;
  }
  let data = $state<Data | null>(null);
  let error = $state<unknown>(null);
  let phase = $state<'intro' | 'running' | 'done'>('intro');
  let questions = $state<Question[]>([]);
  let index = $state(0);
  let points = $state(0);
  let wrongIds = $state<string[]>([]);
  let startedAt = 0;
  let outcome = $state<ExamOutcome | null>(null);

  const STAGE_EXAM_QUESTIONS = 40;

  async function loadData(l: LangCode, id: string): Promise<Data> {
    const course = await loadCourse(l);
    if (id.startsWith('stage-')) {
      const stage = course.stages.find((s) => s.id === id.slice(6));
      if (!stage) throw new Error(`找不到階段 ${id}`);
      const items: Item[] = [];
      const types = new Set<QuestionType>();
      for (const unit of stage.units) {
        if (unit.lessons.length === 0) continue;
        const ids = new Set(unit.lessons.flatMap((x) => x.itemIds));
        items.push(...(await loadUnitItems(l, unit)).filter((it) => ids.has(it.id)));
        unit.exam.questionTypes.forEach((t) => types.add(t));
      }
      const passed = new Set((await getAllExams()).filter((e) => e.passed).map((e) => e.unitId));
      const required = stage.units.filter((u) => !u.optional);
      const done = required.filter((u) => passed.has(u.id)).length;
      return {
        title: `${stage.name}階段總複習考`, label: stage.id, isStage: true,
        spec: { questionCount: STAGE_EXAM_QUESTIONS, questionTypes: [...types] }, items,
        unlocked: required.length > 0 && done === required.length && items.length > 0,
        lockMsg: `需先通過本階段全部必修單元（目前 ${done} / ${required.length}）。`,
        backHref: `#/${l}`,
      };
    }
    const found = findUnit(course, id);
    if (!found) throw new Error(`找不到單元 ${id}`);
    const all = await loadUnitItems(l, found.unit);
    const ids = new Set(found.unit.lessons.flatMap((x) => x.itemIds));
    const unlock = examUnlock(found.unit, await learnedItemIds());
    return {
      title: `單元考試：${found.unit.id} ${found.unit.name}`, label: found.unit.id, isStage: false,
      spec: found.unit.exam, items: all.filter((it) => ids.has(it.id)),
      unlocked: unlock.unlocked,
      lockMsg: unlock.lessonsTotal === 0 ? '本單元教材準備中，尚無法考試。'
        : `還有 ${unlock.lessonsTotal - unlock.lessonsDone} 課未完成（需學完並做過課後複習）才能考試。`,
      backHref: `#/${l}/unit/${id}`,
    };
  }

  $effect(() => {
    const l = lang, id = unitId;
    data = null; error = null; phase = 'intro'; outcome = null;
    loadData(l, id).then((d) => (data = d)).catch((e) => (error = e));
  });

  function start() {
    if (!data) return;
    questions = generateExam(data.items, lang, data.spec);
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

{#if error}
  <Loading {error} />
{:else if !data}
  <Loading />
{:else}
  <p class="muted" style="margin: 0"><a href={data.backHref}>‹ 返回</a></p>
  {#if phase === 'intro'}
    <h1>{data.title}</h1>
    <section class="card stack">
      <div>共 {data.spec.questionCount} 題，每次題目隨機。通過標準 {Math.round(settings.passRate * 100)}％。</div>
      <div class="muted">作答後立即顯示正解；錯題會排到每日複習最前面。{data.isStage ? '總複習考不影響單元解鎖。' : ''}</div>
      {#if data.unlocked}
        <button class="btn primary big" onclick={start}>開始考試</button>
      {:else}
        <p class="warn">{data.lockMsg}</p>
        <a class="btn big" href={data.backHref}>返回</a>
      {/if}
    </section>
  {:else if phase === 'running'}
    <div class="row" style="justify-content: space-between; margin: 8px 0">
      <strong>第 {index + 1} / {questions.length} 題</strong>
      <span class="muted">{data.label}</span>
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
        {#if data.isStage}{outcome.passed ? '這個階段的內容掌握得很好。' : '可以先複習錯題再重考。'}
        {:else}{outcome.passed ? '下一個單元已解鎖。' : `需達 ${Math.round(settings.passRate * 100)} 分才能解鎖下一單元，可以立即重考。`}{/if}
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
{/if}

<style>
  .num { font-size: 1.6rem; font-weight: 700; }
  .num.pass { color: #16a34a; font-size: 2.4rem; }
  .num.fail { color: var(--danger); font-size: 2.4rem; }
  .wrong { margin: 8px 0 0; padding-left: 20px; }
  .warn { background: color-mix(in srgb, var(--danger) 10%, transparent); border: 1px solid var(--danger); border-radius: 10px; padding: 10px 12px; margin: 0; }
</style>
