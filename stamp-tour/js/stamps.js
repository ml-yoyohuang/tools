/* 明信片上的郵票：寄出時從整個網站的圖案裡抽一張，存在卡上
   id 的種類：
     own                  你蓋出來的這幅（正面縮圖）
     set:<圖案組>          任一組的三色完整圖（不一定是自己玩的那一組）
     one:<圖案組>:<站>     單站的章（放大置中）
     master:<造型>         站務員：face / happy / body / grid（四宮格表情）/ big（超大臉）
     geo:<花樣>            幾何花樣：venn / stripe / flags / dots / rays / check
   全部用 Canvas 畫，同步完成（存成圖片時不用等載入）。 */
import { CONFIG } from './config.js';
import { CARD, PR, printCv } from './print.js';
import { ART_SETS } from './art.js';
import { makeCanvas, hash2 } from './util.js';

const PAPER = '#FBFAF6', INK = n => CONFIG.INKS[n].ink;
const Y = () => INK(1), B = () => INK(2), P = () => INK(3);

/* ---------------- 抽獎池 ---------------- */
export const MASTER_LOOKS = ['face', 'happy', 'body', 'grid', 'big'];
export const GEO = ['venn', 'stripe', 'flags', 'dots', 'rays', 'check'];
export function stampPool() {
  const pool = [{ id: 'own', w: 3, group: '自己的圖' }];
  for (const a of Object.keys(ART_SETS)) pool.push({ id: `set:${a}`, w: 2, group: '三色完整圖' });
  for (const a of Object.keys(ART_SETS)) for (const n of [1, 2, 3]) pool.push({ id: `one:${a}:${n}`, w: 1, group: '單站章' });
  for (const m of MASTER_LOOKS) pool.push({ id: `master:${m}`, w: 1, group: '站務員' });   // 比較稀有
  for (const g of GEO) pool.push({ id: `geo:${g}`, w: 1, group: '幾何花樣' });
  return pool;
}
export function pickStamp() {
  const pool = stampPool(), total = pool.reduce((t, p) => t + p.w, 0);
  let r = Math.random() * total;
  for (const p of pool) { r -= p.w; if (r < 0) return p.id; }
  return 'own';
}

/* ---------------- 整張郵票：齒孔邊＋圖＋三色小點（x, y, w, h 為 px） ---------------- */
export function drawPostage(c, x, y, w, h, id) {
  const u = w / 76;                      // 郵票設計稿寬 76
  c.save();
  c.shadowColor = 'rgba(45,35,20,.18)'; c.shadowBlur = 2 * u; c.shadowOffsetY = .6 * u;
  c.fillStyle = '#FDFCF8'; c.fillRect(x, y, w, h);
  c.restore();
  c.fillStyle = '#F2EEE6';
  for (let t = 4 * u; t < w; t += 6 * u) for (const yy of [y, y + h]) { c.beginPath(); c.arc(x + t, yy, 1.8 * u, 0, Math.PI * 2); c.fill(); }
  for (let t = 4 * u; t < h; t += 6 * u) for (const xx of [x, x + w]) { c.beginPath(); c.arc(xx, y + t, 1.8 * u, 0, Math.PI * 2); c.fill(); }
  const iw = w - 14 * u;
  drawStampArt(c, x + 7 * u, y + 7 * u, iw, id);
  c.strokeStyle = 'rgba(60,52,40,.2)'; c.lineWidth = Math.max(.6, u * .5); c.strokeRect(x + 7 * u, y + 7 * u, iw, iw);
  [1, 2, 3].forEach((st, i) => { c.fillStyle = INK(st); c.beginPath(); c.arc(x + w / 2 + (i - 1) * 8 * u, y + h - 8 * u, 2.2 * u, 0, Math.PI * 2); c.fill(); });
}

/* ---------------- 郵票的圖（正方形，s = 邊長 px） ---------------- */
const cache = new Map();
export function drawStampArt(c, x, y, s, id = 'own') {
  const [type, a, n] = String(id).split(':');
  const ok = type === 'set' || type === 'one' ? !!ART_SETS[a] : type === 'master' ? MASTER_LOOKS.includes(a) : type === 'geo' ? GEO.includes(a) : false;
  if (!ok) {                             // own（或之後被移除的圖案）：正面縮圖
    c.drawImage(printCv, (CARD.FX - 150) * PR, (CARD.FY - 150) * PR, 300 * PR, 300 * PR, x, y, s, s);
    return;
  }
  const px = Math.max(48, Math.ceil(s * 2)), key = id + '|' + px;
  let cv = cache.get(key);
  if (!cv) {
    cv = makeCanvas(px, px);
    const g = cv.getContext('2d');
    g.fillStyle = PAPER; g.fillRect(0, 0, px, px);
    g.scale(px / 100, px / 100);          // 圖的座標：0 ~ 100
    if (type === 'set' || type === 'one') artStamp(g, px, a, type === 'one' ? +n : 0);
    else if (type === 'master') masterStamp(g, a);
    else geoStamp(g, a);
    cache.set(key, cv);
  }
  c.drawImage(cv, x, y, s, s);
}

/* 三色疊印（相乘）：每一色先畫在自己的圖層，再相乘疊上去，跟卡片上的印法一樣 */
function multiplyLayer(g, paint) {
  const W = g.canvas.width, lc = makeCanvas(W, W), l = lc.getContext('2d');
  l.scale(W / 100, W / 100); paint(l);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.drawImage(lc, 0, 0); g.restore();
}

/* ---------------- 圖案組的章 ---------------- */
function artStamp(g, px, a, only) {
  const shapes = ART_SETS[a].shapes;
  let zoom = 1, ox = 0, oy = 0;
  if (only) {                            // 單站：圖案只佔印面的一部分，放大置中
    const b = shapeBox(shapes[only]);
    zoom = Math.min(2.2, 300 * .8 / Math.max(b.w, b.h)); ox = -(b.x + b.w / 2); oy = -(b.y + b.h / 2);
  }
  for (const st of only ? [only] : [1, 2, 3]) multiplyLayer(g, l => {
    l.translate(50, 50); l.scale(zoom / 3, zoom / 3); l.translate(ox, oy);
    l.fillStyle = INK(st); shapes[st](l);
  });
}
function shapeBox(shape) {               // 圖案實際畫到的範圍（印面座標 ±150）
  const n = 150, cv = makeCanvas(n, n), g = cv.getContext('2d', { willReadFrequently: true });
  g.setTransform(n / 300, 0, 0, n / 300, n / 2, n / 2); g.fillStyle = '#000'; shape(g);
  const d = g.getImageData(0, 0, n, n).data;
  let x0 = n, y0 = n, x1 = 0, y1 = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d[(y * n + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < x0) return { x: -150, y: -150, w: 300, h: 300 };
  const k = 300 / n;
  return { x: x0 * k - 150, y: y0 * k - 150, w: (x1 - x0 + 1) * k, h: (y1 - y0 + 1) * k };
}

/* ---------------- 站務員 ---------------- */
/* 用 Canvas 重畫站務員（座標同 attendant.js 的 120 × 150），表情可以自由組合
   mood：normal / happy / surprised / wink / teary */
const P2 = d => new Path2D(d);
const FACE = {
  head: P2('M20 70 C20 40 38 26 60 26 C82 26 100 40 100 70 C100 94 84 104 60 104 C36 104 20 94 20 70 Z'),
  cap: P2('M27 39 L31 16 Q60 4 89 16 L93 39 Z'),
  brim: P2('M22 38 Q60 56 98 38 L95 37 Q60 47 25 37 Z'),
  body: P2('M16 150 C18 121 34 106 60 106 C86 106 102 121 104 150 Z'),
  collar: P2('M45 106 L60 125 L75 106 Z'),
  tie: P2('M55 112 L60 118 L65 112 L60 130 Z'),
};
export function drawAttendant(g, mood = 'normal', body = false) {
  const ink = '#24221F';
  g.save();
  if (body) {
    g.fillStyle = '#0078BF'; g.fill(FACE.body);
    g.fillStyle = '#F7F4EE'; g.fill(FACE.collar);
    g.fillStyle = '#FF48B0'; g.fill(FACE.tie);
    g.fillStyle = '#FFE800'; for (const bx of [44, 76]) { g.beginPath(); g.arc(bx, 136, 3, 0, Math.PI * 2); g.fill(); }
  }
  g.fillStyle = '#F3E3CF'; g.fill(FACE.head);
  g.fillStyle = ink; g.fill(FACE.cap);
  g.fillStyle = '#FF48B0'; g.fillRect(29, 29, 62, 7);
  g.fillStyle = '#FFE800'; g.beginPath(); g.arc(60, 21, 5.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = ink; g.fill(FACE.brim);
  g.strokeStyle = g.fillStyle = ink; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
  const dot = (x, y, r = 2.8) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const line = d => g.stroke(P2(d));
  const smile = () => line('M55 72 Q60 77 65 72');
  const open = () => g.fill(P2('M54.5 71 Q60 83 65.5 71 Z'));
  if (mood === 'happy') { line('M46 60 Q50 54.5 54 60'); line('M66 60 Q70 54.5 74 60'); open(); }
  else if (mood === 'surprised') {
    g.lineWidth = 1.8; line('M45.5 50 Q50 47.5 54.5 50'); line('M65.5 50 Q70 47.5 74.5 50');
    dot(50, 58, 3.6); dot(70, 58, 3.6);
    g.fillStyle = '#fff'; dot(51.2, 56.8, 1.1); dot(71.2, 56.8, 1.1); g.fillStyle = ink;
    g.beginPath(); g.ellipse(60, 76, 3.4, 4.4, 0, 0, Math.PI * 2); g.fill();
  } else if (mood === 'wink') {
    dot(50, 58); line('M66 58.5 Q70 55 74 58.5'); open();
    g.fillStyle = '#FF7FC4'; g.beginPath(); g.ellipse(60, 78.5, 3, 2, 0, 0, Math.PI * 2); g.fill();
  } else if (mood === 'teary') {
    line('M46 57 Q50 61.5 54 57'); line('M66 57 Q70 61.5 74 57');
    line('M54 75 Q57 72 60 75 Q63 78 66 75');
    g.fillStyle = '#7FC4EE';              // 感動的眼淚
    for (const tx of [47, 73]) g.fill(P2(`M${tx} 61 Q${tx - 3} 66 ${tx} 68 Q${tx + 3} 66 ${tx} 61 Z`));
  } else { dot(50, 58); dot(70, 58); smile(); }
  g.restore();
}
function tint(g, color, x = 0, y = 0, w = 100, h = 100, a = .55) {   // 站色底，蓋一層紙色讓它淡一點
  g.fillStyle = color; g.fillRect(x, y, w, h);
  g.globalAlpha = a; g.fillStyle = PAPER; g.fillRect(x, y, w, h); g.globalAlpha = 1;
}
/* 只畫頭，放進 (x, y, w, h) 的格子；zoom 越大越靠近臉 */
function head(g, mood, x, y, w, h, zoom = 1, cy = 64) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const s = w / 92 * zoom;
  g.translate(x + w / 2, y + h / 2); g.scale(s, s); g.translate(-60, -cy);
  drawAttendant(g, mood);
  g.restore();
}
function masterStamp(g, look) {
  if (look === 'face') { tint(g, Y()); head(g, 'normal', 0, 6, 100, 100, .9, 60); }
  else if (look === 'happy') { tint(g, P()); head(g, 'happy', 0, 6, 100, 100, .9, 60); }
  else if (look === 'body') {
    tint(g, B());
    g.save(); g.translate(50, 100); g.scale(.62, .62); g.translate(-60, -150); drawAttendant(g, 'happy', true); g.restore();
  } else if (look === 'grid') {          // 四宮格：四種表情
    const cells = [['happy', Y()], ['surprised', B()], ['wink', P()], ['teary', '#F3E3CF']];
    cells.forEach(([mood, col], i) => {
      const cx = (i % 2) * 50, cy = Math.floor(i / 2) * 50;
      tint(g, col, cx, cy, 50, 50, col === '#F3E3CF' ? .2 : .55);
      head(g, mood, cx, cy + 2, 50, 50, 1.16, 62);
    });
    g.fillStyle = PAPER; g.fillRect(49.3, 0, 1.4, 100); g.fillRect(0, 49.3, 100, 1.4);
  } else if (look === 'big') {           // 超大臉：臉塞滿整張郵票
    tint(g, P(), 0, 0, 100, 100, .7);
    head(g, 'normal', 0, 0, 100, 100, 1.9, 60);   // 帽簷還看得到，才認得出是站務員
  }
}

/* ---------------- 幾何花樣（三色相乘疊印、帶一點錯版） ---------------- */
function geoStamp(g, kind) {
  if (kind === 'venn') {                 // 三色圓：三個圓互相疊出六種顏色
    [[50, 37, 1], [37, 60, 2], [63, 60, 3]].forEach(([x, y, st]) =>
      multiplyLayer(g, l => { l.fillStyle = INK(st); l.beginPath(); l.arc(x, y, 24, 0, Math.PI * 2); l.fill(); }));
  } else if (kind === 'stripe') {        // 斜紋：會場布條的三色條紋
    multiplyLayer(g, l => {
      l.translate(50, 50); l.rotate(-Math.PI / 6); l.translate(-80, -80);
      const cols = [Y(), B(), P(), null];
      for (let i = 0; i < 20; i++) { const col = cols[i % 4]; if (col) { l.fillStyle = col; l.fillRect(i * 8, 0, 8, 160); } }
    });
  } else if (kind === 'flags') {         // 三角旗：一排一排的彩旗
    for (let row = 0; row < 4; row++) multiplyLayer(g, l => {
      const y = 10 + row * 23, sag = 5;
      l.strokeStyle = '#24221F'; l.globalAlpha = .55; l.lineWidth = .8;
      l.beginPath(); l.moveTo(-2, y); l.quadraticCurveTo(50, y + sag * 2, 102, y); l.stroke(); l.globalAlpha = 1;
      for (let i = 0; i < 7; i++) {
        const x = 4 + i * 14 + (row % 2) * 7, yy = y + sag * 4 * (x / 100) * (1 - x / 100);
        l.fillStyle = INK(1 + (i + row) % 3);
        l.beginPath(); l.moveTo(x - 5, yy); l.lineTo(x + 5, yy); l.lineTo(x, yy + 11); l.closePath(); l.fill();
      }
    });
  } else if (kind === 'dots') {          // 網點：兩組網點不同角度疊在一起（Riso 的網點錯紋）
    multiplyLayer(g, l => { l.fillStyle = B(); for (let y = 2; y < 102; y += 7) for (let x = 2; x < 102; x += 7) { const r = .6 + 2.9 * (x / 100); l.beginPath(); l.arc(x, y, r, 0, Math.PI * 2); l.fill(); } });
    multiplyLayer(g, l => {
      l.translate(50, 50); l.rotate(.26); l.translate(-60, -60); l.fillStyle = P();
      for (let y = 0; y < 122; y += 7) for (let x = 0; x < 122; x += 7) { const r = .6 + 2.9 * (y / 120); l.beginPath(); l.arc(x, y, r, 0, Math.PI * 2); l.fill(); }
    });
  } else if (kind === 'rays') {          // 放射：日輪光芒＋藍色圓環＋粉紅圓心
    multiplyLayer(g, l => {
      l.fillStyle = Y();
      for (let i = 0; i < 16; i += 2) { const a0 = i * Math.PI / 8, a1 = a0 + Math.PI / 8; l.beginPath(); l.moveTo(50, 50); l.arc(50, 50, 80, a0, a1); l.closePath(); l.fill(); }
    });
    multiplyLayer(g, l => { l.strokeStyle = B(); l.lineWidth = 7; l.beginPath(); l.arc(51.5, 49, 25, 0, Math.PI * 2); l.stroke(); });
    multiplyLayer(g, l => { l.fillStyle = P(); l.beginPath(); l.arc(49, 51.5, 12, 0, Math.PI * 2); l.fill(); });
  } else if (kind === 'check') {         // 棋盤：藍色棋盤＋錯開半格的黃色棋盤
    multiplyLayer(g, l => { l.fillStyle = B(); for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if ((x + y) % 2 === 0) l.fillRect(x * 20, y * 20, 20, 20); });
    multiplyLayer(g, l => { l.fillStyle = Y(); for (let y = -1; y < 5; y++) for (let x = -1; x < 5; x++) if ((x + y) % 2 === 0) l.fillRect(x * 20 + 10, y * 20 + 10, 20, 20); });
    multiplyLayer(g, l => { l.fillStyle = P(); for (let i = 0; i < 4; i++) { l.beginPath(); l.arc(20 + (i % 2) * 60, 20 + Math.floor(i / 2) * 60, 4, 0, Math.PI * 2); l.fill(); } });
  }
  // 一點點紙紋，讓花樣不要太像電腦圖
  const W = g.canvas.width, img = g.getImageData(0, 0, W, W), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const nn = (hash2(i >> 2, 7, 3) - .5) * 10; d[i] += nn; d[i + 1] += nn; d[i + 2] += nn; }
  g.putImageData(img, 0, 0);
}
