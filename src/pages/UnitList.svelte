<script lang="ts">
  import Loading from '../components/Loading.svelte';
  import { loadCourse } from '../lib/content';
  import { getLangProgress, STATUS_LABEL, unitStatus } from '../lib/progress';
  import type { LangCode, StageKind } from '../lib/types';

  let { lang }: { lang: LangCode } = $props();

  let activeStage = $state<StageKind>('alphabet');

  async function load(l: LangCode) {
    const course = await loadCourse(l);
    const progress = await getLangProgress(course);
    return { course, progress };
  }
</script>

{#key lang}
  {#await load(lang)}
    <Loading />
  {:then { course, progress }}
    <h1><span class="tag {lang}">{lang === 'ko' ? '韓' : '葡'}</span> {course.name}</h1>
    <div class="tabs" role="tablist">
      {#each course.stages as stage (stage.id)}
        <button role="tab" aria-selected={activeStage === stage.kind} class:active={activeStage === stage.kind}
          onclick={() => (activeStage = stage.kind)}>{stage.name}</button>
      {/each}
    </div>

    {#each course.stages.filter((s) => s.kind === activeStage) as stage (stage.id)}
      <div class="stack">
        {#each stage.units as unit (unit.id)}
          {@const status = unitStatus(unit, progress.passedUnitIds, progress.inProgressUnitIds)}
          <a class="card unit" class:locked={status === 'locked'} href={`#/${lang}/unit/${unit.id}`}>
            <div class="row" style="justify-content: space-between">
              <strong>{unit.id} {unit.name}</strong>
              <span class="status {status}">{STATUS_LABEL[status]}{unit.optional ? '・選修' : ''}</span>
            </div>
            <div class="muted" style="font-size: 0.9rem">
              {unit.description ?? ''}
              {#if unit.lessons.length}・{unit.lessons.length} 課{:else}・教材準備中{/if}
            </div>
          </a>
        {/each}
      </div>
    {/each}
  {:catch error}
    <Loading {error} />
  {/await}
{/key}

<style>
  .tabs { display: flex; gap: 8px; margin: 8px 0 16px; }
  .tabs button { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); }
  .tabs button.active { background: var(--primary); color: #fff; border-color: var(--primary); }
  .unit { display: block; }
  .unit.locked { opacity: 0.6; }
  .status { font-size: 0.8rem; padding: 2px 8px; border-radius: 999px; background: var(--border); white-space: nowrap; }
  .status.passed { background: #bbf7d0; color: #14532d; }
  .status.available { background: var(--primary-soft); }
  .status.inprogress { background: #fef3c7; color: #78350f; }
</style>
