#!/usr/bin/env node
/**
 * Capture a PNG of the ModelDiagram stage so a coding agent can read the
 * rendered output via the Read tool.
 *
 * The Read tool can open images. So the workflow is: capture before a
 * change, capture after, and the agent inspects both PNGs directly.
 *
 * Usage:
 *   node scripts/screenshot-sweep.mjs --label=baseline
 *   node scripts/screenshot-sweep.mjs --label=after-fog --url=http://localhost:5173/
 *
 * Output: post/.snapshots/model-diagram/<label>.png
 *
 * Requires the dev server (or a vite preview) to be running at --url
 * (default http://localhost:5173/). Will fail loudly if it can't reach it.
 */

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POST_ROOT = resolve(__dirname, '..');

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? 'true'];
    }),
);

const URL_TO_TEST = args.url ?? 'http://localhost:5173/';
const LABEL = args.label ?? `snap-${Date.now()}`;
const VIEWPORT = {
  width: parseInt(args.width ?? '1440', 10),
  height: parseInt(args.height ?? '900', 10),
};
const OUT_DIR = resolve(POST_ROOT, '.snapshots', 'model-diagram');
mkdirSync(OUT_DIR, { recursive: true });
const OUT_PATH = resolve(OUT_DIR, `${LABEL}.png`);

console.log(`[snap] url=${URL_TO_TEST} viewport=${VIEWPORT.width}x${VIEWPORT.height} → ${OUT_PATH}`);

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await page.goto(URL_TO_TEST, { waitUntil: 'networkidle', timeout: 30_000 });

  // Wait for the model diagram to mount and at least one paint to settle.
  // `.stage` lives inside .model-diagram — selector picks the nearest one.
  await page.waitForSelector('.model-diagram .stage', { state: 'visible', timeout: 15_000 });

  // Scroll it into view (section 1 may be below the fold on first load).
  const stage = await page.$('.model-diagram .stage');
  if (!stage) throw new Error('Could not find .model-diagram .stage');
  await stage.scrollIntoViewIfNeeded();

  // Give the canvas a beat to settle (weights load + first $effect paint).
  await page.waitForTimeout(800);

  await stage.screenshot({ path: OUT_PATH });

  console.log(`[snap] wrote ${OUT_PATH}`);
} finally {
  await browser.close();
}
