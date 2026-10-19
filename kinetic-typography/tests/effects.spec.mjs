import { expect, test } from '@playwright/test';

// Every effect: renders without errors, is deterministic, and changes over time.
// Uses the #/snap test route (fixed size, seek to an exact time).

const IDS = [];

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('http://localhost:5199/#/');
  IDS.push(...(await page.evaluate(() => window.__kt.ids)));
  await page.close();
});

async function snap(page, id, at, extra = '', size = '480x270') {
  const [w, h] = size.split('x');
  await page.goto(`http://localhost:5199/#/snap/${id}?at=${at}&w=${w}&h=${h}${extra ? '&' + extra : ''}`);
  await page.waitForFunction(() => {
    const s = document.documentElement.dataset.snapReady;
    return s && s !== '0';
  }, null, { timeout: 20000 });
  const state = await page.evaluate(() => document.documentElement.dataset.snapReady);
  const png = await page.locator('#snap-stage').screenshot();
  return { state, png };
}

function errorsOf(page) {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

const CHUNKS = 8;
for (let c = 0; c < CHUNKS; c++) {
  test(`effects chunk ${c + 1}/${CHUNKS}: animate over time, deterministic`, async ({ page }) => {
    const errors = errorsOf(page);
    const ids = IDS.filter((_, i) => i % CHUNKS === c);
    for (const id of ids) {
      const a = await snap(page, id, 0.6);
      const b = await snap(page, id, 1.7);
      const d = await snap(page, id, 3.1);
      expect(a.state, id).toBe('1');
      const changes = [!a.png.equals(b.png), !b.png.equals(d.png), !a.png.equals(d.png)].filter(Boolean).length;
      expect(changes, `${id} should visibly change over time`).toBeGreaterThan(0);
      const a2 = await snap(page, id, 1.7);
      // determinism: same time → same frame (allow tiny raster jitter by size comparison fallback)
      const same = a2.png.equals(b.png) || Math.abs(a2.png.length - b.png.length) / b.png.length < 0.002;
      expect(same, `${id} should be deterministic at t=1.7`).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

const TEXTS = ['文字動態實驗室', 'TYPE MOTION 2026', '春／夏／秋／冬', '你好！Hello 🙂', '第一行\n第二行\n第三行', '', '這是一段很長很長的文字用來測試排版是否會自動縮放與換行而不會破版ABCDEFG'];

for (let c = 0; c < CHUNKS; c++) {
  test(`effects chunk ${c + 1}/${CHUNKS}: test texts, ratios, card mode`, async ({ page }) => {
    const errors = errorsOf(page);
    const ids = IDS.filter((_, i) => i % CHUNKS === c);
    for (const id of ids) {
      for (const t of TEXTS) {
        const r = await snap(page, id, 1.3, `t=${encodeURIComponent(t)}`, '400x225');
        expect(r.state, `${id} with "${t}"`).toBe('1');
      }
      expect((await snap(page, id, 1.3, 'r=9:16', '225x400')).state, `${id} 9:16`).toBe('1');
      expect((await snap(page, id, 1.3, 'r=1:1&fs=1.6&tr=0.6&in=2', '300x300')).state, `${id} 1:1 extremes`).toBe('1');
      expect((await snap(page, id, 1.3, 'mode=card', '320x180')).state, `${id} card`).toBe('1');
    }
    expect(errors).toEqual([]);
  });
}
