<script lang="ts">
  import type { LangCode } from '../lib/types';

  let {
    lang, name, learned, total, unitsPassed, unitsTotal, due, nextHref, nextLabel,
  }: {
    lang: LangCode; name: string; learned: number; total: number;
    unitsPassed: number; unitsTotal: number; due: number; nextHref: string; nextLabel: string;
  } = $props();

  const pct = $derived(total > 0 ? Math.round((learned / total) * 100) : 0);
</script>

<section class="card stack">
  <div class="row" style="justify-content: space-between">
    <h2><span class="tag {lang}">{lang === 'ko' ? '韓' : '葡'}</span> {name}</h2>
    <a class="muted" href={`#/${lang}`}>單元列表 ›</a>
  </div>
  <div class="progress" aria-label={`已學 ${learned} / ${total}`}><span style={`width:${pct}%`}></span></div>
  <div class="row muted" style="font-size: 0.9rem; justify-content: space-between; flex-wrap: wrap">
    <span>已學 {learned} / {total} 項</span>
    <span>通過 {unitsPassed} / {unitsTotal} 單元</span>
    <span>到期 {due} 項</span>
  </div>
  <a class="btn" href={nextHref}>{nextLabel}</a>
</section>
