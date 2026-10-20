// Generates the 1200×630 share images (Open Graph) for MOTION ATLAS and TYPE / MOTION LAB.
// Needs both builds served: motion-atlas `npm run preview` (5289) and kinetic-typography `npm run preview` (5198).
//   node scripts/og.mjs
// Real effect frames are captured from the running apps, then composed into a designed layout
// (fonts come from the atlas build's self-hosted @fontsource files).
import { chromium } from '@playwright/test';

const ATLAS = process.env.ATLAS_URL ?? 'http://localhost:5289/';
const KT = process.env.KT_URL ?? 'http://localhost:5198/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

async function still(base, hook, stageSel, id, t) {
  await page.goto(`${base}#/e/${id}`);
  await page.waitForFunction((h) => window[h]?.state?.ready, hook, { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.evaluate(([h, tt]) => {
    window[h].pause();
    window[h].seek(tt);
  }, [hook, t]);
  await page.waitForTimeout(150);
  const buf = await page.locator(stageSel).screenshot();
  return 'data:image/png;base64,' + buf.toString('base64');
}

const atlasShots = [];
for (const [id, t] of [
  ['text-cylinder', 0.6],
  ['halftone-blob', 2.4],
  ['comic-burst', 1.2],
  ['grid-wave-surface', 2],
  ['isometric-grid', 1.3],
  ['venetian-split', 2.15],
  ['glyph-dot-assemble', 2.6],
  ['topo-lines', 1.3],
]) atlasShots.push(await still(ATLAS, '__maPlayer', '.stage-box', id, t));

const ktShots = [];
for (const [id, t] of [
  ['split-flap', 2.2],
  ['text-tunnel', 2],
  ['led-text', 2],
]) ktShots.push(await still(KT, '__ktPlayer', '.detail-stage', id, t));

async function render(html, out) {
  const p = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  // load the atlas build only for its @font-face rules, then replace the document
  await p.goto(ATLAS);
  await p.waitForTimeout(800);
  await p.evaluate((markup) => {
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => {
      if (!/fontfaces/.test(n.getAttribute('href') ?? '')) n.remove();
    });
    document.querySelector('#root')?.remove();
    document.body.removeAttribute('class');
    document.documentElement.removeAttribute('data-theme');
    document.body.innerHTML = markup;
  }, html);
  await p.evaluate(async () => {
    const sample = 'MOTION ATLAS TYPE LAB 動效圖鑑文字動態實驗室個效果分類即時調參匯出提示詞 0123456789/·';
    await Promise.all(
      ['900 40px "Noto Sans TC Variable"', '700 40px "Noto Sans TC Variable"', '500 40px "Noto Sans TC Variable"', '700 40px "Oswald Variable"', '500 40px "Oswald Variable"', '700 20px "JetBrains Mono"', '400 20px "JetBrains Mono"'].map((f) =>
        document.fonts.load(f, sample),
      ),
    );
    await document.fonts.ready;
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await p.close();
}

const CATS = [
  ['TYPOGRAPHY', '#3450FF'],
  ['HALFTONE', '#ED589A'],
  ['GRID', '#2BA36B'],
  ['LINES', '#E63A2E'],
  ['SHAPES', '#E8A400'],
  ['SPLIT', '#7A5CFF'],
  ['WIPE', '#00A3C4'],
  ['COMIC', '#FF6A00'],
  ['MINIMAL', '#5C5C5C'],
];

const tile = (src) => `<div class="tile"><img src="${src}"></div>`;

const atlasHTML = `
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;overflow:hidden;background:#F2F2F0;color:#171717;font-family:"Noto Sans TC Variable",sans-serif}
  .wrap{position:relative;width:1200px;height:630px;overflow:hidden}
  .left{position:absolute;left:64px;top:58px;width:500px;z-index:2}
  .brand{display:flex;align-items:center;gap:12px;font:700 15px "JetBrains Mono",monospace;letter-spacing:.14em;color:#5b5b58}
  .mark{position:relative;width:34px;height:34px;border-radius:9px;background:#171717}
  .mark i{position:absolute;left:6px;top:10px;width:14px;height:14px;border-radius:50%;background:#FFE35A}
  .mark b{position:absolute;right:6px;top:7px;width:9px;height:20px;border-radius:2px;background:#3450FF}
  h1{margin-top:34px;font:700 112px/0.9 "Oswald Variable",sans-serif;letter-spacing:-.01em;text-transform:uppercase}
  h1 span{display:block}
  .zh{margin-top:18px;display:flex;align-items:baseline;gap:16px}
  .zh strong{font-weight:900;font-size:58px;letter-spacing:.06em}
  .zh em{font-style:normal;font:500 15px "JetBrains Mono",monospace;color:#5b5b58;letter-spacing:.08em}
  .lead{margin-top:20px;font-size:20px;font-weight:500;line-height:1.55;color:#3b3b39}
  .lead b{font-weight:900;color:#171717}
  .chips{position:absolute;left:64px;bottom:46px;width:520px;display:flex;flex-wrap:wrap;gap:8px;z-index:2}
  .chip{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:999px;background:#fff;border:1px solid #dcdcd7;font:800 11.5px "Noto Sans TC Variable";letter-spacing:.08em}
  .chip i{width:8px;height:8px;border-radius:50%}
  .stage{position:absolute;left:600px;top:-120px;width:760px;height:900px;transform:rotate(-8deg);transform-origin:0 0;display:flex;gap:18px}
  .col{display:flex;flex-direction:column;gap:18px}
  .col:nth-child(1){margin-top:150px}
  .col:nth-child(2){margin-top:40px}
  .tile{width:300px;aspect-ratio:16/9;border-radius:16px;overflow:hidden;box-shadow:0 18px 40px rgba(20,20,20,.18),0 2px 6px rgba(20,20,20,.08);background:#ddd}
  .tile img{width:100%;height:100%;object-fit:cover;display:block}
  .fade{position:absolute;inset:0;background:linear-gradient(90deg,#F2F2F0 0,#F2F2F0 560px,rgba(242,242,240,0) 640px);z-index:1;pointer-events:none}
  .count{position:absolute;right:46px;bottom:38px;z-index:3;background:#171717;color:#F2F2F0;border-radius:18px;padding:16px 22px 14px;text-align:right;box-shadow:0 12px 30px rgba(0,0,0,.25)}
  .count b{display:block;font:700 64px/0.9 "Oswald Variable";letter-spacing:.01em}
  .count span{font:700 12px "JetBrains Mono";letter-spacing:.16em;color:#FFE35A}
</style>
<div class="wrap">
  <div class="stage">
    <div class="col">${atlasShots.slice(0, 4).map(tile).join('')}</div>
    <div class="col">${atlasShots.slice(4, 8).map(tile).join('')}</div>
  </div>
  <div class="fade"></div>
  <div class="left">
    <div class="brand"><span class="mark"><i></i><b></b></span>MOTION ATLAS</div>
    <h1><span>Motion</span><span>Atlas</span></h1>
    <div class="zh"><strong>動效圖鑑</strong><em>LIVE MOTION LIBRARY</em></div>
    <p class="lead">可搜尋、收藏、調參、預覽的即時動效素材，<br>一鍵複製 <b>AI 製作 prompt</b>，匯出 PNG／WebM。</p>
  </div>
  <div class="chips">${CATS.map(([n, c]) => `<span class="chip"><i style="background:${c}"></i>${n}</span>`).join('')}</div>
  <div class="count"><b>120</b><span>LIVE EFFECTS</span></div>
</div>`;

const ktHTML = `
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;overflow:hidden;background:#101114;color:#F4F1E8;font-family:"Noto Sans TC Variable",sans-serif}
  .wrap{position:relative;width:1200px;height:630px;overflow:hidden}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(244,241,232,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(244,241,232,.05) 1px,transparent 1px);background-size:40px 40px}
  .kicker{position:absolute;left:64px;top:56px;display:flex;align-items:center;gap:14px;font:900 18px "Noto Sans TC Variable";letter-spacing:.42em;color:#D7FF00}
  .kicker::before{content:"";width:40px;height:3px;background:#D7FF00}
  h1{position:absolute;left:58px;top:112px;font:900 112px/0.92 "Noto Sans TC Variable";letter-spacing:-.035em}
  h1 .slash{color:#FF7153;margin:0 .02em 0 .04em}
  h1 .lab{display:inline-block;background:#D7FF00;color:#101114;padding:0 .12em;margin-left:-.02em;border-radius:6px}
  .lead{position:absolute;left:64px;top:410px;font-size:24px;font-weight:700;color:#F4F1E8}
  .lead span{color:#D7FF00}
  .tags{position:absolute;left:64px;bottom:44px;display:flex;gap:10px}
  .tags span{height:32px;display:inline-flex;align-items:center;padding:0 14px;border:1px solid rgba(244,241,232,.25);border-radius:999px;font:700 13px "Noto Sans TC Variable";letter-spacing:.06em;color:rgba(244,241,232,.85)}
  .strip{position:absolute;right:56px;top:40px;width:330px;display:flex;flex-direction:column;gap:14px;transform:rotate(4deg)}
  .frame{position:relative;border-radius:14px;overflow:hidden;border:2px solid rgba(244,241,232,.12);aspect-ratio:16/9;box-shadow:0 20px 40px rgba(0,0,0,.45)}
  .frame img{width:100%;height:100%;object-fit:cover;display:block}
  .frame span{position:absolute;left:10px;top:8px;font:700 12px "JetBrains Mono";color:#101114;background:#D7FF00;padding:2px 7px;border-radius:5px}
  .num{position:absolute;right:452px;bottom:38px;text-align:right;font:700 13px "JetBrains Mono";letter-spacing:.2em;color:rgba(244,241,232,.6)}
  .num b{display:block;font:900 92px/0.85 "Noto Sans TC Variable";letter-spacing:-.04em;color:#F4F1E8}
</style>
<div class="wrap">
  <div class="grid"></div>
  <div class="strip">${ktShots.map((s, i) => `<div class="frame"><img src="${s}"><span>${['25 SPLIT FLAP', '17 TEXT TUNNEL', '31 LED TEXT'][i]}</span></div>`).join('')}</div>
  <div class="kicker">文字動態實驗室</div>
  <h1>TYPE<span class="slash">/</span><br>MOTION <span class="lab">LAB</span></h1>
  <p class="lead">把文字變成<span>節奏</span>、<span>情緒</span>與<span>空間</span>。</p>
  <div class="tags"><span>衝擊</span><span>流動</span><span>切換</span><span>空間</span><span>材質</span><span>互動</span></div>
  <div class="num"><b>80</b>KINETIC TYPE</div>
</div>`;

await render(atlasHTML, 'public/og.png');
await render(ktHTML, '../kinetic-typography/public/og.png');
await browser.close();
console.log('og images written');
