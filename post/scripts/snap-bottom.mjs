#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POST_ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(POST_ROOT, '.snapshots');
mkdirSync(OUT_DIR, { recursive: true });
const OUT = resolve(OUT_DIR, 'colophon-check.png');

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5176/', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForSelector('#conclusion', { timeout: 10_000 });
  await page.locator('#conclusion').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('#conclusion').screenshot({ path: OUT });
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
}
