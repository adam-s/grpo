<script lang="ts">
  import Prose from '../lib/components/Prose.svelte';
  import Section from '../lib/components/Section.svelte';
</script>

<Section eyebrow="10 · Conclusion" title="The takeaway" id="conclusion">
  <Prose>
    <p>
      GRPO strips reinforcement learning to its essentials. By dropping the learned value function and relying on the group for a baseline, it simplifies architecture and saves memory.
    </p>
    <p>
      For strictly verifiable tasks—like math, coding, or Rubik's cubes—this relative scoring is all you need. The agent explores, measures success against its peers, and securely steps toward a better policy.
    </p>
    <p>
      It is an elegant, robust algorithm proving that sometimes doing less achieves more.
    </p>
  </Prose>
</Section>
