<script lang="ts">
  import { grpoData, focus } from '../../../lib/stores/grpo-flow';
  import MatrixSlab from '../../MatrixSlab.svelte';
  import { fmt, matrixColor, MAX_VISIBLE_T, recoverOldLp, tokCols, useFlowTheme } from '../flow-utils';

  const theme = useFlowTheme();
  let data = $derived($grpoData);
  let f = $derived($focus);
  let G = $derived(data?.G ?? 0);
  let T = $derived(Math.min(data?.T ?? 0, MAX_VISIBLE_T));

  let oldLpMatrix = $derived(data
    ? Array.from({ length: G }, (_, g) =>
        Array.from({ length: T }, (_, t) => recoverOldLp(data.newLogprobs[g][t], data.ratios[g][t])))
    : []);

  let rows = $derived(oldLpMatrix.map((row, g) => ({
    lbl: `g=${g}`,
    cells: row.map((v) => fmt(v, 2)) as (string | number)[],
  })));
  let cols = $derived(data ? tokCols(data.tokenNames[f.g] ?? [], T, false, 38) : []);
  let W = $derived(36 + T * 38);
  let H = $derived(16 + 22 + G * 20);
  let color = $derived(matrixColor(oldLpMatrix, '#888', { theme }));

  function onHover(r: number | null, c: number | null) {
    if (r !== null && c !== null) focus.set({ g: r, t: c });
  }
</script>

<div class="col">
  <svg width={W} height={H} viewBox="0 0 {W} {H}" preserveAspectRatio="xMinYMin meet">
    {#if data}
      <MatrixSlab
        slabId="logold"
        title="log π_old"
        cols={cols}
        rows={rows}
        rowLblW={36}
        cellW={38}
        focusRow={f.g}
        focusCol={f.t}
        tint="#888"
        cellColor={(raw, r, c) => color(raw, r, c)}
        onCellHover={onHover}
      />
    {/if}
  </svg>
</div>

<style>
  .col { flex: 0 0 auto; }
  svg { display: block; width: auto; height: auto; }
</style>
