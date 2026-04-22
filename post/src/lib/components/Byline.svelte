<script lang="ts">
  // Fixed-position byline stack in the top-right corner — adamsohn.com
  // up top (matches reliably-incorrect), GitHub repo right beneath it.
</script>

<a
  class="badge"
  href="https://adamsohn.com"
  target="_blank"
  rel="noopener noreferrer"
>adamsohn.com</a>

<style>
  .badge {
    position: fixed;
    top: var(--space-lg);
    right: var(--space-lg);
    z-index: 40;
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium, 500);
    letter-spacing: 0.04em;
    color: var(--ink-muted);
    text-decoration: none;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    transition: color 0.15s ease, background 0.15s ease;
  }
  .badge:hover,
  .badge:focus-visible {
    color: var(--accent);
    background: var(--surface, var(--bg-subtle, #f0ede4));
    outline: none;
  }
  @media (max-width: 900px) {
    .badge {
      top: var(--space-sm);
      right: var(--space-sm);
    }
  }
</style>
