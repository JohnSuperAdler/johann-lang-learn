<script lang="ts">
  import { backupFileName, exportData, importData, parseBackup, type Backup } from '../lib/backup';
  import { clearAll } from '../lib/db';
  import { promptInstall, pwa } from '../lib/pwa.svelte';
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

  async function doExport() {
    const data = await exportData();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = backupFileName();
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message = `已匯出 ${data.cards.length} 張卡片、${data.exams.length} 筆考試紀錄、${data.days.length} 天的統計。`;
  }

  let pending = $state<Backup | null>(null);
  let importError = $state('');
  async function pickFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    pending = null; importError = ''; message = '';
    if (!file) return;
    try { pending = parseBackup(await file.text()); }
    catch (err) { importError = err instanceof Error ? err.message : String(err); }
  }
  async function confirmImport() {
    if (!pending) return;
    const b = pending;
    try {
      await importData(b);
      message = `匯入完成：${b.cards.length} 張卡片、${b.exams.length} 筆考試紀錄、${b.days.length} 天的統計。`;
    } catch (err) { importError = `匯入失敗：${err instanceof Error ? err.message : String(err)}`; }
    pending = null;
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
    <label class="row" style="justify-content: space-between">
      <span>依序解鎖單元<br /><span class="muted" style="font-size: 0.85rem">開啟後，必修單元要先通過前置單元的考試才能進入；選修單元不受限。</span></span>
      <input type="checkbox" bind:checked={settings.enforceLocks} onchange={saveSettings} />
    </label>
  </section>

  <section class="card stack">
    <h3>安裝與離線</h3>
    {#if !pwa.supported || !pwa.secure}
      <p class="muted" style="margin: 0">目前的開啟方式無法離線使用或安裝。需要透過 https 網址（部署後）或在本機用 localhost 開啟。</p>
    {:else}
      <p style="margin: 0">{pwa.offlineReady ? '✓ 已可離線使用：程式與全部教材已存在這台裝置。' : '離線資料準備中，稍後重新整理本頁即可確認。'}</p>
      {#if pwa.installed}
        <p class="muted" style="margin: 0">已安裝為應用程式。</p>
      {:else if pwa.installable}
        <button class="btn primary" onclick={promptInstall}>安裝到這台裝置</button>
      {:else}
        <p class="muted" style="margin: 0">安裝方式：Android Chrome 選單 →「加到主畫面」；iPhone Safari 分享鍵 →「加入主畫面」；電腦 Chrome／Edge 網址列右側的安裝圖示。</p>
      {/if}
    {/if}
    <p class="muted" style="margin: 0; font-size: 0.85rem">語音合成由裝置提供，離線時是否能發音取決於裝置是否已下載該語言的語音。</p>
  </section>

  <section class="card stack">
    <h3>資料</h3>
    <p class="muted" style="margin: 0">學習紀錄只存在這台裝置的瀏覽器裡。匯出成檔案可以備份，或搬到另一台裝置匯入。雲端同步在 S11 加入。</p>
    <div class="row" style="flex-wrap: wrap">
      <button class="btn primary" onclick={doExport}>匯出備份檔</button>
      <label class="btn">匯入備份檔<input type="file" accept="application/json,.json" onchange={pickFile} hidden /></label>
    </div>
    {#if importError}<p class="warn" style="margin: 0">{importError}</p>{/if}
    {#if pending}
      <div class="warn stack">
        <span>備份檔內容：{pending.cards.length} 張卡片、{pending.exams.length} 筆考試紀錄、{pending.days.length} 天的統計{pending.exportedAt ? `（匯出於 ${pending.exportedAt.slice(0, 10)}）` : ''}。<br />
          匯入會<strong>取代</strong>這台裝置目前的全部學習紀錄與設定，無法復原。</span>
        <div class="row">
          <button class="btn" style="color: var(--danger)" onclick={confirmImport}>確認匯入並取代</button>
          <button class="btn" onclick={() => (pending = null)}>取消</button>
        </div>
      </div>
    {/if}
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
