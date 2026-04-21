<script lang="ts">
  /**
   * FlowStage — two-row 3D "deck" of GRPO operation slabs.
   *
   * All 11 slabs are always visible across two rows. At rest every slab is
   * rotated on its Y axis (thin strip showing just its heatmap + label).
   * Click a slab and it animates: (a) its flex-basis grows, closing the gap
   * against its row-mates; (b) its rotation eases to 0° so it faces the
   * camera. Neighbors shrink their flex-basis in lockstep, so the row
   * stays viewport-width.
   */
  import Sankey from './Sankey.svelte';
  import PromptColumn     from './columns/PromptColumn.svelte';
  import RolloutsColumn   from './columns/RolloutsColumn.svelte';
  import RewardsColumn    from './columns/RewardsColumn.svelte';
  import AdvantageColumn  from './columns/AdvantageColumn.svelte';
  import LogThetaColumn   from './columns/LogThetaColumn.svelte';
  import LogOldColumn     from './columns/LogOldColumn.svelte';
  import RatioColumn      from './columns/RatioColumn.svelte';
  import ClipColumn       from './columns/ClipColumn.svelte';
  import SurrogatesColumn from './columns/SurrogatesColumn.svelte';
  import KlColumn         from './columns/KlColumn.svelte';
  import ObjectiveColumn  from './columns/ObjectiveColumn.svelte';

  let stageEl: HTMLDivElement | null = $state(null);
  let activeSlot = $state<string>('ratio');

  type Slot = { id: string; num: number; title: string; Comp: unknown };
  const TOP_ROW: Slot[] = [
    { id: 'prompt',    num: 1, title: 'Prompt',     Comp: PromptColumn },
    { id: 'rollouts',  num: 2, title: 'Rollouts',   Comp: RolloutsColumn },
    { id: 'rewards',   num: 3, title: 'Reward',     Comp: RewardsColumn },
    { id: 'adv',       num: 4, title: 'Advantage',  Comp: AdvantageColumn },
    { id: 'logtheta',  num: 5, title: 'log πθ',     Comp: LogThetaColumn },
    { id: 'logold',    num: 6, title: 'log π_old',  Comp: LogOldColumn },
  ];
  const BOTTOM_ROW: Slot[] = [
    { id: 'ratio',   num: 7,  title: 'Ratio ρ',        Comp: RatioColumn },
    { id: 'clipped', num: 8,  title: 'Clip',           Comp: ClipColumn },
    { id: 'surr',    num: 9,  title: 'Surrogates',     Comp: SurrogatesColumn },
    { id: 'kl',      num: 10, title: 'KL',             Comp: KlColumn },
    { id: 'obj',     num: 11, title: 'Objective + L',  Comp: ObjectiveColumn },
  ];

  function setActive(id: string) { activeSlot = id; }
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const flat = [...TOP_ROW, ...BOTTOM_ROW];
    const i = flat.findIndex((s) => s.id === activeSlot);
    if (i < 0) return;
    const next = e.key === 'ArrowRight'
      ? Math.min(flat.length - 1, i + 1)
      : Math.max(0, i - 1);
    activeSlot = flat[next].id;
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={onKey} />

<div bind:this={stageEl} class="stage" data-active={activeSlot}>
  {#each [TOP_ROW, BOTTOM_ROW] as row, rowIdx (rowIdx)}
    <div class="row" data-row={rowIdx}>
      {#each row as slot (slot.id)}
        {@const isActive = activeSlot === slot.id}
        {@const rowActiveIdx = row.findIndex((s) => s.id === activeSlot)}
        {@const slotIdx = row.findIndex((s) => s.id === slot.id)}
        {@const rowHasActive = rowActiveIdx !== -1}
        {@const rotateDir = rowHasActive
          ? (slotIdx < rowActiveIdx ? 1 : -1)   // left-of-active leans forward-right, right-of-active leans forward-left
          : -1}
        {@const C = slot.Comp as typeof PromptColumn}
        <button
          type="button"
          class="slot"
          class:active={isActive}
          style="--rot-dir: {rotateDir};"
          onclick={() => setActive(slot.id)}
          aria-pressed={isActive}
          aria-label={`${slot.num}. ${slot.title}`}
        >
          <div class="slot-head">
            <span class="slot-num">{String(slot.num).padStart(2, '0')}</span>
            <span class="slot-title">{slot.title}</span>
          </div>
          <div class="slot-body">
            <C />
          </div>
        </button>
      {/each}
    </div>
  {/each}

  {#if stageEl}
    <Sankey {stageEl} />
  {/if}
</div>

<style>
  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    background:
      radial-gradient(ellipse 90% 70% at 50% 50%, #0d0d11, #070708 75%);
    perspective: 2400px;
    perspective-origin: 50% 40%;
    padding: 16px 28px;
    overflow: hidden;
  }
  .row {
    flex: 1 1 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 12px 0;
    min-height: 0;
    transform-style: preserve-3d;
  }
  /* ── slab at rest ─────────────────────────────────────────── */
  .slot {
    /* iTunes CoverFlow-style: narrow resting strip leaning toward the active;
       expands in place on selection with neighbours closing in. */
    flex: 0 1 90px;        /* resting width (can shrink if row is tight) */
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    text-align: left;
    position: relative;

    transform-origin: 50% 50%;
    transform: perspective(1400px) rotateY(calc(var(--rot-dir, -1) * 32deg));
    transform-style: preserve-3d;
    filter: saturate(0.5) brightness(0.72);
    opacity: 0.82;
    transition:
      flex-basis 560ms cubic-bezier(0.25, 0.85, 0.25, 1),
      transform 560ms cubic-bezier(0.25, 0.85, 0.25, 1),
      filter 320ms ease,
      opacity 260ms ease;
    overflow: visible;
  }
  .slot:hover:not(.active) {
    filter: saturate(0.85) brightness(0.92);
    opacity: 1;
  }
  .slot.active {
    flex: 0 0 440px;          /* active expands in place */
    transform: perspective(1400px) rotateY(0deg) translateZ(60px);
    filter: saturate(1.1) brightness(1);
    opacity: 1;
    z-index: 20;
  }
  .slot-head {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: #6a6a70;
    padding: 2px 8px 4px;
    display: flex; align-items: baseline; gap: 8px;
    border-bottom: 1px solid #1d1d20;
    white-space: nowrap;
  }
  .slot.active .slot-head { color: #e6b94a; border-bottom-color: #3a2f12; }
  .slot-num { color: #4a4a4e; font-weight: 700; }
  .slot.active .slot-num { color: #e6b94a; }
  .slot-title { text-transform: uppercase; }
  .slot-body {
    position: relative;
    padding: 8px 10px;
    background: #0c0c0f;
    border: 1px solid #1a1a1c;
    border-radius: 4px;
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.55);
    overflow: hidden;
    /* Ensure the body fills the slot so the inner SVG has space to show. */
    width: 100%;
    box-sizing: border-box;
    max-height: 320px;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
  }
  .slot.active .slot-body {
    border-color: #2a2518;
    box-shadow: 0 16px 46px rgba(0, 0, 0, 0.75),
                0 0 0 1px rgba(230, 185, 74, 0.18) inset;
  }
  /* Inner column: let SVG scale down in compact mode, stay native when active */
  .slot :global(.col) { width: 100%; height: auto; }
  .slot :global(.col > svg) {
    display: block;
    max-width: 100%;
    max-height: 300px;
    height: auto;
    width: auto;
  }
  .slot.active :global(.col > svg) {
    max-width: none;
    max-height: 300px;
  }

  /* Hide text in non-active slabs so the rotated strip reads as a heatmap */
  .slot:not(.active) :global(text.ms-cell) { display: none; }
  .slot:not(.active) :global(text.ms-title) { opacity: 0; transition: opacity 200ms; }
  .slot:not(.active) :global(text.ms-colhdr),
  .slot:not(.active) :global(text.ms-rowlbl) { opacity: 0.25; }
</style>
