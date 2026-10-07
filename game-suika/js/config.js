/*!
 * 果實合成 - 設定表
 *
 * 這份檔案集中了所有可調參數：等級表、物理、分數、計時。
 * 換圖只需要改 levels[].image；碰撞半徑 radius 與顯示尺寸 imageScale 是分開的，
 * 調整圖片不會動到合併邏輯。
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SuikaConfig = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * 邏輯座標系統。畫面縮放只影響 Canvas 的呈現，不會改變這裡的數值，
     * 物理世界永遠在這個固定尺寸中運作。
     */
    var WORLD = {
        width: 480,
        height: 780,
        wall: 24,           // 牆壁厚度
        floorY: 744,        // 地板內緣 y
        ceilingGap: 0,      // 上方開口（不封頂）
        warningLineY: 176,  // 警戒線
        spawnY: 92          // 待投放水果的高度
    };

    WORLD.innerLeft = WORLD.wall;                   // 左牆內緣 x = 24
    WORLD.innerRight = WORLD.width - WORLD.wall;    // 右牆內緣 x = 456

    /**
     * 11 個合成等級。
     * - radius：碰撞半徑（邏輯單位），合併與物理只看這個值
     * - image：圖片路徑，載入失敗會自動改用色球與等級數字
     * - imageScale：顯示尺寸相對於直徑的倍率（圖片留白時可微調）
     * - imageOffset：顯示位置偏移（邏輯單位），用於圖片重心不在中央的情況
     * - color / accent：降級色球與介面圖鑑用色
     * - shape：圖鑑與降級繪製時的輔助形狀，確保不單靠顏色區分
     */
    var LEVELS = [
        { level: 1,  name: '莓果',   radius: 14,  color: '#e0486b', accent: '#ffd9e2', shape: 'dot' },
        { level: 2,  name: '櫻桃',   radius: 18,  color: '#c6283c', accent: '#ffd2d2', shape: 'pair' },
        { level: 3,  name: '金桔',   radius: 23,  color: '#e08900', accent: '#ffe9bd', shape: 'ring' },
        { level: 4,  name: '青檸',   radius: 29,  color: '#4f9a2a', accent: '#dcf3c4', shape: 'wedge' },
        { level: 5,  name: '柳橙',   radius: 36,  color: '#e2690d', accent: '#ffe0c2', shape: 'segment' },
        { level: 6,  name: '蘋果',   radius: 44,  color: '#b2243a', accent: '#ffd6da', shape: 'leaf' },
        { level: 7,  name: '水梨',   radius: 53,  color: '#9aa832', accent: '#eff5c9', shape: 'pearl' },
        { level: 8,  name: '蜜桃',   radius: 63,  color: '#e4718a', accent: '#ffe2e8', shape: 'cleft' },
        { level: 9,  name: '鳳梨',   radius: 74,  color: '#d6a318', accent: '#fff0c0', shape: 'grid' },
        { level: 10, name: '哈密瓜', radius: 86,  color: '#6fa86a', accent: '#e3f2d8', shape: 'net' },
        { level: 11, name: '大西瓜', radius: 100, color: '#2f7d4f', accent: '#d8f0dd', shape: 'stripe' }
    ];

    LEVELS.forEach(function (item) {
        item.image = 'assets/fruits/fruit-' + String(item.level).padStart(2, '0') + '.svg';
        item.imageScale = 1;
        item.imageOffset = { x: 0, y: 0 };
    });

    var SCORING = {
        // 合併兩顆 level n 所得分數（索引 0 對應 level 1 合成 level 2）
        merge: [1, 3, 6, 10, 15, 21, 28, 36, 45, 55],
        // 兩顆最高級相碰 → 一起消除，不再生成更高級
        topClear: 100
    };

    var SPAWN = {
        // 隨機投放只從前 5 級挑選
        maxLevel: 5,
        // 各等級權重，可自行調整（長度需等於 maxLevel）
        weights: [1, 1, 1, 1, 1]
    };

    var PHYSICS = {
        gravityY: 1.1,
        restitution: 0.08,        // 彈性：太高會跳個不停
        friction: 0.34,
        frictionStatic: 0.55,
        frictionAir: 0.008,
        density: 0.0012,
        slop: 0.02,
        positionIterations: 8,
        velocityIterations: 8,
        constraintIterations: 3,
        // 合併後新水果的初速上限，避免憑空產生巨大動能
        maxMergeSpeed: 7,
        // 合併後沿用兩顆來源速度的比例
        mergeVelocityDamping: 0.45
    };

    var TIMING = {
        stepMs: 1000 / 60,        // 固定物理時間步長
        maxStepsPerFrame: 3,      // 單幀最多補算次數
        maxFrameMs: 100,          // 單幀最多累積的真實時間
        dropCooldownMs: 480,      // 投放冷卻
        entryGraceMs: 800,        // 入場寬限（或碰到東西即結束，以先到者為準）
        dangerDelayMs: 2000,      // 超過警戒線多久判定結束
        mergePopMs: 260           // 合併縮放動畫長度（純視覺）
    };

    return {
        WORLD: WORLD,
        LEVELS: LEVELS,
        SCORING: SCORING,
        SPAWN: SPAWN,
        PHYSICS: PHYSICS,
        TIMING: TIMING,
        MAX_LEVEL: LEVELS.length,
        levelAt: function (level) { return LEVELS[level - 1] || null; }
    };
});
