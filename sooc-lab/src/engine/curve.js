// Control-point curves → 1D LUT (monotone cubic, Fritsch–Carlson).

export const CURVE_N = 1024;

function bake(points) {
  const out = new Float32Array(CURVE_N);
  if (!points || points.length < 2) {
    for (let i = 0; i < CURVE_N; i++) out[i] = i / (CURVE_N - 1);
    return out;
  }
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let k = 0;
  for (let i = 0; i < CURVE_N; i++) {
    const x = i / (CURVE_N - 1);
    let y;
    if (x <= xs[0]) y = ys[0];
    else if (x >= xs[n - 1]) y = ys[n - 1];
    else {
      while (k < n - 2 && x > xs[k + 1]) k++;
      const h = xs[k + 1] - xs[k], t = (x - xs[k]) / h;
      const t2 = t * t, t3 = t2 * t;
      y = (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * m[k + 1];
    }
    out[i] = Math.min(1, Math.max(0, y));
  }
  return out;
}

function sample(lut, v) {
  const t = Math.min(1, Math.max(0, v)) * (CURVE_N - 1);
  const i = Math.floor(t), j = Math.min(i + 1, CURVE_N - 1);
  return lut[i] + (lut[j] - lut[i]) * (t - i);
}

const cache = new Map();

// curves = { curve, curveR, curveG, curveB } → RGBA Float32Array (master then channel)
export function bakeCurves(curves) {
  const key = JSON.stringify([curves.curve, curves.curveR, curves.curveG, curves.curveB]);
  if (cache.has(key)) return cache.get(key);
  const master = bake(curves.curve);
  const ch = [bake(curves.curveR), bake(curves.curveG), bake(curves.curveB)];
  const out = new Float32Array(CURVE_N * 4);
  for (let i = 0; i < CURVE_N; i++) {
    const v = master[i];
    out[i * 4] = sample(ch[0], v);
    out[i * 4 + 1] = sample(ch[1], v);
    out[i * 4 + 2] = sample(ch[2], v);
    out[i * 4 + 3] = 1;
  }
  if (cache.size > 64) cache.clear();
  cache.set(key, out);
  return out;
}
