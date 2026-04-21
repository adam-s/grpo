<script lang="ts">
  import { grpoData, focus } from '../../../lib/stores/grpo-flow';
  import MatrixSlab from '../../MatrixSlab.svelte';
  import { fmt, MAX_VISIBLE_T, tokCols, useFlowTheme } from '../flow-utils';

  const theme = useFlowTheme();
  let data = $derived($grpoData);
  let f = $derived($focus);
  let G = $derived(data?.G ?? 0);
  let T = $derived(Math.min(data?.T ?? 0, MAX_VISIBLE_T));
  let rows = $derived(data
    ? Array.from({ length: G }, (_, g) => ({
        lbl: `g=${g}`,
        cells: Array.from({ length: T }, (_, t) => fmt(data.clipped[g][t], 3)) as (string | number)[],
      }))
    : []);
  let cols = $derived(data ? tokCols(data.tokenNames[f.g] ?? [], T, false, 38) : []);
  let W = $derived(36 + T * 38);
  let H = $derived(16 + 22 + G * 20 + 6);

  function onHover(r: number | null, c: number | null) {
    if (r !== null && c !== null) focus.set({ g: r, t: c });
  }

  function cellColor(_raw: string | number, r: number, c: number): string | undefined {
    if (!data) return undefined;
    const was = Math.abs(data.ratios[r][c] - data.clipped[r][c]) > 1e-6;
    return was ? theme.clipMarker : undefined;
  }
</script>

<div class="col">
  <svg width={W} height={H} viewBox="0 0 {W} {H}" preserveAspectRatio="xMinYMin meet">
    {#if data}
      <MatrixSlab
        slabId="clipped"
        title="clip(ρ)"
        cols={cols}
        rows={rows}
        rowLblW={36}
        cellW={38}
        focusRow={f.g}
        focusCol={f.t}
        tint="#c46daf"
        {cellColor}
        onCellHover={onHover}
      />
    {/if}
  </svg>
  {#if data}
    <div class="note">
      {(data.groupStats.clipFraction * 100).toFixed(1)}% clipped
    </div>
  {/if}
</div>

<style>
  .col { flex: 0 0 auto; }
  svg { display: block; width: auto; height: auto; }
  .note {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; color: #c46daf; padding: 2px 8px; text-align: center;
  }
</style>
