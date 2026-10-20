// Effect smoke test + contact sheets.
//   node scripts/smoke.mjs                 → every effect
//   node scripts/smoke.mjs --cat=halftone  → one category
//   node scripts/smoke.mjs --ids=a,b       → specific ids
// Needs the dev server (npm run dev, port 5288) — or pass --base=http://localhost:5289/ for preview.
// For every effect: opens the detail modal, pauses, seeks to 4 fixed times, screenshots
// the stage, checks frames differ (real time-based motion), checks 1:1 / 9:16 and the
// three test strings, and records console errors. Writes test-results/smoke/<id>.png
// (2×2 contact sheet) and test-results/smoke/summary.json.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const BASE = arg('base', 'http://localhost:5288/');
const OUT = arg('out', 'test-results/smoke');
const TIMES = (arg('times', '0.4,1.3,2.6,4.1')).split(',').map(Number);
const TEXTS = ['動效圖鑑', 'MOTION PLAY', '你好！Hello 🙂', ''];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE);
await page.waitForFunction(() => window.__ma?.ids?.length);
let effects = await page.evaluate(() => window.__ma.effects);
const cat = arg('cat');
const ids = arg('ids');
if (cat) effects = effects.filter((e) => e.category === cat);
if (ids) effects = effects.filter((e) => ids.split(',').includes(e.id));

const waitReady = () =>
  page.waitForFunction(() => {
    const p = window.__maPlayer;
    return p && p.state.ready && p.currentRuntime;
  }, null, { timeout: 15000 });

const go = async (hash) => {
  await page.evaluate(() => (window.__maPlayer = null));
  await page.goto(`${BASE}#/e/${hash}`);
  await waitReady();
  // let fonts / scrollbars settle (a resize triggers one debounced rebuild)
  await page.waitForTimeout(450);
  await waitReady();
};
const shot = async () => page.locator('.stage-box').screenshot();
const hash = (b) => createHash('md5').update(b).digest('hex');

const results = [];
for (const e of effects) {
  const before = errors.length;
  const r = { id: e.id, code: e.code, renderer: e.renderer, ok: true, notes: [] };
  try {
    await go(`${e.id}?sp=1`);
    await page.evaluate(() => window.__maPlayer.pause());
    const frames = [];
    for (const t of TIMES) {
      await page.evaluate((tt) => window.__maPlayer.seek(tt), t);
      await page.waitForTimeout(60);
      frames.push(await shot());
    }
    const hs = frames.map(hash);
    r.distinctFrames = new Set(hs).size;
    if (r.distinctFrames < 2) {
      r.ok = false;
      r.notes.push('frames identical at all sampled times (no time-based motion?)');
    }
    // determinism: seek back to the first time → same frame
    await page.evaluate((tt) => window.__maPlayer.seek(tt), TIMES[1]);
    await page.waitForTimeout(60);
    r.deterministic = hash(await shot()) === hs[1];
    if (!r.deterministic && !e.interactive) r.notes.push('seek is not deterministic');
    // contact sheet
    const imgs = frames.map((b) => 'data:image/png;base64,' + b.toString('base64'));
    const sheet = await browser.newPage({ viewport: { width: 1200, height: 700 } });
    await sheet.setContent(
      `<body style="margin:0;background:#222;display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px">${imgs
        .map((s, i) => `<div style="position:relative"><img src="${s}" style="width:100%;display:block"><span style="position:absolute;left:6px;top:4px;color:#fff;font:12px monospace;background:#000a;padding:1px 4px">t=${TIMES[i]}s</span></div>`)
        .join('')}</body>`,
    );
    await sheet.screenshot({ path: `${OUT}/${e.code}-${e.id}.png`, fullPage: true });
    await sheet.close();
    // ratios + test strings (just must not throw)
    for (const r2 of ['1:1', '9:16']) {
      await go(`${e.id}?r=${encodeURIComponent(r2)}`);
    }
    if (e.controls.includes('text')) {
      for (const tx of TEXTS) {
        await go(`${e.id}?t=${encodeURIComponent(tx)}`);
      }
      // long + multi-line
      await go(`${e.id}?t=${encodeURIComponent('第一行很長很長的文字測試 LONG TEXT 1234567890\n第二行／第三段')}`);
    }
    const st = await page.evaluate(() => window.__maPlayer.state);
    if (st.error) {
      r.ok = false;
      r.notes.push('player error: ' + st.error);
    }
  } catch (err) {
    r.ok = false;
    r.notes.push('exception: ' + String(err).split('\n')[0]);
  }
  const errs = errors.slice(before);
  if (errs.length) {
    r.ok = false;
    r.notes.push(...errs.slice(0, 3).map((x) => 'console: ' + x.slice(0, 200)));
  }
  results.push(r);
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${e.code} ${e.id} frames=${r.distinctFrames ?? '-'} det=${r.deterministic ?? '-'} ${r.notes.join(' | ')}`);
}
writeFileSync(`${OUT}/summary${cat ? '-' + cat : ''}.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
