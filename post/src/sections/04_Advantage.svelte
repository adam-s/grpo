<script lang="ts">
  import Prose from '../lib/components/Prose.svelte';
  import Section from '../lib/components/Section.svelte';
  import Math from '../lib/components/Math.svelte';
  import OpGrid from '../pipeline/grid/OpGrid.svelte';
  import FocusDemo from '../lib/components/viz/FocusDemo.svelte';
</script>

<Section eyebrow="4 · Advantage" title="Group-relative, no critic" id="advantage">
  <Prose>
    <p>
      The advantage answers a simple question: <em>how did this trajectory perform compared to its peers?</em> We find out by standardizing the group's raw rewards:
    </p>
    <p style="text-align: center;">
      <Math
        tex={String.raw`\hat{A}_i = \frac{r_i - \operatorname{mean}(r_1, \dots, r_G)}{\operatorname{std}(r_1, \dots, r_G) + \epsilon}`} speak="advantage-formula"
        displayMode
      />
    </p>
    <p>
      This pivotal move allows GRPO to discard the heavy critic network required by older methods like PPO. The group's own mean <em>becomes</em> the baseline, and its standard deviation sets the scale. A positive <Math tex={String.raw`\hat{A}_i`} speak="advantage" /> means the trajectory outperformed its peers; a negative value means it underperformed.
    </p>
    <p>
      <em>Two notation notes.</em> The paper (Eq. 3) writes <Math tex={String.raw`\hat{A}_{i,t}`} speak="advantage-i-t" /> — a per-token advantage indexed by both trajectory <Math tex="i" /> and token position <Math tex="t" />. Under outcome supervision the reward is constant across all tokens in trajectory <Math tex="i" />, so <Math tex={String.raw`\hat{A}_{i,t} = \hat{A}_i`} speak="advantage-equal" /> and we drop the <Math tex="t" /> subscript throughout. The paper also omits the <Math tex={String.raw`+\epsilon`} speak="plus-epsilon" /> term; the small constant (typically 1e-8) is a numerical-stability addition standard in practice (e.g. TRL, OpenRLHF) and not part of the published formula.
    </p>
  </Prose>
  <OpGrid ops={[4]} perRow={2} theme="light" />
  <FocusDemo opId="adv" />
</Section>
