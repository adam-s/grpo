<script lang="ts">
  /**
   * PipelineArrows — page-level bezier overlay that draws spline arcs from the
   * hovered card to its source cards, regardless of which section (and which
   * OpGrid) each card lives in. Fixed-positioned, viewport-sized, pointer-
   * events: none, so it never interferes with page interaction.
   *
   * Depends only on the shared `hoveredCard` store + `data-card` attributes.
   * On scroll/resize the arcs recompute via rAF-throttled callbacks.
   */
  import { onMount, tick } from 'svelte';
  import { hoveredCard } from '../stores/pipeline-arrows';
  import { OPS, opByNum } from '../../pipeline/grid/ops';

  type Arc = { d: string };

  type Props = {
    /** Stroke + arrowhead color. Defaults to the site accent (light theme). */
    color?: string;
  };

  // Single spline color per instance — keeps every arc reading the same
  // regardless of which card the reader hovered, so the eye tracks structure
  // (where the flow goes) instead of color-coding each op.
  let { color = '#1f3a5f' }: Props = $props();

  let arcs = $state<Arc[]>([]);
  let modelArcs = $state<Arc[]>([]);
  // Epoch counters to discard stale async recomputes that finish out of order.
  let recomputeEpoch = 0;
  let recomputeModelEpoch = 0;
  let vw = $state(0);
  let vh = $state(0);

  // Persistent (non-hover) splines summarizing the training loop:
  //   Norm produces the rollout tokens on the forward pass,
  //   the objective J feeds gradients back into the model's weights.
  // J → Embed stands in for "J updates θ" — Embed anchors the model's input
  // side, the whole pipeline between Embed and Norm moves with it.
  // `side` routes each spline around the viewport edge so it skirts prose
  // instead of cutting across the text column.
  const MODEL_LINKS: Array<{ from: string; to: string; side: 'left' | 'right' }> = [
    { from: 'norm', to: '2',     side: 'right' }, // forward: hidden state → next token
    { from: '15',   to: 'embed', side: 'left'  }, // backward: J.scalar → gradient → weights
  ];

  // Cache `[data-card="..."]` lookups. `data-card` elements are stable once
  // mounted, so querying them every scroll frame burned ~3.8% of CPU per the
  // perf profile. The cache is invalidated lazily: if a cached element is
  // detached (no longer in the DOM) we re-query.
  const cardCache = new Map<string, HTMLElement>();
  function cardOf(id: number | string): HTMLElement | null {
    const key = String(id);
    const cached = cardCache.get(key);
    if (cached && cached.isConnected) return cached;
    const el = document.querySelector(`[data-card="${key}"]`) as HTMLElement | null;
    if (el) cardCache.set(key, el);
    else cardCache.delete(key);
    return el;
  }

  /**
   * Pick the point on `rect`'s boundary closest to (`towardX`, `towardY`) and
   * return it with the outward-pointing unit normal of the edge it lies on.
   * Diagonal targets land on the corner-facing half of the edge, not the
   * edge midpoint, so splines leave/enter where the cards actually face.
   */
  function edgePoint(rect: DOMRect, towardX: number, towardY: number): {
    x: number; y: number; ox: number; oy: number;
  } {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = towardX - cx;
    const dy = towardY - cy;
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;
    const fx = halfW > 0 ? Math.abs(dx) / halfW : 0;
    const fy = halfH > 0 ? Math.abs(dy) / halfH : 0;
    if (fx >= fy) {
      return {
        x: dx > 0 ? rect.right : rect.left,
        y: cy + (fx > 0 ? dy / fx : 0),
        ox: dx > 0 ? 1 : -1,
        oy: 0,
      };
    }
    return {
      x: cx + (fy > 0 ? dx / fy : 0),
      y: dy > 0 ? rect.bottom : rect.top,
      ox: 0,
      oy: dy > 0 ? 1 : -1,
    };
  }

  /**
   * Build a single bezier from `from` → `to`. Exit and entry points live on
   * each rect's boundary (the edge facing the other card); the bezier control
   * points push perpendicular to those edges so the curve leaves and arrives
   * at a right angle — clean S-curves for diagonal pairs, tight C-curves for
   * stacked pairs.
   */
  function buildArc(from: DOMRect, to: DOMRect): Arc {
    const fcx = from.left + from.width / 2;
    const fcy = from.top + from.height / 2;
    const tcx = to.left + to.width / 2;
    const tcy = to.top + to.height / 2;
    const exit = edgePoint(from, tcx, tcy);
    const entry = edgePoint(to, fcx, fcy);
    const dist = Math.hypot(entry.x - exit.x, entry.y - exit.y);
    const c = Math.max(32, dist * 0.4);
    const cx1 = exit.x + exit.ox * c;
    const cy1 = exit.y + exit.oy * c;
    const cx2 = entry.x + entry.ox * c;
    const cy2 = entry.y + entry.oy * c;
    return {
      d: `M ${exit.x} ${exit.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${entry.x} ${entry.y}`,
    };
  }

  async function recompute(h: number | null): Promise<void> {
    const myEpoch = ++recomputeEpoch;
    await tick();
    if (myEpoch !== recomputeEpoch) return; // stale — a newer call superseded this one
    if (h == null) { arcs = []; return; }
    const op = opByNum(h);
    if (!op) { arcs = []; return; }
    const hoveredEl = cardOf(op.num);
    if (!hoveredEl) { arcs = []; return; }
    const hoveredRect = hoveredEl.getBoundingClientRect();
    const out: Arc[] = [];

    // Backward: each rendered source → hovered target.
    for (const sNum of op.sources) {
      const sEl = cardOf(sNum);
      if (!sEl) continue;
      out.push(buildArc(sEl.getBoundingClientRect(), hoveredRect));
    }

    // Forward: hovered producer → every rendered consumer.
    for (const consumer of OPS) {
      if (!consumer.sources.includes(op.num)) continue;
      const cEl = cardOf(consumer.num);
      if (!cEl) continue;
      out.push(buildArc(hoveredRect, cEl.getBoundingClientRect()));
    }

    arcs = out;
  }

  /**
   * Edge-hugging L-path: short rounded corner out of the source, a vertical
   * run along the viewport margin, then a short rounded corner into the
   * target. A single cubic can't do this — any bezier from exit to entry
   * sweeps through mid-page as t ∈ [0,1], which is exactly where the prose
   * lives. Splitting the path into two short corner cubics joined by a V
   * line keeps the long middle segment pinned at `edgeX`.
   */
  function buildArcEdge(from: DOMRect, to: DOMRect, side: 'left' | 'right'): Arc {
    const margin = 28;
    const edgeX = side === 'right' ? vw - margin : margin;
    const ox = side === 'right' ? 1 : -1;
    const exitX  = side === 'right' ? from.right : from.left;
    const entryX = side === 'right' ? to.right   : to.left;
    const exitY  = from.top + from.height / 2;
    const entryY = to.top   + to.height / 2;
    const dy = entryY - exitY;
    const sy = Math.sign(dy) || 1;
    // Corner dimensions. Clamp the vertical offset so both corners fit even
    // when the source and target are close; clamp the horizontal offset so
    // tiny source/target widths don't cause weird inversions.
    const cornerV = Math.min(140, Math.abs(dy) * 0.35);
    const cornerH = Math.min(100,
      Math.max(24, Math.abs(edgeX - exitX) * 0.3),
      Math.max(24, Math.abs(edgeX - entryX) * 0.3),
    );
    // Corner cubics: start/end tangents are horizontal (into the page) and
    // the mid tangent is vertical (along the edge). Intermediate control
    // points at 25% of the corner offset give a visually quarter-turn feel.
    const p1x = exitX + ox * cornerH;
    const p2x = edgeX;
    const p2y = exitY + sy * cornerV * 0.25;
    const turnTopY = exitY + sy * cornerV;
    const turnBotY = entryY - sy * cornerV;
    const q1y = entryY - sy * cornerV * 0.25;
    const q2x = entryX + ox * cornerH;
    return {
      d:
        `M ${exitX} ${exitY} ` +
        `C ${p1x} ${exitY}, ${p2x} ${p2y}, ${edgeX} ${turnTopY} ` +
        `V ${turnBotY} ` +
        `C ${edgeX} ${q1y}, ${q2x} ${entryY}, ${entryX} ${entryY}`,
    };
  }

  async function recomputeModel(): Promise<void> {
    const myEpoch = ++recomputeModelEpoch;
    await tick();
    if (myEpoch !== recomputeModelEpoch) return; // stale — a newer call superseded this one
    const out: Arc[] = [];
    for (const { from, to, side } of MODEL_LINKS) {
      const fEl = cardOf(from);
      const tEl = cardOf(to);
      if (!fEl || !tEl) continue;
      out.push(buildArcEdge(fEl.getBoundingClientRect(), tEl.getBoundingClientRect(), side));
    }
    modelArcs = out;
  }

  $effect(() => { void recompute($hoveredCard); });

  onMount(() => {
    const updateViewport = () => { vw = window.innerWidth; vh = window.innerHeight; };
    updateViewport();
    recomputeModel();

    // Gate scroll-frame work on whether any model-link endpoint is actually
    // on screen. Before this, `recomputeModel` ran on every scroll frame
    // even when the pipeline was scrolled completely out of view.
    let anyModelLinkVisible = false;
    const visibility = new Map<Element, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visibility.set(entry.target, entry.isIntersecting);
        anyModelLinkVisible = false;
        for (const v of visibility.values()) if (v) { anyModelLinkVisible = true; break; }
      },
      { rootMargin: '200px' },
    );
    const observed = new Set<Element>();
    const observeCard = (id: string) => {
      const el = cardOf(id);
      if (el && !observed.has(el)) { io.observe(el); observed.add(el); }
    };
    // Observe all model-link endpoints plus any card referenced by OPS
    // (hover arcs terminate at pipeline cards).
    for (const link of MODEL_LINKS) { observeCard(link.from); observeCard(link.to); }
    for (const op of OPS) observeCard(String(op.num));

    let rafId: number | null = null;
    const onScrollOrResize = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateViewport();
        // Skip the full recompute when nothing's in view and nothing's
        // hovered AND nothing's currently drawn. The "and nothing drawn"
        // clause matters: the SVG is position:fixed, so if we early-return
        // while arcs are still in the array they'll appear glued to the
        // viewport while the page scrolls. Letting one more recompute run
        // clears the stale arcs, and the next frame can safely skip.
        if (
          !anyModelLinkVisible &&
          $hoveredCard == null &&
          arcs.length === 0 &&
          modelArcs.length === 0
        ) return;
        recompute($hoveredCard);
        recomputeModel();
      });
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafId != null) cancelAnimationFrame(rafId);
      io.disconnect();
    };
  });
</script>

<svg class="overlay" width={vw} height={vh}>
  <defs>
    <marker id="parrow-head" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
    <marker id="parrow-head-faint" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} opacity="0.55" />
    </marker>
  </defs>
  {#each modelArcs as arc, i (`m${i}`)}
    <path d={arc.d} fill="none" stroke={color} stroke-width="1.2"
      stroke-dasharray="4 5" opacity="0.45" marker-end="url(#parrow-head-faint)" />
  {/each}
  {#each arcs as arc, i (i)}
    <path d={arc.d} fill="none" stroke={color} stroke-width="1.6"
      stroke-dasharray="5 5" opacity="0.45" marker-end="url(#parrow-head-faint)" />
  {/each}
</svg>

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 50;
    overflow: visible;
  }
</style>
