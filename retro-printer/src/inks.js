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

export const DEFAULT_INKS = [inkById('pink'), inkById('blue')];
