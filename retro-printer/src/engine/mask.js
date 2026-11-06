import { S, PW, CELL, GN } from './geometry.js';

// 版：由遮罩（PW × PW，0..1）建出成品計算需要的資料
//   m     遮罩本身
//   b     模糊後的遮罩（判斷細節、塞網用）
//   dist  圖案外每個像素到邊緣的距離（溢墨用）
export function buildPlate(m) {
  return { m, b: boxBlur(m, 4, 3), dist: distanceField(m) };
}

export function boxBlur(src, r, passes) {
  let a = Float32Array.from(src), t = new Float32Array(src.length);
  const k = 1 / (2 * r + 1);
  for (let p = 0; p < passes; p++) {
    for (let dir = 0; dir < 2; dir++) {
      const step = dir ? PW : 1;
      for (let j = 0; j < PW; j++) {
        const base = dir ? j : j * PW;
        let s = 0;
        for (let i = 0; i <= r; i++) s += a[base + i * step];
        for (let i = 0; i < PW; i++) {
          t[base + i * step] = s * k;
          const add = i + r + 1, rem = i - r;
          if (add < PW) s += a[base + add * step];
          if (rem >= 0) s -= a[base + rem * step];
        }
      }
      const sw = a; a = t; t = sw;
    }
  }
  return a;
}

// 倒角近似的距離場
export function distanceField(m) {
  const n = PW, D = new Float32Array(n * n), INF = 1e6, R2 = Math.SQRT2;
  for (let i = 0; i < D.length; i++) D[i] = m[i] >= 0.5 ? 0 : INF;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x; let v = D[i];
    if (v === 0) continue;
    if (x > 0) v = Math.min(v, D[i - 1] + 1);
    if (y > 0) {
      v = Math.min(v, D[i - n] + 1);
      if (x > 0) v = Math.min(v, D[i - n - 1] + R2);
      if (x < n - 1) v = Math.min(v, D[i - n + 1] + R2);
    }
    D[i] = v;
  }
  for (let y = n - 1; y >= 0; y--) for (let x = n - 1; x >= 0; x--) {
    const i = y * n + x; let v = D[i];
    if (v === 0) continue;
    if (x < n - 1) v = Math.min(v, D[i + 1] + 1);
    if (y < n - 1) {
      v = Math.min(v, D[i + n] + 1);
      if (x < n - 1) v = Math.min(v, D[i + n + 1] + R2);
      if (x > 0) v = Math.min(v, D[i + n - 1] + R2);
    }
    D[i] = v;
  }
  return D;
}

// 每個刮印格裡的平均墨量（未乾沾染用）
export function coarseCover(A) {
  const out = new Float32Array(GN * GN), px = CELL * S, inv = 1 / (px * px);
  for (let Y = 0; Y < PW; Y++) {
    const row = ((Y / px) | 0) * GN;
    for (let X = 0; X < PW; X++) out[row + ((X / px) | 0)] += A[Y * PW + X];
  }
  for (let k = 0; k < out.length; k++) out[k] *= inv;
  return out;
}
