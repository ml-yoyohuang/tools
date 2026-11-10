/* 三層原創圖案「日、海、鳥」與對位標記（印面座標，中心為 0，範圍 ±150） */
import { ROT } from './config.js';
import { TAU, rr } from './util.js';

export const SHAPES = {
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
};

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
