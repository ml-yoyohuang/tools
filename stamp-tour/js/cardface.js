/* 卡面上的其他印刷：名字欄、日期章、路線小圓點 */
import { CONFIG } from './config.js';
import { CARD } from './print.js';
import { ART_SETS, SEAL_CHAR, SEAL_FONT } from './art.js';
import { TAU, D2R, clamp, smooth, makeCanvas, rr, hash2, vnoise } from './util.js';

/* 名字欄（卡片單位） */
export const NAME = { x: 38, y: 372, w: 150, base: 398, size: 21 };
export const NAME_FONT = '"Kaiti TC","BiauKai","DFKai-SB","STKaiti","Klee",serif';
/* 簽名可以寫的範圍（卡片單位）；筆跡存成 [[x, y, 粗細], ...] 的筆畫陣列 */
export const SIGN = { x: 26, y: 338, w: 196, h: 76 };
export const PEN_INK = '#2b2824';

export function drawSignature(ctx, x, y, k, strokes) {
  if (!strokes || !strokes.length) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(x + SIGN.x * k, y + SIGN.y * k, SIGN.w * k, SIGN.h * k); ctx.clip();
  ctx.strokeStyle = ctx.fillStyle = PEN_INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of strokes) { drawStroke(ctx, x, y, k, s, 1); drawTail(ctx, x, y, k, s); }
  ctx.restore();
}
/* 一筆的最後半段（筆畫結束時補上） */
export function drawTail(ctx, x, y, k, s) {
  if (s.length < 2) return;
  const n = s.length, ax = x + s[n - 2][0] * k, ay = y + s[n - 2][1] * k, bx = x + s[n - 1][0] * k, by = y + s[n - 1][1] * k;
  ctx.lineWidth = s[n - 1][2] * k;
  ctx.beginPath(); ctx.moveTo((ax + bx) / 2, (ay + by) / 2); ctx.lineTo(bx, by); ctx.stroke();
}
/* 畫一筆中的第 from 段之後（即時簽名時只畫新的部分） */
export function drawStroke(ctx, x, y, k, s, from = 1) {
  const P = i => [x + s[i][0] * k, y + s[i][1] * k];
  if (s.length === 1) { const [px, py] = P(0); ctx.beginPath(); ctx.arc(px, py, s[0][2] * k / 2, 0, TAU); ctx.fill(); return; }
  for (let i = Math.max(1, from); i < s.length; i++) {
    const [ax, ay] = P(i - 1), [bx, by] = P(i);
    const [px, py] = i > 1 ? P(i - 2) : [ax, ay];
    ctx.lineWidth = (s[i - 1][2] + s[i][2]) / 2 * k;
    ctx.beginPath(); ctx.moveTo((px + ax) / 2, (py + ay) / 2); ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2); ctx.stroke();
  }
}
/* 日期章（卡片單位） */
export const DATE = { x: 398, y: 386, r: 31, tilt: -9 };

export function dateParts(iso) {
  const d = iso ? new Date(iso) : new Date();
  return { y: String(d.getFullYear()), md: `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}` };
}

/* 日期章的形狀：依領卡那天是星期幾（像車站義工每天來換章，週末放假只剩備用章）
   每種形狀的外框、內框和字的位置（日期章單位：圓形的外框半徑 = 37）
   span = 圖像涵蓋的寬度；圓形維持原本的 80，舊卡的飛白紋路才不會變 */
export const DATE_SHAPES = {
  circle: {
    span: 80, ty: -15, my: 3, ly: 13, lw: 18, sy: 21, sr: 4.6,
    outer: c => { c.beginPath(); c.arc(0, 0, 37, 0, TAU); }, inner: c => { c.beginPath(); c.arc(0, 0, 31.5, 0, TAU); },
  },
  oval: {   // 小判型：橫向拉長，面積和圓形差不多
    span: 100, ty: -12, my: 2, ly: 10, lw: 20, sy: 17.5, sr: 4,
    outer: c => { c.beginPath(); c.ellipse(0, 0, 43, 31, 0, 0, TAU); }, inner: c => { c.beginPath(); c.ellipse(0, 0, 37.5, 25.5, 0, 0, TAU); },
  },
  square: {   // 圓角方形：比圓形略小，看起來才一樣大
    span: 100, ty: -14, my: 3, ly: 12, lw: 17, sy: 19.5, sr: 4.3,
    outer: c => rr(c, -32, -32, 64, 64, 9), inner: c => rr(c, -26.5, -26.5, 53, 53, 5),
  },
};
export function dateShapeFor(date = new Date()) {
  const s = CONFIG.DATE_SHAPE_BY_DAY[date.getDay()];
  return DATE_SHAPES[s] ? s : 'circle';
}

/* 日期章圖像：雙框＋年份＋月日＋小星，帶飛白 */
const dateCache = new Map();
export function dateStampImage(iso, px, shape = 'circle') {
  const key = iso + '|' + px + '|' + shape;
  if (dateCache.has(key)) return dateCache.get(key);
  const S = DATE_SHAPES[shape] || DATE_SHAPES.circle;
  const cv = makeCanvas(px, px), c = cv.getContext('2d'), s = px / S.span;
  const { y, md } = dateParts(iso);
  c.setTransform(s, 0, 0, s, px / 2, px / 2);
  c.strokeStyle = c.fillStyle = CONFIG.DATE_INK;
  c.lineWidth = 3.2; S.outer(c); c.stroke();
  c.lineWidth = 1.2; S.inner(c); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '700 9px ui-monospace,"SF Mono",Consolas,monospace'; c.fillText(y, 0, S.ty);
  c.font = '700 17px ui-monospace,"SF Mono",Consolas,monospace'; c.fillText(md, 0, S.my);
  c.beginPath(); c.moveTo(-S.lw, S.ly); c.lineTo(S.lw, S.ly); c.lineWidth = 1; c.stroke();
  // 小星
  c.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? S.sr * .435 : S.sr, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, S.sy + Math.sin(a) * r); }
  c.closePath(); c.fill();
  // 飛白
  const img = c.getImageData(0, 0, px, px), d = img.data, seed = (Date.parse(iso) / 1000) | 0;
  for (let yy = 0; yy < px; yy++) for (let xx = 0; xx < px; xx++) {
    const i = (yy * px + xx) * 4; if (!d[i + 3]) continue;
    const n = vnoise(xx / (1.6 * s), yy / (1.6 * s), seed) * .6 + vnoise(xx / (5 * s), yy / (5 * s), seed + 1) * .4;
    if (n < .3) d[i + 3] *= Math.max(0, (n - .2) / .1);
    d[i + 3] *= .82 + .18 * hash2(xx, yy, seed);
  }
  c.putImageData(img, 0, 0);
  dateCache.set(key, cv);
  return cv;
}

/* 完成章圖像：圖案組自己的外圈＋「滿」字
   質感來自蓋的人：按得太快 → 飛白多、離手的那一側淡掉；按很久 → 墨暈開、線變粗 */
export const SEAL_SPAN = 84;   // 圖像涵蓋的寬度（卡片單位）
const sealCache = new Map();
export function sealImage(art, px, hold, seed) {
  const key = [art, px, hold, seed].join('|');
  if (sealCache.has(key)) return sealCache.get(key);
  const F = CONFIG.FINALE, set = ART_SETS[art] || ART_SETS.classic;
  const under = clamp((F.SEAL_GOOD_S - hold) / (F.SEAL_GOOD_S - .05), 0, 1);
  const over = clamp((hold - F.SEAL_BLEED_S) / F.SEAL_BLEED_RANGE_S, 0, 1);
  const cv = makeCanvas(px, px), c = cv.getContext('2d', { willReadFrequently: true }), s = px / SEAL_SPAN;
  c.setTransform(s, 0, 0, s, px / 2, px / 2);
  c.fillStyle = c.strokeStyle = F.SEAL_INK; c.lineJoin = 'round';
  if (over > 0) { c.shadowColor = F.SEAL_INK; c.shadowBlur = over * 2.4 * s; }
  set.seal(c);
  c.font = SEAL_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(SEAL_CHAR, 0, 1.5);
  if (over > 0) { c.lineWidth = over * 1.3; c.strokeText(SEAL_CHAR, 0, 1.5); }
  // 飛白與施力
  const img = c.getImageData(0, 0, px, px), d = img.data;
  const ang = hash2(seed, 5, 3) * TAU, dx = Math.cos(ang), dy = Math.sin(ang);
  const thr = .24 + under * .3 - over * .14;
  for (let yy = 0; yy < px; yy++) for (let xx = 0; xx < px; xx++) {
    const i = (yy * px + xx) * 4; if (!d[i + 3]) continue;
    const n = vnoise(xx / (1.5 * s), yy / (1.5 * s), seed) * .6 + vnoise(xx / (5 * s), yy / (5 * s), seed + 1) * .4;
    let a = smooth(thr - .05, thr + .05, n);
    const g = ((xx / px - .5) * dx + (yy / px - .5) * dy);       // -.5 ~ .5：離按壓點越遠越淡
    a *= 1 - under * .85 * smooth(-.25, .5, g);
    a *= (.84 + .1 * over) + .16 * hash2(xx, yy, seed);
    d[i + 3] *= clamp(a, 0, 1);
  }
  c.putImageData(img, 0, 0);
  sealCache.set(key, cv);
  return cv;
}

/* 在 ctx 上畫卡面印刷之外的東西（x, y = 卡片左上角，k = 卡片單位 → px）
   opts: { name, signature, dateISO, dateShape, dateAlpha, route: [station...], hideName, nameGlow, seal, sealAlpha }
   seal = { art, x, y, a, hold, seed }：完成章（卡片單位） */
export function drawCardExtras(ctx, x, y, k, opts = {}) {
  ctx.save();
  // 名字欄
  ctx.fillStyle = 'rgba(60,52,40,.42)';
  ctx.font = `600 ${7.5 * k}px ui-monospace,"SF Mono",Consolas,monospace`;
  ctx.textBaseline = 'alphabetic';
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${1.6 * k}px`;
  ctx.fillText('NAME', x + NAME.x * k, y + (NAME.y + 2) * k);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
  ctx.beginPath(); ctx.moveTo(x + NAME.x * k, y + (NAME.base + 4) * k); ctx.lineTo(x + (NAME.x + NAME.w) * k, y + (NAME.base + 4) * k);
  ctx.strokeStyle = opts.nameGlow ? `rgba(36,34,31,${.35 + .35 * opts.nameGlow})` : 'rgba(60,52,40,.3)';
  ctx.lineWidth = opts.nameGlow ? 1.4 : 1; ctx.stroke();
  if (opts.signature && opts.signature.length && !opts.hideName) drawSignature(ctx, x, y, k, opts.signature);
  else if (opts.name && !opts.hideName) {
    ctx.fillStyle = '#2b2824';
    ctx.font = `${NAME.size * k}px ${NAME_FONT}`;
    ctx.fillText(opts.name, x + (NAME.x + 2) * k, y + NAME.base * k, NAME.w * k);
  }
  // 路線：三個小圓，依蓋章順序填色
  const route = opts.route || [];
  for (let i = 0; i < 3; i++) {
    const cx = x + (CARD.FX + (i - 1) * 15) * k, cy = y + 397 * k, st = route[i];
    ctx.beginPath(); ctx.arc(cx, cy, 3.4 * k, 0, TAU);
    if (st) { ctx.fillStyle = CONFIG.INKS[st].ink; ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(60,52,40,.3)'; ctx.lineWidth = 1; ctx.stroke(); }
  }
  // 完成章
  if (opts.seal && (opts.sealAlpha ?? 1) > 0) {
    const S = opts.seal, size = SEAL_SPAN * k;
    const img = sealImage(S.art, Math.ceil(size * (window.devicePixelRatio || 1)), S.hold, S.seed);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = opts.sealAlpha ?? 1;
    ctx.translate(x + S.x * k, y + S.y * k); ctx.rotate(S.a * D2R); ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  // 日期章
  if (opts.dateISO && (opts.dateAlpha ?? 1) > 0) {
    const shape = DATE_SHAPES[opts.dateShape] ? opts.dateShape : 'circle';
    const size = DATE.r * 2 * k * DATE_SHAPES[shape].span / 80;
    const img = dateStampImage(opts.dateISO, Math.ceil(size * (window.devicePixelRatio || 1)), shape);
    ctx.globalAlpha = opts.dateAlpha ?? 1;
    ctx.globalCompositeOperation = 'multiply';
    ctx.translate(x + DATE.x * k, y + DATE.y * k); ctx.rotate(DATE.tilt * Math.PI / 180);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  }
  ctx.restore();
}
