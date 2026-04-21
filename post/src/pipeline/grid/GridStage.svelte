<script lang="ts">
  /**
   * GridStage — Overview: all 14 GRPO op cards in a 12-col grid.
   *
   * Thin wrapper around `OpGrid` that renders the full set. Per-section embeds
   * pick subsets from the same `OPS` list so card numbering stays consistent.
   */
  import OpGrid from './OpGrid.svelte';
  import { ALL_OP_NUMS } from './ops';
</script>

<div class="stage-host">
  <OpGrid ops={ALL_OP_NUMS} rows={3} />
</div>

<style>
  .stage-host {
    flex: 1;
    min-height: 0;
    padding: 10px 14px;
    overflow: hidden;
    display: flex;
  }
  .stage-host :global(> .stage) { flex: 1; min-height: 0; }
</style>
