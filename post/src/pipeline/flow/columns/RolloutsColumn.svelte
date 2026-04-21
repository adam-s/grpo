<script lang="ts">
  import { grpoData, focus } from '../../../lib/stores/grpo-flow';
  import MatrixSlab from '../../MatrixSlab.svelte';
  import { MAX_VISIBLE_T, tokCols } from '../flow-utils';

  let data = $derived($grpoData);
  let f = $derived($focus);
  let G = $derived(data?.G ?? 0);
  let T = $derived(Math.min(data?.T ?? 0, MAX_VISIBLE_T));
  let rows = $derived(data
    ? Array.from({ length: G }, (_, g) => ({
        lbl: `g=${g}${data.solved[g] ? ' ✓' : '  '}`,
        cells: Array.from({ length: T }, (_, t) => (data.tokenNames[g]?.[t] ?? '').slice(0, 5)),
      }))
    : []);
  let cols = $derived(data ? tokCols(data.tokenNames[f.g] ?? [], T, true, 42) : []);
  let W = $derived(44 + T * 42);
  let H = $derived(16 + 22 + G * 20);

  function onHover(r: number | null, c: number | null) {
    if (r !== null && c !== null) focus.set({ g: r, t: c });
  }
</script>

<div class="col">
  <svg width={W} height={H} viewBox="0 0 {W} {H}" preserveAspectRatio="xMinYMin meet">
    {#if data}
      <MatrixSlab
        slabId="rollouts"
        title="rollouts  G × T tokens"
        cols={cols}
        rows={rows}
        rowLblW={44}
        cellW={38}
        cellH={20}
        showValues
        focusRow={f.g}
        focusCol={f.t}
        tint="#7c5bbf"
        onCellHover={onHover}
      />
    {/if}
  </svg>
</div>

<style>
  .col { flex: 0 0 auto; }
  svg { display: block; width: auto; height: auto; }
</style>
