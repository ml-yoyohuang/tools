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

/* ── 天山象的三個圖形（原版和大正昭和版共用） ── */
function skyClouds(c, dy) {   // 天空：兩朵雲，一大一小、一高一低；dy = 左邊大雲往下移多少
  cloud(c, -74, -91 + dy, 1);
  cloud(c, 86, -34, .78);
}
function mountain(c) {   // 山：兩道圓頂山稜，和地面是同一塊，右下角圓順收邊
  c.beginPath(); c.moveTo(-130, 116); c.lineTo(12, 116);
  c.bezierCurveTo(24, 110, 34, 76, 48, 76); c.bezierCurveTo(60, 76, 64, 88, 70, 86);
  c.bezierCurveTo(78, 62, 88, 38, 100, 38); c.bezierCurveTo(118, 38, 140, 78, 148, 106);
  c.lineTo(148, 128); c.quadraticCurveTo(148, 140, 136, 140);
  c.lineTo(-130, 140); c.quadraticCurveTo(-142, 140, -142, 128); c.quadraticCurveTo(-142, 116, -130, 116);
  c.closePath(); c.fill();
}
function elephant(c) {   // 大象：大頭、大耳朵、曲線象鼻、短腿，最前面那隻腳微微往前踏（刻意和身體分開）
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
}

/* ── 大正昭和版的外框與點綴（印面座標，±150） ── */
const RETRO_ART = { SCALE: 0.74, DY: 8 };   // 原圖縮小多少、往下移多少，讓出外框和題帶的位置
function inFrame(c, draw) {
  c.save(); c.translate(0, RETRO_ART.DY); c.scale(RETRO_ART.SCALE, RETRO_ART.SCALE); draw(); c.restore();
}
/* 入隅角方框：四角往內凹成四分之一圓 */
const notched = (F, r) => `M${-F + r} ${-F}H${F - r}A${r} ${r} 0 0 0 ${F} ${-F + r}V${F - r}A${r} ${r} 0 0 0 ${F - r} ${F}` +
  `H${-F + r}A${r} ${r} 0 0 0 ${-F} ${F - r}V${-F + r}A${r} ${r} 0 0 0 ${-F + r} ${-F}Z`;
const RETRO = {
  outer: new Path2D(notched(146, 16)),
  inner: new Path2D(notched(134, 12)),
  diamonds: new Path2D('M-146 -10L-139 0L-146 10L-153 0ZM146 -10L153 0L146 10L139 0ZM-10 146L0 139L10 146L0 153Z'),
  speed: new Path2D('M-108 -120H-66M-100 -114H-66M-92 -108H-66M108 -120H66M100 -114H66M92 -108H66'),
  banner: new Path2D('M-58 -126H58L50 -114L58 -102H-58L-50 -114Z'),
  /* 手寫注音「ㄒㄧㄤˋ ㄕㄢ」：每個符號 10×14 的方格，上下對齊；聲調在中線上 */
  zhuyin: new Path2D(
    'M-36.5 -120H-26.5M-31.5 -120V-107' +                                                      // ㄒ
    'M-23.5 -114H-13.5' +                                                                      // ㄧ
    'M-10.5 -116H-0.5M-6.5 -121V-116Q-6.5 -110.5 -10 -107M-3.5 -116V-109Q-3.5 -107 -0.5 -107' + // ㄤ
    'M2 -116L5 -112' +                                                                         // ˋ
    'M14.5 -120H23.5V-116H14.5M14.5 -116V-113Q14.5 -109 12.5 -107' +                            // ㄕ
    'M27.5 -120H35Q36.5 -120 35.3 -118.4L34 -117M27.5 -120V-113H36.5V-109Q36.5 -107 34 -107'),  // ㄢ
  chain: new Path2D('M0 117L6 124L0 131L-6 124ZM-16 120L-12 124L-16 128L-20 124ZM16 120L20 124L16 128L12 124Z' +
    'M-30 121.5L-27.5 124L-30 126.5L-32.5 124ZM30 121.5L32.5 124L30 126.5L27.5 124Z'),
};
/* 象鼻噴水：水滴沿著一條往右上拋、再微微落下的弧線排列，越遠越小；
   每顆都是圓頭在前、尖尾朝向象鼻（原圖座標，跟著原圖一起縮小） */
const SPRAY = {
  P: [[54, 30], [72, -16], [106, 8]],                       // 二次貝茲：起點（象鼻尖旁）、控制點、終點
  DROPS: [[.14, 4.6], [.5, 3.9], [.86, 3.2]],              // [沿弧線的位置 0~1, 圓頭半徑]
  TAIL: 2.1,                                               // 尾巴長度 = 半徑的幾倍
};
function spray(c) {
  const [[x0, y0], [x1, y1], [x2, y2]] = SPRAY.P;
  for (const [t, r] of SPRAY.DROPS) {
    const u = 1 - t;
    const x = u * u * x0 + 2 * t * u * x1 + t * t * x2, y = u * u * y0 + 2 * t * u * y1 + t * t * y2;
    const a = Math.atan2(u * (y1 - y0) + t * (y2 - y1), u * (x1 - x0) + t * (x2 - x1));
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.moveTo(-SPRAY.TAIL * r, 0);
    c.quadraticCurveTo(-r * .6, -r, 0, -r); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); c.quadraticCurveTo(-r * .6, r, -SPRAY.TAIL * r, 0);
    c.fill(); c.restore();
  }
}
function plum(c, x, y) {   // 梅鉢：五顆小圓圍成一朵
  for (const [dx, dy] of [[0, -4.2], [4, -1.3], [2.5, 3.4], [-2.5, 3.4], [-4, -1.3]]) { c.beginPath(); c.arc(x + dx, y + dy, 3, 0, TAU); c.fill(); }
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
      1(c) { skyClouds(c, 0); },
      2(c) { mountain(c); },
      3(c) { elephant(c); },
    },
  },

  /* 天山象・大正昭和版：入隅角的車站紀念章外框＋Art Deco 點綴，原圖縮小放進框裡
     外框也拆進三色：黃＝四角梅鉢、藍＝粗外框＋菱形＋速度線、粉紅＝細內框＋注音題帶＋菱形鍊
     正確對準時三色仍然完全不重疊 */
  elephantRetro: {
    label: '天山象・昭和',
    names: { 1: '天空', 2: '山', 3: '大象' },
    shapes: {
      1(c) {   // 天空：左邊大雲往下移，避開題帶；三條霞；四角梅鉢
        inFrame(c, () => {
          skyClouds(c, 14);
          for (const [x, y, w, h] of [[-6, -118, 120, 9], [10, -100, 70, 7], [-142, -46, 54, 8]]) { rr(c, x, y, w, h, h / 2); c.fill(); }
        });
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) plum(c, 121 * sx, 121 * sy);
      },
      2(c) {   // 山：粗外框、三邊中點菱形、題帶兩側速度線
        inFrame(c, () => mountain(c));
        c.save(); c.strokeStyle = c.fillStyle; c.lineCap = 'round';
        c.lineWidth = 7; c.stroke(RETRO.outer);
        c.fill(RETRO.diamonds);
        c.lineWidth = 2.6; c.stroke(RETRO.speed);
        c.restore();
      },
      3(c) {   // 大象：細內框、注音題帶（字是鏤空）、象鼻噴出的水滴、底部菱形鍊
        inFrame(c, () => { elephant(c); spray(c); });
        c.save(); c.strokeStyle = c.fillStyle;
        c.lineWidth = 2; c.stroke(RETRO.inner);
        c.fill(RETRO.chain);
        c.fill(RETRO.banner);
        c.globalCompositeOperation = 'destination-out';
        c.lineWidth = 2.1; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(RETRO.zhuyin);
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
