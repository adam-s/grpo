<script lang="ts">
  /**
   * PlaybackBar — fixed bottom control for `featuredStep`. Play/pause/reset
   * plus prev/next walk the detail-step schedule from `grpoData`, so every
   * embedded matrix across every section retints in sync as training advances.
   */
  import { onMount, onDestroy } from 'svelte';
  import { featuredStep, pipelinePlaying, detailSteps } from '../stores/grpo';

  const FINAL_STEP = 500;

  let steps = $state<number[]>([]);
  const unsubSteps = detailSteps.subscribe((s) => { steps = s; });

  let cur = $state(0);
  const unsubCur = featuredStep.subscribe((v) => { cur = v; });

  let playing = $state(false);
  const unsubPlay = pipelinePlaying.subscribe((v) => { playing = v; });

  const fmtStep = (n: number) => String(n).padStart(3, ' ');

  function nearestIdx(v: number): number {
    if (!steps.length) return 0;
    let best = 0;
    let bestD = Math.abs(steps[0] - v);
    for (let i = 1; i < steps.length; i++) {
      const d = Math.abs(steps[i] - v);
      if (d < bestD) { best = i; bestD = d; }
    }
    return best;
  }

  function next() {
    if (!steps.length) return;
    const nxt = steps.find((s) => s > cur);
    if (nxt != null) featuredStep.set(nxt);
  }
  function prev() {
    if (!steps.length) return;
    let prv: number | null = null;
    for (const s of steps) {
      if (s < cur) prv = s;
      else break;
    }
    if (prv != null) featuredStep.set(prv);
  }
  function togglePlay() {
    // If we're already at the last detail step, restart from 0 on play.
    if (!playing && steps.length && cur >= steps[steps.length - 1]) {
      featuredStep.set(steps[0] ?? 0);
    }
    pipelinePlaying.update((p) => !p);
  }
  function reset() {
    pipelinePlaying.set(false);
    featuredStep.set(steps[0] ?? 0);
  }

  function isTypingTarget(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return el.isContentEditable;
  }

  function onKey(e: KeyboardEvent) {
    if (isTypingTarget(e.target)) return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
  }

  onMount(() => { window.addEventListener('keydown', onKey); });
  onDestroy(() => {
    window.removeEventListener('keydown', onKey);
    unsubSteps();
    unsubCur();
    unsubPlay();
  });

  let progressPct = $derived(
    steps.length > 1
      ? (nearestIdx(cur) / (steps.length - 1)) * 100
      : 0,
  );
  let atStart = $derived(!steps.length || cur <= steps[0]);
  let atEnd = $derived(!steps.length || cur >= steps[steps.length - 1]);
</script>

<div class="bar" role="toolbar" aria-label="Training playback">
  <div class="controls">
    <button class="btn" onclick={reset} title="Reset to step 0" aria-label="Reset">
      <span class="glyph">⏮</span>
      <span class="lbl">Reset</span>
    </button>
    <button class="btn primary" onclick={togglePlay}
      title={playing ? 'Pause (Space)' : 'Play (Space)'}
      aria-label={playing ? 'Pause' : 'Play'}
      aria-pressed={playing}>
      <span class="glyph">{playing ? '⏸' : '▶'}</span>
      <span class="lbl">{playing ? 'Pause' : 'Play'}</span>
    </button>
    <button class="btn" onclick={prev} disabled={atStart}
      title="Previous step (←)" aria-label="Previous step">
      <span class="glyph">◂</span>
    </button>
    <button class="btn" onclick={next} disabled={atEnd}
      title="Next step (→)" aria-label="Next step">
      <span class="glyph">▸</span>
    </button>
  </div>

  <div class="rail" aria-hidden="true">
    <div class="fill" style="width: {progressPct}%"></div>
  </div>

  <div class="meta">
    <span class="meta-label">step</span>
    <span class="meta-num">{fmtStep(cur)}</span>
    <span class="meta-sep">/</span>
    <span class="meta-num dim">{FINAL_STEP}</span>
  </div>
</div>

<style>
  .bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 51;
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-sm) var(--space-lg);
    background: var(--bg);
    border-top: 1px solid var(--border);
    box-shadow: var(--shadow-hairline);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    flex: 0 0 auto;
  }

  .btn {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    padding: 4px var(--space-sm);
    background: var(--bg);
    color: var(--ink-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background 120ms, color 120ms, border-color 120ms;
  }
  .btn:hover:not(:disabled) {
    background: var(--surface);
    color: var(--ink);
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn.primary[aria-pressed="true"] {
    background: rgba(31, 58, 95, 0.08);
    color: var(--accent);
    border-color: var(--accent);
  }

  .glyph {
    font-size: 12px;
    line-height: 1;
  }
  .lbl {
    text-transform: uppercase;
  }

  .rail {
    flex: 1 1 auto;
    height: 2px;
    background: var(--border);
    border-radius: 1px;
    overflow: hidden;
    min-width: 80px;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 220ms ease;
  }

  .meta {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
  .meta-label {
    color: var(--ink-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 10px;
  }
  .meta-num {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    white-space: pre;
  }
  .meta-num.dim { color: var(--ink-subtle); }
  .meta-sep { color: var(--ink-faded); }

  @media (max-width: 720px) {
    .bar {
      gap: var(--space-sm);
      padding: var(--space-xs) var(--space-sm);
    }
    .btn .lbl { display: none; }
    .rail { min-width: 40px; }
  }
</style>
