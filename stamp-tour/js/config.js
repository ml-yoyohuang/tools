/* =====================================================================
   CONFIG — 手感與體驗參數都在這裡
   ===================================================================== */
export const CONFIG = {
  ROTATION_ENABLED: true,          // 旋轉總開關
  ANGLE_LIMIT: 30,                 // 角度上限（±度）
  WHEEL_STEP: 1,                   // 滑鼠滾輪每格旋轉角度；按住 Shift 為 1/4

  INK_TAPS: {                      // 沾墨：點印台的次數
    GOOD_MIN: 3,                   // 少於這個 = 太少（飛白、淡）
    GOOD_MAX: 5,                   // 多於這個 = 太多（暈開、糊塊）
    MAX: 9,                        // 最多可累積的次數
    EXCESS_RANGE: 4,               // 超過 GOOD_MAX 幾下達到最糊
  },

  PRESS: {                         // 施力：長按時間（從手指按下起算）
    DECIDE_MS: 150,                // 按住不動超過這個時間，才算「蓋下」；在這之前移動 = 拖動對位
    MOVE_TOLERANCE: 12,            // 判定期間手指晃動多少 px 以內仍算「按住不動」
    RING_MOUSE: 32,                // 壓力圈半徑（滑鼠）
    RING_TOUCH: 62,                // 壓力圈半徑（手指；要比指腹大）
    SHORT_S: 0.35,                 // 短於這個 = 太短（不完整、飛白）
    LONG_S: 1.1,                   // 長於這個 = 太久（暈開）= 壓力圈第一圈
    LONG_RANGE_S: 1.1,             // 超過 LONG_S 多久達到最暈 = 壓力圈第二圈
  },

  SCORE: {                         // 評語判定（單位：卡片單位，印面寬 = 300）
    POS_NORM: 6,
    ANGLE_NORM: 3,
    MASTER: 0.55,                  // 偏差 < 這個 → 職人級對位！（約位置 3px、角度 1.6°）
    CRAFT: 3.2,                    // 偏差 < 這個 → 剛剛好的手作感；其餘 → 大膽的藝術錯位！
    PROXIMITY_RANGE: 7,            // 殘影從灰變亮的範圍
  },

  COVER: 0.35,                     // 墨水遮蓋力：0 = 純相乘（順序無差），1 = 完全蓋住

  TEXTURE: {                       // 基礎質感（Risograph 手感）
    JITTER: 0.22,                  // 邊緣微抖
    SPECKLE: 0.19,                 // 零星飛白
    DENSITY: 0.86,                 // 基礎墨色濃度
    GRAIN: 0.08,                   // 墨色顆粒
  },

  FINE: { DELAY_MS: 350, SPEED: 0.08, GAIN: 0.3 },   // 精細模式
  LOUPE: { SIZE: 128, ZOOM: 2.4 },                    // 放大鏡
  LIFT_MS: 1100,                                      // 拿起揭曉的慢動作時間
  TALK_AUTO_MS: 2200,                                 // 連續台詞自動跳下一句的間隔
  CAMERA: { MARGIN: 14, EASE_MS: 260 },               // 螢幕太矮時，沾墨階段畫面上移
  RESTAMP: { MAX: 1, FAINT_HINT: true },              // 同一站補蓋（離開前）

  GO_HINT: 'arrow',                // 「拿起印章去蓋吧」的提示：'arrow' / 'hop' / 'both' / 'none'
  GO_HINT_MS: 2100,

  INKS: {                          // 三站 / 三層
    1: { name: '日', ink: '#FFE800', line: '#B39600', deep: '#E07A00' },
    2: { name: '海', ink: '#0078BF', line: '#0078BF', deep: '#2A2F9E' },
    3: { name: '鳥', ink: '#FF48B0', line: '#DB3594', deep: '#B5124F' },
  },

  /* 第 0 幕：入口與領卡 */
  OPENING: {
    SPEED: 1,                      // 整體節奏倍率（越大越快）
    SHORT_SPEED: 1.8,              // 直接掃站點、還沒領卡時的「簡短版」節奏
    TAKE_SWIPE: 60,                // 往上滑多少 px 算收下
    TAKE_HOLD_MS: 550,             // 長按多久算收下
    NAME_MAX: 10,                  // 名字最多幾個字
    SIGN_ZOOM_MAX: 4,              // 簽名時卡片最多放大幾倍
    SIGN_AT: 0.36,                 // 放大後簽名欄的中心在畫面高度的哪裡（避開手機鍵盤）
    PEN_MIN: 0.9, PEN_MAX: 2.6,    // 筆跡粗細（卡片單位）：寫得越快越細
  },
  DATE_INK: '#E8453A',             // 日期章的墨色

  DEV_SWITCHER: true,              // 開發測試用的站點切換器（上線前關掉）
  STORAGE_KEY: 'stamp-tour:v1',
};

export const ROT = CONFIG.ROTATION_ENABLED;
