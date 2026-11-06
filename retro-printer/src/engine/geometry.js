// 紙張座標與像素網格。所有 engine 模組共用。
//   W     紙張邊長（邏輯座標）
//   S     成品像素倍率（成品為 PW × PW）
//   CELL  刮印紀錄網格的格寬（邏輯座標）
//   GN    刮印紀錄網格每邊格數
export const W = 600;
export const S = 2;
export const PW = W * S;
export const CELL = 4;
export const GN = W / CELL;
