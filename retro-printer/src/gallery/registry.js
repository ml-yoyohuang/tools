// 所有圖案產生器。之後每一批新增的圖案都從這裡加進來。
import { CLASSIC } from './generators/classic.js';

export const THEMES = {
  geometric: '幾何',
  nature: '植物與自然',
  food: '食物與甜點',
  sky: '天空與宇宙',
  characters: '可愛角色',
  music: '音樂與娛樂'
};

export const GENERATORS = [...CLASSIC];

export const generatorById = id => GENERATORS.find(g => g.id === id);
