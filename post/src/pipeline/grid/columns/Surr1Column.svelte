<script lang="ts">
  import { grpoData, focus } from '../../../lib/stores/grpo-flow';
  import MatrixSlab from '../../MatrixSlab.svelte';
  import { fmt, matrixColor, MAX_VISIBLE_T, tokCols, useFlowTheme } from '../../flow/flow-utils';

  const theme = useFlowTheme();
  let data = $derived($grpoData);
  let f = $derived($focus);
  let G = $derived(data?.G ?? 0);
  let T = $derived(Math.min(data?.T ?? 0, MAX_VISIBLE_T));

  let s1 = $derived(data
    ? data.ratios.map((row, g) => row.slice(0, T).map((r) => r * data.advantages[g]))
    : []);
  let rows = $derived(s1.map((row, g) => ({
    lbl: `g=${g}`,
    cells: row.map((v) => fmt(v, 3)) as (string | number)[],
  })));
  let cols = $derived(data ? tokCols(data.tokenNames[f.g] ?? [], T, true, 38) : []);
  let W = $derived(36 + T * 38);
  let H = $derived(16 + 22 + G * 20 + 6);

  let colorS1 = $derived(matrixColor(s1, '#8b6cc5', { divergent: true, theme }));

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
        cols={cols}
        rows={rows}
        rowLblW={36}
        cellW={38}
        focusRow={f.g}
        focusCol={f.t}
        tint="#8b6cc5"
        cellColor={(raw, r, c) => colorS1(raw, r, c)}
        onCellHover={onHover}
      />
    {/if}
  </svg>
</div>

<style>
  .col { flex: 0 0 auto; }
  svg { display: block; width: auto; height: auto; }
</style>
