// 所有圖案產生器。之後每一批新增的圖案都從這裡加進來。
import { CLASSIC } from './generators/classic.js';
import { CHARACTERS_A } from './generators/characters.js';
import { CHARACTERS_B } from './generators/characters2.js';
import { SKY_A } from './generators/sky.js';
import { SKY_B } from './generators/sky2.js';
import { MUSIC_A } from './generators/music.js';
import { MUSIC_B } from './generators/music2.js';

export const THEMES = {
  geometric: '幾何',
  nature: '植物與自然',
  food: '食物與甜點',
  sky: '天空與宇宙',
  characters: '可愛角色',
  music: '音樂與娛樂'
};

export const GENERATORS = [
  ...CLASSIC,
  ...CHARACTERS_A,   // 第 1 批：★ 可愛角色（上）
  ...CHARACTERS_B,   // 第 2 批：★ 可愛角色（下）
  ...SKY_A,          // 第 3 批：★ 天空與宇宙（上）
  ...SKY_B,          // 第 4 批：★ 天空與宇宙（下）
  ...MUSIC_A,        // 第 5 批：★ 音樂與娛樂（上）
  ...MUSIC_B         // 第 6 批：★ 音樂與娛樂（下）
];

export const generatorById = id => GENERATORS.find(g => g.id === id);
