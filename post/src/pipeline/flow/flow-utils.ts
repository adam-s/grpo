/**
 * Shared helpers for the flow columns: formatting, color palettes, and a
 * self-normalizing cell-color function factory (the Transformer-Explainer
 * MatrixSvg pattern).
 *
 * Theming: every column renders on either the dark `/pipeline/*` routes or
 * inside the light post. The columns read a `FlowTheme` from Svelte context
 * (defaulting to `DARK_THEME`) and pass it into the helpers here.
 */

import { getContext } from 'svelte';

export function fmt(x: unknown, d = 2): string {
  if (typeof x !== 'number' || !isFinite(x)) return typeof x === 'string' ? x : '—';
  return x.toFixed(d);
}

// ── Theme ────────────────────────────────────────────────────────────────

export type FlowTheme = {
  /** Cell-color base (matrix min/zero lerps from this). */
  base: string;
  /** Divergent-matrix positive-pole tint. */
  posTint: string;
  /** Divergent-matrix negative-pole tint. */
  negTint: string;
  /** Soft positive tint used by `signTint` / `ratioTint`. */
  posSoft: string;
  /** Soft negative tint used by `signTint` / `ratioTint`. */
  negSoft: string;
  /** Ambient cell-value text. */
  textDefault: string;
  /** Row-focused (non-cell) cell-value text. */
  textFocused: string;
  /** Cell-focused (crosshair-selected) cell-value text. */
  textFocus: string;
  /** Row/col header text — un-focused. */
  headerText: string;
  /** SVG frame stroke around the slab. */
  frame: string;
  /** Cell-edge grid lines inside the slab. */
  gridLine: string;
  /** Accent color used for focus highlight (row/col/cell outline). */
  focusAccent: string;
  /** Row highlight fill (semi-transparent, same hue as focusAccent). */
  rowHighlight: string;
  /** Column highlight fill (semi-transparent). */
  colHighlight: string;
  /** Clip-event cell marker used by ClipColumn. */
  clipMarker: string;
  /** High-reward + low-reward cell accents used by RewardsColumn. */
  rewardHigh: string;
  rewardLow: string;
};

export const DARK_THEME: FlowTheme = {
  base: '#0b0b0b',
  posTint: '#1e4a2a',
  negTint: '#4a1f1f',
  posSoft: '#13281a',
  negSoft: '#281313',
  textDefault: '#bbb',
  textFocused: '#eee',
  textFocus: '#fff',
  headerText: '#888',
  frame: '#1e1e1e',
  gridLine: '#1a1a1a',
  focusAccent: '#e6b94a',
  rowHighlight: 'rgba(230,185,74,0.10)',
  colHighlight: 'rgba(230,185,74,0.07)',
  clipMarker: '#2a1128',
  rewardHigh: '#153d1f',
  rewardLow: '#3d1515',
};

export const LIGHT_THEME: FlowTheme = {
  base: '#fdfcf9',
  posTint: '#2a7a4a',
  negTint: '#b0423e',
  posSoft: '#dcebe0',
  negSoft: '#f1dcdb',
  textDefault: '#5a5a5a',
  textFocused: '#1a1a1a',
  textFocus: '#0a0a0a',
  headerText: '#6a6a60',
  frame: '#d8d2c4',
  gridLine: '#e8e4dc',
  focusAccent: '#1f3a5f',
  rowHighlight: 'rgba(31,58,95,0.08)',
  colHighlight: 'rgba(31,58,95,0.05)',
  clipMarker: '#e8d5e2',
  rewardHigh: '#bfe0c6',
  rewardLow: '#edc7c4',
};

export const FLOW_THEME_KEY = Symbol('flowTheme');

/** Read the current theme from context (defaults to DARK_THEME). */
export function useFlowTheme(): FlowTheme {
  return (getContext(FLOW_THEME_KEY) as FlowTheme | undefined) ?? DARK_THEME;
}

// ── Cell-color palettes ──────────────────────────────────────────────────

/** Sign-based tint: positive → posSoft, negative → negSoft, neutral → none. */
export function signTint(x: unknown, theme: FlowTheme = DARK_THEME, eps = 1e-6): string | undefined {
  if (typeof x !== 'number' || !isFinite(x)) return undefined;
  if (Math.abs(x) < eps) return undefined;
  return x > 0 ? theme.posSoft : theme.negSoft;
}

/** Ratio tint around 1.0. */
export function ratioTint(x: unknown, theme: FlowTheme = DARK_THEME): string | undefined {
  if (typeof x !== 'number' || !isFinite(x)) return undefined;
  if (x > 1.02) return theme.posSoft;
  if (x < 0.98) return theme.negSoft;
  return undefined;
}

/**
 * Matrix-scoped cell color: lerp from `theme.base` → `tint` across the
 * matrix's own min/max. Ignores `undefined` / NaN cells. Returns a function
 * suitable for MatrixSlab's `cellColor` prop.
 */
export function matrixColor(
  matrix: number[][],
  tint: string,
  opts: { divergent?: boolean; theme?: FlowTheme } = {},
): (raw: number | string, r: number, c: number) => string | undefined {
  const theme = opts.theme ?? DARK_THEME;
  let mn = Infinity, mx = -Infinity;
  for (const row of matrix) for (const v of row) {
    if (typeof v === 'number' && isFinite(v)) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
  }
  if (!isFinite(mn) || !isFinite(mx) || mx <= mn) {
    return () => undefined;
  }
  const divergent = opts.divergent ?? false;
  return (raw, _r, _c) => {
    if (typeof raw !== 'number' || !isFinite(raw)) return undefined;
    if (divergent) {
      const scale = Math.max(Math.abs(mn), Math.abs(mx));
      if (scale < 1e-9) return undefined;
      const n = Math.max(-1, Math.min(1, raw / scale));
      if (n >= 0) return mixHex(theme.base, theme.posTint, n);
      return mixHex(theme.base, theme.negTint, -n);
    }
    const n = (raw - mn) / (mx - mn);
    return mixHex(theme.base, tint, n);
  };
}

/** Hex color mix, linear in sRGB. Accepts `#rrggbb` or `rgb(r,g,b)` inputs. */
function mixHex(a: string, b: string, t: number): string {
  const ca = parseColor(a), cb = parseColor(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function parseColor(h: string): [number, number, number] {
  if (h.startsWith('#')) {
    const s = h.slice(1);
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  const m = h.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(',').map((s) => parseInt(s.trim(), 10));
    return [r, g, b];
  }
  return [0, 0, 0];
}

/** Build the standard "token name columns, first T visible" array. */
export function tokCols(tokens: (string | undefined)[], T: number, showLabels = true, w = 40): { label: string; w: number }[] {
  const out: { label: string; w: number }[] = [];
  for (let t = 0; t < T; t++) {
    out.push({ label: showLabels ? (tokens[t] ?? '').slice(0, 5) : '', w });
  }
  return out;
}

/** Clip a token vector view to the first `T` positions. */
export function clampT(row: number[] | undefined, T: number): number[] {
  const r = row ?? [];
  return r.slice(0, T);
}

/** Recover log π_old from new logprobs and ratios: log π_old = log π_new − log ρ. */
export function recoverOldLp(newLp: number, ratio: number): number {
  if (!isFinite(ratio) || ratio <= 0) return NaN;
  return newLp - Math.log(ratio);
}

export const COLUMN_WIDTH_SMALL = 160;   // G×1 slabs
export const COLUMN_WIDTH_MEDIUM = 280;  // narrow G×T
export const COLUMN_WIDTH_LARGE = 440;   // wide G×T with labels
export const MAX_VISIBLE_T = 8;
