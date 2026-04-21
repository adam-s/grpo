/**
 * weightsSeries.ts
 *
 * Loads `toy/weights_series.json` — a sparse dict of per-step weight snapshots
 * so the architecture heatmaps can animate as the viewer scrubs through training.
 * Falls back to the legacy single-snapshot `toy/weights.json` if the series
 * file isn't present.
 *
 * Exposes two rendering modes:
 *   - `getWeightsAt(step)`             — nearest-≤ snapshot, raw weights.
 *   - `getInterpolatedDeltaAt(step)`   — for each tensor, returns
 *       {deltaData, absMax}: the linearly-interpolated per-cell delta from
 *       the first snapshot, plus the per-tensor max|Δ| across the whole
 *       series (for fixed-scale diverging colormaps). Interpolation makes
 *       every playback tick move the colors instead of step-jumping at the
 *       snapshot boundaries; delta-from-init keeps weights that haven't
 *       moved at true zero so the viewer actually sees what the policy is
 *       learning, not the fixed pattern that was there from initialization.
 */

export type WeightEntry = { shape: number[]; data: number[] };
export type WeightsData = Record<string, WeightEntry>;

export type WeightsSeries = {
  schema: number;
  steps: number[];
  snapshots: Record<string, WeightsData>;
};

let _series: WeightsSeries | null = null;
let _legacy: WeightsData | null = null;
/** Per-tensor max|Δ| across the whole series, baseline = snapshot[steps[0]]. */
let _absMax: Record<string, number> = {};

export async function loadWeightsSeries(base: string): Promise<void> {
  try {
    const resp = await fetch(`${base}toy/weights_series.json`);
    if (resp.ok) {
      _series = (await resp.json()) as WeightsSeries;
      _absMax = computeAbsMax(_series);
      return;
    }
  } catch {
    /* fall through */
  }
  const resp = await fetch(`${base}toy/weights.json`);
  _legacy = (await resp.json()) as WeightsData;
}

function computeAbsMax(series: WeightsSeries): Record<string, number> {
  if (!series.steps.length) return {};
  const baseline = series.snapshots[String(series.steps[0])];
  if (!baseline) return {};
  const out: Record<string, number> = {};
  for (const key of Object.keys(baseline)) {
    const base = baseline[key].data;
    let m = 0;
    for (const s of series.steps) {
      const snap = series.snapshots[String(s)]?.[key];
      if (!snap) continue;
      for (let i = 0; i < base.length; i++) {
        const d = Math.abs((snap.data[i] ?? 0) - base[i]);
        if (d > m) m = d;
      }
    }
    // Tiny floor so a dead tensor (no drift) doesn't produce NaN when we
    // divide by absMax — caller still gets a zero color.
    out[key] = m > 0 ? m : 1e-9;
  }
  return out;
}

/** Pick the snapshot whose step is the greatest ≤ `step` (nearest-≤). */
export function getWeightsAt(step: number): WeightsData | null {
  if (_series) {
    const steps = _series.steps;
    if (!steps.length) return null;
    let best = steps[0];
    for (const s of steps) {
      if (s <= step && s > best) best = s;
    }
    return _series.snapshots[String(best)] ?? null;
  }
  return _legacy;
}

export function weightSeriesSteps(): number[] {
  return _series?.steps ?? [];
}

export type InterpolatedDelta = {
  /** Interpolated absolute weight values at `step`. */
  values: number[];
  /** Per-cell delta from the baseline snapshot. Same length as `values`. */
  delta: number[];
  /** Per-tensor max|Δ| over the whole series, for fixed diverging scale. */
  absMax: number;
  shape: number[];
};

/**
 * Linearly-interpolated delta-from-initial for one weight tensor at `step`.
 * Returns null if the series isn't loaded or the key is missing.
 */
export function getInterpolatedDeltaAt(key: string, step: number): InterpolatedDelta | null {
  if (!_series || !_series.steps.length) {
    const w = _legacy?.[key];
    if (!w) return null;
    return { values: w.data, delta: w.data.map(() => 0), absMax: 1e-9, shape: w.shape };
  }
  const steps = _series.steps;
  const baseline = _series.snapshots[String(steps[0])]?.[key];
  if (!baseline) return null;

  // Find bracketing snapshots (sLo, sHi) with sLo ≤ step ≤ sHi.
  const clamped = Math.max(steps[0], Math.min(steps[steps.length - 1], step));
  let loIdx = 0;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i] <= clamped) loIdx = i;
    else break;
  }
  const hiIdx = Math.min(steps.length - 1, loIdx + 1);
  const sLo = steps[loIdx];
  const sHi = steps[hiIdx];
  const frac = sHi === sLo ? 0 : (clamped - sLo) / (sHi - sLo);

  const wLo = _series.snapshots[String(sLo)]?.[key];
  const wHi = _series.snapshots[String(sHi)]?.[key];
  if (!wLo || !wHi) return null;

  const n = baseline.data.length;
  const values = new Array<number>(n);
  const delta = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const v = wLo.data[i] * (1 - frac) + wHi.data[i] * frac;
    values[i] = v;
    delta[i] = v - baseline.data[i];
  }
  return {
    values,
    delta,
    absMax: _absMax[key] ?? 1e-9,
    shape: baseline.shape,
  };
}
