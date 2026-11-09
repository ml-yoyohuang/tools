import { W, S, PW, GN, CELL } from '../../engine/geometry.js';
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

// 刮印時網上的墨：哪裡刮過、沾到多少下層未乾的墨、塞網時變暗。
// 刮印紀錄只有 GN × GN 格，直接放大會糊；這裡在每個邏輯像素重新取樣，
// 用門檻切出俐落的邊，邊緣內側再壓一道細細的深色。
const MESH_RES = W;              // 網上墨的解析度：每個邏輯像素一點
const INK_EDGE = [0.06, 0.16];   // 墨量在這個區間內由無到有（決定邊緣位置與銳利度）
const RIM = 0.45;                // 邊緣內側壓暗的程度

export function createMeshInk() {
  const c = canvas(MESH_RES), x = c.getContext('2d'), img = x.createImageData(MESH_RES, MESH_RES);
  const n = GN * GN, cr = new Float32Array(n), cg = new Float32Array(n), cb = new Float32Array(n);
  const ca = new Float32Array(n), ci = new Float32Array(n);
  let dirty = true;
  return {
    canvas: c,
    markDirty() { dirty = true; },
    // base：這層墨色（已含塞網變暗），picks：[{ rgb, pick }] 各下層的沾染
    update(grid, base, picks, C) {
      if (!dirty) return;
      // 先算每一格的顏色與不透明度
      for (let k = 0; k < n; k++) {
        let r = base[0], g = base[1], b = base[2], pMax = 0;
        for (const s of picks) {
          const p = Math.min(1, s.pick[k]) * C.pickShow;
          if (p > pMax) pMax = p;
          r = r + (s.rgb[0] - r) * p; g = g + (s.rgb[1] - g) * p; b = b + (s.rgb[2] - b) * p;
        }
        cr[k] = r; cg[k] = g; cb[k] = b; ca[k] = (120 + 80 * pMax) / 255;
        ci[k] = Math.min(1, grid.ink[k]);
      }
      // 再在網面範圍內逐點雙線性取樣
      const d = img.data, k0 = MESH_RES / W / CELL;
      for (let Y = MESH.y; Y < MESH.y + MESH.h; Y++) {
        let gy = (Y + 0.5) * k0 - 0.5;
        gy = gy < 0 ? 0 : gy > GN - 1.001 ? GN - 1.001 : gy;
        const iy = gy | 0, ty = gy - iy;
        for (let X = MESH.x; X < MESH.x + MESH.w; X++) {
          let gx = (X + 0.5) * k0 - 0.5;
          gx = gx < 0 ? 0 : gx > GN - 1.001 ? GN - 1.001 : gx;
          const ix = gx | 0, tx = gx - ix, k = iy * GN + ix;
          const j = (Y * MESH_RES + X) * 4;
          const i00 = ci[k], i10 = ci[k + 1], i01 = ci[k + GN], i11 = ci[k + GN + 1];
          if (i00 < INK_EDGE[0] && i10 < INK_EDGE[0] && i01 < INK_EDGE[0] && i11 < INK_EDGE[0]) { d[j + 3] = 0; continue; }
          const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
          const ink = i00 * w00 + i10 * w10 + i01 * w01 + i11 * w11;
          const cov = smooth(INK_EDGE[0], INK_EDGE[1], ink);
          if (cov <= 0) { d[j + 3] = 0; continue; }
          // 剛過門檻的地方就是邊緣：壓暗一點，淺色墨也看得出刮到哪裡
          const dk = RIM * (1 - smooth(INK_EDGE[1], INK_EDGE[1] + 0.22, ink)), lt = 1 - dk;
          const k1 = k + 1, k2 = k + GN, k3 = k2 + 1;
          d[j] = (cr[k] * w00 + cr[k1] * w10 + cr[k2] * w01 + cr[k3] * w11) * lt + 21 * dk;
          d[j + 1] = (cg[k] * w00 + cg[k1] * w10 + cg[k2] * w01 + cg[k3] * w11) * lt + 21 * dk;
          d[j + 2] = (cb[k] * w00 + cb[k1] * w10 + cb[k2] * w01 + cb[k3] * w11) * lt + 20 * dk;
          d[j + 3] = 255 * (ca[k] * w00 + ca[k1] * w10 + ca[k2] * w01 + ca[k3] * w11) * cov * (0.55 + 0.45 * Math.min(1, ink)) + 60 * dk;
        }
      }
      x.putImageData(img, 0, 0, MESH.x, MESH.y, MESH.w, MESH.h);
      dirty = false;
    }
  };
}
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
