<script lang="ts">
  import Prose from '../lib/components/Prose.svelte';
  import Section from '../lib/components/Section.svelte';
  import Math from '../lib/components/Math.svelte';
  import OpGrid from '../pipeline/grid/OpGrid.svelte';
  import SoftmaxBars from '../lib/components/viz/SoftmaxBars.svelte';
</script>

<Section eyebrow="2 · Group sampling" title="A group of G rollouts" id="group-sampling">
  <Prose>
    <p>
      The process begins with a single prompt <Math tex="q" speak="q" />. The sample policy generates a group of <Math tex="G" speak="G" /> trajectories:
    </p>
    <p style="text-align: center;">
      <Math tex={String.raw`\{o_i\}_{i=1}^{G} \sim \pi_{\text{old}}(\cdot \mid q)`} speak="sampling-dist" displayMode />
    </p>
    <p>
      In practice, <Math tex="G" speak="G" /> is usually between 8 and 64; the DeepSeekMath paper uses <Math tex="G=64" speak="G equals 64" /> for its 7B model experiments. Our toy uses <Math tex="G=8" speak="G equals 8" /> to keep the matrices readable on-screen. This group acts as the sole baseline. There is no external critic. Every trajectory is strictly judged against its peers.
    </p>
  </Prose>
  <OpGrid ops={[2]} perRow={2} theme="light" />
  <SoftmaxBars policy="old" />
</Section>
