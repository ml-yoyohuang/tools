/*!
 * 內容表：25 個永久升級、4 種消耗道具、6 件裝備、20 個成就
 *
 * 升級效果一律以「型別 + 明確倍率」描述，由 combat.js 統一結算。
 * 所有「提升 X%」都已換算成明確倍率（例如「提升 300%」記成 mult: 4）。
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.MushContent = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /* ---------------- 25 個永久升級 ---------------- */

    var UPGRADES = [
        /* --- 手動 --- */
        {
            id: 'u_clk_1', group: 'click', name: '鋒利指甲', flavor: '先別剪指甲。',
            desc: '基礎點擊傷害 +1（絕對值）。',
            cost: 120, req: { clicks: 100 }, reqText: '手動點擊 100 次',
            effect: { type: 'clickFlat', value: 1 }
        },
        {
            id: 'u_clk_2', group: 'click', name: '人體工學滑鼠', flavor: '保護手腕。',
            desc: '每次點擊有 5% 機率造成 300% 傷害（×3 爆擊）。',
            cost: 9000, req: { clicks: 2000 }, reqText: '手動點擊 2,000 次',
            effect: { type: 'clickCrit', chance: 0.05, mult: 3 }
        },
        {
            id: 'u_clk_3', group: 'click', name: '共振敲擊', flavor: '你點的是節奏。',
            desc: '連擊加成上限由 ×1.3 提高到 ×2.0（滿層約需每秒 3 下、維持 3 秒）。',
            cost: 65000, req: { damage: 200000 }, reqText: '累積有效傷害 20 萬',
            effect: { type: 'comboBoost' }
        },
        {
            id: 'u_clk_4', group: 'click', name: '點石成金手', flavor: '摸什麼都賺。',
            desc: '手動點擊造成的傷害，額外有 1% 直接轉成菇幣（衍生點擊不計）。',
            cost: 4000, req: { lifetimeCoins: 10000 }, reqText: '歷史累積 1 萬菇幣',
            effect: { type: 'clickToCoin', pct: 0.01 }
        },
        {
            id: 'u_clk_5', group: 'click', name: '幻影連打', flavor: '超越視覺的手速。',
            desc: '每次手動點擊自動追加一次 50% 傷害的判定。衍生判定不會再觸發自己，也不計入點擊次數。',
            cost: 2600000, req: { clicks: 20000 }, reqText: '手動點擊 20,000 次',
            effect: { type: 'phantom', mult: 0.5 }
        },

        /* --- 自動 --- */
        {
            id: 'u_aut_1', group: 'auto', name: '潤滑齒輪', flavor: '不再卡卡響。',
            desc: '所有自動設備速度倍率 ×1.1（冷卻 ÷ 1.1）。',
            cost: 2400, req: { deviceTotal: 5 }, reqText: '擁有 5 台設備',
            effect: { type: 'deviceSpeed', speedMult: 1.1 }
        },
        {
            id: 'u_aut_2', group: 'auto', name: '鈦合金材質', flavor: '輕量且堅固。',
            desc: '所有設備基礎傷害 ×1.2。',
            cost: 26000, req: { deviceTotal: 20 }, reqText: '擁有 20 台設備',
            effect: { type: 'deviceDamage', mult: 1.2 }
        },
        {
            id: 'u_aut_3', group: 'auto', name: '胡椒改良', flavor: '連打三個噴嚏。',
            desc: '胡椒無人機的攻擊頻率翻倍（冷卻 ÷ 2）。',
            cost: 48000, req: { device: { id: 'pepper_drone', count: 10 } }, reqText: '擁有 10 台胡椒無人機',
            effect: { type: 'deviceSpeedOne', deviceId: 'pepper_drone', speedMult: 2 }
        },
        {
            id: 'u_aut_4', group: 'auto', name: '核動力壓路', flavor: '能源哪來的？',
            desc: '蒜泥機每次重擊有 20% 機率立刻重置冷卻（單次攻擊鏈最多連鎖 2 次）。',
            cost: 180000, req: { device: { id: 'garlic_mech', count: 5 } }, reqText: '擁有 5 台重力蒜泥機',
            effect: { type: 'garlicReset', chance: 0.2 }
        },
        {
            id: 'u_aut_5', group: 'auto', name: '無情機器', flavor: '沒有感情的效率。',
            desc: '當自動設備佔累積基準輸出超過 80% 時，所有設備最終傷害 ×1.5。判定使用「不含本升級加成」的基準輸出。',
            cost: 9000000, req: { allDeviceTypes: true }, reqText: '擁有全部 8 種設備',
            effect: { type: 'ruthless', threshold: 0.8, mult: 1.5 }
        },

        /* --- 協同 --- */
        {
            id: 'u_syn_1', group: 'syn', name: '辛香料風暴', flavor: '辣到連空氣都在咳嗽。',
            desc: '辣油加速期間，胡椒無人機單次傷害 ×2。',
            cost: 560000, req: { devices: ['pepper_drone', 'spicy_sprinkler'] }, reqText: '同時擁有胡椒無人機與辣油灑水器',
            effect: { type: 'synPepperHaste', mult: 2 }
        },
        {
            id: 'u_syn_2', group: 'syn', name: '軟硬兼施', flavor: '先敲鬆，再壓扁。',
            desc: '蒜泥機攻擊帶有軟化狀態的目標時，傷害 ×4。',
            cost: 320000, req: { devices: ['tenderizer_array', 'garlic_mech'] }, reqText: '同時擁有肉槌陣列與重力蒜泥機',
            effect: { type: 'synGarlicSoften', mult: 4 }
        },
        {
            id: 'u_syn_3', group: 'syn', name: '高科技廚房', flavor: '廚房的電費帳單已經放棄治療。',
            desc: '微波砲冷卻未就緒時，電磁爐力場的加成額外 ×1.5（只放大加成部分）。',
            cost: 24000000, req: { devices: ['induction_field', 'orbital_micro'] }, reqText: '同時擁有電磁爐力場與軌道微波砲',
            effect: { type: 'synInductionMicro', mult: 1.5 }
        },
        {
            id: 'u_syn_4', group: 'syn', name: '啦啦隊長', flavor: '加油！不是對你說的。',
            desc: '計時器倒數歸零時，所有「可攻擊」設備立刻免費攻擊一次（支援與光環設備不會被觸發，也不會遞迴）。',
            cost: 1800000, req: { device: { id: 'cheer_timer', count: 1 } }, reqText: '擁有啦啦隊計時器',
            effect: { type: 'cheerFreeAttack' }
        },
        {
            id: 'u_syn_5', group: 'syn', name: '火力全開', flavor: '全員就位，沒有例外。',
            desc: '每持有一種設備（至少 10 台），提供全域最終傷害 ×1.02 乘區。',
            cost: 14000000, req: { allTypesCount: 10 }, reqText: '八種設備各擁有 10 台',
            effect: { type: 'allOutTypes', perType: 0.02, requireCount: 10 }
        },

        /* --- 經濟 --- */
        {
            id: 'u_eco_1', group: 'eco', name: '大號錢包', flavor: '裝得下更多希望。',
            desc: '擊敗普通蘑菇的保底掉落額外 +2 菇幣（會乘上地區倍率）。',
            cost: 900, req: { lifetimeCoins: 1000 }, reqText: '歷史累積 1,000 菇幣',
            effect: { type: 'killBounty', value: 2 }
        },
        {
            id: 'u_eco_2', group: 'eco', name: '黃金孢子', flavor: '閃閃發光。',
            desc: '擊敗普通蘑菇有 0.5% 機率掉落 1 滴金湯滴。',
            cost: 30000, req: { boss: 'boss_king' }, reqText: '擊敗第一隻菇王',
            effect: { type: 'brothChance', chance: 0.005 }
        },
        {
            id: 'u_eco_3', group: 'eco', name: '複合利息', flavor: '公會幫你投資了。',
            desc: '離線收益計算上限由 4 小時延長至 12 小時。',
            cost: 150000, req: { lifetimeCoins: 50000 }, reqText: '歷史累積 5 萬菇幣',
            effect: { type: 'offlineExtend' }
        },
        {
            id: 'u_eco_4', group: 'eco', name: '寶箱雷達', flavor: '它在嗶嗶作響！',
            desc: '寶箱松露的出現權重 ×2。',
            cost: 220000, req: { seen: 'sh_chest' }, reqText: '遭遇過寶箱松露',
            effect: { type: 'spawnWeight', mushroomId: 'sh_chest', mult: 2 }
        },
        {
            id: 'u_eco_5', group: 'eco', name: '通膨時代', flavor: '錢越來越薄。',
            desc: '每解鎖一個成就，全域菇幣獲取 +1%。',
            cost: 700000, req: { achievements: 10 }, reqText: '取得 10 個成就',
            effect: { type: 'achievementCoin', perAchievement: 0.01 }
        },

        /* --- 里程碑（擊敗菇王後自動授予，不另外收費） --- */
        {
            id: 'u_mil_1', group: 'milestone', name: '學徒徽章', flavor: '恭喜畢業，接下來更難。',
            desc: '永久解鎖第二地區入口，地區切換沒有冷卻。',
            cost: 0, auto: true, req: { boss: 'boss_king' }, reqText: '擊敗巨無霸杏鮑菇',
            effect: { type: 'unlockZone', zoneId: 'zone_02' }
        },
        {
            id: 'u_mil_2', group: 'milestone', name: '廚師執照', flavor: '可以合法拿鍋鏟了。',
            desc: '解鎖第三地區、消耗道具商店與背包。',
            cost: 0, auto: true, req: { boss: 'boss_tofu' }, reqText: '擊敗絕對防禦百葉豆腐菇',
            effect: { type: 'unlockShop', zoneId: 'zone_03' }
        },
        {
            id: 'u_mil_3', group: 'milestone', name: '阿嬤的秘方', flavor: '不要問，問就是加一點點。',
            desc: '解鎖裝備系統與單一裝備欄位，並解鎖軌道微波砲的購買資格。',
            cost: 0, auto: true, req: { boss: 'boss_frozen' }, reqText: '擊敗過期三週的急凍菇',
            effect: { type: 'unlockEquipment' }
        },
        {
            id: 'u_mil_4', group: 'milestone', name: 'VIP 會員卡', flavor: '刷卡的瞬間最帥。',
            desc: '所有商店購買價格永久 ×0.9。',
            cost: 0, brothCost: 10, req: { brothLifetime: 10 }, reqText: '歷史取得 10 滴金湯滴（購買時消耗 10 滴）',
            effect: { type: 'shopDiscount', mult: 0.9 }
        },
        {
            id: 'u_mil_5', group: 'milestone', name: '宇宙護照', flavor: '蓋滿三個章，公會終於承認你了。',
            desc: '畢業升級：全域最終傷害 ×1.25、全域菇幣 ×1.25。（原企劃需第五隻菇王，第一版改為三區全破 + 集滿八種設備的畢業獎勵，不提供尚未開放的傳送門。）',
            cost: 0, brothCost: 25,
            req: { bossesAll: true, allDeviceTypes: true },
            reqText: '擊敗前三隻菇王且擁有全部 8 種設備（購買時消耗 25 滴金湯滴）',
            effect: { type: 'passport', damageMult: 1.25, coinMult: 1.25 }
        }
    ];

    UPGRADES.forEach(function (u) { u.image = 'assets/upgrade-' + u.id + '.svg'; });

    /* ---------------- 4 種消耗道具 ---------------- */

    var ITEMS = [
        {
            id: 'i_bomb', name: '地獄魔鬼椒爆彈',
            desc: '立刻對場上所有目標造成「基準點擊傷害 × 1000」的真實傷害。',
            note: '基準點擊傷害 = 不含暴擊、連擊與限時道具的點擊傷害快照。真實傷害穿透岩殼，但不穿透菇王護盾。不觸發點擊收益與連擊。',
            cost: 25000, cooldownSeconds: 5,
            effect: { type: 'bomb', clicks: 1000 },
            color: '#c7392a', accent: '#5e140c'
        },
        {
            id: 'i_energy', name: '特調提神飲料',
            desc: '15 秒內手動點擊傷害 ×3，期間連擊不會因中斷而歸零。',
            note: '效果期間無法重複使用，也不會延長時間。',
            cost: 40000, durationSeconds: 15,
            effect: { type: 'energy', clickMult: 3 },
            color: '#3fae63', accent: '#15552b'
        },
        {
            id: 'i_broth', name: '濃縮金湯膠囊',
            desc: '60 秒內所有菇幣掉落 ×5。',
            note: '只影響菇幣，不影響金湯滴，效果不可疊加。',
            cost: 90000, durationSeconds: 60,
            effect: { type: 'brothCapsule', coinMult: 5 },
            color: '#e0b63a', accent: '#6f520c'
        },
        {
            id: 'i_time', name: '時間快轉哨子',
            desc: '立刻取得等同 2 小時離線採集的資源。',
            note: '與離線採集共用同一套模型：不推進菇王、不生成在線事件、不套用任何限時倍率、不重置設備冷卻。每日上限 3 次（以 Asia/Taipei 日期計算，記錄在本機存檔，為單人玩法限制而非防作弊）。',
            cost: 260000,
            effect: { type: 'whistle' },
            color: '#c9d2dc', accent: '#4a5664'
        }
    ];

    ITEMS.forEach(function (item, i) { item.image = 'assets/item-' + String(i + 1).padStart(2, '0') + '.svg'; });

    /* ---------------- 6 件裝備（單一欄位） ---------------- */

    var EQUIPMENT = [
        {
            id: 'eq_apron', name: '防滑圍裙',
            desc: '手動點擊爆擊率 +10%（加在既有機率上）。',
            effect: { type: 'critChance', value: 0.1 }
        },
        {
            id: 'eq_glove', name: '隔熱手套',
            desc: '無視蘑菇的岩殼減免，所有傷害照常計算。',
            effect: { type: 'ignoreArmor' }
        },
        {
            id: 'eq_hat', name: '廚師高帽',
            desc: '所有自動設備最終傷害 ×1.3。',
            effect: { type: 'deviceFinal', mult: 1.3 }
        },
        {
            id: 'eq_shades', name: '金框墨鏡',
            desc: '寶箱松露與純金大香菇的出現權重 ×2。',
            effect: { type: 'rareWeight', mult: 2 }
        },
        {
            id: 'eq_chicken', name: '尖叫雞吊飾',
            desc: '離線採集與時間快轉哨子的收益 ×1.2。',
            effect: { type: 'offlineGain', mult: 1.2 }
        },
        {
            id: 'eq_pan', name: '平底鍋護盾',
            desc: '菇王的干擾效果減半。注意：為了保留菇王的必要解謎，急凍菇的凍結只會「減半數量」，不會完全免疫。',
            effect: { type: 'bossInterference', mult: 0.5 }
        }
    ];

    EQUIPMENT.forEach(function (e, i) { e.image = 'assets/equip-' + String(i + 1).padStart(2, '0') + '.svg'; });

    /* ---------------- 20 個成就 ---------------- */

    var ACHIEVEMENTS = [
        { id: 'ach_first_blood', name: '第一滴湯', desc: '取得第一滴金湯滴。', req: { brothLifetime: 1 } },
        { id: 'ach_rich', name: '資本主義的形狀', desc: '歷史累積獲得 100 萬菇幣。', req: { lifetimeCoins: 1000000 } },
        { id: 'ach_tongs10', name: '夾子交響樂', desc: '擁有 10 把彈簧烤肉夾。', req: { device: { id: 'auto_tongs', count: 10 } } },
        { id: 'ach_pepper10', name: '噴嚏製造機', desc: '擁有 10 台胡椒罐無人機。', req: { device: { id: 'pepper_drone', count: 10 } } },
        { id: 'ach_garlic5', name: '壓力測試', desc: '擁有 5 台重力蒜泥機。', req: { device: { id: 'garlic_mech', count: 5 } } },
        { id: 'ach_tender5', name: '口感工程師', desc: '擁有 5 座肉槌打擊陣列。', req: { device: { id: 'tenderizer_array', count: 5 } } },
        { id: 'ach_micro1', name: '叮！加熱完畢', desc: '買下第一門軌道微波砲。', req: { device: { id: 'orbital_micro', count: 1 } } },
        { id: 'ach_all_devices', name: '滿編討伐隊', desc: '集滿全部 8 種設備。', req: { allDeviceTypes: true } },
        { id: 'ach_boss1', name: '柱子倒了', desc: '擊敗巨無霸杏鮑菇。', req: { boss: 'boss_king' } },
        { id: 'ach_boss2', name: '豆腐碎了', desc: '擊敗絕對防禦百葉豆腐菇。', req: { boss: 'boss_tofu' } },
        { id: 'ach_boss3', name: '冰箱清空了', desc: '擊敗過期三週的急凍菇。', req: { boss: 'boss_frozen' } },
        { id: 'ach_cold', name: '阿嬤覺得你冷', desc: '在仍有設備被冰凍的狀態下擊敗第三區菇王。', req: { flag: 'coldWin' } },
        { id: 'ach_walnut', name: '胡桃鉗專家', desc: '擊敗 50 隻核桃堅果菇。', req: { kills: { id: 'sh_walnut', count: 50 } } },
        { id: 'ach_enoki', name: '抱團取暖', desc: '擊敗 100 根金針瘦瘦菇。', req: { kills: { id: 'sh_enoki', count: 100 } } },
        { id: 'ach_sponge', name: '擰乾它', desc: '擊敗 20 隻吸湯海綿菇。', req: { kills: { id: 'sh_sponge', count: 20 } } },
        { id: 'ach_ice', name: '破冰行動', desc: '擊敗 20 隻冰晶雪花菇。', req: { kills: { id: 'sh_ice', count: 20 } } },
        { id: 'ach_gold', name: '金礦主廚', desc: '擊敗 5 隻純金大香菇。', req: { kills: { id: 'sh_gold', count: 5 } } },
        { id: 'ach_chest', name: '別想跑', desc: '成功擊敗 5 隻寶箱松露。', req: { kills: { id: 'sh_chest', count: 5 } } },
        { id: 'ach_fail_chest', name: '這不是自助餐', desc: '眼睜睜看著一隻寶箱松露成功逃進地底。', req: { flag: 'chestEscaped' } },
        { id: 'ach_lazy', name: '自動化流水線', desc: '完全不手動點擊，連續擊敗 50 隻蘑菇。', req: { lazyStreak: 50 } },
        { id: 'ach_combo', name: '停不下來', desc: '維持最高階連擊加成超過 30 秒。', req: { comboHoldSeconds: 30 } },
        { id: 'ach_speed', name: '連滑鼠都在流汗', desc: '10 秒內手動點擊超過 100 次（可選挑戰，不影響主線）。', optional: true, req: { burstClicks: 100 } }
    ];

    function byId(list) {
        var map = {};
        list.forEach(function (item) { map[item.id] = item; });
        return map;
    }

    return {
        UPGRADES: UPGRADES,
        ITEMS: ITEMS,
        EQUIPMENT: EQUIPMENT,
        ACHIEVEMENTS: ACHIEVEMENTS,
        UPGRADE_BY_ID: byId(UPGRADES),
        ITEM_BY_ID: byId(ITEMS),
        EQUIPMENT_BY_ID: byId(EQUIPMENT),
        ACHIEVEMENT_BY_ID: byId(ACHIEVEMENTS)
    };
});
