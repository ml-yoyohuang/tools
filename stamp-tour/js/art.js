/* 印章圖案組（印面座標，中心為 0，範圍 ±150）
   每一組都是三層、一站一層：1 黃、2 藍、3 粉紅。每一張集章卡會記住自己用的是哪一組。 */
import { CONFIG, ROT } from './config.js';
import { TAU, rr } from './util.js';

/* 沿三次貝茲曲線畫一條由粗到細的管子（象鼻） */
function tube(c, p0, p1, p2, p3, w0, w1) {
  const N = 28, L = [], R = [];
  const B = (t, a, b, cc, d) => ((1 - t) ** 3) * a + 3 * ((1 - t) ** 2) * t * b + 3 * (1 - t) * t * t * cc + t ** 3 * d;
  const D = (t, a, b, cc, d) => 3 * ((1 - t) ** 2) * (b - a) + 6 * (1 - t) * t * (cc - b) + 3 * t * t * (d - cc);
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = B(t, p0[0], p1[0], p2[0], p3[0]), y = B(t, p0[1], p1[1], p2[1], p3[1]);
    let dx = D(t, p0[0], p1[0], p2[0], p3[0]), dy = D(t, p0[1], p1[1], p2[1], p3[1]);
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = w0 + (w1 - w0) * t;
    L.push([x - dy * w, y + dx * w]); R.push([x + dy * w, y - dx * w]);
  }
  c.beginPath(); L.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
  for (let i = R.length - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
  c.closePath(); c.fill();
  c.beginPath(); c.arc(p3[0], p3[1], w1, 0, TAU); c.fill();
}

/* 蓬鬆的雲：一條圓角長條＋三顆雲朵 */
function cloud(c, cx, cy, s) {
  rr(c, cx - 48 * s, cy - 15 * s, 96 * s, 30 * s, 15 * s); c.fill();
  for (const [x, y, r] of [[-26, -17, 20], [2, -31, 26], [28, -17, 18]]) { c.beginPath(); c.arc(cx + x * s, cy + y * s, r * s, 0, TAU); c.fill(); }
}

export const ART_SETS = {
  /* 日、海、鳥：疊在一起時三色會互相重疊，蓋章順序直接改變顏色 */
  classic: {
    label: '日海鳥',
    names: { 1: '日', 2: '海', 3: '鳥' },
    shapes: {
      1(c) {   // 日：日輪＋地平帶
        c.beginPath(); c.arc(-34, -38, 80, 0, TAU); c.fill();
        rr(c, -134, 48, 268, 46, 12); c.fill();
      },
      2(c) {   // 海：海面＋浮浪
        c.beginPath(); c.moveTo(-140, 140);
        for (let x = -140; x <= 140; x += 4) c.lineTo(x, 74 + 11 * Math.sin((x + 140) / 280 * TAU * 1.5 + .6));
        c.lineTo(140, 140); c.closePath(); c.fill();
        const x0 = -140, x1 = 34, yc = x => 20 + 7 * Math.sin((x - x0) / 120 * TAU);
        c.beginPath();
        for (let x = x0; x <= x1; x += 4) c.lineTo(x, yc(x) - 14);
        c.arc(x1, yc(x1), 14, -Math.PI / 2, Math.PI / 2);
        for (let x = x1; x >= x0; x -= 4) c.lineTo(x, yc(x) + 14);
        c.closePath(); c.fill();
      },
      3(c) {   // 鳥：飛鳥＋小舟
        c.beginPath(); c.ellipse(40, -58, 42, 22, -.32, 0, TAU); c.fill();
        c.beginPath(); c.arc(80, -78, 16, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(93, -85); c.lineTo(113, -78); c.lineTo(94, -70); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(16, -66); c.bezierCurveTo(28, -122, 78, -144, 120, -134);
        c.bezierCurveTo(92, -112, 72, -80, 56, -62); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(6, -52); c.lineTo(-36, -34); c.lineTo(-28, -68); c.closePath(); c.fill();
        c.beginPath(); c.arc(60, 72, 46, 0, Math.PI); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(52, 62); c.lineTo(52, 6); c.lineTo(96, 62); c.closePath(); c.fill();
      },
    },
  },

  /* 天空、山、大象：正確對準時三色完全不重疊，錯位時才會疊色 */
  elephant: {
    label: '天山象',
    names: { 1: '天空', 2: '山', 3: '大象' },
    shapes: {
      1(c) {   // 天空：兩朵雲，一大一小、一高一低
        cloud(c, -74, -91, 1);
        cloud(c, 86, -34, .78);
      },
      2(c) {   // 山：兩道圓頂山稜，和地面是同一塊，右下角圓順收邊
        c.beginPath(); c.moveTo(-130, 116); c.lineTo(12, 116);
        c.bezierCurveTo(24, 110, 34, 76, 48, 76); c.bezierCurveTo(60, 76, 64, 88, 70, 86);
        c.bezierCurveTo(78, 62, 88, 38, 100, 38); c.bezierCurveTo(118, 38, 140, 78, 148, 106);
        c.lineTo(148, 128); c.quadraticCurveTo(148, 140, 136, 140);
        c.lineTo(-130, 140); c.quadraticCurveTo(-142, 140, -142, 128); c.quadraticCurveTo(-142, 116, -130, 116);
        c.closePath(); c.fill();
      },
      3(c) {   // 大象：大頭、大耳朵、曲線象鼻、短腿，最前面那隻腳微微往前踏（刻意和身體分開）
        c.save(); c.translate(-74, -16);
        c.beginPath(); c.ellipse(-8, 76, 54, 36, 0, 0, TAU); c.fill();
        for (const [x, y, w, h] of [[-52, 90, 26, 36], [-22, 94, 26, 32], [10, 94, 26, 32]]) { rr(c, x, y, w, h, 12); c.fill(); }
        c.save(); c.translate(51, 92); c.rotate(-.38); rr(c, -13, -4, 26, 38, 12); c.fill(); c.restore();
        c.beginPath(); c.arc(40, 26, 44, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(8, 30, 30, 36, -.15, 0, TAU); c.fill();
        tube(c, [70, 30], [86, 72], [106, 90], [116, 62], 14, 8.5);
        for (const [x, y, r] of [[-63, 64, 6], [-69, 73, 6.5]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
        c.save(); c.globalCompositeOperation = 'destination-out';      // 眼睛與耳朵的留白
        c.beginPath(); c.arc(58, 14, 5.5, 0, TAU); c.fill();
        c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.ellipse(8, 30, 30, 36, -.15, -1.25, 1.2); c.stroke();
        c.restore();
        c.restore();
      },
    },
  },
};

/* 目前使用的圖案組（由主程式依集章卡設定） */
let current = ART_SETS[CONFIG.ART_SET] ? CONFIG.ART_SET : 'classic';
export const artId = () => current;
export function setArt(id) { current = ART_SETS[id] ? id : 'classic'; }
export const shapeOf = station => ART_SETS[current].shapes[station];
export const stationName = station => ART_SETS[current].names[station];

/* 對位標記：四角＋十字＋三角形 */
function guidesPath(c) {
  const F = 150, L = 20;
  c.beginPath();
  c.moveTo(-F, -F + L); c.lineTo(-F, -F); c.lineTo(-F + L, -F);
  c.moveTo(F - L, -F); c.lineTo(F, -F); c.lineTo(F, -F + L);
  c.moveTo(F, F - L); c.lineTo(F, F); c.lineTo(F - L, F);
  c.moveTo(-F + L, F); c.lineTo(-F, F); c.lineTo(-F, F - L);
  c.moveTo(-14, 0); c.lineTo(14, 0); c.moveTo(0, -14); c.lineTo(0, 14);
}
export function drawGuides(c, stroke, lw, fill) {
  c.lineCap = 'butt'; c.lineJoin = 'miter';
  c.strokeStyle = stroke; c.lineWidth = lw; guidesPath(c); c.stroke();
  if (ROT) {
    c.beginPath(); c.moveTo(0, -167); c.lineTo(-8, -155); c.lineTo(8, -155); c.closePath();
    c.fillStyle = fill || stroke; c.fill();
  }
}
