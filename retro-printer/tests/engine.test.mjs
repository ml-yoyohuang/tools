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
