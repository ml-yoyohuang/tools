/*!
 * 打蘑菇模擬器 - 設定表（平衡、蘑菇、地區、設備、菇王）
 *
 * 所有內容以穩定 ID 管理，圖片路徑集中在這裡，換圖不需要改任何邏輯。
 *
 * 重要定義（企劃歧義的統一結論）：
 *  - 速度倍率 speedMult：冷卻 = 基礎冷卻 ÷ 速度倍率。「攻速 +10%」= speedMult ×1.1。
 *  - 岩殼 armorThreshold：單次傷害低於門檻時，該次傷害強制變成 1。
 *  - 真實傷害 trueDamage：穿透岩殼，但「不」穿透菇王的豆腐盾。
 *  - 軟化 soften：對手動點擊的獨立乘區（softenClickMult），不是「倍率 +100%」。
 *  - 掉錢預算：每個目標的傷害掉錢上限 = 最大血量，回血不會補回預算（避免無限刷錢）。
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.MushConfig = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var SAVE_VERSION = 2;

    var BALANCE = {
        clickBaseDamage: 1,

        /** 連擊：每次點擊 +1 層，3 秒未點擊歸零 */
        combo: {
            windowSeconds: 3,
            maxStacks: 10,          // 約每秒 3 下、維持 3.3 秒即可滿層
            bonusPerStack: 0.03,    // 基礎上限 ×1.3
            upgradedBonusPerStack: 0.10  // 買了共振敲擊後上限 ×2.0
        },

        /** 軟化：肉槌造成，對點擊的獨立乘區 */
        soften: { seconds: 6, clickMult: 2 },

        /** 電磁爐力場：以歷史菇幣計算，有界成長 */
        induction: { k: 0.25, cap: 3 },

        /** 設備價格成長（每台） */
        deviceGrowth: 1.12,

        /**
         * 採集深度（企劃未定義，為解決「單一目標」造成的吞吐上限而加入）。
         * 每擊敗一定數量的蘑菇，該地區的深度 +1，血量與獎勵同步提升，
         * 使收入與 DPS 成正比，而不是被「一秒一隻」鎖死。
         * 菇王血量固定，不受深度影響。
         */
        depth: { killsPerStep: 8, hpScale: 1.16, rewardScale: 1.16, maxSteps: 25 },

        /** 離線結算 */
        offline: {
            efficiency: 0.6,
            baseHours: 4,
            extendedHours: 12,     // 買了複合利息
            graceSeconds: 60,
            spawnCapPerSecond: 6   // 離線每秒最多處理幾隻，避免高 DPS 無限刷
        },

        /** 時間快轉哨子 */
        whistle: { hours: 2, dailyLimit: 3, timeZone: 'Asia/Taipei' },

        /** 外送員事件 */
        courier: { minSeconds: 900, maxSeconds: 1500, lifetimeSeconds: 12 },

        /** 傷害數字合併視窗（毫秒） */
        damageMergeMs: 400,

        autoSaveSeconds: 20,
        tab: { heartbeatMs: 2000, staleMs: 6000 },

        /** 蒜泥機冷卻重置的連鎖上限 */
        garlicResetChainLimit: 2
    };

    /* ---------------- 蘑菇 ---------------- */

    var MUSHROOMS = [
        {
            id: 'sh_basic', name: '胖胖白菇',
            dex: '最無害的食材，口感像保麗龍。',
            color: '#efe7da', accent: '#b9a88e', shape: 'round',
            hp: 10, bounty: 3, weight: 100, traits: []
        },
        {
            id: 'sh_walnut', name: '核桃堅果菇',
            dex: '需要一把好胡桃鉗，或者一台壓路機。',
            color: '#8a5a33', accent: '#4e3017', shape: 'nut',
            hp: 26, bounty: 9, weight: 46,
            traits: ['armor'], armorThreshold: 6
        },
        {
            id: 'sh_enoki', name: '金針瘦瘦菇',
            dex: '總是抱團取暖，因為它們真的很細。',
            color: '#f2e2a8', accent: '#bda75c', shape: 'slim',
            hp: 4, bounty: 1.4, weight: 34,
            traits: ['cluster'], clusterMin: 3, clusterMax: 5
        },
        {
            id: 'sh_sponge', name: '吸湯海綿菇',
            dex: '它不是在喝湯，是在搶劫。',
            color: '#f0dc9a', accent: '#a8914a', shape: 'sponge',
            hp: 60, bounty: 22, weight: 26,
            traits: ['regen'], regenIdleSeconds: 3, regenPerSecond: 0.15,
            zones: ['zone_02', 'zone_03']
        },
        {
            id: 'sh_ice', name: '冰晶雪花菇',
            dex: '自帶冷氣房效果，但不環保。',
            color: '#bfe4f5', accent: '#5e9fc4', shape: 'ice',
            hp: 15, bounty: 10, weight: 30,
            traits: ['slow'], slowMult: 0.5,
            zones: ['zone_03']
        },
        {
            id: 'sh_chest', name: '寶箱松露',
            dex: '泥土裡的黑鑽石，而且它長腳了。',
            color: '#3a3038', accent: '#d9b64a', shape: 'chest',
            hp: 220, bounty: 260, weight: 4,
            traits: ['flee'], fleeSeconds: 14, brothChance: 0.5
        },
        {
            id: 'sh_gold', name: '純金大香菇',
            dex: '不能吃，但可以買下整個農場。',
            color: '#e8c34a', accent: '#8d6a12', shape: 'gold',
            hp: 1, bounty: 120, weight: 1.2,
            traits: ['jackpot'], brothDrop: 1
        }
    ];

    /* ---------------- 地區 ---------------- */

    var ZONES = [
        {
            id: 'zone_01', name: '新手木砧板',
            desc: '旅程開始的地方，還有點菜渣。',
            bg: '#caa571', bgAlt: '#b8905c',
            hpMult: 1, coinMult: 1,
            armorThreshold: 5,
            coinPerDamage: 0.3,
            pool: ['sh_basic', 'sh_walnut', 'sh_enoki', 'sh_chest', 'sh_gold'],
            bossId: 'boss_king'
        },
        {
            id: 'zone_02', name: '沸騰大鐵鍋',
            desc: '溫度很高，請勿把手伸進螢幕。',
            bg: '#c4582c', bgAlt: '#9c3f1c',
            hpMult: 50, coinMult: 45,
            armorThreshold: 22,
            coinPerDamage: 0.26,
            pool: ['sh_basic', 'sh_walnut', 'sh_enoki', 'sh_sponge', 'sh_chest', 'sh_gold'],
            bossId: 'boss_tofu'
        },
        {
            id: 'zone_03', name: '阿嬤的冰箱',
            desc: '有一種餓，是冰箱覺得你餓。',
            bg: '#9fc4d8', bgAlt: '#7aa3bb',
            hpMult: 1200, coinMult: 1100,
            armorThreshold: 450,
            coinPerDamage: 0.22,
            pool: ['sh_basic', 'sh_walnut', 'sh_enoki', 'sh_sponge', 'sh_ice', 'sh_chest', 'sh_gold'],
            bossId: 'boss_frozen'
        }
    ];

    /* ---------------- 菇王 ---------------- */

    var BOSSES = [
        {
            id: 'boss_king', zoneId: 'zone_01',
            name: '巨無霸杏鮑菇',
            intro: '它不只是一朵菇，它是一根柱子。',
            mechanic: 'clickMilestone',
            hp: 2600,
            bounty: 900, brothDrop: 3,
            clickMilestone: 20,          // 每 20 次真人點擊
            milestoneCoinMult: 24,       // 噴出 24 倍單次點擊傷害價值的菇幣
            color: '#d8c49a', accent: '#8a7446',
            reward: '解鎖第二地區', collection: '斷掉的木製菜刀',
            help: '沒有失敗威脅，純考驗火力。每 20 次手動點擊會噴出大量資源。'
        },
        {
            id: 'boss_tofu', zoneId: 'zone_02',
            name: '絕對防禦百葉豆腐菇',
            intro: '披著豆腐皮的惡魔。',
            mechanic: 'holdShield',
            hp: 40000,
            bounty: 14000, brothDrop: 5,
            shields: 3, holdSeconds: 2,
            color: '#f4f0e2', accent: '#b9b094',
            reward: '解鎖第三地區與道具商店', collection: '不鏽鋼漏勺',
            help: '護盾期間免疫所有自動攻擊與真實傷害。長按蘑菇 2 秒破壞一層，三層破完才能輸出。'
        },
        {
            id: 'boss_frozen', zoneId: 'zone_03',
            name: '過期三週的急凍菇',
            intro: '連阿嬤都忘了它的存在。',
            mechanic: 'freezeDevices',
            hp: 600000,
            bounty: 320000, brothDrop: 8,
            freezeEverySeconds: 18, freezeRatio: 0.5,
            color: '#aedcf0', accent: '#4e86a6',
            reward: '解鎖裝備系統與軌道微波砲', collection: '保鮮盒的蓋子',
            help: '每隔一段時間凍結一半設備，點擊結冰的設備即可解凍。解凍不會算成攻擊蘑菇。'
        }
    ];

    /* ---------------- 設備 ---------------- */

    var DEVICES = [
        {
            id: 'auto_tongs', name: '彈簧烤肉夾',
            flavor: '喀喀兩聲，是對食材最基本的尊重。',
            role: 'attack', targeting: 'single',
            baseCost: 60, damage: 1, cooldown: 1.0,
            unlock: { type: 'none' },
            unlockText: '一開始就能買',
            color: '#c9ced6', accent: '#6d7682'
        },
        {
            id: 'pepper_drone', name: '胡椒罐無人機',
            flavor: '哈啾！等等，這不是無人機的聲音。',
            role: 'attack', targeting: 'all',
            baseCost: 900, damage: 3, cooldown: 1.0,
            unlock: { type: 'device', deviceId: 'auto_tongs', count: 10 },
            unlockText: '擁有 10 把彈簧烤肉夾',
            color: '#9a8878', accent: '#5a4c40'
        },
        {
            id: 'garlic_mech', name: '重力蒜泥機',
            flavor: '它只懂一件事：壓扁。非常徹底地壓扁。',
            role: 'attack', targeting: 'single',
            baseCost: 10000, damage: 320, cooldown: 10,
            unlock: { type: 'damage', amount: 10000 },
            unlockText: '累積有效傷害達 1 萬',
            color: '#8d93a0', accent: '#3f4654'
        },
        {
            id: 'tenderizer_array', name: '肉槌打擊陣列',
            flavor: '用科學的頻率，敲出最軟嫩的口感。',
            role: 'attack', targeting: 'single',
            baseCost: 60000, damage: 400, cooldown: 4,
            applies: 'soften',
            unlock: { type: 'zone', zoneIndex: 1 },
            unlockText: '解鎖第二地區',
            color: '#b8864f', accent: '#6b4a24'
        },
        {
            id: 'spicy_sprinkler', name: '辣油灑水器',
            flavor: '危險！請勿對著眼睛或理智噴灑。',
            role: 'support', targeting: 'none',
            baseCost: 600000, damage: 0, cooldown: 8,
            support: { type: 'haste', speedMult: 1.2, seconds: 3 },
            unlock: { type: 'device', deviceId: 'garlic_mech', count: 5 },
            unlockText: '擁有 5 台重力蒜泥機',
            color: '#d4452f', accent: '#7d1f12'
        },
        {
            id: 'cheer_timer', name: '啦啦隊計時器',
            flavor: '嗶嗶嗶！時間到了！快點把它煮熟！',
            role: 'support', targeting: 'none',
            baseCost: 1500000, brothCost: 1, damage: 0, cooldown: 25,
            support: { type: 'doubleKill' },
            unlock: { type: 'broth', amount: 1 },
            unlockText: '擁有至少 1 滴金湯滴',
            color: '#f2d14a', accent: '#8a7312'
        },
        {
            id: 'induction_field', name: '電磁爐力場',
            flavor: '用看不見的磁場，煮熟看得見的麻煩。',
            role: 'aura', targeting: 'none',
            baseCost: 2500000, damage: 0, cooldown: 0,
            unlock: { type: 'lifetimeCoins', amount: 1000000 },
            unlockText: '歷史累積獲得 100 萬菇幣',
            color: '#2d2f3a', accent: '#d03a2a'
        },
        {
            id: 'orbital_micro', name: '軌道微波砲',
            flavor: '叮！您的星球已加熱完畢。',
            role: 'attack', targeting: 'single',
            baseCost: 10000000, damage: 400000, cooldown: 60,
            bossMult: 6,
            unlock: { type: 'boss', bossId: 'boss_frozen' },
            unlockText: '擊敗第三區菇王（原企劃為第四地區，第一版改為此里程碑）',
            color: '#dfe3ea', accent: '#2f3b52'
        }
    ];

    DEVICES.forEach(function (device, index) {
        device.image = 'assets/device-' + String(index + 1).padStart(2, '0') + '.svg';
        device.index = index;
    });
    MUSHROOMS.forEach(function (m, i) {
        m.image = 'assets/mush-' + String(i + 1).padStart(2, '0') + '.svg';
    });
    BOSSES.forEach(function (b, i) {
        b.image = 'assets/boss-' + String(i + 1).padStart(2, '0') + '.svg';
    });

    function byId(list) {
        var map = {};
        list.forEach(function (item) { map[item.id] = item; });
        return map;
    }

    return {
        SAVE_VERSION: SAVE_VERSION,
        BALANCE: BALANCE,
        MUSHROOMS: MUSHROOMS,
        ZONES: ZONES,
        BOSSES: BOSSES,
        DEVICES: DEVICES,
        MUSHROOM_BY_ID: byId(MUSHROOMS),
        ZONE_BY_ID: byId(ZONES),
        BOSS_BY_ID: byId(BOSSES),
        DEVICE_BY_ID: byId(DEVICES),
        COURIER_IMAGE: 'assets/courier.svg'
    };
});
