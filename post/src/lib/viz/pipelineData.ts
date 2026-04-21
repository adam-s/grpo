/**
 * pipelineData.ts
 *
 * Collates a single RawStep's data into the shape the Pipeline component needs:
 * scalar per-rollout fields (rewards, advantages) plus G×T matrices (ratios,
 * clipped, KL, and derived pessimistic-min / objective-per-token).
 *
 * Reuses extractGxT() from trajectoryData.ts for the heavy lifting.
 */

import {
  type RawStep,
  extractGxT,
} from './trajectoryData';

export type PipelineStepData = {
  step: number;
  scramble: string;
  k: number;
  G: number;
  T: number;
  rewards: number[];
  advantages: number[];
  rewardComponents: { format_tags: number; moves_parse: number; progress: number; solved: number; brevity: number }[];
  groupStats: { mean: number; std: number; clipFraction: number; klToRef: number };
  solved: boolean[];
  ratios: number[][];
  clipped: number[][];
  klPerTok: number[][];
  newLogprobs: number[][];
  refLogprobs: number[][];
  masks: number[][];
  tokenNames: string[][];
  pessimisticMin: number[][];
  objectivePerTok: number[][];
  /** Per-rollout first-token ids and vocab-wide softmax distributions at t=0. */
  tokenIds: number[][];
  firstTokProbs: {
    /** `[g][vocab]` — new-policy softmax at the first generated position. */
    theta: (number[] | undefined)[];
    /** `[g][vocab]` — reference-policy softmax at the first generated position. */
    ref: (number[] | undefined)[];
  };
  loss: number;
  probe: {
    scramble: string;
    tokens: string[];
    logprobsCurr: number[];
    logprobsPrev: number[];
    delta: number[];
  } | null;
};

const BETA_KL = 0.04;

export function buildPipelineData(step: RawStep): PipelineStepData | null {
  if (!step.completions) return null;

  const G = step.rewards.length;
  const { matrix: ratios, tokenNames, rowMeta } = extractGxT(step, 'ratios');
  const { matrix: clipped } = extractGxT(step, 'clipped');
  const { matrix: klPerTok } = extractGxT(step, 'kl_per_tok');
  const { matrix: newLogprobs } = extractGxT(step, 'new_logprobs');
  const { matrix: refLogprobs } = extractGxT(step, 'ref_logprobs');
  const { matrix: masks } = extractGxT(step, 'mask');
  const T = ratios[0]?.length ?? 0;

  const pessimisticMin: number[][] = [];
  const objectivePerTok: number[][] = [];

  for (let g = 0; g < G; g++) {
    const adv = step.advantages[g];
    const pminRow: number[] = [];
    const objRow: number[] = [];
    for (let t = 0; t < T; t++) {
      const r = ratios[g][t];
      const c = clipped[g][t];
      const kl = klPerTok[g][t];
      if (isNaN(r)) {
        pminRow.push(NaN);
        objRow.push(NaN);
      } else {
        const raw = r * adv;
        const clip = c * adv;
        const pmin = Math.min(raw, clip);
        pminRow.push(pmin);
        objRow.push(pmin - BETA_KL * kl);
      }
    }
    pessimisticMin.push(pminRow);
    objectivePerTok.push(objRow);
  }

  return {
    step: step.step,
    scramble: step.scramble,
    k: (step as Record<string, unknown>).k as number ?? 1,
    G,
    T,
    rewards: step.rewards,
    advantages: step.advantages,
    rewardComponents: step.reward_components,
    groupStats: {
      mean: step.group_stats.reward_mean,
      std: step.group_stats.reward_std,
      clipFraction: step.group_stats.clip_fraction ?? 0,
      klToRef: step.group_stats.kl_to_ref ?? 0,
    },
    solved: rowMeta.map((m) => m.solved),
    ratios,
    clipped,
    klPerTok,
    newLogprobs,
    refLogprobs,
    masks,
    tokenNames,
    pessimisticMin,
    objectivePerTok,
    tokenIds: step.completions.map((c) => c.token_ids ?? []),
    firstTokProbs: {
      theta: step.completions.map((c) => c.first_tok_new_probs),
      ref:   step.completions.map((c) => c.first_tok_ref_probs),
    },
    loss: (step as Record<string, unknown>).step_stats
      ? ((step as Record<string, unknown>).step_stats as Record<string, number>).loss ?? 0
      : 0,
    probe: (() => {
      const p = (step as Record<string, unknown>).probe as
        | { scramble: string; tokens: string[]; logprobs_curr: number[];
            logprobs_prev: number[]; delta: number[] }
        | undefined;
      if (!p) return null;
      return {
        scramble: p.scramble,
        tokens: p.tokens,
        logprobsCurr: p.logprobs_curr,
        logprobsPrev: p.logprobs_prev,
        delta: p.delta,
      };
    })(),
  };
}
