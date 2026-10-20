import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});
try {
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(resolve(root, 'planet-retrograde.html')).href);
  await page.locator('#stage canvas').waitFor();
  await page.evaluate(async () => {
    const stage = document.getElementById('stage');
    Object.assign(stage.style, {
      position: 'fixed', left: '0', top: '0', width: '1200px', height: '630px',
      aspectRatio: 'auto', borderRadius: '0', zIndex: '10',
    });
    const progress = document.getElementById('progress');
    progress.value = '50';
    progress.dispatchEvent(new Event('input', { bubbles: true }));
    await document.fonts.ready;
  });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#stage canvas');
    return canvas?.width === 1200 && canvas?.height === 630;
  });
  const output = resolve(root, 'planet-retrograde-og.png');
  await page.locator('#stage').screenshot({ path: output });
  console.log(`Created ${output} (1200×630).`);
} finally {
  await browser.close();
}
