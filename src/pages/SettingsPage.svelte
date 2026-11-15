<script lang="ts">
  import { clearAll } from '../lib/db';
  import { resetSettings, saveSettings, settings } from '../lib/settings.svelte';

  let resetArmed = $state(false);
  let message = $state('');

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
    <p class="muted" style="margin: 0">聲音選擇在 S2 加入（需裝置語音清單）。</p>
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
