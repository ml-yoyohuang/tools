// 圖庫：每件作品由「圖案 × 版面 × 配色 × 媒材 × 錯位」隨機組合。
// 這裡只決定組合（不碰畫面，可用 node 測試）；畫出來見 render.js。
import { GENERATORS } from './registry.js';
import { pickInks, weighted, themeWeight } from './pick.js';
import { PALETTE } from '../inks.js';
import { MEDIA_LIST } from '../state.js';

const BADGES = ['店長推薦', '今日新作'];

// 一件作品的組合
export function makeItem(rnd, gens = GENERATORS) {
  const gen = weighted(gens, themeWeight, rnd);
  const layout = gen.layouts[Math.floor(rnd() * gen.layouts.length)];
  const n = gen.colors[Math.floor(rnd() * gen.colors.length)];
  const seed = Math.floor(rnd() * 2 ** 31);
  const inks = pickInks(PALETTE, n, rnd);
  const medium = MEDIA_LIST[Math.floor(rnd() * MEDIA_LIST.length)];
  // 輕微錯位：第一層不動，其餘各層 0.5–3px（紙張座標）
  const offsets = inks.map((_, i) => {
    if (i === 0) return [0, 0];
    const a = rnd() * Math.PI * 2, d = 0.5 + rnd() * 2.5;
    return [Math.cos(a) * d, Math.sin(a) * d];
  });
  return { id: `g${seed}`, genId: gen.id, name: gen.name, theme: gen.theme, layout, n, seed, inks, medium, offsets, badge: null };
}

// 一整批：count 件，少數幾件掛上「店長推薦」「今日新作」
export function makeLibrary(count, rnd, gens = GENERATORS) {
  const items = Array.from({ length: count }, () => makeItem(rnd, gens));
  for (const label of BADGES) {
    const pick = items[Math.floor(rnd() * items.length)];
    if (pick && !pick.badge) pick.badge = label;
  }
  return items;
}
