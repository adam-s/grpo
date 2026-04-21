<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = { children: Snippet };
  let { children }: Props = $props();
</script>

<div class="prose">
  {@render children()}
</div>

<style>
  .prose {
    max-width: var(--measure);
    width: 100%;
    font-family: var(--font-serif);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--ink);
  }

  .prose :global(p) {
    margin-bottom: var(--space-lg);
  }

  .prose :global(p:last-child) {
    margin-bottom: 0;
  }

  .prose :global(h1) {
    font-size: var(--text-3xl);
    margin-bottom: var(--space-lg);
    margin-top: 0;
  }

  .prose :global(h2) {
    font-size: var(--text-2xl);
    margin-top: 0;
    margin-bottom: var(--space-md);
  }

  .prose :global(h3) {
    font-size: var(--text-xl);
    margin-top: var(--space-xl);
    margin-bottom: var(--space-sm);
  }

  .prose :global(em) { font-style: italic; }
  .prose :global(strong) { font-weight: var(--weight-semibold); }

  .prose :global(ul), .prose :global(ol) {
    margin: 0 0 var(--space-lg) var(--space-lg);
  }
  .prose :global(li) {
    margin-bottom: var(--space-sm);
  }
</style>
