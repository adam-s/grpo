import { writable, get, type Readable } from 'svelte/store';
import { loadTrajectory, detailStepNumbers } from '../viz/trajectoryData';

export const rolloutIdx = writable<number>(0);
export const hoveredCell = writable<{ g: number; t: number } | null>(null);

export const featuredStep = writable<number>(5);
export const chainStep = writable<number>(150);
export const clipEps = writable<number>(0.2);

// Pipeline hero state
export const pipelineStage = writable<number>(-1);
export const focusedRollout = writable<number | null>(null);
export const pipelinePlaying = writable<boolean>(false);

// Bidirectional equation ↔ element linking
export const hoveredFormulaPart = writable<string | null>(null);

// Detail-step schedule. The trajectory has 500 steps total but only every
// ~10th carries full per-token completions — the rest are summary-only and
// don't drive any of the in-section matrices. Playback walks the detail set
// so every tick of the playhead actually changes what the reader sees.
const _detailSteps = writable<number[]>([]);
export const detailSteps: Readable<number[]> = _detailSteps;
loadTrajectory()
  .then((t) => _detailSteps.set(detailStepNumbers(t)))
  .catch(() => { /* surfaced by other subscribers of the trajectory */ });

// Playback loop. When `pipelinePlaying` is true, advance `featuredStep` to
// the next detail step every `PLAY_INTERVAL_MS`; stop at the end of the list.
const PLAY_INTERVAL_MS = 900;
let _timer: ReturnType<typeof setInterval> | null = null;
pipelinePlaying.subscribe((playing) => {
  if (_timer) { clearInterval(_timer); _timer = null; }
  if (!playing) return;
  _timer = setInterval(() => {
    const steps = get(_detailSteps);
    if (!steps.length) return;
    const cur = get(featuredStep);
    const next = steps.find((s) => s > cur);
    if (next == null) { pipelinePlaying.set(false); return; }
    featuredStep.set(next);
  }, PLAY_INTERVAL_MS);
});
