<script lang="ts">
  import katex from 'katex';
  import { play } from '../audio/play';

  type Props = {
    tex: string;
    displayMode?: boolean;
    /** If set, clicking the expression plays /audio/<speak>.mp3. */
    speak?: string;
  };

  let { tex, displayMode = false, speak }: Props = $props();

  const html = $derived(
    katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: 'html',
      strict: 'ignore',
      trust: (ctx) => ctx.command === '\\htmlClass',
    })
  );

  let hostEl: HTMLElement | undefined = $state();

  function onClick(e: MouseEvent): void {
    if (!speak || !hostEl) return;
    e.stopPropagation();
    play(speak, hostEl);
  }
</script>

{#if displayMode}
  <div
    class="math-block"
    class:speakable={!!speak}
    bind:this={hostEl}
    onclick={onClick}
    role={speak ? 'button' : undefined}
    tabindex={speak ? 0 : undefined}
    aria-label={speak ? 'Click to hear pronunciation' : undefined}
  >{@html html}</div>
{:else}
  <span
    class="math-inline"
    class:speakable={!!speak}
    bind:this={hostEl}
    onclick={onClick}
    role={speak ? 'button' : undefined}
    tabindex={speak ? 0 : undefined}
    aria-label={speak ? 'Click to hear pronunciation' : undefined}
  >{@html html}</span>
{/if}

<style>
  .math-block {
    display: flex;
    justify-content: safe center;
    padding: var(--space-sm) 0;
    overflow-x: auto;
    /* Reserve scrollbar gutter so long formulas that happen to scroll don't
       cause layout jitter on browsers that show scrollbars on hover. */
    scrollbar-gutter: stable;
  }

  .math-inline :global(.katex),
  .math-block :global(.katex) {
    color: inherit;
  }

  .math-inline :global(.katex-error),
  .math-block :global(.katex-error) {
    color: #dc3545;
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  /* Whole-expression click-to-play affordances. Only when `speak` is set. */
  .speakable {
    cursor: pointer;
    border-radius: 3px;
    transition: color 120ms ease, text-shadow 120ms ease;
  }
  .speakable:hover {
    color: var(--accent);
  }
  :global(.math-block.speakable.playing),
  :global(.math-inline.speakable.playing) {
    color: var(--accent);
    text-shadow:
      0 0 6px rgba(31, 58, 95, 0.35),
      0 0 1px rgba(31, 58, 95, 0.45);
  }
  .speakable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
