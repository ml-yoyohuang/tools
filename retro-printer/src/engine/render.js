import { S, PW, CELL, GN } from './geometry.js';
import { clamp, smooth, sampleBil, sampleNear } from './util.js';
import { makeNoise, quantiles } from './noise.js';
import { random } from './random.js';

function makeScratches(C) {
  const out = [];
  if (random() < C.scratchChance) {
    const n = random() < 0.6 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const x0 = 90 + random() * 280, len = 80 + random() * 200;
      out.push({ y: 120 + random() * 360, x0, x1: Math.min(520, x0 + len),
        w: 0.35 + random() * 0.3, depth: 0.35 + random() * 0.3, ph: random() * 6 });
    }
  }
  return out;
}

// 單層成品：依版、刮印紀錄、對位偏移、塞網程度，算出每個像素的墨量（0..1）。
//   absorb  媒材吸墨程度，放大溢墨距離（紙 = 1）
// 回傳 { alpha, vertical }，vertical 為主要刮印方向是否為垂直。
export function renderLayer({ plate: mk, rec, offset, clog = 0, absorb = 1 }, C) {
  const g = rec.grid;
  const oxp = offset[0] * S, oyp = offset[1] * S;
  const vertical = rec.dirAbs[1] >= rec.dirAbs[0];
  // 噪聲的建立順序固定，換上固定種子時結果才可重現
  const nJx = makeNoise(46, 46), nJy = makeNoise(46, 46), nJx2 = makeNoise(5, 5), nJy2 = makeNoise(5, 5);
  const nBleed = makeNoise(9, 9), nMottle = makeNoise(18, 18), nDen = makeNoise(140, 140);
  const f1 = makeNoise(2.3, 2.3), f2 = makeNoise(5.1, 5.1), f3 = makeNoise(13, 13);
  const nFine = (x, y) => 0.42 * f1(x, y) + 0.33 * f2(x, y) + 0.25 * f3(x, y);
  const nStreak = vertical ? makeNoise(2.4, 70) : makeNoise(70, 2.4);
  // 塞網：大片低頻斑塊，加上細節處優先塞住
  const c1 = makeNoise(64, 64), c2 = makeNoise(16, 16);
  const nClog = (x, y) => 0.65 * c1(x, y) + 0.35 * c2(x, y);
  const qClog = quantiles(nClog);
  const clogTh = clog > 0 ? qClog(clog * C.clogMax) : -1;
  const qFine = quantiles(nFine), qStreak = quantiles(nStreak);
  const scr = makeScratches(C);
  const J = C.jitter * S, J2 = 0.5 * S;
  const A = new Float32Array(PW * PW);
  const gs = 1 / (S * CELL);
  const bleedPx = C.bleedPx * absorb;
  const reachLimit = (bleedPx * 1.3 + C.jitter + 1.5) * S;
  const oxi = Math.round(oxp), oyi = Math.round(oyp);

  for (let Y = 0; Y < PW; Y++) {
    const ly = Y / S;
    for (let X = 0; X < PW; X++) {
      const i = Y * PW + X;
      const ux = X - oxi, uy = Y - oyi;
      if (ux < 0 || uy < 0 || ux >= PW || uy >= PW || mk.dist[uy * PW + ux] > reachLimit) continue;

      // 刮印紀錄（雙線性）
      let gx = X * gs - 0.5, gy = Y * gs - 0.5;
      gx = clamp(gx, 0, GN - 1.001); gy = clamp(gy, 0, GN - 1.001);
      const ix = gx | 0, iy = gy | 0, tx = gx - ix, ty = gy - iy, k = iy * GN + ix;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const ink = g.ink[k] * w00 + g.ink[k + 1] * w10 + g.ink[k + GN] * w01 + g.ink[k + GN + 1] * w11;
      if (ink < 0.02) continue;
      const fast = g.fast[k] * w00 + g.fast[k + 1] * w10 + g.fast[k + GN] * w01 + g.fast[k + GN + 1] * w11;
      const excess = g.excess[k] * w00 + g.excess[k + 1] * w10 + g.excess[k + GN] * w01 + g.excess[k + GN + 1] * w11;

      // 邊緣抖動
      const sx = X - oxp + (nJx(X, Y) - 0.5) * 2 * J + (nJx2(X, Y) - 0.5) * 2 * J2;
      const sy = Y - oyp + (nJy(X, Y) - 0.5) * 2 * J + (nJy2(X, Y) - 0.5) * 2 * J2;
      const m = sampleBil(mk.m, sx, sy);

      // 溢墨：沿輪廓等距外滲
      let shape = m;
      const bleed = clamp(excess / C.excessFull, 0, 1);
      if (bleed > 0.01) {
        const d = sampleBil(mk.dist, sx, sy);
        const reach = bleed * bleedPx * S * (0.7 + 0.6 * nBleed(X, Y));
        shape = Math.max(m, smooth(reach + 0.8, reach - 0.8, d));
      }
      if (shape <= 0.002) continue;

      // 缺墨
      const cov = smooth(C.inkMissing, C.inkFull, ink + (nMottle(X, Y) - 0.5) * 0.45);
      if (cov <= 0.002) continue;

      // 飛白：基礎零星白點，刮太快時轉為沿刮印方向的條紋
      const fT = clamp(fast, 0, 1);
      const pv = C.speckle + fT * C.fastVoid;
      let gN, th;
      if (fT > 0.01) {
        gN = nFine(X, Y) * (1 - fT) + nStreak(X, Y) * fT;
        th = qFine(pv) * (1 - fT) + qStreak(pv) * fT;
      } else {
        gN = nFine(X, Y);
        th = qFine(pv);
      }
      const vf = smooth(th - 0.03, th + 0.03, gN);

      let a = shape * cov * vf * (0.9 + 0.1 * nDen(X, Y));

      // 塞網
      if (clogTh > 0) {
        const thin = 1 - sampleNear(mk.b, X - oxp, Y - oyp);
        const score = nClog(X, Y) - C.clogThin * thin * clog;
        a *= smooth(clogTh - 0.015, clogTh + 0.015, score);
      }

      // 刮痕
      for (let s = 0; s < scr.length; s++) {
        const c = scr[s], lx = X / S;
        if (lx <= c.x0 || lx >= c.x1) continue;
        const d = Math.abs(ly - (c.y + Math.sin(lx * 0.013 + c.ph) * 0.8));
        if (d < c.w) a *= 1 - c.depth * (1 - d / c.w) * Math.min(1, (lx - c.x0) / 20, (c.x1 - lx) / 20);
      }
      A[i] = a;
    }
  }
  return { alpha: A, vertical };
}
