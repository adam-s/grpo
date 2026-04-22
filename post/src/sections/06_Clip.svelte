<script lang="ts">
  import Prose from '../lib/components/Prose.svelte';
  import Section from '../lib/components/Section.svelte';
  import Math from '../lib/components/Math.svelte';
  import OpGrid from '../pipeline/grid/OpGrid.svelte';
  import FocusDemo from '../lib/components/viz/FocusDemo.svelte';
</script>

<Section eyebrow="6 · Clip" title="A trust region on the ratio" id="clip">
  <Prose>
    <p>
      To prevent the active policy from updating too aggressively, I clip the probability ratio to a narrow window:
    </p>
    <p style="text-align: center;">
      <Math
        tex={String.raw`\operatorname{clip}(\rho_{i,t},\, 1-\varepsilon,\, 1+\varepsilon)`} speak="clip"
        displayMode
      />
    </p>
    <p>
      With <Math tex={String.raw`\varepsilon=0.2`} speak="epsilon-approx" />, the ratio is bounded between <Math tex="[0.8, 1.2]" speak="eps-bounds" />. Inherited from PPO, this safeguard recognizes that gradients become unreliable when the policy wanders too far. By clipping, the model refuses to assign excessive credit—or blame—to any single move.
    </p>
  </Prose>
  <OpGrid ops={[8]} perRow={2} theme="light" />
  <FocusDemo opId="clip" />
</Section>
