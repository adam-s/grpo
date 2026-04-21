<script lang="ts">
  import { archBoxes, archArrows, viewW, viewH } from '../../viz/modelDiagramLayout';
</script>

<div class="model-diagram-placeholder">
  <p class="note">Interactive weight explorer — open on desktop for the full view.</p>
  <svg viewBox="0 0 {viewW} {viewH}" preserveAspectRatio="xMidYMid meet" class="diagram-svg">
    <defs>
      <marker id="mdp-arrow" viewBox="0 0 10 10" refX="9" refY="5"
        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#aaa" />
      </marker>
    </defs>

    <rect width={viewW} height={viewH} fill="var(--bg)" />

    {#each archArrows as a}
      <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
        stroke="#aaa" stroke-width="1.2" marker-end="url(#mdp-arrow)" opacity="0.55" />
    {/each}

    {#each archBoxes as box}
      <g transform="translate({box.x},{box.y})">
        <rect x="0" y="0" width={box.w} height={box.h} rx="4"
          fill={box.color} fill-opacity="0.08"
          stroke={box.color} stroke-width="1.4" opacity="0.9" />
        <text x={box.w / 2} y={box.h + 20} text-anchor="middle"
          class="box-label" fill={box.color}>{box.label}</text>
        <text x={box.w / 2} y={box.h + 34} text-anchor="middle"
          class="box-sub" fill="var(--ink-subtle)">{box.sub}</text>
      </g>
    {/each}
  </svg>
</div>

<style>
  .model-diagram-placeholder {
    width: 100%;
    margin-top: var(--space-lg);
    margin-bottom: var(--space-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
  }

  .note {
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    color: var(--ink-subtle);
    text-align: center;
    letter-spacing: 0.02em;
  }

  .diagram-svg {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
