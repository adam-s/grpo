<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { loadWeightsSeries, getInterpolatedDeltaAt } from '../../viz/weightsSeries';
  import { featuredStep } from '../../stores/grpo';
  import { archBoxes, archArrows, viewW, viewH, type LaidOutBox } from '../../viz/modelDiagramLayout';

  let weightsLoaded = $state(false);
  const blockIdx = 0;
  let hoveredCell: { label: string; r: number; c: number; v: number; dv: number } | null = $state(null);
  let mouseX = $state(0);
  let mouseY = $state(0);
  let winW = $state(typeof window !== 'undefined' ? window.innerWidth : 9999);
  let svgEl: SVGSVGElement | undefined = $state();

  // Flip to left of cursor when the tooltip would otherwise overflow the right edge.
  const TOOLTIP_W = 280;
  let tooltipStyle = $derived(
    mouseX + TOOLTIP_W + 16 > winW
      ? `right:${winW - mouseX + 8}px; top:${mouseY - 8}px;`
      : `left:${mouseX + 12}px; top:${mouseY - 8}px;`
  );

  // RdBu is red-at-0, blue-at-1 with near-white at 0.5. We map a signed,
  // gamma-shaped magnitude of Δ/absMax into that range: positive Δ → warm,
  // negative Δ → cool, unchanged cells stay near-white. A γ=0.5 (sqrt) lift
  // pulls small deltas into visible color so scrubbing through early steps
  // shows motion instead of a blank matrix.
  const GAMMA = 0.5;
  function deltaFill(dv: number, absMax: number): string {
    const t = Math.max(-1, Math.min(1, dv / (absMax || 1e-9)));
    const signedMag = Math.sign(t) * Math.pow(Math.abs(t), GAMMA);
    return d3.interpolateRdBu(0.5 - 0.5 * signedMag);
  }

  type BoxWeights = {
    rows: number; cols: number;
    values: number[]; delta: number[];
    absMax: number;
  };
  type RenderBox = {
    box: LaidOutBox;
    w: BoxWeights | null;
    isFlat: boolean;
    dispCols: number;
    dispRows: number;
    cellW: number;
    cellH: number;
  };

  function getBoxWeights(key: string, step: number): BoxWeights | null {
    if (!weightsLoaded) return null;
    const snap = getInterpolatedDeltaAt(key, step);
    if (!snap) return null;
    const [rows, cols] = snap.shape.length === 2
      ? [snap.shape[0], snap.shape[1]]
      : [1, snap.shape[0]];
    return { rows, cols, values: snap.values, delta: snap.delta, absMax: snap.absMax };
  }

  function weightKey(boxId: string): string {
    const p = `blocks.${blockIdx}`;
    const map: Record<string, string> = {
      embed: 'embed.weight',
      wq: `${p}.attn.q.weight`, wk: `${p}.attn.k.weight`,
      wv: `${p}.attn.v.weight`, wo: `${p}.attn.o.weight`,
      gate: `${p}.ffn.gate.weight`, up: `${p}.ffn.up.weight`, down: `${p}.ffn.down.weight`,
      norm: 'final_norm.weight',
    };
    return map[boxId] ?? '';
  }

  // Pre-compute per-box render geometry once per (step, weightsLoaded). Both
  // the paint loop AND the delegated pointer handler read from this, so we
  // don't duplicate the flat/vertical/disp* logic.
  const renderBoxes = $derived.by<RenderBox[]>(() => {
    return archBoxes.map((box) => {
      const w = getBoxWeights(weightKey(box.id), $featuredStep);
      if (!w) {
        return { box, w: null, isFlat: false, dispCols: 0, dispRows: 0, cellW: 0, cellH: 0 };
      }
      const isFlat = w.rows === 1;
      const isVert = box.vertical;
      const dispCols = isVert ? 1 : (isFlat ? 16 : w.cols);
      const dispRows = isVert ? w.cols : (isFlat ? Math.ceil(w.cols / 16) : w.rows);
      return {
        box, w, isFlat,
        dispCols, dispRows,
        cellW: box.w / dispCols,
        cellH: box.h / dispRows,
      };
    });
  });

  // Delegated pointer handling: one listener on the <svg> instead of three
  // per weight cell (44k cells × 3 handlers ≈ 132k listeners avoided).
  function updateHoverFromEvent(e: PointerEvent): void {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const scaleX = viewW / rect.width;
    const scaleY = viewH / rect.height;
    const vx = (e.clientX - rect.left) * scaleX;
    const vy = (e.clientY - rect.top) * scaleY;

    for (const rb of renderBoxes) {
      const { box, w } = rb;
      if (!w) continue;
      if (vx < box.x || vx > box.x + box.w) continue;
      if (vy < box.y || vy > box.y + box.h) continue;
      const c = Math.min(rb.dispCols - 1, Math.max(0, Math.floor((vx - box.x) / rb.cellW)));
      const r = Math.min(rb.dispRows - 1, Math.max(0, Math.floor((vy - box.y) / rb.cellH)));
      const idx = rb.isFlat ? r * rb.dispCols + c : r * w.cols + c;
      if (idx < 0 || idx >= w.values.length) {
        hoveredCell = null;
        return;
      }
      hoveredCell = {
        label: box.label,
        r: rb.isFlat ? 0 : r,
        c: rb.isFlat ? idx : c,
        v: w.values[idx],
        dv: w.delta[idx],
      };
      mouseX = e.clientX;
      mouseY = e.clientY;
      return;
    }
    hoveredCell = null;
  }

  function onPointerLeave(): void {
    hoveredCell = null;
  }

  onMount(() => {
    const base = import.meta.env.BASE_URL;
    loadWeightsSeries(base).then(() => { weightsLoaded = true; });
    const onResize = () => { winW = window.innerWidth; };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });
</script>

<div class="model-diagram">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {viewW} {viewH}"
    preserveAspectRatio="xMidYMid meet"
    class="diagram-svg"
    role="img"
    aria-label="Transformer weight matrices with interactive per-cell inspection"
    onpointermove={updateHoverFromEvent}
    onpointerleave={onPointerLeave}
  >
    <defs>
      <marker id="md-arrow" viewBox="0 0 10 10" refX="9" refY="5"
        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#aaa" />
      </marker>
    </defs>

    <rect width={viewW} height={viewH} fill="var(--bg)" />

    {#each archArrows as a}
      <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
        stroke="#aaa" stroke-width="1.2" marker-end="url(#md-arrow)" opacity="0.6" />
    {/each}

    {#each renderBoxes as rb (rb.box.id)}
      {@const box = rb.box}
      {@const w = rb.w}
      <g transform="translate({box.x},{box.y})"
        data-card={box.id === 'embed' || box.id === 'norm' ? box.id : null}>
        {#if w}
          <rect x="-2" y="-2" width={box.w + 4} height={box.h + 4} rx="4"
            fill="none" stroke={box.color} stroke-width="1.4" opacity="0.85" />
          {#each { length: rb.dispRows } as _, r}
            {#each { length: rb.dispCols } as _, c}
              {@const idx = rb.isFlat ? r * rb.dispCols + c : r * w.cols + c}
              {#if idx < w.values.length}
                <rect x={c * rb.cellW} y={r * rb.cellH}
                  width={Math.max(0.5, rb.cellW - 0.4)} height={Math.max(0.5, rb.cellH - 0.4)}
                  fill={deltaFill(w.delta[idx], w.absMax)} />
              {/if}
            {/each}
          {/each}
        {:else}
          <rect x="0" y="0" width={box.w} height={box.h} rx="4"
            fill="#f5f5f5" stroke={box.color} stroke-width="1.2" opacity="0.7" />
          <text x={box.w / 2} y={box.h / 2 + 4} text-anchor="middle"
            style="font-family: var(--font-serif); font-size: 12px; font-style: italic; fill: {box.color}">…</text>
        {/if}
        <text x={box.w / 2} y={box.h + 20} text-anchor="middle" class="box-label" fill={box.color}>{box.label}</text>
        <text x={box.w / 2} y={box.h + 34} text-anchor="middle" class="box-sub" fill="var(--ink-subtle)">{box.sub}</text>
      </g>
    {/each}

  </svg>

  {#if hoveredCell}
    <div class="tooltip" style={tooltipStyle}>
      <span class="tt-key">{hoveredCell.label}[{hoveredCell.r},{hoveredCell.c}]</span>
      <span class="tt-eq">=</span>
      <span class="tt-val">{hoveredCell.v.toFixed(4)}</span>
      <span class="tt-sep">·</span>
      <span class="tt-delta" class:pos={hoveredCell.dv >= 0} class:neg={hoveredCell.dv < 0}>
        Δ {hoveredCell.dv >= 0 ? '+' : ''}{hoveredCell.dv.toFixed(4)}
      </span>
    </div>
  {/if}
</div>

<style>
  .model-diagram {
    width: 90vw;
    margin-top: var(--space-lg);
    margin-bottom: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    position: relative;
  }

  .tooltip {
    position: fixed;
    pointer-events: none;
    z-index: 200;
    display: flex;
    align-items: baseline;
    gap: 5px;
    padding: 4px 8px;
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-hairline);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    white-space: nowrap;
  }
  .tt-key { color: var(--ink-muted); }
  .tt-eq  { color: var(--ink-faded); }
  .tt-val { color: var(--ink); font-weight: 500; }
  .tt-sep { color: var(--ink-faded); }
  .tt-delta { font-weight: 500; }
  .tt-delta.pos { color: #b03030; }
  .tt-delta.neg { color: #2a5fa8; }

  .diagram-svg {
    display: block;
    width: 100%;
    height: auto;
  }

  :global(.box-label) {
    font-family: var(--font-serif);
    font-size: 13px;
    font-weight: 700;
    font-style: italic;
  }

  :global(.box-sub) {
    font-family: var(--font-mono);
    font-size: 9px;
  }
</style>
