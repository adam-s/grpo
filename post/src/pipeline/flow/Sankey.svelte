<script lang="ts">
  /**
   * Sankey — absolute-positioned SVG overlay that draws curved Bezier arrows
   * between slabs in the flow stage. Path endpoints are computed by finding
   * DOM elements tagged with `data-slab=...` and `data-flow-anchor=in|out`
   * (emitted by MatrixSlab's per-row invisible circles, or by a raw `<g>`
   * with a `data-slab` attribute for non-slab targets like the Loss pill).
   *
   * Ported from the Transformer-Explainer Sankey pattern: flow layer is
   * decoupled from the columns — column layout can change freely and paths
   * re-anchor automatically via ResizeObserver.
   */
  import { onMount } from 'svelte';

  let { stageEl }: { stageEl: HTMLElement | null } = $props();

  type Edge = { sources: string[]; target: string; label: string; color: string };
  const EDGES: Edge[] = [
    { sources: ['rollouts'],               target: 'rewards',    label: 'R(q, o)',         color: '#d6a029' },
    { sources: ['rewards'],                target: 'advantages', label: '(r − μ) / σ',     color: '#2a7a4a' },
    { sources: ['rollouts'],               target: 'logtheta',   label: 'log πθ(·|q)',     color: '#5b7cc5' },
    { sources: ['rollouts'],               target: 'logold',     label: 'log π_old',       color: '#888'    },
    { sources: ['logtheta', 'logold'],     target: 'ratio',      label: 'exp(· − ·)',      color: '#5b7cc5' },
    { sources: ['ratio'],                  target: 'clipped',    label: 'clip',            color: '#c46daf' },
    { sources: ['ratio', 'advantages'],    target: 'surr1',      label: '× Â (broadcast)', color: '#8b6cc5' },
    { sources: ['clipped', 'advantages'],  target: 'surr2',      label: '× Â',             color: '#c46daf' },
    { sources: ['surr1', 'surr2'],         target: 'pmin',       label: 'min(·, ·)',       color: '#c75a5a' },
    { sources: ['logtheta', 'logref'],     target: 'kl',         label: 'exp(Δ) − Δ − 1',  color: '#d67a29' },
    { sources: ['pmin', 'kl'],             target: 'objective',  label: '− β·KL',          color: '#5aad6a' },
    { sources: ['objective'],              target: 'loss',       label: '−mean(J · m)',    color: '#4a9'    },
  ];

  let svgEl: SVGSVGElement | null = $state(null);
  let paths = $state<Array<{ d: string; label: string; lx: number; ly: number; color: string }>>([]);
  let stageWidth = $state(0);
  let stageHeight = $state(0);

  function anchorCenter(slab: string, side: 'in' | 'out'): { x: number; y: number } | null {
    if (!stageEl || !svgEl) return null;
    const rows = stageEl.querySelectorAll(`[data-slab="${slab}"][data-flow-anchor="${side}"]`);
    const svgRect = svgEl.getBoundingClientRect();
    if (rows.length > 0) {
      let sx = 0, sy = 0;
      rows.forEach((n) => {
        const r = (n as Element).getBoundingClientRect();
        sx += r.left + r.width / 2 - svgRect.left;
        sy += r.top + r.height / 2 - svgRect.top;
      });
      return { x: sx / rows.length, y: sy / rows.length };
    }
    // Fallback: slab-level element (e.g. the Loss pill)
    const any = stageEl.querySelector(`[data-slab="${slab}"]`);
    if (!any) return null;
    const rect = (any as Element).getBoundingClientRect();
    return {
      x: (side === 'in' ? rect.left : rect.right) - svgRect.left,
      y: rect.top + rect.height / 2 - svgRect.top,
    };
  }

  function bezier(a: { x: number; y: number }, b: { x: number; y: number }): string {
    const dx = b.x - a.x;
    const cx = Math.max(30, Math.abs(dx) * 0.45);
    return `M ${a.x} ${a.y} C ${a.x + cx} ${a.y}, ${b.x - cx} ${b.y}, ${b.x} ${b.y}`;
  }

  function recompute() {
    if (!stageEl) { paths = []; return; }
    stageWidth = stageEl.scrollWidth;
    stageHeight = stageEl.scrollHeight;
    const out: typeof paths = [];
    for (const edge of EDGES) {
      const tgt = anchorCenter(edge.target, 'in');
      if (!tgt) continue;
      for (const src of edge.sources) {
        const pt = anchorCenter(src, 'out');
        if (!pt) continue;
        out.push({
          d: bezier(pt, tgt),
          label: edge.label,
          lx: (pt.x + tgt.x) / 2,
          ly: (pt.y + tgt.y) / 2 - 6,
          color: edge.color,
        });
      }
    }
    paths = out;
  }

  // Throttled recompute: queue at most one rAF at a time.
  let rafPending = false;
  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; recompute(); });
  }

  // A CSS transition fires many anim frames per slab — re-anchoring on every
  // one tanks perf and crashes the main thread. Instead, poll lightly during a
  // known-active transition window (560ms per click).
  function transitionSweep(ms = 620) {
    const start = performance.now();
    function step() {
      schedule();
      if (performance.now() - start < ms) requestAnimationFrame(step);
    }
    step();
  }

  onMount(() => {
    if (!stageEl) return;
    // Re-anchor on viewport resize and initial layout.
    const ro = new ResizeObserver(() => schedule());
    ro.observe(stageEl);
    window.addEventListener('resize', schedule);

    // Re-anchor when user clicks a different slab (transition kicks off).
    // transitionstart/run events fire once per transition — cheap to hook.
    const onTransition = () => transitionSweep();
    stageEl.addEventListener('transitionstart', onTransition);
    // Re-anchor on stage scroll (rarely happens here, but cheap).
    const onScroll = () => schedule();
    stageEl.addEventListener('scroll', onScroll, { passive: true });

    // Initial passes (fonts, async store data).
    schedule();
    const t1 = setTimeout(schedule, 120);
    const t2 = setTimeout(schedule, 500);
    const t3 = setTimeout(schedule, 1200);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      stageEl?.removeEventListener('transitionstart', onTransition);
      stageEl?.removeEventListener('scroll', onScroll);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  });
</script>

<svg bind:this={svgEl}
  class="sankey"
  width={stageWidth} height={stageHeight}
  viewBox="0 0 {stageWidth} {stageHeight}"
  preserveAspectRatio="xMinYMin slice">
  <defs>
    <filter id="sankey-label-bg" x="-4%" y="0%" width="108%" height="100%">
      <feFlood flood-color="#0a0a0a" flood-opacity="0.85" />
      <feComposite in="SourceGraphic" operator="over" />
    </filter>
  </defs>
  {#each paths as p, i (i)}
    <path d={p.d} fill="none" stroke={p.color} stroke-width="1.4" opacity="0.55" stroke-linecap="round" />
    <!-- label background pill -->
    <rect x={p.lx - 60} y={p.ly - 10} width="120" height="14" rx="3"
      fill="#0a0a0a" opacity="0.72" />
    <text x={p.lx} y={p.ly}
      text-anchor="middle"
      style="font-family:'Source Serif Pro',Georgia,serif;font-size:10px;font-style:italic;fill:{p.color};opacity:0.95">{p.label}</text>
  {/each}
</svg>

<style>
  .sankey {
    position: absolute;
    top: 0; left: 0;
    pointer-events: none;
    z-index: 3;
    overflow: visible;
  }
</style>
