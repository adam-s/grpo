<script lang="ts">
  /**
   * FocusStage — dark-theme wrapper around `FocusDemo`, used by the
   * `/pipeline/grid` overview route's "Focus" mode. The op-switcher bar
   * stays here since only this route exposes it; the animation + spec
   * logic lives in `FocusDemo`.
   */
  import FocusDemo from '../../lib/components/viz/FocusDemo.svelte';

  let { opId = $bindable('ratio') }: { opId?: string } = $props();

  const OPS: { id: string; label: string }[] = [
    { id: 'adv',   label: '04 · Â' },
    { id: 'ratio', label: '07 · ρ' },
    { id: 'pmin',  label: '09 · pmin' },
    { id: 'kl',    label: '10 · KL' },
    { id: 'obj',   label: '11 · J' },
  ];
</script>

<div class="host">
  <FocusDemo
    {opId}
    theme="dark"
    showOpBar
    opBar={OPS}
    onOpChange={(id) => (opId = id)}
  />
</div>

<style>
  .host {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: #0f0f12;
  }
  .host :global(> .stage) { height: 100%; }
</style>
