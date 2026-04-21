<script lang="ts">
  /**
   * ModelView — the toy transformer's weight matrices as a full-viewport
   * architecture diagram. Each weight matrix is painted as a heatmap from
   * weights_series.json; scrubbing the training step re-picks the nearest
   * snapshot and the heatmaps animate.
   *
   * This view answers: "What is π_θ? What does a training step change?"
   * It does NOT show GRPO math — that lives in /pipeline/grpo.
   */
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { featuredStep } from '../lib/stores/grpo';
  import { loadWeightsSeries, getWeightsAt, type WeightsData } from '../lib/viz/weightsSeries';

  let weightsLoaded = $state(false);
  let blockIdx = $state(0);
  let hoveredCell: { label: string; r: number; c: number; v: number } | null = $state(null);

  const viridis = d3.interpolateViridis;

  let weights = $derived.by<WeightsData | null>(() => {
    if (!weightsLoaded) return null;
    return getWeightsAt($featuredStep);
  });

  type Box = { id: string; label: string; sub: string; x: number; y: number; color: string; w?: number; h?: number };
  // Architecture box layout — scaled up vs the old UnifiedView so we can
  // read individual weight cells when the viewport is full-height.
  const BW = 140, BH = 100;
  const archBoxes: Box[] = [
    { id: 'embed', label: 'Embed',    sub: '48×64',  x:  40, y: 120, color: '#7c5bbf' },
    { id: 'wq',    label: 'W_Q',      sub: '64×64',  x: 260, y:  20, color: '#5b7cc5' },
    { id: 'wk',    label: 'W_K',      sub: '64×64',  x: 260, y: 150, color: '#c75a5a' },
    { id: 'wv',    label: 'W_V',      sub: '64×64',  x: 260, y: 280, color: '#5aad6a' },
    { id: 'wo',    label: 'W_O',      sub: '64×64',  x: 490, y: 150, color: '#8b6cc5' },
    { id: 'gate',  label: 'Gate',     sub: '128×64', x: 720, y:  60, color: '#d6a029' },
    { id: 'up',    label: 'Up',       sub: '128×64', x: 720, y: 230, color: '#d6a029' },
    { id: 'down',  label: 'Down',     sub: '64×128', x: 950, y: 145, color: '#d6a029' },
    { id: 'norm',  label: 'Norm',     sub: '1×64',   x: 1180, y: 140, color: '#888' },
    { id: 'soft',  label: 'Softmax',  sub: 'π(·)',   x: 1330, y: 80,  color: '#c46daf', w: 160, h: 210 },
  ];

  // Arrows between boxes (connecting centers roughly).
  const archArrows = [
    // embed → Q/K/V
    { x1:  40 + BW,  y1: 120 + BH / 2, x2: 260,       y2:  20 + BH / 2 },
    { x1:  40 + BW,  y1: 120 + BH / 2, x2: 260,       y2: 150 + BH / 2 },
    { x1:  40 + BW,  y1: 120 + BH / 2, x2: 260,       y2: 280 + BH / 2 },
    // Q/K/V → O
    { x1: 260 + BW,  y1:  20 + BH / 2, x2: 490,       y2: 150 + BH / 2 },
    { x1: 260 + BW,  y1: 150 + BH / 2, x2: 490,       y2: 150 + BH / 2 },
    { x1: 260 + BW,  y1: 280 + BH / 2, x2: 490,       y2: 150 + BH / 2 },
    // O → Gate, Up
    { x1: 490 + BW,  y1: 150 + BH / 2, x2: 720,       y2:  60 + BH / 2 },
    { x1: 490 + BW,  y1: 150 + BH / 2, x2: 720,       y2: 230 + BH / 2 },
    // Gate, Up → Down
    { x1: 720 + BW,  y1:  60 + BH / 2, x2: 950,       y2: 145 + BH / 2 },
    { x1: 720 + BW,  y1: 230 + BH / 2, x2: 950,       y2: 145 + BH / 2 },
    // Down → Norm → Softmax
    { x1: 950 + BW,  y1: 145 + BH / 2, x2: 1180,      y2: 140 + BH / 2 },
    { x1: 1180 + BW, y1: 140 + BH / 2, x2: 1330,      y2: 185 },
  ];

  function getW(key: string) {
    if (!weights?.[key]) return null;
    const w = weights[key];
    const [rows, cols] = w.shape.length === 2 ? w.shape : [1, w.shape[0]];
    let mn = Infinity, mx = -Infinity;
    for (const v of w.data) { if (v < mn) mn = v; if (v > mx) mx = v; }
    return { rows, cols, data: w.data, min: mn, max: mx };
  }
  const wColor = (v: number, mn: number, mx: number) => viridis((v - mn) / (mx - mn || 1));

  function weightKey(boxId: string): string {
    const p = `blocks.${blockIdx}`;
    const map: Record<string, string> = {
      embed: 'embed.weight',
      wq: `${p}.attn.q.weight`, wk: `${p}.attn.k.weight`,
      wv: `${p}.attn.v.weight`, wo: `${p}.attn.o.weight`,
      gate: `${p}.ffn.gate.weight`, up: `${p}.ffn.up.weight`, down: `${p}.ffn.down.weight`,
      norm: 'final_norm.weight',
    };
    return map[boxId] ?? '';
  }

  onMount(() => {
    const base = import.meta.env.BASE_URL;
    loadWeightsSeries(base).then(() => { weightsLoaded = true; });
  });
</script>

<div class="page">
  <header class="topbar">
    <a href="#/pipeline" class="back">← Pipeline</a>
    <span class="title">Model — π_θ architecture</span>
    <span class="note">heatmaps: each cell is one weight · scrub training step to see them move</span>
    <div class="spacer"></div>
    <div class="blockg">
      <span class="cl">Block</span>
      {#each [0, 1] as b}
        <button class="cb" class:active={b === blockIdx} onclick={() => { blockIdx = b; }}>{b}</button>
      {/each}
    </div>
    <div class="cg">
      <span class="cl">Step</span>
      <button class="cb" onclick={() => { $featuredStep = Math.max(0, $featuredStep - 50); }}>◂◂</button>
      <button class="cb" onclick={() => { $featuredStep = Math.max(0, $featuredStep - 5); }}>◂</button>
      <span class="cn">{$featuredStep}</span>
      <button class="cb" onclick={() => { $featuredStep = Math.min(499, $featuredStep + 5); }}>▸</button>
      <button class="cb" onclick={() => { $featuredStep = Math.min(499, $featuredStep + 50); }}>▸▸</button>
    </div>
  </header>

  <div class="stage">
    <svg viewBox="0 0 1520 420" preserveAspectRatio="xMidYMid meet" class="stage-svg">
      <defs>
        <marker id="mv-arrow" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#555" />
        </marker>
      </defs>

      <!-- arrows -->
      {#each archArrows as a}
        <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
          stroke="#444" stroke-width="1" marker-end="url(#mv-arrow)" opacity="0.55" />
      {/each}

      <!-- boxes -->
      {#each archBoxes as box}
        {@const w = getW(weightKey(box.id))}
        {@const bw = box.w ?? BW}
        {@const bh = box.h ?? BH}
        <g transform="translate({box.x},{box.y})">
          {#if w && weights}
            {@const isFlat = w.rows === 1}
            {@const dispCols = isFlat ? 16 : w.cols}
            {@const dispRows = isFlat ? Math.ceil(w.cols / 16) : w.rows}
            {@const cellW = bw / dispCols}
            {@const cellH = bh / dispRows}
            <rect x="-2" y="-2" width={bw + 4} height={bh + 4} rx="4"
              fill="none" stroke={box.color} stroke-width="1.4" opacity="0.85" />
            {#each { length: dispRows } as _, r}
              {#each { length: dispCols } as _, c}
                {@const idx = isFlat ? r * dispCols + c : r * w.cols + c}
                {#if idx < w.data.length}
                  {@const v = w.data[idx]}
                  <rect x={c * cellW} y={r * cellH}
                    width={Math.max(0.5, cellW - 0.3)} height={Math.max(0.5, cellH - 0.3)}
                    fill={wColor(v, w.min, w.max)}
                    onmouseenter={() => { hoveredCell = { label: box.label, r: isFlat ? 0 : r, c: isFlat ? idx : c, v }; }}
                    onmouseleave={() => { hoveredCell = null; }} />
                {/if}
              {/each}
            {/each}
          {:else}
            <rect x="0" y="0" width={bw} height={bh} rx="4"
              fill="#111" stroke={box.color} stroke-width="1.2" opacity="0.7" />
            <text x={bw / 2} y={bh / 2 + 4} text-anchor="middle"
              style="font-family: var(--font-serif); font-size: 12px; font-style: italic; fill: {box.color}">…</text>
          {/if}
          <text x={bw / 2} y={bh + 18} text-anchor="middle" class="box-label" fill={box.color}>{box.label}</text>
          <text x={bw / 2} y={bh + 32} text-anchor="middle" class="box-sub">{box.sub}</text>
        </g>
      {/each}

      <!-- Hover tooltip -->
      {#if hoveredCell}
        <g transform="translate(760,405)" style="pointer-events:none">
          <rect x="-120" y="-14" width="240" height="18" rx="3" fill="rgba(255,255,255,0.95)" />
          <text x="0" y="0" text-anchor="middle"
            style="font-family: var(--font-mono); font-size: 10px; fill: #1a1a1a;">
            {hoveredCell.label}[{hoveredCell.r},{hoveredCell.c}] = {hoveredCell.v.toFixed(4)}
          </text>
        </g>
      {/if}
    </svg>
  </div>

  <footer class="foot">
    <span class="leg">
      The next-token probability under π_θ is a softmax over 48 vocab entries.
      Its log gives <code>log πθ[t]</code> — the only value that crosses into GRPO.
    </span>
    <span class="link"><a href="#/pipeline/grpo">GRPO ops →</a></span>
  </footer>
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
  .note { font-family: var(--font-mono); font-size: 10px; color: #666; }
  .spacer { flex: 1; }
  .blockg, .cg { display: flex; align-items: center; gap: 6px; }
  .cl { font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
  .cb {
    padding: 2px 8px; border: 1px solid #333; border-radius: 3px;
    background: #1a1a1a; color: #bbb; font-family: var(--font-mono); font-size: 10px; cursor: pointer;
  }
  .cb.active { background: #1a2a1a; border-color: #4a9; color: #4a9; font-weight: 700; }
  .cn { font-family: var(--font-mono); font-size: 11px; color: #888; min-width: 28px; text-align: center; }

  .stage { flex: 1; min-height: 0; padding: 24px 32px; }
  .stage-svg { display: block; width: 100%; height: 100%; }

  .foot {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 10px 24px; background: #0d0d0d; border-top: 1px solid #1a1a1a;
  }
  .leg { font-family: var(--font-serif); font-size: 12px; font-style: italic; color: #888; }
  .leg code { font-family: var(--font-mono); color: #4a9; }
  .link a { color: #8ab4f8; font-family: var(--font-mono); font-size: 12px; text-decoration: none; }

  :global(.box-label) { font-family: 'Source Serif Pro', Georgia, serif; font-size: 13px; font-weight: 700; font-style: italic; }
  :global(.box-sub)   { font-family: 'JetBrains Mono', monospace; font-size: 9px; fill: #888; }
</style>
