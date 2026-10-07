/*!
 * 遊戲狀態與時間結算
 *
 * 不依賴 DOM。時間（now）與亂數（random）可注入，方便重現測試。
 *
 * 收益政策：每次結算都把 lastSettle 推進到現在，同一段時間只會被結算一次。
 *  - 間隔 ≤ 60 秒：視為正常遊玩，以固定 100ms 步長推進（含限時倍率）。
 *  - 間隔 > 60 秒：以離線模型結算（封閉式估算，不逐次模擬），不含限時倍率，
 *    只採集「目前所在地區」的普通蘑菇，不推進菇王、不開新地區、不發稀有掉落。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var deps = isNode
        ? {
            Config: require('./config.js'),
            Content: require('./content.js'),
            Combat: require('./combat.js')
        }
        : { Config: root.MushConfig, Content: root.MushContent, Combat: root.MushCombat };
    var api = factory(deps);
    if (isNode) module.exports = api;
    else root.MushGame = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    var Config = deps.Config;
    var Content = deps.Content;
    var Combat = deps.Combat;
    var BALANCE = Config.BALANCE;

    var STEP_MS = 100;
    var MAX_TARGETS = 7;
    var HARD_CAP = 1e300;

    function finite(value, fallback) {
        return (typeof value === 'number' && isFinite(value)) ? value : (fallback || 0);
    }

    function clampResource(value) {
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
        var devices = {};
        var cooldowns = {};
        Config.DEVICES.forEach(function (d) { devices[d.id] = 0; cooldowns[d.id] = 0; });
        var items = {};
        Content.ITEMS.forEach(function (i) { items[i.id] = 0; });

        return {
            version: Config.SAVE_VERSION,
            coins: 0, lifetimeCoins: 0,
            broth: 0, brothLifetime: 0,
            totalDamage: 0,
            clicks: 0,
            devices: devices,
            deviceCooldowns: cooldowns,
            frozen: {},
            upgrades: {},
            achievements: {},
            claimed: {},
            items: items,
            equipmentOwned: {},
            equipped: null,
            zoneId: 'zone_01',
            unlockedZones: { zone_01: true },
            depths: {},          // 每個地區的採集深度
            depthKills: {},      // 目前深度已擊敗數
            bosses: {},
            collections: {},
            kills: {},
            killsTotal: 0,
            seen: {},
            buffs: { energy: 0, broth: 0, haste: 0 },
            itemCooldowns: {},
            combo: 0,
            lastClickAt: 0,
            comboMaxSince: 0,
            comboHoldBest: 0,
            cheerCharge: false,
            cheerTimer: 0,
            lazyStreak: 0,
            burstWindow: [],
            burstBest: 0,
            whistle: { date: '', used: 0 },
            flags: {},
            courier: null,
            nextCourierAt: now + BALANCE.courier.minSeconds * 1000,
            slowActive: false,
            baseDamageAuto: 0,
            baseDamageClick: 0,
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

        this.targets = [];          // 戰場上的目標（不存檔，載入後重新生成）
        this.mode = 'field';        // field | boss
        this.boss = null;
        this.holdStartedAt = 0;
        this.garlicChain = 0;

        this.stats = Combat.computeStats(this.state, this.state.lastSettle);
        this.refillField(this.state.lastSettle);
    }

    Game.prototype.on = function (name, fn) { this.emitter.on(name, fn); return this; };

    Game.prototype.zone = function () {
        return Config.ZONE_BY_ID[this.state.zoneId] || Config.ZONES[0];
    };

    /** 目前地區的採集深度（最小為 1）。 */
    Game.prototype.depthOf = function (zoneId) {
        var id = zoneId || this.state.zoneId;
        return Math.max(1, Math.min(BALANCE.depth.maxSteps, finite((this.state.depths || {})[id], 1)));
    };

    /** 深度造成的血量／獎勵倍率。 */
    Game.prototype.depthMult = function (zoneId, which) {
        var scale = which === 'reward' ? BALANCE.depth.rewardScale : BALANCE.depth.hpScale;
        return Math.pow(scale, this.depthOf(zoneId) - 1);
    };

    Game.prototype.refreshStats = function (now) {
        this.state.slowActive = this.targets.some(function (t) {
            return !t.settled && t.hp > 0 && t.typeId === 'sh_ice';
        });
        this.stats = Combat.computeStats(this.state, now === undefined ? this.now() : now);
        return this.stats;
    };

    /* ---------------- 資源 ---------------- */

    Game.prototype.addCoins = function (amount) {
        var gain = finite(amount, 0);
        if (gain <= 0) return 0;
        this.state.coins = clampResource(this.state.coins + gain);
        this.state.lifetimeCoins = clampResource(this.state.lifetimeCoins + gain);
        return gain;
    };

    Game.prototype.addBroth = function (amount) {
        var gain = Math.max(0, Math.floor(finite(amount, 0)));
        if (gain <= 0) return 0;
        this.state.broth += gain;
        this.state.brothLifetime += gain;
        this.emitter.emit('broth', { amount: gain });
        return gain;
    };

    Game.prototype.spendCoins = function (amount) {
        var cost = finite(amount, 0);
        if (cost < 0) return false;
        if (this.state.coins + 1e-6 < cost) return false;
        this.state.coins = clampResource(this.state.coins - cost);
        return true;
    };

    Game.prototype.spendBroth = function (amount) {
        var cost = Math.max(0, Math.floor(finite(amount, 0)));
        if (this.state.broth < cost) return false;
        this.state.broth -= cost;
        return true;
    };

    /* ---------------- 戰場 ---------------- */

    Game.prototype.spawnWeightOf = function (mushroom) {
        var fx = this.stats ? this.stats.fx : Combat.collectEffects(this.state);
        var mult = (fx.spawnWeight && fx.spawnWeight[mushroom.id]) || 1;
        return mushroom.weight * mult;
    };

    Game.prototype.rollMushroom = function () {
        var zone = this.zone();
        var self = this;
        var pool = zone.pool.map(function (id) { return Config.MUSHROOM_BY_ID[id]; })
            .filter(function (m) { return m && (!m.zones || m.zones.indexOf(zone.id) !== -1); });
        var total = 0;
        pool.forEach(function (m) { total += self.spawnWeightOf(m); });
        var roll = this.random() * total;
        for (var i = 0; i < pool.length; i++) {
            roll -= this.spawnWeightOf(pool[i]);
            if (roll < 0) return pool[i];
        }
        return pool[0];
    };

    /** 補滿戰場：一顆主目標，或一組金針菇。 */
    Game.prototype.refillField = function (now) {
        if (this.mode === 'boss') return;
        var alive = this.targets.filter(function (t) { return !t.settled && t.hp > 0; });
        if (alive.length > 0) { this.targets = alive; return; }

        this.targets = [];
        var mushroom = this.rollMushroom();
        var zone = this.zone();
        var depthMult = this.depthMult(zone.id, 'hp');
        this.state.seen[mushroom.id] = true;

        if (mushroom.traits.indexOf('cluster') !== -1) {
            var span = mushroom.clusterMax - mushroom.clusterMin;
            var count = mushroom.clusterMin + Math.floor(this.random() * (span + 1));
            count = Math.max(1, Math.min(MAX_TARGETS, count));
            for (var i = 0; i < count; i++) {
                this.targets.push(Combat.createTarget(mushroom, zone, {
                    now: now, clusterIndex: i, depthMult: depthMult
                }));
            }
        } else {
            this.targets.push(Combat.createTarget(mushroom, zone, { now: now, depthMult: depthMult }));
        }
        this.emitter.emit('spawn', { mushroomId: mushroom.id, count: this.targets.length });
    };

    /** 擊敗結算。只會執行一次。 */
    Game.prototype._settleKill = function (target, now, byClick) {
        if (target.settled) return null;
        target.settled = true;

        if (target.kind === 'boss') return this._settleBossKill(target, now);

        var mushroom = Config.MUSHROOM_BY_ID[target.typeId];
        var zone = this.zone();
        var stats = this.stats;

        var bounty = (mushroom.bounty + stats.fx.killBountyFlat)
            * zone.coinMult * this.depthMult(zone.id, 'reward') * stats.coinMult;
        var doubled = false;
        if (this.state.cheerCharge) {
            // 雙倍擊敗收益：一次充能只會被一次擊敗消耗
            this.state.cheerCharge = false;
            bounty *= 2;
            doubled = true;
        }
        this.addCoins(bounty);

        var brothGained = 0;
        if (mushroom.brothDrop) brothGained += mushroom.brothDrop;
        if (mushroom.brothChance && this.random() < mushroom.brothChance) brothGained += 1;
        if (stats.fx.brothChance > 0 && this.random() < stats.fx.brothChance) brothGained += 1;
        if (brothGained) this.addBroth(brothGained);

        this.state.kills[target.typeId] = finite(this.state.kills[target.typeId], 0) + 1;
        this.state.killsTotal++;
        this._advanceDepth(zone.id);

        if (byClick) this.state.lazyStreak = 0;
        else this.state.lazyStreak++;

        this.emitter.emit('kill', {
            typeId: target.typeId, bounty: bounty, broth: brothGained,
            doubled: doubled, uid: target.uid
        });
        this._checkAchievements(now);
        return { bounty: bounty, broth: brothGained };
    };

    /** 累積擊敗數推進採集深度。 */
    Game.prototype._advanceDepth = function (zoneId) {
        var state = this.state;
        state.depthKills[zoneId] = finite(state.depthKills[zoneId], 0) + 1;
        if (state.depthKills[zoneId] >= BALANCE.depth.killsPerStep) {
            state.depthKills[zoneId] = 0;
            if (this.depthOf(zoneId) >= BALANCE.depth.maxSteps) return;   // 深度有上限，不會無限成長
            state.depths[zoneId] = this.depthOf(zoneId) + 1;
            this.emitter.emit('depth', { zoneId: zoneId, depth: state.depths[zoneId] });
        }
    };

    Game.prototype._settleBossKill = function (target, now) {
        var boss = Config.BOSS_BY_ID[target.typeId];
        var stats = this.stats;
        var bounty = boss.bounty * stats.coinMult;
        this.addCoins(bounty);
        this.addBroth(boss.brothDrop);

        if (!this.state.bosses[boss.id]) {
            this.state.bosses[boss.id] = true;
            this.state.collections[boss.id] = true;
            // 冰凍狀態下獲勝的成就旗標
            if (boss.id === 'boss_frozen' && Object.keys(this.state.frozen).length > 0) {
                this.state.flags.coldWin = true;
            }
            this._grantMilestones(now);
        }

        this.mode = 'field';
        this.boss = null;
        this.state.frozen = {};
        this.refillField(now);
        this.emitter.emit('bossDefeated', { bossId: boss.id, bounty: bounty, broth: boss.brothDrop });
        this._checkAchievements(now);
        return { bounty: bounty, broth: boss.brothDrop };
    };

    /** 擊敗菇王後自動授予里程碑升級，不重複收費。 */
    Game.prototype._grantMilestones = function (now) {
        var self = this;
        Content.UPGRADES.forEach(function (upgrade) {
            if (!upgrade.auto || self.state.upgrades[upgrade.id]) return;
            if (!self.meetsRequirement(upgrade.req)) return;
            self.state.upgrades[upgrade.id] = true;
            var e = upgrade.effect;
            if (e.type === 'unlockZone') self.state.unlockedZones[e.zoneId] = true;
            if (e.type === 'unlockShop') self.state.unlockedZones[e.zoneId] = true;
            if (e.type === 'unlockEquipment') {
                Content.EQUIPMENT.forEach(function (eq) { self.state.equipmentOwned[eq.id] = true; });
                if (!self.state.equipped) self.state.equipped = Content.EQUIPMENT[0].id;
            }
            self.emitter.emit('milestone', upgrade);
        });
        this.refreshStats(now);
    };

    /* ---------------- 傷害 ---------------- */

    /**
     * 統一的傷害入口。回傳實際有效傷害。
     * @param {Object} opts fromAuto / trueDamage / byClick / baseline（計入基準輸出的數值）
     */
    Game.prototype.dealDamage = function (target, amount, opts, now) {
        opts = opts || {};
        var result = Combat.applyDamage(target, amount, {
            trueDamage: opts.trueDamage,
            ignoreArmor: this.stats.fx.ignoreArmor,
            now: now
        });
        if (result.blocked) {
            this.emitter.emit('blocked', { uid: target.uid });
            return 0;
        }
        if (result.effective <= 0) return 0;

        this.state.totalDamage = clampResource(this.state.totalDamage + result.effective);

        // 基準輸出（不含無情機器加成）用於無情機器的佔比判定
        var baseline = finite(opts.baseline, result.effective);
        if (opts.fromAuto) this.state.baseDamageAuto += baseline;
        else this.state.baseDamageClick += baseline;

        // 掉錢：以有效傷害計算，且每個目標最多只用掉 maxHp 的預算
        var paid = Combat.consumeCoinBudget(target, result.effective);
        if (paid > 0 && target.kind !== 'boss') {
            this.addCoins(paid * this.zone().coinPerDamage * this.stats.coinMult);
        }

        this.emitter.emit('damage', {
            uid: target.uid, amount: result.effective,
            crit: !!opts.crit, fromAuto: !!opts.fromAuto
        });

        if (result.killed) this._settleKill(target, now, !!opts.byClick);
        return result.effective;
    };

    /* ---------------- 手動點擊 ---------------- */

    Game.prototype.clickTarget = function (uid, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var target = this._findTarget(uid);
        if (!target) return null;

        var state = this.state;
        state.clicks++;

        // 連擊：3 秒內點擊累加，提神飲料期間不會因中斷歸零
        if (now - finite(state.lastClickAt, 0) <= BALANCE.combo.windowSeconds * 1000 || state.combo === 0) {
            state.combo = Math.min(BALANCE.combo.maxStacks, state.combo + 1);
        } else {
            state.combo = 1;
        }
        state.lastClickAt = now;
        this._trackBurst(now);
        this.refreshStats(now);

        // 菇王：長按破盾中不計傷害；杏鮑菇的點擊里程碑
        if (target.kind === 'boss') {
            var boss = Config.BOSS_BY_ID[target.typeId];
            target.clickCount = finite(target.clickCount, 0) + 1;
            if (boss.mechanic === 'clickMilestone' && target.clickCount % boss.clickMilestone === 0) {
                var reward = this.stats.clickDamage * boss.milestoneCoinMult * this.stats.coinMult;
                this.addCoins(reward);
                this.emitter.emit('bossMilestone', { bossId: boss.id, coins: reward });
            }
        }

        var crit = this.random() < this.stats.clickCritChance;
        var soften = Combat.softenMult(target, now);
        var damage = this.stats.clickDamage * soften * (crit ? this.stats.clickCritMult : 1);

        var effective = this.dealDamage(target, damage, { byClick: true, crit: crit }, now);

        // 點石成金手：只對真人點擊生效，衍生判定不計
        if (this.stats.fx.clickToCoinPct > 0 && effective > 0) {
            this.addCoins(effective * this.stats.fx.clickToCoinPct * this.stats.coinMult);
        }

        // 幻影連打：衍生傷害，不觸發自己、不計點擊數、不觸發點石成金
        if (this.stats.fx.phantomMult > 0 && !target.settled) {
            var phantom = this.stats.clickDamage * soften * this.stats.fx.phantomMult;
            this.dealDamage(target, phantom, { byClick: false, derived: true }, now);
        }

        this._checkAchievements(now);
        return { effective: effective, crit: crit, combo: state.combo };
    };

    Game.prototype._trackBurst = function (now) {
        var window = this.state.burstWindow;
        window.push(now);
        while (window.length && now - window[0] > 10000) window.shift();
        if (window.length > 400) window.splice(0, window.length - 400);
        if (window.length > this.state.burstBest) this.state.burstBest = window.length;
    };

    Game.prototype._findTarget = function (uid) {
        for (var i = 0; i < this.targets.length; i++) {
            if (this.targets[i].uid === uid && !this.targets[i].settled) return this.targets[i];
        }
        return null;
    };

    Game.prototype.aliveTargets = function () {
        return this.targets.filter(function (t) { return !t.settled && t.hp > 0; });
    };

    /* ---------------- 設備 ---------------- */

    /** 解凍：這個動作不會算成攻擊蘑菇，也不會累加連擊。 */
    Game.prototype.unfreezeDevice = function (deviceId) {
        if (!this.state.frozen[deviceId]) return false;
        delete this.state.frozen[deviceId];
        this.emitter.emit('unfreeze', { deviceId: deviceId });
        return true;
    };

    Game.prototype._fireDevice = function (device, now) {
        var state = this.state;
        var count = finite(state.devices[device.id], 0);
        if (count <= 0) return;
        var stats = this.stats;
        var info = stats.perDevice[device.id];

        if (device.role === 'support') {
            if (device.support.type === 'haste') {
                state.buffs.haste = Math.max(finite(state.buffs.haste, 0), now) + device.support.seconds * 1000;
                this.emitter.emit('haste', {});
            } else if (device.support.type === 'doubleKill') {
                state.cheerCharge = true;
                this.emitter.emit('cheer', {});
                if (stats.fx.cheerFreeAttack) this._cheerFreeAttack(now);
            }
            return;
        }
        if (device.role !== 'attack') return;

        var alive = this.aliveTargets();
        if (!alive.length) return;

        // 無情機器的基準輸出：把它自己的加成除掉
        var ruthlessMult = stats.ruthlessActive ? stats.fx.ruthless.mult : 1;

        if (device.targeting === 'all') {
            for (var i = 0; i < alive.length; i++) {
                var dmg = info.damage * count;
                this.dealDamage(alive[i], dmg, {
                    fromAuto: true, baseline: dmg / ruthlessMult
                }, now);
            }
        } else {
            var target = Combat.pickSingleTarget(alive, state.preferredUid);
            if (!target) return;
            var amount = info.damage * count;
            if (device.id === 'garlic_mech' && Combat.isSoftened(target, now)) {
                amount *= stats.fx.synGarlicSoften;
            }
            if (device.id === 'orbital_micro' && target.kind === 'boss') {
                amount *= device.bossMult;
            }
            this.dealDamage(target, amount, {
                fromAuto: true, baseline: amount / ruthlessMult
            }, now);
            if (device.applies === 'soften' && !target.settled) {
                Combat.applySoften(target, now);
                this.emitter.emit('soften', { uid: target.uid });
            }
        }
    };

    /** 啦啦隊長：只讓「可攻擊」設備追加一次，不會遞迴觸發支援設備。 */
    Game.prototype._cheerFreeAttack = function (now) {
        var self = this;
        Config.DEVICES.forEach(function (device) {
            if (device.role !== 'attack') return;
            if (self.state.frozen[device.id]) return;
            self._fireDevice(device, now);
        });
    };

    Game.prototype._stepDevices = function (now, seconds) {
        var self = this;
        var state = this.state;

        Config.DEVICES.forEach(function (device) {
            if (finite(state.devices[device.id], 0) <= 0) return;
            if (device.role === 'aura') return;
            if (state.frozen[device.id]) return;      // 冰凍：冷卻暫停倒數

            var info = self.stats.perDevice[device.id];
            var cooldown = device.role === 'support'
                ? device.cooldown / Math.max(0.0001, self.stats.speedMult)
                : info.cooldown;
            if (!(cooldown > 0)) return;

            var remaining = finite(state.deviceCooldowns[device.id], 0) - seconds;
            var guard = 0;
            while (remaining <= 0 && guard < 20) {
                guard++;
                self._fireDevice(device, now);

                // 核動力壓路：有機率立刻重置冷卻，單次攻擊鏈最多連鎖 2 次
                if (device.id === 'garlic_mech' && self.stats.fx.garlicResetChance > 0 &&
                    self.garlicChain < BALANCE.garlicResetChainLimit &&
                    self.random() < self.stats.fx.garlicResetChance) {
                    self.garlicChain++;
                    continue;
                }
                self.garlicChain = 0;
                remaining += cooldown;
            }
            state.deviceCooldowns[device.id] = Math.max(0, remaining);
        });
    };

    /* ---------------- 菇王 ---------------- */

    Game.prototype.startBoss = function (nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var zone = this.zone();
        var boss = Config.BOSS_BY_ID[zone.bossId];
        if (!boss) return false;
        if (this.state.bosses[boss.id]) return false;

        this.mode = 'boss';
        this.boss = boss;
        this.targets = [Combat.createBossTarget(boss, { now: now })];
        this.state.frozen = {};
        this.bossTimer = 0;
        this.holdStartedAt = 0;
        this.refreshStats(now);
        this.emitter.emit('bossStart', { bossId: boss.id });
        return true;
    };

    /** 退出採集：菇王血量重置，已取得的資源保留。 */
    Game.prototype.exitBoss = function (nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        if (this.mode !== 'boss') return false;
        this.mode = 'field';
        this.boss = null;
        this.targets = [];
        this.state.frozen = {};
        this.holdStartedAt = 0;
        this.refillField(now);
        this.refreshStats(now);
        this.emitter.emit('bossExit', {});
        return true;
    };

    Game.prototype.startHold = function (nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        if (this.mode !== 'boss' || !this.boss || this.boss.mechanic !== 'holdShield') return false;
        this.holdStartedAt = now;
        return true;
    };

    Game.prototype.cancelHold = function () {
        this.holdStartedAt = 0;
        return true;
    };

    Game.prototype.holdProgress = function (nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        if (!this.holdStartedAt || !this.boss || this.boss.mechanic !== 'holdShield') return 0;
        return Math.min(1, (now - this.holdStartedAt) / (this.boss.holdSeconds * 1000));
    };

    Game.prototype._stepBoss = function (now, seconds) {
        var boss = this.boss;
        if (!boss) return;
        var target = this.targets[0];
        if (!target || target.settled) return;

        if (boss.mechanic === 'holdShield' && this.holdStartedAt) {
            if (now - this.holdStartedAt >= boss.holdSeconds * 1000) {
                if (finite(target.shields, 0) > 0) {
                    target.shields -= 1;
                    this.emitter.emit('shieldBreak', { left: target.shields });
                }
                this.holdStartedAt = target.shields > 0 ? now : 0;
            }
        }

        if (boss.mechanic === 'freezeDevices') {
            this.bossTimer = finite(this.bossTimer, 0) + seconds;
            if (this.bossTimer >= boss.freezeEverySeconds) {
                this.bossTimer = 0;
                this._freezeDevices(boss);
            }
        }
    };

    Game.prototype._freezeDevices = function (boss) {
        var self = this;
        var owned = Config.DEVICES.filter(function (d) {
            return d.role !== 'aura' && finite(self.state.devices[d.id], 0) > 0;
        });
        if (!owned.length) return;
        // 平底鍋護盾：必要解謎機制只減半，不完全免疫
        var ratio = boss.freezeRatio * this.stats.fx.bossInterferenceMult;
        var count = Math.max(1, Math.round(owned.length * ratio));
        var pool = owned.slice();
        for (var i = 0; i < count && pool.length; i++) {
            var index = Math.floor(this.random() * pool.length);
            var device = pool.splice(index, 1)[0];
            this.state.frozen[device.id] = true;
        }
        this.emitter.emit('freeze', { count: count });
    };

    /* ---------------- 時間推進 ---------------- */

    Game.prototype.tick = function (nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var state = this.state;
        var delta = now - state.lastSettle;

        if (delta < 0) {                       // 系統時間倒退
            state.lastSettle = now;
            this.refreshStats(now);
            return { kind: 'rollback', coins: 0, seconds: 0 };
        }
        if (delta === 0) {
            this.refreshStats(now);
            return { kind: 'none', coins: 0, seconds: 0 };
        }

        var report;
        if (delta > BALANCE.offline.graceSeconds * 1000) {
            report = this.settleOffline(now, delta, { reason: 'offline' });
        } else {
            report = this._settleOnline(now, delta);
        }
        state.lastSettle = now;
        state.playedMs = finite(state.playedMs, 0) + Math.min(delta, BALANCE.offline.graceSeconds * 1000);
        this.refreshStats(now);
        this._checkAchievements(now);
        return report;
    };

    Game.prototype._settleOnline = function (now, delta) {
        var state = this.state;
        var remaining = delta;
        var cursor = now - delta;
        var coinsBefore = state.lifetimeCoins;

        while (remaining > 0) {
            var chunk = Math.min(STEP_MS, remaining);
            cursor += chunk;
            var seconds = chunk / 1000;

            this._expireBuffs(cursor);
            this._decayCombo(cursor);
            this.refreshStats(cursor);

            this._stepDevices(cursor, seconds);
            this._stepTargets(cursor, seconds);
            if (this.mode === 'boss') this._stepBoss(cursor, seconds);
            else this.refillField(cursor);
            this._stepCourier(cursor, seconds);
            this._trackComboHold(cursor, seconds);

            remaining -= chunk;
        }
        return { kind: 'online', coins: state.lifetimeCoins - coinsBefore, seconds: delta / 1000 };
    };

    Game.prototype._expireBuffs = function (now) {
        var buffs = this.state.buffs;
        ['energy', 'broth', 'haste'].forEach(function (key) {
            if (buffs[key] && buffs[key] <= now) buffs[key] = 0;
        });
        var cooldowns = this.state.itemCooldowns || {};
        Object.keys(cooldowns).forEach(function (key) {
            if (cooldowns[key] <= now) delete cooldowns[key];
        });
    };

    Game.prototype._decayCombo = function (now) {
        var state = this.state;
        if (state.combo <= 0) return;
        // 提神飲料期間，連擊不會因中斷而歸零
        if (state.buffs.energy > now) return;
        if (now - finite(state.lastClickAt, 0) > BALANCE.combo.windowSeconds * 1000) state.combo = 0;
    };

    Game.prototype._trackComboHold = function (now, seconds) {
        var state = this.state;
        if (state.combo >= BALANCE.combo.maxStacks) {
            if (!state.comboMaxSince) state.comboMaxSince = now;
            var held = (now - state.comboMaxSince) / 1000;
            if (held > state.comboHoldBest) state.comboHoldBest = held;
        } else {
            state.comboMaxSince = 0;
        }
    };

    Game.prototype._stepTargets = function (now, seconds) {
        var self = this;
        var zone = this.zone();
        this.targets.forEach(function (target) {
            if (target.settled || target.hp <= 0) return;
            var mushroom = Config.MUSHROOM_BY_ID[target.typeId];
            if (!mushroom) return;

            // 吸湯海綿菇：一段時間沒受傷就回血（回血不會補回掉錢預算）
            if (mushroom.traits.indexOf('regen') !== -1) {
                if (now - target.lastHitAt >= mushroom.regenIdleSeconds * 1000) {
                    target.hp = Math.min(target.maxHp,
                        target.hp + target.maxHp * mushroom.regenPerSecond * seconds);
                }
            }
            // 寶箱松露：時間到就逃走，不給擊敗獎勵
            if (target.fleeAt && now >= target.fleeAt) {
                target.settled = true;
                target.fled = true;
                self.state.flags.chestEscaped = true;
                self.emitter.emit('flee', { typeId: target.typeId, uid: target.uid });
            }
        });
        this.targets = this.targets.filter(function (t) { return !t.settled; });
    };

    Game.prototype._stepCourier = function (now, seconds) {
        var state = this.state;
        if (state.courier) {
            if (now >= state.courier.expiresAt) {
                state.courier = null;
                this._scheduleCourier(now);
            }
            return;
        }
        if (now < finite(state.nextCourierAt, 0)) return;
        state.courier = {
            expiresAt: now + BALANCE.courier.lifetimeSeconds * 1000,
            y: 0.2 + this.random() * 0.5
        };
        this.emitter.emit('courier', state.courier);
    };

    Game.prototype._scheduleCourier = function (now) {
        var span = BALANCE.courier.maxSeconds - BALANCE.courier.minSeconds;
        this.state.nextCourierAt = now + (BALANCE.courier.minSeconds + this.random() * span) * 1000;
    };

    /** 點擊外送員：掉落一個隨機消耗道具。 */
    Game.prototype.clickCourier = function (nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var state = this.state;
        if (!state.courier || now >= state.courier.expiresAt) return null;
        state.courier = null;
        this._scheduleCourier(now);

        var item = Content.ITEMS[Math.floor(this.random() * Content.ITEMS.length)] || Content.ITEMS[0];
        state.items[item.id] = finite(state.items[item.id], 0) + 1;
        this.emitter.emit('courierReward', { itemId: item.id });
        return { itemId: item.id };
    };

    /* ---------------- 離線模型 ---------------- */

    /**
     * 封閉式估算，不逐次模擬每一次攻擊。
     * 只採集目前地區的普通蘑菇，不推進菇王、不開新地區、不發稀有掉落。
     */
    Game.prototype.offlineEstimate = function (seconds, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var state = this.state;
        var zone = this.zone();
        var self = this;

        // 以「不含限時倍率」的狀態計算
        var snapshot = {
            devices: state.devices, upgrades: state.upgrades, achievements: state.achievements,
            equipped: state.equipped, lifetimeCoins: state.lifetimeCoins,
            baseDamageAuto: state.baseDamageAuto, baseDamageClick: state.baseDamageClick,
            combo: 0, buffs: { energy: 0, broth: 0, haste: 0 }, deviceCooldowns: {}, slowActive: false
        };
        var stats = Combat.computeStats(snapshot, now);
        var dps = stats.autoDps;
        if (!(dps > 0) || !(seconds > 0)) {
            return { coins: 0, kills: 0, seconds: seconds, dps: 0, estimated: true };
        }

        var pool = zone.pool.map(function (id) { return Config.MUSHROOM_BY_ID[id]; })
            .filter(function (m) { return m && (!m.zones || m.zones.indexOf(zone.id) !== -1); })
            .filter(function (m) { return m.traits.indexOf('flee') === -1 && m.traits.indexOf('jackpot') === -1; });

        var hpDepth = this.depthMult(zone.id, 'hp');
        var rewardDepth = this.depthMult(zone.id, 'reward');
        var totalWeight = 0, avgHp = 0, avgBounty = 0;
        pool.forEach(function (m) { totalWeight += self.spawnWeightOf(m); });
        pool.forEach(function (m) {
            var share = self.spawnWeightOf(m) / totalWeight;
            var cluster = m.traits.indexOf('cluster') !== -1
                ? (m.clusterMin + m.clusterMax) / 2 : 1;
            avgHp += share * m.hp * zone.hpMult * hpDepth * cluster;
            avgBounty += share * (m.bounty + stats.fx.killBountyFlat)
                * zone.coinMult * rewardDepth * cluster;
        });
        if (!(avgHp > 0)) return { coins: 0, kills: 0, seconds: seconds, dps: dps, estimated: true };

        var killsPerSecond = Math.min(dps / avgHp, BALANCE.offline.spawnCapPerSecond);
        var effectiveDps = killsPerSecond * avgHp;      // 受生成速度限制，過剩輸出不計
        var coinsPerSecond = effectiveDps * zone.coinPerDamage * stats.coinMult
            + killsPerSecond * avgBounty * stats.coinMult;

        var gain = coinsPerSecond * seconds
            * BALANCE.offline.efficiency
            * stats.fx.offlineGainMult;

        return {
            coins: gain,
            kills: killsPerSecond * seconds,
            seconds: seconds,
            dps: dps,
            estimated: true
        };
    };

    Game.prototype.offlineCapHours = function () {
        return this.stats.fx.offlineExtended
            ? BALANCE.offline.extendedHours
            : BALANCE.offline.baseHours;
    };

    Game.prototype.settleOffline = function (now, delta, opts) {
        opts = opts || {};
        var capMs = this.offlineCapHours() * 3600 * 1000;
        var countedMs = Math.min(delta, capMs);

        this._expireBuffs(now);
        this.state.combo = 0;
        this.state.courier = null;
        this._scheduleCourier(now);
        if (this.mode === 'boss') this.exitBoss(now);

        var estimate = this.offlineEstimate(countedMs / 1000, now);
        this.addCoins(estimate.coins);

        var report = {
            kind: opts.reason || 'offline',
            coins: estimate.coins,
            kills: estimate.kills,
            seconds: delta / 1000,
            countedSeconds: countedMs / 1000,
            capped: delta > capMs,
            capHours: this.offlineCapHours(),
            efficiency: BALANCE.offline.efficiency,
            estimated: true
        };
        this.emitter.emit('offline', report);
        return report;
    };

    /* ---------------- 商店 ---------------- */

    Game.prototype.deviceUnlocked = function (device) {
        var state = this.state;
        var u = device.unlock;
        switch (u.type) {
            case 'none': return true;
            case 'device': return finite(state.devices[u.deviceId], 0) >= u.count;
            case 'damage': return state.totalDamage >= u.amount;
            case 'zone': return !!state.unlockedZones[Config.ZONES[u.zoneIndex].id];
            case 'broth': return state.brothLifetime >= u.amount;
            case 'lifetimeCoins': return state.lifetimeCoins >= u.amount;
            case 'boss': return !!state.bosses[u.bossId];
            default: return false;
        }
    };

    Game.prototype.deviceUnitCost = function (device, owned) {
        var n = owned === undefined ? finite(this.state.devices[device.id], 0) : owned;
        return device.baseCost * Math.pow(BALANCE.deviceGrowth, n) * this.stats.shopDiscount;
    };

    Game.prototype.deviceBulkCost = function (device, owned, count) {
        var n = Math.floor(finite(count, 0));
        if (n <= 0) return 0;
        var g = BALANCE.deviceGrowth;
        var first = this.deviceUnitCost(device, owned);
        return first * (Math.pow(g, n) - 1) / (g - 1);
    };

    Game.prototype.deviceMaxAffordable = function (device) {
        var owned = finite(this.state.devices[device.id], 0);
        var first = this.deviceUnitCost(device, owned);
        if (!(first > 0) || this.state.coins < first) return 0;
        var g = BALANCE.deviceGrowth;
        var guess = Math.floor(Math.log(1 + this.state.coins * (g - 1) / first) / Math.log(g));
        if (!isFinite(guess) || guess < 0) guess = 0;
        guess = Math.min(guess, 10000);
        while (guess > 0 && this.deviceBulkCost(device, owned, guess) > this.state.coins + 1e-6) guess--;
        while (guess < 10000 && this.deviceBulkCost(device, owned, guess + 1) <= this.state.coins + 1e-6) guess++;
        return guess;
    };

    Game.prototype.planDevicePurchase = function (deviceId, mode) {
        var device = Config.DEVICE_BY_ID[deviceId];
        if (!device) return { count: 0, cost: 0, affordable: false };
        var owned = finite(this.state.devices[deviceId], 0);
        var count = mode === 'max' ? this.deviceMaxAffordable(device) : Math.max(1, Math.floor(finite(mode, 1)));
        if (count <= 0) return { count: 0, cost: 0, affordable: false };
        var cost = this.deviceBulkCost(device, owned, count);
        var brothCost = (owned === 0 && device.brothCost) ? device.brothCost : 0;
        return {
            count: count, cost: cost, brothCost: brothCost,
            affordable: cost <= this.state.coins + 1e-6 && brothCost <= this.state.broth
        };
    };

    Game.prototype.buyDevice = function (deviceId, mode, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var device = Config.DEVICE_BY_ID[deviceId];
        if (!device || !this.deviceUnlocked(device)) return null;
        var plan = this.planDevicePurchase(deviceId, mode);
        if (!plan.count || !plan.affordable) return null;
        if (plan.brothCost && !this.spendBroth(plan.brothCost)) return null;
        if (!this.spendCoins(plan.cost)) return null;

        this.state.devices[deviceId] = finite(this.state.devices[deviceId], 0) + plan.count;
        this.refreshStats(now);
        this._checkAchievements(now);
        this.emitter.emit('buyDevice', { deviceId: deviceId, count: plan.count, cost: plan.cost });
        return plan;
    };

    Game.prototype.meetsRequirement = function (req) {
        var state = this.state;
        if (!req) return true;
        if (req.clicks !== undefined && state.clicks < req.clicks) return false;
        if (req.damage !== undefined && state.totalDamage < req.damage) return false;
        if (req.lifetimeCoins !== undefined && state.lifetimeCoins < req.lifetimeCoins) return false;
        if (req.brothLifetime !== undefined && state.brothLifetime < req.brothLifetime) return false;
        if (req.deviceTotal !== undefined) {
            var total = 0;
            Config.DEVICES.forEach(function (d) { total += finite(state.devices[d.id], 0); });
            if (total < req.deviceTotal) return false;
        }
        if (req.device !== undefined && finite(state.devices[req.device.id], 0) < req.device.count) return false;
        if (req.devices !== undefined) {
            for (var i = 0; i < req.devices.length; i++) {
                if (finite(state.devices[req.devices[i]], 0) <= 0) return false;
            }
        }
        if (req.allDeviceTypes && Combat.ownedTypeCount(state, 1) < Config.DEVICES.length) return false;
        if (req.allTypesCount !== undefined && Combat.ownedTypeCount(state, req.allTypesCount) < Config.DEVICES.length) return false;
        if (req.boss !== undefined && !state.bosses[req.boss]) return false;
        if (req.bossesAll) {
            for (var b = 0; b < Config.BOSSES.length; b++) {
                if (!state.bosses[Config.BOSSES[b].id]) return false;
            }
        }
        if (req.achievements !== undefined && Object.keys(state.achievements).length < req.achievements) return false;
        if (req.seen !== undefined && !state.seen[req.seen]) return false;
        if (req.kills !== undefined && finite(state.kills[req.kills.id], 0) < req.kills.count) return false;
        if (req.flag !== undefined && !state.flags[req.flag]) return false;
        if (req.lazyStreak !== undefined && state.lazyStreak < req.lazyStreak) return false;
        if (req.comboHoldSeconds !== undefined && state.comboHoldBest < req.comboHoldSeconds) return false;
        if (req.burstClicks !== undefined && state.burstBest < req.burstClicks) return false;
        return true;
    };

    Game.prototype.buyUpgrade = function (upgradeId, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var upgrade = Content.UPGRADE_BY_ID[upgradeId];
        if (!upgrade || this.state.upgrades[upgradeId]) return false;
        if (upgrade.auto) return false;                        // 里程碑由菇王自動授予
        if (!this.meetsRequirement(upgrade.req)) return false;

        var cost = upgrade.cost * this.stats.shopDiscount;
        var brothCost = upgrade.brothCost || 0;
        if (this.state.broth < brothCost) return false;
        if (this.state.coins + 1e-6 < cost) return false;
        if (brothCost && !this.spendBroth(brothCost)) return false;
        if (!this.spendCoins(cost)) return false;

        this.state.upgrades[upgradeId] = true;
        this.refreshStats(now);
        this._checkAchievements(now);
        this.emitter.emit('buyUpgrade', { upgradeId: upgradeId });
        return true;
    };

    Game.prototype.itemShopOpen = function () { return !!this.state.bosses.boss_tofu; };

    Game.prototype.buyItem = function (itemId, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var item = Content.ITEM_BY_ID[itemId];
        if (!item || !this.itemShopOpen()) return false;
        var cost = item.cost * this.stats.shopDiscount;
        if (!this.spendCoins(cost)) return false;
        this.state.items[itemId] = finite(this.state.items[itemId], 0) + 1;
        this.emitter.emit('buyItem', { itemId: itemId });
        return true;
    };

    /* ---------------- 道具使用 ---------------- */

    Game.prototype.todayKey = function (nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        try {
            return new Date(now).toLocaleDateString('en-CA', { timeZone: BALANCE.whistle.timeZone });
        } catch (err) {
            return new Date(now).toISOString().slice(0, 10);
        }
    };

    Game.prototype.whistleRemaining = function (nowArg) {
        var today = this.todayKey(nowArg);
        var w = this.state.whistle || { date: '', used: 0 };
        if (w.date !== today) return BALANCE.whistle.dailyLimit;
        return Math.max(0, BALANCE.whistle.dailyLimit - w.used);
    };

    Game.prototype.useItem = function (itemId, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var item = Content.ITEM_BY_ID[itemId];
        var state = this.state;
        if (!item || finite(state.items[itemId], 0) < 1) return null;
        if (finite(state.itemCooldowns[itemId], 0) > now) return null;

        var effect = item.effect;
        var result = { itemId: itemId, kind: effect.type };

        if (effect.type === 'energy') {
            if (state.buffs.energy > now) return null;         // 期間不可重複使用
            state.buffs.energy = now + item.durationSeconds * 1000;
            result.until = state.buffs.energy;
        } else if (effect.type === 'brothCapsule') {
            if (state.buffs.broth > now) return null;          // 不可疊加
            state.buffs.broth = now + item.durationSeconds * 1000;
            result.until = state.buffs.broth;
        } else if (effect.type === 'bomb') {
            // 基準點擊傷害快照：不含暴擊、連擊與限時道具
            var snapshot = this.stats.clickBase * this.stats.globalDamage;
            var amount = snapshot * effect.clicks;
            var hit = 0;
            var alive = this.aliveTargets();
            for (var i = 0; i < alive.length; i++) {
                hit += this.dealDamage(alive[i], amount, { trueDamage: true, fromAuto: false }, now);
            }
            state.itemCooldowns[itemId] = now + item.cooldownSeconds * 1000;
            result.damage = hit;
        } else if (effect.type === 'whistle') {
            var today = this.todayKey(now);
            if (!state.whistle || state.whistle.date !== today) state.whistle = { date: today, used: 0 };
            if (state.whistle.used >= BALANCE.whistle.dailyLimit) return null;
            var estimate = this.offlineEstimate(BALANCE.whistle.hours * 3600, now);
            state.whistle.used++;
            this.addCoins(estimate.coins);
            result.coins = estimate.coins;
            result.kills = estimate.kills;
            result.remaining = this.whistleRemaining(now);
        }

        state.items[itemId] = finite(state.items[itemId], 0) - 1;
        this.refreshStats(now);
        this._checkAchievements(now);
        this.emitter.emit('useItem', result);
        return result;
    };

    /* ---------------- 裝備 ---------------- */

    Game.prototype.equip = function (equipmentId, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        if (equipmentId !== null && !this.state.equipmentOwned[equipmentId]) return false;
        this.state.equipped = equipmentId;      // 單一欄位，切換不會累加屬性
        this.refreshStats(now);
        this.emitter.emit('equip', { equipmentId: equipmentId });
        return true;
    };

    /* ---------------- 地區 ---------------- */

    Game.prototype.switchZone = function (zoneId, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        if (!this.state.unlockedZones[zoneId]) return false;
        if (this.mode === 'boss') this.exitBoss(now);
        this.state.zoneId = zoneId;
        this.targets = [];
        this.refillField(now);
        this.refreshStats(now);
        this.emitter.emit('zone', { zoneId: zoneId });
        return true;
    };

    /* ---------------- 成就 ---------------- */

    Game.prototype._checkAchievements = function (now) {
        var self = this;
        var state = this.state;
        Content.ACHIEVEMENTS.forEach(function (ach) {
            if (state.achievements[ach.id]) return;
            if (!self.meetsRequirement(ach.req)) return;
            state.achievements[ach.id] = true;
            self.emitter.emit('achievement', ach);
        });
    };

    /* ---------------- 存檔快照 ---------------- */

    Game.prototype.snapshot = function () {
        var copy = JSON.parse(JSON.stringify(this.state));
        copy.burstWindow = [];
        copy.courier = null;
        return copy;
    };

    Game.prototype.loadSnapshot = function (data, nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        var fresh = createState(now);
        var s = Object.assign(fresh, data || {});

        Config.DEVICES.forEach(function (d) {
            s.devices[d.id] = finite(s.devices[d.id], 0);
            s.deviceCooldowns[d.id] = finite(s.deviceCooldowns[d.id], 0);
        });
        Content.ITEMS.forEach(function (i) { s.items[i.id] = finite(s.items[i.id], 0); });
        s.buffs = s.buffs || { energy: 0, broth: 0, haste: 0 };
        s.itemCooldowns = s.itemCooldowns || {};
        s.flags = s.flags || {};
        s.frozen = {};
        s.combo = 0;
        s.courier = null;
        s.burstWindow = [];
        s.depths = s.depths || {};
        s.depthKills = s.depthKills || {};
        s.unlockedZones = s.unlockedZones || { zone_01: true };
        s.unlockedZones.zone_01 = true;
        if (!s.unlockedZones[s.zoneId]) s.zoneId = 'zone_01';

        this.state = s;
        this.mode = 'field';
        this.boss = null;
        this.targets = [];
        this.refreshStats(now);
        this.refillField(now);
        return this.state;
    };

    return { Game: Game, createState: createState, STEP_MS: STEP_MS };
});
