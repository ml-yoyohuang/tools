import { labOf } from './engine/color.js';

// 墨水色票。原創配色，飽和、略帶粉感；入口的墨水牆之後也用這份。
export const PALETTE = [
  { id: 'pink',      name: '螢光粉', rgb: [255, 72, 176] },
  { id: 'peach',     name: '桃紅',   rgb: [214, 64, 128] },
  { id: 'coral',     name: '珊瑚',   rgb: [255, 107, 107] },
  { id: 'apricot',   name: '杏',     rgb: [246, 160, 121] },
  { id: 'vermilion', name: '朱紅',   rgb: [230, 60, 45] },
  { id: 'orange',    name: '橘',     rgb: [255, 128, 30] },
  { id: 'gold',      name: '金黃',   rgb: [255, 182, 30] },
  { id: 'lemon',     name: '檸檬黃', rgb: [255, 232, 0] },
  { id: 'mustard',   name: '芥末',   rgb: [228, 192, 100] },
  { id: 'olive',     name: '橄欖',   rgb: [140, 140, 60] },
  { id: 'grass',     name: '草綠',   rgb: [0, 169, 92] },
  { id: 'teal',      name: '青綠',   rgb: [0, 131, 138] },
  { id: 'deepteal',  name: '深青',   rgb: [36, 72, 84] },
  { id: 'mint',      name: '薄荷',   rgb: [130, 216, 213] },
  { id: 'aqua',      name: '水藍',   rgb: [94, 200, 229] },
  { id: 'ultra',     name: '群青',   rgb: [0, 120, 191] },
  { id: 'blue',      name: '藍',     rgb: [50, 85, 164] },
  { id: 'navy',      name: '海軍藍', rgb: [38, 52, 98] },
  { id: 'lavender',  name: '薰衣草', rgb: [172, 147, 205] },
  { id: 'violet',    name: '紫',     rgb: [118, 91, 167] },
  { id: 'wine',      name: '酒紅',   rgb: [145, 40, 68] },
  { id: 'brick',     name: '磚紅',   rgb: [177, 80, 57] },
  { id: 'brown',     name: '棕',     rgb: [125, 85, 60] },
  { id: 'silver',    name: '淺灰',   rgb: [196, 196, 192] },
  { id: 'grey',      name: '灰',     rgb: [136, 137, 138] },
  { id: 'black',     name: '墨黑',   rgb: [30, 30, 30] }
];

export const inkById = id => PALETTE.find(i => i.id === id);

// 依色相排列（墨水牆用）：有彩度的墨由紅到紫，低彩度的大地色與灰黑排在最後、由淺到深
export function paletteByHue(list = PALETTE) {
  const info = ink => {
    const [r, g, b] = ink.rgb.map(v => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d > 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    if (h > 320) h -= 360;          // 桃紅、酒紅接在紅色前面
    // 以 Lab 彩度判斷：灰、以及偏暗又不太飽和的大地色（棕、深青）
    const [L, a, bb] = labOf(ink.rgb), C = Math.hypot(a, bb);
    return { ink, h, neutral: C < 15 || (L < 45 && C < 26), light: L };
  };
  const all = list.map(info);
  const chroma = all.filter(x => !x.neutral).sort((a, b) => a.h - b.h);
  const neutral = all.filter(x => x.neutral).sort((a, b) => b.light - a.light);
  return [...chroma, ...neutral].map(x => x.ink);
}

export const DEFAULT_INKS = [inkById('pink'), inkById('blue')];

// 入口「開始製作」滑過時的配色：[底色, 字色]，都取自色票，文字對比至少 4.5（WCAG AA）。
// 每次進入口隨機抽一組。
export const START_COLORS = [
  ['lemon', 'navy'], ['gold', 'navy'], ['mint', 'deepteal'], ['deepteal', 'mint'],
  ['navy', 'lemon'], ['aqua', 'navy'], ['black', 'gold'], ['grass', 'black'],
  ['mint', 'wine'], ['orange', 'navy'], ['pink', 'black']
];
