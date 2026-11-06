import { rgbToLab, labOf, labToRgb, deltaE } from './color.js';
import { seeded } from './random.js';

// 自動分色。
//   prepare(image, n)       分析圖片：分出 n 個色群（由淺到深），接近紙色的部分不印
//   computeMasks(prep, cs)  依各層門檻算出遮罩（image 大小，0..1）
//   suggestInks(prep, palette)  每層建議一支色票裡最接近的墨
// image：{ data: RGBA Uint8ClampedArray, w, h }

const PAPER_L = 88, PAPER_C = 14;     // 亮度高於此、彩度低於此視為紙色
const isPaper = (L, a, b) => L > PAPER_L && Math.hypot(a, b) < PAPER_C;

export function prepare(image, n, { seed = 1, samples = 12000, iterations = 14 } = {}) {
  const { data, w, h } = image, N = w * h;
  const lab = new Float32Array(N * 3), tmp = [0, 0, 0];
  let pL = 0, pa = 0, pb = 0, pn = 0, ink = 0;
  for (let i = 0; i < N; i++) {
    rgbToLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], tmp);
    lab[i * 3] = tmp[0]; lab[i * 3 + 1] = tmp[1]; lab[i * 3 + 2] = tmp[2];
    if (isPaper(tmp[0], tmp[1], tmp[2])) { pL += tmp[0]; pa += tmp[1]; pb += tmp[2]; pn++; } else ink++;
  }
  const paper = pn ? [pL / pn, pa / pn, pb / pn] : labOf([245, 240, 230]);

  // 取樣非紙色的像素
  const pts = [];
  const stride = Math.max(1, Math.floor(ink / samples));
  for (let i = 0, c = 0; i < N; i++) {
    const L = lab[i * 3], a = lab[i * 3 + 1], b = lab[i * 3 + 2];
    if (isPaper(L, a, b)) continue;
    if (c++ % stride === 0) pts.push([L, a, b]);
  }

  const centers = pts.length ? kmeans(pts, Math.max(1, n), seeded(seed), iterations) : [];
  centers.sort((p, q) => q[0] - p[0]);   // 由淺到深：淺色先印
  return { w, h, lab, paper, centers };
}

function kmeans(pts, k, rnd, iterations) {
  // k-means++ 初始化
  const centers = [pts[Math.floor(rnd() * pts.length)].slice()];
  const d2 = new Float64Array(pts.length);
  while (centers.length < k) {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      let m = Infinity;
      for (const c of centers) { const d = deltaE(pts[i], c); if (d < m) m = d; }
      d2[i] = m * m; sum += d2[i];
    }
    if (sum === 0) { centers.push(pts[Math.floor(rnd() * pts.length)].slice()); continue; }
    let r = rnd() * sum, i = 0;
    while (i < pts.length - 1 && (r -= d2[i]) > 0) i++;
    centers.push(pts[i].slice());
  }
  const assign = new Int32Array(pts.length);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < pts.length; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) { const d = deltaE(pts[i], centers[c]); if (d < bd) { bd = d; best = c; } }
      assign[i] = best;
    }
    const sum = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pts.length; i++) {
      const s = sum[assign[i]], p = pts[i];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    sum.forEach((s, c) => {
      if (s[3]) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
      else centers[c] = pts[Math.floor(rnd() * pts.length)].slice();   // 空的色群重新撒種
    });
  }
  return centers;
}

// 門檻 coverage（0..1）：越大這層吃得越多，0.5 為兩色交界
const cutOf = c => 0.85 - 0.7 * c;

export function computeMasks(prep, coverages) {
  const { w, h, lab, paper, centers } = prep, N = w * h, k = centers.length;
  const masks = centers.map(() => new Float32Array(N));
  const d = new Float32Array(k + 1);
  const cuts = centers.map((_, i) => cutOf(coverages[i] ?? 0.5));
  const all = centers.concat([paper]);
  for (let i = 0; i < N; i++) {
    const L = lab[i * 3], A = lab[i * 3 + 1], B = lab[i * 3 + 2];
    for (let c = 0; c <= k; c++) {
      const q = all[c];
      d[c] = Math.sqrt((L - q[0]) ** 2 + (A - q[1]) ** 2 + (B - q[2]) ** 2);
    }
    for (let c = 0; c < k; c++) {
      // 與「最接近的其他顏色（含紙）」比較：0.5 為交界，越接近 1 越屬於這層
      let other = Infinity;
      for (let j = 0; j <= k; j++) if (j !== c && d[j] < other) other = d[j];
      const s = other / (d[c] + other + 1e-6);
      const t = Math.min(1, Math.max(0, (s - cuts[c] + 0.03) / 0.06));
      masks[c][i] = t * t * (3 - 2 * t);
    }
  }
  return masks.map(m => despeckle(m, w, h));
}

/* ───────── 網點 ───────── */

// 每一層的濃度（0..1）：像素先歸到最接近的色群（不含紙），
// 再看它從紙色往這個色群走了多遠。漸層因此得到連續的深淺。
// 以這個色群裡最深的一批像素為 1，平塗的色塊幾乎整片都是 1。
export function computeTones(prep) {
  if (prep.tones) return prep.tones;
  const { w, h, lab, paper, centers } = prep, N = w * h, k = centers.length;
  const tones = centers.map(() => new Float32Array(N));
  const dirs = centers.map(c => [c[0] - paper[0], c[1] - paper[1], c[2] - paper[2]]);
  const len2 = dirs.map(v => v[0] * v[0] + v[1] * v[1] + v[2] * v[2] || 1);
  const owner = new Int8Array(N);
  for (let i = 0; i < N; i++) {
    const L = lab[i * 3], A = lab[i * 3 + 1], B = lab[i * 3 + 2];
    let best = 0, bd = Infinity;
    for (let c = 0; c < k; c++) {
      const q = centers[c], dd = (L - q[0]) ** 2 + (A - q[1]) ** 2 + (B - q[2]) ** 2;
      if (dd < bd) { bd = dd; best = c; }
    }
    owner[i] = best;
    const v = dirs[best];
    tones[best][i] = Math.max(0, ((L - paper[0]) * v[0] + (A - paper[1]) * v[1] + (B - paper[2]) * v[2]) / len2[best]);
  }
  // 以第 98 百分位為滿版
  tones.forEach((t, c) => {
    const vals = [];
    for (let i = 0; i < N; i += 7) if (owner[i] === c && t[i] > 0.05) vals.push(t[i]);
    vals.sort((a, b) => a - b);
    const top = vals.length ? vals[Math.floor(vals.length * 0.98)] : 1;
    for (let i = 0; i < N; i++) {
      const v = t[i] / top;
      t[i] = v < 0.04 ? 0 : v > 1 ? 1 : v;
    }
  });
  prep.tones = tones;
  return tones;
}

// 這一層是不是漸層：有墨的地方，中間調占多少
export function midtoneShare(tone) {
  let ink = 0, mid = 0;
  for (let i = 0; i < tone.length; i += 3) {
    const t = tone[i];
    if (t > 0.04) { ink++; if (t > 0.15 && t < 0.85) mid++; }
  }
  return ink ? mid / ink : 0;
}

// 濃度 → 網點（歐幾里得網點：亮處是小黑點，暗處是小白點，50% 時成棋盤）。
//   angle  網線角度（度），各層錯開以避免疊紋
//   cell   網點間距（圖片像素）
//   density 0..1，0.5 為原濃度，往右整體變深
const spot = (px, py) => (px + py > 1 ? (px - 1) ** 2 + (py - 1) ** 2 - 1 : 1 - (px * px + py * py));

// 網點函式值的分布：查表把「濃度」換成「門檻」，讓網點面積正好等於濃度
const SPOT_LUT = (() => {
  const n = 96, vals = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    vals[j * n + i] = spot(Math.abs(((i + 0.5) / n - 0.5) * 2), Math.abs(((j + 0.5) / n - 0.5) * 2));
  }
  return vals.sort();
})();
const thresholdFor = t => SPOT_LUT[Math.min(SPOT_LUT.length - 1, Math.max(0, Math.round((1 - t) * (SPOT_LUT.length - 1))))];

export function halftone(tone, w, h, { angle = 45, cell = 13, density = 0.5 } = {}) {
  const out = new Float32Array(w * h);
  const a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const gamma = 2 ** ((0.5 - density) * 2.4);
  const soft = 2.4 / cell;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const t = tone[i];
    if (t <= 0) continue;
    const tt = t ** gamma;
    const u = (x * ca + y * sa) / cell, v = (-x * sa + y * ca) / cell;
    const px = Math.abs((u - Math.floor(u) - 0.5) * 2), py = Math.abs((v - Math.floor(v) - 0.5) * 2);
    const s = spot(px, py);
    const th = tt >= 1 ? -2 : thresholdFor(tt);
    const k = Math.min(1, Math.max(0, (s - th + soft) / (2 * soft)));
    out[i] = k * k * (3 - 2 * k);
  }
  return out;
}

export const DOT_CELLS = { coarse: 18, medium: 13, fine: 9 };
export const DOT_ANGLES = [15, 75, 0, 45];

// 依各層設定產生遮罩：實色用門檻，網點用濃度
//   settings：{ cov: [...], modes: ['solid' | 'dots', ...], dot: 'coarse' | 'medium' | 'fine' }
export function computeLayers(prep, { cov, modes = [], dot = 'medium' }) {
  const solid = computeMasks(prep, cov);
  if (!modes.includes('dots')) return solid;
  const tones = computeTones(prep);
  return solid.map((m, c) => (modes[c] === 'dots'
    ? halftone(tones[c], prep.w, prep.h, { angle: DOT_ANGLES[c % DOT_ANGLES.length], cell: DOT_CELLS[dot], density: cov[c] ?? 0.5 })
    : m));
}

// 預設：有明顯漸層的層用網點
export function defaultModes(prep) {
  return computeTones(prep).map(t => (midtoneShare(t) > 0.25 ? 'dots' : 'solid'));
}

// 去掉零星的小雜點：3×3 平均兩次，再收回清楚的邊
function despeckle(m, w, h) {
  let a = m, b = new Float32Array(m.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          s += a[yy * w + xx]; n++;
        }
      }
      b[y * w + x] = s / n;
    }
    const t = a; a = b; b = t === m ? new Float32Array(m.length) : t;
  }
  for (let i = 0; i < a.length; i++) {
    const t = Math.min(1, Math.max(0, (a[i] - 0.35) / 0.3));
    a[i] = t * t * (3 - 2 * t);
  }
  return a;
}

// 每層挑色票裡最接近的墨；盡量不重複
export function suggestInks(prep, palette) {
  const labs = palette.map(p => labOf(p.rgb)), used = new Set();
  return prep.centers.map(c => {
    const order = palette.map((p, i) => [deltaE(c, labs[i]), i]).sort((x, y) => x[0] - y[0]);
    const pick = order.find(([, i]) => !used.has(i)) || order[0];
    used.add(pick[1]);
    return palette[pick[1]];
  });
}

export const centerRGB = prep => prep.centers.map(labToRgb);
