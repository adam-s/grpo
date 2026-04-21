<script lang="ts">
  /**
   * GrpoView — one GRPO operation at a time, as matrix-slab data flow.
   *
   * Layout: title bar at top, one SVG canvas, step pills at bottom. For the
   * current computeStep, the canvas renders inputs (left), an arrow labeled
   * with the operation (center), and outputs (right). Values are shown as
   * actual decimal numbers inside MatrixSlab grids — you can read each one.
   *
   * Focused rollout row and focused token column are highlighted in gold so
   * a viewer can trace one value across steps.
   */
  import { onMount, onDestroy } from 'svelte';
  import { featuredStep } from '../lib/stores/grpo';
  import { loadTrajectory, getStep } from '../lib/viz/trajectoryData';
  import { buildPipelineData, type PipelineStepData } from '../lib/viz/pipelineData';
  import MatrixSlab, { outerSize, type SlabCol, type SlabRow } from './MatrixSlab.svelte';

  const BETA_KL = 0.04;

  // ── State ─────────────────────────────────────────────────────────
  let computeStep = $state(3); // default to Ratio — most numeric step
  let data: PipelineStepData | null = $state(null);
  let focusT = $state(0);
  let playing = $state(false);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const META = [
    { title: 'Forward Pass', formula: 'oᵢ ∼ π_old(·|q)',              color: '#7c5bbf' },
    { title: 'Reward',       formula: 'rᵢ = R(q, oᵢ)',                color: '#d6a029' },
    { title: 'Advantage',    formula: 'Âᵢ = (rᵢ − μ) / σ',            color: '#2a7a4a' },
    { title: 'Ratio',        formula: 'ρᵢₜ = exp(log πθ − log π_old)', color: '#5b7cc5' },
    { title: 'Clip',         formula: 'clip(ρ, 0.8, 1.2)',            color: '#c46daf' },
    { title: 'Surrogates',   formula: 'ρ·Â   and   clip(ρ)·Â',        color: '#8b6cc5' },
    { title: 'Pessimistic Min', formula: 'min(ρ·Â, clip(ρ)·Â)',       color: '#c75a5a' },
    { title: 'KL Divergence',   formula: 'KL = exp(Δ) − Δ − 1',       color: '#d67a29' },
    { title: 'Objective',    formula: 'Jᵢₜ = pmin − β·KL',            color: '#5aad6a' },
    { title: 'Loss',         formula: 'L = −mean(J · mask)',          color: '#4a9' },
    { title: 'Gradient Step',formula: 'θ ← θ − α · ∇θ L',             color: '#c46daf' },
  ];

  // Focused rollout: first solved, fallback 0.
  let focusG = $derived.by(() => {
    if (!data) return 0;
    const i = data.solved.findIndex((s) => s);
    return i >= 0 ? i : 0;
  });

  let T = $derived(data ? Math.min(data.ratios[0]?.length ?? 0, 10) : 0);
  let G = $derived(data?.G ?? 0);
  let tSafe = $derived(Math.max(0, Math.min(focusT, Math.max(0, T - 1))));

  const fmt = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d) : '—');

  function oldLp(g: number, t: number): number {
    if (!data) return NaN;
    const r = data.ratios[g][t];
    return r > 0 && isFinite(r) ? data.newLogprobs[g][t] - Math.log(r) : NaN;
  }

  // ── Data load ─────────────────────────────────────────────────────
  $effect(() => {
    const stepId = $featuredStep;
    loadTrajectory().then((traj) => {
      let step = getStep(traj, stepId);
      if (!step?.completions) {
        const detail = traj.filter((s) => s.completions);
        if (detail.length) {
          step = detail.reduce((a, b) =>
            Math.abs(a.step - stepId) <= Math.abs(b.step - stepId) ? a : b);
        }
      }
      if (step) data = buildPipelineData(step);
    });
  });

  // ── Controls ──────────────────────────────────────────────────────
  function nextStep() { computeStep = (computeStep + 1) % 11; }
  function prevStep() { computeStep = (computeStep + 10) % 11; }
  function togglePlay() {
    playing = !playing;
    if (playing) intervalId = setInterval(nextStep, 1800);
    else if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); nextStep(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); prevStep(); }
    if (e.key === ' ')          { e.preventDefault(); togglePlay(); }
  }
  onMount(() => { window.addEventListener('keydown', onKey); });
  onDestroy(() => {
    window.removeEventListener('keydown', onKey);
    if (intervalId) clearInterval(intervalId);
  });

  // ── Column helpers ────────────────────────────────────────────────
  function tokCol(t: number, label = true): SlabCol {
    if (!data) return { label: '', w: 52 };
    const tok = data.tokenNames[focusG]?.[t] ?? '';
    return { label: label ? tok.slice(0, 5) : '', w: 52 };
  }
  function makeTokCols(label = true): SlabCol[] {
    return Array.from({ length: T }, (_, t) => tokCol(t, label));
  }
  function makeRowsGx1(values: number[], lblFn: (g: number) => string, digits = 3): SlabRow[] {
    return values.map((v, g) => ({ lbl: lblFn(g), cells: [fmt(v, digits)] }));
  }
  function makeRowsGxT(matrix: number[][], lblFn: (g: number) => string, digits = 3): SlabRow[] {
    return matrix.map((row, g) => ({
      lbl: lblFn(g),
      cells: Array.from({ length: T }, (_, t) => fmt(row[t], digits)),
    }));
  }

  // Color functions
  const signColor = (x: number) =>
    !isFinite(x) ? undefined : x > 0 ? '#13281a' : x < 0 ? '#281313' : undefined;
  const ratioColor = (x: number) =>
    !isFinite(x) ? undefined : x > 1.02 ? '#13281a' : x < 0.98 ? '#281313' : undefined;
  const clippedColor = (r: number, c: number) => {
    if (!data) return undefined;
    const was = Math.abs(data.ratios[r][c] - data.clipped[r][c]) > 1e-6;
    return was ? '#2a1128' : undefined;
  };
</script>

<div class="page">
  <header class="topbar">
    <a href="#/pipeline" class="back">← Pipeline</a>
    <span class="title">GRPO · Op {computeStep + 1} of 11 — {META[computeStep].title}</span>
    <span class="formula">{META[computeStep].formula}</span>
    <div class="spacer"></div>
    <div class="cg">
      <span class="cl">Step</span>
      <button class="cb" onclick={() => { $featuredStep = Math.max(0, $featuredStep - 5); }}>◂</button>
      <span class="cn">{$featuredStep}</span>
      <button class="cb" onclick={() => { $featuredStep = Math.min(495, $featuredStep + 5); }}>▸</button>
    </div>
    {#if data}
      <span class="meta">{data.scramble} · loss={data.loss.toFixed(4)}</span>
    {/if}
  </header>

  <div class="stage">
    <svg viewBox="0 0 1400 640" preserveAspectRatio="xMidYMid meet" class="stage-svg">
      <defs>
        <marker id="gv-arrow" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#bbb" />
        </marker>
        <marker id="gv-arrow-gold" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#e6b94a" />
        </marker>
      </defs>

      {#if !data}
        <text x="700" y="320" text-anchor="middle" class="gv-mute">loading trajectory…</text>
      {:else}

      <!-- ──── STEP 1: Forward Pass  q → π_old → G×T tokens ──── -->
      {#if computeStep === 0}
        {@const promptTokens = data.prompt_tokens ?? []}
        {@const inSlab = { cols: [{ label: '', w: 120 }], rows: promptTokens.map((t) => ({ lbl: '', cells: [t] })) }}
        {@const outCols = makeTokCols(true)}
        {@const outRows = data.tokenNames.slice(0, G).map((toks, g) => ({
          lbl: `g=${g}${data.solved[g] ? ' ✓' : ''}`,
          cells: Array.from({ length: T }, (_, t) => (toks?.[t] ?? '').slice(0, 5)),
        }))}
        <MatrixSlab x={80} y={80} title="prompt q" cols={inSlab.cols} rows={inSlab.rows}
          tint="#7c5bbf" rowLblW={20} />
        {@const arrowX1 = 240}
        {@const arrowX2 = 360}
        {@const arrowY = 280}
        <line x1={arrowX1} y1={arrowY} x2={arrowX2} y2={arrowY}
          stroke="#bbb" stroke-width="1.5" marker-end="url(#gv-arrow)" />
        <text x={(arrowX1 + arrowX2) / 2} y={arrowY - 12} text-anchor="middle" class="gv-op">π_old(·|q)</text>
        <text x={(arrowX1 + arrowX2) / 2} y={arrowY + 18} text-anchor="middle" class="gv-opsub">sample G rollouts of T tokens</text>
        <MatrixSlab x={380} y={80} title="completions o (G×T)"
          cols={outCols} rows={outRows} focusRow={focusG} tint="#7c5bbf" />

      <!-- ──── STEP 2: Reward ──── -->
      {:else if computeStep === 1}
        <MatrixSlab x={80} y={80} title="rollouts (preview)"
          cols={[{ label: 'text', w: 260 }]}
          rows={Array.from({ length: G }, (_, g) => ({
            lbl: `g=${g}${data.solved[g] ? ' ✓' : ''}`,
            cells: [(data.rollout_previews?.[g]?.text_preview ?? '').slice(0, 32)],
          }))}
          focusRow={focusG} tint="#d6a029" rowLblW={50} />
        {@const arrX = 440}
        <line x1={arrX - 40} y1={250} x2={arrX + 60} y2={250}
          stroke="#d6a029" stroke-width="1.6" marker-end="url(#gv-arrow)" />
        <text x={arrX + 10} y={236} text-anchor="middle" class="gv-op">R(q, o)</text>
        <text x={arrX + 10} y={270} text-anchor="middle" class="gv-opsub">fmt + moves + prog + solve + brev</text>
        <MatrixSlab x={540} y={80} title="rewards rᵢ"
          cols={[{ label: 'total', w: 70 }]}
          rows={makeRowsGx1(data.rewards, (g) => `g=${g}`, 2)}
          focusRow={focusG} tint="#d6a029"
          cellColor={(_, r) => data.rewards[r] > 1.5 ? '#153d1f' : data.rewards[r] < 0.4 ? '#3d1515' : undefined} />
        <!-- per-component breakdown for the focused rollout -->
        {@const rc = data.rewardComponents[focusG]}
        <MatrixSlab x={780} y={80} title={`g=${focusG} breakdown`}
          cols={[{ label: 'component', w: 140 }, { label: 'value', w: 70 }]}
          rows={[
            { lbl: '', cells: ['format_tags',  fmt(rc.format_tags, 2)] },
            { lbl: '', cells: ['moves_parse',  fmt(rc.moves_parse, 2)] },
            { lbl: '', cells: ['progress',     fmt(rc.progress, 2)] },
            { lbl: '', cells: ['solved',       fmt(rc.solved, 2)] },
            { lbl: '', cells: ['brevity',      fmt(rc.brevity, 2)] },
            { lbl: '', cells: ['= total',      fmt(data.rewards[focusG], 2)] },
          ]}
          rowLblW={10} tint="#d6a029" />

      <!-- ──── STEP 3: Advantage ──── -->
      {:else if computeStep === 2}
        <MatrixSlab x={80} y={80} title="rewards rᵢ"
          cols={[{ label: 'total', w: 70 }]}
          rows={makeRowsGx1(data.rewards, (g) => `g=${g}`, 2)}
          focusRow={focusG} tint="#d6a029" />
        {@const arr2X = 290}
        <line x1={arr2X - 40} y1={220} x2={arr2X + 120} y2={220}
          stroke="#2a7a4a" stroke-width="1.6" marker-end="url(#gv-arrow)" />
        <text x={arr2X + 40} y={206} text-anchor="middle" class="gv-op">(rᵢ − μ) / σ</text>
        <text x={arr2X + 40} y={240} text-anchor="middle" class="gv-opsub">μ = {fmt(data.groupStats.mean, 2)}   σ = {fmt(data.groupStats.std, 2)}</text>
        <MatrixSlab x={arr2X + 160} y={80} title="advantages Âᵢ"
          cols={[{ label: 'Â', w: 70 }]}
          rows={makeRowsGx1(data.advantages, (g) => `g=${g}`, 3)}
          focusRow={focusG} tint="#2a7a4a"
          cellColor={(_, r) => signColor(data.advantages[r])} />

      <!-- ──── STEP 4: Ratio ──── -->
      {:else if computeStep === 3}
        {@const cols4 = makeTokCols(true)}
        <MatrixSlab x={80} y={60} title="log πθ  (current policy)"
          cols={cols4} rows={makeRowsGxT(data.newLogprobs, (g) => `g=${g}`, 2)}
          focusRow={focusG} focusCol={tSafe} tint="#5b7cc5" />
        {@const oldMat = Array.from({ length: G }, (_, g) => Array.from({ length: T }, (_, t) => oldLp(g, t)))}
        <MatrixSlab x={80} y={330} title="log π_old  (sampling policy)"
          cols={cols4} rows={makeRowsGxT(oldMat, (g) => `g=${g}`, 2)}
          focusRow={focusG} focusCol={tSafe} tint="#888" />
        {@const outX4 = 780}
        {@const arrY4 = 280}
        <path d="M {outX4 - 40} {arrY4 - 140} L {outX4 - 40} {arrY4} L {outX4 - 40} {arrY4 + 140}"
          stroke="#5b7cc5" stroke-width="1.2" fill="none" />
        <line x1={outX4 - 40} y1={arrY4} x2={outX4 + 60} y2={arrY4}
          stroke="#5b7cc5" stroke-width="1.6" marker-end="url(#gv-arrow)" />
        <text x={outX4 + 10} y={arrY4 - 12} text-anchor="middle" class="gv-op">exp(· − ·)</text>
        <text x={outX4 + 10} y={arrY4 + 20} text-anchor="middle" class="gv-opsub">per-token ratio</text>
        <MatrixSlab x={outX4 + 90} y={arrY4 - 140} title="ρ  (importance weights)"
          cols={cols4} rows={makeRowsGxT(data.ratios, (g) => `g=${g}`, 3)}
          focusRow={focusG} focusCol={tSafe} tint="#5b7cc5"
          cellColor={(_, r, c) => ratioColor(data.ratios[r][c])} />

      <!-- ──── STEP 5: Clip ──── -->
      {:else if computeStep === 4}
        {@const cols5 = makeTokCols(true)}
        <MatrixSlab x={80} y={100} title="ρ"
          cols={cols5} rows={makeRowsGxT(data.ratios, (g) => `g=${g}`, 3)}
          focusRow={focusG} focusCol={tSafe} tint="#5b7cc5" />
        {@const outX5 = 780}
        <line x1={outX5 - 40} y1={220} x2={outX5 + 60} y2={220}
          stroke="#c46daf" stroke-width="1.6" marker-end="url(#gv-arrow)" />
        <text x={outX5 + 10} y={206} text-anchor="middle" class="gv-op">clip(·, 0.8, 1.2)</text>
        <text x={outX5 + 10} y={240} text-anchor="middle" class="gv-opsub">tinted cells were clipped</text>
        <MatrixSlab x={outX5 + 90} y={100} title="clip(ρ)"
          cols={cols5} rows={makeRowsGxT(data.clipped, (g) => `g=${g}`, 3)}
          focusRow={focusG} focusCol={tSafe} tint="#c46daf"
          cellColor={(_, r, c) => clippedColor(r, c)} />
        <text x={700} y={530} text-anchor="middle" class="gv-note">
          group-wide clip fraction: {(data.groupStats.clipFraction * 100).toFixed(1)}% of tokens
        </text>

      <!-- ──── STEP 6: Surrogates (two products) ──── -->
      {:else if computeStep === 5}
        {@const cols6 = makeTokCols(true)}
        {@const s1Mat = data.ratios.map((row, g) => row.map((rv) => rv * data.advantages[g]))}
        {@const s2Mat = data.clipped.map((row, g) => row.map((cv) => cv * data.advantages[g]))}
        <MatrixSlab x={80} y={60} title="ρ · Â"
          cols={cols6} rows={makeRowsGxT(s1Mat, (g) => `g=${g}`, 3)}
          focusRow={focusG} focusCol={tSafe} tint="#8b6cc5"
          cellColor={(_, r, c) => signColor(s1Mat[r][c])} />
        <MatrixSlab x={80} y={330} title="clip(ρ) · Â"
          cols={cols6} rows={makeRowsGxT(s2Mat, (g) => `g=${g}`, 3)}
          focusRow={focusG} focusCol={tSafe} tint="#c46daf"
          cellColor={(_, r, c) => signColor(s2Mat[r][c])} />
        <text x={680} y={280} text-anchor="middle" class="gv-op">Â broadcasts across T</text>
        <text x={680} y={304} text-anchor="middle" class="gv-opsub">g=0:{fmt(data.advantages[0], 2)}  g=1:{fmt(data.advantages[1], 2)}  g=2:{fmt(data.advantages[2], 2)}  …</text>

      <!-- ──── STEP 7: Pessimistic Min ──── -->
      {:else if computeStep === 6}
        {@const cols7 = makeTokCols(true)}
        {@const s1Mat = data.ratios.map((row, g) => row.map((rv) => rv * data.advantages[g]))}
        {@const s2Mat = data.clipped.map((row, g) => row.map((cv) => cv * data.advantages[g]))}
        <MatrixSlab x={60} y={60} title="ρ · Â"
          cols={cols7} rows={makeRowsGxT(s1Mat, (g) => `g=${g}`, 3)}
          focusRow={focusG} focusCol={tSafe} tint="#8b6cc5"
          cellColor={(_, r, c) => Math.abs(data.pessimisticMin[r][c] - s1Mat[r][c]) < 1e-5 ? '#2a1a2a' : undefined} />
        <MatrixSlab x={60} y={330} title="clip(ρ) · Â"
          cols={cols7} rows={makeRowsGxT(s2Mat, (g) => `g=${g}`, 3)}
          focusRow={focusG} focusCol={tSafe} tint="#c46daf"
          cellColor={(_, r, c) => Math.abs(data.pessimisticMin[r][c] - s2Mat[r][c]) < 1e-5 ? '#2a1a2a' : undefined} />
        {@const outX7 = 760}
        <line x1={outX7 - 40} y1={220} x2={outX7 + 60} y2={220}
          stroke="#c75a5a" stroke-width="1.6" marker-end="url(#gv-arrow)" />
        <line x1={outX7 - 40} y1={440} x2={outX7 + 60} y2={440}
          stroke="#c75a5a" stroke-width="1.6" marker-end="url(#gv-arrow)" />
        <text x={outX7 + 10} y={320} text-anchor="middle" class="gv-op">min(·, ·)</text>
        <text x={outX7 + 10} y={344} text-anchor="middle" class="gv-opsub">pick the worse at each token</text>
        <text x={outX7 + 10} y={360} text-anchor="middle" class="gv-opsub">(tinted = which side won)</text>
        <MatrixSlab x={outX7 + 90} y={200} title="pmin"
          cols={cols7} rows={makeRowsGxT(data.pessimisticMin, (g) => `g=${g}`, 3)}
          focusRow={focusG} focusCol={tSafe} tint="#c75a5a"
          cellColor={(_, r, c) => signColor(data.pessimisticMin[r][c])} />

      <!-- ──── STEP 8: KL ──── -->
      {:else if computeStep === 7}
        {@const cols8 = makeTokCols(true)}
        <MatrixSlab x={80} y={60} title="log πθ"
          cols={cols8} rows={makeRowsGxT(data.newLogprobs, (g) => `g=${g}`, 2)}
          focusRow={focusG} focusCol={tSafe} tint="#5b7cc5" />
        <MatrixSlab x={80} y={330} title="log π_ref"
          cols={cols8} rows={makeRowsGxT(data.refLogprobs, (g) => `g=${g}`, 2)}
          focusRow={focusG} focusCol={tSafe} tint="#d67a29" />
        {@const outX8 = 780}
        <line x1={outX8 - 40} y1={280} x2={outX8 + 60} y2={280}
          stroke="#d67a29" stroke-width="1.6" marker-end="url(#gv-arrow)" />
        <text x={outX8 + 10} y={266} text-anchor="middle" class="gv-op">exp(Δ) − Δ − 1</text>
        <text x={outX8 + 10} y={300} text-anchor="middle" class="gv-opsub">Δ = log π_ref − log πθ</text>
        <MatrixSlab x={outX8 + 90} y={140} title="KL per token"
          cols={cols8} rows={makeRowsGxT(data.klPerTok, (g) => `g=${g}`, 4)}
          focusRow={focusG} focusCol={tSafe} tint="#d67a29"
          cellColor={(_, r, c) => data.klPerTok[r][c] > 0.05 ? '#2a1a0a' : undefined} />

      <!-- ──── STEP 9: Objective J ──── -->
      {:else if computeStep === 8}
        {@const cols9 = makeTokCols(true)}
        {@const betaKL = data.klPerTok.map((row) => row.map((k) => BETA_KL * k))}
        <MatrixSlab x={80} y={60} title="pmin"
          cols={cols9} rows={makeRowsGxT(data.pessimisticMin, (g) => `g=${g}`, 3)}
          focusRow={focusG} focusCol={tSafe} tint="#c75a5a"
          cellColor={(_, r, c) => signColor(data.pessimisticMin[r][c])} />
        <MatrixSlab x={80} y={330} title="β · KL"
          cols={cols9} rows={makeRowsGxT(betaKL, (g) => `g=${g}`, 4)}
          focusRow={focusG} focusCol={tSafe} tint="#d67a29" />
        {@const outX9 = 780}
        <line x1={outX9 - 40} y1={280} x2={outX9 + 60} y2={280}
          stroke="#5aad6a" stroke-width="1.6" marker-end="url(#gv-arrow)" />
        <text x={outX9 + 10} y={266} text-anchor="middle" class="gv-op">−</text>
        <text x={outX9 + 10} y={300} text-anchor="middle" class="gv-opsub">Jᵢₜ = pmin − β·KL</text>
        <MatrixSlab x={outX9 + 90} y={140} title="Jᵢₜ (per-token objective)"
          cols={cols9} rows={makeRowsGxT(data.objectivePerTok, (g) => `g=${g}`, 3)}
          focusRow={focusG} focusCol={tSafe} tint="#5aad6a"
          cellColor={(_, r, c) => signColor(data.objectivePerTok[r][c])} />

      <!-- ──── STEP 10: Loss ──── -->
      {:else if computeStep === 9}
        {@const cols10 = makeTokCols(true)}
        {@const maskedJ = data.objectivePerTok.map((row, g) =>
          row.map((j, t) => isFinite(j) ? j * (data.masks[g][t] ?? 0) : 0))}
        <MatrixSlab x={80} y={140} title="J · mask"
          cols={cols10} rows={makeRowsGxT(maskedJ, (g) => `g=${g}`, 3)}
          focusRow={focusG} focusCol={tSafe} tint="#4a9"
          cellColor={(_, r, c) => {
            const v = maskedJ[r][c];
            return v > 0 ? '#13281a' : v < 0 ? '#281313' : '#0b0b0b';
          }} />
        {@const outX10 = 780}
        <line x1={outX10 - 40} y1={320} x2={outX10 + 80} y2={320}
          stroke="#4a9" stroke-width="1.6" marker-end="url(#gv-arrow)" />
        <text x={outX10 + 20} y={306} text-anchor="middle" class="gv-op">−mean(·)</text>
        <text x={outX10 + 20} y={340} text-anchor="middle" class="gv-opsub">sum over masked tokens, negate</text>
        <rect x={outX10 + 120} y={280} width={200} height={80} rx="8"
          fill="#0e1a18" stroke="#4a9" stroke-width="1.6" />
        <text x={outX10 + 220} y={308} text-anchor="middle" class="gv-op" style="font-size: 16px; fill: #4a9">L</text>
        <text x={outX10 + 220} y={344} text-anchor="middle" class="gv-loss">{fmt(data.loss, 5)}</text>

      <!-- ──── STEP 11: Gradient Step ──── -->
      {:else if computeStep === 10}
        <rect x={80} y={220} width={220} height={100} rx="8"
          fill="#0e1a18" stroke="#4a9" stroke-width="1.6" />
        <text x={190} y={256} text-anchor="middle" class="gv-op" style="font-size: 18px; fill: #4a9">L</text>
        <text x={190} y={294} text-anchor="middle" class="gv-loss" style="font-size: 20px">{fmt(data.loss, 5)}</text>

        <line x1={300} y1={270} x2={400} y2={270}
          stroke="#bbb" stroke-width="1.6" marker-end="url(#gv-arrow)" />
        <text x={350} y={256} text-anchor="middle" class="gv-op">∂ / ∂θ</text>

        <rect x={420} y={220} width={260} height={100} rx="8"
          fill="#1e0f1a" stroke="#c46daf" stroke-width="1.6" />
        <text x={550} y={254} text-anchor="middle" class="gv-op">∇θ L</text>
        <text x={550} y={280} text-anchor="middle" class="gv-opsub">one tensor per weight matrix above</text>
        <text x={550} y={300} text-anchor="middle" class="gv-opsub">Adam: mₜ, vₜ moments</text>

        <line x1={680} y1={270} x2={780} y2={270}
          stroke="#bbb" stroke-width="1.6" marker-end="url(#gv-arrow)" />

        <rect x={800} y={220} width={300} height={100} rx="8"
          fill="#1e0f1a" stroke="#c46daf" stroke-width="1.6" stroke-dasharray="4 3" />
        <text x={950} y={258} text-anchor="middle" class="gv-op" style="font-size: 16px; fill: #c46daf">
          θ  ←  θ  −  α · ∇θ L
        </text>
        <text x={950} y={296} text-anchor="middle" class="gv-opsub">every matrix in the Model view re-tints</text>

        <text x={600} y={460} text-anchor="middle" class="gv-note">
          Cycle restarts at Step 1 with the updated weights.
          The heatmaps in the <a href="#/pipeline/model" style="fill:#8ab4f8">Model view</a> animate as you scrub training step.
        </text>
      {/if}

      {/if}
    </svg>
  </div>

  {#if T > 0 && data && computeStep >= 3 && computeStep <= 8}
    <div class="tokenbar">
      <span class="tb-lbl">token →</span>
      {#each Array(T) as _, t}
        {@const sel = t === tSafe}
        <button class="tpill" class:sel onclick={() => { focusT = t; }}>
          {(data.tokenNames[focusG]?.[t] ?? '').slice(0, 6)}
        </button>
      {/each}
    </div>
  {/if}

  <div class="controls">
    <button class="play-btn" onclick={togglePlay}>{playing ? '⏸' : '▶'}</button>
    <button class="step-btn" onclick={prevStep}>◂</button>
    <div class="step-pills">
      {#each META as m, i}
        <button class="pill" class:active={i === computeStep} class:done={i < computeStep}
          onclick={() => { computeStep = i; }} title={m.title}>
          {i + 1}
        </button>
      {/each}
    </div>
    <button class="step-btn" onclick={nextStep}>▸</button>
  </div>
</div>

<style>
  .page {
    width: 100vw; height: 100vh; background: #0a0a0a;
    display: flex; flex-direction: column;
    --font-sans: Inter, -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
    --font-serif: 'Source Serif Pro', Georgia, serif;
  }
  .topbar {
    display: flex; align-items: center; gap: 14px;
    padding: 8px 16px; background: #111; border-bottom: 1px solid #1a1a1a;
  }
  .back { color: #8ab4f8; font-size: 11px; text-decoration: none; }
  .title { font-family: var(--font-serif); font-weight: 700; color: #ddd; font-size: 13px; }
  .formula { font-family: var(--font-mono); font-size: 11px; color: #4a9; }
  .spacer { flex: 1; }
  .cg { display: flex; align-items: center; gap: 6px; }
  .cl { font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
  .cb { padding: 2px 8px; border: 1px solid #333; border-radius: 3px; background: #1a1a1a; color: #bbb; font-family: var(--font-mono); font-size: 10px; cursor: pointer; }
  .cn { font-family: var(--font-mono); font-size: 10px; color: #888; min-width: 22px; text-align: center; }
  .meta { font-family: var(--font-mono); font-size: 9px; color: #555; }

  .stage { flex: 1; min-height: 0; padding: 8px 16px; }
  .stage-svg { display: block; width: 100%; height: 100%; }

  .tokenbar {
    display: flex; align-items: center; gap: 4px; padding: 6px 16px;
    background: #0d0d0d; border-top: 1px solid #1a1a1a; flex-wrap: wrap;
  }
  .tb-lbl { font-family: var(--font-mono); font-size: 9px; color: #555; margin-right: 8px; }
  .tpill {
    padding: 3px 10px; border: 1px solid #333; border-radius: 3px;
    background: #111; color: #888; font-family: var(--font-mono); font-size: 10px; cursor: pointer;
  }
  .tpill:hover { background: #1a1a1a; color: #ddd; }
  .tpill.sel { background: #2a241b; border-color: #e6b94a; color: #e6b94a; font-weight: 700; }

  .controls {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 8px 16px; background: #0d0d0d; border-top: 1px solid #1a1a1a;
  }
  .play-btn {
    width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid #4a9;
    background: #111; color: #4a9; font-size: 14px; cursor: pointer;
  }
  .step-btn {
    padding: 4px 10px; border: 1px solid #333; border-radius: 3px;
    background: #1a1a1a; color: #888; font-size: 12px; cursor: pointer;
  }
  .step-pills { display: flex; gap: 3px; }
  .pill {
    width: 24px; height: 24px; border-radius: 3px; border: 1px solid #333;
    background: #111; color: #555; font-family: var(--font-mono); font-size: 10px; cursor: pointer;
  }
  .pill.active { background: #1a2a1a; border-color: #4a9; color: #4a9; font-weight: 700; }
  .pill.done { background: #1a1a1a; color: #666; }

  :global(.gv-op)    { font-family: 'Source Serif Pro', Georgia, serif; font-size: 13px; font-style: italic; fill: #ddd; }
  :global(.gv-opsub) { font-family: 'JetBrains Mono', monospace; font-size: 10px; fill: #888; }
  :global(.gv-loss)  { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; fill: #fff; }
  :global(.gv-note)  { font-family: 'Source Serif Pro', Georgia, serif; font-size: 11px; font-style: italic; fill: #888; }
  :global(.gv-mute)  { font-family: 'JetBrains Mono', monospace; font-size: 11px; fill: #555; font-style: italic; }
</style>
