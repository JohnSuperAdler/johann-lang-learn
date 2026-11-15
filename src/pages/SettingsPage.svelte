<script lang="ts">
  import { clearAll } from '../lib/db';
  import { resetSettings, saveSettings, settings } from '../lib/settings.svelte';
  import { platformHint, refreshVoices, speak, speechStatus } from '../lib/speech.svelte';
  import type { LangCode } from '../lib/types';

  let resetArmed = $state(false);
  let message = $state('');

  const SAMPLE: Record<LangCode, string> = { ko: '안녕하세요. 만나서 반갑습니다.', pt: 'Olá! Vamos jogar capoeira na roda.' };
  const LANG_NAME: Record<LangCode, string> = { ko: '韓語', pt: '葡萄牙語' };
  let testResult = $state<Partial<Record<LangCode, string>>>({});

  async function testVoice(lang: LangCode) {
    testResult[lang] = '播放中…';
    const src = await speak(SAMPLE[lang], { lang });
    testResult[lang] = src === 'none' ? '沒有可用語音' : '播放完成';
  }

  async function resetProgress() {
    if (!resetArmed) { resetArmed = true; return; }
    await clearAll();
    resetArmed = false;
    message = '學習進度已清空。';
  }
</script>

<h1>設定</h1>

<div class="stack">
  <section class="card stack">
    <h3>語音</h3>
    <label class="row" style="justify-content: space-between">
      <span>語速 <span class="muted">{settings.rate.toFixed(1)} 倍</span></span>
      <input type="range" min="0.6" max="1.2" step="0.1" bind:value={settings.rate} onchange={saveSettings} />
    </label>
    <label class="row" style="justify-content: space-between">
      <span>卡片顯示時自動發音</span>
      <input type="checkbox" bind:checked={settings.autoplay} onchange={saveSettings} />
    </label>
    {#if !speechStatus.supported}
      <p class="warn">此瀏覽器不支援語音合成（Web Speech API）。</p>
    {:else}
      {#each ['ko', 'pt'] as const as lang (lang)}
        {@const voices = speechStatus.voices[lang]}
        <div class="stack" style="gap: 6px">
          <div class="row" style="justify-content: space-between">
            <span>{LANG_NAME[lang]}聲音 <span class="muted">({voices.length} 個)</span></span>
            <button class="btn" onclick={() => testVoice(lang)} disabled={voices.length === 0}>試聽</button>
          </div>
          {#if voices.length === 0}
            <p class="warn" style="margin: 0">此裝置沒有{LANG_NAME[lang]}語音。{platformHint()}
              <button class="btn" style="margin-top: 8px" onclick={refreshVoices}>重新偵測</button></p>
          {:else}
            <select bind:value={settings.voice[lang]} onchange={saveSettings} style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: inherit; font: inherit">
              <option value={undefined}>自動（{voices[0].name}）</option>
              {#each voices as v (v.voiceURI)}
                <option value={v.voiceURI}>{v.name}（{v.lang}{v.local ? '' : '・線上'}）</option>
              {/each}
            </select>
          {/if}
          {#if testResult[lang]}<span class="muted" style="font-size: 0.9rem">{testResult[lang]}</span>{/if}
        </div>
      {/each}
    {/if}
  </section>

  <section class="card stack">
    <h3>複習與考試</h3>
    <label class="row" style="justify-content: space-between">
      <span>每日複習上限</span>
      <input type="number" min="10" max="500" step="10" bind:value={settings.dailyLimit} onchange={saveSettings} style="width: 90px" />
    </label>
    <label class="row" style="justify-content: space-between">
      <span>考試通過標準 <span class="muted">{Math.round(settings.passRate * 100)}％</span></span>
      <input type="range" min="0.5" max="1" step="0.05" bind:value={settings.passRate} onchange={saveSettings} />
    </label>
    <label class="row" style="justify-content: space-between">
      <span>換日時間（時）</span>
      <input type="number" min="0" max="12" bind:value={settings.dayCutoffHour} onchange={saveSettings} style="width: 90px" />
    </label>
  </section>

  <section class="card stack">
    <h3>資料</h3>
    <p class="muted" style="margin: 0">匯出／匯入在 S10 加入；雲端同步在 S11 加入。</p>
    <div class="row" style="flex-wrap: wrap">
      <button class="btn" onclick={resetSettings}>設定恢復預設</button>
      <button class="btn" style="color: var(--danger)" onclick={resetProgress}>
        {resetArmed ? '再按一次確認清空全部進度' : '重置學習進度'}
      </button>
      {#if resetArmed}<button class="btn" onclick={() => (resetArmed = false)}>取消</button>{/if}
    </div>
    {#if message}<p class="muted" style="margin: 0">{message}</p>{/if}
  </section>

  <p class="muted" style="text-align: center"><a href="#/stats">統計</a>・<a href="#/search">搜尋</a></p>
</div>

<style>
  .warn { background: color-mix(in srgb, var(--danger) 10%, transparent); border: 1px solid var(--danger); border-radius: 10px; padding: 10px 12px; }
</style>
