<script lang="ts">
  import { grpoData, focus } from '../../../lib/stores/grpo-flow';
  import MatrixSlab from '../../MatrixSlab.svelte';
  import { fmt, matrixColor, MAX_VISIBLE_T, tokCols } from '../flow-utils';

  let data = $derived($grpoData);
  let f = $derived($focus);
  let G = $derived(data?.G ?? 0);
  let T = $derived(Math.min(data?.T ?? 0, MAX_VISIBLE_T));

  let s1 = $derived(data
    ? data.ratios.map((row, g) => row.slice(0, T).map((r) => r * data.advantages[g]))
    : []);
  let s2 = $derived(data
    ? data.clipped.map((row, g) => row.slice(0, T).map((c) => c * data.advantages[g]))
    : []);

  let rowsS1 = $derived(s1.map((row, g) => ({
    lbl: `g=${g}`,
    cells: row.map((v) => fmt(v, 3)) as (string | number)[],
  })));
  let rowsS2 = $derived(s2.map((row, g) => ({
    lbl: `g=${g}`,
    cells: row.map((v) => fmt(v, 3)) as (string | number)[],
  })));
  let rowsPmin = $derived(data
    ? Array.from({ length: G }, (_, g) => ({
        lbl: `g=${g}`,
        cells: Array.from({ length: T }, (_, t) => fmt(data.pessimisticMin[g][t], 3)) as (string | number)[],
      }))
    : []);
  let cols = $derived(data ? tokCols(data.tokenNames[f.g] ?? [], T, false, 38) : []);
  let colsLbl = $derived(data ? tokCols(data.tokenNames[f.g] ?? [], T, true, 38) : []);
  let W = $derived(36 + T * 38);
  let slabH = $derived(16 + 22 + G * 20 + 6);
  let H = $derived(slabH * 3 + 12);

  let colorS1 = $derived(matrixColor(s1, '#8b6cc5', { divergent: true }));
  let colorS2 = $derived(matrixColor(s2, '#c46daf', { divergent: true }));
  let colorPmin = $derived(data
    ? matrixColor(data.pessimisticMin.slice(0, G).map((r) => r.slice(0, T)), '#c75a5a', { divergent: true })
    : () => undefined);

  function onHover(r: number | null, c: number | null) {
    if (r !== null && c !== null) focus.set({ g: r, t: c });
  }
</script>

<div class="col">
  <svg width={W} height={H} viewBox="0 0 {W} {H}" preserveAspectRatio="xMinYMin meet">
    {#if data}
      <MatrixSlab
        slabId="surr1"
        title="ρ · Â"
        cols={colsLbl}
        rows={rowsS1}
        rowLblW={36}
        cellW={38}
        focusRow={f.g}
        focusCol={f.t}
        tint="#8b6cc5"
        cellColor={(raw, r, c) => colorS1(raw, r, c)}
        onCellHover={onHover}
      />
      <g transform="translate(0,{slabH + 4})">
        <MatrixSlab
          slabId="surr2"
          title="clip(ρ) · Â"
          cols={cols}
          rows={rowsS2}
          rowLblW={36}
          cellW={38}
          focusRow={f.g}
          focusCol={f.t}
          tint="#c46daf"
          cellColor={(raw, r, c) => colorS2(raw, r, c)}
          onCellHover={onHover}
        />
      </g>
      <g transform="translate(0,{2 * slabH + 8})">
        <MatrixSlab
          slabId="pmin"
          title="pmin = min(·,·)"
          cols={cols}
          rows={rowsPmin}
          rowLblW={36}
          cellW={38}
          focusRow={f.g}
          focusCol={f.t}
          tint="#c75a5a"
          cellColor={(raw, r, c) => colorPmin(raw, r, c)}
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
