<script lang="ts">
  /**
   * OpGrid — renders a chosen subset of the 14 GRPO op cards in a 12-column grid.
   *
   * Used by:
   *   - `GridStage` for the full 14-op overview (all numbers),
   *   - per-section embeds in `/src/sections/*.svelte` (a focused subset).
   *
   * Splines are drawn by the page-level `<PipelineArrows />` overlay (reads the
   * shared `hoveredCard` store). OpGrid only owns the cards' DOM + the source
   * highlight class — it doesn't draw arrows itself anymore.
   */
  import { setContext, untrack } from 'svelte';
  import { OPS, opByNum } from './ops';
  import { FLOW_THEME_KEY, DARK_THEME, LIGHT_THEME, type FlowTheme } from '../flow/flow-utils';
  import { hoveredCard } from '../../lib/stores/pipeline-arrows';

  type Theme = 'dark' | 'light';

  type Props = {
    /** List of op numbers (1–14) to render, in order. */
    ops: number[];
    /** CSS `grid-template-columns` count for overview/span layout. Defaults to 12. */
    gridCols?: number;
    /** Compact card padding + smaller header, for dense embeds. */
    compact?: boolean;
    /** If set, grid fills parent height split into N equal rows (overview mode). */
    rows?: number;
    /**
     * If set, uses a uniform row-layout: each card takes one cell of an
     * N-column grid (no `span` applied), lone trailing cards span the row.
     * Best for per-section embeds. Mutually exclusive with `gridCols`/`rows`.
     */
    perRow?: number;
    /** Color theme for the panel + embedded columns. Defaults to 'dark'. */
    theme?: Theme;
  };

  let {
    ops: opNums,
    gridCols = 12,
    compact = false,
    rows: rowCount,
    perRow,
    theme = 'dark',
  }: Props = $props();

  // Theme is static per OpGrid instance — resolve once at setup and publish
  // the palette through context so descendant columns + MatrixSlab inherit it.
  const themeTokens: FlowTheme = untrack(() =>
    theme === 'light' ? LIGHT_THEME : DARK_THEME,
  );
  setContext(FLOW_THEME_KEY, themeTokens);

  let renderedOps = $derived(
    opNums.map(opByNum).filter((o): o is NonNullable<ReturnType<typeof opByNum>> => !!o),
  );

  let hovered = $state<number | null>(null);

  // Mirror hover into the shared store so the page-level `PipelineArrows`
  // overlay can trace splines. Use explicit event handlers so a mouseenter on
  // another grid landing before our mouseleave can't race and stomp the store.
  function onEnter(num: number): void {
    hovered = num;
    hoveredCard.set(num);
  }
  function onLeave(num: number): void {
    hovered = null;
    hoveredCard.update((cur: number | null) => (cur === num ? null : cur));
  }

  function sourceIsHighlit(num: number): boolean {
    const h = $hoveredCard;
    if (h == null) return false;
    return !!OPS.find((o) => o.num === h)?.sources.includes(num);
  }
</script>

<div class="stage" class:light={theme === 'light'} class:dark={theme === 'dark'} class:compact class:fill={rowCount != null}>
  <div
    class="grid"
    class:fill={rowCount != null}
    class:per-row={perRow != null}
    style={perRow != null
      ? `grid-template-columns: repeat(${perRow}, minmax(0, 1fr));`
      : `grid-template-columns: repeat(${gridCols}, minmax(0, 1fr));${rowCount != null ? ` grid-template-rows: repeat(${rowCount}, minmax(0, 1fr));` : ''}`}
  >
    {#each renderedOps as op (op.id)}
      {@const C = op.Comp}
      {@const isTarget = hovered === op.num}
      {@const isSource = sourceIsHighlit(op.num)}
      <div
        class="card"
        class:target={isTarget}
        class:source={isSource}
        data-card={op.num}
        style={perRow != null ? '' : `grid-column: span ${Math.min(op.span, gridCols)};`}
        onmouseenter={() => onEnter(op.num)}
        onmouseleave={() => onLeave(op.num)}
        role="group"
        aria-label={`${op.num}. ${op.title}`}
      >
        <header class="card-head">
          <span class="card-num">{String(op.num).padStart(2, '0')}</span>
          <span class="card-sym">{op.symbol}</span>
          <span class="card-title">{op.title}</span>
          {#if op.sources.length}
            <span class="card-from">← {op.sources.join(', ')}</span>
          {/if}
        </header>
        <p class="card-formula">{op.formula}</p>
        <div class="card-body">
          <C />
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .stage {
    width: 100%;
    padding: 14px 16px;
    border-radius: 6px;
    position: relative;
    overflow: hidden;
    --font-mono: 'JetBrains Mono', monospace;
    --font-serif: 'Source Serif Pro', Georgia, serif;
  }
  .stage.dark {
    background: #0a0a0a;
    color: #ddd;
    --card-head: #8a8a90;
    --card-num: #4a4a4e;
    --card-sym: #d8d8dd;
    --card-from: #5a5a60;
    --card-formula: #6a6a70;
    --card-accent: #e6b94a;
    --card-accent-bg: rgba(230, 185, 74, 0.04);
    --card-target-border: #555;
  }
  .stage.light {
    background: transparent;
    color: var(--ink, #1a1a1a);
    padding: 0;
    --card-head: #5a5a5a;
    --card-num: #9a9a9a;
    --card-sym: #1a1a1a;
    --card-from: #9a9a9a;
    --card-formula: #5a5a5a;
    --card-accent: #1f3a5f;
    --card-accent-bg: rgba(31, 58, 95, 0.05);
    --card-target-border: #d8d2c4;
  }
  .stage.compact { padding: 10px 12px; }
  .stage.fill { height: 100%; }

  .grid {
    display: grid;
    gap: 10px 12px;
    position: relative;
    z-index: 1;
  }
  .grid.fill { height: 100%; }
  /* per-row layout: flex-wrap keeps each card at natural content width so a
     narrow G×1 matrix doesn't sit lost inside a rigid half-width frame. The
     row centers itself; `max-width: calc((100% - gap) / perRow)` caps density
     so more than `perRow` cards never share a line. */
  .grid.per-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: stretch;
    gap: 20px 24px;
  }
  .grid.per-row > .card {
    flex: 0 1 auto;
    width: max-content;
    /* min-width gives narrow G×1 matrices (reward, advantage) a card frame
       that's visually comparable to the wider G×T cards in other sections. */
    min-width: min(100%, 280px);
    max-width: min(100%, calc((100% - 24px) / 2));
  }

  .card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    transition: border-color 160ms, background 160ms;
  }
  /* Uniform outer frame for section embeds. Matrices render at natural size,
     centered inside, so cell sizes match the `/pipeline/grid` overview. */
  .grid.per-row > .card {
    padding: 14px 16px 16px;
    border-color: var(--border, #e8e4dc);
  }
  .stage.dark .grid.per-row > .card {
    border-color: #1a1a1e;
  }
  .card.source {
    border-color: var(--card-accent);
    background: var(--card-accent-bg);
  }
  .card.target { border-color: var(--card-target-border); }

  .card-head {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--card-head);
    display: flex; align-items: baseline; gap: 8px;
    white-space: nowrap;
    flex: 0 0 auto;
  }
  .card-num { color: var(--card-num); font-weight: 700; }
  .card-sym {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 13px;
    color: var(--card-sym);
  }
  .card-title { text-transform: uppercase; letter-spacing: 0.08em; }
  .card-from { margin-left: auto; color: var(--card-from); font-size: 9px; }
  .card.source .card-from,
  .card.target .card-from { color: var(--card-accent); }

  .card-formula {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 11px;
    color: var(--card-formula);
    margin: 2px 0 6px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-body {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
  }
  .card-body :global(.col) {
    width: 100%;
    min-width: 0;
    flex: 1 1 auto;
    display: block;
  }
  .card-body :global(.col > svg) {
    display: block;
    width: 100%;
    height: auto;
    max-width: 100%;
  }
  /* In per-row mode, render matrices at natural SVG size, centered inside the
     card body — so every card is the same outer frame and cell sizes match
     the `/pipeline/grid` overview regardless of how wide the card is. */
  .grid.per-row .card-body {
    align-items: center;
    justify-content: center;
  }
  .grid.per-row .card-body :global(.col) {
    width: auto;
    height: auto;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .grid.per-row .card-body :global(.col > svg) {
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 100%;
  }
  /* Hide per-column notes: they push SVG out of the card frame. */
  .card-body :global(.col > .note) { display: none; }
  .card :global(text.ms-title)  { opacity: 0; }
  .card :global(text.ms-colhdr),
  .card :global(text.ms-rowlbl) { opacity: 0.85; }
  .card :global(text.ms-cell)   { opacity: 0.95; }

  /* Mobile: collapse to 1-col, let matrices scale down to the card-body width.
     Without this, `.col` stays at the SVG's intrinsic pixel width and the
     SVG's `max-width: 100%` (relative to the unbounded `.col`) never kicks
     in — clipping the right edge of every matrix. */
  @media (max-width: 720px) {
    .grid.per-row > .card {
      min-width: 0;
      max-width: 100%;
      padding: 12px 12px 14px;
    }
    .grid.per-row .card-body :global(.col) {
      width: 100%;
      max-width: 100%;
    }
    .grid.per-row .card-body :global(.col > svg) {
      width: 100%;
      height: auto;
      max-width: 100%;
      max-height: none;
    }
  }
</style>
