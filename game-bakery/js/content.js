/*!
 * 內容表：永久升級與成就
 *
 * 升級效果以「型別 + 參數」描述，由 economy.js 統一結算，
 * 內容表本身不含任何計算邏輯，方便調整與新增。
 *
 * 加成結算規則（避免循環引用）：
 *  - 乘法類（buildingMult / buildingTierMult / 設備里程碑）彼此相乘
 *  - 加法類（synergy* / buildingMilestone）先相加成一個 (1 + Σ) 係數再乘上去
 *  - 所有搭配一律讀「設備數量」，不讀其他設備的最終產量
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BakeryContent = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /* ---------------- 永久升級 ---------------- */

    var UPGRADES = [
        /* --- 點擊強化 --- */
        {
            id: 'butterGlove', name: '奶油手套', group: 'click', cost: 200,
            desc: '抹了奶油的手套，戳起餅乾特別滑順。點擊基礎收益 ×2。',
            req: { clicks: 50 }, effect: { type: 'clickMult', mult: 2 }
        },
        {
            id: 'butterGlove2', name: '雙層奶油手套', group: 'click', cost: 5000,
            desc: '兩層奶油，兩倍滑順。點擊基礎收益再 ×2。',
            req: { clicks: 400 }, effect: { type: 'clickMult', mult: 2 }
        },
        {
            id: 'butterGlove3', name: '黃金奶油手套', group: 'click', cost: 500000,
            desc: '據說是用融化的金幣做的。點擊基礎收益再 ×3。',
            req: { clicks: 2000 }, effect: { type: 'clickMult', mult: 3 }
        },
        {
            id: 'layerPress', name: '千層壓模', group: 'click', cost: 3000,
            desc: '把自動產線的熱度壓進每一次點擊。點擊額外獲得「未含限時效果的每秒產量」的 1%。',
            req: { building: { id: 'clicker', count: 10 } },
            effect: { type: 'clickFromCps', pct: 0.01 }
        },
        {
            id: 'layerPress2', name: '千層壓模 II', group: 'click', cost: 150000,
            desc: '壓模加厚了。點擊額外獲得的每秒產量比例提高到 4%（取代前一代的 1%）。',
            req: { building: { id: 'clicker', count: 50 } },
            effect: { type: 'clickFromCps', pct: 0.03 }
        },
        {
            id: 'luckyIcing', name: '幸運糖霜', group: 'click', cost: 20000,
            desc: '糖霜裡混了一點運氣。每次點擊有 5% 機率獲得 7 倍收益。',
            req: { clicks: 800 }, effect: { type: 'lucky', chance: 0.05, mult: 7 }
        },
        {
            id: 'comboWhisk', name: '連擊打蛋器', group: 'click', cost: 60000,
            desc: '連續點擊會累積加成，每次 +4%，最多 +100%；停手後會慢慢退回去。',
            req: { clicks: 1500 }, effect: { type: 'combo' }
        },

        /* --- 設備強化 --- */
        {
            id: 'clickerOil', name: '滑鼠潤滑油', group: 'building', cost: 500,
            desc: '點擊器的關節終於不再嘎吱作響。自動點擊器產量 ×2。',
            req: { building: { id: 'clicker', count: 10 } },
            effect: { type: 'buildingMult', target: 'clicker', mult: 2 }
        },
        {
            id: 'clickerTitanium', name: '鈦合金指節', group: 'building', cost: 6000,
            desc: '再也戳不壞了。自動點擊器產量再 ×2。',
            req: { building: { id: 'clicker', count: 50 } },
            effect: { type: 'buildingMult', target: 'clicker', mult: 2 }
        },
        {
            id: 'grannyRecipe', name: '阿嬤的祕密食譜', group: 'building', cost: 3000,
            desc: '寫在泛黃筆記本上，字跡只有阿嬤看得懂。烘焙阿嬤產量 ×2。',
            req: { building: { id: 'granny', count: 8 } },
            effect: { type: 'buildingMult', target: 'granny', mult: 2 }
        },
        {
            id: 'grannyRecipe2', name: '阿嬤的第二本食譜', group: 'building', cost: 60000,
            desc: '這本更舊，而且有幾頁沾著可疑的焦糖。烘焙阿嬤產量再 ×2。',
            req: { building: { id: 'granny', count: 50 } },
            effect: { type: 'buildingMult', target: 'granny', mult: 2 }
        },
        {
            id: 'ovenNoCool', name: '永不冷卻改裝', group: 'building', cost: 40000,
            desc: '把「關閉」按鈕拆掉之後，效率果然提升了。永熱烤箱產量 ×2。',
            req: { building: { id: 'oven', count: 10 } },
            effect: { type: 'buildingMult', target: 'oven', mult: 2 }
        },
        {
            id: 'ovenFlipper', name: '自動翻面機', group: 'building', cost: 150000,
            desc: '每 10 台永熱烤箱，所有烤箱產量 +6%（可持續累加）。',
            req: { building: { id: 'oven', count: 25 } },
            effect: { type: 'buildingMilestone', target: 'oven', per: 10, bonus: 0.06 }
        },
        {
            id: 'factoryBelt', name: '工業級輸送帶', group: 'building', cost: 320000,
            desc: '輸送帶換成工業規格，再也不會被餅乾卡住。餅乾工廠產量 ×2。',
            req: { building: { id: 'factory', count: 10 } },
            effect: { type: 'buildingMult', target: 'factory', mult: 2 }
        },
        {
            id: 'factoryNightShift', name: '夜班制度', group: 'building', cost: 3200000,
            desc: '工廠開始三班制。餅乾工廠產量再 ×2。',
            req: { building: { id: 'factory', count: 50 } },
            effect: { type: 'buildingMult', target: 'factory', mult: 2 }
        },
        {
            id: 'mineDrill', name: '深層鑽掘', group: 'building', cost: 2500000,
            desc: '往下再挖三公里，糖的純度明顯不同。糖礦產量 ×2。',
            req: { building: { id: 'mine', count: 10 } },
            effect: { type: 'buildingMult', target: 'mine', mult: 2 }
        },
        {
            id: 'quantumWhisk', name: '量子攪拌棒', group: 'building', cost: 20000000,
            desc: '同時攪拌所有可能的結果。異次元烤箱以上的設備產量 ×2。',
            req: { building: { id: 'portal', count: 10 } },
            effect: { type: 'buildingTierMult', minTier: 6, maxTier: 8, mult: 2 }
        },
        {
            id: 'timeLoopFix', name: '時間回溯校正', group: 'building', cost: 180000000,
            desc: '修正了「餅乾比麵粉早出現」造成的帳務問題。時間烘焙機產量 ×2。',
            req: { building: { id: 'timeBaker', count: 10 } },
            effect: { type: 'buildingMult', target: 'timeBaker', mult: 2 }
        },
        {
            id: 'multiverseProtocol', name: '多重宇宙協定', group: 'building', cost: 1500000000,
            desc: '所有宇宙的阿嬤終於同意使用同一種量杯。平行世界阿嬤議會產量 ×2。',
            req: { building: { id: 'council', count: 5 } },
            effect: { type: 'buildingMult', target: 'council', mult: 2 }
        },

        /* --- 搭配 --- */
        {
            id: 'grannyUnion', name: '阿嬤烘焙聯盟', group: 'synergy', cost: 30000,
            desc: '阿嬤們接管了烤箱的火候。每 1 位烘焙阿嬤，永熱烤箱產量 +1%。',
            req: { building: { id: 'granny', count: 15 } },
            effect: { type: 'synergyCount', target: 'oven', source: 'granny', per: 1, bonus: 0.01 }
        },
        {
            id: 'heatRecycle', name: '餘熱回收管', group: 'synergy', cost: 100000,
            desc: '烤箱的廢熱不浪費，拿去加熱前面的產線。每 10 台永熱烤箱，自動點擊器與烘焙阿嬤產量 +25%。',
            req: { building: { id: 'oven', count: 20 } },
            effect: { type: 'synergyTiers', minTier: 1, maxTier: 2, source: 'oven', per: 10, bonus: 0.25 }
        },
        {
            id: 'icingConveyor', name: '糖霜輸送帶', group: 'synergy', cost: 400000,
            desc: '工廠順手把糖霜送到你手上。每 1 座餅乾工廠，點擊收益 +2%。',
            req: { building: { id: 'factory', count: 15 } },
            effect: { type: 'clickFromBuilding', source: 'factory', per: 1, bonus: 0.02 }
        },
        {
            id: 'sugarPipeline', name: '糖礦直供', group: 'synergy', cost: 4000000,
            desc: '原料直送產線，中間商全部消失。每 10 座糖礦，餅乾工廠產量 +15%。',
            req: { building: { id: 'mine', count: 15 } },
            effect: { type: 'synergyCount', target: 'factory', source: 'mine', per: 10, bonus: 0.15 }
        },
        {
            id: 'portalSupply', name: '異次元補給線', group: 'synergy', cost: 30000000,
            desc: '從隔壁宇宙進口糖。每 10 台異次元烤箱，糖礦產量 +20%。',
            req: { building: { id: 'portal', count: 15 } },
            effect: { type: 'synergyCount', target: 'mine', source: 'portal', per: 10, bonus: 0.20 }
        },
        {
            id: 'timeFeedback', name: '時間回饋迴圈', group: 'synergy', cost: 300000000,
            desc: '把未來的產能借一點回來給現在。每 10 台時間烘焙機，第 1～5 階設備產量 +15%。',
            req: { building: { id: 'timeBaker', count: 15 } },
            effect: { type: 'synergyTiers', minTier: 1, maxTier: 5, source: 'timeBaker', per: 10, bonus: 0.15 }
        },

        /* --- 全局 --- */
        {
            id: 'vanilla', name: '濃縮香草精', group: 'global', cost: 9000,
            desc: '一滴就夠，整間工坊都香了。全局產量 +10%。',
            req: { totalBaked: 20000 }, effect: { type: 'globalMult', mult: 1.1 }
        },
        {
            id: 'vanilla2', name: '陳年香草精', group: 'global', cost: 800000,
            desc: '窖藏三年的版本，香氣濃到有點不講道理。全局產量再 +15%。',
            req: { totalBaked: 5000000 }, effect: { type: 'globalMult', mult: 1.15 }
        },
        {
            id: 'vanilla3', name: '傳說香草精', group: 'global', cost: 80000000,
            desc: '據說只存在於某位阿嬤的櫃子深處。全局產量再 +25%。',
            req: { totalBaked: 500000000 }, effect: { type: 'globalMult', mult: 1.25 }
        },
        {
            id: 'certBasic', name: '全套烘焙認證', group: 'global', cost: 2000000,
            desc: '每種設備都達到 25 個，才能掛上這張證書。全局產量 ×1.5。',
            req: { allBuildings: 25 }, effect: { type: 'globalIfAll', count: 25, mult: 1.5 }
        },
        {
            id: 'certCosmic', name: '宇宙級烘焙認證', group: 'global', cost: 300000000,
            desc: '每種設備都達到 50 個。評審來自三個不同的維度。全局產量 ×2。',
            req: { allBuildings: 50 }, effect: { type: 'globalIfAll', count: 50, mult: 2 }
        },
        {
            id: 'luckyFriday', name: '幸運星期五', group: 'global', cost: 200000,
            desc: '黃金餅乾出現得更頻繁，獎勵也更多。出現頻率 +25%，餅乾獎勵 +25%。',
            req: { goldenClicked: 3 }, effect: { type: 'goldenBoost', freq: 0.25, reward: 0.25 }
        },
        {
            id: 'freshBox', name: '道具保鮮盒', group: 'global', cost: 2000000,
            desc: '限時道具放進去就不會「過期得那麼快」。所有限時道具持續時間 +25%。',
            req: { itemsUsed: 5 }, effect: { type: 'buffDuration', bonus: 0.25 }
        }
    ];

    UPGRADES.forEach(function (upgrade) {
        upgrade.image = 'assets/upgrade-' + upgrade.id + '.svg';
    });

    /* ---------------- 成就 ---------------- */

    var ACHIEVEMENTS = [
        { id: 'bake1e3', name: '剛出爐', desc: '累積製作 1,000 塊餅乾。', req: { totalBaked: 1e3 } },
        { id: 'bake1e5', name: '小有名氣', desc: '累積製作 10 萬塊餅乾。', req: { totalBaked: 1e5 }, reward: { itemId: 'frenzy', amount: 1 } },
        { id: 'bake1e7', name: '餅乾企業', desc: '累積製作 1,000 萬塊餅乾。', req: { totalBaked: 1e7 }, reward: { itemId: 'goldenFinger', amount: 1 } },
        { id: 'bake1e9', name: '餅乾帝國', desc: '累積製作 10 億塊餅乾。', req: { totalBaked: 1e9 }, reward: { itemId: 'discount', amount: 1 } },
        { id: 'bake1e11', name: '餅乾文明', desc: '累積製作 1,000 億塊餅乾。', req: { totalBaked: 1e11 }, reward: { itemId: 'timeSugar', amount: 1 } },
        { id: 'bake1e13', name: '銀河級產能', desc: '累積製作 10 兆塊餅乾。', req: { totalBaked: 1e13 }, reward: { itemId: 'frenzy', amount: 2 } },

        { id: 'click100', name: '手指熱身', desc: '累積點擊 100 次。', req: { clicks: 100 } },
        { id: 'click1000', name: '手指發燙', desc: '累積點擊 1,000 次。', req: { clicks: 1000 }, reward: { itemId: 'goldenFinger', amount: 1 } },
        { id: 'click5000', name: '手指傳說', desc: '累積點擊 5,000 次。', req: { clicks: 5000 }, reward: { itemId: 'goldenFinger', amount: 2 } },

        { id: 'clicker10', name: '機械助手', desc: '擁有 10 台自動點擊器。', req: { building: { id: 'clicker', count: 10 } } },
        { id: 'clicker50', name: '戳戳軍團', desc: '擁有 50 台自動點擊器。', req: { building: { id: 'clicker', count: 50 } }, reward: { itemId: 'frenzy', amount: 1 } },
        { id: 'granny10', name: '阿嬤來了', desc: '聘請 10 位烘焙阿嬤。', req: { building: { id: 'granny', count: 10 } } },
        { id: 'granny50', name: '阿嬤太多了', desc: '聘請 50 位烘焙阿嬤。', req: { building: { id: 'granny', count: 50 } }, reward: { itemId: 'discount', amount: 1 } },
        { id: 'oven10', name: '永遠的熱度', desc: '擁有 10 台永熱烤箱。', req: { building: { id: 'oven', count: 10 } } },
        { id: 'oven50', name: '這裡有點熱', desc: '擁有 50 台永熱烤箱。', req: { building: { id: 'oven', count: 50 } }, reward: { itemId: 'frenzy', amount: 1 } },
        { id: 'factory10', name: '產線開張', desc: '擁有 10 座餅乾工廠。', req: { building: { id: 'factory', count: 10 } } },
        { id: 'factory50', name: '工業革命', desc: '擁有 50 座餅乾工廠。', req: { building: { id: 'factory', count: 50 } }, reward: { itemId: 'timeSugar', amount: 1 } },
        { id: 'mine10', name: '甜美的礦脈', desc: '擁有 10 座糖礦。', req: { building: { id: 'mine', count: 10 } } },
        { id: 'portal10', name: '維度突破', desc: '擁有 10 台異次元烤箱。', req: { building: { id: 'portal', count: 10 } }, reward: { itemId: 'discount', amount: 1 } },
        { id: 'timeBaker10', name: '先有餅乾後有麵粉', desc: '擁有 10 台時間烘焙機。', req: { building: { id: 'timeBaker', count: 10 } }, reward: { itemId: 'timeSugar', amount: 1 } },
        { id: 'council1', name: '跨宇宙會議', desc: '召開第 1 屆平行世界阿嬤議會。', req: { building: { id: 'council', count: 1 } }, reward: { itemId: 'frenzy', amount: 1 } },
        { id: 'council10', name: '無限阿嬤', desc: '擁有 10 個平行世界阿嬤議會。', req: { building: { id: 'council', count: 10 } }, reward: { itemId: 'timeSugar', amount: 2 } },
        { id: 'allBuildings1', name: '應有盡有', desc: '八種設備各擁有至少 1 個。', req: { allBuildings: 1 }, reward: { itemId: 'frenzy', amount: 1 } },
        { id: 'allBuildings25', name: '全線量產', desc: '八種設備各擁有至少 25 個。', req: { allBuildings: 25 }, reward: { itemId: 'timeSugar', amount: 1 } },

        { id: 'upgrade5', name: '開始研究', desc: '購買 5 個永久升級。', req: { upgrades: 5 } },
        { id: 'upgrade15', name: '研發部門', desc: '購買 15 個永久升級。', req: { upgrades: 15 }, reward: { itemId: 'discount', amount: 1 } },
        { id: 'upgrade25', name: '科技樹點滿', desc: '購買 25 個永久升級。', req: { upgrades: 25 }, reward: { itemId: 'frenzy', amount: 2 } },

        { id: 'golden1', name: '手快有', desc: '點到第 1 個黃金餅乾。', req: { goldenClicked: 1 } },
        { id: 'golden10', name: '黃金獵人', desc: '點到 10 個黃金餅乾。', req: { goldenClicked: 10 }, reward: { itemId: 'goldenFinger', amount: 1 } },
        { id: 'item10', name: '囤貨成性', desc: '累積使用 10 個道具。', req: { itemsUsed: 10 } },
        { id: 'combo2', name: '雙重加速', desc: '同時啟動兩種不同的限時效果。', req: { buffsActive: 2 }, reward: { itemId: 'timeSugar', amount: 1 } },
        { id: 'combo3', name: '全開', desc: '同時啟動三種不同的限時效果。', req: { buffsActive: 3 }, reward: { itemId: 'frenzy', amount: 1 } }
    ];

    function byId(list) {
        var map = {};
        list.forEach(function (item) { map[item.id] = item; });
        return map;
    }

    return {
        UPGRADES: UPGRADES,
        ACHIEVEMENTS: ACHIEVEMENTS,
        UPGRADE_BY_ID: byId(UPGRADES),
        ACHIEVEMENT_BY_ID: byId(ACHIEVEMENTS)
    };
});
