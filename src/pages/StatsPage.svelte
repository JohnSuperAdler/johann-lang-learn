<script lang="ts">
  import DayChart from '../components/DayChart.svelte';
  import Loading from '../components/Loading.svelte';
  import { loadItemsForCards } from '../lib/cards';
  import { allUnits, findLesson, loadCourse } from '../lib/content';
  import { getAllCards, getAllDays, getAllExams } from '../lib/db';
  import { tripleOf } from '../lib/quiz';
  import { todayKey } from '../lib/settings.svelte';
  import { computeStreak } from '../lib/stats';
  import { cardBreakdown, examSummary, lastNDays, totals, weakItems } from '../lib/statsData';
  import type { LangCode } from '../lib/types';

  const LANGS: LangCode[] = ['ko', 'pt'];

  async function load() {
    const today = todayKey();
    const [cards, exams, days, courses] = await Promise.all([getAllCards(), getAllExams(), getAllDays(), Promise.all(LANGS.map(loadCourse))]);
    const summary = examSummary(exams);
    const weak = weakItems(cards, 10);
    const weakSet = new Set(weak.map((w) => w.itemId));
    const items = await loadItemsForCards(cards.filter((c) => weakSet.has(c.itemId)));
    const langs = courses.map((course) => {
      const units = allUnits(course).map(({ unit }) => unit);
      const required = units.filter((u) => !u.optional);
      const lessonOf = new Map<string, string>();
      for (const u of units) for (const l of u.lessons) for (const id of l.itemIds) lessonOf.set(id, l.id);
      return {
        lang: course.lang, name: course.name,
        breakdown: cardBreakdown(cards, course.lang),
        total: units.reduce((n, u) => n + u.lessons.reduce((m, l) => m + l.itemIds.length, 0), 0),
        passed: required.filter((u) => summary.get(u.id)?.passed).length,
        required: required.length,
        exams: units.filter((u) => summary.has(u.id)).map((u) => ({ unit: u, s: summary.get(u.id)! })),
        stageExams: course.stages.filter((st) => summary.has(`stage-${st.id}`)).map((st) => ({ name: `${st.name}階段總複習考`, s: summary.get(`stage-${st.id}`)! })),
        lessonOf, course,
      };
    });
    const weakRows = weak.map((w) => {
      const it = items.get(w.itemId);
      const t = it ? tripleOf(it) : null;
      const l = langs.find((x) => x.lang === w.lang);
      const lessonId = l?.lessonOf.get(w.itemId);
      const where = lessonId && l ? findLesson(l.course, lessonId) : null;
      return {
        ...w, lessonId,
        label: it ? (it.type === 'grammar' ? it.title : it.text) : w.itemId,
        meaning: it?.type === 'grammar' ? '' : t?.native ?? '',
        where: where ? `${where.unit.id} ${where.lesson.name}` : '',
      };
    });
    return {
      streak: computeStreak(days, today),
      today: days.find((d) => d.date === today),
      all: totals(days),
      recent: lastNDays(days, today, 30),
      langs, weakRows,
    };
  }
  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}％`);
</script>

<h1>統計</h1>

{#await load()}
  <Loading />
{:then data}
  <div class="stack">
    <section class="tiles">
      <div class="card tile"><span class="num">{data.streak}</span><span class="muted">連續天數</span></div>
      <div class="card tile"><span class="num">{data.today?.reviewed ?? 0}</span><span class="muted">今日複習</span></div>
      <div class="card tile"><span class="num">{data.all.reviewed}</span><span class="muted">累計複習</span></div>
      <div class="card tile"><span class="num">{pct(data.all.accuracy)}</span><span class="muted">總正確率</span></div>
    </section>

    <section class="card">
      <h3>近 30 日每日複習張數</h3>
      <DayChart days={data.recent} />
    </section>

    {#each data.langs as l (l.lang)}
      <section class="card stack">
        <div class="row" style="justify-content: space-between">
          <h3 style="margin: 0"><span class="dot" style="background: var(--{l.lang})"></span>{l.name}</h3>
          <span class="muted">必修單元 {l.passed} / {l.required} 通過</span>
        </div>
        <div>
          <div class="row" style="justify-content: space-between; font-size: 0.9rem">
            <span>已學項目</span><span class="muted">{l.breakdown.items} / {l.total}</span>
          </div>
          <div class="progress"><div style="height: 100%; width: {l.total ? (l.breakdown.items / l.total) * 100 : 0}%; background: var(--{l.lang})"></div></div>
        </div>
        <div class="tiles small">
          <div class="tile"><span class="num">{l.breakdown.learning + l.breakdown.fresh}</span><span class="muted">學習中</span></div>
          <div class="tile"><span class="num">{l.breakdown.young}</span><span class="muted">熟悉中</span></div>
          <div class="tile"><span class="num">{l.breakdown.mature}</span><span class="muted">已熟（≥21 天）</span></div>
          <div class="tile"><span class="num">{l.breakdown.cards}</span><span class="muted">卡片總數</span></div>
        </div>
        {#if l.exams.length || l.stageExams.length}
          <table>
            <thead><tr><th>考試</th><th>最高</th><th>最近</th><th>次數</th><th></th></tr></thead>
            <tbody>
              {#each l.exams as { unit, s } (unit.id)}
                <tr>
                  <td><a href={`#/${l.lang}/unit/${unit.id}`}>{unit.id} {unit.name}</a></td>
                  <td>{s.best}</td><td>{s.last}</td><td>{s.attempts}</td><td>{s.passed ? '✓ 通過' : '未通過'}</td>
                </tr>
              {/each}
              {#each l.stageExams as { name, s } (name)}
                <tr><td>{name}</td><td>{s.best}</td><td>{s.last}</td><td>{s.attempts}</td><td>{s.passed ? '✓ 通過' : '未通過'}</td></tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="muted" style="margin: 0">還沒有考試紀錄。</p>
        {/if}
      </section>
    {/each}

    <section class="card stack">
      <h3 style="margin: 0">最常忘記的項目</h3>
      {#if data.weakRows.length === 0}
        <p class="muted" style="margin: 0">目前沒有忘記過的項目。</p>
      {:else}
        <table class="weak">
          <thead><tr><th>項目</th><th>所在課程</th><th>忘記次數</th></tr></thead>
          <tbody>
            {#each data.weakRows as w (w.itemId)}
              <tr>
                <td>
                  {#if w.lessonId}<a href={`#/${w.lang}/lesson/${w.lessonId}`}><strong lang={w.lang}>{w.label}</strong></a>{:else}<strong>{w.label}</strong>{/if}
                  {#if w.meaning}<span class="muted">　{w.meaning}</span>{/if}
                </td>
                <td class="muted">{w.where}</td>
                <td>{w.lapses}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    <p class="muted" style="text-align: center"><a href="#/settings">設定與備份</a>・<a href="#/search">搜尋</a></p>
  </div>
{:catch error}
  <Loading {error} />
{/await}

<style>
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .tiles.small { gap: 4px; }
  .tile { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 12px 4px; font-size: 0.85rem; }
  .num { font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.2; }
  .tiles.small .num { font-size: 1.2rem; }
  @media (max-width: 480px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  th, td { text-align: right; padding: 6px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 500; }
  th:first-child, td:first-child { text-align: left; }
  .weak th:nth-child(2), .weak td:nth-child(2) { text-align: left; }
</style>
