import { PW } from './geometry.js';
import { seeded } from './random.js';

// 布料織紋：回傳 PW × PW 的高度場（0..1，1 為紗線頂端，0 為紗線之間的縫隙）。
// 同一種媒材每次都一樣，因為布本身不會變；不使用成品計算的亂數來源。
//   spec.type    'weave' 平織 | 'knit' 針織
//   spec.period  紗線間距（成品像素）
//   spec.slub    紗線粗細不均的程度
const cache = new Map();

export function textureField(id, spec) {
  if (!spec) return null;
  if (cache.has(id)) return cache.get(id);
  const field = spec.type === 'knit' ? knit(spec) : weave(spec);
  cache.set(id, field);
  return field;
}

function threadJitter(count, amount, rnd) {
  const a = new Float32Array(count);
  for (let i = 0; i < count; i++) a[i] = 1 + (rnd() - 0.5) * 2 * amount;
  return a;
}

// 平織：經緯線一上一下交錯
function weave({ period: p, slub = 0.2, seed = 1 }) {
  const rnd = seeded(seed);
  const n = Math.ceil(PW / p) + 2;
  const warp = threadJitter(n, slub, rnd), weft = threadJitter(n, slub, rnd);
  const out = new Float32Array(PW * PW);
  for (let y = 0; y < PW; y++) {
    const fy = y / p, j = fy | 0, v = fy - j;
    const weftH = Math.sin(Math.PI * v) ** (1 / weft[j]);
    for (let x = 0; x < PW; x++) {
      const fx = x / p, i = fx | 0, u = fx - i;
      const warpH = Math.sin(Math.PI * u) ** (1 / warp[i]);
      const warpOnTop = (i + j) & 1;
      out[y * PW + x] = warpOnTop
        ? Math.max(warpH, weftH * 0.55)
        : Math.max(weftH, warpH * 0.55);
    }
  }
  return out;
}

// 針織：一列列小 V 形線圈
function knit({ period: p, rowPeriod = p * 1.25, slub = 0.15, seed = 1 }) {
  const rnd = seeded(seed);
  const cols = threadJitter(Math.ceil(PW / p) + 2, slub, rnd);
  const out = new Float32Array(PW * PW);
  for (let y = 0; y < PW; y++) {
    const fy = y / rowPeriod, v = fy - (fy | 0);
    for (let x = 0; x < PW; x++) {
      const fx = x / p, i = fx | 0, u = fx - i;
      // 兩條腿從上方外側往下方中央收攏
      const leg = Math.abs(Math.abs(u - 0.5) - (0.06 + 0.3 * (1 - v)));
      const h = Math.max(0, 1 - leg / (0.2 * cols[i]));
      out[y * PW + x] = h * h * (3 - 2 * h);
    }
  }
  return out;
}
