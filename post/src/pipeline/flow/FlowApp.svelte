<script lang="ts">
  /**
   * FlowApp — the GRPO data-flow view.
   *
   * One authoritative store (grpo-flow.ts) drives every column. All 11 ops
   * are visible at once in a horizontally scrollable stage; a Sankey overlay
   * draws curved arrows between them.
   */
  import { featuredStep } from '../../lib/stores/grpo';
  import { grpoData, focus } from '../../lib/stores/grpo-flow';
  import FlowStage from './FlowStage.svelte';
  import FocusCard from './FocusCard.svelte';

  let data = $derived($grpoData);
  let f = $derived($focus);
</script>

<div class="page">
  <header class="topbar">
    <a href="#/pipeline" class="back">← Pipeline</a>
    <span class="title">GRPO — data flow across the 11 ops</span>
    <span class="subtitle">hover any cell to re-hero a rollout × token · scrub training step to watch it evolve</span>
    <div class="spacer"></div>
    <div class="cg">
      <span class="cl">Step</span>
      <button class="cb" onclick={() => { $featuredStep = Math.max(0, $featuredStep - 50); }} title="−50">◂◂</button>
      <button class="cb" onclick={() => { $featuredStep = Math.max(0, $featuredStep - 5); }} title="−5">◂</button>
      <span class="cn">{$featuredStep}</span>
      <button class="cb" onclick={() => { $featuredStep = Math.min(499, $featuredStep + 5); }} title="+5">▸</button>
      <button class="cb" onclick={() => { $featuredStep = Math.min(499, $featuredStep + 50); }} title="+50">▸▸</button>
    </div>
    {#if data}
      <span class="meta">{data.scramble} · k={data.k} · loss={data.loss.toFixed(4)}</span>
    {/if}
  </header>

  <div class="body">
    <FlowStage />
    <aside class="side">
      <FocusCard />
    </aside>
  </div>
</div>

<style>
  .page {
    width: 100vw; height: 100vh;
    background: #0a0a0a;
    display: flex; flex-direction: column;
    --font-mono: 'JetBrains Mono', monospace;
    --font-serif: 'Source Serif Pro', Georgia, serif;
  }
  .topbar {
    display: flex; align-items: center; gap: 16px;
    padding: 8px 16px; background: #111; border-bottom: 1px solid #1a1a1a;
    flex: 0 0 auto;
  }
  .back { color: #8ab4f8; font-size: 11px; text-decoration: none; }
  .title { font-family: var(--font-serif); font-weight: 700; color: #ddd; font-size: 13px; }
  .subtitle { font-family: var(--font-mono); font-size: 10px; color: #666; }
  .spacer { flex: 1; }
  .cg { display: flex; align-items: center; gap: 4px; }
  .cl { font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; margin-right: 4px; }
  .cb { padding: 2px 7px; border: 1px solid #333; border-radius: 3px; background: #1a1a1a; color: #bbb; font-family: var(--font-mono); font-size: 10px; cursor: pointer; }
  .cb:hover { background: #222; color: #ddd; }
  .cn { font-family: var(--font-mono); font-size: 11px; color: #888; min-width: 32px; text-align: center; }
  .meta { font-family: var(--font-mono); font-size: 9px; color: #555; }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 0;
  }
  .side {
    flex: 0 0 auto;
    padding: 16px;
    background: #0d0d0d;
    border-left: 1px solid #1a1a1a;
    overflow-y: auto;
  }
</style>
