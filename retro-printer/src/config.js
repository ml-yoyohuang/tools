// 手感參數。數值與 prototype/workbench.html 相同。
export const CONFIG = {
  // 等乾
  dryTime: 15,            // 自然乾燥秒數
  dryerBoost: 5,          // 吹風機倍速

  // 刮板與速度
  bladeLength: 330,       // 刮板長度（紙張座標，網框內寬 460）
  speedWindow: 50,        // 計算刮印速度的時間窗 ms
  speedSlow: 0.12,        // px/ms，低於此視為太慢
  speedFastStart: 0.9,    // px/ms，高於此開始飛白
  speedFastFull: 2.2,     // px/ms，達此為最嚴重飛白

  // 出墨與溢墨
  fastInkMin: 0.6,        // 最快時單次出墨量
  slowExcess: 1.0,        // 太慢一次累積的溢墨量
  repeatExcess: 0.35,     // 超過免費次數後，每多刮一次累積的溢墨量
  freePasses: 2,          // 不會溢墨的刮印次數
  dwellExcessPerSec: 1.2, // 刮板停住時每秒累積的溢墨量
  excessFull: 1.6,        // 溢墨量達此值時溢出最大
  bleedPx: 4.5,           // 溢墨最大外擴距離 px（媒材吸墨程度會再放大）

  // 基礎質感
  jitter: 1.5,            // 邊緣抖動 px
  speckle: 0.05,          // 基礎飛白面積比例
  fastVoid: 0.4,          // 刮太快時額外飛白比例
  scratchChance: 0.55,    // 每層出現刮痕的機率
  inkMissing: 0.15,       // 出墨量低於此完全缺墨
  inkFull: 0.75,          // 出墨量高於此完整

  // 未乾
  smear: 10,              // 未乾時拖曳糊開距離 px（濕度 1 時）
  stain: 0.35,            // 未乾時上層沾染下層顏色的比例
  pickCarry: 0.94,        // 刮板把沾上的下層墨往前帶的程度（每 2px 保留比例，越大拖越遠）
  pickShow: 0.75,         // 網上的墨混入下層顏色的最大比例（只影響刮印時的畫面）

  // 塞網
  clogGrace: 10,          // 倒墨後閒置幾秒開始塞網
  clogTime: 30,           // 塞網從 0 到最嚴重所需秒數
  clogMax: 0.55,          // 最嚴重時印不出來的面積比例
  clogThin: 0.15,         // 細線條比大色塊更容易塞住的程度

  // 調墨台
  mixDiffuse: 0.6,        // 攪拌時刮刀下方的擴散強度，越大越快攪勻
  mixRadius: 16,          // 刮刀影響半徑（調墨台 96 格中的格數）

  // 畫面
  wetFrameAlpha: 0.6,     // 第 2 層起網框的不透明度
  maxOffset: 45           // 網框可拖動的最大偏移 px
};
