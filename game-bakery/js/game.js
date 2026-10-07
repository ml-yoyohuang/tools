/*!
 * 遊戲狀態與時間結算
 *
 * 不依賴 DOM。時間（now）與亂數（random）都可注入，方便重現測試。
 *
 * 收益政策（線上與離線一致，且不可能重複領取）：
 *   每次結算都會把 lastSettle 推進到現在，所以同一段時間只會被算一次。
 *   - 間隔 ≤ graceSeconds（預設 60 秒）：視為正常遊玩，以 100% 結算，含限時倍率。
 *   - 間隔 > graceSeconds：以離線政策結算，效率 50%、最多 8 小時，且不含限時倍率。
 *   不論是切到背景分頁、關閉頁面或當機，判斷方式完全相同。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var deps = isNode
        ? {
            Config: require('./config.js'),
            Content: require('./content.js'),
            Economy: require('./economy.js')
        }
        : { Config: root.BakeryConfig, Content: root.BakeryContent, Economy: root.BakeryEconomy };
    var api = factory(deps);
    if (isNode) module.exports = api;
    else root.BakeryGame = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    var Config = deps.Config;
    var Content = deps.Content;
    var Economy = deps.Economy;
    var BALANCE = Config.BALANCE;

    var MAX_CHUNK_MS = 250;   // 線上結算的最小切片，讓限時效果能準確在中途到期
    var HARD_CAP = 1e300;

    function finite(value, fallback) {
        return (typeof value === 'number' && isFinite(value)) ? value : (fallback || 0);
    }

    function clampCookies(value) {
        var n = finite(value, 0);
        if (n < 0) return 0;
        if (n > HARD_CAP) return HARD_CAP;
        return n;
    }

    function Emitter() { this._h = {}; }
    Emitter.prototype.on = function (name, fn) { (this._h[name] = this._h[name] || []).push(fn); return this; };
    Emitter.prototype.emit = function (name, payload) {
        var list = this._h[name];
        if (!list) return;
        for (var i = 0; i < list.length; i++) list[i](payload);
    };

    /* ---------------- 初始狀態 ---------------- */

    function createState(now) {
        var buildings = {};
        Config.BUILDINGS.forEach(function (b) { buildings[b.id] = 0; });
        var items = {};
        Config.ITEMS.forEach(function (i) { items[i.id] = 0; });

        return {
            version: Config.SAVE_VERSION,
            cookies: 0,
            baked: 0,            // 本輪累積製作量（花費不會讓它下降）
            bakedAllTime: 0,     // 歷史累積製作量
            clicks: 0,
            handBaked: 0,        // 由點擊產出的餅乾
            buildings: buildings,
            upgrades: {},
            achievements: {},
            claimedRewards: {},  // 一次性獎勵領取紀錄，重新載入不會重複取得
            items: items,
            itemsUsed: 0,
            goldenClicked: 0,
            goldenSpawned: 0,
            buffs: { cps: null, click: null, discount: null },
            combo: 0,
            lastClickAt: 0,
            golden: null,
            nextGoldenAt: now + 60000,
            lastSettle: now,
            startedAt: now,
            playedMs: 0
        };
    }

    /* ---------------- 主體 ---------------- */

    function Game(options) {
        options = options || {};
        this.now = options.now || function () { return Date.now(); };
        this.random = options.random || Math.random;
        this.emitter = new Emitter();
        this.state = createState(this.now());
        this.stats = Economy.computeStats(this.state, this.state.lastSettle);
    }

    Game.prototype.on = function (name, fn) { this.emitter.on(name, fn); return this; };

    Game.prototype.refreshStats = function (now) {
        this.stats = Economy.computeStats(this.state, now === undefined ? this.now() : now);
        return this.stats;
    };

    /* ---------------- 餅乾收支 ---------------- */

    Game.prototype.addCookies = function (amount) {
        var gain = finite(amount, 0);
        if (gain <= 0) return 0;
        var s = this.state;
        s.cookies = clampCookies(s.cookies + gain);
        s.baked = clampCookies(s.baked + gain);           // 只增不減
        s.bakedAllTime = clampCookies(s.bakedAllTime + gain);
        return gain;
    };

    Game.prototype.spend = function (amount) {
        var cost = finite(amount, 0);
        var s = this.state;
        if (cost < 0) return false;
        if (s.cookies + Economy.EPS < cost) return false;   // 餘額不足絕不扣款
        s.cookies = clampCookies(s.cookies - cost);
        return true;
    };

    /* ---------------- 時間結算 ---------------- */

    /** 把過期的限時效果清掉。 */
    Game.prototype._expireBuffs = function (now) {
        var buffs = this.state.buffs;
        ['cps', 'click', 'discount'].forEach(function (channel) {
            if (buffs[channel] && !(buffs[channel].expiresAt > now)) buffs[channel] = null;
        });
    };

    /** 連擊加成的自然衰退。 */
    Game.prototype._decayCombo = function (now, seconds) {
        var s = this.state;
        if (s.combo <= 0) return;
        var idle = (now - s.lastClickAt) / 1000;
        if (idle <= BALANCE.combo.windowSeconds) return;
        s.combo = Math.max(0, s.combo - BALANCE.combo.decayPerSecond * s.combo * seconds);
        if (s.combo < 0.001) s.combo = 0;
    };

    /**
     * 推進到 now。回傳結算報告（離線時含離線資訊）。
     */
    Game.prototype.tick = function (nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var s = this.state;
        var delta = now - s.lastSettle;

        // 系統時間倒退：不給負收益，也不當作離線
        if (delta < 0) {
            s.lastSettle = now;
            this._expireBuffs(now);
            this.refreshStats(now);
            return { kind: 'rollback', earned: 0, seconds: 0 };
        }
        if (delta === 0) {
            this.refreshStats(now);
            return { kind: 'none', earned: 0, seconds: 0 };
        }

        var report;
        if (delta > BALANCE.offline.graceSeconds * 1000) {
            report = this._settleOffline(now, delta);
        } else {
            report = this._settleOnline(now, delta);
        }

        s.lastSettle = now;
        s.playedMs = finite(s.playedMs, 0) + Math.min(delta, BALANCE.offline.graceSeconds * 1000);
        this.refreshStats(now);
        this._checkAchievements(now);
        return report;
    };

    /** 正常遊玩：切成小片段結算，讓限時效果能在中途正確到期。 */
    Game.prototype._settleOnline = function (now, delta) {
        var s = this.state;
        var remaining = delta;
        var cursor = now - delta;
        var earned = 0;

        while (remaining > 0) {
            var chunk = Math.min(MAX_CHUNK_MS, remaining);
            cursor += chunk;
            this._expireBuffs(cursor);
            var stats = Economy.computeStats(s, cursor);
            earned += stats.cps * (chunk / 1000);
            this._decayCombo(cursor, chunk / 1000);
            remaining -= chunk;
        }

        this.addCookies(earned);
        this._updateGolden(now);
        return { kind: 'online', earned: earned, seconds: delta / 1000 };
    };

    /** 離線：50% 效率、最多 8 小時，且不含限時倍率。 */
    Game.prototype._settleOffline = function (now, delta) {
        var s = this.state;
        var capMs = BALANCE.offline.maxHours * 3600 * 1000;
        var countedMs = Math.min(delta, capMs);

        this._expireBuffs(now);
        s.combo = 0;

        // 以「未含限時效果」的產量結算
        var stats = Economy.computeStats(s, now);
        var earned = stats.baseCps * (countedMs / 1000) * BALANCE.offline.efficiency;
        this.addCookies(earned);

        // 離線期間不累積可點擊事件：重新排一次下一個黃金餅乾
        s.golden = null;
        this._scheduleGolden(now);

        var report = {
            kind: 'offline',
            earned: earned,
            seconds: delta / 1000,
            countedSeconds: countedMs / 1000,
            capped: delta > capMs,
            efficiency: BALANCE.offline.efficiency,
            maxHours: BALANCE.offline.maxHours
        };
        this.emitter.emit('offline', report);
        return report;
    };

    /* ---------------- 點擊 ---------------- */

    Game.prototype.click = function (nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var s = this.state;
        var stats = this.refreshStats(now);

        var gain = stats.clickValue;
        var lucky = false;
        if (stats.lucky.chance > 0 && this.random() < stats.lucky.chance) {
            lucky = true;
            gain *= stats.lucky.mult;
        }

        this.addCookies(gain);
        s.clicks = finite(s.clicks, 0) + 1;
        s.handBaked = clampCookies(s.handBaked + gain);

        if (stats.comboEnabled) {
            s.combo = Math.min(BALANCE.combo.maxBonus, finite(s.combo, 0) + BALANCE.combo.gainPerClick);
        }
        s.lastClickAt = now;

        this.refreshStats(now);
        this._checkAchievements(now);
        return { gain: gain, lucky: lucky };
    };

    /* ---------------- 購買 ---------------- */

    Game.prototype.currentDiscount = function (now) {
        var buffs = Economy.activeBuffs(this.state.buffs, now === undefined ? this.now() : now);
        return buffs.discount;
    };

    /**
     * 購買設備。mode 可為 1、10 或 'max'。
     * 餘額不足、數量為 0 時完全不扣款。
     */
    Game.prototype.buyBuilding = function (buildingId, mode, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var building = Config.BUILDING_BY_ID[buildingId];
        if (!building) return null;

        var s = this.state;
        var owned = finite(s.buildings[buildingId], 0);
        var discount = this.currentDiscount(now);
        var plan = Economy.planPurchase(building, owned, s.cookies, mode, discount);

        if (plan.count <= 0 || !plan.affordable) return null;
        if (!this.spend(plan.cost)) return null;

        s.buildings[buildingId] = owned + plan.count;
        this.refreshStats(now);
        this._checkAchievements(now);
        this.emitter.emit('buy', { buildingId: buildingId, count: plan.count, cost: plan.cost });
        return { buildingId: buildingId, count: plan.count, cost: plan.cost };
    };

    /** 購買永久升級。已擁有或條件未達成時不扣款。 */
    Game.prototype.buyUpgrade = function (upgradeId, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var upgrade = Content.UPGRADE_BY_ID[upgradeId];
        if (!upgrade) return false;

        var s = this.state;
        if (s.upgrades[upgradeId]) return false;               // 不可重複購買
        if (!Economy.meetsRequirement(upgrade.req, s, this.stats)) return false;
        if (!this.spend(upgrade.cost)) return false;

        s.upgrades[upgradeId] = true;
        this.refreshStats(now);
        this._checkAchievements(now);
        this.emitter.emit('upgrade', { upgradeId: upgradeId });
        return true;
    };

    /* ---------------- 道具 ---------------- */

    Game.prototype.grantItem = function (itemId, amount) {
        if (!Config.ITEM_BY_ID[itemId]) return 0;
        var n = Math.max(0, Math.floor(finite(amount, 1)));
        if (n <= 0) return 0;
        this.state.items[itemId] = finite(this.state.items[itemId], 0) + n;
        this.emitter.emit('item', { itemId: itemId, amount: n });
        return n;
    };

    /**
     * 使用一個道具。
     * - 限時類：同類重複使用只延長時間，不重複乘倍率，並受上限限制
     * - 時間砂糖：以未含限時效果的產量結算，不推進任何計時器
     */
    Game.prototype.useItem = function (itemId, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var item = Config.ITEM_BY_ID[itemId];
        if (!item) return null;

        var s = this.state;
        if (finite(s.items[itemId], 0) < 1) return null;

        s.items[itemId] = finite(s.items[itemId], 0) - 1;      // 一次只扣一個
        s.itemsUsed = finite(s.itemsUsed, 0) + 1;

        var stats = this.refreshStats(now);
        var result = { itemId: itemId, kind: item.effect.type };

        if (item.effect.type === 'instant') {
            // 不吃限時倍率、不推進計時器、不觸發事件
            var seconds = item.effect.minutes * 60;
            var gain = stats.baseCps * seconds;
            this.addCookies(gain);
            result.gain = gain;
        } else {
            var channel = item.effect.channel;
            var durationMs = item.effect.seconds * 1000 * (1 + stats.buffDurationBonus);
            var maxMs = BALANCE.buffMaxSeconds[channel] * 1000 * (1 + stats.buffDurationBonus);
            var current = s.buffs[channel];
            var base = (current && current.expiresAt > now) ? current.expiresAt : now;
            var expiresAt = Math.min(base + durationMs, now + maxMs);

            s.buffs[channel] = {
                expiresAt: expiresAt,
                mult: finite(item.effect.mult, 1),
                value: finite(item.effect.value, 0),
                itemId: itemId
            };
            result.remaining = (expiresAt - now) / 1000;
            result.channel = channel;
        }

        this.refreshStats(now);
        this._checkAchievements(now);
        this.emitter.emit('useItem', result);
        return result;
    };

    /* ---------------- 黃金餅乾事件 ---------------- */

    Game.prototype._scheduleGolden = function (now) {
        var s = this.state;
        var g = BALANCE.golden;
        var stats = this.stats || Economy.computeStats(s, now);
        var span = g.maxSeconds - g.minSeconds;
        var seconds = (g.minSeconds + this.random() * span) / (1 + stats.goldenFreqBonus);
        s.nextGoldenAt = now + seconds * 1000;
    };

    Game.prototype._updateGolden = function (now) {
        var s = this.state;
        if (s.golden) {
            if (now >= s.golden.expiresAt) {
                s.golden = null;
                this._scheduleGolden(now);
            }
            return;
        }
        if (!(now >= s.nextGoldenAt)) return;
        s.golden = {
            expiresAt: now + BALANCE.golden.lifetimeSeconds * 1000,
            x: 0.1 + this.random() * 0.8,
            y: 0.1 + this.random() * 0.7
        };
        s.goldenSpawned = finite(s.goldenSpawned, 0) + 1;
        this.emitter.emit('goldenSpawn', s.golden);
    };

    /** 點擊黃金餅乾。回傳獎勵內容，過期或不存在時回傳 null。 */
    Game.prototype.clickGolden = function (nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var s = this.state;
        if (!s.golden || now >= s.golden.expiresAt) return null;

        s.golden = null;
        s.goldenClicked = finite(s.goldenClicked, 0) + 1;
        this._scheduleGolden(now);

        var stats = this.refreshStats(now);
        var rewards = BALANCE.golden.rewards;
        var total = rewards.reduce(function (sum, r) { return sum + r.weight; }, 0);
        var roll = this.random() * total;
        var picked = rewards[rewards.length - 1];
        for (var i = 0; i < rewards.length; i++) {
            roll -= rewards[i].weight;
            if (roll < 0) { picked = rewards[i]; break; }
        }

        var result = { kind: picked.kind };
        if (picked.kind === 'cookies') {
            var gain = Math.max(picked.minCookies, stats.baseCps * picked.seconds)
                * (1 + stats.goldenRewardBonus);
            this.addCookies(gain);
            result.gain = gain;
        } else {
            this.grantItem(picked.itemId, 1);
            result.itemId = picked.itemId;
        }

        this._checkAchievements(now);
        this.emitter.emit('goldenClick', result);
        return result;
    };

    /* ---------------- 成就 ---------------- */

    Game.prototype._checkAchievements = function (now) {
        var s = this.state;
        var stats = this.stats;
        var self = this;
        Content.ACHIEVEMENTS.forEach(function (ach) {
            if (s.achievements[ach.id]) return;
            if (!Economy.meetsRequirement(ach.req, s, stats)) return;

            s.achievements[ach.id] = true;
            // 一次性獎勵只發一次，重新載入不會重複取得
            if (ach.reward && !s.claimedRewards[ach.id]) {
                s.claimedRewards[ach.id] = true;
                self.grantItem(ach.reward.itemId, ach.reward.amount);
            }
            self.emitter.emit('achievement', ach);
        });
    };

    /* ---------------- 存檔用快照 ---------------- */

    Game.prototype.snapshot = function () {
        return JSON.parse(JSON.stringify(this.state));
    };

    Game.prototype.loadSnapshot = function (data, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var fresh = createState(now);
        var s = Object.assign(fresh, data || {});

        // 補齊缺少的欄位，避免舊存檔少了新內容而壞掉
        Config.BUILDINGS.forEach(function (b) { s.buildings[b.id] = finite(s.buildings[b.id], 0); });
        Config.ITEMS.forEach(function (i) { s.items[i.id] = finite(s.items[i.id], 0); });
        s.buffs = s.buffs || { cps: null, click: null, discount: null };
        s.upgrades = s.upgrades || {};
        s.achievements = s.achievements || {};
        s.claimedRewards = s.claimedRewards || {};
        s.cookies = clampCookies(s.cookies);
        s.baked = clampCookies(s.baked);
        s.bakedAllTime = clampCookies(Math.max(s.bakedAllTime, s.baked));
        s.combo = 0;
        s.golden = null;

        this.state = s;
        this.refreshStats(now);
        return this.state;
    };

    return {
        Game: Game,
        createState: createState,
        MAX_CHUNK_MS: MAX_CHUNK_MS
    };
});
