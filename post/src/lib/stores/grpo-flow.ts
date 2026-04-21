/**
 * grpo-flow.ts — the single authoritative store for the GRPO data-flow view.
 *
 * Modeled on CNN-Explainer's `cnnStore` and Transformer-Explainer's `modelData`:
 * one `Readable<PipelineStepData | null>` derived from the `featuredStep`
 * scrubber. Every column in the flow view subscribes to this one store.
 *
 * Sliders (`clipEps`, `betaKL`) are display-only on the first pass — the
 * derived ratios/clipped/pmin/J/L are passed through from trajectory data as-is.
 * Re-deriving from logprobs under slider values is a future pass.
 */

import { derived, writable, get, type Readable, type Writable } from 'svelte/store';
import { featuredStep } from './grpo';
import { loadTrajectory, getStep, type RawStep } from '../viz/trajectoryData';
import { buildPipelineData, type PipelineStepData } from '../viz/pipelineData';

// ── Trajectory cache + resolver ─────────────────────────────────────────
const _trajP: Promise<RawStep[]> = loadTrajectory();
_trajP.catch(() => { /* surfaced by subscribers */ });

// Poke to bump the derived store when the async cache resolves.
const _trajReady = writable<boolean>(false);
_trajP.then(() => _trajReady.set(true));

/**
 * `grpoData` — the equivalent of `cnnStore`. Every column reads from this.
 *
 * Resolves `featuredStep` against the trajectory; falls back to the nearest
 * detail-tier step if the exact step has no completions.
 */
export const grpoData: Readable<PipelineStepData | null> = derived(
  [featuredStep, _trajReady],
  ([$step, $ready], set) => {
    if (!$ready) { set(null); return; }
    _trajP.then((traj) => {
      let step = getStep(traj, $step);
      if (!step?.completions) {
        const detail = traj.filter((s) => s.completions);
        if (detail.length === 0) { set(null); return; }
        step = detail.reduce((a, b) =>
          Math.abs(a.step - $step) <= Math.abs(b.step - $step) ? a : b);
      }
      set(buildPipelineData(step));
    });
  },
  null as PipelineStepData | null,
);

// ── Focus / hover ───────────────────────────────────────────────────────
export type Focus = { g: number; t: number };
export const focus: Writable<Focus> = writable({ g: 0, t: 0 });
export const hovered: Writable<Focus | null> = writable(null);

/** When grpoData reloads, clamp focus to valid bounds + default g to first-solved. */
grpoData.subscribe((d) => {
  if (!d) return;
  const f = get(focus);
  const defaultG = (() => {
    const i = d.solved.findIndex((s) => s);
    return i >= 0 ? i : 0;
  })();
  const g = Math.max(0, Math.min(d.G - 1, Number.isFinite(f.g) ? f.g : defaultG));
  const T = d.ratios[g]?.length ?? 0;
  const t = Math.max(0, Math.min(Math.max(0, T - 1), Number.isFinite(f.t) ? f.t : 0));
  // If this is the first time (both 0 and the store has never been set), pick defaultG.
  const hasReset = g === f.g && t === f.t && defaultG !== g;
  if (hasReset) focus.set({ g: defaultG, t: 0 });
  else if (g !== f.g || t !== f.t) focus.set({ g, t });
});

// ── Slider-ish knobs (display-only on the first pass) ───────────────────
export const clipEps: Writable<number> = writable(0.2);
export const betaKL: Writable<number> = writable(0.04);

// ── Color-normalization scope ───────────────────────────────────────────
// 'cell' — per-cell sign only (no gradient)
// 'row'  — normalize each row's cells within the row's min/max
// 'matrix' — normalize against the whole matrix's min/max (the default)
export type ColorScope = 'cell' | 'row' | 'matrix';
export const colorScope: Writable<ColorScope> = writable('matrix');

// ── Convenience derived: the full focused row's scalar summary ──────────
export const focusedSummary: Readable<null | {
  g: number;
  t: number;
  token: string;
  r: number;
  adv: number;
  newLp: number;
  oldLp: number;
  refLp: number;
  ratio: number;
  clipped: number;
  pmin: number;
  kl: number;
  j: number;
  loss: number;
  solved: boolean;
}> = derived([grpoData, focus], ([$d, $f]) => {
  if (!$d) return null;
  const g = $f.g, t = $f.t;
  const ratio = $d.ratios[g]?.[t] ?? NaN;
  const newLp = $d.newLogprobs[g]?.[t] ?? NaN;
  const oldLp = isFinite(ratio) && ratio > 0 ? newLp - Math.log(ratio) : NaN;
  return {
    g, t,
    token: $d.tokenNames[g]?.[t] ?? '',
    r: $d.rewards[g] ?? NaN,
    adv: $d.advantages[g] ?? NaN,
    newLp,
    oldLp,
    refLp: $d.refLogprobs[g]?.[t] ?? NaN,
    ratio,
    clipped: $d.clipped[g]?.[t] ?? NaN,
    pmin: $d.pessimisticMin[g]?.[t] ?? NaN,
    kl: $d.klPerTok[g]?.[t] ?? NaN,
    j: $d.objectivePerTok[g]?.[t] ?? NaN,
    loss: $d.loss,
    solved: $d.solved[g] ?? false,
  };
});
