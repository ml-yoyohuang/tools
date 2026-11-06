import { S, PW, CELL, GN } from './geometry.js';
import { clamp } from './util.js';

// 各層以色彩相乘疊合。
// layers：[{ alpha, rgb, stains: [{ rgb, raw, k, pick }] }]
//   stains 為這一層印下時，沾到的下層未乾墨：
//     raw   下層當時的墨量；k 為沾染比例（stain × 濕度）
//     pick  刮板沿途沾上的程度（刮印網格）
// 回傳 RGBA 的 Uint8ClampedArray（PW × PW）。
export function composite(layers, paper, C) {
  const out = new Uint8ClampedArray(PW * PW * 4);
  const Ls = layers.filter(l => l.alpha).map(l => ({
    a: l.alpha,
    c: l.rgb.map(v => v / 255),
    st: (l.stains || []).map(s => ({ c: s.rgb.map(v => v / 255), raw: s.raw, k: s.k, pick: s.pick }))
  }));
  const gs = 1 / (S * CELL);
  for (let i = 0; i < PW * PW; i++) {
    let r = paper[0], gg = paper[1], b = paper[2];
    for (let n = 0; n < Ls.length; n++) {
      const l = Ls[n], a = l.a[i];
      if (!(a > 0)) continue;
      let cr = l.c[0], cg = l.c[1], cb = l.c[2];
      if (l.st.length) {
        const X = i % PW, Y = (i / PW) | 0;
        const gx = clamp(X * gs - 0.5, 0, GN - 1.001), gy = clamp(Y * gs - 0.5, 0, GN - 1.001);
        const ix = gx | 0, iy = gy | 0, tx = gx - ix, ty = gy - iy, k = iy * GN + ix;
        for (const s of l.st) {
          let v = s.raw ? s.k * s.raw[i] : 0;
          if (s.pick) {
            const pk = s.pick;
            const p = (pk[k] * (1 - tx) + pk[k + 1] * tx) * (1 - ty) + (pk[k + GN] * (1 - tx) + pk[k + GN + 1] * tx) * ty;
            v = Math.max(v, C.stain * Math.min(1, p));
          }
          cr = cr + (s.c[0] - cr) * v; cg = cg + (s.c[1] - cg) * v; cb = cb + (s.c[2] - cb) * v;
        }
      }
      r *= 1 - a + a * cr; gg *= 1 - a + a * cg; b *= 1 - a + a * cb;
    }
    const j = i * 4;
    out[j] = r; out[j + 1] = gg; out[j + 2] = b; out[j + 3] = 255;
  }
  return out;
}
