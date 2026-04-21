#!/usr/bin/env node
/**
 * Performance profiling harness using Chrome DevTools Protocol (CDP).
 *
 * Measures CPU time, layout thrashing, style recalculations, and
 * identifies hot functions during user gestures on the GRPO post.
 *
 * Usage:
 *   node scripts/perf-profile.mjs [--label=baseline] [--gesture=all] [--viewport=desktop]
 *
 * Viewports: desktop (1440x900), tablet (768x1024), mobile (375x812)
 * Gestures:  scroll-full, scroll-to-models, hover-model-sweep, rubiks-step
 *
 * Output: post/.perf/<label>/results.json
 */

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
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
const LABEL = args.label ?? `perf-${Date.now()}`;
const GESTURE_FILTER = args.gesture ?? 'all';
const VIEWPORT_NAME = args.viewport ?? 'desktop';
const OUT_DIR = resolve(POST_ROOT, '.perf', LABEL);
mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

const VIEWPORT = VIEWPORTS[VIEWPORT_NAME];
if (!VIEWPORT) {
  console.error(`Unknown viewport: ${VIEWPORT_NAME}. Use desktop|tablet|mobile.`);
  process.exit(1);
}

// ── Metric helpers ──

function getMetric(metrics, name) {
  const m = metrics.metrics.find((m) => m.name === name);
  return m ? m.value : 0;
}

function metricsDelta(before, after) {
  return {
    scriptDuration_ms: (
      (getMetric(after, 'ScriptDuration') - getMetric(before, 'ScriptDuration')) *
      1000
    ).toFixed(1),
    layoutCount: getMetric(after, 'LayoutCount') - getMetric(before, 'LayoutCount'),
    layoutDuration_ms: (
      (getMetric(after, 'LayoutDuration') - getMetric(before, 'LayoutDuration')) *
      1000
    ).toFixed(1),
    recalcStyleCount:
      getMetric(after, 'RecalcStyleCount') - getMetric(before, 'RecalcStyleCount'),
    recalcStyleDuration_ms: (
      (getMetric(after, 'RecalcStyleDuration') -
        getMetric(before, 'RecalcStyleDuration')) *
      1000
    ).toFixed(1),
    domNodes: getMetric(after, 'Nodes'),
    jsEventListeners: getMetric(after, 'JSEventListeners'),
  };
}

function topFunctions(profile, limit = 10) {
  if (!profile || !profile.nodes || !profile.samples) return [];
  const idToNode = new Map();
  for (const node of profile.nodes) idToNode.set(node.id, node);
  const counts = new Map();
  for (const sampleId of profile.samples) {
    const node = idToNode.get(sampleId);
    if (!node) continue;
    const cf = node.callFrame;
    const key = cf.functionName
      ? `${cf.functionName} (${cf.url.split('/').pop()}:${cf.lineNumber})`
      : `(anonymous) (${cf.url.split('/').pop()}:${cf.lineNumber})`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = profile.samples.length;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, samples]) => ({
      name,
      samples,
      pct: ((samples / total) * 100).toFixed(1),
    }));
}

// ── Gesture definitions ──

const GESTURES = {
  'scroll-full': {
    description: 'Scroll top → bottom → top in ~3s',
    async run(page) {
      const h = await page.evaluate(() => document.body.scrollHeight);
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        await page.evaluate((y) => window.scrollTo(0, y), (h * i) / steps);
        await page.waitForTimeout(40);
      }
      for (let i = steps; i >= 0; i--) {
        await page.evaluate((y) => window.scrollTo(0, y), (h * i) / steps);
        await page.waitForTimeout(40);
      }
      return `Scrolled 0 → ${h}px → 0`;
    },
  },

  'scroll-to-models': {
    description: 'Scroll to #models, idle 600ms (ModelDiagram paint cost)',
    async run(page) {
      await page.evaluate(() => {
        const el = document.querySelector('#models');
        if (el) el.scrollIntoView({ block: 'start' });
      });
      await page.waitForTimeout(600);
      const result = await page.evaluate(() => {
        const full = document.querySelectorAll('.model-diagram *').length;
        const ph = document.querySelectorAll('.model-diagram-placeholder *').length;
        return { fullDiagramNodes: full, placeholderNodes: ph };
      });
      return `Settled at #models (${JSON.stringify(result)})`;
    },
  },

  'hover-model-sweep': {
    description: 'Sweep mouse across the ModelDiagram SVG',
    async run(page) {
      await page.evaluate(() => {
        const el = document.querySelector('#models');
        if (el) el.scrollIntoView({ block: 'start' });
      });
      await page.waitForTimeout(400);
      const target = page.locator('.model-diagram svg, .model-diagram-placeholder svg').first();
      const count = await target.count();
      if (count === 0) return 'No diagram found';
      const box = await target.boundingBox();
      if (!box) return 'No diagram box';
      const y = box.y + box.height / 2;
      const steps = 80;
      for (let i = 0; i < steps; i++) {
        await page.mouse.move(
          box.x + (box.width * i) / steps,
          y + Math.sin(i / 4) * (box.height * 0.3),
          { steps: 1 },
        );
        await page.waitForTimeout(16); // ~60fps
      }
      return `Swept ${steps} mouse positions across diagram`;
    },
  },

  'rubiks-step': {
    description: 'Click the cube step button 6 times (animation cost)',
    async run(page) {
      await page.evaluate(() => {
        const el = document.querySelector('#opening');
        if (el) el.scrollIntoView({ block: 'start' });
      });
      await page.waitForTimeout(400);
      // CubeGridSimple auto-plays; just idle to capture an animation cycle
      // plus manually nudge by triggering a resize (no explicit step button
      // is exposed at the grid level — the ticker is on a timer).
      await page.waitForTimeout(2500);
      return 'Idled 2.5s during cube auto-play cycle';
    },
  },
};

// ── Main ──

async function profileGesture(gestureName, gesture) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Profiler.enable');

    await page.goto(URL_TO_TEST, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const metricsBefore = await cdp.send('Performance.getMetrics');

    await cdp.send('Profiler.start');
    const startTime = Date.now();

    let actionResult;
    try {
      actionResult = await gesture.run(page);
    } catch (err) {
      actionResult = `ERROR: ${err.message}`;
    }

    const elapsed = Date.now() - startTime;

    const { profile } = await cdp.send('Profiler.stop');
    const metricsAfter = await cdp.send('Performance.getMetrics');

    const delta = metricsDelta(metricsBefore, metricsAfter);
    const hotFunctions = topFunctions(profile, 10);

    await cdp.detach();

    return {
      gesture: gestureName,
      description: gesture.description,
      actionResult,
      elapsed_ms: elapsed,
      metrics: delta,
      hotFunctions,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log(`\nPerformance Profile: ${URL_TO_TEST}`);
  console.log(`Viewport: ${VIEWPORT_NAME} (${VIEWPORT.width}x${VIEWPORT.height})`);
  console.log(`Label:    ${LABEL}`);
  console.log(`Output:   ${OUT_DIR}\n`);

  const gesturesToRun =
    GESTURE_FILTER === 'all'
      ? Object.entries(GESTURES)
      : Object.entries(GESTURES).filter(([name]) => name === GESTURE_FILTER);

  if (gesturesToRun.length === 0) {
    console.error(`Unknown gesture: ${GESTURE_FILTER}`);
    console.error(`Available: ${Object.keys(GESTURES).join(', ')}`);
    process.exit(1);
  }

  const results = [];

  for (const [name, gesture] of gesturesToRun) {
    process.stdout.write(`  ${name.padEnd(24)} `);
    try {
      const result = await profileGesture(name, gesture);
      results.push(result);
      console.log(
        `script=${result.metrics.scriptDuration_ms}ms  layouts=${result.metrics.layoutCount}  styles=${result.metrics.recalcStyleCount}  nodes=${result.metrics.domNodes}`,
      );
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.push({ gesture: name, error: err.message });
    }
  }

  console.log('\n--- Hot Functions (top 5 per gesture) ---\n');
  for (const r of results) {
    if (r.hotFunctions && r.hotFunctions.length > 0) {
      console.log(`  ${r.gesture}:`);
      for (const f of r.hotFunctions.slice(0, 5)) {
        console.log(`    ${f.pct.padStart(5)}%  ${f.name}`);
      }
      console.log('');
    }
  }

  const outPath = resolve(OUT_DIR, 'results.json');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        url: URL_TO_TEST,
        viewport: VIEWPORT_NAME,
        viewportSize: VIEWPORT,
        label: LABEL,
        timestamp: new Date().toISOString(),
        results,
      },
      null,
      2,
    ),
  );
  console.log(`Full results: ${outPath}\n`);
}

main().catch((err) => {
  console.error('Profile failed:', err);
  process.exit(1);
});
