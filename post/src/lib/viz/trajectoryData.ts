/**
 * trajectoryData.ts
 *
 * Shared loader and helpers for extracting G×T matrices and step summaries
 * from trajectory.json. Used by GxTHeatmap, TrainingCursor, and downstream
 * section components.
 */

// ── Raw JSON types ────────────────────────────────────────────────────────────

export type RawCompletion = {
  text: string;
  token_ids: number[];
  token_names: string[];
  new_logprobs: number[];
  ref_logprobs: number[];
  ratios: number[];
  clipped: number[];
  kl_per_tok: number[];
  mask: number[];
  first_tok_new_probs?: number[];
  first_tok_ref_probs?: number[];
};

export type RolloutPreview = {
  text_preview: string;
  n_tokens: number;
  solved: boolean;
};

export type RawStep = {
  step: number;
  scramble: string;
  tier: 'detail' | 'summary';
  rewards: number[];
  advantages: number[];
  reward_components: {
    format_tags: number;
    moves_parse: number;
    progress: number;
    solved: number;
    brevity: number;
  }[];
  group_stats: {
    reward_mean: number;
    reward_std: number;
    clip_fraction?: number;
    kl_to_ref?: number;
  };
  completions?: RawCompletion[];
  rollout_previews?: RolloutPreview[];
  probe?: {
    scramble: string;
    tokens: string[];
    logprobs_curr: number[];
    logprobs_prev: number[];
    delta: number[];
  };
};

// ── Cached singleton fetch ────────────────────────────────────────────────────

let _trajCache: RawStep[] | null = null;

export async function loadTrajectory(): Promise<RawStep[]> {
  if (_trajCache) return _trajCache;
  const resp = await fetch(`${import.meta.env.BASE_URL}toy/trajectory.json`);
  if (!resp.ok) throw new Error(`trajectory.json: ${resp.status}`);
  _trajCache = (await resp.json()) as RawStep[];
  return _trajCache;
}

// ── Step helpers ──────────────────────────────────────────────────────────────

/** All step numbers in the trajectory */
export function allStepNumbers(traj: RawStep[]): number[] {
  return traj.map((s) => s.step);
}

/** Only the steps that have full completion-level detail */
export function detailStepNumbers(traj: RawStep[]): number[] {
  return traj.filter((s) => s.tier === 'detail' && s.completions).map((s) => s.step);
}

export function getStep(traj: RawStep[], stepId: number): RawStep | undefined {
  return traj.find((s) => s.step === stepId);
}

// ── G×T matrix extractors ────────────────────────────────────────────────────

export type GxTField = 'ratios' | 'kl_per_tok' | 'new_logprobs' | 'ref_logprobs' | 'clipped' | 'mask';

/**
 * Extract a G×T matrix for a given per-token field from a detail step.
 * Rows = rollouts (G), columns = token positions (T, padded to the max
 * across rollouts). Positions beyond a rollout's real length are NaN.
 */
export function extractGxT(
  step: RawStep,
  field: GxTField,
): { matrix: number[][]; tokenNames: string[][]; rowMeta: RowMeta[] } {
  if (!step.completions) {
    throw new Error(`step ${step.step} has no completions`);
  }

  const G = step.completions.length;

  // Build each row: only real (masked) positions
  const rows = step.completions.map((c) => {
    const raw = (c as Record<string, unknown>)[field] as number[];
    if (!raw) return { values: [] as number[], names: [] as string[] };
    const values: number[] = [];
    const names: string[] = [];
    c.mask.forEach((m, t) => {
      if (m > 0) {
        values.push(raw[t] ?? NaN);
        names.push(c.token_names?.[t] ?? `#${c.token_ids?.[t] ?? t}`);
      }
    });
    return { values, names };
  });

  const T = Math.max(...rows.map((r) => r.values.length));

  const matrix = rows.map((r) => {
    const padded = [...r.values];
    while (padded.length < T) padded.push(NaN);
    return padded;
  });

  const tokenNames = rows.map((r) => {
    const padded = [...r.names];
    while (padded.length < T) padded.push('');
    return padded;
  });

  const rowMeta: RowMeta[] = step.completions.map((_, g) => ({
    g,
    reward: step.rewards[g],
    advantage: step.advantages[g],
    solved: step.rewards[g] > 1.9,
  }));

  return { matrix, tokenNames, rowMeta };
}

export type RowMeta = {
  g: number;
  reward: number;
  advantage: number;
  solved: boolean;
};

// ── Summary stats across all steps ──────────────────────────────────────────

export type StepSummary = {
  step: number;
  rewardMean: number;
  rewardStd: number;
  solvedFraction: number;
  clipFraction: number | null;
  klToRef: number | null;
  hasDetail: boolean;
};

export function buildStepSummaries(traj: RawStep[]): StepSummary[] {
  return traj.map((s) => {
    const G = s.rewards.length;
    const solvedCount = s.rewards.filter((r) => r > 1.9).length;
    return {
      step: s.step,
      rewardMean: s.group_stats.reward_mean,
      rewardStd: s.group_stats.reward_std,
      solvedFraction: G > 0 ? solvedCount / G : 0,
      clipFraction: s.group_stats.clip_fraction ?? null,
      klToRef: s.group_stats.kl_to_ref ?? null,
      hasDetail: s.tier === 'detail' && !!s.completions,
    };
  });
}
