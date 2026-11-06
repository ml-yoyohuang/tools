// 成品計算的測試。不需要瀏覽器，也不需要任何套件：
//   node tests/engine.test.mjs
import assert from 'node:assert/strict';
import { PW, S } from '../src/engine/geometry.js';
import { setRandom, seeded } from '../src/engine/random.js';
import { buildPlate } from '../src/engine/mask.js';
import { createRecord, startStroke, moveStroke } from '../src/engine/record.js';
import { renderLayer } from '../src/engine/render.js';
import { printLayer, compositeJob, surfaceOf } from '../src/engine/print.js';
import { textureField } from '../src/engine/texture.js';
import { MEDIA } from '../src/state.js';
import { mixRGB, makeMixedInk } from '../src/engine/ink.js';
import { prepare, computeMasks, suggestInks, computeTones, computeLayers, defaultModes, halftone } from '../src/engine/separate.js';
import { PALETTE } from '../src/inks.js';
import { fitRect, panBy, shuffle } from '../src/plates/fit.js';
import { CONFIG as C } from '../src/config.js';

/* ───────── 測試用的版與刮印 ───────── */
function circleMask(cx, cy, r) {
  const m = new Float32Array(PW * PW);
  for (let Y = 0; Y < PW; Y++) for (let X = 0; X < PW; X++) {
    const d = Math.hypot(X / S - cx, Y / S - cy) - r;
    m[Y * PW + X] = Math.min(1, Math.max(0, 0.5 - d * S));
  }
  return m;
}
const CIRCLE = buildPlate(circleMask(300, 300, 130));
const STAR_LIKE = buildPlate(circleMask(340, 330, 110));

// 沿 x 由 y0 拖到 y1，速度 v（px/ms）
function scrape(rec, x, y0, y1, v, under = []) {
  let t = 1000;
  startStroke(rec, { x, y: y0 }, t);
  const n = Math.abs(y1 - y0) / 6, dir = Math.sign(y1 - y0);
  for (let i = 1; i <= n; i++) { t += 6 / v; moveStroke(rec, { x, y: y0 + dir * i * 6 }, t, under, C); }
  return rec.v;
}
// 兩道刮印剛好蓋滿整個圖案
function fullScrape(rec, v, under) {
  scrape(rec, 235, 60, 540, v, under);
  scrape(rec, 365, 60, 540, v, under);
}

function render(rec, opts = {}) {
  return renderLayer({ plate: opts.plate || CIRCLE, rec, offset: opts.offset || [0, 0], clog: opts.clog || 0 }, C).alpha;
}

// 圖案內（遮罩為 1）墨量低於 0.3 的比例
function voidFraction(A, plate = CIRCLE) {
  let inside = 0, voids = 0;
  for (let i = 0; i < A.length; i++) if (plate.m[i] > 0.99) { inside++; if (A[i] < 0.3) voids++; }
  return voids / inside;
}
// 圖案外 2–4px 的環帶裡有墨的比例
function bleedFraction(A, plate = CIRCLE) {
  let ring = 0, inked = 0;
  for (let i = 0; i < A.length; i++) {
    const d = plate.dist[i];
    if (d >= 2 * S && d <= 4 * S) { ring++; if (A[i] > 0.3) inked++; }
  }
  return inked / ring;
}
function centroid(A) {
  let sx = 0, sy = 0, s = 0;
  for (let i = 0; i < A.length; i++) { const a = A[i]; if (a > 0.3) { sx += (i % PW) * a; sy += ((i / PW) | 0) * a; s += a; } }
  return [sx / s, sy / s];
}

/* ───────── 測試 ───────── */
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('速度：以時間窗計算，接近實際拖動速度', () => {
  for (const v of [0.05, 0.5, 1.8]) {
    const got = scrape(createRecord(), 235, 60, 540, v);
    assert.ok(Math.abs(got - v) / v < 0.1, `期望約 ${v}，得到 ${got}`);
  }
});

test('正常刮印：基礎飛白約 5%', () => {
  setRandom(seeded(1));
  const rec = createRecord(); fullScrape(rec, 0.5);
  const f = voidFraction(render(rec));
  assert.ok(f > 0.02 && f < 0.09, `飛白比例 ${f.toFixed(3)}`);
});

test('刮太快：飛白明顯增加', () => {
  setRandom(seeded(2));
  const normal = createRecord(); fullScrape(normal, 0.5);
  const fast = createRecord(); fullScrape(fast, 2.4);
  const a = voidFraction(render(normal)), b = voidFraction(render(fast));
  assert.ok(b > a + 0.2, `正常 ${a.toFixed(3)}，太快 ${b.toFixed(3)}`);
});

test('刮太慢：墨水溢出輪廓', () => {
  setRandom(seeded(3));
  const normal = createRecord(); fullScrape(normal, 0.5);
  const slow = createRecord(); fullScrape(slow, 0.04);
  const a = bleedFraction(render(normal)), b = bleedFraction(render(slow));
  assert.ok(a < 0.05, `正常時外圈有墨 ${a.toFixed(3)}`);
  assert.ok(b > 0.3, `太慢時外圈有墨 ${b.toFixed(3)}`);
});

test('重複刮：超過免費次數後溢墨', () => {
  setRandom(seeded(4));
  const rec = createRecord();
  for (let i = 0; i < 5; i++) fullScrape(rec, 0.5);
  assert.ok(bleedFraction(render(rec)) > 0.3);
});

test('漏刮：沒刮到的地方缺墨', () => {
  setRandom(seeded(5));
  const rec = createRecord();
  scrape(rec, 235, 60, 300, 0.5); scrape(rec, 365, 60, 300, 0.5);
  const A = render(rec);
  let top = 0, bottom = 0;
  for (let i = 0; i < A.length; i++) {
    if (CIRCLE.m[i] < 0.99) continue;
    const y = ((i / PW) | 0) / S;
    if (y < 260) top += A[i] > 0.3; else if (y > 340) bottom += A[i] > 0.3;
  }
  assert.ok(top > 1000 && bottom === 0, `上半有墨 ${top}，下半有墨 ${bottom}`);
});

test('塞網：印不出來的面積隨塞網程度增加', () => {
  setRandom(seeded(6));
  const rec = createRecord(); fullScrape(rec, 0.5);
  const f = voidFraction(render(rec, { clog: 1 }));
  assert.ok(f > C.clogMax * 0.8, `塞網 1 時缺墨 ${f.toFixed(3)}`);
});

test('對歪：成品跟著網框的偏移移動', () => {
  setRandom(seeded(7));
  const a = createRecord(); fullScrape(a, 0.5);
  const b = createRecord(); fullScrape(b, 0.5);
  const [x0, y0] = centroid(render(a)), [x1, y1] = centroid(render(b, { offset: [12, -8] }));
  assert.ok(Math.abs(x1 - x0 - 12 * S) < 3 && Math.abs(y1 - y0 + 8 * S) < 3, `位移 ${(x1 - x0).toFixed(1)}, ${(y1 - y0).toFixed(1)}`);
});

function twoLayerJob(wet) {
  const job = {
    medium: { paper: [245, 240, 230], absorb: 1 },
    layers: [CIRCLE, STAR_LIKE].map((plate, i) => ({
      index: i, plate, ink: { rgb: i ? [50, 85, 164] : [255, 72, 176] }, offset: [0, 0],
      rec: createRecord(i), wetAt: new Array(i).fill(0), idle: 0, clog: 0, wet: 0,
      alpha: null, cover: null, stains: []
    }))
  };
  fullScrape(job.layers[0].rec, 0.5);
  printLayer(job, 0, C);
  job.layers[0].wet = wet;
  const under = [{ wet, cover: job.layers[0].cover }];
  job.layers[1].wetAt[0] = wet;
  fullScrape(job.layers[1].rec, 0.5, under);
  printLayer(job, 1, C);
  return job;
}

test('沒等乾：下層糊開，上層沾染下層顏色', () => {
  setRandom(seeded(8));
  const dry = twoLayerJob(0);
  setRandom(seeded(8));
  const wet = twoLayerJob(1);
  let moved = 0;
  const A = dry.layers[0].alpha, B = wet.layers[0].alpha;
  for (let i = 0; i < A.length; i++) moved += Math.abs(A[i] - B[i]);
  assert.ok(moved / (PW * PW) > 0.005, `下層變化 ${(moved / (PW * PW)).toFixed(4)}`);
  assert.ok(Math.max(...wet.layers[1].rec.pick[0]) > 0.5, '刮板應沾到粉紅');
  assert.equal(Math.max(...dry.layers[1].rec.pick[0]), 0, '乾的時候不應沾到');
});

test('疊色：重疊處以相乘變深', () => {
  setRandom(seeded(9));
  const job = twoLayerJob(0), px = compositeJob(job, C);
  const at = (x, y) => { const j = (y * S * PW + x * S) * 4; return [px[j], px[j + 1], px[j + 2]]; };
  const paper = at(20, 20), overlap = at(330, 320);
  assert.deepEqual(paper, [245, 240, 230]);
  assert.ok(overlap.every((v, i) => v < paper[i] * 0.5), `重疊處 ${overlap}`);
});

test('固定種子可重現；不同種子每次不同', () => {
  const rec = createRecord(); fullScrape(rec, 0.5);
  setRandom(seeded(10)); const a = render(rec);
  setRandom(seeded(10)); const b = render(rec);
  setRandom(seeded(11)); const c = render(rec);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('媒材：紙卡沒有表面效果，輸出不變', () => {
  assert.equal(surfaceOf(MEDIA.paper), null);
});

test('媒材：布料織紋固定、淡淡的，且讓成品不同於紙', () => {
  for (const m of [MEDIA.tote, MEDIA.tee, MEDIA.hanky]) {
    const s = surfaceOf(m);
    assert.equal(textureField(m.id, m.texture), s.tex, `${m.name} 織紋應快取並固定`);
    let sum = 0, min = 1, max = 0;
    for (let i = 0; i < s.tex.length; i += 7) { const v = s.tex[i]; sum += v; if (v < min) min = v; if (v > max) max = v; }
    const mean = sum / Math.ceil(s.tex.length / 7);
    assert.ok(min < 0.2 && max > 0.8 && mean > 0.3 && mean < 0.9, `${m.name} 織紋範圍 ${min.toFixed(2)}–${max.toFixed(2)}，平均 ${mean.toFixed(2)}`);
  }
  setRandom(seeded(12));
  const job = twoLayerJob(0);
  const plain = compositeJob(job, C);
  job.medium = MEDIA.tote;
  const a = compositeJob(job, C), b = compositeJob(job, C);
  assert.deepEqual(a, b);
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) diff += Math.abs(a[i] - plain[i]);
  assert.ok(diff / (PW * PW) > 2, `帆布與紙的平均差 ${(diff / (PW * PW)).toFixed(2)}`);
});

test('媒材：吸墨較多的布，溢墨範圍較大', () => {
  const rec = createRecord(); fullScrape(rec, 0.06);
  setRandom(seeded(13));
  const paper = bleedFraction(renderLayer({ plate: CIRCLE, rec, offset: [0, 0], absorb: 1 }, C).alpha);
  setRandom(seeded(13));
  const hanky = bleedFraction(renderLayer({ plate: CIRCLE, rec, offset: [0, 0], absorb: MEDIA.hanky.absorb }, C).alpha);
  assert.ok(hanky > paper + 0.1, `紙 ${paper.toFixed(3)}，手帕 ${hanky.toFixed(3)}`);
});

test('混色：以光學密度混合，藍 + 黃偏綠', () => {
  const [r, g, b] = mixRGB([255, 232, 0], [0, 120, 191], 0.5);
  assert.ok(g > r && g > b, `藍黃混合得到 ${[r, g, b]}`);
  assert.deepEqual(mixRGB([255, 72, 176], [50, 85, 164], 0), [255, 72, 176]);
});

function mixedJob(evenness) {
  const job = twoLayerJob(0);
  job.layers[1].ink = makeMixedInk({
    id: 'm', name: 'm', a: { rgb: [255, 232, 0] }, b: { rgb: [0, 120, 191] }, ratio: 0.5, evenness
  });
  printLayer(job, 1, C);
  return compositeJob(job, C);
}
// 第 2 層非重疊區裡（排除飛白點），色相（綠 − 藍）的標準差
function greenSpread(px) {
  const vals = [];
  for (let y = 370; y < 390; y++) for (let x = 410; x < 430; x++) {
    const i = (y * S * PW + x * S) * 4;
    if (px[i] + px[i + 1] + px[i + 2] > 600) continue;
    vals.push(px[i + 1] - px[i + 2]);
  }
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length);
}

test('調墨：沒攪勻的墨留下色紋，攪勻的沒有', () => {
  setRandom(seeded(14)); const uneven = greenSpread(mixedJob(0.2));
  setRandom(seeded(14)); const even = greenSpread(mixedJob(1));
  assert.ok(uneven > even * 2 && uneven > 8, `沒攪勻 ${uneven.toFixed(1)}，攪勻 ${even.toFixed(1)}`);
});

test('調墨：一般墨水不受影響，成品與之前完全相同', () => {
  setRandom(seeded(15)); const a = compositeJob(twoLayerJob(0), C);
  setRandom(seeded(15));
  const job = twoLayerJob(0);
  assert.equal(job.layers[1].inkMap, null);
  assert.deepEqual(compositeJob(job, C), a);
});

/* ───────── 分色 ───────── */
// 120 × 120 的合成圖：紙色底，左上黃、右上青、下方深藍
function syntheticImage() {
  const w = 120, h = 120, data = new Uint8ClampedArray(w * h * 4);
  const region = (x, y) => (y < 50 ? (x < 55 ? 'yellow' : x > 65 ? 'teal' : 'paper') : y > 70 ? 'navy' : 'paper');
  const RGB = { paper: [246, 242, 233], yellow: [242, 182, 50], teal: [42, 140, 140], navy: [44, 61, 98] };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = RGB[region(x, y)], i = (y * w + x) * 4;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  }
  return { image: { data, w, h }, region };
}
const coverage = m => m.reduce((s, v) => s + v, 0) / m.length;

test('分色：每層對應正確區域，由淺到深，紙色不印', () => {
  const { image, region } = syntheticImage();
  const prep = prepare(image, 3);
  assert.equal(prep.centers.length, 3);
  const Ls = prep.centers.map(c => c[0]);
  assert.ok(Ls[0] >= Ls[1] && Ls[1] >= Ls[2], `亮度順序 ${Ls.map(v => v.toFixed(0))}`);
  const masks = computeMasks(prep, [0.5, 0.5, 0.5]);
  const expect = ['yellow', 'teal', 'navy'];
  masks.forEach((m, k) => {
    let hit = 0, total = 0, stray = 0;
    for (let y = 2; y < 118; y++) for (let x = 2; x < 118; x++) {
      const r = region(x, y), v = m[y * 120 + x];
      if (r === expect[k]) { total++; hit += v > 0.5; } else if (r === 'paper' && Math.abs(x - 60) > 8 && Math.abs(y - 60) > 14) stray += v > 0.5;
    }
    assert.ok(hit / total > 0.95, `第 ${k + 1} 層命中 ${(hit / total).toFixed(3)}`);
    assert.equal(stray, 0, `第 ${k + 1} 層印到紙色 ${stray} 點`);
  });
});

test('分色：門檻越大，這層覆蓋越多', () => {
  const { image } = syntheticImage();
  const prep = prepare(image, 3);
  let prev = -1;
  for (const c of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const cov = coverage(computeMasks(prep, [0.5, c, 0.5])[1]);
    assert.ok(cov >= prev, `門檻 ${c} 覆蓋 ${cov.toFixed(3)} < ${prev.toFixed(3)}`);
    prev = cov;
  }
});

test('分色：同一張圖每次結果相同；建議墨色是最接近的色票', () => {
  const { image } = syntheticImage();
  const a = prepare(image, 3), b = prepare(image, 3);
  assert.deepEqual(a.centers, b.centers);
  const names = suggestInks(a, PALETTE).map(i => i.id);
  assert.deepEqual(names, ['gold', 'teal', 'navy']);
});

/* ───────── 網點 ───────── */
test('網點：覆蓋面積接近濃度', () => {
  const w = 240, h = 240;
  for (const t of [0.15, 0.5, 0.85]) {
    const tone = new Float32Array(w * h).fill(t);
    const cov = coverage(halftone(tone, w, h, { angle: 15, cell: 13 }));
    assert.ok(Math.abs(cov - t) < 0.08, `濃度 ${t} 覆蓋 ${cov.toFixed(3)}`);
  }
});

// 由左到右：深藍漸變到紙色
function gradientImage() {
  const w = 160, h = 80, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = x / (w - 1), i = (y * w + x) * 4;
    data[i] = 40 + (245 - 40) * k; data[i + 1] = 60 + (240 - 60) * k; data[i + 2] = 110 + (230 - 110) * k; data[i + 3] = 255;
  }
  return { data, w, h };
}

test('網點：漸層得到連續的濃度，預設用網點；平塗的維持實色', () => {
  const prep = prepare(gradientImage(), 1);
  const t = computeTones(prep)[0];
  const at = x => t[40 * 160 + x];
  assert.ok(at(5) > 0.9 && at(80) > 0.3 && at(80) < 0.7 && at(155) < 0.05, `濃度 ${at(5).toFixed(2)} ${at(80).toFixed(2)} ${at(155).toFixed(2)}`);
  for (let x = 10; x < 150; x += 10) assert.ok(at(x) >= at(x + 10) - 0.02, '濃度應由左往右遞減');
  assert.deepEqual(defaultModes(prep), ['dots']);
  assert.deepEqual(defaultModes(prepare(syntheticImage().image, 3)), ['solid', 'solid', 'solid']);
});

test('網點：網點遮罩隨漸層由密到疏，濃淡滑桿往右整體變深', () => {
  const prep = prepare(gradientImage(), 1);
  const [m] = computeLayers(prep, { cov: [0.5], modes: ['dots'], dot: 'medium' });
  const band = (x0, x1) => { let s = 0, n = 0; for (let y = 0; y < 80; y++) for (let x = x0; x < x1; x++) { s += m[y * 160 + x]; n++; } return s / n; };
  assert.ok(band(0, 40) > band(60, 100) && band(60, 100) > band(120, 160), `${band(0, 40).toFixed(2)} ${band(60, 100).toFixed(2)} ${band(120, 160).toFixed(2)}`);
  const [dark] = computeLayers(prep, { cov: [0.85], modes: ['dots'], dot: 'medium' });
  assert.ok(coverage(dark) > coverage(m) + 0.05);
});

/* ───────── 提供圖片 ───────── */
test('放置：完整放進方形，置中、不裁切', () => {
  const r = fitRect(800, 400, 720, 'contain');
  assert.deepEqual([r.sx, r.sy, r.sw, r.sh], [0, 0, 800, 400]);
  assert.deepEqual([r.dx, r.dy, r.dw, r.dh], [0, 180, 720, 360]);
});

test('放置：填滿裁成方形，拖動不會拖出圖外', () => {
  const mid = fitRect(800, 400, 720, 'cover');
  assert.deepEqual([mid.sx, mid.sy, mid.sw, mid.sh], [200, 0, 400, 400]);
  let pan = [0, 0];
  for (let i = 0; i < 50; i++) pan = panBy(pan, 40, 40, 800, 400, 360);   // 一直往右下拖
  const r = fitRect(800, 400, 720, 'cover', pan);
  assert.equal(r.sx, 0);
  assert.equal(r.sy, 0);
  assert.deepEqual(pan, [-1, 0]);
});

test('圖庫打亂：張數不變、沒有重複', () => {
  const ids = Array.from({ length: 27 }, (_, i) => 'img-' + i);
  const a = shuffle(ids, seeded(1)), b = shuffle(ids, seeded(2));
  assert.equal(new Set(a).size, ids.length);
  assert.deepEqual([...a].sort(), [...ids].sort());
  assert.notDeepEqual(a, b);
  assert.deepEqual(ids[0], 'img-0', '原陣列不應被改動');
});

/* ───────── 執行 ───────── */
let failed = 0;
for (const { name, fn } of tests) {
  const t0 = Date.now();
  try {
    fn();
    console.log(`ok    ${name}  (${Date.now() - t0}ms)`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}\n      ${e.message}`);
  }
}
setRandom(null);
console.log(`\n${tests.length - failed} / ${tests.length} 通過`);
process.exit(failed ? 1 : 0);
