<script lang="ts">
  import { grpoData, focus } from '../../../lib/stores/grpo-flow';
  import MatrixSlab from '../../MatrixSlab.svelte';
  import { fmt, matrixColor, MAX_VISIBLE_T, tokCols } from '../flow-utils';

  let data = $derived($grpoData);
  let f = $derived($focus);
  let G = $derived(data?.G ?? 0);
  let T = $derived(Math.min(data?.T ?? 0, MAX_VISIBLE_T));

  let rowsJ = $derived(data
    ? Array.from({ length: G }, (_, g) => ({
        lbl: `g=${g}`,
        cells: Array.from({ length: T }, (_, t) => fmt(data.objectivePerTok[g][t], 3)) as (string | number)[],
      }))
    : []);
  let cols = $derived(data ? tokCols(data.tokenNames[f.g] ?? [], T, true, 42) : []);
  let W = $derived(40 + T * 42);
  let slabH = $derived(16 + 22 + G * 20 + 6);
  let colorJ = $derived(data
    ? matrixColor(data.objectivePerTok.slice(0, G).map((r) => r.slice(0, T)), '#5aad6a', { divergent: true })
    : () => undefined);

  function onHover(r: number | null, c: number | null) {
    if (r !== null && c !== null) focus.set({ g: r, t: c });
  }
</script>

<div class="col">
  <svg width={Math.max(W, 260)} height={slabH + 110} viewBox="0 0 {Math.max(W, 260)} {slabH + 110}" preserveAspectRatio="xMinYMin meet">
    {#if data}
      <MatrixSlab
        slabId="objective"
        title="Jᵢₜ = pmin − β·KL"
        cols={cols}
        rows={rowsJ}
        rowLblW={40}
        cellW={42}
        focusRow={f.g}
        focusCol={f.t}
        tint="#5aad6a"
        cellColor={(raw, r, c) => colorJ(raw, r, c)}
        onCellHover={onHover}
      />
      <!-- Big L pill -->
      <g transform="translate({Math.max(W, 260) / 2 - 70},{slabH + 16})" data-slab="loss">
        <rect x="0" y="0" width="140" height="72" rx="10"
          fill="#0e1a18" stroke="#4a9" stroke-width="1.6" />
        <text x="70" y="28" text-anchor="middle"
          style="font-family:'Source Serif Pro',serif;font-size:15px;font-style:italic;fill:#4a9">L = −mean(J · m)</text>
        <text x="70" y="56" text-anchor="middle"
          style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;fill:#fff">{fmt(data.loss, 5)}</text>
      </g>
    {/if}
  </svg>
</div>

<style>
  .col { flex: 0 0 auto; }
  svg { display: block; width: auto; height: auto; }
</style>
