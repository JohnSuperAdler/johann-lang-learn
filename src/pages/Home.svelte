<script lang="ts">
  import Loading from '../components/Loading.svelte';
  import ProgressCard from '../components/ProgressCard.svelte';
  import { loadCourse, loadIndex } from '../lib/content';
  import { getLangProgress, type LangProgress } from '../lib/progress';
  import { settings } from '../lib/settings.svelte';
  import type { Course, LangCode } from '../lib/types';

  interface Row { course: Course; progress: LangProgress; }

  async function load(): Promise<Row[]> {
    const idx = await loadIndex();
    const rows: Row[] = [];
    for (const entry of idx.languages) {
      const course = await loadCourse(entry.lang);
      rows.push({ course, progress: await getLangProgress(course) });
    }
    return rows;
  }

  const visible = (lang: LangCode) => settings.langFilter === 'all' || settings.langFilter === lang;
</script>

<h1>今天</h1>

{#await load()}
  <Loading />
{:then rows}
  {@const rowsShown = rows.filter((r) => visible(r.course.lang))}
  {@const due = rowsShown.reduce((n, r) => n + r.progress.due, 0)}
  <section class="card stack" style="margin-bottom: 16px">
    <div class="row" style="justify-content: space-between">
      <div>
        <div class="muted">今日待複習</div>
        <div style="font-size: 2rem; font-weight: 700; line-height: 1.1">{due} <span class="muted" style="font-size: 1rem">項</span></div>
      </div>
      <div class="muted" style="text-align: right">
        <div>連續天數</div>
        <div style="font-size: 1.5rem; font-weight: 700; line-height: 1.1">0</div>
      </div>
    </div>
    <a class="btn primary big" href="#/review" class:disabled={due === 0} aria-disabled={due === 0}>
      {due === 0 ? '今天沒有待複習項目' : '開始複習'}
    </a>
  </section>

  <div class="grid2">
    {#each rowsShown as { course, progress } (course.lang)}
      <ProgressCard
        lang={course.lang} name={course.name}
        learned={progress.learned} total={progress.total}
        unitsPassed={progress.unitsPassed} unitsTotal={progress.unitsTotal}
        due={progress.due}
        nextHref={progress.nextUnit ? `#/${course.lang}/unit/${progress.nextUnit.id}` : `#/${course.lang}`}
        nextLabel={progress.nextUnit ? `下一課：${progress.nextUnit.id} ${progress.nextUnit.name}` : '查看單元'}
      />
    {/each}
  </div>

  {#if visible('pt')}
    <section class="card" style="margin-top: 16px">
      <h3>卡波耶拉單字</h3>
      <p class="muted" style="margin: 0 0 8px">招式、樂器、歌曲用語的專屬捷徑。</p>
      <div class="row" style="flex-wrap: wrap">
        <a class="btn" href="#/pt/unit/P-B6">招式</a>
        <a class="btn" href="#/pt/unit/P-B7">樂器與 roda</a>
        <a class="btn" href="#/pt/unit/P-B8">歌曲用語</a>
      </div>
    </section>
  {/if}
{:catch error}
  <Loading {error} />
{/await}

<style>
  .btn.disabled { opacity: 0.5; pointer-events: none; }
</style>
