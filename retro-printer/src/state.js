import { createRecord } from './engine/record.js';

// 媒材
//   paper    底色
//   absorb   吸墨程度，放大溢墨距離（紙 = 1）
//   density  墨色濃度，布料吃色較淡
//   texture  織紋（engine/texture.js）；ground 為底色明暗、ink 為墨量受織紋影響的程度
export const MEDIA = {
  paper: {
    id: 'paper', name: '紙卡', note: '米白紙卡・邊緣最俐落',
    paper: [245, 240, 230], absorb: 1, density: 1, texture: null
  },
  tote: {
    id: 'tote', name: '帆布袋', note: '棉帆布・織紋明顯、吸墨較多',
    paper: [232, 223, 204], absorb: 1.35, density: 0.94,
    texture: { type: 'weave', period: 7, slub: 0.25, seed: 11, ground: 0.07, ink: 0.24 }
  },
  tee: {
    id: 'tee', name: 'T 恤', note: '棉針織・微微吸墨',
    paper: [246, 245, 241], absorb: 1.25, density: 0.95,
    texture: { type: 'knit', period: 5, rowPeriod: 6, slub: 0.15, seed: 23, ground: 0.05, ink: 0.18 }
  },
  hanky: {
    id: 'hanky', name: '手帕', note: '薄棉布・最容易暈開',
    paper: [244, 242, 236], absorb: 1.6, density: 0.88,
    texture: { type: 'weave', period: 3.6, slub: 0.15, seed: 37, ground: 0.04, ink: 0.14 }
  }
};
export const MEDIA_LIST = [MEDIA.paper, MEDIA.tote, MEDIA.tee, MEDIA.hanky];

// 一份作品：媒材，加上每層的版、墨、對位與刮印結果。
//   plates  每層的版（engine/mask.js 的 buildPlate 結果）
//   inks    每層的墨 { name, rgb }
export function createJob({ plates, inks, medium }) {
  return {
    medium,
    layers: plates.map((plate, i) => createLayer(plate, inks[i], i))
  };
}

function createLayer(plate, ink, index) {
  return {
    index,
    plate,
    ink,
    offset: [0, 0],               // 網框相對理想位置的偏移（紙張座標）
    rec: createRecord(index),     // 刮印紀錄
    wetAt: new Array(index).fill(0), // 這層刮印時，各下層的最大濕度
    idle: 0, clog: 0,             // 倒墨後閒置秒數、塞網程度
    wet: 0,                       // 這層自己的濕度，掀框後為 1，逐漸變乾
    alpha: null,                  // 成品墨量（PW × PW）
    vertical: true,
    cover: null,                  // 每個刮印格的平均墨量
    stains: []                    // 沾到的下層未乾墨（見 engine/composite.js）
  };
}
