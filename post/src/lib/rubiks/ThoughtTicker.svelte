<script lang="ts">
  type Props = {
    text: string;
    progress: number;
    width: number;
  };
  let { text, progress, width }: Props = $props();

  let textW = $state(0);
  const offset = $derived(width - progress * (width + textW));
</script>

<div class="ticker" style:width="{width}px">
  <div class="inner" bind:clientWidth={textW} style:transform="translateX({offset}px)">
    {text}
  </div>
</div>

<style>
  .ticker {
    height: 1.5em;
    overflow: hidden;
    position: relative;
    mask-image: linear-gradient(
      to right,
      transparent 0%,
      transparent 8%,
      black 48%,
      black 52%,
      transparent 92%,
      transparent 100%
    );
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0%,
      transparent 8%,
      black 48%,
      black 52%,
      transparent 92%,
      transparent 100%
    );
  }
  .inner {
    position: absolute;
    top: 0;
    left: 0;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5em;
    color: var(--ink-subtle);
    will-change: transform;
  }
</style>
