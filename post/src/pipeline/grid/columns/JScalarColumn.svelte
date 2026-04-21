<script lang="ts">
  /**
   * JScalarColumn — the final scalar you call .backward() on.
   *
   * Collapses the G×T per-token objective matrix into one number via the
   * formula's double mean: 1/G Σ_i  1/|o_i| Σ_t  J[i,t]. Rollouts have
   * different valid lengths, so the inner mean is mask-weighted.
   *
   * Visually minimal: one framed value — no heatmap cells — to emphasize
   * that this is the leaf the gradient flows from.
   */
  import { grpoData } from '../../../lib/stores/grpo-flow';
  import { fmt, useFlowTheme } from '../../flow/flow-utils';

  const theme = useFlowTheme();
  let data = $derived($grpoData);

  // Length-normalized per-rollout mean, then mean across rollouts.
  let jScalar = $derived.by<number | null>(() => {
    if (!data) return null;
    const { objectivePerTok, masks, G, T } = data;
    let sumRollouts = 0;
    let validRollouts = 0;
    for (let g = 0; g < G; g++) {
      let sumTok = 0;
      let nTok = 0;
      for (let t = 0; t < T; t++) {
        const m = masks[g]?.[t] ?? 0;
        const v = objectivePerTok[g]?.[t];
        if (m && Number.isFinite(v)) {
          sumTok += v;
          nTok += 1;
        }
      }
      if (nTok > 0) {
        sumRollouts += sumTok / nTok;
        validRollouts += 1;
      }
    }
    if (validRollouts === 0) return null;
    return sumRollouts / validRollouts;
  });

  const W = 180;
  const H = 72;
</script>

<div class="col">
  <svg width={W} height={H} viewBox="0 0 {W} {H}" preserveAspectRatio="xMinYMin meet">
    {#if data && jScalar != null}
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="4"
        fill={theme.base} stroke={theme.frame} stroke-width="1" />
      <text x={W / 2} y="20" text-anchor="middle"
        style="font-family: var(--font-mono); font-size: 10px; fill: {theme.headerText};">
        J = mean over g, t
      </text>
      <text x={W / 2} y={H / 2 + 14} text-anchor="middle"
        style="font-family: var(--font-mono); font-size: 22px; fill: {theme.textFocus};">
        {fmt(jScalar, 4)}
      </text>
      <text x={W / 2} y={H - 8} text-anchor="middle"
        style="font-family: var(--font-mono); font-size: 9px; fill: {theme.headerText};">
        → .backward()
      </text>
    {/if}
  </svg>
</div>

<style>
  .col { flex: 0 0 auto; }
  svg { display: block; width: auto; height: auto; }
</style>
