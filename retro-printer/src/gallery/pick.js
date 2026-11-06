// 圖庫的隨機挑選（不碰畫面，可用 node 測試）：配色、加權抽樣。
import { labOf, deltaE } from '../engine/color.js';

// 從色票挑 n 支墨：彼此要分得開，最深的一支要夠深（細節印最後一層），由淺到深排列
export function pickInks(palette, n, rnd, { minDelta = 30, darkL = 58, tries = 200 } = {}) {
  const labs = palette.map(p => labOf(p.rgb));
  for (let t = 0; t < tries; t++) {
    const idx = [];
    while (idx.length < n) {
      const i = Math.floor(rnd() * palette.length);
      if (!idx.includes(i)) idx.push(i);
    }
    let ok = true;
    for (let a = 0; a < n && ok; a++) for (let b = a + 1; b < n; b++) {
      if (deltaE(labs[idx[a]], labs[idx[b]]) < minDelta) { ok = false; break; }
    }
    if (!ok) continue;
    if (Math.min(...idx.map(i => labs[i][0])) > darkL) continue;
    return idx.sort((a, b) => labs[b][0] - labs[a][0]).map(i => palette[i]);
  }
  // 極少數情況挑不到：退回最淺 + 最深
  const byL = palette.map((p, i) => [labs[i][0], p]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  return [byL[0], byL[byL.length - 1]].slice(0, n);
}

// 依權重抽一個
export function weighted(list, weightOf, rnd) {
  const total = list.reduce((s, x) => s + weightOf(x), 0);
  let r = rnd() * total;
  for (const x of list) if ((r -= weightOf(x)) < 0) return x;
  return list[list.length - 1];
}

// 主題權重：★ 主題出現的機率較高
export const STAR_WEIGHT = 2.2;
export const themeWeight = gen => (gen.star ? STAR_WEIGHT : 1);
