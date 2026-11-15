<script lang="ts">
  import { onMount } from 'svelte';
  import { router, startRouter } from './lib/router.svelte';
  import { initSpeech } from './lib/speech.svelte';
  import Shell from './components/Shell.svelte';
  import Home from './pages/Home.svelte';
  import UnitList from './pages/UnitList.svelte';
  import UnitPage from './pages/UnitPage.svelte';
  import LessonPage from './pages/LessonPage.svelte';
  import ReviewPage from './pages/ReviewPage.svelte';
  import ExamPage from './pages/ExamPage.svelte';
  import SearchPage from './pages/SearchPage.svelte';
  import StatsPage from './pages/StatsPage.svelte';
  import SettingsPage from './pages/SettingsPage.svelte';
  import NotFound from './pages/NotFound.svelte';

  onMount(() => {
    initSpeech();
    return startRouter();
  });

  const route = $derived(router.route);
</script>

<Shell {route}>
  {#if route.page === 'home'}
    <Home />
  {:else if route.page === 'units'}
    <UnitList lang={route.lang} />
  {:else if route.page === 'unit'}
    <UnitPage lang={route.lang} unitId={route.unitId} />
  {:else if route.page === 'lesson'}
    <LessonPage lang={route.lang} lessonId={route.lessonId} />
  {:else if route.page === 'review'}
    <ReviewPage lessonId={route.lessonId} />
  {:else if route.page === 'exam'}
    <ExamPage lang={route.lang} unitId={route.unitId} />
  {:else if route.page === 'search'}
    <SearchPage q={route.q} />
  {:else if route.page === 'stats'}
    <StatsPage />
  {:else if route.page === 'settings'}
    <SettingsPage />
  {:else}
    <NotFound path={route.path} />
  {/if}
</Shell>
