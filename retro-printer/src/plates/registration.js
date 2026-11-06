import { S, PW } from '../engine/geometry.js';
import { buildPlate } from '../engine/mask.js';

// 十字對位標記：系統自動加到每一層的版上
export const CROSSES = [[100, 100], [500, 100], [100, 500], [500, 500]];

export function drawRegistration(ctx) {
  for (const [x, y] of CROSSES) {
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 16, y); ctx.lineTo(x + 16, y);
    ctx.moveTo(x, y - 16); ctx.lineTo(x, y + 16);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
  }
}

// 圖案區：十字標記圍出的範圍內（紙張座標）
export const DESIGN = { x: 120, y: 120, size: 360 };
export const DESIGN_PX = DESIGN.size * S;

let regMask = null;
function registrationMask() {
  if (regMask) return regMask;
  const c = document.createElement('canvas');
  c.width = c.height = PW;
  const x = c.getContext('2d');
  x.setTransform(S, 0, 0, S, 0, 0);
  x.strokeStyle = '#000';
  drawRegistration(x);
  const d = x.getImageData(0, 0, PW, PW).data;
  regMask = new Float32Array(PW * PW);
  for (let i = 0; i < regMask.length; i++) regMask[i] = d[i * 4 + 3] / 255;
  return regMask;
}

// 圖案區大小（DESIGN_PX × DESIGN_PX）的遮罩，放進整張紙的位置
export function designToSheet(mask) {
  const out = new Float32Array(PW * PW), ox = DESIGN.x * S, oy = DESIGN.y * S;
  for (let y = 0; y < DESIGN_PX; y++) out.set(mask.subarray(y * DESIGN_PX, (y + 1) * DESIGN_PX), (oy + y) * PW + ox);
  return out;
}

// 圖案區遮罩放進整張紙，並加上十字
export function sheetMaskWithMarks(mask) {
  const m = designToSheet(mask), reg = registrationMask();
  for (let i = 0; i < m.length; i++) if (reg[i] > m[i]) m[i] = reg[i];
  return m;
}

// 分色結果 → 版
export function plateFromDesignMask(mask) {
  return buildPlate(sheetMaskWithMarks(mask));
}

// 用向量繪圖產生一層的版（紙張座標），自動加上十字
export function plateFromDraw(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = PW;
  const x = c.getContext('2d');
  x.setTransform(S, 0, 0, S, 0, 0);
  x.fillStyle = x.strokeStyle = '#000';
  draw(x);
  drawRegistration(x);
  const d = x.getImageData(0, 0, PW, PW).data;
  const m = new Float32Array(PW * PW);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] / 255;
  return buildPlate(m);
}
