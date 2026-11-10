/* 卡面上的其他印刷：名字欄、日期章、路線小圓點 */
import { CONFIG } from './config.js';
import { CARD } from './print.js';
import { TAU, makeCanvas, hash2, vnoise } from './util.js';

/* 名字欄（卡片單位） */
export const NAME = { x: 38, y: 372, w: 150, base: 398, size: 21 };
export const NAME_FONT = '"Kaiti TC","BiauKai","DFKai-SB","STKaiti","Klee",serif';
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
   opts: { name, dateISO, dateAlpha, route: [station...], hideName, nameGlow } */
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
  if (opts.name && !opts.hideName) {
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
