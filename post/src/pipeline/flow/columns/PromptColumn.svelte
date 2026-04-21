<script lang="ts">
  import { grpoData } from '../../../lib/stores/grpo-flow';
  import MatrixSlab from '../../MatrixSlab.svelte';

  let data = $derived($grpoData);
  let tokens = $derived(data?.prompt_tokens ?? []);
  let rows = $derived(tokens.map((t) => ({ lbl: '', cells: [t] as (string | number)[] })));
  let H = $derived(16 + 22 + rows.length * 20 + 16);
</script>

<div class="col">
  <svg width="160" height={H} viewBox="0 0 160 {H}" preserveAspectRatio="xMinYMin meet">
    {#if data}
      <MatrixSlab
        slabId="prompt"
        title="prompt q"
        cols={[{ label: 'tok', w: 100 }]}
        rows={rows}
        rowLblW={6}
        tint="#7c5bbf"
      />
    {/if}
  </svg>
</div>

<style>
  .col { min-width: 160px; flex: 0 0 auto; }
  svg { display: block; width: 100%; height: auto; }
</style>
