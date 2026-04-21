<script lang="ts">
  /**
   * SoftmaxBars — inline readout of the rollout's first-token softmax.
   *
   * Display is pinned to `t = 0` (first token) regardless of which focal cell
   * the user is hovering. Trajectory JSON only exports first-token distributions,
   * so this is the only softmax we can show; decoupling from focal-t prevents
   * the panel from toggling to a placeholder as the user hovers around.
   */
  import { grpoData, focus } from '../../stores/grpo-flow';
  import { fmt } from '../../../pipeline/flow/flow-utils';

  type Policy = 'theta' | 'old' | 'ref';
  type Theme = 'dark' | 'light';

  type Props = {
    policy: Policy;
    theme?: Theme;
  };

  let { policy, theme = 'light' }: Props = $props();

  let data = $derived($grpoData);
  let f = $derived($focus);

  const POLICY_COLORS: Record<Policy, string> = {
    theta: '#5b7cc5',
    old:   '#6c7a89',
    ref:   '#d67a29',
  };

  const POLICY_TITLES: Record<Policy, string> = {
    theta: 'π_θ',
    old:   'π_old',
    ref:   'π_ref',
  };

  // 'old' reuses the new-policy distribution (π_θ ≈ π_old at sampling time).
  let probs = $derived.by<number[]>(() => {
    if (!data) return [];
    const src = policy === 'ref' ? data.firstTokProbs.ref : data.firstTokProbs.theta;
    return src[f.g] ?? [];
  });

  // Softmax is always pinned to t=0 — use the token sampled at position 0,
  // not the currently-focused token.
  let chosenIdx = $derived<number | null>(data?.tokenIds[f.g]?.[0] ?? null);
  let chosenName = $derived<string>(data?.tokenNames[f.g]?.[0] ?? '');
  let chosenProb = $derived(chosenIdx != null ? (probs[chosenIdx] ?? 0) : 0);

  let entropy = $derived.by<number>(() => {
    let h = 0;
    for (const p of probs) if (p > 0) h -= p * Math.log(p);
    return h;
  });

  let color = $derived(POLICY_COLORS[policy]);
  let titleText = $derived(POLICY_TITLES[policy] + (policy === 'old' ? ' ≈ π_θ' : ''));
</script>

<div
  class="sbars"
  class:light={theme === 'light'}
  class:dark={theme === 'dark'}
  style="--acc:{color}"
>
  <span class="title" style="color:{color}">{titleText}</span>
  <span class="scope">t=0</span>
  <span class="token" style="color:{color}">{chosenName || `#${chosenIdx ?? '-'}`}</span>
  <span class="hist">
    {#if probs.length}
      {@const BAR_W = 1.5}
      {@const GAP = 0.5}
      {@const W = probs.length * (BAR_W + GAP) - GAP}
      {@const H = 20}
      <svg width={W} height={H} style="display:block;overflow:visible">
        {#each probs as p, i}
          {@const bh = Math.max(1, p * H)}
          <rect
            x={i * (BAR_W + GAP)} y={H - bh}
            width={BAR_W} height={bh}
            fill={i === chosenIdx ? color : 'var(--ink-faded)'}
            opacity={i === chosenIdx ? 1 : 0.55}
          />
        {/each}
      </svg>
    {/if}
  </span>
  <span class="stat"><span class="k">H</span><span class="v">{fmt(entropy, 2)}</span></span>
</div>

<style>
  .sbars {
    display: grid;
    grid-template-columns: 7ch 4ch minmax(0, 1fr) auto 7ch;
    column-gap: var(--space-md);
    align-items: center;
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-md);
    box-sizing: border-box;
    font-variant-numeric: tabular-nums;
  }
  .sbars.light {
    background: var(--bg);
    border: 1px solid var(--border);
    --sub: var(--ink-subtle);
  }
  .sbars.dark {
    background: #131318;
    border: 1px solid #24242a;
    --sub: #8a8a8a;
  }
  .hist {
    display: flex;
    align-items: flex-end;
  }

  @media (max-width: 720px) {
    .sbars {
      grid-template-columns: auto auto 1fr;
      row-gap: var(--space-xs);
    }
    .sbars .hist { grid-column: span 3; }
    .sbars .stat { grid-column: span 3; justify-self: end; }
  }

  .title {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    white-space: nowrap;
  }

  .scope {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--sub);
    white-space: nowrap;
  }

  .token {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stat {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-xs);
    justify-self: end;
  }
  .stat .k {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--sub);
  }
  .stat .v {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }
</style>
