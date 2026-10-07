/*!
 * 戰鬥核心（純計算，不依賴 DOM）
 *
 * 統一傷害管線，明確區分各個乘區：
 *
 *   手動點擊傷害 = (基礎點擊 + 升級絕對值)
 *                 × 暴擊乘區        （機率觸發，明確倍率）
 *                 × 連擊乘區        （層數上限明確）
 *                 × 提神飲料乘區    （限時道具）
 *                 × 軟化乘區        （只對點擊，獨立乘區 ×2）
 *                 × 全域乘區        （火力全開、宇宙護照）
 *
 *   設備單次傷害 = 設備基礎傷害
 *                 × 設備傷害乘區    （鈦合金、廚師高帽）
 *                 × 專屬協同乘區    （辛香料風暴、軟硬兼施…）
 *                 × 電磁爐乘區      （有界成長，上限 ×3）
 *                 × 無情機器乘區    （以「不含本加成」的基準輸出判定）
 *                 × 全域乘區
 *
 * 護甲（岩殼）在所有乘區算完之後才判定：單次傷害低於門檻時強制變成 1。
 * 真實傷害穿透岩殼，但不穿透菇王護盾。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var deps = isNode
        ? { Config: require('./config.js'), Content: require('./content.js') }
        : { Config: root.MushConfig, Content: root.MushContent };
    var api = factory(deps);
    if (isNode) module.exports = api;
    else root.MushCombat = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    var Config = deps.Config;
    var Content = deps.Content;
    var BALANCE = Config.BALANCE;

    function finite(value, fallback) {
        return (typeof value === 'number' && isFinite(value)) ? value : (fallback || 0);
    }

    /* ---------------- 升級與裝備係數 ---------------- */

    function emptyEffects() {
        return {
            clickFlat: 0,
            critChance: 0,
            critMult: 1,
            comboBoost: false,
            clickToCoinPct: 0,
            phantomMult: 0,
            deviceSpeedMult: 1,
            deviceSpeedOne: {},
            deviceDamageMult: 1,
            deviceFinalMult: 1,
            garlicResetChance: 0,
            ruthless: null,
            synPepperHaste: 1,
            synGarlicSoften: 1,
            synInductionMicro: 1,
            cheerFreeAttack: false,
            allOutPerType: 0,
            allOutRequire: 0,
            killBountyFlat: 0,
            brothChance: 0,
            offlineExtended: false,
            spawnWeight: {},
            achievementCoinPer: 0,
            shopDiscount: 1,
            passportDamage: 1,
            passportCoin: 1,
            ignoreArmor: false,
            offlineGainMult: 1,
            bossInterferenceMult: 1
        };
    }

    function collectEffects(state) {
        var fx = emptyEffects();
        var owned = state.upgrades || {};

        Content.UPGRADES.forEach(function (upgrade) {
            if (!owned[upgrade.id]) return;
            var e = upgrade.effect;
            switch (e.type) {
                case 'clickFlat': fx.clickFlat += e.value; break;
                case 'clickCrit':
                    fx.critChance += e.chance;
                    fx.critMult = Math.max(fx.critMult, e.mult);
                    break;
                case 'comboBoost': fx.comboBoost = true; break;
                case 'clickToCoin': fx.clickToCoinPct += e.pct; break;
                case 'phantom': fx.phantomMult = Math.max(fx.phantomMult, e.mult); break;
                case 'deviceSpeed': fx.deviceSpeedMult *= e.speedMult; break;
                case 'deviceSpeedOne':
                    fx.deviceSpeedOne[e.deviceId] = (fx.deviceSpeedOne[e.deviceId] || 1) * e.speedMult;
                    break;
                case 'deviceDamage': fx.deviceDamageMult *= e.mult; break;
                case 'garlicReset': fx.garlicResetChance = Math.max(fx.garlicResetChance, e.chance); break;
                case 'ruthless': fx.ruthless = { threshold: e.threshold, mult: e.mult }; break;
                case 'synPepperHaste': fx.synPepperHaste *= e.mult; break;
                case 'synGarlicSoften': fx.synGarlicSoften *= e.mult; break;
                case 'synInductionMicro': fx.synInductionMicro *= e.mult; break;
                case 'cheerFreeAttack': fx.cheerFreeAttack = true; break;
                case 'allOutTypes':
                    fx.allOutPerType += e.perType;
                    fx.allOutRequire = e.requireCount;
                    break;
                case 'killBounty': fx.killBountyFlat += e.value; break;
                case 'brothChance': fx.brothChance += e.chance; break;
                case 'offlineExtend': fx.offlineExtended = true; break;
                case 'spawnWeight':
                    fx.spawnWeight[e.mushroomId] = (fx.spawnWeight[e.mushroomId] || 1) * e.mult;
                    break;
                case 'achievementCoin': fx.achievementCoinPer += e.perAchievement; break;
                case 'shopDiscount': fx.shopDiscount *= e.mult; break;
                case 'passport':
                    fx.passportDamage *= e.damageMult;
                    fx.passportCoin *= e.coinMult;
                    break;
                default: break;
            }
        });

        // 裝備（單一欄位，只有裝上的那件生效，切換不會累加）
        var equipped = state.equipped ? Content.EQUIPMENT_BY_ID[state.equipped] : null;
        if (equipped) {
            var ee = equipped.effect;
            if (ee.type === 'critChance') fx.critChance += ee.value;
            else if (ee.type === 'ignoreArmor') fx.ignoreArmor = true;
            else if (ee.type === 'deviceFinal') fx.deviceFinalMult *= ee.mult;
            else if (ee.type === 'rareWeight') {
                fx.spawnWeight.sh_chest = (fx.spawnWeight.sh_chest || 1) * ee.mult;
                fx.spawnWeight.sh_gold = (fx.spawnWeight.sh_gold || 1) * ee.mult;
            } else if (ee.type === 'offlineGain') fx.offlineGainMult *= ee.mult;
            else if (ee.type === 'bossInterference') fx.bossInterferenceMult *= ee.mult;
        }

        return fx;
    }

    /* ---------------- 限時效果 ---------------- */

    function activeBuffs(state, now) {
        var buffs = state.buffs || {};
        var out = { energy: false, broth: false, haste: false };
        if (buffs.energy && buffs.energy > now) out.energy = true;
        if (buffs.broth && buffs.broth > now) out.broth = true;
        if (buffs.haste && buffs.haste > now) out.haste = true;
        return out;
    }

    /* ---------------- 總結算 ---------------- */

    function deviceCount(state, id) {
        return Math.max(0, Math.floor(finite((state.devices || {})[id], 0)));
    }

    function ownedTypeCount(state, minCount) {
        var n = 0;
        Config.DEVICES.forEach(function (d) {
            if (deviceCount(state, d.id) >= (minCount || 1)) n++;
        });
        return n;
    }

    /** 電磁爐力場：以「歷史獲得菇幣」計算，有界成長，花錢不會讓它變弱。 */
    function inductionMult(state, fx, microOnCooldown) {
        if (deviceCount(state, 'induction_field') <= 0) return 1;
        var lifetime = Math.max(0, finite(state.lifetimeCoins, 0));
        var raw = BALANCE.induction.k * Math.log10(1 + lifetime / 1000);
        var scale = Math.min(1, deviceCount(state, 'induction_field') / 1);
        var bonus = raw * scale;
        if (microOnCooldown && fx.synInductionMicro > 1) bonus *= fx.synInductionMicro;
        return Math.min(BALANCE.induction.cap, 1 + bonus);
    }

    /** 連擊乘區。 */
    function comboMult(state, fx) {
        var stacks = Math.max(0, Math.min(BALANCE.combo.maxStacks, finite(state.combo, 0)));
        var per = fx.comboBoost ? BALANCE.combo.upgradedBonusPerStack : BALANCE.combo.bonusPerStack;
        return 1 + stacks * per;
    }

    function comboMaxMult(fx) {
        var per = fx.comboBoost ? BALANCE.combo.upgradedBonusPerStack : BALANCE.combo.bonusPerStack;
        return 1 + BALANCE.combo.maxStacks * per;
    }

    /**
     * 無情機器：以「不含本升級加成」的累計基準輸出判斷自動佔比，
     * 避免「開了就超過門檻、關了就低於門檻」的反覆切換與循環計算。
     */
    function ruthlessActive(state, fx) {
        if (!fx.ruthless) return false;
        var auto = Math.max(0, finite(state.baseDamageAuto, 0));
        var click = Math.max(0, finite(state.baseDamageClick, 0));
        var total = auto + click;
        if (total <= 0) return false;
        return (auto / total) >= fx.ruthless.threshold;
    }

    /**
     * 算出目前所有乘區。
     * @param {Object} state 遊戲狀態（唯讀）
     * @param {number} now 毫秒時間戳
     */
    function computeStats(state, now) {
        var fx = collectEffects(state);
        var buffs = activeBuffs(state, now);
        var microReady = !state.deviceCooldowns || !(finite(state.deviceCooldowns.orbital_micro, 0) > 0);
        var induction = inductionMult(state, fx, !microReady);

        var typesForAllOut = fx.allOutPerType > 0 ? ownedTypeCount(state, fx.allOutRequire) : 0;
        var allOutMult = 1 + typesForAllOut * fx.allOutPerType;
        var globalDamage = allOutMult * fx.passportDamage;

        var ruthless = ruthlessActive(state, fx);
        var deviceMult = fx.deviceDamageMult * fx.deviceFinalMult * induction
            * (ruthless ? fx.ruthless.mult : 1);

        var achievementCount = Object.keys(state.achievements || {}).length;
        var coinMult = fx.passportCoin
            * (1 + achievementCount * fx.achievementCoinPer)
            * (buffs.broth ? 5 : 1);

        var clickBase = BALANCE.clickBaseDamage + fx.clickFlat;
        var combo = comboMult(state, fx);
        var energyMult = buffs.energy ? 3 : 1;
        var clickNoCrit = clickBase * combo * energyMult * globalDamage;

        var speedMult = fx.deviceSpeedMult * (buffs.haste ? 1.2 : 1);
        // 冰晶雪花菇存活時，所有自動設備速度減半
        if (state.slowActive) speedMult *= 0.5;

        var perDevice = {};
        var autoDps = 0;
        Config.DEVICES.forEach(function (device) {
            var count = deviceCount(state, device.id);
            var own = fx.deviceSpeedOne[device.id] || 1;
            var cooldown = device.cooldown > 0 ? device.cooldown / (speedMult * own) : 0;
            var damage = device.damage * deviceMult * globalDamage;
            if (device.id === 'pepper_drone' && buffs.haste) damage *= fx.synPepperHaste;
            perDevice[device.id] = {
                id: device.id,
                count: count,
                cooldown: cooldown,
                damage: damage,
                dps: (device.role === 'attack' && cooldown > 0) ? (damage * count / cooldown) : 0
            };
            autoDps += perDevice[device.id].dps;
        });

        return {
            fx: fx,
            buffs: buffs,
            clickBase: clickBase,
            clickDamage: clickNoCrit,                     // 不含暴擊與軟化的期望前值
            clickCritChance: Math.min(1, fx.critChance),
            clickCritMult: fx.critMult,
            comboMult: combo,
            comboMaxMult: comboMaxMult(fx),
            comboAtMax: finite(state.combo, 0) >= BALANCE.combo.maxStacks,
            energyActive: buffs.energy,
            deviceMult: deviceMult,
            globalDamage: globalDamage,
            inductionMult: induction,
            ruthlessActive: ruthless,
            speedMult: speedMult,
            coinMult: coinMult,
            shopDiscount: fx.shopDiscount,
            perDevice: perDevice,
            autoDps: autoDps,
            achievementCount: achievementCount
        };
    }

    /** 期望點擊傷害（含暴擊期望值），只用於介面顯示。 */
    function expectedClickDamage(stats) {
        var crit = 1 + stats.clickCritChance * (stats.clickCritMult - 1);
        return stats.clickDamage * crit;
    }

    /* ---------------- 目標 ---------------- */

    var nextUid = 1;

    function createTarget(mushroom, zone, options) {
        options = options || {};
        var depthMult = options.depthMult || 1;
        var hp = mushroom.hp * zone.hpMult * depthMult;
        return {
            uid: options.uid !== undefined ? options.uid : nextUid++,
            typeId: mushroom.id,
            kind: 'mushroom',
            hp: hp,
            maxHp: hp,
            paidDamage: 0,            // 掉錢預算：累積到 maxHp 為止，回血不會補回
            settled: false,           // 死亡只結算一次
            spawnedAt: options.now || 0,
            lastHitAt: options.now || 0,
            softenUntil: 0,
            fleeAt: mushroom.traits.indexOf('flee') !== -1
                ? (options.now || 0) + mushroom.fleeSeconds * 1000
                : 0,
            // 岩殼門檻由地區設定表直接指定，不用公式推導，
            // 避免隨血量倍率失控成「單次齊射永遠打不破」。
            armorThreshold: mushroom.traits.indexOf('armor') !== -1
                ? (zone.armorThreshold || mushroom.armorThreshold || 0)
                : 0,
            depthMult: depthMult,
            clusterIndex: options.clusterIndex || 0
        };
    }

    function createBossTarget(boss, options) {
        options = options || {};
        return {
            uid: options.uid !== undefined ? options.uid : nextUid++,
            typeId: boss.id,
            kind: 'boss',
            hp: boss.hp,
            maxHp: boss.hp,
            paidDamage: 0,
            settled: false,
            spawnedAt: options.now || 0,
            lastHitAt: options.now || 0,
            softenUntil: 0,
            fleeAt: 0,
            armorThreshold: 0,
            shields: boss.mechanic === 'holdShield' ? boss.shields : 0,
            clickCount: 0
        };
    }

    function isShielded(target) {
        return target.kind === 'boss' && finite(target.shields, 0) > 0;
    }

    /**
     * 對目標造成傷害。
     * @param {Object} target
     * @param {number} amount 已經算完所有乘區的傷害
     * @param {Object} opts
     *   - trueDamage: 穿透岩殼（但不穿透菇王護盾）
     *   - ignoreArmor: 裝備造成的無視岩殼
     *   - fromAuto: 是否為自動設備（護盾期間免疫）
     * @returns {Object} { effective, blocked, killed }
     */
    function applyDamage(target, amount, opts) {
        opts = opts || {};
        var raw = finite(amount, 0);
        if (target.settled || raw <= 0) return { effective: 0, blocked: false, killed: false };

        // 菇王護盾：免疫自動攻擊與真實傷害，只能用長按破盾
        if (isShielded(target)) return { effective: 0, blocked: true, killed: false };

        var hit = raw;
        if (target.armorThreshold > 0 && !opts.trueDamage && !opts.ignoreArmor) {
            if (hit < target.armorThreshold) hit = 1;
        }

        var effective = Math.min(hit, target.hp);   // 過量傷害不計入收益
        target.hp -= effective;
        target.lastHitAt = opts.now || target.lastHitAt;

        var killed = false;
        if (target.hp <= 1e-9) {
            target.hp = 0;
            killed = true;
        }
        return { effective: effective, blocked: false, killed: killed };
    }

    /**
     * 這一擊能換到多少「掉錢預算」。
     * 每個目標最多只用掉 maxHp 的預算，回血不會補回，
     * 因此吸湯海綿菇的回血不會變成無限資源漏洞。
     */
    function consumeCoinBudget(target, effective) {
        var remaining = Math.max(0, target.maxHp - target.paidDamage);
        var paid = Math.min(remaining, effective);
        target.paidDamage += paid;
        return paid;
    }

    /** 標記軟化（只影響手動點擊的乘區）。 */
    function applySoften(target, now) {
        target.softenUntil = now + BALANCE.soften.seconds * 1000;
    }

    function isSoftened(target, now) {
        return finite(target.softenUntil, 0) > now;
    }

    function softenMult(target, now) {
        return isSoftened(target, now) ? BALANCE.soften.clickMult : 1;
    }

    /** 單體設備的目標選擇：血量最高的優先，玩家指定的目標優先。 */
    function pickSingleTarget(targets, preferredUid) {
        var alive = targets.filter(function (t) { return !t.settled && t.hp > 0; });
        if (!alive.length) return null;
        if (preferredUid !== undefined && preferredUid !== null) {
            for (var i = 0; i < alive.length; i++) {
                if (alive[i].uid === preferredUid) return alive[i];
            }
        }
        var best = alive[0];
        for (var j = 1; j < alive.length; j++) {
            if (alive[j].hp > best.hp) best = alive[j];
        }
        return best;
    }

    function resetUid(value) { nextUid = value || 1; }

    return {
        collectEffects: collectEffects,
        computeStats: computeStats,
        expectedClickDamage: expectedClickDamage,
        comboMult: comboMult,
        comboMaxMult: comboMaxMult,
        inductionMult: inductionMult,
        ruthlessActive: ruthlessActive,
        ownedTypeCount: ownedTypeCount,
        createTarget: createTarget,
        createBossTarget: createBossTarget,
        applyDamage: applyDamage,
        consumeCoinBudget: consumeCoinBudget,
        applySoften: applySoften,
        isSoftened: isSoftened,
        softenMult: softenMult,
        isShielded: isShielded,
        pickSingleTarget: pickSingleTarget,
        resetUid: resetUid
    };
});
