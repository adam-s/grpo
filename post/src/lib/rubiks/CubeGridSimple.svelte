<script lang="ts">
  import { onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicInOut, linear } from 'svelte/easing';
  import Cube from './Cube.svelte';
  import ThoughtTicker from './ThoughtTicker.svelte';
  import { applyMove, type CubeState, type Color, type Move } from './cube';

  const MOVE_DURATION = 650;
  const MS_PER_CHAR = 18;
  const MIN_STEP_TEXT_MS = 1400;
  const MAX_STEP_TEXT_MS = 12000;
  const PAUSE_BEFORE = 500;
  const PAUSE_AFTER = 1500;

  type Props = {
    /** Which scramble depths to show (1 = 1-move, 2 = 2-move, 3 = 3-move). */
    depths?: readonly number[];
    cubeSize?: number;
    tickerWidth?: number;
  };
  let {
    depths = [1, 2, 3],
    cubeSize = 32,
    tickerWidth = 180,
  }: Props = $props();

  type Step = { thinking: string; moves: string[]; markers: Record<string, number> };
  type TraceRecord = { depth: number; initialState: string; steps: Step[] };

  type CubeData = {
    depth: number;
    steps: Step[];
    stepStart: number[];
    states: CubeState[];
  };

  function parseState(str: string): CubeState {
    return str.split('') as Color[];
  }

  function buildCube(rec: TraceRecord): CubeData {
    const init = parseState(rec.initialState);
    const flat: Move[] = [];
    const stepStart: number[] = [];
    let start = 0;
    for (const s of rec.steps) {
      stepStart.push(start);
      for (const m of s.moves) flat.push(m as Move);
      start += s.moves.length;
    }
    const states: CubeState[] = [init];
    for (const m of flat) states.push(applyMove(states[states.length - 1]!, m));
    return { depth: rec.depth, steps: rec.steps, stepStart, states };
  }

  function stepTextDuration(step: Step): number {
    return Math.min(
      MAX_STEP_TEXT_MS,
      Math.max(MIN_STEP_TEXT_MS, step.thinking.length * MS_PER_CHAR),
    );
  }

  let cubes = $state<CubeData[]>([]);
  let displayStates = $state<CubeState[]>([]);
  let displayMoves = $state<(Move | null)[]>([]);
  let currentStepIdx = $state<number[]>([]);

  const moveTweens: Tween<number>[] = [];
  const textTweens: Tween<number>[] = [];

  let running = true;
  let visible = $state(false);
  let rowEl: HTMLDivElement | undefined = $state();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Wait until the cube row scrolls into view (or the component is torn
  // down). Before this gate existed the auto-play ticker ran forever even
  // when the section was off-screen, driving ~140 style recalcs/sec.
  function waitUntilVisible(): Promise<void> {
    if (visible) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (!running || visible) resolve();
        else setTimeout(check, 200);
      };
      check();
    });
  }

  async function playCubeOnce(i: number) {
    const cube = cubes[i]!;
    const mt = moveTweens[i]!;
    const tt = textTweens[i]!;

    displayStates[i] = cube.states[0]!;
    displayMoves[i] = null;
    currentStepIdx[i] = 0;

    for (let si = 0; si < cube.steps.length; si++) {
      if (!running) return;
      const step = cube.steps[si]!;
      currentStepIdx[i] = si;
      tt.set(0, { duration: 0 });
      await tt.set(1, { duration: stepTextDuration(step), easing: linear });
      if (!running) return;
      const base = cube.stepStart[si]!;
      for (let mi = 0; mi < step.moves.length; mi++) {
        if (!running) return;
        mt.set(0, { duration: 0 });
        displayStates[i] = cube.states[base + mi]!;
        displayMoves[i] = step.moves[mi] as Move;
        await mt.set(1, { duration: MOVE_DURATION, easing: cubicInOut });
        if (!running) return;
        displayMoves[i] = null;
        displayStates[i] = cube.states[base + mi + 1]!;
      }
    }
  }

  async function mainLoop() {
    while (running) {
      await waitUntilVisible();
      if (!running) return;
      await sleep(PAUSE_BEFORE);
      if (!running) return;
      await Promise.all(cubes.map((_, i) => playCubeOnce(i)));
      if (!running) return;
      await sleep(PAUSE_AFTER);
    }
  }

  onMount(() => {
    let io: IntersectionObserver | null = null;
    if (rowEl && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => { for (const e of entries) visible = e.isIntersecting; },
        { rootMargin: '100px' },
      );
      io.observe(rowEl);
    } else {
      visible = true;
    }

    (async () => {
      const res = await fetch('/data/trace-moves.json');
      const records: TraceRecord[] = await res.json();
      const filtered = records
        .filter((r) => depths.includes(r.depth))
        .sort((a, b) => a.depth - b.depth);
      cubes = filtered.map(buildCube);
      for (let i = 0; i < cubes.length; i++) {
        moveTweens.push(new Tween(0, { duration: 0 }));
        textTweens.push(new Tween(0, { duration: 0 }));
      }
      displayStates = cubes.map((c) => c.states[0]!);
      displayMoves = cubes.map(() => null);
      currentStepIdx = cubes.map(() => 0);
      mainLoop();
    })();
    return () => { running = false; io?.disconnect(); };
  });
</script>

<div class="cube-row" bind:this={rowEl}>
  {#each cubes as cube, i (i)}
    <div class="cell">
      <ThoughtTicker
        text={cube.steps[currentStepIdx[i] ?? 0]?.thinking ?? ''}
        progress={textTweens[i]?.current ?? 0}
        width={tickerWidth}
      />
      {#if displayStates[i]}
        <Cube
          cubeState={displayStates[i]}
          move={displayMoves[i] ?? null}
          rotationProgress={displayMoves[i] ? (moveTweens[i]?.current ?? 0) : 0}
          size={cubeSize}
        />
      {/if}
    </div>
  {/each}
</div>

<style>
  .cube-row {
    display: flex;
    gap: var(--space-lg);
    justify-content: center;
    align-items: flex-start;
    flex-wrap: nowrap;
    width: 100%;
    overflow-x: auto;
    padding-bottom: var(--space-xs);
  }

  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }
</style>
