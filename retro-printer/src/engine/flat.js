import { PW } from './geometry.js';

// 平塊疊色：遮罩直接以墨色相乘，不算任何瑕疵。用於試配色與分色預覽。
//   masks  每層 PW × PW 的遮罩（0..1）
//   rgbs   每層墨色
export function flatComposite(masks, rgbs, paper, out = new Uint8ClampedArray(PW * PW * 4)) {
  const cs = rgbs.map(c => c.map(v => v / 255));
  for (let i = 0; i < PW * PW; i++) {
    let r = paper[0], g = paper[1], b = paper[2];
    for (let n = 0; n < masks.length; n++) {
      const a = masks[n][i];
      if (a > 0) { const c = cs[n]; r *= 1 - a + a * c[0]; g *= 1 - a + a * c[1]; b *= 1 - a + a * c[2]; }
    }
    const j = i * 4;
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = 255;
  }
  return out;
}
