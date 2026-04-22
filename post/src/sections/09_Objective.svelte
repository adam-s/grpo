<script lang="ts">
  import Prose from '../lib/components/Prose.svelte';
  import Section from '../lib/components/Section.svelte';
  import Math from '../lib/components/Math.svelte';
  import OpGrid from '../pipeline/grid/OpGrid.svelte';
  import FocusDemo from '../lib/components/viz/FocusDemo.svelte';
</script>

<Section eyebrow="9 · Reassembled" title="The whole objective" id="objective">
  <Prose>
    <p>
      Assemble the parts. A group of trajectories supplies a baseline, and advantage standardizes each trajectory against it. The ratio forms an importance-weighted update. The clip and <Math tex={String.raw`\min`} speak="min" /> operations keep that update pessimistic, while KL pulls the policy safely back toward the reference.
    </p>
  </Prose>
  <OpGrid ops={[14, 15]} perRow={2} theme="light" />
  <FocusDemo opId="obj" />
  <Prose>
    <p>
      None of this requires a critic model or a learned value function. The group does the job—it's cheaper to compute, and for reasoning tasks with rule-based rewards, it's enough.
    </p>
    <p>
      Here is a full training run—1,838 steps of curriculum from 1-move to 20-move scrambles. Solved rate climbs, clip fraction spikes on hard scrambles, and KL stays small. Click any step to propagate it through every figure above.
    </p>
  </Prose>
</Section>
