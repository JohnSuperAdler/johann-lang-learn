<script lang="ts">
  // 音節拼合練習（F2.7）：選一個子音＋一個母音，顯示並播放拼出的音節。
  import SpeakButton from './SpeakButton.svelte';
  import { CHO, compose, JUNG } from '../lib/hangul';
  import { speak } from '../lib/speech.svelte';

  let cho = $state('ㅇ');
  let jung = $state('ㅏ');
  const syllable = $derived(compose([cho, jung]));

  function pick(kind: 'cho' | 'jung', j: string) {
    if (kind === 'cho') cho = j; else jung = j;
    void speak(compose([kind === 'cho' ? j : cho, kind === 'jung' ? j : jung]), { lang: 'ko' });
  }
</script>

<div class="composer" lang="ko">
  <div class="result">
    <span class="part">{cho}</span><span class="muted">＋</span><span class="part">{jung}</span><span class="muted">＝</span>
    <span class="syll">{syllable}</span>
    <SpeakButton text={syllable} lang="ko" size="sm" label="播放音節" />
  </div>
  <div class="muted label" lang="zh-Hant">子音（ㅇ 在字首不發音）</div>
  <div class="keys">
    {#each CHO as j (j)}
      <button type="button" class:on={cho === j} onclick={() => pick('cho', j)}>{j}</button>
    {/each}
  </div>
  <div class="muted label" lang="zh-Hant">母音</div>
  <div class="keys">
    {#each JUNG as j (j)}
      <button type="button" class:on={jung === j} onclick={() => pick('jung', j)}>{j}</button>
    {/each}
  </div>
</div>

<style>
  .composer { padding-top: 12px; }
  .result { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px; }
  .part { font-size: 1.8rem; }
  .syll { font-size: 3.2rem; font-weight: 600; min-width: 1.2em; text-align: center; }
  .label { font-size: 0.85rem; margin: 8px 0 4px; }
  .keys { display: flex; flex-wrap: wrap; gap: 6px; }
  .keys button { min-width: 40px; min-height: 40px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); font-size: 1.15rem; }
  .keys button.on { background: var(--primary); color: #fff; border-color: var(--primary); }
</style>
