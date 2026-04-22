<script lang="ts">
  import Prose from '../lib/components/Prose.svelte';
  import Section from '../lib/components/Section.svelte';
  import Math from '../lib/components/Math.svelte';
  import OpGrid from '../pipeline/grid/OpGrid.svelte';
  import FocusDemo from '../lib/components/viz/FocusDemo.svelte';
  import SoftmaxBars from '../lib/components/viz/SoftmaxBars.svelte';
</script>

<Section eyebrow="5 · Ratio" title="How much has the policy moved?" id="ratio">
  <Prose>
    <p>
      For every token, the probability ratio measures how far the active policy has drifted from the sample policy on that exact move:
    </p>
    <p style="text-align: center;">
      <Math
        tex={String.raw`\rho_{i,t} = \frac{\pi_\theta(o_{i,t} \mid q, o_{i,<t})}{\pi_{\text{old}}(o_{i,t} \mid q, o_{i,<t})}`} speak="ratio-formula"
        displayMode
      />
    </p>
    <p>
      A ratio of 1 means confidence hasn't budged. Greater than 1 means the active policy is <em>more</em> confident; below 1 means it's backing away. This importance-sampling correction lets me train the live model using trajectories from a frozen snapshot.
    </p>
  </Prose>
  <OpGrid ops={[5, 6, 7]} perRow={2} theme="light" />
  <div class="softmax-pair">
    <SoftmaxBars policy="theta" />
    <SoftmaxBars policy="old" />
  </div>
  <FocusDemo opId="ratio" />
</Section>

<style>
  .softmax-pair {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
  }
  .softmax-pair :global(> *) { flex: 1 1 280px; max-width: 420px; }
</style>
