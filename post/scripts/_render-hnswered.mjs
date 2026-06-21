#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HTML = resolve('/tmp/hnswered/composite.html');
const OUT = resolve('/Users/adamsohn/Desktop/hnswered-install.png');

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 600 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT, fullPage: true });
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
}
