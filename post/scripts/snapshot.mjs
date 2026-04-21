#!/usr/bin/env node
/**
 * Visual snapshot tool for iterative UI debugging.
 *
 * Loads the dev server at http://localhost:5173/ in three viewports
 * (mobile / tablet / desktop), captures:
 *   - full-page screenshots (.png)
 *   - above-the-fold screenshots (.png)
 *   - console logs + errors
 *   - network errors (4xx/5xx/failed requests)
 *   - DOM metrics (scroll width, overflow, etc.)
 *
 * Writes everything into a timestamped directory under web/.snapshots/
 * and prints a summary report. The agent reads the screenshots via
 * the Read tool and compares against termination criteria.
 *
 * Usage:
 *   node scripts/snapshot.mjs [--url=http://localhost:5173/]
 *                             [--label=round1]
 *                             [--action=dropdown-model]
 */

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? 'true'];
    })
);

const URL_TO_TEST = args.url ?? 'http://localhost:5173/';
const LABEL = args.label ?? `snap-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const ACTION = args.action ?? null;

const OUT_DIR = resolve(WEB_ROOT, '.snapshots', LABEL);
mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];

/** Click the Nth filter trigger if visible; gracefully skip on hidden viewports. */
async function clickFilterTrigger(page, index, label) {
  const trigger = page.locator('.filter-trigger').nth(index);
  if (!(await trigger.isVisible().catch(() => false))) {
    return `${label} dropdown hidden at this viewport — skipping`;
  }
  await trigger.click();
  await page.waitForTimeout(250);
  return `Opened ${label} dropdown`;
}

/** Perform a named pre-screenshot interaction for testing specific states. */
async function performAction(page, name) {
  if (!name) return null;
  switch (name) {
    case 'dropdown-model':
      return clickFilterTrigger(page, 0, 'Model');
    case 'dropdown-algorithm':
      return clickFilterTrigger(page, 1, 'Algorithm');
    case 'dropdown-effort':
      return clickFilterTrigger(page, 2, 'Effort');
    case 'scroll-halfway':
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(200);
      return 'Scrolled to midpoint';
    case 'scroll-bottom':
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(200);
      return 'Scrolled to bottom';
    case 'click-contents-multiplication': {
      const link = page.locator('.contents-nav a[href="#multiplication"]');
      if ((await link.count()) === 0 || !(await link.first().isVisible())) {
        return 'Contents nav hidden at this viewport — skipping';
      }
      await link.first().scrollIntoViewIfNeeded();
      await link.first().click();
      await page.waitForTimeout(600);
      return 'Clicked Multiplication in contents nav';
    }
    case 'scroll-to-modexp': {
      await page.locator('#modular-exponentiation').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      return 'Scrolled to modexp section';
    }
    case 'play-modexp-half': {
      await page.locator('#modular-exponentiation').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      // Click play, wait some time, pause
      const playBtn = page.locator('#modular-exponentiation .ctrl-play');
      if (await playBtn.isVisible()) {
        await playBtn.click();
        await page.waitForTimeout(2400);
        await playBtn.click();
      }
      return 'Played modexp ~halfway then paused';
    }
    case 'modexp-step-forward': {
      await page.locator('#modular-exponentiation').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#modular-exponentiation [aria-label="Step forward"]');
      for (let i = 0; i < 3; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(200);
        }
      }
      return 'Stepped modexp forward 3 times';
    }
    case 'scroll-to-multiplication': {
      await page.locator('#multiplication').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      return 'Scrolled to multiplication section';
    }
    case 'scroll-to-reliability': {
      // Scroll the training-origins card (the tableau) to be centered on screen
      await page.evaluate(() => {
        const el = document.querySelector('.training-origins');
        if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to reliability tableau (centered)';
    }
    case 'scroll-to-id': {
      // Uses args.id passed through URL hash? Simpler: read from env-like hack unavailable; skip.
      return 'noop';
    }
    case 'scroll-to-thinking-ops': {
      await page.evaluate(() => {
        const el = document.querySelector('#thinking-ops');
        if (el) el.scrollIntoView({ block: 'start', inline: 'start' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to thinking-ops section top';
    }
    case 'scroll-to-capability-curves': {
      await page.evaluate(() => {
        const el = document.querySelector('#capability-curves');
        if (el) el.scrollIntoView({ block: 'start', inline: 'start' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to capability-curves section top';
    }
    case 'scroll-to-capability-curves-chart': {
      await page.evaluate(() => {
        const el = document.querySelector('#capability-curves .chart-wrap');
        if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to capability-curves chart';
    }
    case 'scroll-to-capability-curves-tokens': {
      await page.evaluate(() => {
        const els = document.querySelectorAll('#capability-curves .chart-wrap');
        const tok = els[1];  // second chart in section is the token chart
        if (tok) tok.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to token-usage chart';
    }
    case 'scroll-to-grind-vs-quit': {
      await page.evaluate(() => {
        const el = document.querySelector('#grind-vs-quit');
        if (el) el.scrollIntoView({ block: 'start', inline: 'start' });
      });
      await page.waitForTimeout(500);
      return 'Scrolled to grind-vs-quit section top';
    }
    case 'scroll-to-grind-vs-quit-sonnet': {
      await page.evaluate(() => {
        const panels = document.querySelectorAll('#grind-vs-quit .panel-slot');
        if (panels[1]) panels[1].scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(500);
      return 'Scrolled to Sonnet panel in grind-vs-quit';
    }
    case 'scroll-to-grind-vs-quit-opus-d50': {
      await page.evaluate(() => {
        const panels = document.querySelectorAll('#grind-vs-quit .panel-slot');
        if (panels[2]) panels[2].scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(500);
      return 'Scrolled to Opus d50 panel in grind-vs-quit';
    }
    case 'scroll-to-grind-vs-quit-opus-quit': {
      await page.evaluate(() => {
        const panels = document.querySelectorAll('#grind-vs-quit .panel-slot');
        const last = panels[panels.length - 1];
        if (last) last.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(500);
      return 'Scrolled to opus-d55 quit panel in grind-vs-quit';
    }
    case 'scroll-to-thinking-ops-end': {
      await page.evaluate(() => {
        // Scroll so the bottom of the thinking-ops section is near the viewport end
        const el = document.querySelector('#thinking-ops');
        if (el) {
          const rect = el.getBoundingClientRect();
          const bottom = window.scrollY + rect.bottom;
          window.scrollTo(0, bottom - window.innerHeight);
        }
      });
      await page.waitForTimeout(500);
      return 'Scrolled to bottom of thinking-ops section';
    }
    case 'scroll-to-thinking-ops-fail': {
      await page.evaluate(() => {
        const panels = document.querySelectorAll('#thinking-ops .flame-panel');
        const fail = panels[panels.length - 1];
        if (fail) fail.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(500);
      return 'Scrolled to fail panel of thinking-ops';
    }
    case 'scroll-to-thinking-ops-pair': {
      await page.evaluate(() => {
        const el = document.querySelector('#thinking-ops .pair');
        if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to thinking-ops pair (centered)';
    }
    case 'scroll-to-failure-modes': {
      await page.evaluate(() => {
        const el = document.querySelector('#failure-modes');
        if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to failure-modes section';
    }
    case 'scroll-to-model-explorer': {
      await page.evaluate(() => {
        const el = document.querySelector('#model-explorer');
        if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to model-explorer section';
    }
    case 'scroll-to-group-sampling': {
      await page.evaluate(() => {
        const el = document.querySelector('#group-sampling');
        if (el) el.scrollIntoView({ block: 'start', inline: 'start' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to group-sampling section';
    }
    case 'scroll-to-ratio': {
      await page.evaluate(() => {
        const el = document.querySelector('#ratio');
        if (el) el.scrollIntoView({ block: 'start', inline: 'start' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to ratio section';
    }
    case 'scroll-to-pmin': {
      await page.evaluate(() => {
        const el = document.querySelector('#pessimistic-min, #pmin');
        if (el) el.scrollIntoView({ block: 'start', inline: 'start' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to pessimistic-min section';
    }
    case 'scroll-to-pmin-focus': {
      await page.evaluate(() => {
        const section = document.querySelector('#pessimistic-min');
        const demos = section?.querySelectorAll('.stage');
        if (demos && demos.length) demos[0].scrollIntoView({ block: 'start', inline: 'start' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to pmin FocusDemo stack';
    }
    case 'scroll-to-ratio-focus': {
      await page.evaluate(() => {
        const section = document.querySelector('#ratio');
        const pair = section?.querySelector('.softmax-pair');
        if (pair) pair.scrollIntoView({ block: 'start', inline: 'start' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to ratio softmax-pair + FocusDemo';
    }
    case 'scroll-to-introduction-top': {
      await page.evaluate(() => {
        const el = document.querySelector('#introduction');
        if (el) el.scrollIntoView({ block: 'start', inline: 'start' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to introduction section top';
    }
    case 'scroll-to-reliability-top': {
      await page.evaluate(() => {
        const el = document.querySelector('#reliability');
        if (el) el.scrollIntoView({ block: 'start', inline: 'start' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to reliability section top';
    }
    case 'scroll-to-consistency': {
      await page.evaluate(() => {
        const el = document.querySelector('#consistency .chart-wrap');
        if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to consistency chart (centered)';
    }
    case 'scroll-to-consistency-top': {
      await page.evaluate(() => {
        const el = document.querySelector('#consistency');
        if (el) el.scrollIntoView({ block: 'start', inline: 'start' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to consistency section top';
    }
    case 'scroll-to-consistency-expanded': {
      await page.evaluate(() => {
        const wraps = document.querySelectorAll('#consistency .chart-wrap');
        const last = wraps[wraps.length - 1];
        if (last) last.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to consistency expanded chart (centered)';
    }
    case 'scroll-to-opus-ceiling-top': {
      await page.evaluate(() => {
        const el = document.querySelector('#opus-ceiling');
        if (el) el.scrollIntoView({ block: 'start', inline: 'start' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to opus-ceiling section top';
    }
    case 'scroll-to-opus-ceiling-calibration': {
      await page.evaluate(() => {
        const wraps = document.querySelectorAll('#opus-ceiling .chart-wrap');
        const first = wraps[0];
        if (first) first.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to opus-ceiling calibration chart';
    }
    case 'scroll-to-opus-ceiling-figure': {
      await page.evaluate(() => {
        const el = document.querySelector('#opus-ceiling .figure-slot');
        if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to opus-ceiling figure';
    }
    case 'scroll-to-opus-ceiling-trace': {
      await page.evaluate(() => {
        const el = document.querySelector('#opus-ceiling .trace-card');
        if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to opus-ceiling trace card (centered)';
    }
    case 'scroll-to-opus-ceiling-curve': {
      await page.evaluate(() => {
        const wraps = document.querySelectorAll('#opus-ceiling .chart-wrap');
        const last = wraps[wraps.length - 1];
        if (last) last.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await page.waitForTimeout(400);
      return 'Scrolled to opus-ceiling curve chart (centered)';
    }
    case 'scroll-to-consistency-mid': {
      await page.evaluate(() => {
        const subhead = document.querySelector('#consistency .subhead');
        if (subhead) subhead.scrollIntoView({ block: 'end', inline: 'start' });
        window.scrollBy(0, -400);
      });
      await page.waitForTimeout(400);
      return 'Scrolled to consistency mid (why paragraph)';
    }
    case 'mult-step-forward': {
      await page.locator('#multiplication').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#multiplication [aria-label="Step forward"]');
      for (let i = 0; i < 5; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(200);
        }
      }
      return 'Stepped multiplication forward 5 times';
    }
    case 'play-mult-half': {
      await page.locator('#multiplication').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const playBtn = page.locator('#multiplication .ctrl-play');
      if (await playBtn.isVisible()) {
        await playBtn.click();
        await page.waitForTimeout(3500);
        await playBtn.click();
      }
      return 'Played multiplication ~halfway then paused';
    }
    case 'mult-jump-to-end': {
      await page.locator('#multiplication').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#multiplication [aria-label="Step forward"]');
      for (let i = 0; i < 20; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(80);
        }
      }
      return 'Stepped multiplication to end';
    }
    case 'scroll-to-nqueens': {
      await page.locator('#search-backtracking').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      return 'Scrolled to N-Queens section';
    }
    case 'nqueens-step-forward': {
      await page.locator('#search-backtracking').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#search-backtracking [aria-label="Step forward"]');
      for (let i = 0; i < 10; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(120);
        }
      }
      return 'Stepped nqueens forward 10 times';
    }
    case 'nqueens-jump-to-end': {
      await page.locator('#search-backtracking').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#search-backtracking [aria-label="Step forward"]');
      for (let i = 0; i < 30; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(60);
        }
      }
      return 'Stepped nqueens to end';
    }
    case 'scroll-to-calculus': {
      await page.locator('#calculus').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      return 'Scrolled to calculus section';
    }
    case 'calculus-step-forward': {
      await page.locator('#calculus .calculus-visual').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#calculus [aria-label="Step forward"]');
      for (let i = 0; i < 6; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(150);
        }
      }
      return 'Stepped calculus forward 6 times';
    }
    case 'calculus-to-step-4': {
      await page.locator('#calculus .calculus-visual').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#calculus [aria-label="Step forward"]');
      for (let i = 0; i < 4; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(150);
        }
      }
      return 'Stepped calculus to step 4 (two-color pair)';
    }
    case 'calculus-to-step-7': {
      await page.locator('#calculus .calculus-visual').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#calculus [aria-label="Step forward"]');
      for (let i = 0; i < 7; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(150);
        }
      }
      return 'Stepped calculus to step 7 (x=1 substitution pair)';
    }
    case 'calculus-jump-to-end': {
      await page.locator('#calculus .calculus-visual').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#calculus [aria-label="Step forward"]');
      for (let i = 0; i < 20; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(80);
        }
      }
      return 'Stepped calculus to end';
    }
    case 'nqueens-diagonal-check': {
      // Scroll the figure element into the center of the viewport so we
      // can see the whole board, then step forward past the placement and
      // column/row checks into the diagonal-check territory.
      await page
        .locator('#search-backtracking .nqueens-visual')
        .scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#search-backtracking [aria-label="Step forward"]');
      // 2 (start+recall) + 8 (place) + 2 (columns+rows) + 1 (first diagonal pair) = 13
      for (let i = 0; i < 13; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(60);
        }
      }
      return 'Stepped nqueens to first diagonal pair check';
    }
    case 'scroll-to-program-tracing': {
      await page.locator('#program-tracing').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      return 'Scrolled to program-tracing section';
    }
    case 'program-tracing-step-forward': {
      await page.locator('#program-tracing .tracing-visual').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#program-tracing [aria-label="Step forward"]');
      for (let i = 0; i < 6; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(150);
        }
      }
      return 'Stepped program-tracing forward 6 times';
    }
    case 'program-tracing-jump-to-end': {
      await page.locator('#program-tracing .tracing-visual').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#program-tracing [aria-label="Step forward"]');
      for (let i = 0; i < 20; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(80);
        }
      }
      return 'Stepped program-tracing to end';
    }
    case 'scroll-to-sequential': {
      await page.locator('#sequential-tasks').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      return 'Scrolled to sequential-tasks section';
    }
    case 'sequential-step-forward': {
      await page.locator('#sequential-tasks .cups-visual').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#sequential-tasks [aria-label="Step forward"]');
      for (let i = 0; i < 4; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(150);
        }
      }
      return 'Stepped sequential forward 4 times';
    }
    case 'sequential-jump-to-end': {
      await page.locator('#sequential-tasks .cups-visual').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#sequential-tasks [aria-label="Step forward"]');
      for (let i = 0; i < 15; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(80);
        }
      }
      return 'Stepped sequential to end';
    }
    case 'scroll-to-novel': {
      await page.locator('#novel-reasoning').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      return 'Scrolled to novel-reasoning section';
    }
    case 'novel-step-forward': {
      await page.locator('#novel-reasoning .cipher-visual').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#novel-reasoning [aria-label="Step forward"]');
      for (let i = 0; i < 4; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(150);
        }
      }
      return 'Stepped novel-reasoning forward 4 times';
    }
    case 'novel-jump-to-end': {
      await page.locator('#novel-reasoning .cipher-visual').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fwdBtn = page.locator('#novel-reasoning [aria-label="Step forward"]');
      for (let i = 0; i < 15; i++) {
        if (await fwdBtn.isVisible()) {
          await fwdBtn.click();
          await page.waitForTimeout(80);
        }
      }
      return 'Stepped novel-reasoning to end';
    }
    case 'scroll-to-thinking-traces': {
      await page.locator('#thinking-traces').scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      return 'Scrolled to thinking-traces section';
    }
    case 'scroll-to-convergence': {
      await page.locator('#convergence').scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      return 'Scrolled to convergence section';
    }
    case 'thinking-traces-hover': {
      await page.locator('#thinking-traces').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      // Scope to the MAIN chart (not the minimap, which also has .flame-rect)
      const rect = page.locator('#thinking-traces .flame-scroll .flame-rect').nth(60);
      const count = await page.locator('#thinking-traces .flame-scroll .flame-rect').count();
      if (count === 0) return 'No flame rects rendered (skipping hover)';
      try {
        await rect.scrollIntoViewIfNeeded({ timeout: 5000 });
        await rect.hover({ force: true, timeout: 5000 });
        await page.waitForTimeout(300);
      } catch (err) {
        return `Hover failed: ${err.message}`;
      }
      return `Hovered flame rect (${count} total)`;
    }
    case 'thinking-traces-click': {
      await page.locator('#thinking-traces').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      // Pick a wide rect (low depth = top rows are usually wider)
      // by selecting from the first 15 rects.
      const rect = page.locator('#thinking-traces .flame-scroll .flame-rect').nth(8);
      const count = await page.locator('#thinking-traces .flame-scroll .flame-rect').count();
      if (count === 0) return 'No flame rects rendered (skipping click)';
      try {
        await rect.scrollIntoViewIfNeeded({ timeout: 5000 });
        await rect.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(500);
      } catch (err) {
        return `Click failed: ${err.message}`;
      }
      return `Clicked flame rect (zoomed in, ${count} rects total)`;
    }
    case 'thinking-traces-toggle-category': {
      await page.locator('#thinking-traces').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const legendBtn = page.locator('#thinking-traces .legend-item').nth(4); // toggle DECOMPOSITION
      try {
        await legendBtn.scrollIntoViewIfNeeded({ timeout: 5000 });
        await legendBtn.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(300);
      } catch (err) {
        return `Toggle failed: ${err.message}`;
      }
      return 'Toggled DECOMPOSITION category off';
    }
    case 'thinking-traces-minimap-click': {
      await page.locator('#thinking-traces').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const minimap = page.locator('#thinking-traces .minimap');
      try {
        await minimap.scrollIntoViewIfNeeded({ timeout: 5000 });
        const box = await minimap.boundingBox();
        if (box) {
          // Click ~30% across the minimap to zoom there.
          await page.mouse.click(box.x + box.width * 0.3, box.y + box.height / 2);
          await page.waitForTimeout(400);
        }
      } catch (err) {
        return `Minimap click failed: ${err.message}`;
      }
      return 'Clicked minimap at 30%';
    }
    case 'thinking-traces-reset': {
      // Click to zoom, then click reset, to verify reset works
      await page.locator('#thinking-traces').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const rect = page.locator('#thinking-traces .flame-scroll .flame-rect').nth(8);
      try {
        await rect.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(300);
        await page.locator('#thinking-traces .reset-btn').click({ timeout: 5000 });
        await page.waitForTimeout(300);
      } catch (err) {
        return `Reset failed: ${err.message}`;
      }
      return 'Zoomed then reset';
    }
    case 'thinking-traces-brush-drag': {
      // Drag on the minimap brush overlay to select a window of the trace
      await page.locator('#thinking-traces').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const minimap = page.locator('#thinking-traces .minimap');
      try {
        await minimap.scrollIntoViewIfNeeded({ timeout: 5000 });
        const box = await minimap.boundingBox();
        if (!box) return 'No minimap box';
        // Drag from 25% to 55% of the minimap width
        const y = box.y + box.height / 2;
        await page.mouse.move(box.x + box.width * 0.25, y);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.40, y, { steps: 10 });
        await page.mouse.move(box.x + box.width * 0.55, y, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(400);
      } catch (err) {
        return `Brush drag failed: ${err.message}`;
      }
      return 'Brushed minimap from 25% to 55%';
    }
    case 'thinking-traces-wheel-zoom': {
      // Wheel zoom over the main chart
      await page.locator('#thinking-traces').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const chart = page.locator('#thinking-traces .flame-scroll .flame-svg');
      try {
        await chart.scrollIntoViewIfNeeded({ timeout: 5000 });
        const box = await chart.boundingBox();
        if (!box) return 'No chart box';
        // Position cursor in the middle of the chart
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        // Ctrl+wheel = zoom in around cursor (our handler requires ctrlKey)
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, -400);
        await page.waitForTimeout(200);
        await page.mouse.wheel(0, -400);
        await page.waitForTimeout(200);
        await page.mouse.wheel(0, -400);
        await page.waitForTimeout(200);
        await page.keyboard.up('Control');
        await page.waitForTimeout(400);
      } catch (err) {
        return `Wheel zoom failed: ${err.message}`;
      }
      return 'Wheel-zoomed in twice on the main chart';
    }
    case 'thinking-traces-pan': {
      // Drag to pan once zoomed
      await page.locator('#thinking-traces').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const chart = page.locator('#thinking-traces .flame-scroll .flame-svg');
      try {
        const box = await chart.boundingBox();
        if (!box) return 'No chart box';
        // First zoom in via Ctrl+wheel
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, -400);
        await page.waitForTimeout(150);
        await page.mouse.wheel(0, -400);
        await page.waitForTimeout(150);
        await page.mouse.wheel(0, -400);
        await page.waitForTimeout(150);
        await page.keyboard.up('Control');
        await page.waitForTimeout(300);
        // Re-query bounding box after zoom (SVG may have changed size)
        const zoomedBox = await chart.boundingBox();
        if (!zoomedBox) return 'No chart box after zoom';
        // Drag upward to scroll DOWN into deeper rows (grab metaphor)
        const startX = zoomedBox.x + zoomedBox.width * 0.6;
        const startY = zoomedBox.y + zoomedBox.height * 0.3;
        const endX = zoomedBox.x + zoomedBox.width * 0.3;
        const endY = zoomedBox.y + zoomedBox.height * 0.1;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(endX, endY, { steps: 16 });
        await page.mouse.up();
        await page.waitForTimeout(300);
      } catch (err) {
        return `Pan failed: ${err.message}`;
      }
      return 'Wheel-zoomed then drag-panned';
    }
    case 'rubiks-step':
    case 'rubiks-step-6':
    case 'rubiks-step-8':
    case 'rubiks-end':
    case 'rubiks-mid-anim': {
      const section = page.locator('#rubiks-solve');
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      if (name === 'rubiks-mid-anim') {
        // Step to move 2 (D' = step index 2), wait for animation, then step once more and capture mid-rotation
        const stepBtn = section.locator('button[aria-label="Step forward"]');
        // Go to step 2 (apply-move D')
        await stepBtn.click(); await page.waitForTimeout(800);
        await stepBtn.click(); await page.waitForTimeout(800);
        // Now click step 3 and capture 150ms in (mid-rotation)
        await stepBtn.click();
        await page.waitForTimeout(150);
        return 'Rubiks: mid-animation capture';
      }

      const n = name === 'rubiks-step' ? 3
        : name === 'rubiks-step-6' ? 6
        : name === 'rubiks-step-8' ? 8
        : 22;
      for (let i = 0; i < n; i++) {
        const stepBtn = section.locator('button[aria-label="Step forward"]');
        if (await stepBtn.count()) {
          await stepBtn.click();
          await page.waitForTimeout(800);
        }
      }
      await page.waitForTimeout(100);
      return `Rubiks: ${name} (${n} steps)`;
    }
    default:
      throw new Error(`Unknown action: ${name}`);
  }
}

async function capture(viewport) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const consoleLogs = [];
  const consoleErrors = [];
  const networkErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    const entry = { type: msg.type(), text: msg.text() };
    consoleLogs.push(entry);
    if (msg.type() === 'error') consoleErrors.push(entry);
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ message: err.message, stack: err.stack });
  });
  page.on('requestfailed', (req) => {
    networkErrors.push({ url: req.url(), error: req.failure()?.errorText });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkErrors.push({ url: res.url(), status: res.status() });
    }
  });

  try {
    await page.goto(URL_TO_TEST, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch (err) {
    await browser.close();
    return {
      viewport: viewport.name,
      error: `navigation failed: ${err.message}`,
    };
  }

  // Wait for fonts
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  const actionDescription = ACTION ? await performAction(page, ACTION) : null;

  // Full-page screenshot
  const fullPath = resolve(OUT_DIR, `${viewport.name}-full.png`);
  await page.screenshot({ path: fullPath, fullPage: true });

  // Above-the-fold screenshot
  const foldPath = resolve(OUT_DIR, `${viewport.name}-fold.png`);
  await page.screenshot({ path: foldPath, fullPage: false });

  // DOM metrics
  const metrics = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    return {
      scrollWidth: Math.max(body.scrollWidth, html.scrollWidth),
      clientWidth: html.clientWidth,
      hasHorizontalScroll: Math.max(body.scrollWidth, html.scrollWidth) > html.clientWidth + 1,
      scrollHeight: Math.max(body.scrollHeight, html.scrollHeight),
      clientHeight: html.clientHeight,
      title: document.title,
    };
  });

  // Text samples (a11y snapshot via innerText of key elements)
  const samples = await page.evaluate(() => {
    const first = (sel) => document.querySelector(sel)?.textContent?.trim().slice(0, 200) ?? null;
    return {
      h1: first('h1'),
      heroLede: first('.hero .lede') ?? first('p.lede'),
      firstH2: first('h2'),
      sidebarBrand: first('.brand-title'),
    };
  });

  // Sidebar debug — check computed display and dump all matching rules
  const sidebarDebug = await page.evaluate(() => {
    const filters = document.querySelector('.filters');
    const traceList = document.querySelector('.trace-list');
    const contentsNav = document.querySelector('.contents-nav');
    const get = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        display: cs.display,
        visibility: cs.visibility,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        classes: el.className,
      };
    };

    // Find all stylesheet rules that reference ".filters"
    const matchingRules = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        for (const rule of Array.from(rules || [])) {
          const src = rule.cssText || '';
          if (src.includes('.filters') && !src.includes('filter-')) {
            matchingRules.push(src.slice(0, 300));
          }
          if (rule.type === CSSRule.MEDIA_RULE) {
            const media = rule.conditionText || rule.media?.mediaText;
            for (const inner of Array.from(rule.cssRules || [])) {
              const innerSrc = inner.cssText || '';
              if (innerSrc.includes('.filters') && !innerSrc.includes('filter-')) {
                matchingRules.push(`@media ${media} { ${innerSrc.slice(0, 300)} }`);
              }
            }
          }
        }
      } catch (e) {
        // cross-origin etc.
      }
    }

    return {
      viewportWidth: window.innerWidth,
      filters: get(filters),
      traceList: get(traceList),
      contentsNav: get(contentsNav),
      matchingRules,
    };
  });

  await browser.close();

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    actionDescription,
    fullPath,
    foldPath,
    metrics,
    samples,
    sidebarDebug,
    consoleErrors,
    pageErrors,
    networkErrors,
    consoleLogs,
    consoleLogCount: consoleLogs.length,
  };
}

async function main() {
  console.log(`\nSnapshot: ${URL_TO_TEST}`);
  console.log(`Label:    ${LABEL}`);
  console.log(`Output:   ${OUT_DIR}`);
  if (ACTION) console.log(`Action:   ${ACTION}`);
  console.log('');

  const results = [];
  for (const vp of VIEWPORTS) {
    process.stdout.write(`  ${vp.name.padEnd(8)} (${vp.width}x${vp.height})... `);
    const result = await capture(vp);
    results.push(result);
    if (result.error) {
      console.log(`ERROR: ${result.error}`);
    } else {
      const errCount =
        result.consoleErrors.length + result.pageErrors.length + result.networkErrors.length;
      const overflow = result.metrics.hasHorizontalScroll ? ' [H-OVERFLOW]' : '';
      console.log(`OK  errors=${errCount}${overflow}`);
    }
  }

  // Write JSON summary
  const summary = {
    url: URL_TO_TEST,
    label: LABEL,
    timestamp: new Date().toISOString(),
    action: ACTION,
    results,
  };
  const summaryPath = resolve(OUT_DIR, 'summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  // Pretty report
  console.log('\n--- Report ---');
  for (const r of results) {
    if (r.error) continue;
    console.log(`\n[${r.viewport} ${r.size}]`);
    console.log(`  metrics: scroll=${r.metrics.scrollWidth}x${r.metrics.scrollHeight} client=${r.metrics.clientWidth}x${r.metrics.clientHeight}${r.metrics.hasHorizontalScroll ? '  OVERFLOW!' : ''}`);
    console.log(`  h1:      ${r.samples.h1 ?? '(none)'}`);
    console.log(`  brand:   ${r.samples.sidebarBrand ?? '(none)'}`);
    if (r.consoleErrors.length)
      console.log(`  console errors: ${r.consoleErrors.map((e) => e.text).join(' | ')}`);
    if (r.pageErrors.length)
      console.log(`  page errors:    ${r.pageErrors.map((e) => e.message).join(' | ')}`);
    if (r.networkErrors.length)
      console.log(`  network errors: ${r.networkErrors.map((e) => `${e.status ?? 'fail'} ${e.url}`).join(' | ')}`);
  }

  console.log(`\nSummary:  ${summaryPath}`);
  console.log('Screenshots saved. Read them to inspect visually.\n');
}

main().catch((err) => {
  console.error('Snapshot failed:', err);
  process.exit(1);
});
