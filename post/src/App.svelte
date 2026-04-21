<script lang="ts">
  import Layout from './lib/components/Layout.svelte';
  import PipelineArrows from './lib/components/PipelineArrows.svelte';
  import PlaybackBar from './lib/components/PlaybackBar.svelte';
  import Opening from './sections/00_Opening.svelte';
  import Background from './sections/00b_Background.svelte';
  import Models from './sections/01_Models.svelte';
  import GroupSampling from './sections/02_GroupSampling.svelte';
  import Reward from './sections/03_Reward.svelte';
  import Advantage from './sections/04_Advantage.svelte';
  import Ratio from './sections/05_Ratio.svelte';
  import Clip from './sections/06_Clip.svelte';
  import PessimisticMin from './sections/07_PessimisticMin.svelte';
  import KL from './sections/08_KL.svelte';
  import Objective from './sections/09_Objective.svelte';
  import Conclusion from './sections/10_Conclusion.svelte';
</script>

<Layout>
  <Opening />
  <Background />
  <Models />
  <GroupSampling />
  <Reward />
  <Advantage />
  <Ratio />
  <Clip />
  <KL />
  <PessimisticMin />
  <Objective />
  <Conclusion />
</Layout>

<PipelineArrows />
<PlaybackBar />
