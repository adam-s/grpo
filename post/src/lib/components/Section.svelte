<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    eyebrow?: string;
    title: string;
    children: Snippet;
    id?: string;
  };

  let { eyebrow, title, children, id }: Props = $props();
</script>

<section class="section" {id}>
  <header class="header">
    {#if eyebrow}
      <div class="eyebrow">{eyebrow}</div>
    {/if}
    <h2>{title}</h2>
  </header>
  <div class="body">
    {@render children()}
  </div>
</section>

<style>
  .section {
    width: 100%;
    max-width: var(--figure-width);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    align-items: center;
  }

  .header {
    width: 100%;
    max-width: var(--measure);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .eyebrow {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-subtle);
  }

  .body {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
  }
</style>
