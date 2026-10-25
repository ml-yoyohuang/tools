/*!
 * 測試案例集（Node 與瀏覽器共用同一份）
 * 時間與亂數都注入固定值，結果可重現。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var deps = isNode
        ? {
            Config: require('../js/config.js'), Content: require('../js/content.js'),
            Combat: require('../js/combat.js'), GameAPI: require('../js/game.js'),
            StorageAPI: require('../js/storage.js'), ImagesAPI: require('../js/images.js'),
            Format: require('../js/format.js')
        }
        : {
            Config: root.MushConfig, Content: root.MushContent, Combat: root.MushCombat,
            GameAPI: root.MushGame, StorageAPI: root.MushStorage,
            ImagesAPI: root.MushImages, Format: root.MushFormat
        };
    var api = factory(deps);
    if (isNode) module.exports = api;
    else root.MushSuite = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    var Config = deps.Config;
    var Content = deps.Content;
    var Combat = deps.Combat;
    var GameAPI = deps.GameAPI;
    var StorageAPI = deps.StorageAPI;
    var ImagesAPI = deps.ImagesAPI;
    var Format = deps.Format;
    var BALANCE = Config.BALANCE;

    function fail(message) { var e = new Error(message); e.name = 'AssertionError'; return e; }
    function ok(value, message) { if (!value) throw fail(message || '預期為真'); }
    function equal(a, b, message) {
        if (a !== b) throw fail((message || '值不相等') + '：預期 ' + JSON.stringify(b) + '，實際 ' + JSON.stringify(a));
    }
    function near(a, b, tol, message) {
        if (!(Math.abs(a - b) <= tol)) {
            throw fail((message || '超出容許範圍') + '：預期 ' + b + ' ±' + tol + '，實際 ' + a);
        }
    }

    var T0 = 1700000000000;

    function makeGame(options) {
        options = options || {};
        var clock = { t: options.start || T0 };
        var values = options.randoms || null;
        var index = 0;
        var game = new GameAPI.Game({
            now: function () { return clock.t; },
            random: function () {
                if (values) { var v = values[index % values.length]; index++; return v; }
                return options.random !== undefined ? options.random : 0.5;
            }
        });
        game._clock = clock;
        game.advance = function (ms) { clock.t += ms; return game.tick(clock.t); };
        game.at = function () { return clock.t; };
        return game;
    }

    /** 把戰場換成指定的蘑菇，方便測單一特性。 */
    function setTarget(game, mushroomId, options) {
        options = options || {};
        var mushroom = Config.MUSHROOM_BY_ID[mushroomId];
        game.targets = [Combat.createTarget(mushroom, game.zone(), {
            now: game.at(), depthMult: options.depthMult || 1
        })];
        game.refreshStats(game.at());
        return game.targets[0];
    }

    function memoryBackend(seed) {
        var map = Object.assign({}, seed || {});
        return {
            data: map,
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
            setItem: function (k, v) { map[k] = String(v); },
            removeItem: function (k) { delete map[k]; }
        };
    }

    function fakeImageLoader(failKeys) {
        return function () {
            var image = {};
            Object.defineProperty(image, 'src', {
                set: function (value) {
                    var self = this;
                    var bad = failKeys.some(function (k) { return value.indexOf(k) !== -1; });
                    setTimeout(function () {
                        if (bad) self.onerror();
                        else { self.naturalWidth = 100; self.naturalHeight = 100; self.onload(); }
                    }, 0);
                },
                get: function () { return ''; }
            });
            return image;
        };
    }

    var tests = [];
    function test(name, fn) { tests.push({ name: name, fn: fn }); }

    /* ---------------- 1. 死亡與掉落只結算一次 ---------------- */

    test('擊敗只會結算一次，不會重複掉落', function () {
        var game = makeGame();
        var target = setTarget(game, 'sh_basic');
        var kills = 0;
        game.on('kill', function () { kills++; });

        game.dealDamage(target, 9999, { byClick: true }, game.at());
        equal(kills, 1, '應只結算一次');
        equal(target.settled, true);

        // 再打一次已死亡的目標
        var before = game.state.coins;
        game.dealDamage(target, 9999, { byClick: true }, game.at());
        equal(kills, 1, '不應重複結算');
        equal(game.state.coins, before, '不應重複掉落');
    });

    test('同時點擊與自動攻擊不會造成重複掉落', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 1000;        // 一次齊射必定超殺
        var target = setTarget(game, 'sh_basic');
        var kills = 0;
        game.on('kill', function () { kills++; });

        game.clickTarget(target.uid, game.at());     // 點擊可能先殺死
        game._fireDevice(Config.DEVICE_BY_ID.auto_tongs, game.at());
        ok(kills <= 1, '最多只應結算一次，實際 ' + kills);
    });

    test('過量傷害不計入收益', function () {
        var game = makeGame();
        var target = setTarget(game, 'sh_basic');
        var maxHp = target.maxHp;
        var before = game.state.coins;
        var effective = game.dealDamage(target, maxHp * 50, { byClick: true }, game.at());
        equal(effective, maxHp, '有效傷害應等於剩餘血量');
        var expected = maxHp * game.zone().coinPerDamage * game.stats.coinMult;
        ok(game.state.coins - before >= expected, '傷害掉錢至少要有一份');
        equal(game.state.totalDamage, maxHp, '累積傷害不應計入超殺部分');
    });

    test('回血不會補回掉錢預算（避免無限資源漏洞）', function () {
        var game = makeGame();
        game.switchZone('zone_01', game.at());
        var target = setTarget(game, 'sh_sponge');
        var zone = game.zone();

        // 打掉一半，讓它回滿，再打掉，總掉錢不應超過一條血的預算
        game.dealDamage(target, target.maxHp * 0.5, {}, game.at());
        var paidAfterFirst = target.paidDamage;
        target.hp = target.maxHp;                      // 模擬回滿血
        game.dealDamage(target, target.maxHp, {}, game.at());
        ok(target.paidDamage <= target.maxHp + 1e-6,
            '掉錢預算不應超過最大血量，實際 ' + target.paidDamage + ' / ' + target.maxHp);
        ok(target.paidDamage > paidAfterFirst, '第二次仍應有部分計入');
    });

    /* ---------------- 2. 傷害管線 ---------------- */

    test('岩殼：低於門檻的單次傷害強制變成 1', function () {
        var game = makeGame();
        var target = setTarget(game, 'sh_walnut');
        var threshold = target.armorThreshold;
        ok(threshold > 0, '核桃菇應有岩殼門檻');

        var small = Combat.applyDamage(target, threshold - 1, {});
        equal(small.effective, 1, '低於門檻應只造成 1');

        var big = Combat.applyDamage(target, threshold + 10, {});
        equal(big.effective, threshold + 10, '高於門檻應正常計算');
    });

    test('真實傷害穿透岩殼，但不穿透菇王護盾', function () {
        var game = makeGame();
        var walnut = setTarget(game, 'sh_walnut');
        var result = Combat.applyDamage(walnut, 1, { trueDamage: true });
        equal(result.effective, 1, '真實傷害不受岩殼影響（本來就是 1）');

        var half = Combat.applyDamage(walnut, walnut.armorThreshold - 1, { trueDamage: true });
        equal(half.effective, walnut.armorThreshold - 1, '真實傷害應穿透岩殼');

        var boss = Combat.createBossTarget(Config.BOSS_BY_ID.boss_tofu, { now: T0 });
        var blocked = Combat.applyDamage(boss, 1e9, { trueDamage: true });
        equal(blocked.blocked, true, '真實傷害不應穿透護盾');
        equal(blocked.effective, 0);
    });

    test('隔熱手套可以無視岩殼', function () {
        var game = makeGame();
        game.state.equipmentOwned.eq_glove = true;
        game.equip('eq_glove', game.at());
        var target = setTarget(game, 'sh_walnut');
        var before = target.hp;
        game.dealDamage(target, target.armorThreshold - 1, {}, game.at());
        near(before - target.hp, target.armorThreshold - 1, 1e-9, '應完整造成傷害');
    });

    test('軟化是點擊的獨立乘區 ×2', function () {
        var game = makeGame({ random: 0.99 });     // 不暴擊
        var target = setTarget(game, 'sh_basic');
        target.maxHp = 1e9; target.hp = 1e9;

        var before = target.hp;
        game.clickTarget(target.uid, game.at());
        var plain = before - target.hp;

        Combat.applySoften(target, game.at());
        before = target.hp;
        game.clickTarget(target.uid, game.at());
        var softened = before - target.hp;

        // 連擊層數在兩次點擊間會變動，改用乘區本身驗證
        equal(Combat.softenMult(target, game.at()), BALANCE.soften.clickMult);
        ok(softened > plain, '軟化後應造成更高傷害');
    });

    test('暴擊使用明確倍率，不是隨機抽樣', function () {
        var always = makeGame({ random: 0 });       // 一定暴擊
        always.state.upgrades.u_clk_2 = true;
        var t1 = setTarget(always, 'sh_basic');
        t1.maxHp = 1e9; t1.hp = 1e9;
        var before = t1.hp;
        var r1 = always.clickTarget(t1.uid, always.at());
        equal(r1.crit, true);
        var critDamage = before - t1.hp;

        var never = makeGame({ random: 0.99 });
        never.state.upgrades.u_clk_2 = true;
        var t2 = setTarget(never, 'sh_basic');
        t2.maxHp = 1e9; t2.hp = 1e9;
        before = t2.hp;
        var r2 = never.clickTarget(t2.uid, never.at());
        equal(r2.crit, false);
        var normal = before - t2.hp;
        near(critDamage / normal, 3, 1e-6, '暴擊應為 ×3');
    });

    test('幻影連打是衍生傷害，不會遞迴也不計點擊數', function () {
        var game = makeGame({ random: 0.99 });
        game.state.upgrades.u_clk_5 = true;
        var target = setTarget(game, 'sh_basic');
        target.maxHp = 1e9; target.hp = 1e9;

        var before = target.hp;
        var clicksBefore = game.state.clicks;
        game.clickTarget(target.uid, game.at());
        var total = before - target.hp;

        equal(game.state.clicks - clicksBefore, 1, '衍生判定不應增加點擊次數');
        var baseClick = game.stats.clickDamage;
        near(total, baseClick * 1.5, baseClick * 0.01, '應為 1 次點擊 + 1 次 50% 衍生');
    });

    test('點石成金手只對真人點擊生效', function () {
        var game = makeGame({ random: 0.99 });
        game.state.upgrades.u_clk_4 = true;
        var target = setTarget(game, 'sh_basic');
        target.maxHp = 1e9; target.hp = 1e9;

        var before = game.state.coins;
        var result = game.clickTarget(target.uid, game.at());
        var damageCoins = result.effective * game.zone().coinPerDamage * game.stats.coinMult;
        var clickCoins = result.effective * 0.01 * game.stats.coinMult;
        near(game.state.coins - before, damageCoins + clickCoins, 1e-6, '應同時有傷害掉錢與點擊轉換');
    });

    test('無情機器以不含自身加成的基準輸出判定', function () {
        var game = makeGame();
        game.state.upgrades.u_aut_5 = true;
        game.state.baseDamageAuto = 900;
        game.state.baseDamageClick = 100;
        game.refreshStats(game.at());
        equal(game.stats.ruthlessActive, true, '自動佔 90% 應生效');

        game.state.baseDamageClick = 900;
        game.refreshStats(game.at());
        equal(game.stats.ruthlessActive, false, '自動佔 50% 不應生效');
    });

    test('電磁爐力場以歷史菇幣計算，花錢不會變弱，且有上限', function () {
        var game = makeGame();
        game.state.devices.induction_field = 1;
        game.state.lifetimeCoins = 1e6;
        game.state.coins = 1e6;
        game.refreshStats(game.at());
        var before = game.stats.inductionMult;

        game.state.coins = 0;                    // 把錢花光
        game.refreshStats(game.at());
        equal(game.stats.inductionMult, before, '花錢不應降低效果');

        game.state.lifetimeCoins = 1e200;
        game.refreshStats(game.at());
        ok(game.stats.inductionMult <= BALANCE.induction.cap + 1e-9,
            '應受上限限制，實際 ' + game.stats.inductionMult);
    });

    test('速度倍率定義一致：冷卻 = 基礎冷卻 ÷ 速度倍率', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 1;
        game.refreshStats(game.at());
        var base = game.stats.perDevice.auto_tongs.cooldown;

        game.state.upgrades.u_aut_1 = true;      // 速度 ×1.1
        game.refreshStats(game.at());
        near(game.stats.perDevice.auto_tongs.cooldown, base / 1.1, 1e-9);
    });

    test('軟硬兼施：蒜泥機打軟化目標為 ×4', function () {
        var game = makeGame();
        game.state.devices.garlic_mech = 1;
        game.state.upgrades.u_syn_2 = true;
        game.refreshStats(game.at());

        var plain = setTarget(game, 'sh_basic');
        plain.maxHp = 1e12; plain.hp = 1e12;
        var before = plain.hp;
        game._fireDevice(Config.DEVICE_BY_ID.garlic_mech, game.at());
        var normal = before - plain.hp;

        Combat.applySoften(plain, game.at());
        before = plain.hp;
        game._fireDevice(Config.DEVICE_BY_ID.garlic_mech, game.at());
        var softened = before - plain.hp;
        near(softened / normal, 4, 1e-6);
    });

    /* ---------------- 3. 目標與群聚 ---------------- */

    test('金針菇以群聚出現，AOE 會打到全部', function () {
        var game = makeGame({ random: 0.99 });
        var mushroom = Config.MUSHROOM_BY_ID.sh_enoki;
        game.targets = [];
        for (var i = 0; i < 4; i++) {
            game.targets.push(Combat.createTarget(mushroom, game.zone(), { now: game.at(), clusterIndex: i }));
        }
        game.state.devices.pepper_drone = 1;
        game.refreshStats(game.at());

        var before = game.targets.map(function (t) { return t.hp; });
        game._fireDevice(Config.DEVICE_BY_ID.pepper_drone, game.at());
        game.targets.forEach(function (t, index) {
            ok(t.hp < before[index] || t.settled, '第 ' + index + ' 個目標應受到傷害');
        });
    });

    test('單體設備會打血量最高的，玩家指定的目標優先', function () {
        var game = makeGame();
        var mushroom = Config.MUSHROOM_BY_ID.sh_enoki;
        var a = Combat.createTarget(mushroom, game.zone(), { now: T0, uid: 101 });
        var b = Combat.createTarget(mushroom, game.zone(), { now: T0, uid: 102 });
        a.hp = 10; b.hp = 50;
        equal(Combat.pickSingleTarget([a, b]).uid, 102, '應選血量最高的');
        equal(Combat.pickSingleTarget([a, b], 101).uid, 101, '玩家指定的優先');
    });

    test('寶箱松露逃跑不給擊敗獎勵，也不影響主線', function () {
        var game = makeGame();
        var target = setTarget(game, 'sh_chest');
        var kills = 0, fled = 0;
        game.on('kill', function () { kills++; });
        game.on('flee', function () { fled++; });

        var coinsBefore = game.state.coins;
        game.advance(Config.MUSHROOM_BY_ID.sh_chest.fleeSeconds * 1000 + 500);
        equal(fled, 1, '應觸發逃跑');
        equal(kills, 0, '逃跑不應給擊敗獎勵');
        equal(game.state.kills.sh_chest, undefined, '不應計入擊敗數');
        equal(game.state.flags.chestEscaped, true, '應記錄成就旗標');
        ok(game.state.coins >= coinsBefore, '不應倒扣');
    });

    test('吸湯海綿菇在無人攻擊時會回血', function () {
        var game = makeGame();
        var target = setTarget(game, 'sh_sponge');
        target.hp = target.maxHp * 0.3;
        target.lastHitAt = game.at() - 5000;       // 已經 5 秒沒被打
        var before = target.hp;
        game.advance(1000);
        ok(target.hp > before, '應該回血');
        ok(target.hp <= target.maxHp + 1e-9, '不應超過最大血量');
    });

    test('冰晶雪花菇存活時，自動設備速度減半', function () {
        var game = makeGame();
        game.state.unlockedZones.zone_02 = true;
        game.state.unlockedZones.zone_03 = true;
        game.switchZone('zone_03', game.at());
        game.state.devices.auto_tongs = 1;
        game.refreshStats(game.at());
        var normal = game.stats.perDevice.auto_tongs.cooldown;

        setTarget(game, 'sh_ice');
        game.refreshStats(game.at());
        near(game.stats.perDevice.auto_tongs.cooldown, normal * 2, 1e-9, '冷卻應變兩倍');
    });

    /* ---------------- 4. 菇王 ---------------- */

    test('杏鮑菇：每 20 次真人點擊給一次里程碑獎勵', function () {
        var game = makeGame({ random: 0.99 });
        game.startBoss(game.at());
        equal(game.mode, 'boss');
        var hits = 0;
        game.on('bossMilestone', function () { hits++; });
        for (var i = 0; i < 40; i++) game.clickTarget(game.targets[0].uid, game.at());
        equal(hits, 2, '40 次點擊應觸發 2 次');
    });

    test('豆腐菇：護盾期間免疫自動攻擊，長按 2 秒破一層', function () {
        var game = makeGame();
        game.state.unlockedZones.zone_02 = true;
        game.state.bosses.boss_king = true;
        game.switchZone('zone_02', game.at());
        game.state.devices.auto_tongs = 100;
        game.startBoss(game.at());
        var target = game.targets[0];
        equal(target.shields, 3);

        var before = target.hp;
        game._fireDevice(Config.DEVICE_BY_ID.auto_tongs, game.at());
        equal(target.hp, before, '護盾期間自動攻擊應完全無效');

        game.startHold(game.at());
        game.advance(2100);
        equal(target.shields, 2, '長按 2 秒應破一層');

        game.cancelHold();
        game.advance(5000);
        equal(target.shields, 2, '取消長按後不應繼續破盾');

        game.startHold(game.at());
        game.advance(2100);
        game.advance(2100);
        equal(target.shields, 0, '連續長按應破完三層');

        before = target.hp;
        game._fireDevice(Config.DEVICE_BY_ID.auto_tongs, game.at());
        ok(target.hp < before, '破盾後自動攻擊應生效');
    });

    test('急凍菇：週期性凍結設備，解凍不算攻擊蘑菇', function () {
        var game = makeGame();
        game.state.unlockedZones.zone_03 = true;
        game.state.bosses.boss_king = true;
        game.state.bosses.boss_tofu = true;
        game.switchZone('zone_03', game.at());
        // 只給前期設備：給全套會被軌道微波砲一擊秒殺，看不到凍結機制
        ['auto_tongs', 'pepper_drone', 'garlic_mech', 'tenderizer_array'].forEach(function (id) {
            game.state.devices[id] = 5;
        });
        game.startBoss(game.at());

        game.advance(Config.BOSS_BY_ID.boss_frozen.freezeEverySeconds * 1000 + 200);
        var frozen = Object.keys(game.state.frozen);
        ok(frozen.length > 0, '應凍結部分設備');

        var clicksBefore = game.state.clicks;
        var hpBefore = game.targets[0].hp;
        equal(game.unfreezeDevice(frozen[0]), true);
        equal(game.state.clicks, clicksBefore, '解凍不應增加點擊次數');
        equal(game.targets[0].hp, hpBefore, '解凍不應造成傷害');
        equal(!!game.state.frozen[frozen[0]], false, '應已解凍');
    });

    test('冰凍的設備冷卻會暫停', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 10;
        game.refreshStats(game.at());
        game.state.frozen.auto_tongs = true;
        var target = setTarget(game, 'sh_basic');
        target.maxHp = 1e9; target.hp = 1e9;
        var before = target.hp;
        game.advance(5000);
        equal(target.hp, before, '冰凍期間不應攻擊');

        delete game.state.frozen.auto_tongs;
        game.advance(2000);
        ok(target.hp < before, '解凍後應恢復攻擊');
    });

    test('平底鍋護盾減半凍結數量，但不會完全免疫必要機制', function () {
        var game = makeGame();
        game.state.equipmentOwned.eq_pan = true;
        game.equip('eq_pan', game.at());
        game.state.unlockedZones.zone_03 = true;
        game.state.bosses.boss_king = true;
        game.state.bosses.boss_tofu = true;
        game.switchZone('zone_03', game.at());
        ['auto_tongs', 'pepper_drone', 'garlic_mech', 'tenderizer_array'].forEach(function (id) {
            game.state.devices[id] = 5;
        });
        game.startBoss(game.at());
        game.advance(Config.BOSS_BY_ID.boss_frozen.freezeEverySeconds * 1000 + 200);
        var frozen = Object.keys(game.state.frozen).length;
        ok(frozen >= 1, '必要解謎機制不應被完全免疫');
        ok(frozen <= 2, '四台設備減半後應凍結 2 台，實際 ' + frozen);
    });

    test('菇王可以退出與重新挑戰，血量重置、資源保留', function () {
        var game = makeGame();
        game.startBoss(game.at());
        game.state.devices.auto_tongs = 50;
        game.refreshStats(game.at());
        game.advance(3000);
        ok(game.targets[0].hp < game.targets[0].maxHp, '應已造成傷害');
        var coins = game.state.coins;

        game.exitBoss(game.at());
        equal(game.mode, 'field');
        ok(game.state.coins >= coins, '資源應保留');

        game.startBoss(game.at());
        equal(game.targets[0].hp, game.targets[0].maxHp, '重新挑戰時血量應重置');
    });

    test('擊敗菇王自動授予里程碑升級，不重複收費', function () {
        var game = makeGame();
        game.startBoss(game.at());
        var coinsBefore = game.state.coins;
        game.dealDamage(game.targets[0], 1e12, { byClick: true }, game.at());

        equal(game.state.bosses.boss_king, true);
        equal(game.state.upgrades.u_mil_1, true, '應自動取得學徒徽章');
        equal(game.state.unlockedZones.zone_02, true, '應解鎖第二地區');
        ok(game.state.coins > coinsBefore, '應獲得獎勵而不是被扣款');
        equal(game.state.collections.boss_king, true, '應取得收藏品');
    });

    test('擊敗第三隻菇王會開放裝備系統與微波砲', function () {
        var game = makeGame();
        game.state.bosses.boss_king = true;
        game.state.bosses.boss_tofu = true;
        game.state.unlockedZones.zone_03 = true;
        game.switchZone('zone_03', game.at());
        game.startBoss(game.at());
        game.dealDamage(game.targets[0], 1e12, { byClick: true }, game.at());

        equal(game.state.upgrades.u_mil_3, true);
        equal(Object.keys(game.state.equipmentOwned).length, Content.EQUIPMENT.length, '六件裝備都應取得');
        equal(game.deviceUnlocked(Config.DEVICE_BY_ID.orbital_micro), true, '微波砲應解鎖');
    });

    /* ---------------- 5. 設備與升級 ---------------- */

    test('八種設備的解鎖條件都可以達成', function () {
        var game = makeGame();
        Config.DEVICES.forEach(function (d) { game.state.devices[d.id] = 20; });
        game.state.totalDamage = 1e9;
        game.state.lifetimeCoins = 1e9;
        game.state.brothLifetime = 50;
        game.state.unlockedZones.zone_02 = true;
        game.state.unlockedZones.zone_03 = true;
        game.state.bosses.boss_king = true;
        game.state.bosses.boss_tofu = true;
        game.state.bosses.boss_frozen = true;
        Config.DEVICES.forEach(function (d) {
            equal(game.deviceUnlocked(d), true, d.name + ' 應可解鎖（條件：' + d.unlockText + '）');
        });
    });

    test('25 個升級的解鎖條件都可以達成', function () {
        var game = makeGame();
        Config.DEVICES.forEach(function (d) { game.state.devices[d.id] = 50; });
        game.state.clicks = 1e6;
        game.state.totalDamage = 1e12;
        game.state.lifetimeCoins = 1e12;
        game.state.brothLifetime = 100;
        game.state.broth = 100;
        game.state.seen.sh_chest = true;
        Config.BOSSES.forEach(function (b) { game.state.bosses[b.id] = true; });
        Content.ACHIEVEMENTS.slice(0, 12).forEach(function (a) { game.state.achievements[a.id] = true; });
        game.refreshStats(game.at());

        equal(Content.UPGRADES.length, 25, '應有 25 個升級');
        Content.UPGRADES.forEach(function (u) {
            equal(game.meetsRequirement(u.req), true, u.name + ' 的條件應可達成（' + u.reqText + '）');
        });
    });

    test('每個升級都真的會改變數值或狀態', function () {
        var game = makeGame();
        Config.DEVICES.forEach(function (d) { game.state.devices[d.id] = 30; });
        game.state.lifetimeCoins = 1e8;
        game.state.baseDamageAuto = 1e6;
        game.state.baseDamageClick = 1;
        Content.ACHIEVEMENTS.slice(0, 5).forEach(function (a) { game.state.achievements[a.id] = true; });
        game.refreshStats(game.at());
        var before = game.stats;

        Content.UPGRADES.forEach(function (upgrade) {
            var snapshot = Object.assign({}, game.state, { upgrades: Object.assign({}, game.state.upgrades) });
            snapshot.upgrades[upgrade.id] = true;
            var after = Combat.computeStats(snapshot, game.at());
            var fx = Combat.collectEffects(snapshot);

            var changed = after.autoDps !== before.autoDps
                || after.clickDamage !== before.clickDamage
                || after.coinMult !== before.coinMult
                || after.shopDiscount !== before.shopDiscount
                || fx.clickToCoinPct > 0 || fx.phantomMult > 0 || fx.critChance > 0
                || fx.garlicResetChance > 0 || fx.cheerFreeAttack || fx.offlineExtended
                || fx.brothChance > 0 || fx.killBountyFlat > 0 || fx.comboBoost
                || Object.keys(fx.spawnWeight).length > 0
                || fx.synGarlicSoften > 1 || fx.synPepperHaste > 1 || fx.synInductionMicro > 1
                || upgrade.effect.type === 'unlockZone' || upgrade.effect.type === 'unlockShop'
                || upgrade.effect.type === 'unlockEquipment';
            ok(changed, upgrade.name + '（' + upgrade.id + '）沒有造成任何可觀察的變化');
        });
    });

    test('啦啦隊長只讓可攻擊設備追加攻擊，不會遞迴', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 5;
        game.state.devices.cheer_timer = 1;
        game.state.upgrades.u_syn_4 = true;
        game.refreshStats(game.at());
        var target = setTarget(game, 'sh_basic');
        target.maxHp = 1e9; target.hp = 1e9;

        var cheers = 0;
        game.on('cheer', function () { cheers++; });
        var before = target.hp;
        game._fireDevice(Config.DEVICE_BY_ID.cheer_timer, game.at());
        equal(cheers, 1, '支援設備不應被自己遞迴觸發');
        ok(target.hp < before, '可攻擊設備應追加一次攻擊');
    });

    test('計時器的雙倍擊敗收益只會被一次擊敗消耗', function () {
        var game = makeGame({ random: 0.1 });
        var bounties = [];
        game.on('kill', function (e) { bounties.push(e.bounty); });

        game.state.cheerCharge = true;
        var first = setTarget(game, 'sh_basic');
        game.dealDamage(first, 1e9, {}, game.at());
        equal(game.state.cheerCharge, false, '充能應被消耗');

        // 第二隻同樣是胖胖白菇、同樣深度，只差沒有充能
        game.targets = [];
        var second = setTarget(game, 'sh_basic');
        game.dealDamage(second, 1e9, {}, game.at());

        equal(bounties.length, 2);
        near(bounties[0] / bounties[1], 2, 1e-6, '第一次應剛好是雙倍');
    });

    test('蒜泥機冷卻重置有連鎖上限，不會變成無限攻擊', function () {
        var game = makeGame({ random: 0 });        // random 永遠 0 → 一定重置
        game.state.devices.garlic_mech = 1;
        game.state.upgrades.u_aut_4 = true;
        game.refreshStats(game.at());
        var target = setTarget(game, 'sh_basic');
        target.maxHp = 1e15; target.hp = 1e15;

        var hits = 0;
        game.on('damage', function () { hits++; });
        game.state.deviceCooldowns.garlic_mech = 0;
        game._stepDevices(game.at(), 0.1);         // 剛好觸發「一次」排程攻擊
        ok(hits <= BALANCE.garlicResetChainLimit + 1,
            '單次攻擊鏈最多 ' + (BALANCE.garlicResetChainLimit + 1) + ' 次，實際 ' + hits);
    });

    /* ---------------- 6. 購買與批量 ---------------- */

    test('批量價格與逐項加總一致', function () {
        var game = makeGame();
        var device = Config.DEVICE_BY_ID.auto_tongs;
        var manual = 0;
        for (var i = 0; i < 10; i++) manual += game.deviceUnitCost(device, 3 + i);
        near(game.deviceBulkCost(device, 3, 10), manual, 1e-6);
    });

    test('單買十次等於一次十連買', function () {
        var single = makeGame();
        var bulk = makeGame();
        single.addCoins(1e6); bulk.addCoins(1e6);
        for (var i = 0; i < 10; i++) single.buyDevice('auto_tongs', 1, single.at());
        bulk.buyDevice('auto_tongs', 10, bulk.at());
        equal(single.state.devices.auto_tongs, 10);
        equal(bulk.state.devices.auto_tongs, 10);
        near(single.state.coins, bulk.state.coins, 1e-6);
    });

    test('最大購買算得剛剛好', function () {
        var game = makeGame();
        game.addCoins(50000);
        var device = Config.DEVICE_BY_ID.auto_tongs;
        var n = game.deviceMaxAffordable(device);
        ok(n > 0);
        ok(game.deviceBulkCost(device, 0, n) <= game.state.coins + 1e-6);
        ok(game.deviceBulkCost(device, 0, n + 1) > game.state.coins + 1e-6);
    });

    test('菇幣不足完全不扣款', function () {
        var game = makeGame();
        game.addCoins(10);
        equal(game.buyDevice('auto_tongs', 1, game.at()), null);
        equal(game.state.coins, 10);
        equal(game.state.devices.auto_tongs, 0);
    });

    test('快速連續購買不會造成負餘額', function () {
        var game = makeGame();
        game.addCoins(100000);
        for (var i = 0; i < 300; i++) game.buyDevice('auto_tongs', 'max', game.at());
        ok(game.state.coins >= 0, '餘額不應為負，實際 ' + game.state.coins);
    });

    test('VIP 會員卡讓所有價格 ×0.9', function () {
        var game = makeGame();
        var device = Config.DEVICE_BY_ID.auto_tongs;
        var before = game.deviceUnitCost(device, 0);
        game.state.upgrades.u_mil_4 = true;
        game.refreshStats(game.at());
        near(game.deviceUnitCost(device, 0), before * 0.9, 1e-9);
    });

    test('金湯滴扣款正確，不足時不購買', function () {
        var game = makeGame();
        game.addCoins(1e9);
        game.state.broth = 0;
        game.state.brothLifetime = 1;              // 解鎖條件看歷史
        var plan = game.planDevicePurchase('cheer_timer', 1);
        equal(plan.brothCost, 1);
        equal(plan.affordable, false, '沒有金湯滴應買不起');
        equal(game.buyDevice('cheer_timer', 1, game.at()), null);

        game.state.broth = 1;
        ok(game.buyDevice('cheer_timer', 1, game.at()), '有金湯滴應能購買');
        equal(game.state.broth, 0, '應扣掉 1 滴');

        var again = game.planDevicePurchase('cheer_timer', 1);
        equal(again.brothCost, 0, '第二台不應再收金湯滴');
    });

    test('升級不可重複購買', function () {
        var game = makeGame();
        game.addCoins(1e9);
        game.state.clicks = 1000;
        game.refreshStats(game.at());
        equal(game.buyUpgrade('u_clk_1', game.at()), true);
        var after = game.state.coins;
        equal(game.buyUpgrade('u_clk_1', game.at()), false);
        equal(game.state.coins, after, '不應重複扣款');
    });

    /* ---------------- 7. 道具 ---------------- */

    test('魔鬼椒爆彈使用基準點擊傷害快照，不吃暴擊與連擊', function () {
        var game = makeGame();
        game.state.bosses.boss_tofu = true;
        game.state.items.i_bomb = 1;
        game.state.combo = BALANCE.combo.maxStacks;
        game.state.buffs.energy = game.at() + 10000;
        game.refreshStats(game.at());

        var target = setTarget(game, 'sh_basic');
        target.maxHp = 1e12; target.hp = 1e12;
        var snapshot = game.stats.clickBase * game.stats.globalDamage;

        var result = game.useItem('i_bomb', game.at());
        near(result.damage, snapshot * 1000, 1e-6, '應為基準點擊傷害 × 1000');
        equal(game.state.clicks, 0, '不應增加點擊次數');
    });

    test('提神飲料期間不能重複使用', function () {
        var game = makeGame();
        game.state.bosses.boss_tofu = true;
        game.state.items.i_energy = 2;
        ok(game.useItem('i_energy', game.at()));
        equal(game.useItem('i_energy', game.at()), null, '期間內應無法再使用');
        equal(game.state.items.i_energy, 1, '不應被扣掉第二個');

        game.advance(16000);
        ok(game.useItem('i_energy', game.at()), '到期後應可再用');
    });

    test('金湯膠囊只放大菇幣，不放大金湯滴，也不可疊加', function () {
        var game = makeGame();
        game.state.bosses.boss_tofu = true;
        game.state.items.i_broth = 2;
        game.refreshStats(game.at());
        var before = game.stats.coinMult;
        game.useItem('i_broth', game.at());
        near(game.stats.coinMult, before * 5, 1e-9);
        equal(game.useItem('i_broth', game.at()), null, '不可疊加');

        var brothBefore = game.state.broth;
        game.addBroth(3);
        equal(game.state.broth - brothBefore, 3, '金湯滴不應被倍率影響');
    });

    test('時間快轉哨子與離線共用模型，且有每日上限', function () {
        var game = makeGame();
        game.state.bosses.boss_tofu = true;
        game.state.devices.auto_tongs = 50;
        game.refreshStats(game.at());
        game.state.items.i_time = 10;

        var estimate = game.offlineEstimate(BALANCE.whistle.hours * 3600, game.at());
        var before = game.state.coins;
        var nextCourier = game.state.nextCourierAt;
        var result = game.useItem('i_time', game.at());
        near(result.coins, estimate.coins, Math.max(1, estimate.coins * 1e-9), '應與離線模型一致');
        near(game.state.coins - before, estimate.coins, Math.max(1, estimate.coins * 1e-9));
        equal(game.state.nextCourierAt, nextCourier, '不應推進事件計時器');
        equal(game.state.golden, undefined, '不應生成事件');

        for (var i = 0; i < BALANCE.whistle.dailyLimit - 1; i++) game.useItem('i_time', game.at());
        equal(game.whistleRemaining(game.at()), 0);
        equal(game.useItem('i_time', game.at()), null, '超過每日上限應被拒絕');
        equal(game.state.items.i_time, 10 - BALANCE.whistle.dailyLimit, '被拒絕時不應扣道具');
    });

    test('哨子不套用限時倍率、不重置設備冷卻', function () {
        var game = makeGame();
        game.state.bosses.boss_tofu = true;
        game.state.devices.auto_tongs = 50;
        game.state.items.i_time = 1;
        game.state.items.i_broth = 1;
        game.useItem('i_broth', game.at());          // 菇幣 ×5
        game.refreshStats(game.at());

        var plain = game.offlineEstimate(BALANCE.whistle.hours * 3600, game.at());
        game.state.deviceCooldowns.auto_tongs = 0.7;
        var before = game.state.coins;
        game.useItem('i_time', game.at());
        near(game.state.coins - before, plain.coins, Math.max(1, plain.coins * 1e-9),
            '哨子收益不應被金湯膠囊放大');
        equal(game.state.deviceCooldowns.auto_tongs, 0.7, '不應重置設備冷卻');
    });

    test('道具扣除與冷卻經過存檔往返仍正確', function () {
        var game = makeGame();
        game.state.bosses.boss_tofu = true;
        game.state.items.i_energy = 3;
        game.useItem('i_energy', game.at());
        var snapshot = game.snapshot();

        var restored = makeGame();
        restored.loadSnapshot(snapshot, game.at());
        equal(restored.state.items.i_energy, 2);
        ok(restored.state.buffs.energy > game.at(), '限時效果應保留');
    });

    test('道具商店在擊敗第二區菇王前不開放', function () {
        var game = makeGame();
        game.addCoins(1e9);
        equal(game.itemShopOpen(), false);
        equal(game.buyItem('i_bomb', game.at()), false);
        game.state.bosses.boss_tofu = true;
        equal(game.itemShopOpen(), true);
        equal(game.buyItem('i_bomb', game.at()), true);
    });

    /* ---------------- 8. 裝備 ---------------- */

    test('裝備切換不會累加屬性', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 10;
        Content.EQUIPMENT.forEach(function (e) { game.state.equipmentOwned[e.id] = true; });
        game.refreshStats(game.at());
        var base = game.stats.perDevice.auto_tongs.damage;

        game.equip('eq_hat', game.at());
        near(game.stats.perDevice.auto_tongs.damage, base * 1.3, 1e-9);

        game.equip('eq_apron', game.at());
        near(game.stats.perDevice.auto_tongs.damage, base, 1e-9, '換下高帽後加成應消失');
        near(game.stats.clickCritChance, 0.1, 1e-9, '圍裙的暴擊率應生效');

        game.equip('eq_hat', game.at());
        near(game.stats.perDevice.auto_tongs.damage, base * 1.3, 1e-9, '換回來不應變成 ×1.69');
    });

    test('未取得的裝備不能裝上', function () {
        var game = makeGame();
        equal(game.equip('eq_hat', game.at()), false);
        equal(game.state.equipped, null);
    });

    /* ---------------- 9. 離線與時間 ---------------- */

    test('短暫離開以正常模式結算', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 20;
        game.refreshStats(game.at());
        var report = game.advance(30000);
        equal(report.kind, 'online');
        ok(report.coins > 0);
    });

    test('離線超過寬限時間會用離線模型，且標示為估算', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 50;
        game.refreshStats(game.at());
        var report = game.advance(3600 * 1000);
        equal(report.kind, 'offline');
        equal(report.estimated, true);
        ok(report.coins > 0);
        near(report.countedSeconds, 3600, 1e-6);
        equal(report.capped, false);
    });

    test('離線有 4 小時上限，買了複合利息變 12 小時', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 50;
        game.refreshStats(game.at());
        var report = game.advance(24 * 3600 * 1000);
        equal(report.capped, true);
        near(report.countedSeconds, 4 * 3600, 1e-6);

        var extended = makeGame();
        extended.state.devices.auto_tongs = 50;
        extended.state.upgrades.u_eco_3 = true;
        extended.refreshStats(extended.at());
        var report2 = extended.advance(24 * 3600 * 1000);
        near(report2.countedSeconds, 12 * 3600, 1e-6);
    });

    test('離線不計入限時倍率', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 50;
        game.refreshStats(game.at());
        var plain = game.offlineEstimate(3600, game.at());

        game.state.buffs.broth = game.at() + 60000;      // 菇幣 ×5
        game.refreshStats(game.at());
        var report = game.advance(3600 * 1000);
        near(report.coins, plain.coins, Math.max(1, plain.coins * 1e-6), '不應被限時倍率放大');
    });

    test('離線不推進菇王、不開新地區、不生成事件', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 50;
        game.startBoss(game.at());
        equal(game.mode, 'boss');
        game.advance(5 * 3600 * 1000);
        equal(game.mode, 'field', '離線應自動退出菇王');
        equal(game.state.bosses.boss_king, undefined, '不應擊敗菇王');
        equal(Object.keys(game.state.unlockedZones).length, 1, '不應開新地區');
        equal(game.state.courier, null, '不應留下可點擊事件');
    });

    test('同一段時間不會被結算兩次', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 50;
        game.refreshStats(game.at());
        game.advance(20000);
        var after = game.state.coins;
        game.tick(game.at());
        game.tick(game.at());
        equal(game.state.coins, after, '重複呼叫不應再給收益');
    });

    test('系統時間倒退不會給負收益', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 50;
        game.refreshStats(game.at());
        game.advance(5000);
        var after = game.state.coins;
        var report = game.tick(game.at() - 3600 * 1000);
        equal(report.kind, 'rollback');
        equal(game.state.coins, after, '餘額不應減少');
    });

    test('離線模型不會逐次模擬，超長間隔也能即時算完', function () {
        var game = makeGame();
        game.state.devices.auto_tongs = 100000;
        game.refreshStats(game.at());
        var start = Date.now();
        var report = game.advance(365 * 24 * 3600 * 1000);   // 一年
        var elapsed = Date.now() - start;
        ok(elapsed < 500, '應在數毫秒內算完，實際 ' + elapsed + 'ms');
        ok(isFinite(report.coins), '結果應為有限數');
        equal(report.capped, true);
    });

    /* ---------------- 10. 成就 ---------------- */

    test('成就只會解鎖一次', function () {
        var game = makeGame();
        var unlocked = 0;
        game.on('achievement', function (a) { if (a.id === 'ach_rich') unlocked++; });
        game.addCoins(2000000);
        game._checkAchievements(game.at());
        game._checkAchievements(game.at());
        equal(unlocked, 1, '不應重複觸發');
        equal(game.state.achievements.ach_rich, true);
    });

    test('20 個以上的成就，條件都可驗證', function () {
        ok(Content.ACHIEVEMENTS.length >= 20, '至少 20 個，實際 ' + Content.ACHIEVEMENTS.length);
        var game = makeGame();
        Config.DEVICES.forEach(function (d) { game.state.devices[d.id] = 100; });
        Config.MUSHROOMS.forEach(function (m) { game.state.kills[m.id] = 999; });
        Config.BOSSES.forEach(function (b) { game.state.bosses[b.id] = true; });
        game.state.lifetimeCoins = 1e9;
        game.state.brothLifetime = 10;
        game.state.lazyStreak = 999;
        game.state.comboHoldBest = 999;
        game.state.burstBest = 999;
        game.state.flags.coldWin = true;
        game.state.flags.chestEscaped = true;
        Content.ACHIEVEMENTS.forEach(function (a) {
            equal(game.meetsRequirement(a.req), true, a.name + ' 的條件應可達成');
        });
    });

    test('不手動點擊的連續擊敗會累積，點擊會重置', function () {
        var game = makeGame({ random: 0.99 });
        var target = setTarget(game, 'sh_basic');
        game.dealDamage(target, 1e9, { byClick: false }, game.at());
        equal(game.state.lazyStreak, 1);

        game.targets = [];
        var next = setTarget(game, 'sh_basic');
        game.dealDamage(next, 1e9, { byClick: true }, game.at());
        equal(game.state.lazyStreak, 0, '手動擊敗應重置');
    });

    /* ---------------- 11. 存檔 ---------------- */

    test('存檔往返完整保留進度', function () {
        var backend = memoryBackend();
        var storage = new StorageAPI.Storage({ backend: backend, now: function () { return T0; } });
        var game = makeGame();
        game.addCoins(123456);
        game.addBroth(7);
        game.state.devices.auto_tongs = 12;
        game.state.upgrades.u_clk_1 = true;
        game.state.depths.zone_01 = 5;

        ok(storage.save(game.snapshot()));
        var loaded = storage.load();
        equal(loaded.status, 'ok');

        var restored = makeGame();
        restored.loadSnapshot(loaded.state, game.at());
        equal(restored.state.devices.auto_tongs, 12);
        equal(restored.state.upgrades.u_clk_1, true);
        equal(restored.state.broth, 7);
        equal(restored.depthOf('zone_01'), 5);
        near(restored.state.coins, game.state.coins, 1e-6);
    });

    test('損壞存檔與不合理數值會被拒絕', function () {
        var backend = memoryBackend();
        backend.setItem(StorageAPI.KEYS.save, '{壞掉的 JSON');
        var storage = new StorageAPI.Storage({ backend: backend });
        equal(storage.load().status, 'corrupt');

        var cases = [
            [{ coins: -1, lifetimeCoins: 10, devices: {} }, 'number:coins'],
            [{ coins: 10, lifetimeCoins: 1, devices: {} }, 'inconsistent'],
            [{ coins: 1, lifetimeCoins: 1 }, 'devices'],
            [{ coins: 1, lifetimeCoins: 1, devices: { auto_tongs: -5 } }, 'device:auto_tongs'],
            [{ coins: 1, lifetimeCoins: 1, devices: { auto_tongs: 1.5 } }, 'device:auto_tongs'],
            [{ coins: 1, lifetimeCoins: 1, devices: {}, items: { i_bomb: -2 } }, 'item:i_bomb'],
            ['字串', 'shape'], [null, 'shape']
        ];
        cases.forEach(function (pair) {
            var result = StorageAPI.validateState(pair[0]);
            equal(result.ok, false, '應拒絕 ' + JSON.stringify(pair[0]).slice(0, 40));
            equal(result.reason, pair[1]);
        });
    });

    test('未知 ID 會被忽略而不是整份拒絕', function () {
        var result = StorageAPI.validateState({
            coins: 10, lifetimeCoins: 10, devices: {},
            upgrades: { u_clk_1: true, notReal: true },
            equipped: 'eq_fake'
        });
        equal(result.ok, true);
        equal(result.state.upgrades.u_clk_1, true);
        equal(result.state.upgrades.notReal, undefined);
        equal(result.state.equipped, null, '不存在的裝備應被清掉');
    });

    test('版本遷移：v1 存檔補上金湯滴歷史與裝備擁有紀錄', function () {
        var old = {
            v: 1,
            state: {
                coins: 100, lifetimeCoins: 100, broth: 4, devices: {},
                bosses: { boss_king: true, boss_tofu: true, boss_frozen: true }
            }
        };
        var step = StorageAPI.migrate(old);
        equal(step.migrated, true);
        equal(step.data.brothLifetime, 4);
        equal(Object.keys(step.data.equipmentOwned).length, Content.EQUIPMENT.length,
            '已打完第三隻菇王的舊存檔應補上裝備');
        equal(StorageAPI.validateState(step.data).ok, true);
    });

    test('比目前更新的版本會被拒絕', function () {
        var step = StorageAPI.migrate({ v: 999, state: { coins: 1, lifetimeCoins: 1, devices: {} } });
        equal(step.tooNew, true);
        equal(step.data, null);
    });

    test('匯出與匯入可以往返，失敗不覆寫原存檔', function () {
        var backend = memoryBackend();
        var storage = new StorageAPI.Storage({ backend: backend, now: function () { return T0; } });
        var game = makeGame();
        game.addCoins(5555);
        game.state.devices.pepper_drone = 4;
        storage.save(game.snapshot());
        var original = backend.getItem(StorageAPI.KEYS.save);

        var text = storage.exportText(game.snapshot());
        ok(text.indexOf('MUSH1:') === 0);
        var parsed = storage.parseImport(text);
        equal(parsed.ok, true);
        equal(parsed.state.devices.pepper_drone, 4);

        ['', '亂碼', 'MUSH1:###', '{"v":1}'].forEach(function (bad) {
            equal(storage.parseImport(bad).ok, false, '應拒絕：' + bad);
        });
        equal(backend.getItem(StorageAPI.KEYS.save), original, '原存檔不應被動到');
    });

    test('備份可以建立與還原', function () {
        var backend = memoryBackend();
        var storage = new StorageAPI.Storage({ backend: backend, now: function () { return T0; } });
        var game = makeGame();
        game.addCoins(777);
        storage.save(game.snapshot());
        equal(storage.backup(), true);

        game.addCoins(100000);
        storage.save(game.snapshot());
        var backup = storage.loadBackup();
        equal(backup.status, 'ok');
        near(backup.state.coins, 777, 1e-6, '備份應是較早的版本');
    });

    test('儲存不可用時遊戲仍能運作', function () {
        var throwing = {
            getItem: function () { throw new Error('blocked'); },
            setItem: function () { throw new Error('blocked'); },
            removeItem: function () { throw new Error('blocked'); }
        };
        var storage = new StorageAPI.Storage({ backend: throwing });
        equal(storage.load().status, 'none');
        equal(storage.save({ coins: 1 }), false);
        equal(storage.writeFailed, true);

        var game = makeGame();
        var target = setTarget(game, 'sh_basic');
        game.clickTarget(target.uid, game.at());
        ok(game.state.clicks === 1, '沒有存檔也能照常遊玩');
    });

    /* ---------------- 12. 多分頁 ---------------- */

    test('只有一個分頁能取得主控權，過期後可安全接管', function () {
        var backend = memoryBackend();
        var clock = { t: T0 };
        var now = function () { return clock.t; };
        var a = new StorageAPI.Storage({ backend: backend, now: now, tabId: 'A' });
        var b = new StorageAPI.Storage({ backend: backend, now: now, tabId: 'B' });

        equal(a.claimLock(clock.t), true);
        equal(b.claimLock(clock.t), false);
        clock.t += BALANCE.tab.staleMs + 1000;
        equal(b.claimLock(clock.t), true, '過期後 B 應能接管');
        equal(a.claimLock(clock.t), false, 'A 回來後變成唯讀');

        b.releaseLock();
        equal(a.claimLock(clock.t), true, '釋放後可立即接管');
    });

    /* ---------------- 13. 大數值與圖片 ---------------- */

    test('極端數值不會變成 NaN 或 Infinity', function () {
        var game = makeGame();
        Config.DEVICES.forEach(function (d) { game.state.devices[d.id] = 100000; });
        Content.UPGRADES.forEach(function (u) { game.state.upgrades[u.id] = true; });
        game.state.lifetimeCoins = 1e200;
        game.refreshStats(game.at());
        ok(isFinite(game.stats.autoDps), 'autoDps 應為有限數');
        ok(isFinite(game.stats.clickDamage), 'clickDamage 應為有限數');
        game.advance(1000);
        ok(isFinite(game.state.coins) && !isNaN(game.state.coins));
        var text = Format.short(game.state.coins);
        ok(text.indexOf('NaN') === -1 && text.indexOf('Infinity') === -1, '顯示文字：' + text);
    });

    test('圖片載入失敗會回報並走降級', function () {
        var store = new ImagesAPI.ImageStore({
            sources: [{ key: 'm:sh_basic', src: 'assets/mush-01.svg' }, { key: 'd:auto_tongs', src: 'assets/device-01.svg' }],
            createImage: fakeImageLoader(['device-01'])
        });
        return new Promise(function (resolve, reject) {
            store.loadAll(function (summary) {
                try {
                    equal(summary.failed.length, 1);
                    equal(summary.failed[0], 'd:auto_tongs');
                    equal(store.get('d:auto_tongs'), null);
                    ok(store.get('m:sh_basic'));
                    resolve();
                } catch (err) { reject(err); }
            });
        });
    });

    test('圖片全部失敗時遊戲照常運作', function () {
        var store = new ImagesAPI.ImageStore({
            sources: [{ key: 'a', src: 'a.svg' }, { key: 'b', src: 'b.svg' }],
            createImage: fakeImageLoader(['a.svg', 'b.svg'])
        });
        return new Promise(function (resolve, reject) {
            store.loadAll(function (summary) {
                try {
                    equal(summary.allFailed, true);
                    var game = makeGame();
                    var target = setTarget(game, 'sh_basic');
                    game.clickTarget(target.uid, game.at());
                    game.addCoins(1000);
                    ok(game.buyDevice('auto_tongs', 1, game.at()), '圖片全失敗也要能購買');
                    resolve();
                } catch (err) { reject(err); }
            });
        });
    });

    /* ---------------- 14. 內容一致性 ---------------- */

    test('內容數量符合第一版範圍', function () {
        equal(Config.ZONES.length, 3, '三個地區');
        equal(Config.BOSSES.length, 3, '三隻菇王');
        equal(Config.DEVICES.length, 8, '八種設備');
        equal(Content.UPGRADES.length, 25, '二十五個升級');
        equal(Content.ITEMS.length, 4, '四種道具');
        equal(Content.EQUIPMENT.length, 6, '六件裝備');
        ok(Content.ACHIEVEMENTS.length >= 20, '至少二十個成就');
        equal(Config.MUSHROOMS.length, 7, '七種蘑菇');
    });

    test('每個設備與蘑菇都有圖片、文案與合理數值', function () {
        var lastCost = 0;
        Config.DEVICES.forEach(function (d) {
            ok(d.name && d.flavor && d.unlockText, d.id + ' 缺少文案');
            ok(d.image, d.id + ' 缺少圖片');
            ok(d.baseCost > lastCost, d.id + ' 價格應遞增');
            lastCost = d.baseCost;
            ok(['attack', 'support', 'aura'].indexOf(d.role) !== -1, d.id + ' 角色無效');
        });
        Config.MUSHROOMS.forEach(function (m) {
            ok(m.name && m.dex, m.id + ' 缺少文案');
            ok(m.image, m.id + ' 缺少圖片');
            ok(m.hp > 0 && m.bounty > 0, m.id + ' 數值不合理');
        });
    });

    test('開局 30～60 秒內能買到第一支烤肉夾（每秒 2 下）', function () {
        var game = makeGame({ random: 0.1 });   // 固定抽到胖胖白菇，排除稀有菇的干擾
        var seconds = 0;
        while (seconds < 120 && game.state.devices.auto_tongs === 0) {
            for (var i = 0; i < 2; i++) {
                var alive = game.aliveTargets();
                if (alive.length) game.clickTarget(alive[0].uid, game.at());
            }
            game._clock.t += 1000;
            game.tick(game._clock.t);
            game.buyDevice('auto_tongs', 1, game.at());
            seconds++;
        }
        equal(game.state.devices.auto_tongs, 1, '應買到第一支，實際花了 ' + seconds + ' 秒');
        ok(seconds >= 25 && seconds <= 70, '時間應落在 30～60 秒附近，實際 ' + seconds + ' 秒');
    });

    test('重新開始（載入新存檔）不會殘留戰場或冰凍狀態', function () {
        var game = makeGame();
        game.state.frozen.auto_tongs = true;
        game.startBoss(game.at());
        var fresh = GameAPI.createState(game.at());
        game.loadSnapshot(fresh, game.at());
        equal(game.mode, 'field');
        equal(game.boss, null);
        equal(Object.keys(game.state.frozen).length, 0);
        equal(game.state.combo, 0);
        ok(game.targets.length > 0, '應重新生成戰場');
    });

    return { tests: tests, helpers: { makeGame: makeGame, setTarget: setTarget, memoryBackend: memoryBackend } };
});
