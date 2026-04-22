<script lang="ts">
  import Prose from '../lib/components/Prose.svelte';
  import Section from '../lib/components/Section.svelte';
  import Math from '../lib/components/Math.svelte';
  import OpGrid from '../pipeline/grid/OpGrid.svelte';
  import FocusDemo from '../lib/components/viz/FocusDemo.svelte';
  import SoftmaxBars from '../lib/components/viz/SoftmaxBars.svelte';
  import KLCubeFigure from '../lib/rubiks/KLCubeFigure.svelte';
</script>

<Section eyebrow="8 · KL" title="Anchor to the reference" id="kl">
  <Prose>
    <p>
      To prevent the active policy from collapsing, GRPO subtracts a strict regularization term from the objective:
    </p>
    <p style="text-align: center;">
      <Math tex={String.raw`-\,\beta\,\operatorname{KL}\!\left(\pi_\theta \,\|\, \pi_{\text{ref}}\right)`} speak="kl-penalty" displayMode />
    </p>
    <p>
      Older RLHF pipelines (InstructGPT-style) bake this KL penalty into the per-token reward signal. GRPO untangles them, holding KL divergence as a distinct penalty term in the objective. The coefficient <Math tex={String.raw`\beta`} speak="beta" /> (often 0.04) acts as the leash tension, dictating how fiercely the active policy anchors back to the reference model.
    </p>
    <p>
      Picture the two policies as bell curves over the move vocabulary.
      <em>π<sub>ref</sub></em> is the blue bell — broader, the
      reference's confident-but-spread opinion. <em>π<sub>θ</sub></em> is
      the red bell behind it — narrower and taller, because gradient
      updates have made the active policy confident about a different
      region. KL measures how much that red bell has wandered away.
    </p>
  </Prose>

  <KLCubeFigure />

  <Prose>
    <p>
      In code, GRPO uses an unbiased per-token KL estimator (the <em>k3</em> estimator from <a href="http://joschu.net/blog/kl-approx.html">Schulman's KL-approximation post</a>, also used in the paper's Eq. 4) instead of summing over the full vocabulary every step:
    </p>
    <p style="text-align: center;">
      <Math
        tex={String.raw`\Delta_t = \log \pi_{\text{ref}}(a_t) - \log \pi_\theta(a_t) \qquad \operatorname{kl}_t = e^{\Delta_t} - \Delta_t - 1`}
        speak="k3-estimator"
        displayMode
      />
    </p>
    <p>
      <span class="mono">kl<sub>t</sub></span> is always ≥ 0, zero only
      when the two policies agree on the chosen move. The matrices below
      show the reference policy's log-probabilities and the resulting
      per-token KL across all <Math tex="G" speak="G" /> rollouts. Hover
      any cell to trace that value through the focus panel.
    </p>
  </Prose>
  <OpGrid ops={[9, 10]} perRow={2} theme="light" />
  <SoftmaxBars policy="ref" />
  <FocusDemo opId="kl" />
</Section>
