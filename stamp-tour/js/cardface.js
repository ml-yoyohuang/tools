/* 卡面上的其他印刷：名字欄、日期章、路線小圓點 */
import { CONFIG } from './config.js';
import { CARD } from './print.js';
import { TAU, makeCanvas, hash2, vnoise } from './util.js';

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

/* 日期章圖像：雙圈＋年份＋月日＋小星，帶飛白 */
const dateCache = new Map();
export function dateStampImage(iso, px) {
  const key = iso + '|' + px;
  if (dateCache.has(key)) return dateCache.get(key);
  const cv = makeCanvas(px, px), c = cv.getContext('2d'), s = px / 80;
  const { y, md } = dateParts(iso);
  c.setTransform(s, 0, 0, s, px / 2, px / 2);
  c.strokeStyle = c.fillStyle = CONFIG.DATE_INK;
  c.lineWidth = 3.2; c.beginPath(); c.arc(0, 0, 37, 0, TAU); c.stroke();
  c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 31.5, 0, TAU); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '700 9px ui-monospace,"SF Mono",Consolas,monospace'; c.fillText(y, 0, -15);
  c.font = '700 17px ui-monospace,"SF Mono",Consolas,monospace'; c.fillText(md, 0, 3);
  c.beginPath(); c.moveTo(-18, 13); c.lineTo(18, 13); c.lineWidth = 1; c.stroke();
  // 小星
  c.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 2 : 4.6, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, 21 + Math.sin(a) * r); }
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

/* 在 ctx 上畫卡面印刷之外的東西（x, y = 卡片左上角，k = 卡片單位 → px）
   opts: { name, signature, dateISO, dateAlpha, route: [station...], hideName, nameGlow } */
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
  // 日期章
  if (opts.dateISO && (opts.dateAlpha ?? 1) > 0) {
    const size = DATE.r * 2 * k, img = dateStampImage(opts.dateISO, Math.ceil(size * (window.devicePixelRatio || 1)));
    ctx.globalAlpha = opts.dateAlpha ?? 1;
    ctx.globalCompositeOperation = 'multiply';
    ctx.translate(x + DATE.x * k, y + DATE.y * k); ctx.rotate(DATE.tilt * Math.PI / 180);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  }
  ctx.restore();
}
