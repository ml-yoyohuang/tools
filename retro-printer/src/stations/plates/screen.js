import { S, PW } from '../../engine/geometry.js';
import { FRAME, MESH } from '../workbench/overlay.js';

// 網框的樣子（製版、欣賞版子用）：框邊、網布、感光乳劑；沖洗後圖案處露出網布。
const BAND = '#262523';
const MESH_RGB = 'rgb(216, 214, 207)';
const EMULSION = 'rgb(58, 104, 112)';

const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// 遮罩 → 指定顏色、透明度依遮罩的畫布（PW × PW）
export function maskCanvas(m, rgb = [0, 0, 0], alpha = 1) {
  const c = canvas(PW), x = c.getContext('2d'), img = x.createImageData(PW, PW), d = img.data;
  for (let i = 0; i < m.length; i++) {
    const j = i * 4;
    d[j] = rgb[0]; d[j + 1] = rgb[1]; d[j + 2] = rgb[2]; d[j + 3] = m[i] * 255 * alpha;
  }
  x.putImageData(img, 0, 0);
  return c;
}

// washed：false 為曝光前（乳劑完整），true 為沖洗後（圖案處鏤空）
export function screenCanvas(mask, washed) {
  const c = canvas(FRAME.w * S), x = c.getContext('2d');
  x.setTransform(S, 0, 0, S, -FRAME.x * S, -FRAME.y * S);
  x.fillStyle = BAND;
  x.fillRect(FRAME.x, FRAME.y, FRAME.w, FRAME.h);
  x.fillStyle = MESH_RGB;
  x.fillRect(MESH.x, MESH.y, MESH.w, MESH.h);

  const e = canvas(PW), ex = e.getContext('2d');
  ex.setTransform(S, 0, 0, S, 0, 0);
  ex.fillStyle = EMULSION;
  ex.fillRect(MESH.x, MESH.y, MESH.w, MESH.h);
  if (washed) {
    ex.setTransform(1, 0, 0, 1, 0, 0);
    ex.globalCompositeOperation = 'destination-out';
    ex.drawImage(maskCanvas(mask), 0, 0);
  }
  x.setTransform(1, 0, 0, 1, -FRAME.x * S, -FRAME.y * S);
  x.drawImage(e, 0, 0);
  return c;
}

export const drawScreen = (ctx, screen) => ctx.drawImage(screen, FRAME.x * S, FRAME.y * S);
export { FRAME, MESH };
