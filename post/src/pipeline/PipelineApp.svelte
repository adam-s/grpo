<script lang="ts">
  /**
   * PipelineApp — tiny landing page that links to the two focused views.
   * Hash routing in main.ts dispatches ?/model and ?/grpo to the specific
   * components; this landing is what you get at ?/pipeline itself.
   */
</script>

<div class="hub">
  <h1>GRPO — Interactive</h1>
  <p class="tag">
    Two views, each doing one thing. Scrub the training step to see how the
    model and its gradients evolve.
  </p>

  <div class="cards">
    <a href="#/pipeline/grid" class="card card-primary">
      <span class="card-kicker">View (new)</span>
      <span class="card-title">Grid</span>
      <p class="card-body">
        All 11 ops as a small-multiples grid. Click a card and it expands in
        place; neighbors reflow around it. Best for comparing ops side-by-side.
      </p>
      <span class="card-go">Open →</span>
    </a>

    <a href="#/pipeline/flow" class="card">
      <span class="card-kicker">View</span>
      <span class="card-title">Data flow</span>
      <p class="card-body">
        All 11 GRPO operations visible at once. Curved arrows show values
        flowing between them. Hover any cell to trace one rollout × token
        across the entire cycle.
      </p>
      <span class="card-go">Open →</span>
    </a>

    <a href="#/pipeline/model" class="card">
      <span class="card-kicker">View 1</span>
      <span class="card-title">Model</span>
      <p class="card-body">
        The toy transformer's weight matrices as live heatmaps. Every cell is
        a single weight. Scrub the training step and watch them move.
      </p>
      <span class="card-go">Open →</span>
    </a>

    <a href="#/pipeline/grpo" class="card">
      <span class="card-kicker">View 2</span>
      <span class="card-title">GRPO ops</span>
      <p class="card-body">
        Each of the 11 steps in the cycle as a numeric matrix → op → matrix.
        Real values, readable cells. Follow one rollout across the whole cycle.
      </p>
      <span class="card-go">Open →</span>
    </a>
  </div>

  <p class="bridge">
    <span class="bridge-kicker">the only bridge between them:</span>
    the Model produces <code>log πθ[g, t]</code> — one scalar per completion
    token. Every value GRPO computes downstream is built from that.
  </p>
</div>

<style>
  .hub {
    width: 100vw; height: 100vh; background: #0a0a0a; color: #ddd;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 40px; box-sizing: border-box;
    font-family: 'Source Serif Pro', Georgia, serif;
  }
  h1 {
    font-size: 32px; font-weight: 700; font-style: italic; margin: 0 0 10px 0;
    color: #eee;
  }
  .tag {
    font-size: 13px; color: #888; max-width: 620px; text-align: center; margin: 0 0 40px 0;
  }
  .cards { display: flex; gap: 24px; max-width: 900px; width: 100%; }
  .card {
    flex: 1; display: flex; flex-direction: column; gap: 10px;
    padding: 28px; border: 1px solid #222; border-radius: 10px;
    background: #101014; text-decoration: none; color: inherit;
    transition: border-color 120ms;
  }
  .card:hover { border-color: #4a9; }
  .card-kicker {
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.12em; color: #4a9;
  }
  .card-title {
    font-size: 22px; font-weight: 700; font-style: italic; color: #eee;
  }
  .card-body { font-size: 13px; color: #aaa; line-height: 1.5; margin: 0; }
  .card-go {
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8ab4f8; margin-top: auto;
  }
  .bridge {
    font-family: 'Source Serif Pro', Georgia, serif; font-style: italic; font-size: 13px;
    color: #888; max-width: 620px; text-align: center; margin: 40px 0 0 0;
  }
  .bridge-kicker {
    display: block; font-family: 'JetBrains Mono', monospace; font-style: normal;
    font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #555;
    margin-bottom: 8px;
  }
  .bridge code {
    font-family: 'JetBrains Mono', monospace; font-style: normal;
    color: #4a9; padding: 1px 4px; background: #112; border-radius: 3px;
  }
</style>
