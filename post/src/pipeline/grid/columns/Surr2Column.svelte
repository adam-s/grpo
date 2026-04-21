<script lang="ts">
  import { grpoData, focus } from '../../../lib/stores/grpo-flow';
  import MatrixSlab from '../../MatrixSlab.svelte';
  import { fmt, matrixColor, MAX_VISIBLE_T, tokCols, useFlowTheme } from '../../flow/flow-utils';

  const theme = useFlowTheme();
  let data = $derived($grpoData);
  let f = $derived($focus);
  let G = $derived(data?.G ?? 0);
  let T = $derived(Math.min(data?.T ?? 0, MAX_VISIBLE_T));

  let s2 = $derived(data
    ? data.clipped.map((row, g) => row.slice(0, T).map((c) => c * data.advantages[g]))
    : []);
  let rows = $derived(s2.map((row, g) => ({
    lbl: `g=${g}`,
    cells: row.map((v) => fmt(v, 3)) as (string | number)[],
  })));
  let cols = $derived(data ? tokCols(data.tokenNames[f.g] ?? [], T, true, 38) : []);
  let W = $derived(36 + T * 38);
  let H = $derived(16 + 22 + G * 20 + 6);

  let colorS2 = $derived(matrixColor(s2, '#c46daf', { divergent: true, theme }));

  function onHover(r: number | null, c: number | null) {
    if (r !== null && c !== null) focus.set({ g: r, t: c });
  }
</script>

<div class="col">
  <svg width={W} height={H} viewBox="0 0 {W} {H}" preserveAspectRatio="xMinYMin meet">
    {#if data}
      <MatrixSlab
        slabId="surr2"
        title="clip(ρ) · Â"
        cols={cols}
        rows={rows}
        rowLblW={36}
        cellW={38}
        focusRow={f.g}
        focusCol={f.t}
        tint="#c46daf"
        cellColor={(raw, r, c) => colorS2(raw, r, c)}
        onCellHover={onHover}
      />
    {/if}
  </svg>
</div>

<style>
  .col { flex: 0 0 auto; }
  svg { display: block; width: auto; height: auto; }
</style>
