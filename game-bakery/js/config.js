/*!
 * 設定表：全域平衡參數、八種生產設備、四種消耗道具
 *
 * 所有內容都以穩定 ID 管理。換圖只要替換 image 指向的檔案，
 * 或改這裡的路徑；遊戲邏輯不會讀取圖片內容。
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BakeryConfig = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var SAVE_VERSION = 2;

    var BALANCE = {
        /** 每次點擊的基礎收益（升級會在這之上疊加） */
        clickBase: 1,

        /** 價格成長：cost(n) = baseCost * growth^n */
        defaultGrowth: 1.15,

        /** 離線收益政策 */
        offline: {
            efficiency: 0.5,     // 離線期間以 50% 效率結算
            maxHours: 8,         // 最多累積 8 小時
            graceSeconds: 60     // 間隔在這之內視為正常遊玩，以 100% 結算
        },

        /** 限時效果上限（秒），重複使用同類道具只延長時間 */
        buffMaxSeconds: {
            cps: 300,
            click: 120,
            discount: 180
        },

        /** 黃金餅乾事件 */
        golden: {
            minSeconds: 150,
            maxSeconds: 360,
            lifetimeSeconds: 14,
            /** 獎勵：依權重抽選 */
            rewards: [
                { kind: 'cookies', weight: 46, seconds: 90, minCookies: 25 },
                { kind: 'item', weight: 18, itemId: 'frenzy' },
                { kind: 'item', weight: 18, itemId: 'goldenFinger' },
                { kind: 'item', weight: 10, itemId: 'discount' },
                { kind: 'item', weight: 8, itemId: 'timeSugar' }
            ]
        },

        /** 連擊打蛋器（升級解鎖後生效） */
        combo: {
            windowSeconds: 1.2,  // 兩次點擊間隔超過這個值就開始衰退
            gainPerClick: 0.04,  // 每次點擊 +4%
            maxBonus: 1.0,       // 上限 +100%
            decayPerSecond: 0.5  // 停手後每秒掉 50% 的累積量
        },

        /** 自動存檔間隔（秒） */
        autoSaveSeconds: 20,

        /** 多分頁心跳（毫秒） */
        tab: { heartbeatMs: 2000, staleMs: 6000 }
    };

    /**
     * 八種生產設備。
     * - baseCost / growth：價格公式
     * - baseCps：單一設備的基礎每秒產量（升級與搭配都疊在這之上）
     * - revealAt：歷史累積製作量達到這個數字才揭曉，之前以神祕剪影呈現
     * - milestones：數量里程碑，達成後對「這個設備」給相乘加成
     */
    var BUILDINGS = [
        {
            id: 'clicker',
            name: '自動點擊器',
            short: '點擊器',
            desc: '一隻裝了彈簧的機械手指，不知疲倦地戳著餅乾。它沒有夢想，只有戳。',
            hint: '也許有什麼東西能代替你的手指……',
            baseCost: 60,
            baseCps: 0.3,
            revealAt: 0,
            milestones: [{ count: 25, mult: 1.1 }, { count: 50, mult: 1.1 }, { count: 100, mult: 1.15 }]
        },
        {
            id: 'granny',
            name: '烘焙阿嬤',
            short: '阿嬤',
            desc: '慈祥、可靠、手上永遠有麵粉。請不要問她年紀，也不要問她食譜。',
            hint: '傳說有一群人，光用手就能烤出完美的餅乾。',
            baseCost: 600,
            baseCps: 3.5,
            revealAt: 350,
            milestones: [{ count: 25, mult: 1.1 }, { count: 50, mult: 1.12 }, { count: 100, mult: 1.15 }]
        },
        {
            id: 'oven',
            name: '永熱烤箱',
            short: '烤箱',
            desc: '一台從未冷卻過的烤箱。說明書第一頁就寫著「請勿嘗試關閉」。',
            hint: '如果熱度永遠不散，是不是就不用等了？',
            baseCost: 3500,
            baseCps: 24,
            revealAt: 2000,
            milestones: [{ count: 25, mult: 1.12 }, { count: 50, mult: 1.15 }, { count: 100, mult: 1.2 }]
        },
        {
            id: 'factory',
            name: '餅乾工廠',
            short: '工廠',
            desc: '輸送帶、巨型攪拌槽、以及三班制的品管部門。產線末端是一座餅乾小山。',
            hint: '手工再快，也快不過一整條產線。',
            baseCost: 32000,
            baseCps: 160,
            revealAt: 18000,
            milestones: [{ count: 25, mult: 1.12 }, { count: 50, mult: 1.15 }, { count: 100, mult: 1.2 }]
        },
        {
            id: 'mine',
            name: '糖礦',
            short: '糖礦',
            desc: '地底深處的結晶糖礦脈。礦工說越往下挖越甜，但也越黏。',
            hint: '原料總得從某個地方來。',
            baseCost: 250000,
            baseCps: 1100,
            revealAt: 150000,
            milestones: [{ count: 25, mult: 1.15 }, { count: 50, mult: 1.18 }, { count: 100, mult: 1.2 }]
        },
        {
            id: 'portal',
            name: '異次元烤箱',
            short: '異次元',
            desc: '它的門通往另一個維度，那裡的物理法則對烘焙特別友善。請勿把手伸進去。',
            hint: '如果這個宇宙的產能不夠，就去借別的宇宙的。',
            baseCost: 2000000,
            baseCps: 8000,
            revealAt: 1200000,
            milestones: [{ count: 25, mult: 1.15 }, { count: 50, mult: 1.2 }, { count: 100, mult: 1.25 }]
        },
        {
            id: 'timeBaker',
            name: '時間烘焙機',
            short: '時間機',
            desc: '它會把烤好的餅乾送回還沒開始烤的時候。會計部門已經放棄理解這台機器。',
            hint: '最快的烘焙，是在開始之前就結束。',
            baseCost: 15000000,
            baseCps: 65000,
            revealAt: 10000000,
            milestones: [{ count: 25, mult: 1.18 }, { count: 50, mult: 1.2 }, { count: 100, mult: 1.25 }]
        },
        {
            id: 'council',
            name: '平行世界阿嬤議會',
            short: '議會',
            desc: '來自無數平行宇宙的阿嬤齊聚一堂，為了同一份食譜爭論不休，順便烤出天文數字的餅乾。',
            hint: '據說在所有宇宙的盡頭，坐著一群阿嬤。',
            baseCost: 100000000,
            baseCps: 500000,
            revealAt: 60000000,
            milestones: [{ count: 10, mult: 1.2 }, { count: 25, mult: 1.25 }, { count: 50, mult: 1.3 }]
        }
    ];

    BUILDINGS.forEach(function (building, index) {
        building.growth = building.growth || BALANCE.defaultGrowth;
        building.tier = index + 1;
        building.image = 'assets/building-' + String(index + 1).padStart(2, '0') + '.svg';
    });

    /**
     * 四種消耗道具。全部由里程碑、成就或黃金餅乾取得，沒有付費購買。
     * - buff 類：同類重複使用只延長時間，不重複乘倍率
     * - instant 類：立即結算，不吃限時加成、不推進任何計時器
     */
    var ITEMS = [
        {
            id: 'frenzy',
            name: '烘焙狂熱券',
            desc: '全廠進入狂熱狀態，60 秒內自動產量 ×5。',
            note: '同類重複使用只會延長時間，倍率不疊乘，最多累積 5 分鐘。',
            effect: { type: 'buff', channel: 'cps', mult: 5, seconds: 60 },
            image: 'assets/item-01.svg'
        },
        {
            id: 'goldenFinger',
            name: '黃金手指券',
            desc: '手指鍍上一層金，20 秒內點擊收益 ×20。',
            note: '同類重複使用只會延長時間，最多累積 2 分鐘。',
            effect: { type: 'buff', channel: 'click', mult: 20, seconds: 20 },
            image: 'assets/item-02.svg'
        },
        {
            id: 'discount',
            name: '限時採購券',
            desc: '30 秒內所有設備價格降低 20%。',
            note: '只影響結帳金額，不會改變設備數量與價格成長進度。最多累積 3 分鐘。',
            effect: { type: 'buff', channel: 'discount', value: 0.2, seconds: 30 },
            image: 'assets/item-03.svg'
        },
        {
            id: 'timeSugar',
            name: '時間砂糖',
            desc: '立即取得相當於 10 分鐘自動產量的餅乾。',
            note: '以未含限時效果的產量計算，不會推進任何計時器，也不會觸發事件。',
            effect: { type: 'instant', minutes: 10 },
            image: 'assets/item-04.svg'
        }
    ];

    function byId(list) {
        var map = {};
        list.forEach(function (item) { map[item.id] = item; });
        return map;
    }

    return {
        SAVE_VERSION: SAVE_VERSION,
        BALANCE: BALANCE,
        BUILDINGS: BUILDINGS,
        ITEMS: ITEMS,
        BUILDING_BY_ID: byId(BUILDINGS),
        ITEM_BY_ID: byId(ITEMS),
        MAIN_COOKIE_IMAGE: 'assets/cookie-main.svg',
        GOLDEN_COOKIE_IMAGE: 'assets/cookie-golden.svg'
    };
});
