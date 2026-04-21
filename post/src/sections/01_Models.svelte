<script lang="ts">
  import Prose from '../lib/components/Prose.svelte';
  import Section from '../lib/components/Section.svelte';
  import Math from '../lib/components/Math.svelte';
  import ModelDiagram from '../lib/components/viz/ModelDiagram.svelte';
  import ModelDiagramPlaceholder from '../lib/components/viz/ModelDiagramPlaceholder.svelte';
  import { isMobile } from '../lib/stores/viewport';
</script>

<Section eyebrow="1 · Setup" title="Four actors" id="models">
  <Prose>
    <p>
      Before dissecting the loss function, let's identify the actors. GRPO operates on four core components:
    </p>
    <ul>
      <li>
        <Math tex={String.raw`\pi_\theta`} speak="pi-theta" /> — the <strong>active policy</strong>. 
        This is the model being trained; its weights <Math tex={String.raw`\theta`} speak="theta" /> are the only ones updating.
      </li>
      <li>
        <Math tex={String.raw`\pi_{\text{old}}`} speak="pi-old" /> — the <strong>sample policy</strong>. 
        A frozen snapshot of the active policy used to generate the current step's sequences.
      </li>
      <li>
        <Math tex={String.raw`\pi_{\text{ref}}`} speak="pi-ref" /> — the <strong>reference policy</strong>. 
        A frozen anchor (usually the original SFT model) that stops the active policy from drifting into gibberish.
      </li>
      <li>
        <Math tex="R(q, o)" speak="R-func" /> — the <strong>reward</strong>. A strict scalar score 
        awarded to each completed trajectory.
      </li>
    </ul>
    <p>
      As we step through the math, these won't remain abstract symbols. Each becomes a real tensor: policies as grids of log-probabilities, and the reward as a terminal score.
    </p>
  </Prose>
  {#if $isMobile === true}
    <ModelDiagramPlaceholder />
  {:else if $isMobile === false}
    <ModelDiagram />
  {:else}
    <ModelDiagramPlaceholder />
  {/if}
</Section>
