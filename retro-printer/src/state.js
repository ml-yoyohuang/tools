import { createRecord } from './engine/record.js';

// 媒材。目前只有米白紙；absorb 放大溢墨，texture 為織紋強度（尚未使用）。
export const MEDIA = {
  paper: { id: 'paper', name: '米白紙', paper: [245, 240, 230], absorb: 1, texture: 0 }
};

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
