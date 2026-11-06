import { PW } from './geometry.js';
import { clamp } from './util.js';
import { random } from './random.js';

// 數值噪聲：cx、cy 為格寬（成品像素），回傳 (x, y) => 0..1
export function makeNoise(cx, cy) {
  const gw = Math.ceil(PW / cx) + 2, gh = Math.ceil(PW / cy) + 2;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = random();
  const icx = 1 / cx, icy = 1 / cy;
  return (x, y) => {
    let fx = x * icx, fy = y * icy;
    if (fx < 0) fx = 0; if (fy < 0) fy = 0;
    let ix = fx | 0, iy = fy | 0;
    if (ix > gw - 2) ix = gw - 2; if (iy > gh - 2) iy = gh - 2;
    let tx = fx - ix, ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const k = iy * gw + ix, a = g[k], b = g[k + 1], c = g[k + gw], d = g[k + gw + 1];
    return a + (b - a) * tx + (c - a + (d - c - (b - a)) * tx) * ty;
  };
}

// 取樣噪聲分布，回傳 p => 該噪聲的 p 分位數。用來把「面積比例」換算成門檻。
export function quantiles(fn) {
  const n = 5000, a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = fn(random() * PW, random() * PW);
  a.sort();
  return p => a[clamp((p * n) | 0, 0, n - 1)];
}
