/* 第 3 幕後半：集章卡變成明信片
   翻面 → 在背面寫一句話（手寫或打字，可略過）→ 自己蓋郵戳 → 投進郵筒 → 寄回手上 → 存成圖片或分享
   寄到之後，卡片首頁就是這張明信片：點一下翻面。 */
import { CONFIG } from './config.js';
import { COPY } from './copy.js';
import { CARD, PR, printCv } from './print.js';
import { drawCardExtras, drawStroke, drawTail, NAME_FONT, PEN_INK, POSTMARK, postmarkImage } from './cardface.js';
import { say, attendantSVG } from './attendant.js';
import { ART_SETS } from './art.js';
import { store } from './storage.js';
import { dragStamp, handStampSVG } from './dragstamp.js';
import { $, clamp, lerp, wait, makeCanvas, rr, hash2, vnoise } from './util.js';

/* ---------------- 背面版面（卡片單位，440 × 420） ---------------- */
export const BACK = {
  MSG: { x: 26, y: 50, w: 216, h: 326, first: 92, rule: 41, size: 20 },   // 留言區：橫線從 first 開始，每 rule 一條
  DIV: 260,                                                               // 中間的分隔線
  STAMP: { x: 340, y: 26, w: 76, h: 90 },                                 // 郵票
  ROUTE: { y: 190, xs: [298, 344, 390], r: 12.5 },                        // 路線：照蓋章順序的三個站
  NOTES: { x: 284, y: 240, gap: 31 },                                     // 三站的評語
  ADDR: [346, 374],                                                       // 地址線
};
const TYPE = '"Courier New",ui-monospace,"PingFang TC","Microsoft JhengHei",monospace';
const ICON = {   // Material Design Icons
  pen: 'M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25Z',
  keyboard: 'M4 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4m0 2h16v10H4V7m1 1v2h2V8H5m3 0v2h2V8H8m3 0v2h2V8h-2m3 0v2h2V8h-2m3 0v2h2V8h-2M5 11v2h2v-2H5m3 0v2h2v-2H8m3 0v2h2v-2h-2m3 0v2h2v-2h-2m3 0v2h2v-2h-2M8 14v2h8v-2H8Z',
  eraser: 'M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84L13.41 3.56c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95Z',
  check: 'M21 7 9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7Z',
  flip: 'M12,6V9L16,5L12,1V4A8,8 0 0,0 4,12C4,13.57 4.46,15.03 5.24,16.26L6.7,14.8C6.25,13.97 6,13 6,12A6,6 0 0,1 12,6M18.76,7.74L17.3,9.2C17.74,10.04 18,11 18,12A6,6 0 0,1 12,18V15L8,19L12,23V20A8,8 0 0,0 20,12C20,10.43 19.54,8.97 18.76,7.74Z',
  download: 'M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z',
  share: 'M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.91 18,21.91C19.61,21.91 20.92,20.61 20.92,19A2.92,2.92 0 0,0 18,16.08Z',
};
const icon = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const vibe = ms => { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) { try { navigator.vibrate(ms); } catch (_) {} } };
const sayFor = (lines, ms = 9000) => Promise.race([say(lines), wait(ms)]);

/* ---------------- 畫正面、背面 ---------------- */
let paperCv = null;
function paper() {             // 背面的紙：跟正面同一種紙紋，沒有印刷
  if (paperCv) return paperCv;
  const w = CARD.W * PR, h = CARD.H * PR;
  paperCv = makeCanvas(w, h);
  const c = paperCv.getContext('2d'), img = c.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, n = (hash2(x, y, 17) - .5) * 5 + (vnoise(x / 26, y / 9, 19) - .5) * 5;
    d[i] = 247 + n; d[i + 1] = 244 + n; d[i + 2] = 237 + n * 1.1; d[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return paperCv;
}

export function renderFront(c, x, y, k) {
  const cd = store.card || {};
  c.save(); rr(c, x, y, CARD.W * k, CARD.H * k, 7 * k); c.clip();
  c.imageSmoothingQuality = 'high';
  c.drawImage(printCv, x, y, CARD.W * k, CARD.H * k);
  c.restore();
  drawCardExtras(c, x, y, k, { name: cd.name, signature: cd.signature, dateISO: cd.issuedAt, dateShape: cd.dateShape, seal: cd.seal, route: store.route() });
}

/* post = { message: {text} | {strokes} | null, postmark } */
export function renderBack(c, x, y, k, post = {}) {
  const B = BACK, M = B.MSG, u = v => v * k;
  c.save(); rr(c, x, y, u(CARD.W), u(CARD.H), u(7)); c.clip();
  c.drawImage(paper(), x, y, u(CARD.W), u(CARD.H));
  c.translate(x, y);
  // 留言區的橫線、分隔線、地址線
  c.strokeStyle = 'rgba(60,52,40,.17)'; c.lineWidth = 1;
  for (let ly = M.first; ly <= M.y + M.h; ly += M.rule) { c.beginPath(); c.moveTo(u(M.x), u(ly)); c.lineTo(u(M.x + M.w), u(ly)); c.stroke(); }
  for (const ly of B.ADDR) { c.beginPath(); c.moveTo(u(B.DIV + 22), u(ly)); c.lineTo(u(418), u(ly)); c.stroke(); }
  c.strokeStyle = 'rgba(60,52,40,.26)';
  c.beginPath(); c.moveTo(u(B.DIV), u(40)); c.lineTo(u(B.DIV), u(382)); c.stroke();

  // 郵票：齒孔邊＋抽到的圖案
  const S = B.STAMP;
  c.save();
  c.shadowColor = 'rgba(45,35,20,.18)'; c.shadowBlur = u(2); c.shadowOffsetY = u(.6);
  c.fillStyle = '#FDFCF8'; c.fillRect(u(S.x), u(S.y), u(S.w), u(S.h));
  c.restore();
  c.fillStyle = '#F2EEE6';
  for (let t = 4; t < S.w; t += 6) for (const yy of [S.y, S.y + S.h]) { c.beginPath(); c.arc(u(S.x + t), u(yy), u(1.8), 0, Math.PI * 2); c.fill(); }
  for (let t = 4; t < S.h; t += 6) for (const xx of [S.x, S.x + S.w]) { c.beginPath(); c.arc(u(xx), u(S.y + t), u(1.8), 0, Math.PI * 2); c.fill(); }
  const iw = S.w - 14;
  drawStampArt(c, u(S.x + 7), u(S.y + 7), u(iw), post.stamp);
  c.strokeStyle = 'rgba(60,52,40,.2)'; c.strokeRect(u(S.x + 7), u(S.y + 7), u(iw), u(iw));
  [1, 2, 3].forEach((st, i) => { c.fillStyle = CONFIG.INKS[st].ink; c.beginPath(); c.arc(u(S.x + S.w / 2 + (i - 1) * 8), u(S.y + S.h - 8), u(2.2), 0, Math.PI * 2); c.fill(); });

  // 路線：照你走的順序
  const R = B.ROUTE, route = store.route();
  c.fillStyle = 'rgba(60,52,40,.42)'; c.font = `600 ${u(7.5)}px ui-monospace,"SF Mono",Consolas,monospace`;
  if (c.letterSpacing !== undefined) c.letterSpacing = `${u(1.6)}px`;
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillText('ROUTE', u(B.DIV + 24), u(R.y - 24));
  if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
  route.forEach((st, i) => {
    const cx = u(R.xs[i]), cy = u(R.y), ink = CONFIG.INKS[st];
    if (i) {                                     // 箭頭
      const x0 = u(R.xs[i - 1] + R.r + 5), x1 = cx - u(R.r + 5);
      c.strokeStyle = 'rgba(60,52,40,.45)'; c.lineWidth = u(1.2); c.lineCap = 'round';
      c.beginPath(); c.moveTo(x0, cy); c.lineTo(x1, cy); c.moveTo(x1 - u(4), cy - u(3.5)); c.lineTo(x1, cy); c.lineTo(x1 - u(4), cy + u(3.5)); c.stroke();
    }
    c.fillStyle = ink.ink; c.beginPath(); c.arc(cx, cy, u(R.r), 0, Math.PI * 2); c.fill();
    c.fillStyle = st === 1 ? '#24221F' : '#FBFAF6';
    c.font = `800 ${u(13)}px ui-rounded,"SF Pro Rounded","Arial Rounded MT Bold",system-ui,sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(st, cx, cy + u(.8));
  });

  // 三站的評語（每站第一次蓋的那一句）
  const N = B.NOTES;
  route.forEach((st, i) => {
    const imp = store.impressions.find(m => m.station === st && !m.retouch) || store.impressions.find(m => m.station === st);
    if (!imp) return;
    const yy = u(N.y + i * N.gap);
    c.fillStyle = CONFIG.INKS[st].ink; c.beginPath(); c.arc(u(N.x + 3), yy - u(4), u(3.2), 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3A3530'; c.font = `500 ${u(13)}px ${TYPE}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText(COPY.comments[imp.comment] || '', u(N.x + 13), yy, u(418 - N.x - 13));
  });

  // 留言
  const msg = post.message;
  if (msg && msg.text) {
    c.fillStyle = PEN_INK; c.font = `${u(M.size)}px ${NAME_FONT}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    let line = '', ly = M.first;
    for (const ch of [...msg.text]) {
      const tail = '，。！？、～）」』…!?,.'.includes(ch);   // 標點不放在行首：寧可稍微超出一點
      if (ch === '\n' || (!tail && c.measureText(line + ch).width > u(M.w - 6))) {
        c.fillText(line, u(M.x + 3), u(ly - 8)); ly += M.rule; line = ch === '\n' ? '' : ch;
        if (ly > M.y + M.h + 4) break;
      } else line += ch;
    }
    if (line && ly <= M.y + M.h + 4) c.fillText(line, u(M.x + 3), u(ly - 8));
  } else if (msg && msg.strokes) {
    c.save(); c.beginPath(); c.rect(u(M.x - 6), u(M.y - 10), u(M.w + 12), u(M.h + 16)); c.clip();
    c.strokeStyle = c.fillStyle = PEN_INK; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of msg.strokes) { drawStroke(c, 0, 0, k, s, 1); drawTail(c, 0, 0, k, s); }
    c.restore();
  }

  // 郵戳
  const pm = post.postmark;
  if (pm) {
    const P = POSTMARK, w = u(P.W), img = postmarkImage(pm.at, Math.ceil(w * (window.devicePixelRatio || 1)), pm.hold, pm.seed);
    c.save(); c.globalCompositeOperation = 'multiply';
    c.translate(u(pm.x), u(pm.y)); c.rotate(pm.a * Math.PI / 180);
    c.drawImage(img, -u(P.CX), -u(P.CY), w, u(P.H));
    c.restore();
  }
  c.restore();
}

/* =====================================================================
   郵票：從整個網站的圖案裡抽一張（不一定是自己玩的那一組），偶爾抽到站長
   id：'own'（你蓋出來的這幅）| 'set:<圖案組>'（三色完整版）| 'one:<圖案組>:<站>'（單站的章）| 'master:<造型>'（站長）
   ===================================================================== */
const MASTER = {   // 站長郵票：造型、底色（站的墨色）
  face:  { kind: 'head', mood: '',      bg: 1 },
  happy: { kind: 'head', mood: 'happy', bg: 3 },
  body:  { kind: 'full', mood: 'happy', bg: 2 },
};
export function stampPool() {
  const pool = [{ id: 'own', w: 3 }];
  for (const a of Object.keys(ART_SETS)) {
    pool.push({ id: `set:${a}`, w: 2 });
    for (const n of [1, 2, 3]) pool.push({ id: `one:${a}:${n}`, w: 1 });
  }
  for (const m of Object.keys(MASTER)) pool.push({ id: `master:${m}`, w: 1 });   // 站長比較稀有
  return pool;
}
export function pickStamp() {
  const pool = stampPool(), total = pool.reduce((t, p) => t + p.w, 0);
  let r = Math.random() * total;
  for (const p of pool) { r -= p.w; if (r < 0) return p.id; }
  return 'own';
}

/* 站長的圖：把站務員的 SVG 依表情整理成一張靜態圖（不靠 CSS） */
const masterImg = {};
const masterReady = Promise.all(Object.entries(MASTER).map(([key, m]) => new Promise(res => {
  let svg = attendantSVG(m.kind).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  if (m.kind === 'head') svg = svg.replace(/<g class="att-body">[\s\S]*?<\/g>/, '');
  svg = m.mood === 'happy'
    ? svg.replace(/<g class="att-eyes">[\s\S]*?<\/g>/, '').replace(/<path class="att-mouth-c"[^>]*\/>/, '')
    : svg.replace(/<g class="att-happy"[\s\S]*?<\/g>/, '').replace(/<path class="att-mouth-o"[^>]*\/>/, '');
  const img = new Image();
  img.onload = img.onerror = () => { masterImg[key] = img; res(); if (ui) paint(); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
})));

const stampCache = new Map();
/* 圖案實際畫到的範圍（印面座標 ±150） */
function shapeBox(shape) {
  const n = 150, cv = makeCanvas(n, n), g = cv.getContext('2d', { willReadFrequently: true });
  g.setTransform(n / 300, 0, 0, n / 300, n / 2, n / 2); g.fillStyle = '#000'; shape(g);
  const d = g.getImageData(0, 0, n, n).data;
  let x0 = n, y0 = n, x1 = 0, y1 = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d[(y * n + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < x0) return { x: -150, y: -150, w: 300, h: 300 };
  const k = 300 / n;
  return { x: x0 * k - 150, y: y0 * k - 150, w: (x1 - x0 + 1) * k, h: (y1 - y0 + 1) * k };
}
function drawStampArt(c, x, y, s, id = 'own') {
  const [type, a, n] = String(id).split(':');
  if (type === 'own' || (type !== 'master' && !ART_SETS[a]) || (type === 'master' && !MASTER[a])) {
    c.drawImage(printCv, (CARD.FX - 150) * PR, (CARD.FY - 150) * PR, 300 * PR, 300 * PR, x, y, s, s);
    return;
  }
  const px = Math.max(48, Math.ceil(s * 2)), key = id + '|' + px;
  let cv = stampCache.get(key);
  if (!cv) {
    cv = makeCanvas(px, px);
    const g = cv.getContext('2d');
    if (type === 'master') {
      const M = MASTER[a], img = masterImg[a];
      g.fillStyle = CONFIG.INKS[M.bg].ink; g.fillRect(0, 0, px, px);
      g.globalAlpha = .55; g.fillStyle = '#FBFAF6'; g.fillRect(0, 0, px, px); g.globalAlpha = 1;
      if (!img || !img.naturalWidth) return;            // 圖還在載入：載好後會重畫
      const ar = M.kind === 'head' ? 92 / 104 : 120 / 150, h = px * (M.kind === 'head' ? .82 : .94), w = h * ar;
      g.drawImage(img, (px - w) / 2, px - h - (M.kind === 'head' ? px * .06 : 0), w, h);
    } else {
      g.fillStyle = '#FBFAF6'; g.fillRect(0, 0, px, px);
      const layers = type === 'one' ? [+n] : [1, 2, 3];
      const lc = makeCanvas(px, px), l = lc.getContext('2d');
      // 單站的章：圖案只佔印面的一部分（例如只有天空），放大置中，郵票才不會空空的
      let zoom = 1, ox = 0, oy = 0;
      if (type === 'one') {
        const b = shapeBox(ART_SETS[a].shapes[+n]);
        zoom = Math.min(2.2, 300 * .8 / Math.max(b.w, b.h)); ox = -(b.x + b.w / 2); oy = -(b.y + b.h / 2);
      }
      for (const st of layers) {                         // 三色疊印（相乘），跟卡片上的印法一樣
        l.setTransform(1, 0, 0, 1, 0, 0); l.clearRect(0, 0, px, px);
        l.setTransform(px / 300 * zoom, 0, 0, px / 300 * zoom, px / 2 + ox * px / 300 * zoom, px / 2 + oy * px / 300 * zoom);
        l.fillStyle = CONFIG.INKS[st].ink;
        ART_SETS[a].shapes[st](l);
        g.globalCompositeOperation = 'multiply'; g.drawImage(lc, 0, 0); g.globalCompositeOperation = 'source-over';
      }
    }
    stampCache.set(key, cv);
  }
  c.drawImage(cv, x, y, s, s);
}

/* 正反兩面並排，存成圖片 */
export async function exportBlob() {
  await masterReady;
  const S = CONFIG.POST.EXPORT_SCALE, m = 34, W = CARD.W * 2 + m * 3, H = CARD.H + m * 2;
  const cv = makeCanvas(Math.round(W * S), Math.round(H * S)), c = cv.getContext('2d');
  c.scale(S, S);
  c.fillStyle = '#E8E4DC'; c.fillRect(0, 0, W, H);
  for (const x of [m, m * 2 + CARD.W]) {
    c.save(); c.shadowColor = 'rgba(45,35,20,.22)'; c.shadowBlur = 18; c.shadowOffsetY = 8;
    rr(c, x, m, CARD.W, CARD.H, 7); c.fillStyle = '#F7F4ED'; c.fill(); c.restore();
  }
  renderFront(c, m, m, 1);
  renderBack(c, m * 2 + CARD.W, m, 1, store.card.post || {});
  return await new Promise(res => cv.toBlob(res, 'image/png'));
}
async function saveImage() {
  const blob = await exportBlob(), d = new Date();
  const name = `stamp-postcard-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.png`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const canShareFiles = () => { try { return !!navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }); } catch (_) { return false; } };
async function shareImage() {
  const blob = await exportBlob();
  try { await navigator.share({ files: [new File([blob], 'stamp-postcard.png', { type: 'image/png' })] }); }
  catch (e) { if (e && e.name !== 'AbortError') saveImage(); }
}

/* =====================================================================
   明信片元件：蓋在蓋章畫面的卡片上，正反兩面可以翻
   ===================================================================== */
let ui = null;
function build(getCard) {
  const root = $('#postcard');
  root.innerHTML = `
    <div class="mailbox">${mailboxSVG('back')}</div>
    <div class="pc"><div class="flip"><canvas class="face front"></canvas><canvas class="face back"></canvas></div></div>
    <div class="mailbox front">${mailboxSVG('front')}</div>
    <svg class="msgframe" aria-hidden="true"><rect x="0" y="0" width="100%" height="100%" rx="4" ry="4" vector-effect="non-scaling-stroke" stroke-width="1" stroke-dasharray="5 4"/></svg>
    <div class="msgcatch"></div>
    <textarea id="msgInput" maxlength="${CONFIG.POST.MSG_MAX}" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="message"></textarea>
    <div class="ghost"></div>
    <div class="marker">${handStampSVG(CONFIG.POST.MARK_INK, '#FF48B0')}</div>
    <div class="pbar write">
      <div class="seg">
        <button data-mode="pen" aria-label="pen">${icon(ICON.pen)}</button>
        <button data-mode="type" aria-label="keyboard">${icon(ICON.keyboard)}</button>
      </div>
      <button data-act="clear" aria-label="clear">${icon(ICON.eraser)}</button>
      <button data-act="done" class="done" aria-label="done">${icon(ICON.check)}</button>
    </div>
    <div class="pbar keep">
      <button data-act="flip" aria-label="flip">${icon(ICON.flip)}</button>
      <button data-act="save" aria-label="save">${icon(ICON.download)}</button>
      ${canShareFiles() ? `<button data-act="share" aria-label="share">${icon(ICON.share)}</button>` : ''}
    </div>`;
  root.hidden = false;
  const q = s => root.querySelector(s);
  ui = {
    root, getCard, pc: q('.pc'), flip: q('.flip'), front: q('.front'), back: q('.back'),
    mbBack: q('.mailbox:not(.front)'), mbFront: q('.mailbox.front'), frame: q('.msgframe'), catcher: q('.msgcatch'),
    input: q('#msgInput'), ghost: q('.ghost'), marker: q('.marker'), write: q('.pbar.write'), keep: q('.pbar.keep'),
    flipped: false, follow: true, k: 0, raf: 0, post: { ...(store.card.post || {}) },
  };
  // 一直跟著蓋章畫面上卡片的位置（卡片首頁會慢慢移到中央、視窗大小會變）
  const sync = () => {
    ui.raf = requestAnimationFrame(sync);
    if (!ui.follow) return;
    const R = getCard();
    Object.assign(ui.pc.style, { left: R.x + 'px', top: R.y + 'px', width: R.w + 'px', height: R.h + 'px' });
    ui.keep.style.top = Math.min(innerHeight - 64, R.y + R.h + 22) + 'px';
    if (Math.abs(R.k - ui.k) > 1e-4) { ui.k = R.k; paint(); }
  };
  sync();
  ui.pc.addEventListener('click', () => { if (ui.tapFlip) setFlip(!ui.flipped); });
  ui.keep.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'flip') setFlip(!ui.flipped);
    else if (b.dataset.act === 'save') saveImage();
    else if (b.dataset.act === 'share') shareImage();
  });
}
function paint() {
  const R = ui.getCard(), dpr = Math.min(devicePixelRatio || 1, 2.5);
  for (const [cv, fn] of [[ui.front, renderFront], [ui.back, (c, x, y, k) => renderBack(c, x, y, k, ui.post)]]) {
    cv.width = Math.round(R.w * dpr); cv.height = Math.round(R.h * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); fn(c, 0, 0, R.k);
  }
}
function setFlip(on) { ui.flipped = on; ui.flip.classList.toggle('over', on); }

/* 卡片首頁：直接看明信片（點一下翻面、存圖、分享） */
export function showPostcard(getCard) {
  if (ui) return;
  build(getCard);
  ui.tapFlip = true;
  ui.root.classList.add('keeping');
}
export function hidePostcard() {
  if (!ui) return;
  cancelAnimationFrame(ui.raf);
  ui.root.hidden = true; ui.root.innerHTML = ''; ui.root.className = '';
  ui = null;
  document.body.classList.remove('post-on');
}

/* 等卡片移到定位（卡片首頁會從原本的位置慢慢移到中央） */
async function settle(getCard) {
  let prev = getCard();
  for (let i = 0; i < 120; i++) {
    await new Promise(r => requestAnimationFrame(r));
    const R = getCard();
    if (Math.abs(R.y - prev.y) < .2 && Math.abs(R.x - prev.x) < .2) return R;
    prev = R;
  }
  return prev;
}

/* 整段儀式：翻面 → 留言 → 郵戳 → 郵筒 → 寄回手上（結束時停在「看明信片」的狀態） */
export async function runPostcard(getCard) {
  hidePostcard();
  build(getCard);
  ui.post = { stamp: pickStamp() };
  paint();
  await store.setPost({ stamp: ui.post.stamp });
  document.body.classList.add('post-on');
  let R = await settle(getCard);

  // ---------- 1. 翻面 ----------
  say(COPY.post.flip);
  ui.pc.classList.add('invite');
  await new Promise(res => ui.pc.addEventListener('click', res, { once: true }));
  ui.pc.classList.remove('invite');
  setFlip(true);
  await wait(850);

  // ---------- 2. 留言 ----------
  R = getCard();
  const message = await writeStep(R);
  ui.post.message = message; paint();
  await store.setPost({ message });
  await sayFor(message ? COPY.post.wrote : COPY.post.skipped, 2600);

  // ---------- 3. 郵戳 ----------
  R = getCard();
  const k = R.k, sw = 64 * k * 80 / 54, sh = sw * 112 / 80;
  Object.assign(ui.marker.style, { width: sw + 'px', height: sh + 'px' });
  const gs = 62 * k;
  Object.assign(ui.ghost.style, { width: gs + 'px', height: gs + 'px', marginLeft: -gs / 2 + 'px', marginTop: -gs / 2 + 'px' });
  const home = { x: R.x + R.w * .5, y: Math.min(innerHeight - 22, R.y + R.h + sh * .82 + 14) };
  ui.marker.classList.add('in');
  say(COPY.post.mark);
  const { px, py, ...postmark } = await dragStamp({ el: ui.marker, home, getCard, ghost: ui.ghost, goodS: CONFIG.FINALE.SEAL_GOOD_S });
  postmark.at = new Date().toISOString();
  ui.post.postmark = postmark; paint();
  await store.setPost({ postmark });
  vibe(16);
  ui.marker.classList.remove('in', 'press');
  ui.marker.animate([{ opacity: 1 }, { opacity: 0, translate: '24px -90px', rotate: '8deg' }], { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
  await sayFor(COPY.post.marked, 2400);

  // ---------- 4. 投進郵筒 ----------
  R = getCard();
  await mailStep(R);
  await store.setPost({ sentAt: new Date().toISOString() });
  await sayFor(COPY.post.posted, 3200);

  // ---------- 5. 寄回手上 ----------
  ui.mbBack.classList.add('leave'); ui.mbFront.classList.add('leave');
  await wait(500);
  setFlip(false);
  ui.pc.classList.remove('posting');
  ui.pc.style.transform = '';
  ui.follow = true;
  ui.pc.animate([
    { transform: `translateY(${-R.y - R.h - 40}px) rotate(-8deg)`, opacity: 1 },
    { transform: 'translateY(10px) rotate(1.5deg)', offset: .75 },
    { transform: 'none' },
  ], { duration: 900, easing: 'cubic-bezier(.3,.8,.3,1)' });
  await wait(900);
  vibe(12);
  document.body.classList.remove('post-on');
  ui.tapFlip = true;
  ui.root.classList.add('keeping');
  say(COPY.post.arrived);
}

/* ---------------- 留言：手寫（越快越細）或打字 ---------------- */
function writeStep(R) {
  const O = CONFIG.OPENING, M = BACK.MSG, k = R.k, root = ui.root;
  const box = { left: R.x + M.x * k + 'px', top: R.y + M.y * k + 'px', width: M.w * k + 'px', height: M.h * k + 'px' };
  Object.assign(ui.frame.style, box); Object.assign(ui.catcher.style, box);
  const fs = Math.max(16, M.size * k);
  Object.assign(ui.input.style, {
    left: R.x + M.x * k + 'px', top: R.y + (M.first - M.rule + 6) * k + 'px', width: M.w * k + 'px', height: (M.h - 10) * k + 'px',
    fontSize: fs + 'px', lineHeight: M.rule * k + 'px', fontFamily: NAME_FONT,
  });
  ui.write.style.top = Math.min(innerHeight - 64, R.y + R.h + 18) + 'px';
  ui.frame.classList.add('idle');
  root.classList.add('writing');
  let bctx = ui.back.getContext('2d');
  let mode = 'pen';
  const strokes = [];
  const redraw = () => {             // 切換模式時，背面只顯示那個模式的內容（打字時看不到手寫）
    paint(); bctx = ui.back.getContext('2d');
    if (mode !== 'pen') return;
    bctx.strokeStyle = bctx.fillStyle = PEN_INK; bctx.lineCap = 'round'; bctx.lineJoin = 'round';
    for (const st of strokes) { drawStroke(bctx, 0, 0, k, st, 1); drawTail(bctx, 0, 0, k, st); }
  };
  const setMode = m => {
    mode = m; root.dataset.write = m; redraw();
    ui.write.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    if (m === 'type') ui.input.focus(); else ui.input.blur();
  };
  setMode('pen');
  say(COPY.post.write);

  let cur = null, last = null, pid = null;
  const toCard = e => [(e.clientX - R.x) / k, (e.clientY - R.y) / k];
  ui.catcher.addEventListener('pointerdown', e => {
    e.preventDefault(); if (mode !== 'pen' || pid !== null) return;
    pid = e.pointerId; try { ui.catcher.setPointerCapture(pid); } catch (_) {}
    const [u, v] = toCard(e);
    cur = [[+u.toFixed(1), +v.toFixed(1), +(O.PEN_MAX * .8).toFixed(2)]]; strokes.push(cur);
    ui.frame.classList.remove('idle');
    last = { u, v, t: performance.now(), w: O.PEN_MAX * .8 };
    bctx.strokeStyle = bctx.fillStyle = PEN_INK; bctx.lineCap = 'round'; bctx.lineJoin = 'round';
    drawStroke(bctx, 0, 0, k, cur);
  });
  ui.catcher.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const [u, v] = toCard(e), now = performance.now(), d = Math.hypot(u - last.u, v - last.v);
    if (d < .35) return;
    const w = lerp(last.w, clamp(O.PEN_MAX - d / Math.max(1, now - last.t) * 2.2, O.PEN_MIN, O.PEN_MAX), .4);
    cur.push([+u.toFixed(1), +v.toFixed(1), +w.toFixed(2)]);
    last = { u, v, t: now, w };
    drawStroke(bctx, 0, 0, k, cur, cur.length - 1);
  });
  const end = e => {
    if (e.pointerId !== pid) return; pid = null;
    if (cur) {
      const [u, v] = toCard(e);
      if (Math.hypot(u - last.u, v - last.v) >= .35) { cur.push([+u.toFixed(1), +v.toFixed(1), +last.w.toFixed(2)]); drawStroke(bctx, 0, 0, k, cur, cur.length - 1); }
      drawTail(bctx, 0, 0, k, cur);
    }
    cur = null;
  };
  ui.catcher.addEventListener('pointerup', end); ui.catcher.addEventListener('pointercancel', end);

  return new Promise(res => {
    let finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      ui.input.blur();
      root.classList.remove('writing');
      const sig = strokes.filter(s => s.length), text = ui.input.value.trim();
      res(mode === 'pen' ? (sig.length ? { strokes: sig } : null) : (text ? { text } : null));
    };
    ui.write.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.mode) setMode(b.dataset.mode);
      else if (b.dataset.act === 'clear') { strokes.length = 0; ui.input.value = ''; paint(); ui.frame.classList.add('idle'); if (mode === 'type') ui.input.focus(); }
      else if (b.dataset.act === 'done') finish();
    });
  });
}

/* ---------------- 郵筒：把縮小的明信片拖進投信口 ---------------- */
function mailStep(R) {
  const W = innerWidth, H = innerHeight;
  const mw = clamp(W * .34, 104, 150), mh = mw * 145 / 100;
  const mx = W - mw - Math.max(16, W * .1), my = H - mh - Math.max(10, H * .03);
  for (const el of [ui.mbBack, ui.mbFront]) Object.assign(el.style, { left: mx + 'px', top: my + 'px', width: mw + 'px', height: mh + 'px' });
  const slot = { x: mx + mw * .5, y: my + mh * 43.5 / 145, w: mw * .62 };
  // 卡片縮小、拿到郵筒左邊
  ui.follow = false;
  const s0 = clamp(W * .34 / R.w, .28, .46), c0 = { x: Math.max(R.w * s0 / 2 + 16, mx - R.w * s0 * .75), y: Math.min(H - R.h * s0 / 2 - 30, my + mh * .18) };   // 拿在郵筒左邊、跟投信口差不多高
  const pose = (cx, cy, s, r) => `translate(${cx - (R.x + R.w / 2)}px, ${cy - (R.y + R.h / 2)}px) rotate(${r}deg) scale(${s})`;
  ui.pc.classList.add('posting');
  ui.pc.animate([{ transform: 'none' }, { transform: pose(c0.x, c0.y, s0, -6) }], { duration: 650, easing: 'cubic-bezier(.3,.8,.3,1)' });
  ui.pc.style.transform = pose(c0.x, c0.y, s0, -6);
  ui.mbBack.classList.add('in'); ui.mbFront.classList.add('in');
  say(COPY.post.mail);

  // 拿在手上時縮到比投信口還窄（跟郵筒的比例才合理）；放在郵筒上半部、或投信口附近，就會自己掉進去
  const sHeld = Math.min(s0, slot.w * .8 / R.w);
  const zone = { x0: mx - 24, x1: mx + mw + 24, y0: slot.y - R.h * sHeld - CONFIG.POST.SLOT_SNAP, y1: my + mh * .55 };
  return new Promise(res => {
    let id = null, target = { ...c0 }, pos = { ...c0 }, sc = s0, nag = false, raf = 0, done = false;
    const near = () => pos.x > zone.x0 && pos.x < zone.x1 && pos.y > zone.y0 && pos.y < zone.y1;
    const tick = () => {             // 卡片跟著手指，縮放與位置都柔和地跟上
      raf = requestAnimationFrame(tick);
      const sT = id !== null ? sHeld : s0;
      sc = lerp(sc, sT, .4); pos = { x: lerp(pos.x, target.x, .45), y: lerp(pos.y, target.y, .45) };
      const n = id !== null && near();
      ui.pc.style.transform = pose(pos.x, pos.y, sc, n ? 0 : id !== null ? -3 : -6);
      ui.mbFront.classList.toggle('near', n);
    };
    raf = requestAnimationFrame(tick);
    const down = e => {
      e.preventDefault(); if (id !== null || done) return;
      id = e.pointerId; try { ui.pc.setPointerCapture(id); } catch (_) {}
      target = { x: e.clientX, y: e.clientY };            // 拿起來：卡片中心移到手指下
      ui.pc.classList.add('held');
    };
    const move = e => { if (e.pointerId === id) target = { x: e.clientX, y: e.clientY }; };
    const up = async e => {
      if (e.pointerId !== id) return;
      id = null; ui.mbFront.classList.remove('near');
      pos = { ...target };
      if (!near()) {                 // 沒放到郵筒上：回到原位
        ui.pc.classList.remove('held');
        target = { ...c0 };
        if (!nag) { nag = true; say(COPY.post.mailHint); }
        return;
      }
      done = true; cancelAnimationFrame(raf);
      ui.pc.removeEventListener('pointerdown', down); ui.pc.removeEventListener('pointermove', move);
      ui.pc.removeEventListener('pointerup', up); ui.pc.removeEventListener('pointercancel', up);
      // 對準投信口 → 滑進去（這時才躲到郵筒前片後面）
      const s1 = slot.w * .8 / R.w, top = { x: slot.x, y: slot.y - R.h * s1 / 2 };
      await ui.pc.animate([{ transform: ui.pc.style.transform }, { transform: pose(top.x, top.y, s1, 0) }], { duration: 240, easing: 'ease-out', fill: 'forwards' }).finished;
      ui.pc.classList.remove('held'); ui.pc.classList.add('slotting');
      await ui.pc.animate([{ transform: pose(top.x, top.y, s1, 0) }, { transform: pose(top.x, top.y + R.h * s1 + 8, s1, 0) }], { duration: 460, easing: 'cubic-bezier(.5,0,.8,.5)', fill: 'forwards' }).finished;
      ui.pc.getAnimations().forEach(a => a.cancel());
      ui.pc.style.transform = pose(top.x, top.y + R.h * s1 + 8, s1, 0); ui.pc.style.opacity = '0';
      ui.pc.classList.remove('slotting');
      vibe([10, 30, 10]);
      ui.mbFront.classList.add('posted'); ui.mbBack.classList.add('posted');
      await wait(450);
      ui.pc.style.opacity = '';
      res();
    };
    ui.pc.addEventListener('pointerdown', down); ui.pc.addEventListener('pointermove', move);
    ui.pc.addEventListener('pointerup', up); ui.pc.addEventListener('pointercancel', up);
  });
}

/* 郵筒（原創造型）：圓頂、藍色筒身、投信口、側邊小旗子。back = 整個筒身；front = 投信口下緣以下（明信片從這裡被擋住） */
function mailboxSVG(part) {
  const body = '#0078BF', dark = '#0A5E93';
  if (part === 'back') return `<svg viewBox="0 0 100 145" aria-hidden="true">
    <ellipse cx="50" cy="143" rx="40" ry="3.5" fill="rgba(45,35,20,.2)"/>
    <path d="M10 141 V42 A40 40 0 0 1 90 42 V141 Z" fill="${body}"/>
    <path d="M18 34 A33 30 0 0 1 50 10" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/>
    <rect x="19" y="39" width="62" height="7" rx="3.5" fill="#123048"/>
  </svg>`;
  return `<svg viewBox="0 0 100 145" aria-hidden="true">
    <path d="M10 141 V44.6 H19 A3.5 3.5 0 0 0 22.5 46 H77.5 A3.5 3.5 0 0 0 81 44.6 H90 V141 Z" fill="${body}"/>
    <rect x="10" y="44.6" width="80" height="2" fill="${dark}" opacity=".6"/>
    <rect x="27" y="66" width="46" height="30" rx="4" fill="#F7F4EE"/>
    <circle cx="39" cy="81" r="4" fill="#FFE800"/><circle cx="50" cy="81" r="4" fill="#0078BF"/><circle cx="61" cy="81" r="4" fill="#FF48B0"/>
    <rect x="10" y="126" width="80" height="15" fill="${dark}"/>
    <g class="flag"><rect x="90" y="56" width="3" height="40" rx="1.5" fill="#24221F"/><path d="M93 58 H110 V70 H93 Z" fill="#FFE800" stroke="#24221F" stroke-width="1"/></g>
  </svg>`;
}
