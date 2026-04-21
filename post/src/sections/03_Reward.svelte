<script lang="ts">
  import Prose from '../lib/components/Prose.svelte';
  import Section from '../lib/components/Section.svelte';
  import Math from '../lib/components/Math.svelte';
  import OpGrid from '../pipeline/grid/OpGrid.svelte';
  import FocusDemo from '../lib/components/viz/FocusDemo.svelte';
</script>

<Section eyebrow="3 · Reward" title="A scalar per rollout" id="reward">
  <Prose>
    <p>
      Once generated, each trajectory <Math tex="o_i" speak="o-i" /> receives a single scalar reward:
    </p>
    <p style="text-align: center;">
      <Math tex="r_i = R(q, o_i)" speak="reward-formula" displayMode />
    </p>
    <p>
      For reasoning tasks, this is rarely delegated to a second neural network. It's a hard, rule-based check: did the math equate? Was the Rubik's cube solved? Notably, this raw reward never appears in the final loss function directly. It merely sets the stage for the advantage.
    </p>
  </Prose>
  <OpGrid ops={[3]} perRow={2} theme="light" />
  <FocusDemo opId="reward" />
</Section>
