<script lang="ts">
  // 近 N 日複習量長條圖（單一數列，純 SVG）。滑過或點按長條顯示當日數字；下方另有表格檢視。
  import { niceMax } from '../lib/statsData';
  import type { DayStat } from '../lib/types';

  let { days }: { days: DayStat[] } = $props();

  const W = 600, H = 170, L = 34, R = 6, T = 8, B = 22;
  const plotW = W - L - R, plotH = H - T - B;
  const max = $derived(niceMax(Math.max(0, ...days.map((d) => d.reviewed))));
  const step = $derived(plotW / Math.max(1, days.length));
  const barW = $derived(Math.max(2, step - 2));
  const y = (v: number) => T + plotH - (v / max) * plotH;
  const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  const pct = (d: DayStat) => (d.reviewed ? `${Math.round((d.correct / d.reviewed) * 100)}％` : '—');
  /** 上緣圓角、下緣貼齊基線的長條路徑。 */
  function bar(i: number, v: number): string {
    const x = L + i * step + (step - barW) / 2, top = y(v), h = T + plotH - top, r = Math.min(4, barW / 2, h);
    return `M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + barW - r}Q${x + barW},${top} ${x + barW},${top + r}V${top + h}Z`;
  }

  let hover = $state<number | null>(null);
  const tip = $derived(hover === null ? null : days[hover] ?? null);
  const empty = $derived(days.every((d) => d.reviewed === 0));
</script>

<div class="chart" role="group" aria-label="近 {days.length} 日每日複習張數">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg viewBox="0 0 {W} {H}" width="100%" onpointerleave={() => (hover = null)}>
    {#each [0, 0.5, 1] as f (f)}
      <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} class="grid" />
      <text x={L - 6} y={y(max * f) + 4} text-anchor="end" class="axis">{Math.round(max * f)}</text>
    {/each}
    {#each days as d, i (d.date)}
      {#if d.reviewed > 0}<path d={bar(i, d.reviewed)} class="bar" class:on={hover === i} />{/if}
      {#if i % 7 === (days.length - 1) % 7}
        <text x={L + i * step + step / 2} y={H - 6} text-anchor="middle" class="axis">{md(d.date)}</text>
      {/if}
      <!-- 滑鼠與觸控的提示框；鍵盤與報讀軟體改用下方的表格檢視 -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
      <rect x={L + i * step} y={T} width={step} height={plotH} fill="transparent"
        role="img" aria-label="{md(d.date)}：複習 {d.reviewed} 張，正確率 {pct(d)}"
        onpointerenter={() => (hover = i)} onclick={() => (hover = i)} />
    {/each}
  </svg>
  {#if tip && hover !== null}
    <div class="tip" style="left: {((L + hover * step + step / 2) / W) * 100}%" class:flip={hover > days.length * 0.7} class:flop={hover < days.length * 0.3}>
      <strong>{md(tip.date)}</strong>　複習 {tip.reviewed} 張<br />
      <span class="muted">正確率 {pct(tip)}・新學 {tip.newLearned}</span>
    </div>
  {/if}
  {#if empty}<p class="none muted">這段期間還沒有複習紀錄</p>{/if}
</div>

<details>
  <summary class="muted">以表格檢視</summary>
  <table>
    <thead><tr><th>日期</th><th>複習</th><th>正確率</th><th>新學</th></tr></thead>
    <tbody>
      {#each [...days].reverse().filter((d) => d.reviewed > 0 || d.newLearned > 0) as d (d.date)}
        <tr><td>{d.date}</td><td>{d.reviewed}</td><td>{pct(d)}</td><td>{d.newLearned}</td></tr>
      {:else}
        <tr><td colspan="4" class="muted">沒有紀錄</td></tr>
      {/each}
    </tbody>
  </table>
</details>

<style>
  .chart { position: relative; }
  svg { display: block; touch-action: pan-y; }
  .grid { stroke: var(--border); stroke-width: 1; }
  .axis { fill: var(--muted); font-size: 11px; }
  .bar { fill: var(--primary); opacity: 0.85; }
  .bar.on { opacity: 1; }
  .tip {
    position: absolute; top: 0; transform: translateX(-50%); pointer-events: none; white-space: nowrap;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px;
    font-size: 0.85rem; box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
  }
  .tip.flip { transform: translateX(-90%); }
  .tip.flop { transform: translateX(-10%); }
  .none { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; pointer-events: none; }
  details { margin-top: 6px; }
  summary { cursor: pointer; font-size: 0.9rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  th, td { text-align: right; padding: 4px 6px; border-bottom: 1px solid var(--border); }
  th:first-child, td:first-child { text-align: left; }
</style>
