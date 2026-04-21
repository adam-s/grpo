<script lang="ts">
  import Math from './Math.svelte';
  import { play } from '../audio/play';
  import { hoveredFormulaPart } from '../stores/grpo';

  export type FormulaPart =
    | 'all'
    | 'group'
    | 'per-token'
    | 'advantage'
    | 'ratio'
    | 'clip'
    | 'min'
    | 'kl';

  const SYM_TO_PART: Record<string, FormulaPart> = {
    group: 'group', pertoken: 'per-token',
    advantage: 'advantage', ratio: 'ratio',
    clip: 'clip', min: 'min', kl: 'kl',
  };

  type Props = { focus?: FormulaPart };
  let { focus = 'all' }: Props = $props();

  let effectiveFocus = $derived($hoveredFormulaPart as FormulaPart ?? focus);

  // Every chunk is wrapped in two classes:
  //   part-X   — used by the focus-fade CSS (preserved)
  //   sym-X    — used by click-to-pronounce; matches an id in post/audio/registry.py
  // Parts of the formula with no pronounceable meaning (brackets, `=`, commas)
  // are left untagged so they don't respond to hover.
  const tex = String.raw`
\htmlClass{sym-j}{J_{\text{GRPO}}(\theta)}
= \htmlClass{sym-expectation}{\mathbb{E}_{q,\,o_i \sim \pi_{\text{old}}}}
\Big[
\htmlClass{part-group sym-group}{\tfrac{1}{G}\sum_{i}}
\htmlClass{part-per-token sym-pertoken}{\tfrac{1}{|o_i|}\sum_{t}}
\htmlClass{part-min sym-min}{\min\!\big(}
\htmlClass{part-ratio sym-ratio}{\rho_{i,t}}
\htmlClass{part-advantage sym-advantage}{\hat{A}_i},\,
\htmlClass{part-clip sym-clip}{\operatorname{clip}(\rho_{i,t},\,1\!\pm\!\varepsilon)}\,
\htmlClass{part-advantage sym-advantage}{\hat{A}_i}
\htmlClass{part-min sym-min}{\big)}
-\htmlClass{part-kl sym-kl}{\beta\,\operatorname{KL}(\pi_\theta \,\|\, \pi_{\text{ref}})}
\Big]
`;

  function getSymFromTarget(target: EventTarget | null): { id: string; el: Element } | null {
    let el = target instanceof Element ? target : null;
    while (el) {
      const match = [...el.classList].find((c) => c.startsWith('sym-'));
      if (match) return { id: match.slice(4), el };
      el = el.parentElement;
    }
    return null;
  }

  function onClick(e: MouseEvent): void {
    const hit = getSymFromTarget(e.target);
    if (!hit) return;
    e.stopPropagation();
    play(hit.id, hit.el);
  }

  function onHover(e: MouseEvent): void {
    const hit = getSymFromTarget(e.target);
    if (hit && SYM_TO_PART[hit.id]) {
      hoveredFormulaPart.set(SYM_TO_PART[hit.id]);
    }
  }

  function onLeave(): void {
    hoveredFormulaPart.set(null);
  }
</script>

<div class="math-group" role="group" aria-label="GRPO objective — click a symbol to hear it pronounced">
  <div class="formula" data-focus={effectiveFocus} onclick={onClick} onmouseover={onHover} onmouseout={onLeave}>
    <Math {tex} displayMode />
  </div>
</div>

<style>
  .math-group {
    width: 100%;
    position: relative;
  }

  .formula {
    width: 100%;
    display: flex;
    justify-content: safe center;
    overflow-x: auto;
    padding: var(--space-md) 0;
  }

  .formula :global(.katex-display) {
    margin: 0;
    overflow-x: visible;
  }

  @media (max-width: 700px) {
    .formula :global(.katex) {
      font-size: 0.92em;
    }
  }

  .hint {
    text-align: center;
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    color: var(--ink-subtle);
    margin-top: var(--space-xs);
    letter-spacing: 0.04em;
  }

  /* Focus fade — unchanged. */
  .formula :global(.part-group),
  .formula :global(.part-per-token),
  .formula :global(.part-ratio),
  .formula :global(.part-advantage),
  .formula :global(.part-clip),
  .formula :global(.part-min),
  .formula :global(.part-kl) {
    color: var(--ink-faded);
    transition: color 240ms ease;
  }
  .formula[data-focus="all"] :global(.part-group),
  .formula[data-focus="all"] :global(.part-per-token),
  .formula[data-focus="all"] :global(.part-ratio),
  .formula[data-focus="all"] :global(.part-advantage),
  .formula[data-focus="all"] :global(.part-clip),
  .formula[data-focus="all"] :global(.part-min),
  .formula[data-focus="all"] :global(.part-kl) {
    color: var(--ink);
  }
  .formula[data-focus="group"] :global(.part-group),
  .formula[data-focus="per-token"] :global(.part-per-token),
  .formula[data-focus="advantage"] :global(.part-advantage),
  .formula[data-focus="ratio"] :global(.part-ratio),
  .formula[data-focus="clip"] :global(.part-clip),
  .formula[data-focus="min"] :global(.part-min),
  .formula[data-focus="kl"] :global(.part-kl) {
    color: var(--ink);
  }

  /* Click-to-pronounce affordances.
     `position: relative` + `z-index` lifts the sym above KaTeX's vlist rows
     in aligned math — without it, invisible vlist spans for the first row
     intercept pointer events over the second row. */
  .math-group :global([class*="sym-"]) {
    position: relative;
    z-index: 1;
    cursor: pointer;
    transition: color 120ms ease, text-shadow 120ms ease;
  }
  .math-group :global([class*="sym-"]:hover) {
    color: var(--accent) !important;
    text-shadow: 0 0 4px rgba(31, 58, 95, 0.18);
  }
  .math-group :global(.playing) {
    color: var(--accent) !important;
    text-shadow:
      0 0 6px rgba(31, 58, 95, 0.38),
      0 0 1px rgba(31, 58, 95, 0.5);
  }
</style>
