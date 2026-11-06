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
