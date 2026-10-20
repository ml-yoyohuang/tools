import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(root, 'test-results/standalone-retrograde');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});
try {
  const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.goto(pathToFileURL(resolve(root, 'planet-retrograde.html')).href);
  assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), '行星逆行 · Planet Retrograde');
  assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute('content'), 'summary_large_image');
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
  assert.ok(ogImage.startsWith('data:image/png;base64,'));
  assert.equal(await page.locator('meta[name="twitter:image"]').getAttribute('content'), ogImage);
  assert.deepEqual(Buffer.from(ogImage.slice('data:image/png;base64,'.length), 'base64'), readFileSync(resolve(root, 'planet-retrograde-og.png')));
  assert.deepEqual(await page.evaluate(async () => {
    const image = new Image();
    image.src = document.querySelector('meta[property="og:image"]').content;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  }), [1200, 630]);
  await page.locator('canvas').waitFor();
  const frame = () => page.locator('canvas').evaluate(canvas => canvas.toDataURL());
  const before = await frame();
  await page.waitForTimeout(250);
  assert.notEqual(await frame(), before, 'offline animation advances');
  await page.getByRole('button', { name: '暫停', exact: true }).click();
  const paused = await frame();
  await page.waitForTimeout(180);
  assert.equal(await frame(), paused, 'pause freezes the frame');
  await page.locator('#progress').evaluate(input => {
    input.value = '50';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.locator('#manual').isChecked(), true);
  assert.match(await page.locator('#progress-value').textContent(), /50.0% · 衝$/);
  const opposition = await frame();
  await page.waitForTimeout(180);
  assert.equal(await frame(), opposition, 'manual position holds');
  await page.screenshot({ path: resolve(out, 'desktop.png'), fullPage: true });
  const palettes = {
    POP: ['#3450ff', '#ffe35a', '#ed589a', '#ffffff'],
    COOL: ['#0d1a4a', '#ffffff', '#3d7bff', '#a8d0ff'],
    PASTEL: ['#f2e8d5', '#9a86de', '#f2a2c0', '#92c4ee'],
    MONO: ['#141414', '#ffffff', '#8a8a8a', '#d4d4d4'],
    STREET: ['#141414', '#f2e8d5', '#e63a2e', '#ffffff'],
  };
  const colorIds = ['background', 'primary', 'secondary', 'accent'];
  assert.equal(await page.locator('#presets button').count(), 5);
  for (const [name, expected] of Object.entries(palettes)) {
    const button = page.getByRole('button', { name: `${name} 預設配色` });
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#palette-value').textContent(), name);
    assert.deepEqual(await Promise.all(colorIds.map(id => page.locator(`#${id}`).inputValue())), expected);
    assert.notEqual(await frame(), opposition, `${name} changes the visual`);
    if (name === 'PASTEL') await page.screenshot({ path: resolve(out, 'pastel.png'), fullPage: true });
  }
  await page.locator('#accent').fill('#ff0011');
  assert.equal(await page.locator('#palette-value').textContent(), '自訂');
  assert.equal(await page.getByRole('button', { name: 'STREET 預設配色' }).getAttribute('aria-pressed'), 'false');
  await page.locator('#inclination').press('Home');
  assert.notEqual(await frame(), opposition, 'inclination changes geometry');
  await page.locator('#inclination').press('End');
  await page.locator('#sightline').uncheck();
  await page.locator('#guide').uncheck();
  await page.locator('#ratio').selectOption('portrait');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('canvas').count(), 1, 'rebuilds retain only one canvas');
  await page.locator('#reset').click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#palette-value').textContent(), '自訂');
  assert.equal(await page.locator('#accent').inputValue(), '#e63a2e');
  await page.getByRole('button', { name: '暫停', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出 PNG', exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'planet-retrograde.png');
  assert.equal(await download.failure(), null);
  await download.saveAs(resolve(out, 'export.png'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: resolve(out, 'mobile.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no mobile overflow');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#play').textContent(), '播放');
  const reduced = await frame();
  await page.waitForTimeout(180);
  assert.equal(await frame(), reduced, 'reduced motion defaults to a still frame');
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, [], 'standalone page makes zero HTTP requests');
  console.log('PASS: file:// offline, zero HTTP requests, playback, manual time, controls, resize, PNG export, mobile, reduced motion.');
} finally {
  await browser.close();
}
