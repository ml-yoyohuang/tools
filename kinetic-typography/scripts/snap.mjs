// Deterministic screenshots of effects at fixed times.
//
//   node scripts/snap.mjs <ids|all> [--times 0.5,1.5,3] [--size 640x360] [--mode detail|card]
//                         [--query "t=你好&c1=%23FF0000"] [--out snapshots] [--sheet] [--url http://localhost:5199/]
//
// Needs the dev server (npm run dev) or preview server running.
// --sheet combines all times of one effect into a single PNG strip (easier to review).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fb) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fb;
};
const flag = (name) => args.includes(`--${name}`);
const base = opt('url', process.env.KT_URL || 'http://localhost:5199/');
const times = opt('times', '0.4,1.2,2.5').split(',').map(Number);
const [w, h] = opt('size', '640x360').split('x').map(Number);
const mode = opt('mode', 'detail');
const extra = opt('query', '');
const out = opt('out', 'snapshots');
const sheet = flag('sheet');
let ids = (args[0] && !args[0].startsWith('--') ? args[0] : 'all').split(',');

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Math.max(w, 200) + 40, height: Math.max(h, 200) + 40 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(base + '#/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__kt);
const all = await page.evaluate(() => window.__kt.ids);
if (ids[0] === 'all') ids = all;
ids = ids.map((id) => {
  if (/^\d+$/.test(id)) return all[Number(id) - 1];
  return id;
});

for (const id of ids) {
  if (!all.includes(id)) {
    console.log(`?? unknown id ${id}`);
    continue;
  }
  const shots = [];
  for (const t of times) {
    errors.length = 0;
    const q = `at=${t}&w=${w}&h=${h}&mode=${mode}${extra ? '&' + extra : ''}`;
    await page.goto(`${base}#/snap/${id}?${q}`);
    try {
      await page.waitForFunction(() => document.documentElement.dataset.snapReady && document.documentElement.dataset.snapReady !== '0', null, { timeout: 15000 });
    } catch {
      console.log(`!! ${id} t=${t} timed out`);
    }
    await page.waitForTimeout(120);
    const file = path.join(out, `${String(all.indexOf(id) + 1).padStart(2, '0')}-${id}-t${t}.png`);
    const buf = await page.locator('#snap-stage').screenshot({ path: sheet ? undefined : file });
    shots.push(buf);
    const state = await page.evaluate(() => document.documentElement.dataset.snapReady);
    console.log(`${state === '1' ? 'ok' : '!!'} ${id} t=${t}${sheet ? '' : ' -> ' + file}${errors.length ? '  ERRORS: ' + errors.join(' | ') : ''}`);
  }
  if (sheet) {
    // stitch horizontally inside the browser
    const datas = shots.map((b) => 'data:image/png;base64,' + b.toString('base64'));
    const png = await page.evaluate(
      async ({ datas, w, h, times }) => {
        const c = document.createElement('canvas');
        const gap = 6;
        c.width = datas.length * (w + gap) - gap;
        c.height = h + 22;
        const g = c.getContext('2d');
        g.fillStyle = '#222';
        g.fillRect(0, 0, c.width, c.height);
        for (let i = 0; i < datas.length; i++) {
          const img = new Image();
          img.src = datas[i];
          await img.decode();
          g.drawImage(img, i * (w + gap), 22);
          g.fillStyle = '#fff';
          g.font = '14px monospace';
          g.fillText(`t=${times[i]}s`, i * (w + gap) + 4, 16);
        }
        return c.toDataURL('image/png');
      },
      { datas, w, h, times },
    );
    const file = path.join(out, `${String(all.indexOf(id) + 1).padStart(2, '0')}-${id}-sheet.png`);
    fs.writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
    console.log(`   sheet -> ${file}`);
  }
}
await browser.close();
