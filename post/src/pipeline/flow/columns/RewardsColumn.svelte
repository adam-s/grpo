<script lang="ts">
  import { grpoData, focus } from '../../../lib/stores/grpo-flow';
  import MatrixSlab from '../../MatrixSlab.svelte';
  import { fmt, useFlowTheme } from '../flow-utils';

  const theme = useFlowTheme();
  let data = $derived($grpoData);
  let f = $derived($focus);
  let G = $derived(data?.G ?? 0);
  let H = $derived(16 + 22 + G * 20);
  let rows = $derived(data
    ? Array.from({ length: G }, (_, g) => ({
        lbl: `g=${g}`,
        cells: [fmt(data.rewards[g], 2)] as (string | number)[],
      }))
    : []);

  function onHover(r: number | null) {
    if (r !== null) focus.set({ g: r, t: f.t });
  }

  function cellColor(_raw: string | number, r: number, _c: number): string | undefined {
    if (!data) return undefined;
    const v = data.rewards[r];
    if (!isFinite(v)) return undefined;
    if (v > 1.5) return theme.rewardHigh;
    if (v < 0.4) return theme.rewardLow;
    return undefined;
  }
</script>

<div class="col">
  <svg width="140" height={H} viewBox="0 0 140 {H}" preserveAspectRatio="xMinYMin meet">
    {#if data}
      <MatrixSlab
        slabId="rewards"
        title="rᵢ  rewards"
        cols={[{ label: 'r', w: 70 }]}
        rows={rows}
        rowLblW={32}
        cellH={20}
        showValues
        focusRow={f.g}
        tint="#d6a029"
        {cellColor}
        onCellHover={onHover}
      />
    {/if}
  </svg>
  {#if data}
    <div class="note">
      μ = {fmt(data.groupStats.mean, 2)} · σ = {fmt(data.groupStats.std, 2)}
    </div>
  {/if}
</div>

<style>
  .col { flex: 0 0 auto; min-width: 150px; }
  svg { display: block; width: 100%; height: auto; }
  .note {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; color: #888; padding: 2px 8px; text-align: center;
  }
</style>
