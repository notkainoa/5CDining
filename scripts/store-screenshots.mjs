// Captures App Store screenshots (6.9-inch iPhone, 1320x2868) from the web build.
// Usage: PLAYWRIGHT_CORE=/path/to/playwright-core node scripts/store-screenshots.mjs <preview-url>
// Renders a 440x956 CSS viewport at device scale 3, so PNGs are exactly 1320x2868.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const core = process.env.PLAYWRIGHT_CORE ?? 'playwright-core';
const { chromium } = await import(join(core, 'index.mjs'));
const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!base) throw new Error('pass the preview URL');
const out = new URL('../store/screenshots/ios-6.9/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
async function page(colorScheme) {
  const ctx = await browser.newContext({
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme,
  });
  return ctx.newPage();
}
async function open(p, path) {
  await p.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
}
async function shot(p, name) {
  const file = join(out, `${name}.png`);
  await p.screenshot({ path: file, type: 'png' });
  console.log('wrote', file);
}
const btn = (p, name) => p.getByRole('button', { name, exact: true });

// 1. Hall menu with stations expanded (light).
let p = await page('light');
await open(p, '/mcconnell');
await shot(p, '01-menu');

// 2. Day switched to tomorrow, meal picker open (light).
await btn(p, 'Tomorrow').click();
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /choose meal/ }).click();
await p.waitForTimeout(800);
await shot(p, '02-meal-day-picker');
await p.close();

// 3. Search results across halls (light).
p = await page('light');
await open(p, '/mcconnell');
await btn(p, 'Search').click();
await p.waitForTimeout(800);
const box = p.getByRole('textbox').first();
await box.fill(process.env.SEARCH_QUERY ?? 'chicken');
await p.waitForTimeout(2500);
await shot(p, '03-search');
await p.close();

// 4. Settings with diet highlights on (light).
p = await page('light');
await open(p, '/mcconnell');
await btn(p, 'Settings').click();
await p.waitForTimeout(800);
for (const chip of ['Vegan', 'Gluten-free', 'Peanut', 'Tree nut']) {
  const c = p.getByRole('button', { name: chip, exact: true }).first();
  if (await c.count()) await c.click();
}
await p.waitForTimeout(400);
const target = p.getByText('Highlight dishes that are').first();
await target.scrollIntoViewIfNeeded();
await p.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((e) => e.textContent?.trim() === 'Dietary filters');
  el?.scrollIntoView({ block: 'start' });
});
await p.waitForTimeout(500);
await shot(p, '04-settings-diet');
await p.close();

// 5. A different hall mid-way along the tab bar (dark).
p = await page('dark');
await open(p, '/mcconnell');
await btn(p, 'Collins').click();
await p.waitForTimeout(1800);
await shot(p, '05-hall-tab-bar-dark');
await p.close();

await browser.close();
