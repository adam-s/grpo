<script lang="ts">
  /**
   * GridApp — two modes for the 11 GRPO ops.
   *
   * Overview: all 11 tiny, static, uniform — see the whole system at a glance.
   * Focus:    one op at a time, computation animates in front of the reader.
   */
  import { featuredStep } from '../../lib/stores/grpo';
  import { grpoData } from '../../lib/stores/grpo-flow';
  import GridStage from './GridStage.svelte';
  import FocusStage from './FocusStage.svelte';
  import PipelineArrows from '../../lib/components/PipelineArrows.svelte';

  let data = $derived($grpoData);
  let mode = $state<'overview' | 'focus'>('overview');
</script>

<div class="page">
  <header class="topbar">
    <a href="#/pipeline" class="back">← Pipeline</a>
    <span class="title">GRPO — 11 ops</span>
    <div class="mode-tabs" role="tablist">
      <button role="tab" aria-selected={mode === 'overview'} class="tab" class:active={mode === 'overview'} onclick={() => (mode = 'overview')}>Overview</button>
      <button role="tab" aria-selected={mode === 'focus'} class="tab" class:active={mode === 'focus'} onclick={() => (mode = 'focus')}>Focus</button>
    </div>
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
    {#if mode === 'overview'}
      <GridStage />
    {:else}
      <FocusStage />
    {/if}
  </div>
</div>

{#if mode === 'overview'}
  <PipelineArrows color="#e6b94a" />
{/if}

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
    padding: 10px 18px; background: transparent; border-bottom: 1px solid #141418;
    flex: 0 0 auto;
  }
  .back { color: #8ab4f8; font-size: 11px; text-decoration: none; }
  .title { font-family: var(--font-serif); font-weight: 700; color: #ddd; font-size: 13px; }
  .spacer { flex: 1; }

  .mode-tabs { display: flex; gap: 2px; background: #111116; padding: 2px; border-radius: 6px; border: 1px solid #1e1e22; }
  .tab {
    font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em;
    padding: 4px 12px; border-radius: 4px; border: none; background: transparent; color: #888;
    cursor: pointer;
    transition: background 120ms, color 120ms;
  }
  .tab:hover { color: #ddd; }
  .tab.active { background: #221a0b; color: #e6b94a; }

  .cg { display: flex; align-items: center; gap: 4px; }
  .cl { font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; margin-right: 4px; }
  .cb { padding: 2px 7px; border: 1px solid #222; border-radius: 3px; background: transparent; color: #bbb; font-family: var(--font-mono); font-size: 10px; cursor: pointer; }
  .cb:hover { background: #15151a; color: #ddd; }
  .cn { font-family: var(--font-mono); font-size: 11px; color: #888; min-width: 32px; text-align: center; }
  .meta { font-family: var(--font-mono); font-size: 9px; color: #555; }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 0;
  }
</style>
