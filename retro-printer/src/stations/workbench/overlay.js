import { S, PW, GN } from '../../engine/geometry.js';
import { CROSSES } from '../../plates/registration.js';

// 工作桌的器材位置（紙張座標）
export const FRAME = { x: 50, y: 50, w: 500, h: 500 };
export const MESH = { x: 70, y: 70, w: 460, h: 460 };

const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function maskCanvas(m, rgb) {
  const c = canvas(PW), x = c.getContext('2d'), img = x.createImageData(PW, PW), d = img.data;
  for (let i = 0; i < m.length; i++) {
    const j = i * 4;
    d[j] = rgb[0]; d[j + 1] = rgb[1]; d[j + 2] = rgb[2]; d[j + 3] = m[i] * 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

// 網框：框邊、感光乳劑，版的圖案是鏤空的
export function buildFrame(plate, rgb) {
  const c = canvas(FRAME.w * S), x = c.getContext('2d');
  x.setTransform(S, 0, 0, S, -FRAME.x * S, -FRAME.y * S);
  x.fillStyle = '#262523';
  x.fillRect(FRAME.x, FRAME.y, FRAME.w, FRAME.h);
  x.clearRect(MESH.x, MESH.y, MESH.w, MESH.h);
  x.fillStyle = 'rgba(30, 32, 36, 0.2)';
  x.fillRect(MESH.x, MESH.y, MESH.w, MESH.h);
  x.setTransform(1, 0, 0, 1, -FRAME.x * S, -FRAME.y * S);
  x.globalCompositeOperation = 'destination-out';
  x.drawImage(maskCanvas(plate.m, [0, 0, 0]), 0, 0);
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 0.34;
  x.drawImage(maskCanvas(plate.m, rgb), 0, 0);
  return c;
}

// 對位用：網框上清楚不透明的十字
export function buildMarks(rgb) {
  const c = canvas(FRAME.w * S), x = c.getContext('2d');
  x.setTransform(S, 0, 0, S, -FRAME.x * S, -FRAME.y * S);
  x.strokeStyle = `rgb(${rgb.join(',')})`;
  for (const [cx, cy] of CROSSES) {
    x.lineWidth = 0.8;
    x.beginPath();
    x.moveTo(cx - 22, cy); x.lineTo(cx + 22, cy);
    x.moveTo(cx, cy - 22); x.lineTo(cx, cy + 22);
    x.stroke();
    x.beginPath(); x.arc(cx, cy, 7, 0, Math.PI * 2); x.stroke();
  }
  return c;
}

// 刮印時網上的墨：哪裡刮過、沾到多少下層未乾的墨、塞網時變暗
export function createMeshInk() {
  const c = canvas(GN), x = c.getContext('2d'), img = x.createImageData(GN, GN);
  let dirty = true;
  return {
    canvas: c,
    markDirty() { dirty = true; },
    // base：這層墨色（已含塞網變暗），picks：[{ rgb, pick }] 各下層的沾染
    update(grid, base, picks, C) {
      if (!dirty) return;
      const d = img.data;
      for (let k = 0; k < GN * GN; k++) {
        const j = k * 4;
        let r = base[0], g = base[1], b = base[2], pMax = 0;
        for (const s of picks) {
          const p = Math.min(1, s.pick[k]) * C.pickShow;
          if (p > pMax) pMax = p;
          r = r + (s.rgb[0] - r) * p; g = g + (s.rgb[1] - g) * p; b = b + (s.rgb[2] - b) * p;
        }
        d[j] = r; d[j + 1] = g; d[j + 2] = b;
        d[j + 3] = Math.min(1, grid.ink[k]) * (120 + 80 * pMax);
      }
      x.putImageData(img, 0, 0);
      dirty = false;
    }
  };
}
