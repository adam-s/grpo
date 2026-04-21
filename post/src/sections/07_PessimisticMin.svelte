<script lang="ts">
  import Prose from '../lib/components/Prose.svelte';
  import Section from '../lib/components/Section.svelte';
  import Math from '../lib/components/Math.svelte';
  import OpGrid from '../pipeline/grid/OpGrid.svelte';
  import FocusDemo from '../lib/components/viz/FocusDemo.svelte';
</script>

<Section eyebrow="7 · Pessimistic min" title="Take the worse of the two" id="pessimistic-min">
  <Prose>
    <p>
      For every token, GRPO constructs two candidates: the <em>raw</em> surrogate <Math tex={String.raw`\rho\,\hat{A}`} /> and its <em>clipped</em> counterpart <Math tex={String.raw`\operatorname{clip}(\rho)\,\hat{A}`} />. It takes the worse of the two:
    </p>
    <p style="text-align: center;">
      <Math
        tex={String.raw`\min\!\left(\rho_{i,t}\,\hat{A}_i,\; \operatorname{clip}(\rho_{i,t},\, 1-\varepsilon,\, 1+\varepsilon)\,\hat{A}_i\right)`} speak="pessimistic-min"
        displayMode
      />
    </p>
    <p>
      The three matrices below show one real GRPO update. Rows are the
      <Math tex={String.raw`G=8`} /> trajectories sampled in this step; columns are
      the token positions across each completion. Each cell is a single scalar.
      Hover any cell to trace that position across all three matrices.
    </p>
  </Prose>
  <OpGrid ops={[11, 12, 13]} perRow={2} theme="light" />
  <FocusDemo opId="surr1" />
  <FocusDemo opId="surr2" />
  <FocusDemo opId="pmin" />
  <Prose>
    <p>
      The key is deliberate <em>asymmetry</em>. When the advantage is positive,
      the <Math tex={String.raw`\min`} speak="min" /> caps the upside — once the
      probability ratio exceeds <Math tex={String.raw`1+\varepsilon`} />, extra
      confidence earns no credit. When negative, it selects the more negative term, ensuring bad moves can't escape blame.
    </p>
  </Prose>
</Section>
