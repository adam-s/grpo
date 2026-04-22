#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POST_ROOT = resolve(__dirname, '..');
mkdirSync(resolve(POST_ROOT, '.snapshots'), { recursive: true });
const URL = process.argv[2] || 'https://adamsohn.com/grpo/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const logs = [], errs = [], reqs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => errs.push(e.message));
page.on('response', (r) => { if (r.status() >= 400) reqs.push(`${r.status()} ${r.url()}`); });
try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(POST_ROOT, '.snapshots/prod-opening.png'), clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log('console:'); for (const l of logs) console.log('  ' + l);
  console.log('errors:'); for (const e of errs) console.log('  ' + e);
  console.log('failed:'); for (const r of reqs) console.log('  ' + r);
} finally {
  await browser.close();
}
