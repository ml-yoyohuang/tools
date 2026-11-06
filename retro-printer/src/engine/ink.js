import { PW } from './geometry.js';
import { clamp } from './util.js';
import { makeNoise } from './noise.js';

// 混色以光學密度計算，接近顏料相混（藍 + 黃 → 綠，而不是灰）。
export function toOD(rgb) {
  return rgb.map(v => -Math.log(Math.max(v, 1) / 255));
}
export function fromOD(od) {
  return od.map(d => Math.round(255 * Math.exp(-d)));
}
// t：B 的比例（0..1）
export function mixRGB(a, b, t) {
  const A = toOD(a), B = toOD(b);
  return fromOD(A.map((v, i) => v + (B[i] - v) * t));
}

// 自調墨：a、b 兩支墨，ratio 為 B 的比例，evenness 為攪拌均勻度（0..1）
export function makeMixedInk({ id, name, a, b, ratio, evenness }) {
  return {
    id, name,
    rgb: mixRGB(a.rgb, b.rgb, ratio),
    mix: { a: a.rgb, b: b.rgb, aName: a.name, bName: b.name, ratio, evenness }
  };
}

// 沒攪勻的墨在成品上的色紋：每個像素 B 的比例。
// 色紋沿刮印方向拉長，均勻度越低越明顯；幾乎攪勻時回傳 null。
export function streakMap(mix, vertical) {
  const amp = 1 - mix.evenness;
  if (amp < 0.01) return null;
  const n1 = vertical ? makeNoise(5, 110) : makeNoise(110, 5);
  const n2 = makeNoise(48, 48);
  const out = new Float32Array(PW * PW);
  for (let y = 0; y < PW; y++) for (let x = 0; x < PW; x++) {
    const v = (n1(x, y) - 0.5) * 1.8 + (n2(x, y) - 0.5) * 0.9;
    out[y * PW + x] = clamp(mix.ratio + amp * v, 0, 1);
  }
  return out;
}
