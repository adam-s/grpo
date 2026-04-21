<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = { children: Snippet };
  let { children }: Props = $props();
</script>

<div class="layout">
  <main class="content">
    {@render children()}
  </main>
</div>

<style>
  .layout {
    min-height: 100vh;
    max-width: 1100px;
    margin: 0 auto;
  }

  .content {
    min-width: 0;
    /* Bottom padding reserves room for the fixed PlaybackBar so the final
       section isn't clipped; ~56px bar + a breath of space. */
    padding: var(--space-3xl) var(--space-xl) calc(var(--space-3xl) + 56px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2xl);
  }

  @media (max-width: 900px) {
    .content {
      padding: var(--space-xl) var(--space-md) calc(var(--space-3xl) + 48px);
      gap: var(--space-xl);
    }
  }
</style>
