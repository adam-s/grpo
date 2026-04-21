<script lang="ts" module>
  /**
   * MatrixSlab — numeric matrix primitive for the flow view.
   *
   * Emits a single <g transform="translate(x,y)"> containing:
   *   - optional title above the grid
   *   - column labels above the grid (one per col)
   *   - row labels to the left of the grid (one per row)
   *   - a grid of cells. If `showValues`, each cell renders a number; otherwise
   *     just a color tile (for matrices bigger than ~10 cols × ~8 rows).
   *   - focus-row / focus-col highlight in gold; non-focused rows/cols dim
   *     to `dimOpacity` (default 0.3) when any focus is set
   *   - hover-per-cell: each cell fires `onCellHover(r, c)` on enter, passes
   *     `null` on leave; the parent (via the store) turns this into focus.
   *   - data-flow-anchor attrs on the slab-left and slab-right edges of every
   *     row so Sankey.svelte can anchor Bezier endpoints to specific rows by
   *     CSS selector.
   *
   * All sizing is controlled via props so the parent can place this slab at
   * known pixel coordinates and Sankey can reason about anchor positions via
   * getBoundingClientRect.
   */
  export type SlabCol = { label: string; w?: number };
  export type SlabRow = { lbl: string; cells: (number | string)[] };
  export function outerSize(opts: {
    cols: SlabCol[]; rows: SlabRow[];
    cellW?: number; cellH?: number; colLblH?: number; rowLblW?: number; titleH?: number;
  }) {
    const cellW = opts.cellW ?? 52;
    const cellH = opts.cellH ?? 20;
    const colLblH = opts.colLblH ?? 22;
    const rowLblW = opts.rowLblW ?? 40;
    const titleH = opts.titleH ?? 16;
    const w = rowLblW + opts.cols.reduce((s, c) => s + (c.w ?? cellW), 0);
    const h = titleH + colLblH + opts.rows.length * cellH;
    return { w, h, cellW, cellH, colLblH, rowLblW, titleH };
  }
</script>

<script lang="ts">
  import type { SlabCol, SlabRow } from './MatrixSlab.svelte';
  import { useFlowTheme } from './flow/flow-utils';

  const theme = useFlowTheme();

  let {
    slabId,
    x = 0, y = 0,
    title = '',
    cols,
    rows,
    focusRow = -1,
    focusCol = -1,
    cellW = 22,
    cellH = 18,
    colLblH = 22,
    rowLblW = 36,
    titleH = 16,
    tint = '#4a9',
    cellColor,
    cellFmt,
    showValues = true,
    dimOpacity = 0.35,
    onCellHover,
  }: {
    slabId?: string;
    x?: number;
    y?: number;
    title?: string;
    cols: SlabCol[];
    rows: SlabRow[];
    focusRow?: number;
    focusCol?: number;
    cellW?: number;
    cellH?: number;
    colLblH?: number;
    rowLblW?: number;
    titleH?: number;
    tint?: string;
    cellColor?: (raw: number | string, r: number, c: number) => string | undefined;
    cellFmt?: (raw: number | string, r: number, c: number) => string;
    showValues?: boolean;
    dimOpacity?: number;
    onCellHover?: (r: number | null, c: number | null) => void;
  } = $props();

  let gridW = $derived(cols.reduce((s, c) => s + (c.w ?? cellW), 0));
  let gridH = $derived(rows.length * cellH);
  let gridTop = $derived(titleH + colLblH);

  // Column X starts pre-computed once per render.
  let colXStarts = $derived((() => {
    const xs: number[] = [];
    let acc = rowLblW;
    for (const c of cols) { xs.push(acc); acc += c.w ?? cellW; }
    return xs;
  })());

  // Row emphasis: when focusRow is set, non-focused rows get dimmed.
  function rowOpacity(r: number): number {
    if (focusRow < 0) return 1;
    return r === focusRow ? 1 : dimOpacity;
  }
  function colOpacity(c: number): number {
    if (focusCol < 0) return 1;
    return c === focusCol ? 1 : dimOpacity;
  }

  function hover(r: number | null, c: number | null) {
    if (onCellHover) onCellHover(r, c);
  }
</script>

<g transform="translate({x},{y})" class="ms-root" data-slab={slabId ?? ''}>
  {#if title}
    <text x={rowLblW} y={12} class="ms-title" style="fill:{tint}">{title}</text>
  {/if}

  <!-- Frame around grid -->
  <rect
    x={rowLblW} y={gridTop}
    width={gridW} height={gridH}
    fill="none" stroke={theme.frame} stroke-width="0.8" />

  <!-- Column headers -->
  {#each cols as col, c}
    {@const cx = colXStarts[c]}
    {@const cwCur = col.w ?? cellW}
    <text x={cx + cwCur / 2} y={gridTop - 6}
      text-anchor="middle" class="ms-colhdr"
      style="fill:{c === focusCol ? theme.focusAccent : theme.headerText}; opacity:{colOpacity(c)}">{col.label}</text>
    {#if c === focusCol}
      <rect x={cx} y={gridTop}
        width={cwCur} height={gridH}
        fill={theme.focusAccent} opacity="0.07" />
    {/if}
  {/each}

  <!-- Row labels + cells -->
  {#each rows as row, r}
    {@const ry = gridTop + r * cellH}
    {@const rowFocused = r === focusRow}
    {@const rowOp = rowOpacity(r)}
    <!-- Row label -->
    <text x={rowLblW - 6} y={ry + cellH * 0.66}
      text-anchor="end" class="ms-rowlbl"
      style="fill:{rowFocused ? theme.focusAccent : theme.headerText}; font-weight:{rowFocused ? 700 : 400}; opacity:{rowOp}">{row.lbl}</text>
    {#if rowFocused}
      <rect x={rowLblW} y={ry}
        width={gridW} height={cellH}
        fill={theme.focusAccent} opacity="0.10" />
    {/if}
    <!-- Left-edge anchor point for Sankey edges coming IN to this row -->
    {#if slabId}
      <circle
        r="0.5" fill="transparent"
        cx={rowLblW} cy={ry + cellH / 2}
        data-flow-anchor="in"
        data-slab={slabId}
        data-row={r} />
      <circle
        r="0.5" fill="transparent"
        cx={rowLblW + gridW} cy={ry + cellH / 2}
        data-flow-anchor="out"
        data-slab={slabId}
        data-row={r} />
    {/if}
    {#each cols as col, c}
      {@const cx = colXStarts[c]}
      {@const cwCur = col.w ?? cellW}
      {@const raw = row.cells[c]}
      {@const tcolor = cellColor?.(raw, r, c)}
      {@const isFocusCell = rowFocused && c === focusCol}
      {@const cellOp = Math.min(rowOp, colOpacity(c))}
      <g opacity={cellOp}>
        {#if tcolor}
          <rect x={cx + 0.5} y={ry + 0.5}
            width={cwCur - 1} height={cellH - 1}
            fill={tcolor} opacity="0.9" />
        {/if}
        {#if isFocusCell}
          <rect x={cx} y={ry}
            width={cwCur} height={cellH}
            fill="none" stroke={theme.focusAccent} stroke-width="1.4" />
        {/if}
        <!-- Hover hit-area: transparent rect that drives onCellHover -->
        <rect x={cx} y={ry}
          width={cwCur} height={cellH}
          fill="transparent"
          style="cursor:crosshair"
          data-slab={slabId ?? ''}
          data-row={r}
          data-col={c}
          data-cell-hit="1"
          onmouseenter={() => hover(r, c)}
          onmouseleave={() => hover(null, null)} />
        <line x1={cx} y1={ry} x2={cx + cwCur} y2={ry}
          stroke={theme.gridLine} stroke-width="0.4" pointer-events="none" />
        <line x1={cx} y1={ry} x2={cx} y2={ry + cellH}
          stroke={theme.gridLine} stroke-width="0.4" pointer-events="none" />
        {#if showValues}
          <text x={cx + cwCur / 2} y={ry + cellH * 0.68}
            text-anchor="middle" class="ms-cell" pointer-events="none"
            style="fill:{isFocusCell ? theme.textFocus : (rowFocused ? theme.textFocused : theme.textDefault)}; font-weight:{isFocusCell ? 700 : 400}">
            {cellFmt ? cellFmt(raw, r, c) : (typeof raw === 'number' ? raw.toFixed(3) : raw)}
          </text>
        {/if}
      </g>
    {/each}
  {/each}
</g>

<style>
  .ms-title  { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  .ms-colhdr { font-family: 'JetBrains Mono', monospace; font-size: 9px; }
  .ms-rowlbl { font-family: 'JetBrains Mono', monospace; font-size: 10px; }
  .ms-cell   { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
</style>
