#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POST_ROOT = resolve(__dirname, '..');
const OUT = resolve(POST_ROOT, '.snapshots', 'byline-check.png');
mkdirSync(resolve(POST_ROOT, '.snapshots'), { recursive: true });

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 600 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5176/', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1440, height: 80 } });
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
}
