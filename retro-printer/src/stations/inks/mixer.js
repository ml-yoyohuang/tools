import { toOD } from '../../engine/ink.js';

// 調墨台：台面中央一攤墨，記錄每格「墨 B 的比例」。
// 拖動時，刮刀附近的墨沿拖動方向被推開（半拉格朗日平流），再輕微擴散，
// 兩色慢慢混在一起。均勻度由墨池內比例的離散程度算出。
//   diffuse  每次推動後，刮刀下方的擴散強度
//   radius   刮刀影響半徑（以 96 格計，與 config 的 mixRadius 相同）
//
// 同一攤墨用兩份資料記錄、用同樣的方式攪：
//   計算用  96 格，決定均勻度（手感與原本相同）
//   畫面用  192 格、擴散較少，推墨時再做一次往回推的校正（MacCormack），
//           色紋細而俐落，不會越推越糊
// 越攪越勻時，畫面逐漸接近計算用的結果，兩者最後一致。
const N = 96;
const VIEW_N = 192;
const VIEW_DIFFUSE = 0.25;  // 畫面用的擴散強度（相對於 diffuse）；越小色紋越銳利
const STEP = 3;             // 每段最多推幾格（以 96 格計）
const TRACE = 0.22;         // 倒墨時畫面上已經有的一道手指擾動痕跡（彎曲程度）；只影響畫面，不算進均勻度

function makeField(n, diffuse, radius, sharp = false) {
  const U = n / N, POOL = 0.42 * n, C0 = (n - 1) / 2;
  const f = new Float32Array(n * n), tmp = new Float32Array(n * n), back = sharp ? new Float32Array(n * n) : null;
  const inPool = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) inPool[y * n + x] = Math.hypot(x - C0, y - C0) < POOL ? 1 : 0;

  function sampleOf(a, x, y) {
    x = Math.min(n - 1.001, Math.max(0, x)); y = Math.min(n - 1.001, Math.max(0, y));
    const ix = x | 0, iy = y | 0, tx = x - ix, ty = y - iy, k = iy * n + ix;
    return (a[k] * (1 - tx) + a[k + 1] * tx) * (1 - ty) + (a[k + n] * (1 - tx) + a[k + n + 1] * tx) * ty;
  }
  const sample = (x, y) => sampleOf(f, x, y);
  // 取樣點周圍四格的最小、最大值（校正後不能超出這個範圍，才不會出現原本沒有的顏色）
  function bounds(x, y) {
    x = Math.min(n - 1.001, Math.max(0, x)); y = Math.min(n - 1.001, Math.max(0, y));
    const k = (y | 0) * n + (x | 0), a = f[k], b = f[k + 1], c = f[k + n], d = f[k + n + 1];
    return [Math.min(a, b, c, d), Math.max(a, b, c, d)];
  }

  return {
    n, f, inPool, POOL, C0, sample,
    // 倒墨：A 鋪滿墨池，B 倒在中間，面積比例 = r
    pour(r) {
      const R = Math.sqrt(r) * POOL;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        f[y * n + x] = Math.min(1, Math.max(0, 0.5 - (Math.hypot(x - C0, y - C0) - R)));
      }
    },
    // 刮刀從 (x0, y0) 拖到 (x1, y1)（0..1 的台面座標）
    stir(x0, y0, x1, y1) {
      const ax = x0 * n, ay = y0 * n, bx = x1 * n, by = y1 * n;
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 0.05 * U) return;
      const steps = Math.ceil(len / (STEP * U));
      const vx = (bx - ax) / steps, vy = (by - ay) / steps;
      const R = radius * U, R2 = R * R;
      for (let s = 1; s <= steps; s++) {
        const cx = ax + vx * s, cy = ay + vy * s;
        const x0i = Math.max(0, Math.floor(cx - R)), x1i = Math.min(n - 1, Math.ceil(cx + R));
        const y0i = Math.max(0, Math.floor(cy - R)), y1i = Math.min(n - 1, Math.ceil(cy + R));
        // 平流：這格的墨是從上游推過來的（墨不會被推出墨池）
        tmp.set(f);
        for (let y = y0i; y <= y1i; y++) for (let x = x0i; x <= x1i; x++) {
          const i = y * n + x, d2 = (x - cx) ** 2 + (y - cy) ** 2;
          if (d2 > R2 || !inPool[i]) continue;
          const w = (1 - d2 / R2) ** 2;
          tmp[i] = sample(x - vx * w, y - vy * w);
        }
        if (sharp) {
          // 把推過的結果再往回推一次，跟原本比較，補回推墨時糊掉的部分
          back.set(tmp);
          for (let y = y0i; y <= y1i; y++) for (let x = x0i; x <= x1i; x++) {
            const i = y * n + x, d2 = (x - cx) ** 2 + (y - cy) ** 2;
            if (d2 > R2 || !inPool[i]) continue;
            const w = (1 - d2 / R2) ** 2;
            back[i] = sampleOf(tmp, x + vx * w, y + vy * w);
          }
          for (let y = y0i; y <= y1i; y++) for (let x = x0i; x <= x1i; x++) {
            const i = y * n + x, d2 = (x - cx) ** 2 + (y - cy) ** 2;
            if (d2 > R2 || !inPool[i]) continue;
            const w = (1 - d2 / R2) ** 2;
            const [lo, hi] = bounds(x - vx * w, y - vy * w);
            const v = tmp[i] + 0.5 * (f[i] - back[i]);
            tmp[i] = v < lo ? lo : v > hi ? hi : v;
          }
        }
        // 擴散：刮刀下方的墨彼此滲合
        f.set(tmp);
        for (let y = y0i; y <= y1i; y++) for (let x = x0i; x <= x1i; x++) {
          const i = y * n + x, d2 = (x - cx) ** 2 + (y - cy) ** 2;
          if (d2 > R2 || !inPool[i]) continue;
          const w = 1 - d2 / R2;
          let sum = 0, c = 0;
          if (x > 0 && inPool[i - 1]) { sum += tmp[i - 1]; c++; }
          if (x < n - 1 && inPool[i + 1]) { sum += tmp[i + 1]; c++; }
          if (y > 0 && inPool[i - n]) { sum += tmp[i - n]; c++; }
          if (y < n - 1 && inPool[i + n]) { sum += tmp[i + n]; c++; }
          if (c) f[i] = tmp[i] + (sum / c - tmp[i]) * diffuse * w;
        }
      }
    }
  };
}

export function createMixer({ diffuse = 0.6, radius = 16, viewN = VIEW_N, viewDiffuse = VIEW_DIFFUSE, sharp = true } = {}) {
  const sim = makeField(N, diffuse, radius);
  const view = makeField(viewN, diffuse * viewDiffuse, radius, sharp);
  let ratio = 0.5, std0 = 0.5, mixed = 0, evenness = 0;   // mixed：實際攪拌進度 0..1（畫面向計算結果靠攏用）

  // 一道像手指劃過的 S 形痕跡；每個調墨台固定一條，換比例重倒時痕跡不會跳來跳去
  const traceAngle = Math.random() * Math.PI * 2, traceBend = Math.random() < 0.5 ? 1 : -1;
  function trace() {
    const c = Math.cos(traceAngle), s = Math.sin(traceAngle), px = -s * traceBend, py = c * traceBend;
    const P = [[0.5 + c * 0.3, 0.5 + s * 0.3], [0.5 + c * 0.1 + px * TRACE, 0.5 + s * 0.1 + py * TRACE],
      [0.5 - c * 0.1 - px * TRACE, 0.5 - s * 0.1 - py * TRACE], [0.5 - c * 0.28, 0.5 - s * 0.28]];
    let last = P[0];
    for (let i = 1; i <= 40; i++) {
      const t = i / 40, u = 1 - t;
      const pt = [0, 1].map(k => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]);
      view.stir(last[0], last[1], pt[0], pt[1]);
      last = pt;
    }
  }

  function std() {
    const { f, inPool } = sim;
    let s = 0, s2 = 0, c = 0;
    for (let i = 0; i < f.length; i++) if (inPool[i]) { s += f[i]; s2 += f[i] * f[i]; c++; }
    const m = s / c;
    return Math.sqrt(Math.max(0, s2 / c - m * m));
  }

  function pour(r) {
    ratio = r;
    sim.pour(r);
    view.pour(r);
    if (TRACE > 0) trace();
    std0 = Math.max(0.05, std());
    mixed = 0;
    evenness = 0;
  }

  function stir(x0, y0, x1, y1) {
    sim.stir(x0, y0, x1, y1);
    view.stir(x0, y0, x1, y1);
    // 均勻度：已消除的變異比例（混合指數）
    const k = std() / std0;
    mixed = Math.min(1, Math.max(0, 1 - k * k));
    evenness = mixed;
    return evenness;
  }

  // 畫到 M × M 的 ImageData。墨池邊緣用實際距離算，只留一個像素的反鋸齒。
  let rim = null;   // 每個像素的墨池覆蓋率（只跟 M 有關，算一次就好）
  function rimFor(M) {
    if (rim && rim.M === M) return rim.e;
    const n = view.n, k = n / M, e = new Float32Array(M * M);
    for (let Y = 0; Y < M; Y++) for (let X = 0; X < M; X++) {
      const fx = (X + 0.5) * k - 0.5, fy = (Y + 0.5) * k - 0.5;
      e[Y * M + X] = Math.min(1, Math.max(0, 0.5 - (Math.hypot(fx - view.C0, fy - view.C0) - view.POOL) / k));
    }
    rim = { M, e };
    return e;
  }
  function paint(img, a, b, slabRGB) {
    const A = toOD(a), B = toOD(b), d = img.data, M = img.width, E = rimFor(M);
    const LUT = 256, lut = new Float32Array(LUT * 3);
    for (let i = 0; i < LUT; i++) {
      const t = i / (LUT - 1);
      for (let c = 0; c < 3; c++) lut[i * 3 + c] = 255 * Math.exp(-(A[c] + (B[c] - A[c]) * t));
    }
    // 越攪越勻，畫面越接近計算用的結果
    const blend = mixed * mixed, kv = view.n / M, ks = N / M;
    const [sr, sg, sb] = slabRGB;
    for (let Y = 0; Y < M; Y++) {
      const vy = (Y + 0.5) * kv - 0.5, sy = (Y + 0.5) * ks - 0.5;
      for (let X = 0; X < M; X++) {
        const p = Y * M + X, j = p * 4, e = E[p];
        if (e <= 0) { d[j] = sr; d[j + 1] = sg; d[j + 2] = sb; d[j + 3] = 255; continue; }
        let t = view.sample((X + 0.5) * kv - 0.5, vy);
        if (blend > 0.001) t += (sim.sample((X + 0.5) * ks - 0.5, sy) - t) * blend;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const li = ((t * (LUT - 1) + 0.5) | 0) * 3;
        d[j] = sr + (lut[li] - sr) * e;
        d[j + 1] = sg + (lut[li + 1] - sg) * e;
        d[j + 2] = sb + (lut[li + 2] - sb) * e;
        d[j + 3] = 255;
      }
    }
  }

  return {
    size: N,
    pour, stir, paint,
    get evenness() { return evenness; },
    get ratio() { return ratio; }
  };
}
