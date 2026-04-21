<script lang="ts">
  import { grpoData, focus } from '../../../lib/stores/grpo-flow';
  import MatrixSlab from '../../MatrixSlab.svelte';
  import { fmt, matrixColor, MAX_VISIBLE_T, tokCols, useFlowTheme } from '../../flow/flow-utils';

  const theme = useFlowTheme();
  let data = $derived($grpoData);
  let f = $derived($focus);
  let G = $derived(data?.G ?? 0);
  let T = $derived(Math.min(data?.T ?? 0, MAX_VISIBLE_T));

  let rows = $derived(data
    ? Array.from({ length: G }, (_, g) => ({
        lbl: `g=${g}`,
        cells: Array.from({ length: T }, (_, t) => fmt(data.refLogprobs[g][t], 2)) as (string | number)[],
      }))
    : []);
  let cols = $derived(data ? tokCols(data.tokenNames[f.g] ?? [], T, true, 40) : []);
  let W = $derived(36 + T * 40);
  let H = $derived(16 + 22 + G * 20 + 6);

  let color = $derived(data
    ? matrixColor(data.refLogprobs.slice(0, G).map((r) => r.slice(0, T)), '#d67a29', { theme })
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
        rows={rows}
        rowLblW={36}
        cellW={40}
        focusRow={f.g}
        focusCol={f.t}
        tint="#a77"
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
