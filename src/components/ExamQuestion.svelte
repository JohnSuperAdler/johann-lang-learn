<script lang="ts">
  // 單一考題：依 q.kind 顯示選擇／輸入／重組／配對，作答後立即回饋（F3.5）。
  // 父層以 {#key} 逐題重建本元件。
  import AccentBar from './AccentBar.svelte';
  import HangulKeyboard from './HangulKeyboard.svelte';
  import SpeakButton from './SpeakButton.svelte';
  import { gradeTyped, scoreOf, VERDICT_LABEL, type Verdict } from '../lib/grader';
  import { KIND_LABEL, type Question } from '../lib/quiz';
  import { speak, stopSpeech } from '../lib/speech.svelte';

  let {
    q, isLast, onAnswer, onNext,
  }: {
    q: Question; isLast: boolean;
    onAnswer: (r: { score: number; wrongItemIds: string[] }) => void; onNext: () => void;
  } = $props();

  let answered = $state(false);
  let verdict = $state<Verdict>('wrong');
  let selected = $state(-1);          // 選擇題
  let value = $state('');             // 輸入題
  let picked = $state<number[]>([]);  // 重組題：已選詞塊索引
  let selLeft = $state(-1);           // 配對題
  let matched = $state<number[]>([]);
  let missIds = $state<string[]>([]);
  let missCount = $state(0);
  let flash = $state(-1);
  let inputEl = $state<HTMLInputElement | null>(null);

  const flang = $derived(q.lang === 'ko' ? 'ko' : 'pt-BR');

  // 聽力題進場自動播放
  $effect(() => {
    if ((q.kind === 'listen-choice' || q.kind === 'dictation') && q.speak) void speak(q.speak, { lang: q.lang, audio: q.audio ?? null });
  });
  $effect(() => { inputEl?.focus(); });
  $effect(() => () => stopSpeech());

  function finish(v: Verdict, wrongIds: string[]) {
    if (answered) return;
    answered = true;
    verdict = v;
    onAnswer({ score: scoreOf(v), wrongItemIds: wrongIds });
    if (q.reveal) void speak(q.reveal, { lang: q.lang, audio: q.audio ?? null });
  }

  function choose(i: number) {
    if (answered || (q.kind !== 'choice' && q.kind !== 'listen-choice')) return;
    selected = i;
    finish(i === q.answer ? 'correct' : 'wrong', i === q.answer ? [] : q.itemIds);
  }

  function submitTyped(e?: Event) {
    e?.preventDefault();
    if (answered || !('answers' in q) || !value.trim()) return;
    const v = gradeTyped(value, q.answers);
    finish(v, v === 'correct' ? [] : q.itemIds);
  }

  function submitReorder() {
    if (answered || q.kind !== 'reorder') return;
    const v = gradeTyped(picked.map((i) => q.tokens[i]).join(' '), [q.answer]);
    finish(v === 'close' ? 'correct' : v, v === 'wrong' ? q.itemIds : []);
  }

  function tapRight(j: number) {
    if (answered || q.kind !== 'match' || selLeft < 0 || matched.includes(j)) return;
    if (selLeft === j) {
      matched = [...matched, j];
      selLeft = -1;
      if (matched.length === q.pairs.length) finish(missCount === 0 ? 'correct' : missCount === 1 ? 'close' : 'wrong', [...new Set(missIds)]);
    } else {
      missCount += 1;
      missIds = [...missIds, q.pairs[selLeft].itemId, q.pairs[j].itemId];
      flash = j;
      setTimeout(() => (flash = -1), 400);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (answered) { if (e.key === 'Enter') { e.preventDefault(); onNext(); } return; }
    if ((q.kind === 'choice' || q.kind === 'listen-choice') && /^[1-4]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i < q.options.length) { e.preventDefault(); choose(i); }
    }
    if (e.key === 'r' && (e.target as HTMLElement)?.tagName !== 'INPUT' && 'speak' in q && q.speak) void speak(q.speak, { lang: q.lang, audio: q.audio ?? null });
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="muted kind">{KIND_LABEL[q.kind]}</div>

{#if q.kind === 'choice' || q.kind === 'listen-choice'}
  <div class="card prompt">
    {#if q.kind === 'listen-choice'}
      <div class="muted">聽音，選出正確答案</div>
      <SpeakButton text={q.speak ?? ''} lang={q.lang} audio={q.audio ?? null} size="lg" label="再聽一次" />
    {:else}
      <div class="ptext" lang={q.promptForeign ? flang : undefined}>{q.prompt}</div>
    {/if}
  </div>
  <div class="options">
    {#each q.options as o, i (o.text)}
      <button class="opt" class:right={answered && i === q.answer} class:wrong={answered && i === selected && i !== q.answer}
        disabled={answered} onclick={() => choose(i)} lang={o.foreign ? flang : undefined}>
        <span class="muted num">{i + 1}</span> <span class:foreign={o.foreign}>{o.text}</span>
      </button>
    {/each}
  </div>

{:else if q.kind === 'match'}
  <div class="muted" style="margin-bottom: 8px">先點左邊，再點右邊對應的答案</div>
  <div class="match">
    <div class="col">
      {#each q.pairs as p, i (p.itemId)}
        <button class="opt" class:sel={selLeft === i} class:right={matched.includes(i)} disabled={matched.includes(i) || answered}
          onclick={() => (selLeft = i)} lang={flang}><span class="foreign">{p.left}</span></button>
      {/each}
    </div>
    <div class="col">
      {#each q.rightOrder as j (j)}
        <button class="opt" class:right={matched.includes(j)} class:wrong={flash === j} disabled={matched.includes(j) || answered}
          onclick={() => tapRight(j)}>{q.pairs[j].right}</button>
      {/each}
    </div>
  </div>

{:else if q.kind === 'reorder'}
  <div class="card prompt">
    <div class="muted">把詞塊排成正確的句子</div>
    <div class="ptext small">{q.prompt}</div>
  </div>
  <div class="line" lang={flang}>
    {#each picked as i, k (i)}
      <button class="chip" disabled={answered} onclick={() => (picked = picked.filter((_, x) => x !== k))}>{q.tokens[i]}</button>
    {:else}
      <span class="muted">點下方詞塊</span>
    {/each}
  </div>
  <div class="bank" lang={flang}>
    {#each q.tokens as t, i (i)}
      <button class="chip" disabled={answered || picked.includes(i)} onclick={() => (picked = [...picked, i])}>{t}</button>
    {/each}
  </div>
  {#if !answered}
    <button class="btn primary big" disabled={picked.length !== q.tokens.length} onclick={submitReorder}>送出</button>
  {/if}

{:else}
  <div class="card prompt">
    {#if q.kind === 'dictation'}
      <div class="muted">聽音，打出你聽到的內容</div>
      <SpeakButton text={q.speak ?? ''} lang={q.lang} audio={q.audio ?? null} size="lg" label="再聽一次" />
    {:else}
      <div class="muted">{q.kind === 'spell' ? '用' + (q.lang === 'ko' ? '韓語' : '葡萄牙語') + '寫出' : q.kind === 'compose' ? '拼合成一個音節' : '填入空格'}</div>
      <div class="ptext" class:small={q.kind === 'fill'} lang={q.promptForeign ? flang : undefined}>{q.prompt}</div>
    {/if}
  </div>
  <form onsubmit={submitTyped}>
    <input bind:this={inputEl} bind:value class="answer" lang={flang} disabled={answered} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="輸入答案" />
    {#if !answered}
      {#if q.lang === 'ko'}
        <HangulKeyboard {value} onchange={(v) => (value = v)} />
      {:else}
        <AccentBar onpick={(ch) => { value += ch; inputEl?.focus(); }} />
      {/if}
      <button class="btn primary big" type="submit" style="margin-top: 12px" disabled={!value.trim()}>送出</button>
    {/if}
  </form>
{/if}

{#if answered}
  <div class="feedback {verdict}">
    <strong>{VERDICT_LABEL[verdict]}</strong>
    <div lang={flang}>正解：{q.correctText}</div>
  </div>
  <button class="btn primary big" onclick={onNext}>{isLast ? '看結果' : '下一題'}（Enter）</button>
{/if}

<style>
  .kind { font-size: 0.85rem; margin-bottom: 6px; }
  .prompt { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 16px; margin-bottom: 12px; }
  .ptext { font-size: 3rem; font-weight: 600; line-height: 1.2; word-break: break-word; }
  .ptext.small { font-size: 1.4rem; }
  .options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .opt { border: 1px solid var(--border); background: var(--surface); border-radius: 12px; padding: 12px; min-height: 60px; font-size: 1.05rem; text-align: center; }
  .opt .foreign { font-size: 1.6rem; }
  .opt .num { font-size: 0.75rem; }
  .opt.sel { border-color: var(--primary); background: var(--primary-soft); }
  .opt.right { border-color: #16a34a; background: color-mix(in srgb, #16a34a 18%, transparent); opacity: 1; }
  .opt.wrong { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 15%, transparent); }
  .match { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .col { display: flex; flex-direction: column; gap: 8px; }
  .line { min-height: 56px; border-bottom: 2px solid var(--border); display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 0; margin-bottom: 12px; }
  .bank { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
  .chip { border: 1px solid var(--border); background: var(--surface); border-radius: 8px; padding: 8px 12px; font-size: 1.1rem; min-height: 40px; }
  .chip:disabled { opacity: 0.35; }
  .answer { width: 100%; font: inherit; font-size: 1.5rem; text-align: center; padding: 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: inherit; }
  .feedback { margin: 16px 0 12px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border); }
  .feedback.correct { border-color: #16a34a; background: color-mix(in srgb, #16a34a 14%, transparent); }
  .feedback.close { border-color: #d97706; background: color-mix(in srgb, #d97706 14%, transparent); }
  .feedback.wrong { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
</style>
