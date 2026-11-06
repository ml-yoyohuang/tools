import { toOD } from '../../engine/ink.js';

// 調墨台：台面中央一攤墨，記錄每格「墨 B 的比例」（N × N）。
// 拖動時，刮刀附近的墨沿拖動方向被推開（半拉格朗日平流），再輕微擴散，
// 兩色慢慢混在一起。均勻度由墨池內比例的離散程度算出。
//   diffuse  每次推動後，刮刀下方的擴散強度
//   radius   刮刀影響半徑（格）
const N = 96;
const POOL = 0.42 * N;          // 墨池半徑（格）
const C0 = (N - 1) / 2;

export function createMixer({ diffuse = 0.6, radius = 16 } = {}) {
  let f = new Float32Array(N * N), tmp = new Float32Array(N * N);
  const inPool = new Uint8Array(N * N), poolEdge = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - C0, y - C0) - POOL;
    inPool[y * N + x] = d < 0 ? 1 : 0;
    poolEdge[y * N + x] = Math.min(1, Math.max(0, 0.5 - d));
  }
  let ratio = 0.5, std0 = 0.5, evenness = 0;

  // 倒墨：A 鋪滿墨池，B 倒在中間，面積比例 = ratio
  function pour(r) {
    ratio = r;
    const R = Math.sqrt(r) * POOL;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - C0, y - C0) - R;
      f[y * N + x] = Math.min(1, Math.max(0, 0.5 - d));
    }
    std0 = Math.max(0.05, std());
    evenness = 0;
  }

  function std() {
    let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < f.length; i++) if (inPool[i]) { s += f[i]; s2 += f[i] * f[i]; n++; }
    const m = s / n;
    return Math.sqrt(Math.max(0, s2 / n - m * m));
  }

  function sample(a, x, y) {
    x = Math.min(N - 1.001, Math.max(0, x)); y = Math.min(N - 1.001, Math.max(0, y));
    const ix = x | 0, iy = y | 0, tx = x - ix, ty = y - iy, k = iy * N + ix;
    return (a[k] * (1 - tx) + a[k + 1] * tx) * (1 - ty) + (a[k + N] * (1 - tx) + a[k + N + 1] * tx) * ty;
  }

  // 刮刀從 (x0, y0) 拖到 (x1, y1)（0..1 的台面座標）
  function stir(x0, y0, x1, y1) {
    const ax = x0 * N, ay = y0 * N, bx = x1 * N, by = y1 * N;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.05) return evenness;
    const steps = Math.ceil(len / 3);              // 每段最多推 3 格
    const vx = (bx - ax) / steps, vy = (by - ay) / steps;
    const R = radius, R2 = R * R;
    for (let s = 1; s <= steps; s++) {
      const cx = ax + vx * s, cy = ay + vy * s;
      const x0i = Math.max(0, Math.floor(cx - R)), x1i = Math.min(N - 1, Math.ceil(cx + R));
      const y0i = Math.max(0, Math.floor(cy - R)), y1i = Math.min(N - 1, Math.ceil(cy + R));
      // 平流：這格的墨是從上游推過來的（墨不會被推出墨池）
      tmp.set(f);
      for (let y = y0i; y <= y1i; y++) for (let x = x0i; x <= x1i; x++) {
        const i = y * N + x, d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 > R2 || !inPool[i]) continue;
        const w = (1 - d2 / R2) ** 2;
        tmp[i] = sample(f, x - vx * w, y - vy * w);
      }
      // 擴散：刮刀下方的墨彼此滲合
      f.set(tmp);
      for (let y = y0i; y <= y1i; y++) for (let x = x0i; x <= x1i; x++) {
        const i = y * N + x, d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 > R2 || !inPool[i]) continue;
        const w = 1 - d2 / R2;
        let sum = 0, n = 0;
        if (x > 0 && inPool[i - 1]) { sum += tmp[i - 1]; n++; }
        if (x < N - 1 && inPool[i + 1]) { sum += tmp[i + 1]; n++; }
        if (y > 0 && inPool[i - N]) { sum += tmp[i - N]; n++; }
        if (y < N - 1 && inPool[i + N]) { sum += tmp[i + N]; n++; }
        if (n) f[i] = tmp[i] + (sum / n - tmp[i]) * diffuse * w;
      }
    }
    // 均勻度：已消除的變異比例（混合指數）
    const k = std() / std0;
    evenness = Math.min(1, Math.max(0, 1 - k * k));
    return evenness;
  }

  // 畫到 N × N 的 ImageData（呼叫端再放大）；墨池外是台面
  function paint(img, a, b, slabRGB) {
    const A = toOD(a), B = toOD(b), d = img.data;
    for (let i = 0; i < f.length; i++) {
      const t = f[i], e = poolEdge[i], j = i * 4;
      const r = 255 * Math.exp(-(A[0] + (B[0] - A[0]) * t));
      const g = 255 * Math.exp(-(A[1] + (B[1] - A[1]) * t));
      const bl = 255 * Math.exp(-(A[2] + (B[2] - A[2]) * t));
      d[j] = slabRGB[0] + (r - slabRGB[0]) * e;
      d[j + 1] = slabRGB[1] + (g - slabRGB[1]) * e;
      d[j + 2] = slabRGB[2] + (bl - slabRGB[2]) * e;
      d[j + 3] = 255;
    }
  }

  return {
    size: N,
    pour, stir, paint,
    get evenness() { return evenness; },
    get ratio() { return ratio; }
  };
}
