<script lang="ts">
  import { grpoData, focus } from '../../../lib/stores/grpo-flow';
  import MatrixSlab from '../../MatrixSlab.svelte';
  import { fmt, matrixColor, MAX_VISIBLE_T, tokCols } from '../flow-utils';

  let data = $derived($grpoData);
  let f = $derived($focus);
  let G = $derived(data?.G ?? 0);
  let T = $derived(Math.min(data?.T ?? 0, MAX_VISIBLE_T));

  let rowsRef = $derived(data
    ? Array.from({ length: G }, (_, g) => ({
        lbl: `g=${g}`,
        cells: Array.from({ length: T }, (_, t) => fmt(data.refLogprobs[g][t], 2)) as (string | number)[],
      }))
    : []);
  let rowsKl = $derived(data
    ? Array.from({ length: G }, (_, g) => ({
        lbl: `g=${g}`,
        cells: Array.from({ length: T }, (_, t) => fmt(data.klPerTok[g][t], 4)) as (string | number)[],
      }))
    : []);
  let cols = $derived(data ? tokCols(data.tokenNames[f.g] ?? [], T, true, 40) : []);
  let colsNoLbl = $derived(data ? tokCols(data.tokenNames[f.g] ?? [], T, false, 40) : []);
  let W = $derived(36 + T * 40);
  let slabH = $derived(16 + 22 + G * 20 + 6);
  let H = $derived(slabH * 2 + 8);

  let colorRef = $derived(data
    ? matrixColor(data.refLogprobs.slice(0, G).map((r) => r.slice(0, T)), '#d67a29')
    : () => undefined);
  let colorKl = $derived(data
    ? matrixColor(data.klPerTok.slice(0, G).map((r) => r.slice(0, T)), '#d67a29')
    : () => undefined);

  function onHover(r: number | null, c: number | null) {
    if (r !== null && c !== null) focus.set({ g: r, t: c });
  }
</script>

<div class="col">
  <svg width={W} height={H} viewBox="0 0 {W} {H}" preserveAspectRatio="xMinYMin meet">
    {#if data}
      <MatrixSlab
        slabId="logref"
        title="log π_ref"
        cols={cols}
        rows={rowsRef}
        rowLblW={36}
        cellW={40}
        focusRow={f.g}
        focusCol={f.t}
        tint="#a77"
        cellColor={(raw, r, c) => colorRef(raw, r, c)}
        onCellHover={onHover}
      />
      <g transform="translate(0,{slabH + 4})">
        <MatrixSlab
          slabId="kl"
          title="KL = exp(Δ) − Δ − 1"
          cols={colsNoLbl}
          rows={rowsKl}
          rowLblW={36}
          cellW={40}
          focusRow={f.g}
          focusCol={f.t}
          tint="#d67a29"
          cellColor={(raw, r, c) => colorKl(raw, r, c)}
          onCellHover={onHover}
        />
      </g>
    {/if}
  </svg>
</div>

<style>
  .col { flex: 0 0 auto; }
  svg { display: block; width: auto; height: auto; }
</style>
