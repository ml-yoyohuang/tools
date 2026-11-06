import { S, PW, CELL, GN } from './geometry.js';
import { sampleNear } from './util.js';
import { makeNoise } from './noise.js';

// 下層未乾時，被上層刮板刮過的地方沿刮的方向糊開。
//   src       下層目前的墨量
//   rec       上層的刮印紀錄
//   vertical  上層主要刮印方向
//   w         上層刮印當下，下層的濕度（0..1）
// 回傳新的墨量陣列；幾乎全乾時原樣回傳 src。
export function smearLayer(src, rec, vertical, w, C) {
  if (!src || w < 0.01) return src;
  const out = Float32Array.from(src), passes = rec.grid.passes;
  let [dx, dy] = rec.dirSum;
  const len = Math.hypot(dx, dy);
  if (len < 1) { dx = vertical ? 0 : 1; dy = vertical ? 1 : 0; } else { dx /= len; dy /= len; }
  const reach = C.smear * w * S, px = -dy, py = dx, side = 2 * w * S;
  const nS = vertical ? makeNoise(3, 60) : makeNoise(60, 3);
  const strength = Math.min(1, w * 1.1);
  const gs = 1 / (S * CELL);
  for (let Y = 0; Y < PW; Y++) {
    for (let X = 0; X < PW; X++) {
      const k = ((Y * gs) | 0) * GN + ((X * gs) | 0);
      if (passes[k] === 0) continue;
      const i = Y * PW + X;
      let acc = src[i];
      for (let s = 1; s <= 5; s++) acc += sampleNear(src, X - dx * reach * s / 5, Y - dy * reach * s / 5);
      acc += sampleNear(src, X + px * side, Y + py * side) + sampleNear(src, X - px * side, Y - py * side);
      if (acc === 0) continue;
      const avg = acc / 8;
      out[i] = src[i] + (avg - src[i]) * strength * (0.55 + 0.45 * nS(X, Y));
    }
  }
  return out;
}
