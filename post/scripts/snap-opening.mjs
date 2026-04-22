#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POST_ROOT = resolve(__dirname, '..');
const OUT = resolve(POST_ROOT, '.snapshots', 'opening-check.png');
mkdirSync(resolve(POST_ROOT, '.snapshots'), { recursive: true });

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5176/', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForSelector('#opening', { timeout: 10_000 });
  await page.locator('#opening').screenshot({ path: OUT });
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
}
