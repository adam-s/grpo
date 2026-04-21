<script lang="ts">
  import { grpoData, focus } from '../../../lib/stores/grpo-flow';
  import MatrixSlab from '../../MatrixSlab.svelte';
  import { fmt, signTint, useFlowTheme } from '../flow-utils';

  const theme = useFlowTheme();
  let data = $derived($grpoData);
  let f = $derived($focus);
  let G = $derived(data?.G ?? 0);
  let H = $derived(16 + 22 + G * 20);
  let rows = $derived(data
    ? Array.from({ length: G }, (_, g) => ({
        lbl: `g=${g}`,
        cells: [fmt(data.advantages[g], 3)] as (string | number)[],
      }))
    : []);

  function onHover(r: number | null) {
    if (r !== null) focus.set({ g: r, t: f.t });
  }
</script>

<div class="col">
  <svg width="140" height={H} viewBox="0 0 140 {H}" preserveAspectRatio="xMinYMin meet">
    {#if data}
      <MatrixSlab
        slabId="advantages"
        title="Âᵢ  advantages"
        cols={[{ label: 'Â', w: 70 }]}
        rows={rows}
        rowLblW={32}
        cellH={20}
        showValues
        focusRow={f.g}
        tint="#2a7a4a"
        cellColor={(_, r) => signTint(data!.advantages[r], theme)}
        onCellHover={onHover}
      />
    {/if}
  </svg>
</div>

<style>
  .col { flex: 0 0 auto; min-width: 150px; }
  svg { display: block; width: 100%; height: auto; }
</style>
