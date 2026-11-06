import { PW } from './geometry.js';

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// 在 PW × PW 的陣列上取樣；超出範圍回傳 0
export function sampleBil(arr, x, y) {
  if (x < 0 || y < 0 || x >= PW - 1 || y >= PW - 1) return 0;
  const ix = x | 0, iy = y | 0, tx = x - ix, ty = y - iy, k = iy * PW + ix;
  const a = arr[k], b = arr[k + 1], c = arr[k + PW], d = arr[k + PW + 1];
  return a + (b - a) * tx + (c - a + (d - c - (b - a)) * tx) * ty;
}

export function sampleNear(arr, x, y) {
  const ix = Math.round(x), iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= PW || iy >= PW) return 0;
  return arr[iy * PW + ix];
}
