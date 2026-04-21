<script lang="ts">
  import Section from '../lib/components/Section.svelte';
  import Prose from '../lib/components/Prose.svelte';
  import FormulaWithFocus from '../lib/components/FormulaWithFocus.svelte';
  import CubeGridSimple from '../lib/rubiks/CubeGridSimple.svelte';
  import { isMobile } from '../lib/stores/viewport';
</script>

<Section eyebrow="Opening" title="Group Relative Policy Optimization, visualized step by step" id="opening">
  <Prose>
    <p>
      To teach language models to reason at scale, you need a training method that
      doesn't collapse under its own weight. GRPO achieves this by replacing a
      complex value network with a simple mechanism: group sampling.
    </p>
    <p>
      These interactive matrices aren't mockups—they are exact tensors from a tiny custom Transformer trained from scratch. We chose a Rubik's cube as the training task: it requires strict multi-step planning, has an objective goal, and the model's "chain of thought" is simply the sequence of moves.
    </p>
  </Prose>

  <CubeGridSimple depths={$isMobile ? [3] : [1, 2, 3]} cubeSize={32} tickerWidth={180} />

  <Prose>
    <p>
      This is a trivial toy learning to reverse a short scramble. Its sole purpose is to produce real, minimal data that fits on your screen, letting us trace GRPO's mechanics without billions of parameters.
    </p>
    <p>
      The objective function looks dense on paper, but inside the tensors, it’s
      beautiful. Let's step through the math visually.
    </p>
  </Prose>

  <FormulaWithFocus focus="all" />
</Section>
