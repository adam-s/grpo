/**
 * Shared config for the 14 atomic matrix cards that make up the GRPO
 * computation. `GridStage` (the full overview route) and the per-section
 * embeds both pick from this single list so numbering stays consistent.
 */

import type { Component } from 'svelte';

import PromptColumn    from '../flow/columns/PromptColumn.svelte';
import RolloutsColumn  from '../flow/columns/RolloutsColumn.svelte';
import RewardsColumn   from '../flow/columns/RewardsColumn.svelte';
import AdvantageColumn from '../flow/columns/AdvantageColumn.svelte';
import LogThetaColumn  from '../flow/columns/LogThetaColumn.svelte';
import LogOldColumn    from '../flow/columns/LogOldColumn.svelte';
import RatioColumn     from '../flow/columns/RatioColumn.svelte';
import ClipColumn      from '../flow/columns/ClipColumn.svelte';
import JColumn         from './columns/JColumn.svelte';
import JScalarColumn   from './columns/JScalarColumn.svelte';
import Surr1Column     from './columns/Surr1Column.svelte';
import Surr2Column     from './columns/Surr2Column.svelte';
import PminColumn      from './columns/PminColumn.svelte';
import LogRefColumn    from './columns/LogRefColumn.svelte';
import KlOnlyColumn    from './columns/KlOnlyColumn.svelte';

export type OpId =
  | 'prompt' | 'rollouts' | 'rewards' | 'adv'
  | 'logtheta' | 'logold' | 'logref'
  | 'ratio' | 'clip' | 'kl'
  | 'surr1' | 'surr2' | 'pmin' | 'obj' | 'jscalar';

export type Op = {
  num: number;
  id: OpId;
  title: string;
  symbol: string;
  formula: string;
  sources: number[];
  span: number;
  Comp: Component;
};

export const OPS: Op[] = [
  { num: 1,  id: 'prompt',   title: 'Prompt',     symbol: 'q',         formula: 'scramble tokens',           sources: [],       span: 1, Comp: PromptColumn },
  { num: 2,  id: 'rollouts', title: 'Rollouts',   symbol: 'oɡₜ',       formula: '∼ π_old(·|q)',              sources: [1],      span: 3, Comp: RolloutsColumn },
  { num: 3,  id: 'rewards',  title: 'Reward',     symbol: 'rɡ',        formula: '= R(q, oɡ)',                sources: [2],      span: 1, Comp: RewardsColumn },
  { num: 4,  id: 'adv',      title: 'Advantage',  symbol: 'Âɡ',        formula: '= (r − μ) / σ',             sources: [3],      span: 1, Comp: AdvantageColumn },
  { num: 5,  id: 'logtheta', title: 'log πθ',     symbol: 'log πθ',    formula: 'current policy logprobs',   sources: [1, 2],   span: 3, Comp: LogThetaColumn },
  { num: 6,  id: 'logold',   title: 'log π_old',  symbol: 'log π_old', formula: 'sampling-time logprobs',    sources: [],       span: 3, Comp: LogOldColumn },
  { num: 7,  id: 'ratio',    title: 'Ratio',      symbol: 'ρ',         formula: '= exp(log πθ − log π_old)', sources: [5, 6],   span: 3, Comp: RatioColumn },
  { num: 8,  id: 'clip',     title: 'Clip',       symbol: 'clip(ρ)',   formula: '= clip(ρ, 1−ε, 1+ε)',       sources: [7],      span: 3, Comp: ClipColumn },
  { num: 9,  id: 'logref',   title: 'log π_ref',  symbol: 'log π_ref', formula: 'frozen reference policy',   sources: [],       span: 3, Comp: LogRefColumn },
  { num: 10, id: 'kl',       title: 'KL',         symbol: 'KL',        formula: '= exp(Δ) − Δ − 1',          sources: [5, 9],   span: 3, Comp: KlOnlyColumn },
  { num: 11, id: 'surr1',    title: 'ρ · Â',      symbol: 'ρ·Â',       formula: '= ρ × Â (broadcast)',       sources: [4, 7],   span: 3, Comp: Surr1Column },
  { num: 12, id: 'surr2',    title: 'clip · Â',   symbol: 'c·Â',       formula: '= clip(ρ) × Â',             sources: [4, 8],   span: 3, Comp: Surr2Column },
  { num: 13, id: 'pmin',     title: 'pmin',       symbol: 'pmin',      formula: '= min(ρ·Â, clip·Â)',        sources: [11, 12], span: 3, Comp: PminColumn },
  { num: 14, id: 'obj',      title: 'Objective',  symbol: 'Jᵢₜ',       formula: '= pmin − β·KL',             sources: [13, 10], span: 3, Comp: JColumn },
  { num: 15, id: 'jscalar',  title: 'J scalar',   symbol: 'J',         formula: '= (1/G) Σᵢ (1/|oᵢ|) Σₜ Jᵢₜ', sources: [14],     span: 1, Comp: JScalarColumn },
];

export const ARROW_COLORS: Record<string, string> = {
  ratio: '#5b7cc5',   clip: '#c46daf',    surr1: '#8b6cc5',    surr2: '#c46daf',
  pmin: '#c75a5a',    kl: '#d67a29',      adv: '#2a7a4a',      obj: '#5aad6a',
  rewards: '#d6a029', rollouts: '#7c5bbf', logtheta: '#5b7cc5', logold: '#888',
};

export const ALL_OP_NUMS: number[] = OPS.map((o) => o.num);

export function opByNum(num: number): Op | undefined {
  return OPS.find((o) => o.num === num);
}
