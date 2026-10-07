/*!
 * 經濟計算（純函式，不依賴 DOM、不讀寫全域狀態）
 *
 * 加成結算順序（明確區分相加與相乘）：
 *   單一設備每秒產量
 *     = baseCps
 *     × Π(升級的 buildingMult / buildingTierMult)      ← 相乘
 *     × Π(設定表中已達成的數量里程碑)                    ← 相乘
 *     × (1 + Σ(搭配加成與升級里程碑))                    ← 先相加再乘
 *   未含限時效果的總產量 baseCps = Σ(設備產量) × Π(全局倍率)
 *   含限時效果的產量      cps     = baseCps × 限時倍率
 *   點擊收益 = (點擊基礎 × Π(點擊倍率) × (1 + Σ(設備回饋)) + 產量回饋) × 連擊 × 限時倍率
 *
 * 所有搭配一律讀「設備數量」，絕不讀其他設備的最終產量，因此不會循環。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var deps = isNode
        ? { Config: require('./config.js'), Content: require('./content.js'), Format: require('./format.js') }
        : { Config: root.BakeryConfig, Content: root.BakeryContent, Format: root.BakeryFormat };
    var api = factory(deps);
    if (isNode) module.exports = api;
    else root.BakeryEconomy = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    var Config = deps.Config;
    var Content = deps.Content;
    var Format = deps.Format;
    var EPS = 1e-6;
    var MAX_BULK = 100000;

    function finite(value, fallback) {
        return (typeof value === 'number' && isFinite(value)) ? value : (fallback || 0);
    }

    /* ---------------- 價格 ---------------- */

    /** 第 owned 個之後，下一個單位的價格（已套用折扣）。 */
    function unitCost(building, owned, discount) {
        var d = 1 - finite(discount, 0);
        if (d < 0) d = 0;
        var cost = building.baseCost * Math.pow(building.growth, Math.max(0, owned)) * d;
        return finite(cost, Infinity);
    }

    /** 連續買 count 個的總價（等比級數，非逐項累加，避免誤差放大）。 */
    function bulkCost(building, owned, count, discount) {
        var n = Math.floor(finite(count, 0));
        if (n <= 0) return 0;
        var g = building.growth;
        var first = unitCost(building, owned, discount);
        if (!isFinite(first)) return Infinity;
        if (Math.abs(g - 1) < 1e-12) return first * n;
        var total = first * (Math.pow(g, n) - 1) / (g - 1);
        return finite(total, Infinity);
    }

    /** 以目前餘額最多能買幾個（已套用折扣）。 */
    function maxAffordable(building, owned, cookies, discount) {
        var money = finite(cookies, 0);
        if (money <= 0) return 0;
        var first = unitCost(building, owned, discount);
        if (!isFinite(first) || first <= 0) return 0;
        if (money < first - EPS) return 0;

        var g = building.growth;
        var guess;
        if (Math.abs(g - 1) < 1e-12) {
            guess = Math.floor(money / first);
        } else {
            var inner = 1 + money * (g - 1) / first;
            guess = inner > 0 ? Math.floor(Math.log(inner) / Math.log(g)) : 0;
        }
        if (!isFinite(guess) || guess < 0) guess = 0;
        if (guess > MAX_BULK) guess = MAX_BULK;

        // 封閉解可能因浮點誤差多算或少算一個，這裡修正到剛好買得起
        while (guess > 0 && bulkCost(building, owned, guess, discount) > money + EPS) guess--;
        while (guess < MAX_BULK && bulkCost(building, owned, guess + 1, discount) <= money + EPS) guess++;
        return guess;
    }

    /** 依購買模式（1 / 10 / max）算出實際要買的數量與總價。 */
    function planPurchase(building, owned, cookies, mode, discount) {
        var want;
        if (mode === 'max') want = maxAffordable(building, owned, cookies, discount);
        else want = Math.max(1, Math.floor(finite(mode, 1)));

        if (want <= 0) return { count: 0, cost: 0, affordable: false };
        var cost = bulkCost(building, owned, want, discount);
        var affordable = cost <= finite(cookies, 0) + EPS;
        return { count: want, cost: cost, affordable: affordable };
    }

    /* ---------------- 加成彙整 ---------------- */

    function emptyEffects() {
        return {
            clickMult: 1,
            clickAdditive: 0,
            clickFromCpsPct: 0,
            lucky: { chance: 0, mult: 1 },
            combo: false,
            globalMult: 1,
            buildingMult: {},
            buildingAdditive: {},
            buffDurationBonus: 0,
            goldenFreqBonus: 0,
            goldenRewardBonus: 0
        };
    }

    /** 掃過所有已購買的升級，彙整成一組係數。 */
    function collectEffects(ownedUpgrades, counts) {
        var fx = emptyEffects();
        Config.BUILDINGS.forEach(function (b) {
            fx.buildingMult[b.id] = 1;
            fx.buildingAdditive[b.id] = 0;
        });

        function countOf(id) { return Math.max(0, Math.floor(finite(counts[id], 0))); }

        Content.UPGRADES.forEach(function (upgrade) {
            if (!ownedUpgrades[upgrade.id]) return;
            var e = upgrade.effect;
            switch (e.type) {
                case 'clickMult':
                    fx.clickMult *= e.mult;
                    break;
                case 'clickFromCps':
                    fx.clickFromCpsPct += e.pct;
                    break;
                case 'clickFromBuilding':
                    fx.clickAdditive += Math.floor(countOf(e.source) / e.per) * e.bonus;
                    break;
                case 'lucky':
                    fx.lucky.chance = Math.min(1, fx.lucky.chance + e.chance);
                    fx.lucky.mult = Math.max(fx.lucky.mult, e.mult);
                    break;
                case 'combo':
                    fx.combo = true;
                    break;
                case 'buildingMult':
                    fx.buildingMult[e.target] = (fx.buildingMult[e.target] || 1) * e.mult;
                    break;
                case 'buildingTierMult':
                    Config.BUILDINGS.forEach(function (b) {
                        if (b.tier >= e.minTier && b.tier <= e.maxTier) {
                            fx.buildingMult[b.id] *= e.mult;
                        }
                    });
                    break;
                case 'buildingMilestone':
                    fx.buildingAdditive[e.target] += Math.floor(countOf(e.target) / e.per) * e.bonus;
                    break;
                case 'synergyCount':
                    fx.buildingAdditive[e.target] += Math.floor(countOf(e.source) / e.per) * e.bonus;
                    break;
                case 'synergyTiers':
                    var steps = Math.floor(countOf(e.source) / e.per);
                    Config.BUILDINGS.forEach(function (b) {
                        if (b.tier >= e.minTier && b.tier <= e.maxTier) {
                            fx.buildingAdditive[b.id] += steps * e.bonus;
                        }
                    });
                    break;
                case 'globalMult':
                    fx.globalMult *= e.mult;
                    break;
                case 'globalIfAll':
                    var all = Config.BUILDINGS.every(function (b) { return countOf(b.id) >= e.count; });
                    if (all) fx.globalMult *= e.mult;
                    break;
                case 'goldenBoost':
                    fx.goldenFreqBonus += e.freq;
                    fx.goldenRewardBonus += e.reward;
                    break;
                case 'buffDuration':
                    fx.buffDurationBonus += e.bonus;
                    break;
                default:
                    break;
            }
        });
        return fx;
    }

    /** 設定表中的數量里程碑（相乘）。 */
    function milestoneMult(building, count) {
        var mult = 1;
        (building.milestones || []).forEach(function (stone) {
            if (count >= stone.count) mult *= stone.mult;
        });
        return mult;
    }

    /* ---------------- 限時效果 ---------------- */

    /** 取得目前生效的限時倍率。now 為毫秒時間戳。 */
    function activeBuffs(buffs, now) {
        var result = { cps: 1, click: 1, discount: 0, active: [] };
        if (!buffs) return result;
        ['cps', 'click', 'discount'].forEach(function (channel) {
            var buff = buffs[channel];
            if (!buff || !(buff.expiresAt > now)) return;
            if (channel === 'discount') result.discount = finite(buff.value, 0);
            else result[channel] = finite(buff.mult, 1);
            result.active.push({
                channel: channel,
                remaining: (buff.expiresAt - now) / 1000,
                mult: finite(buff.mult, 1),
                value: finite(buff.value, 0)
            });
        });
        return result;
    }

    /* ---------------- 總結算 ---------------- */

    /**
     * 算出目前的完整數值。
     * @param {Object} state 遊戲狀態（唯讀）
     * @param {number} now 毫秒時間戳
     */
    function computeStats(state, now) {
        var counts = state.buildings || {};
        var fx = collectEffects(state.upgrades || {}, counts);
        var buffs = activeBuffs(state.buffs, now);

        var perBuilding = {};
        var rawTotal = 0;

        Config.BUILDINGS.forEach(function (building) {
            var count = Math.max(0, Math.floor(finite(counts[building.id], 0)));
            var mult = (fx.buildingMult[building.id] || 1)
                * milestoneMult(building, count)
                * (1 + (fx.buildingAdditive[building.id] || 0));
            var each = building.baseCps * mult;
            var total = each * count;
            rawTotal += total;
            perBuilding[building.id] = {
                id: building.id,
                count: count,
                each: each,
                total: total,
                mult: mult
            };
        });

        var baseCps = rawTotal * fx.globalMult;             // 未含限時效果
        var cps = baseCps * buffs.cps;                      // 含限時效果

        var comboMult = 1;
        if (fx.combo) comboMult = 1 + Math.max(0, finite(state.combo, 0));

        var clickBase = Config.BALANCE.clickBase * fx.clickMult * (1 + fx.clickAdditive);
        var clickFromCps = fx.clickFromCpsPct * baseCps;
        var clickValue = (clickBase + clickFromCps) * comboMult * buffs.click;

        return {
            perBuilding: perBuilding,
            baseCps: finite(baseCps, 0),
            cps: finite(cps, 0),
            clickBase: finite(clickBase, 0),
            clickFromCps: finite(clickFromCps, 0),
            clickValue: finite(clickValue, 0),
            comboMult: comboMult,
            globalMult: fx.globalMult,
            lucky: fx.lucky,
            comboEnabled: fx.combo,
            buffs: buffs,
            buffDurationBonus: fx.buffDurationBonus,
            goldenFreqBonus: fx.goldenFreqBonus,
            goldenRewardBonus: fx.goldenRewardBonus
        };
    }

    /**
     * 買下某設備 count 個之後，未含限時效果的產量會增加多少。
     * 直接以「加完數量後重算」取得，因此搭配與里程碑都會算進去。
     */
    function cpsGainOf(state, buildingId, count, now) {
        var before = computeStats(state, now).baseCps;
        var clone = {
            buildings: Object.assign({}, state.buildings),
            upgrades: state.upgrades,
            buffs: null,
            combo: 0
        };
        clone.buildings[buildingId] = finite(clone.buildings[buildingId], 0) + Math.max(0, count);
        var after = computeStats(clone, now).baseCps;
        return Math.max(0, after - before);
    }

    /** 購買某個升級後，未含限時效果的產量會增加多少（給商店顯示預估收益）。 */
    function upgradeGainOf(state, upgradeId, now) {
        var before = computeStats(state, now);
        var clone = {
            buildings: state.buildings,
            upgrades: Object.assign({}, state.upgrades),
            buffs: null,
            combo: 0
        };
        clone.upgrades[upgradeId] = true;
        var after = computeStats(clone, now);
        return {
            cps: Math.max(0, after.baseCps - before.baseCps),
            click: Math.max(0, (after.clickBase + after.clickFromCps) - (before.clickBase + before.clickFromCps))
        };
    }

    /* ---------------- 條件判定 ---------------- */

    /** 升級／成就的解鎖條件判定。 */
    function meetsRequirement(req, state, stats) {
        if (!req) return true;
        var counts = state.buildings || {};
        if (req.totalBaked !== undefined && finite(state.baked, 0) < req.totalBaked) return false;
        if (req.clicks !== undefined && finite(state.clicks, 0) < req.clicks) return false;
        if (req.upgrades !== undefined && Object.keys(state.upgrades || {}).length < req.upgrades) return false;
        if (req.itemsUsed !== undefined && finite(state.itemsUsed, 0) < req.itemsUsed) return false;
        if (req.goldenClicked !== undefined && finite(state.goldenClicked, 0) < req.goldenClicked) return false;
        if (req.building !== undefined && finite(counts[req.building.id], 0) < req.building.count) return false;
        if (req.allBuildings !== undefined) {
            var ok = Config.BUILDINGS.every(function (b) { return finite(counts[b.id], 0) >= req.allBuildings; });
            if (!ok) return false;
        }
        if (req.buffsActive !== undefined) {
            var active = stats && stats.buffs ? stats.buffs.active.length : 0;
            if (active < req.buffsActive) return false;
        }
        return true;
    }

    /** 設備是否已揭曉（未揭曉時畫面上只顯示剪影與神祕提示）。 */
    function isRevealed(building, state) {
        return finite(state.baked, 0) >= building.revealAt
            || finite((state.buildings || {})[building.id], 0) > 0;
    }

    /** 回傳「接下來值得追求」的幾個目標。 */
    function nextGoals(state, stats, limit) {
        var goals = [];
        var counts = state.buildings || {};

        Config.BUILDINGS.forEach(function (building) {
            if (isRevealed(building, state)) return;
            goals.push({
                kind: 'building',
                label: '解鎖新設備',
                detail: building.hint,
                progress: finite(state.baked, 0) / building.revealAt,
                need: '累積製作 ' + Format.short(building.revealAt) + ' 塊',
                sort: building.revealAt
            });
        });

        Content.UPGRADES.forEach(function (upgrade) {
            if (state.upgrades && state.upgrades[upgrade.id]) return;
            if (meetsRequirement(upgrade.req, state, stats)) return;
            var progress = 0;
            var need = '';
            if (upgrade.req.building) {
                var have = finite(counts[upgrade.req.building.id], 0);
                progress = have / upgrade.req.building.count;
                var b = Config.BUILDING_BY_ID[upgrade.req.building.id];
                need = (b ? b.name : upgrade.req.building.id) + ' ' + have + '/' + upgrade.req.building.count;
            } else if (upgrade.req.clicks) {
                progress = finite(state.clicks, 0) / upgrade.req.clicks;
                need = '點擊 ' + Format.full(Math.floor(finite(state.clicks, 0))) + ' / ' + Format.full(upgrade.req.clicks) + ' 次';
            } else if (upgrade.req.totalBaked) {
                progress = finite(state.baked, 0) / upgrade.req.totalBaked;
                need = '累積製作 ' + Format.short(upgrade.req.totalBaked) + ' 塊';
            } else if (upgrade.req.allBuildings) {
                var min = Infinity;
                Config.BUILDINGS.forEach(function (b2) { min = Math.min(min, finite(counts[b2.id], 0)); });
                progress = min / upgrade.req.allBuildings;
                need = '每種設備 ' + min + '/' + upgrade.req.allBuildings;
            } else if (upgrade.req.itemsUsed) {
                progress = finite(state.itemsUsed, 0) / upgrade.req.itemsUsed;
                need = '使用道具 ' + finite(state.itemsUsed, 0) + '/' + upgrade.req.itemsUsed;
            } else if (upgrade.req.goldenClicked) {
                progress = finite(state.goldenClicked, 0) / upgrade.req.goldenClicked;
                need = '黃金餅乾 ' + finite(state.goldenClicked, 0) + '/' + upgrade.req.goldenClicked;
            }
            goals.push({
                kind: 'upgrade',
                label: '解鎖升級：' + upgrade.name,
                detail: upgrade.desc,
                progress: progress,
                need: need,
                sort: 1 / Math.max(1e-9, progress)
            });
        });

        goals.sort(function (a, b) { return b.progress - a.progress; });
        return goals.slice(0, limit || 3);
    }

    return {
        unitCost: unitCost,
        bulkCost: bulkCost,
        maxAffordable: maxAffordable,
        planPurchase: planPurchase,
        collectEffects: collectEffects,
        milestoneMult: milestoneMult,
        activeBuffs: activeBuffs,
        computeStats: computeStats,
        cpsGainOf: cpsGainOf,
        upgradeGainOf: upgradeGainOf,
        meetsRequirement: meetsRequirement,
        isRevealed: isRevealed,
        nextGoals: nextGoals,
        EPS: EPS
    };
});
