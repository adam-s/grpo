<script lang="ts">
  import { focusedSummary } from '../../lib/stores/grpo-flow';
  import { fmt } from './flow-utils';

  let s = $derived($focusedSummary);
</script>

<div class="card" aria-label="Focused rollout summary">
  {#if s}
    <div class="head">
      <span class="kicker">focused</span>
      <span class="title">g = {s.g} · t = {s.t}</span>
      <span class="tok">"{s.token.slice(0, 10)}"</span>
    </div>
    <dl class="stats">
      <dt>r</dt>          <dd>{fmt(s.r, 3)}</dd>
      <dt>Â</dt>          <dd class:pos={s.adv >= 0} class:neg={s.adv < 0}>{fmt(s.adv, 3)}</dd>
      <dt>log πθ</dt>     <dd>{fmt(s.newLp, 3)}</dd>
      <dt>log π_old</dt>  <dd>{fmt(s.oldLp, 3)}</dd>
      <dt>log π_ref</dt>  <dd>{fmt(s.refLp, 3)}</dd>
      <dt>ρ</dt>          <dd class:pos={s.ratio > 1.02} class:neg={s.ratio < 0.98}>{fmt(s.ratio, 3)}</dd>
      <dt>clip(ρ)</dt>    <dd>{fmt(s.clipped, 3)}</dd>
      <dt>pmin</dt>       <dd class:pos={s.pmin > 0} class:neg={s.pmin < 0}>{fmt(s.pmin, 3)}</dd>
      <dt>KL</dt>         <dd class="kl">{fmt(s.kl, 4)}</dd>
      <dt>J</dt>          <dd class:pos={s.j > 0} class:neg={s.j < 0}>{fmt(s.j, 3)}</dd>
      <dt>L</dt>          <dd class="loss">{fmt(s.loss, 5)}</dd>
    </dl>
    <div class="foot">{s.solved ? 'solved ✓' : 'not solved'}</div>
  {:else}
    <div class="empty">hover any cell</div>
  {/if}
</div>

<style>
  .card {
    position: sticky; top: 12px;
    min-width: 180px; max-width: 220px;
    padding: 10px 12px;
    background: #0f0f12; border: 1px solid #222; border-radius: 6px;
    font-family: 'JetBrains Mono', monospace; color: #ddd;
  }
  .head { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #1e1e1e; }
  .kicker { font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
  .title  { font-size: 11px; font-weight: 700; color: #e6b94a; }
  .tok    { font-size: 10px; color: #888; }
  .stats  { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; margin: 0; font-size: 10px; }
  .stats dt { color: #666; }
  .stats dd { margin: 0; color: #ddd; text-align: right; }
  .stats .pos  { color: #5aad6a; }
  .stats .neg  { color: #c75a5a; }
  .stats .kl   { color: #d67a29; }
  .stats .loss { color: #4a9; font-weight: 700; }
  .foot  { margin-top: 8px; font-size: 9px; color: #666; text-align: right; }
  .empty { font-size: 10px; color: #555; font-style: italic; }
</style>
