<script lang="ts">
  const CS = 8;  // cell size px
  const CG = 1;  // gap px
  const FS = 3 * CS + 2 * CG; // face width/height = 26 px

  const TRAJ_Y = 170;
  const NODE_X = [50, 162, 274, 386, 498];

  const bx = NODE_X[4] + FS / 2 + 10; // R=1 badge x = 521

  // Standard Rubik's cube sticker colours
  const W = '#f0f0f0'; // white face
  const Y = '#ffd500'; // yellow
  const R = '#c41e3a'; // red
  const O = '#ff6900'; // orange
  const B = '#0051a2'; // blue
  const G = '#009b48'; // green

  type State = { label: string; colors: string[] };

  const states: State[] = [
    { label: 's₀', colors: [O, B, R, G, W, Y, B, R, O] },   // scrambled
    { label: 's₁', colors: [W, O, B, R, G, B, Y, R, G] },
    { label: 's₂', colors: [G, W, O, B, R, G, R, O, Y] },
    { label: 's₃', colors: [B, G, W, O, B, R, W, O, B] },
    { label: 'sT',  colors: [W, W, W, W, W, W, W, W, W] },   // solved
  ];

  const moves = ['R', "U′", 'F', "F′"];
</script>

<figure class="rl-diagram">
  <svg viewBox="0 0 600 210" xmlns="http://www.w3.org/2000/svg"
       role="img" aria-label="RL loop and trajectory diagram for the Rubik's cube toy model">
    <defs>
      <marker id="rl-ah" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#9a9a9a"/>
      </marker>
      <marker id="rl-ah-g" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#2a7a4a"/>
      </marker>
    </defs>

    <!-- ───────────── LOOP ───────────── -->

    <!-- Policy box -->
    <rect x="20" y="22" width="122" height="58" rx="5"
          fill="#f7f5f0" stroke="#1f3a5f" stroke-width="1.5"/>
    <text x="81" y="44" text-anchor="middle"
          font-family="Inter,-apple-system,sans-serif" font-size="10" font-weight="600" fill="#1f3a5f">Policy</text>
    <text x="81" y="65" text-anchor="middle"
          font-family="Georgia,serif" font-size="14" font-style="italic" fill="#1a1a1a">π<tspan dy="3" font-size="9">θ</tspan></text>

    <!-- Cube / environment box -->
    <rect x="458" y="22" width="122" height="58" rx="5"
          fill="#f7f5f0" stroke="#d8d2c4" stroke-width="1.5"/>
    <text x="519" y="44" text-anchor="middle"
          font-family="Inter,-apple-system,sans-serif" font-size="10" font-weight="600" fill="#5a5a5a">Cube</text>
    <text x="519" y="62" text-anchor="middle"
          font-family="Inter,-apple-system,sans-serif" font-size="9.5" fill="#9a9a9a">environment</text>

    <!-- Action arrow: Policy → Cube (arcs above) -->
    <path d="M142,36 C215,4 385,4 458,36"
          fill="none" stroke="#9a9a9a" stroke-width="1.5"
          marker-end="url(#rl-ah)"/>
    <text x="300" y="7" text-anchor="middle"
          font-family="Inter,-apple-system,sans-serif" font-size="9.5" fill="#5a5a5a">aₜ = move  (R, U′, F…)</text>

    <!-- State arrow: Cube → Policy (arcs below) -->
    <path d="M458,64 C385,97 215,97 142,64"
          fill="none" stroke="#9a9a9a" stroke-width="1.5"
          marker-end="url(#rl-ah)"/>
    <text x="300" y="109" text-anchor="middle"
          font-family="Inter,-apple-system,sans-serif" font-size="9.5" fill="#5a5a5a">sₜ  new cube state</text>

    <!-- Reward note (sparse — only at end) -->
    <text x="300" y="124" text-anchor="middle"
          font-family="Inter,-apple-system,sans-serif" font-size="8.5" font-style="italic" fill="#c8c4bb">
      reward R arrives once — only at the final move
    </text>

    <!-- ───────────── TRAJECTORY ───────────── -->

    <text x="20" y="143"
          font-family="Inter,-apple-system,sans-serif" font-size="8"
          letter-spacing="1" fill="#c8c4bb">TRAJECTORY</text>

    {#each states as state, i}
      {@const cx = NODE_X[i]}
      {@const fx = cx - FS / 2}
      {@const fy = TRAJ_Y - FS / 2}

      <!-- mini cube face: 3×3 grid of coloured stickers -->
      {#each state.colors as color, ci}
        <rect
          x={fx + (ci % 3) * (CS + CG)}
          y={fy + Math.floor(ci / 3) * (CS + CG)}
          width={CS} height={CS}
          fill={color} rx="1"
        />
      {/each}

      <!-- state label below face -->
      <text x={cx} y={TRAJ_Y + FS / 2 + 12}
            text-anchor="middle"
            font-family="'JetBrains Mono',ui-monospace,monospace" font-size="8.5" fill="#5a5a5a">{state.label}</text>

      <!-- arrow + move label to next state -->
      {#if i < moves.length}
        {@const ax1 = cx + FS / 2 + 5}
        {@const ax2 = NODE_X[i + 1] - FS / 2 - 5}
        <line x1={ax1} y1={TRAJ_Y} x2={ax2} y2={TRAJ_Y}
              stroke="#c8c4bb" stroke-width="1"
              marker-end="url(#rl-ah)"/>
        <text x={(ax1 + ax2) / 2} y={TRAJ_Y - 6}
              text-anchor="middle"
              font-family="'JetBrains Mono',ui-monospace,monospace" font-size="8.5" fill="#9a9a9a">{moves[i]}</text>
      {/if}
    {/each}

    <!-- R=1 badge -->
    <rect x={bx} y={TRAJ_Y - 11} width="38" height="22" rx="4" fill="#dcebe0"/>
    <text x={bx + 19} y={TRAJ_Y + 6}
          text-anchor="middle"
          font-family="'JetBrains Mono',ui-monospace,monospace" font-size="10" font-weight="700" fill="#2a7a4a">R=1</text>

    <!-- = τ -->
    <text x={bx + 50} y={TRAJ_Y + 6}
          font-family="Georgia,serif" font-size="14" font-style="italic" fill="#1a1a1a">= τ</text>
  </svg>

  <figcaption>
    The model picks a move (action&nbsp;aₜ), the cube updates (state&nbsp;sₜ), and the loop repeats.
    Reward&nbsp;R only lands once — at the final token — 1 if solved, 0 if not.
    The full sequence of cube states is the trajectory&nbsp;τ.
  </figcaption>
</figure>

<style>
  .rl-diagram {
    width: 100%;
    max-width: 640px;
    margin: var(--space-xl) auto;
  }

  svg {
    width: 100%;
    height: auto;
    display: block;
  }

  figcaption {
    font-size: var(--text-sm);
    color: var(--ink-muted);
    text-align: center;
    margin-top: var(--space-sm);
    font-style: italic;
    line-height: var(--leading-relaxed);
  }
</style>
