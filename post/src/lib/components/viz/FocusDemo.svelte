<script lang="ts">
  /**
   * FocusDemo — one op, one focal cell, computation materialized mid-frame.
   *
   * Layout: input chips on the left, equation in the middle with slots that
   * fill in sequence, target cell on the right. Phase state machine:
   *   idle → src1 → src2 → inter → result → done
   *
   * Generalized from the original `/pipeline/grid` FocusStage so sections can
   * embed the same animator in light theme without the op-switcher bar.
   *
   * Sources of truth (all external):
   *   - `grpoData` / `focus` stores for the (g, t) coordinate + values
   *   - spec table below for per-op template + inputs + target slab
   *
   * The parent controls which op is shown via `opId`; `theme` swaps the
   * palette; `showOpBar` is only used by the standalone `/pipeline/grid`
   * focus route (sections don't show the bar).
   */
  import { grpoData, focus } from '../../stores/grpo-flow';
  import { fmt } from '../../../pipeline/flow/flow-utils';

  type Theme = 'dark' | 'light';

  type Props = {
    /** Op id from the spec table: 'reward' | 'adv' | 'ratio' | 'clip' | 'surr1' | 'surr2' | 'pmin' | 'kl' | 'obj'. */
    opId: string;
    /** Palette. Defaults to light (post embed). Dark matches the `/pipeline/grid` focus route. */
    theme?: Theme;
    /** Render the op-switcher bar above the panel. Only used by the standalone focus route. */
    showOpBar?: boolean;
    /** Op-switcher entries; consumed when `showOpBar` is true. */
    opBar?: { id: string; label: string }[];
    /** Callback when the user picks a new op from the bar. */
    onOpChange?: (id: string) => void;
  };

  let {
    opId,
    theme = 'light',
    showOpBar = false,
    opBar = [],
    onOpChange,
  }: Props = $props();

  let data = $derived($grpoData);
  let f = $derived($focus);

  // ── Per-op spec ────────────────────────────────────────────────────────
  type Spec = {
    title: string;
    color: string;
    inputs: { label: string; value: string }[];
    /** Literal chunks interleaved with slot markers `$0`, `$1`, ... */
    template: string;
    intermediate?: string;
    result: string;
    /** Matrix slab id the result lands in (used in the target label). */
    targetSlab: string;
  };

  function specFor(id: string): Spec | null {
    if (!data) return null;
    const g = f.g, t = f.t;
    switch (id) {
      case 'reward': {
        const comps = data.rewardComponents[g];
        const r = data.rewards[g] ?? NaN;
        if (!comps) return null;
        return {
          title: `r[${g}]`,
          color: '#d6a029',
          inputs: [
            { label: 'format',   value: fmt(comps.format_tags, 2) },
            { label: 'moves',    value: fmt(comps.moves_parse, 2) },
            { label: 'progress', value: fmt(comps.progress,    2) },
            { label: 'solved',   value: fmt(comps.solved,      2) },
            { label: 'brevity',  value: fmt(comps.brevity,     2) },
          ],
          template: '= $0 + $1 + $2 + $3 + $4',
          result: fmt(r, 3),
          targetSlab: 'rewards',
        };
      }
      case 'adv': {
        const r = data.rewards[g] ?? NaN;
        const mu = data.groupStats.mean;
        const sigma = data.groupStats.std;
        const A = data.advantages[g] ?? NaN;
        return {
          title: `Â[${g}]`,
          color: '#2a7a4a',
          inputs: [
            { label: `r[${g}]`, value: fmt(r, 3) },
            { label: 'μ',       value: fmt(mu, 3) },
            { label: 'σ',       value: fmt(sigma, 3) },
          ],
          template: '= ( $0 − $1 ) / $2',
          intermediate: `${fmt(r - mu, 3)} / ${fmt(sigma, 3)}`,
          result: fmt(A, 3),
          targetSlab: 'advantages',
        };
      }
      case 'ratio': {
        const a = data.newLogprobs[g]?.[t] ?? NaN;
        const r = data.ratios[g]?.[t] ?? NaN;
        const b = Number.isFinite(r) && r > 0 ? a - Math.log(r) : NaN;
        return {
          title: `ρ[${g},${t}]`,
          color: '#5b7cc5',
          inputs: [
            { label: `log πθ[${g},${t}]`,    value: fmt(a, 4) },
            { label: `log π_old[${g},${t}]`, value: fmt(b, 4) },
          ],
          template: '= exp( $0 − $1 )',
          intermediate: `exp(${fmt(a - b, 4)})`,
          result: fmt(r, 4),
          targetSlab: 'ratio',
        };
      }
      case 'clip': {
        const rho = data.ratios[g]?.[t] ?? NaN;
        const cl  = data.clipped[g]?.[t] ?? NaN;
        const EPS = 0.2;
        const lo = 1 - EPS, hi = 1 + EPS;
        let branch = 'uses ρ (inside trust region)';
        if (Number.isFinite(rho)) {
          if (rho > hi)      branch = `clamped to 1 + ε = ${fmt(hi, 2)}`;
          else if (rho < lo) branch = `clamped to 1 − ε = ${fmt(lo, 2)}`;
        }
        return {
          title: `clip(ρ)[${g},${t}]`,
          color: '#c46daf',
          inputs: [
            { label: `ρ[${g},${t}]`, value: fmt(rho, 4) },
            { label: '1 − ε',        value: fmt(lo, 2) },
            { label: '1 + ε',        value: fmt(hi, 2) },
          ],
          template: '= clip( $0 , $1 , $2 )',
          intermediate: branch,
          result: fmt(cl, 4),
          targetSlab: 'clipped',
        };
      }
      case 'surr1': {
        const rho = data.ratios[g]?.[t] ?? NaN;
        const A   = data.advantages[g] ?? NaN;
        return {
          title: `(ρ·Â)[${g},${t}]`,
          color: '#8b6cc5',
          inputs: [
            { label: `ρ[${g},${t}]`, value: fmt(rho, 4) },
            { label: `Â[${g}]`,      value: fmt(A, 3) },
          ],
          template: '= $0 · $1',
          result: fmt(rho * A, 4),
          targetSlab: 'surr1',
        };
      }
      case 'surr2': {
        const cl = data.clipped[g]?.[t] ?? NaN;
        const A  = data.advantages[g] ?? NaN;
        return {
          title: `(clip·Â)[${g},${t}]`,
          color: '#c46daf',
          inputs: [
            { label: `clip(ρ)[${g},${t}]`, value: fmt(cl, 4) },
            { label: `Â[${g}]`,            value: fmt(A, 3) },
          ],
          template: '= $0 · $1',
          result: fmt(cl * A, 4),
          targetSlab: 'surr2',
        };
      }
      case 'pmin': {
        const rho = data.ratios[g]?.[t] ?? NaN;
        const cl  = data.clipped[g]?.[t] ?? NaN;
        const A   = data.advantages[g] ?? NaN;
        const s1 = rho * A, s2 = cl * A;
        const pm = data.pessimisticMin[g]?.[t] ?? NaN;
        return {
          title: `pmin[${g},${t}]`,
          color: '#c75a5a',
          inputs: [
            { label: 'ρ·Â',       value: fmt(s1, 3) },
            { label: 'clip(ρ)·Â', value: fmt(s2, 3) },
          ],
          template: '= min( $0 , $1 )',
          result: fmt(pm, 3),
          targetSlab: 'pmin',
        };
      }
      case 'kl': {
        const nLp = data.newLogprobs[g]?.[t] ?? NaN;
        const rLp = data.refLogprobs[g]?.[t] ?? NaN;
        const d = rLp - nLp;
        const kl = data.klPerTok[g]?.[t] ?? NaN;
        return {
          title: `KL[${g},${t}]`,
          color: '#d67a29',
          inputs: [
            { label: `log πθ[${g},${t}]`,    value: fmt(nLp, 4) },
            { label: `log π_ref[${g},${t}]`, value: fmt(rLp, 4) },
          ],
          template: '= exp($1 − $0) − ($1 − $0) − 1',
          intermediate: `exp(${fmt(d, 4)}) − ${fmt(d, 4)} − 1`,
          result: fmt(kl, 5),
          targetSlab: 'kl',
        };
      }
      case 'obj': {
        const pm = data.pessimisticMin[g]?.[t] ?? NaN;
        const kl = data.klPerTok[g]?.[t] ?? NaN;
        const j  = data.objectivePerTok[g]?.[t] ?? NaN;
        return {
          title: `J[${g},${t}]`,
          color: '#5aad6a',
          inputs: [
            { label: 'pmin', value: fmt(pm, 4) },
            { label: 'β',    value: '0.04' },
            { label: 'KL',   value: fmt(kl, 5) },
          ],
          template: '= $0 − $1 · $2',
          intermediate: `${fmt(pm, 4)} − ${fmt(0.04 * kl, 5)}`,
          result: fmt(j, 4),
          targetSlab: 'objective',
        };
      }
      default: return null;
    }
  }

  let spec = $derived(specFor(opId));

  // Parse a template into literal + slot parts.
  type Part = { type: 'text'; text: string } | { type: 'slot'; idx: number };
  function parse(tpl: string): Part[] {
    const parts: Part[] = [];
    const re = /\$(\d+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(tpl)) !== null) {
      if (m.index > last) parts.push({ type: 'text', text: tpl.slice(last, m.index) });
      parts.push({ type: 'slot', idx: Number(m[1]) });
      last = m.index + m[0].length;
    }
    if (last < tpl.length) parts.push({ type: 'text', text: tpl.slice(last) });
    return parts;
  }

  let tpl = $derived(spec ? parse(spec.template) : []);

  function slotFilled(_i: number): boolean { return true; }
  function srcActive(_i: number): boolean { return false; }
  function resultReady(): boolean { return true; }
  function interReady(): boolean { return true; }
</script>

<div class="stage {theme}">
  {#if showOpBar && opBar.length}
    <nav class="opbar">
      {#each opBar as op}
        <button type="button"
          class="op-btn"
          class:active={opId === op.id}
          onclick={() => onOpChange?.(op.id)}>{op.label}</button>
      {/each}
    </nav>
  {/if}

  {#if !spec}
    <div class="empty">Select an op — still wiring this one up.</div>
  {:else}
    <div class="panel">
      <!-- Inputs -->
      <div class="inputs">
        {#each spec.inputs as inp, i}
          <div class="chip" class:pulse={srcActive(i)} style="--acc:{spec.color}">
            <span class="chip-label">{inp.label}</span>
            <span class="chip-value" style="color:{spec.color}">{inp.value}</span>
          </div>
        {/each}
      </div>

      <!-- Equation -->
      <div class="eq">
        <div class="eq-title" style="color:{spec.color}">{spec.title}</div>
        <div class="eq-body">
          {#each tpl as part}
            {#if part.type === 'text'}
              <span class="tok">{part.text}</span>
            {:else}
              <span class="slot" class:filled={slotFilled(part.idx)}>
                {#if slotFilled(part.idx)}
                  <span class="slot-value" style="color:{spec.color}">{spec.inputs[part.idx]?.value ?? ''}</span>
                {:else}
                  ▢
                {/if}
              </span>
            {/if}
          {/each}
        </div>
        <!-- Always render intermediate + result rows so their vertical space is
             reserved; phase flips visibility, not DOM presence. -->
        <div class="eq-inter" class:on={interReady()} class:reserved={!spec.intermediate}>
          {spec.intermediate ? `= ${spec.intermediate}` : ' '}
        </div>
        <div class="eq-result" class:on={resultReady()} style="color:{spec.color}">
          = {spec.result}
        </div>
      </div>

      <!-- Target -->
      <div class="target">
        <div class="target-label">lands in <span class="mono">{spec.targetSlab}[{f.g},{f.t}]</span></div>
        <div class="target-cell" class:on={resultReady()} style="--acc:{spec.color}">
          {resultReady() ? spec.result : ''}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .stage {
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    box-sizing: border-box;
    /* tabular digits so slot text doesn't reflow as values change width */
    font-variant-numeric: tabular-nums;
  }
  .stage.dark {
    background: #0f0f12;
    --panel-bg: #131318;
    --panel-border: #24242a;
    --chip-bg: #16161a;
    --chip-border: #2a2a30;
    --chip-pulse-border: #e6b94a;
    --chip-pulse-glow: rgba(230, 185, 74, 0.18);
    --chip-label: #888;
    --eq-text: #ccc;
    --eq-inter: #888;
    --slot-empty-border: #3a3a40;
    --slot-empty-text: #555;
    --slot-filled-bg: rgba(230, 185, 74, 0.04);
    --btn-bg: #16161a;
    --btn-border: #2a2a30;
    --btn-text: #9a9aa0;
    --btn-hover-bg: #1d1d22;
    --btn-hover-text: #ddd;
    --btn-active-bg: #221a0b;
    --btn-active-border: #3a2f12;
    --btn-active-text: #e6b94a;
    --meta-label: #888;
    --meta-mono: #ccc;
  }
  .stage.light {
    background: transparent;
    --panel-bg: var(--bg);
    --panel-border: var(--border);
    --chip-label: var(--ink-subtle);
    --eq-text: var(--ink);
    --eq-inter: var(--ink-muted);
    --slot-empty-border: var(--border-strong);
    --slot-empty-text: var(--ink-faded, #c8c4bb);
    --slot-filled-bg: rgba(31, 58, 95, 0.04);
    --btn-bg: var(--bg);
    --btn-border: var(--border);
    --btn-text: var(--ink-muted);
    --btn-hover-bg: var(--surface);
    --btn-hover-text: var(--ink);
    --btn-active-bg: rgba(31, 58, 95, 0.08);
    --btn-active-border: var(--accent);
    --btn-active-text: var(--accent);
    --meta-label: var(--ink-subtle);
    --meta-mono: var(--ink-muted);
  }

  .opbar {
    display: flex; align-items: center; gap: var(--space-xs);
    flex: 0 0 auto;
  }
  .op-btn {
    font-family: var(--font-mono);
    font-size: var(--text-xs); letter-spacing: 0.04em;
    padding: 4px var(--space-sm);
    background: var(--btn-bg); color: var(--btn-text);
    border: 1px solid var(--btn-border); border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 120ms, color 120ms, border-color 120ms;
  }
  .op-btn:hover { background: var(--btn-hover-bg); color: var(--btn-hover-text); }
  .op-btn.active {
    background: var(--btn-active-bg);
    color: var(--btn-active-text);
    border-color: var(--btn-active-border);
  }
  .spacer { flex: 1; }

  .empty {
    color: var(--meta-label);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    padding: var(--space-md);
  }

  .panel {
    display: grid;
    grid-template-columns: minmax(150px, auto) 1fr minmax(90px, auto);
    column-gap: var(--space-lg);
    row-gap: var(--space-xs);
    align-items: center;
    padding: var(--space-sm) var(--space-lg);
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: var(--radius-md);
  }
  @media (max-width: 720px) {
    .panel {
      grid-template-columns: 1fr;
      column-gap: 0;
    }
  }

  .inputs { display: flex; flex-direction: column; gap: var(--space-xs); }
  .chip {
    display: flex; align-items: baseline; gap: var(--space-sm);
    padding: 0;
  }
  .chip-label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--chip-label);
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip-value {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--ink-muted);
    flex: 0 0 auto;
    width: 8ch;
    text-align: right;
  }

  .eq { display: flex; flex-direction: column; gap: var(--space-xs); align-items: flex-start; }
  .eq-title {
    font-family: var(--font-serif);
    font-style: italic; font-size: var(--text-sm); font-weight: var(--weight-semibold);
  }
  .eq-body {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--eq-text);
    display: flex; align-items: center; gap: 3px; flex-wrap: wrap;
    line-height: 1.5;
  }
  .tok { white-space: pre; }
  .slot {
    display: inline-flex; align-items: baseline; justify-content: flex-end;
    width: 8ch;
    padding: 0 2px;
    box-sizing: border-box;
    text-align: right;
  }
  .slot-value {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .eq-inter, .eq-result {
    font-family: var(--font-mono);
    color: var(--eq-inter);
    min-height: 1.3em;
  }
  .eq-inter { font-size: var(--text-xs); }
  .eq-result { font-size: var(--text-sm); font-weight: var(--weight-semibold); }
  .eq-inter.reserved { visibility: hidden; min-height: 0; height: 0; }

  .target { display: flex; flex-direction: column; gap: 2px; align-items: flex-end; }
  .target-label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--meta-label);
  }
  .target-label .mono { color: var(--meta-mono); }
  .target-cell {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--acc, var(--eq-text));
    width: 8ch;
    text-align: right;
  }
</style>
