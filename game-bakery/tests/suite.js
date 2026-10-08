/*!
 * 測試案例集（Node 與瀏覽器共用同一份）
 * 時間與亂數都注入固定值，結果可重現。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var deps = isNode
        ? {
            Config: require('../js/config.js'),
            Content: require('../js/content.js'),
            Economy: require('../js/economy.js'),
            GameAPI: require('../js/game.js'),
            StorageAPI: require('../js/storage.js'),
            ImagesAPI: require('../js/images.js'),
            Format: require('../js/format.js')
        }
        : {
            Config: root.BakeryConfig, Content: root.BakeryContent, Economy: root.BakeryEconomy,
            GameAPI: root.BakeryGame, StorageAPI: root.BakeryStorage,
            ImagesAPI: root.BakeryImages, Format: root.BakeryFormat
        };
    var api = factory(deps);
    if (isNode) module.exports = api;
    else root.BakerySuite = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    var Config = deps.Config;
    var Content = deps.Content;
    var Economy = deps.Economy;
    var GameAPI = deps.GameAPI;
    var StorageAPI = deps.StorageAPI;
    var ImagesAPI = deps.ImagesAPI;
    var Format = deps.Format;

    /* ---------------- 斷言 ---------------- */

    function fail(message) {
        var err = new Error(message);
        err.name = 'AssertionError';
        return err;
    }
    function ok(value, message) { if (!value) throw fail(message || '預期為真'); }
    function equal(a, b, message) {
        if (a !== b) throw fail((message || '值不相等') + '：預期 ' + JSON.stringify(b) + '，實際 ' + JSON.stringify(a));
    }
    function near(a, b, tol, message) {
        if (!(Math.abs(a - b) <= tol)) {
            throw fail((message || '數值超出容許範圍') + '：預期 ' + b + ' ±' + tol + '，實際 ' + a);
        }
    }

    /* ---------------- 工具 ---------------- */

    var T0 = 1700000000000;

    function makeGame(options) {
        options = options || {};
        var clock = { t: options.start || T0 };
        var randomValues = options.randoms || null;
        var index = 0;
        var game = new GameAPI.Game({
            now: function () { return clock.t; },
            random: function () {
                if (randomValues) {
                    var v = randomValues[index % randomValues.length];
                    index++;
                    return v;
                }
                return options.random !== undefined ? options.random : 0.5;
            }
        });
        game._clock = clock;
        game.advance = function (ms) { clock.t += ms; return game.tick(clock.t); };
        game.at = function () { return clock.t; };
        return game;
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
                    var shouldFail = failKeys.some(function (k) { return value.indexOf(k) !== -1; });
                    setTimeout(function () {
                        if (shouldFail) self.onerror();
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

    /* ---------------- 1. 點擊與自動生產 ---------------- */

    test('點擊收益正確，初始每次 1 塊', function () {
        var game = makeGame();
        equal(game.stats.clickValue, 1);
        var result = game.click(game.at());
        equal(result.gain, 1);
        equal(game.state.cookies, 1);
        equal(game.state.baked, 1);
        equal(game.state.clicks, 1);
    });

    test('自動生產依實際經過時間結算', function () {
        var game = makeGame();
        game.state.buildings.clicker = 10;           // 每秒 3 塊
        game.refreshStats(game.at());
        near(game.stats.cps, 3, 1e-9);

        game.advance(1000);
        near(game.state.cookies, 3, 1e-6, '1 秒應產出 3 塊');
        game.advance(2500);
        near(game.state.cookies, 10.5, 1e-6, '再 2.5 秒應累積到 10.5 塊');
    });

    test('計時器不準時也不會多算或少算', function () {
        var a = makeGame();
        var b = makeGame();
        a.state.buildings.granny = 5;
        b.state.buildings.granny = 5;
        a.refreshStats(a.at());
        b.refreshStats(b.at());

        a.advance(10000);                             // 一次 10 秒
        for (var i = 0; i < 100; i++) b.advance(100); // 分成 100 次
        near(a.state.cookies, b.state.cookies, 1e-6, '總量應相同');
    });

    test('花費不會讓累積製作量下降', function () {
        var game = makeGame();
        game.addCookies(1000);
        equal(game.state.baked, 1000);
        game.buyBuilding('clicker', 1, game.at());
        ok(game.state.cookies < 1000, '餘額應減少');
        equal(game.state.baked, 1000, '累積製作量不應下降');
        equal(game.state.bakedAllTime, 1000);
    });

    /* ---------------- 2. 價格與批量 ---------------- */

    test('價格成長公式與逐項加總一致', function () {
        var b = Config.BUILDING_BY_ID.granny;
        var manual = 0;
        for (var i = 0; i < 10; i++) manual += Economy.unitCost(b, 3 + i, 0);
        near(Economy.bulkCost(b, 3, 10, 0), manual, 1e-6, '十連買價格');
    });

    test('單買十次的總價等於一次十連買', function () {
        var single = makeGame();
        var bulk = makeGame();
        single.addCookies(1e6);
        bulk.addCookies(1e6);
        for (var i = 0; i < 10; i++) single.buyBuilding('clicker', 1, single.at());
        bulk.buyBuilding('clicker', 10, bulk.at());
        equal(single.state.buildings.clicker, 10);
        equal(bulk.state.buildings.clicker, 10);
        near(single.state.cookies, bulk.state.cookies, 1e-6, '花費應相同');
    });

    test('最大購買數量正確，且買完剩下的錢不足再買一個', function () {
        var b = Config.BUILDING_BY_ID.clicker;
        var money = 12345;
        var n = Economy.maxAffordable(b, 0, money, 0);
        ok(n > 0, '應該買得起一些');
        ok(Economy.bulkCost(b, 0, n, 0) <= money + Economy.EPS, '總價不應超過餘額');
        ok(Economy.bulkCost(b, 0, n + 1, 0) > money + Economy.EPS, '多買一個就應該不夠');
    });

    test('折扣只影響結帳金額，不改變數量與價格成長進度', function () {
        var b = Config.BUILDING_BY_ID.oven;
        near(Economy.bulkCost(b, 5, 7, 0.2), Economy.bulkCost(b, 5, 7, 0) * 0.8, 1e-6, '八折');

        var game = makeGame();
        game.addCookies(1e9);
        game.useItem('discount', game.at());          // 先給自己一張
        game.state.items.discount = 1;
        game.useItem('discount', game.at());
        var before = game.state.buildings.oven;
        game.buyBuilding('oven', 5, game.at());
        equal(game.state.buildings.oven, before + 5, '買到的數量不受折扣影響');
        // 折扣結束後，下一個的原價仍由數量決定
        var expected = Economy.unitCost(b, before + 5, 0);
        near(Economy.unitCost(b, game.state.buildings.oven, 0), expected, 1e-6, '價格成長進度不受折扣影響');
    });

    test('最大購買在折扣下會算出更多數量', function () {
        var b = Config.BUILDING_BY_ID.clicker;
        var plain = Economy.maxAffordable(b, 0, 100000, 0);
        var discounted = Economy.maxAffordable(b, 0, 100000, 0.2);
        ok(discounted > plain, '打折後應該買得更多，' + discounted + ' vs ' + plain);
    });

    /* ---------------- 3. 餘額與重複購買保護 ---------------- */

    test('餘額不足完全不扣款', function () {
        var game = makeGame();
        game.addCookies(10);
        var result = game.buyBuilding('clicker', 1, game.at());
        equal(result, null, '買不起應回傳 null');
        equal(game.state.cookies, 10, '餘額不應變動');
        equal(game.state.buildings.clicker, 0);
    });

    test('快速連續購買不會造成負餘額', function () {
        var game = makeGame();
        game.addCookies(1000);
        for (var i = 0; i < 200; i++) game.buyBuilding('clicker', 'max', game.at());
        ok(game.state.cookies >= 0, '餘額不應為負，實際 ' + game.state.cookies);
        ok(game.state.buildings.clicker > 0);
    });

    test('切換購買模式不會重複購買或超扣', function () {
        var game = makeGame();
        game.addCookies(50000);
        var modes = [1, 10, 'max', 10, 1];
        modes.forEach(function (mode) { game.buyBuilding('clicker', mode, game.at()); });
        ok(game.state.cookies >= 0);
        var expected = Economy.bulkCost(Config.BUILDING_BY_ID.clicker, 0, game.state.buildings.clicker, 0);
        near(50000 - game.state.cookies, expected, 1e-6, '總花費應等於買到數量的總價');
    });

    test('升級不可重複購買、也不會重複扣款', function () {
        var game = makeGame();
        game.addCookies(1e6);
        game.state.clicks = 100;
        var before = game.state.cookies;
        equal(game.buyUpgrade('butterGlove', game.at()), true);
        var after = game.state.cookies;
        near(before - after, Content.UPGRADE_BY_ID.butterGlove.cost, 1e-6);

        equal(game.buyUpgrade('butterGlove', game.at()), false, '第二次應被拒絕');
        equal(game.state.cookies, after, '不應再扣款');
    });

    test('條件未達成不能購買升級', function () {
        var game = makeGame();
        game.addCookies(1e9);
        equal(game.state.clicks, 0);
        equal(game.buyUpgrade('butterGlove', game.at()), false, '點擊數不足應拒絕');
        equal(game.state.cookies, 1e9, '不應扣款');
    });

    /* ---------------- 4. 加成順序與搭配 ---------------- */

    test('設備倍率相乘、搭配加成相加', function () {
        var game = makeGame();
        game.state.buildings.granny = 10;
        game.refreshStats(game.at());
        var base = game.stats.perBuilding.granny.each;
        near(base, Config.BUILDING_BY_ID.granny.baseCps, 1e-9);

        game.state.upgrades.grannyRecipe = true;      // ×2
        game.refreshStats(game.at());
        near(game.stats.perBuilding.granny.each, base * 2, 1e-9, '乘法升級');

        game.state.buildings.granny = 25;             // 設定表里程碑 ×1.1
        game.refreshStats(game.at());
        near(game.stats.perBuilding.granny.each, base * 2 * 1.1, 1e-9, '里程碑相乘');
    });

    test('搭配加成讀設備數量，不會循環引用', function () {
        var game = makeGame();
        game.state.buildings.granny = 30;
        game.state.buildings.oven = 10;
        game.state.upgrades.grannyUnion = true;       // 每個阿嬤讓烤箱 +1%
        game.refreshStats(game.at());
        var expected = Config.BUILDING_BY_ID.oven.baseCps * (1 + 30 * 0.01);
        near(game.stats.perBuilding.oven.each, expected, 1e-9);

        // 讓阿嬤自己也變強，烤箱的加成不應跟著改變（因為只讀數量）
        game.state.upgrades.grannyRecipe = true;
        game.refreshStats(game.at());
        near(game.stats.perBuilding.oven.each, expected, 1e-9, '搭配不應受對方產量影響');
    });

    test('全局倍率套用在所有設備之後', function () {
        var game = makeGame();
        game.state.buildings.clicker = 10;
        game.refreshStats(game.at());
        var before = game.stats.baseCps;
        game.state.upgrades.vanilla = true;           // +10%
        game.refreshStats(game.at());
        near(game.stats.baseCps, before * 1.1, 1e-9);
    });

    test('千層壓模以「未含限時效果」的產量計算點擊收益', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;
        game.state.upgrades.layerPress = true;        // 1% of baseCps
        game.refreshStats(game.at());
        var expected = 1 + game.stats.baseCps * 0.01;
        near(game.stats.clickValue, expected, 1e-9);

        game.grantItem('frenzy', 1);
        game.useItem('frenzy', game.at());            // 產量 ×5
        game.refreshStats(game.at());
        near(game.stats.clickFromCps, game.stats.baseCps * 0.01, 1e-9, '不應吃到產量限時倍率');
    });

    test('全套認證要每種設備都達標才生效', function () {
        var game = makeGame();
        Config.BUILDINGS.forEach(function (b) { game.state.buildings[b.id] = 25; });
        game.state.buildings.council = 24;
        game.state.upgrades.certBasic = true;
        game.refreshStats(game.at());
        var without = game.stats.globalMult;
        equal(without, 1, '還差一個就不應生效');

        game.state.buildings.council = 25;
        game.refreshStats(game.at());
        near(game.stats.globalMult, 1.5, 1e-9, '全部達標才生效');
    });

    /* ---------------- 5. 道具 ---------------- */

    test('使用道具只扣一個且只生效一次', function () {
        var game = makeGame();
        game.grantItem('frenzy', 2);
        equal(game.state.items.frenzy, 2);
        var result = game.useItem('frenzy', game.at());
        ok(result, '應成功使用');
        equal(game.state.items.frenzy, 1, '只扣一個');
        equal(game.state.itemsUsed, 1);
    });

    test('沒有道具時使用失敗且不扣款', function () {
        var game = makeGame();
        equal(game.useItem('frenzy', game.at()), null);
        equal(game.state.items.frenzy, 0);
        equal(game.state.itemsUsed, 0);
    });

    test('限時產量道具正確放大產量', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;
        game.refreshStats(game.at());
        var base = game.stats.baseCps;
        game.grantItem('frenzy', 1);
        game.useItem('frenzy', game.at());
        near(game.stats.cps, base * 5, 1e-9, '產量 ×5');
        near(game.stats.baseCps, base, 1e-9, 'baseCps 不受限時效果影響');
    });

    test('同類道具重複使用只延長時間、不疊乘倍率，並受上限限制', function () {
        var game = makeGame();
        game.grantItem('frenzy', 10);
        game.useItem('frenzy', game.at());
        var first = game.state.buffs.cps.expiresAt;
        near((first - game.at()) / 1000, 60, 0.01, '第一次 60 秒');

        game.useItem('frenzy', game.at());
        near((game.state.buffs.cps.expiresAt - game.at()) / 1000, 120, 0.01, '第二次延長到 120 秒');
        equal(game.state.buffs.cps.mult, 5, '倍率不應疊乘');

        for (var i = 0; i < 8; i++) game.useItem('frenzy', game.at());
        var cap = Config.BALANCE.buffMaxSeconds.cps;
        near((game.state.buffs.cps.expiresAt - game.at()) / 1000, cap, 0.01, '不應超過 ' + cap + ' 秒上限');
        equal(game.state.buffs.cps.mult, 5);
    });

    test('不同類型的限時效果可以共存且相乘', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;
        game.grantItem('frenzy', 1);
        game.grantItem('goldenFinger', 1);
        game.useItem('frenzy', game.at());
        game.useItem('goldenFinger', game.at());
        game.refreshStats(game.at());
        equal(game.stats.buffs.active.length, 2);
        near(game.stats.cps, game.stats.baseCps * 5, 1e-9);
        var clickBase = game.stats.clickBase + game.stats.clickFromCps;
        near(game.stats.clickValue, clickBase * 20, 1e-9);
    });

    test('限時效果會按真實時間到期', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;
        game.grantItem('goldenFinger', 1);
        game.useItem('goldenFinger', game.at());      // 20 秒
        game.advance(19000);
        ok(game.stats.buffs.click > 1, '19 秒時應仍生效');
        game.advance(2000);
        equal(game.stats.buffs.click, 1, '21 秒後應失效');
        equal(game.state.buffs.click, null);
    });

    test('限時效果在中途到期時，產量只在生效期間放大', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;           // 每秒 30
        game.refreshStats(game.at());
        var cps = game.stats.baseCps;
        game.grantItem('frenzy', 1);
        game.useItem('frenzy', game.at());            // 60 秒 ×5
        var before = game.state.cookies;
        game.advance(50000);                           // 全部在效果內
        near(game.state.cookies - before, cps * 5 * 50, cps * 0.5, '效果內應為 5 倍產量');
    });

    test('時間砂糖不吃限時倍率、不推進計時器、不觸發事件', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;
        game.refreshStats(game.at());
        var base = game.stats.baseCps;

        game.grantItem('frenzy', 1);
        game.useItem('frenzy', game.at());
        var buffExpiry = game.state.buffs.cps.expiresAt;
        var nextGolden = game.state.nextGoldenAt;
        var before = game.state.cookies;

        game.grantItem('timeSugar', 1);
        var result = game.useItem('timeSugar', game.at());
        near(result.gain, base * 600, 1e-6, '應為 10 分鐘的未加成產量');
        near(game.state.cookies - before, base * 600, 1e-6);
        equal(game.state.buffs.cps.expiresAt, buffExpiry, '不應推進限時效果');
        equal(game.state.nextGoldenAt, nextGolden, '不應推進事件計時器');
        equal(game.state.golden, null, '不應觸發事件');
    });

    test('折扣道具到期後價格回復原價', function () {
        var game = makeGame();
        game.grantItem('discount', 1);
        game.useItem('discount', game.at());
        near(game.currentDiscount(game.at()), 0.2, 1e-9);
        game.advance(31000);
        equal(game.currentDiscount(game.at()), 0, '到期後應無折扣');
    });

    test('道具狀態經過存檔往返仍正確', function () {
        var game = makeGame();
        game.grantItem('frenzy', 3);
        game.useItem('frenzy', game.at());
        var snapshot = game.snapshot();

        var restored = makeGame();
        restored.loadSnapshot(snapshot, game.at());
        equal(restored.state.items.frenzy, 2);
        equal(restored.state.itemsUsed, 1);
        ok(restored.state.buffs.cps && restored.state.buffs.cps.expiresAt > game.at(), '限時效果應保留');
        restored.refreshStats(game.at());
        near(restored.stats.buffs.cps, 5, 1e-9);
    });

    /* ---------------- 6. 離線與時間 ---------------- */

    test('短暫離開以 100% 結算', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;           // 每秒 30
        game.refreshStats(game.at());
        var cps = game.stats.baseCps;                 // 含設備數量里程碑
        var report = game.advance(30000);             // 30 秒 < 寬限 60 秒
        equal(report.kind, 'online');
        near(report.earned, cps * 30, 1e-6);
    });

    test('離線超過寬限時間以 50% 效率結算', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;
        game.refreshStats(game.at());
        var cps = game.stats.baseCps;
        var report = game.advance(3600 * 1000);       // 1 小時
        equal(report.kind, 'offline');
        near(report.earned, cps * 3600 * 0.5, 1e-3);
        near(report.countedSeconds, 3600, 1e-6);
        equal(report.capped, false);
    });

    test('離線收益有 8 小時上限', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;
        game.refreshStats(game.at());
        var cps = game.stats.baseCps;
        var report = game.advance(24 * 3600 * 1000);  // 24 小時
        equal(report.capped, true);
        near(report.countedSeconds, 8 * 3600, 1e-6);
        near(report.earned, cps * 8 * 3600 * 0.5, 1e-3);
    });

    test('離線收益不計入限時倍率', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;
        game.refreshStats(game.at());
        var cps = game.stats.baseCps;
        game.grantItem('frenzy', 1);
        game.useItem('frenzy', game.at());            // ×5，但只有 60 秒
        var report = game.advance(3600 * 1000);
        equal(report.kind, 'offline');
        near(report.earned, cps * 3600 * 0.5, 1e-3, '不應被 ×5 放大');
        equal(game.state.buffs.cps, null, '過期的效果應被清掉');
    });

    test('同一段時間不會被結算兩次', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;
        game.refreshStats(game.at());
        game.advance(10000);
        var after = game.state.cookies;
        game.tick(game.at());                          // 用相同時間再結算一次
        game.tick(game.at());
        equal(game.state.cookies, after, '重複呼叫不應再給收益');
    });

    test('系統時間倒退不會給負收益', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;
        game.refreshStats(game.at());
        game.advance(5000);
        var after = game.state.cookies;
        var report = game.tick(game.at() - 60 * 60 * 1000);   // 時間倒退一小時
        equal(report.kind, 'rollback');
        equal(report.earned, 0);
        equal(game.state.cookies, after, '餘額不應減少');
    });

    test('離線期間不會累積可點擊事件', function () {
        var game = makeGame();
        game.state.buildings.clicker = 100;
        game.state.nextGoldenAt = game.at() + 1000;   // 離線期間本來會出現
        game.advance(3600 * 1000);
        equal(game.state.golden, null, '離線後不應有待點擊的事件');
        ok(game.state.nextGoldenAt > game.at(), '應重新排程');
    });

    /* ---------------- 7. 成就與一次性獎勵 ---------------- */

    test('成就達成後給一次性獎勵，且不會重複發放', function () {
        var game = makeGame();
        game.state.clicks = 999;
        game.addCookies(1);
        game.click(game.at());                         // 第 1000 次點擊
        equal(game.state.achievements.click1000, true);
        equal(game.state.items.goldenFinger, 1, '應獲得獎勵');

        // 再觸發一次檢查，不應重複發
        game._checkAchievements(game.at());
        game.click(game.at());
        equal(game.state.items.goldenFinger, 1, '不應重複發放');
        equal(game.state.claimedRewards.click1000, true);
    });

    test('重新載入後成就獎勵不會再發一次', function () {
        var game = makeGame();
        game.state.clicks = 1000;
        game._checkAchievements(game.at());
        equal(game.state.items.goldenFinger, 1);

        var snapshot = game.snapshot();
        var restored = makeGame();
        restored.loadSnapshot(snapshot, game.at());
        restored._checkAchievements(game.at());
        equal(restored.state.items.goldenFinger, 1, '重新載入不應重複取得');
    });

    test('同時啟動兩種限時效果會解鎖對應成就', function () {
        var game = makeGame();
        game.grantItem('frenzy', 1);
        game.grantItem('goldenFinger', 1);
        game.useItem('frenzy', game.at());
        equal(!!game.state.achievements.combo2, false);
        game.useItem('goldenFinger', game.at());
        equal(game.state.achievements.combo2, true);
    });

    /* ---------------- 8. 黃金餅乾 ---------------- */

    test('黃金餅乾出現、點擊後給獎勵並重新排程', function () {
        var game = makeGame({ randoms: [0.5] });
        game.state.buildings.clicker = 100;
        game.state.nextGoldenAt = game.at();
        game.advance(1000);
        ok(game.state.golden, '應出現黃金餅乾');

        var before = game.state.cookies;
        var reward = game.clickGolden(game.at());
        ok(reward, '應取得獎勵');
        equal(game.state.golden, null, '點完應消失');
        equal(game.state.goldenClicked, 1);
        ok(game.state.nextGoldenAt > game.at(), '應排下一次');
        if (reward.kind === 'cookies') ok(game.state.cookies > before);
    });

    test('黃金餅乾過期後不能再點', function () {
        var game = makeGame();
        game.state.nextGoldenAt = game.at();
        game.advance(1000);
        ok(game.state.golden);
        game.advance(20000);                           // 超過 14 秒壽命
        equal(game.state.golden, null, '應自動消失');
        equal(game.clickGolden(game.at()), null, '過期後點擊應無效');
    });

    /* ---------------- 9. 存檔 ---------------- */

    test('存檔往返完整保留進度', function () {
        var backend = memoryBackend();
        var storage = new StorageAPI.Storage({ backend: backend, now: function () { return T0; } });
        var game = makeGame();
        game.addCookies(123456);
        game.state.buildings.granny = 7;
        game.state.clicks = 50;
        game.buyUpgrade('butterGlove', game.at());
        game.grantItem('timeSugar', 2);

        ok(storage.save(game.snapshot()));
        var loaded = storage.load();
        equal(loaded.status, 'ok');

        var restored = makeGame();
        restored.loadSnapshot(loaded.state, game.at());
        equal(restored.state.buildings.granny, 7);
        equal(restored.state.upgrades.butterGlove, true);
        equal(restored.state.items.timeSugar, 2);
        near(restored.state.cookies, game.state.cookies, 1e-6);
    });

    test('損壞存檔會被拒絕', function () {
        var backend = memoryBackend();
        backend.setItem(StorageAPI.KEYS.save, '{壞掉的 JSON');
        var storage = new StorageAPI.Storage({ backend: backend });
        var loaded = storage.load();
        equal(loaded.status, 'corrupt');
        equal(loaded.reason, 'json');
    });

    test('不合理的數值會被拒絕', function () {
        var cases = [
            [{ cookies: -5, baked: 10, buildings: {} }, 'number:cookies'],
            [{ cookies: 10, baked: 'x', buildings: {} }, 'number:baked'],
            [{ cookies: 1e9, baked: 1, buildings: {} }, 'inconsistent'],
            [{ cookies: 1, baked: 1 }, 'buildings'],
            [{ cookies: 1, baked: 1, buildings: { clicker: -3 } }, 'building:clicker'],
            [{ cookies: 1, baked: 1, buildings: { clicker: 1.5 } }, 'building:clicker'],
            [{ cookies: 1, baked: 1, buildings: {}, items: { frenzy: -1 } }, 'item:frenzy'],
            ['字串', 'shape'],
            [null, 'shape']
        ];
        cases.forEach(function (pair) {
            var result = StorageAPI.validateState(pair[0]);
            equal(result.ok, false, '應拒絕 ' + JSON.stringify(pair[0]).slice(0, 50));
            equal(result.reason, pair[1]);
        });
    });

    test('未知的升級與成就 ID 會被忽略而不是整份拒絕', function () {
        var result = StorageAPI.validateState({
            cookies: 10, baked: 10, buildings: {},
            upgrades: { butterGlove: true, notARealUpgrade: true },
            achievements: { click100: true, fakeAchievement: true }
        });
        equal(result.ok, true);
        equal(result.state.upgrades.butterGlove, true);
        equal(result.state.upgrades.notARealUpgrade, undefined, '未知升級應被丟掉');
        equal(result.state.achievements.fakeAchievement, undefined);
    });

    test('版本遷移：舊存檔不會重複發放成就獎勵', function () {
        var old = {
            v: 1,
            state: {
                cookies: 100, baked: 100, buildings: {}, items: {},
                achievements: { click100: true, bake1e5: true }
                // v1 沒有 claimedRewards 與 bakedAllTime
            }
        };
        var step = StorageAPI.migrate(old);
        equal(step.migrated, true);
        equal(step.data.claimedRewards.bake1e5, true, '已解鎖的成就應視為已領獎');
        equal(step.data.bakedAllTime, 100);

        var checked = StorageAPI.validateState(step.data);
        equal(checked.ok, true);
        var game = makeGame();
        game.loadSnapshot(checked.state, T0);
        game._checkAchievements(T0);
        equal(game.state.items.frenzy, 0, '不應補發 v1 已拿過的獎勵');
    });

    test('比目前更新的存檔版本會被拒絕', function () {
        var step = StorageAPI.migrate({ v: 999, state: { cookies: 1, baked: 1, buildings: {} } });
        equal(step.tooNew, true);
        equal(step.data, null);
    });

    test('匯出與匯入可以往返', function () {
        var storage = new StorageAPI.Storage({ backend: memoryBackend() });
        var game = makeGame();
        game.addCookies(9999);
        game.state.buildings.oven = 3;
        var text = storage.exportText(game.snapshot());
        ok(text.indexOf('BAKERY1:') === 0, '應有前綴');

        var parsed = storage.parseImport(text);
        equal(parsed.ok, true);
        equal(parsed.state.buildings.oven, 3);
        near(parsed.state.cookies, 9999, 1e-6);
    });

    test('匯入失敗不會覆寫原存檔', function () {
        var backend = memoryBackend();
        var storage = new StorageAPI.Storage({ backend: backend, now: function () { return T0; } });
        var game = makeGame();
        game.addCookies(555);
        storage.save(game.snapshot());
        var original = backend.getItem(StorageAPI.KEYS.save);

        ['', '亂七八糟', 'BAKERY1:###', '{"v":1}'].forEach(function (bad) {
            var parsed = storage.parseImport(bad);
            equal(parsed.ok, false, '應拒絕：' + bad);
        });
        equal(backend.getItem(StorageAPI.KEYS.save), original, '原存檔不應被動到');
    });

    test('儲存不可用時遊戲仍能運作', function () {
        var throwing = {
            getItem: function () { throw new Error('blocked'); },
            setItem: function () { throw new Error('blocked'); },
            removeItem: function () { throw new Error('blocked'); }
        };
        var storage = new StorageAPI.Storage({ backend: throwing });
        equal(storage.load().status, 'none');
        equal(storage.save({ cookies: 1 }), false, '寫入失敗應回傳 false 而不是拋錯');
        equal(storage.writeFailed, true);

        var game = makeGame();
        game.click(game.at());
        equal(game.state.cookies, 1, '沒有存檔也能照常遊玩');
    });

    /* ---------------- 10. 多分頁 ---------------- */

    test('只有一個分頁能取得主控權', function () {
        var backend = memoryBackend();
        var clock = { t: T0 };
        var now = function () { return clock.t; };
        var tabA = new StorageAPI.Storage({ backend: backend, now: now, tabId: 'A' });
        var tabB = new StorageAPI.Storage({ backend: backend, now: now, tabId: 'B' });

        equal(tabA.claimLock(clock.t), true, 'A 先取得');
        equal(tabB.claimLock(clock.t), false, 'B 應被擋下');
        equal(tabA.claimLock(clock.t), true, 'A 可以續約');
    });

    test('主分頁關閉後另一個分頁可以安全接管', function () {
        var backend = memoryBackend();
        var clock = { t: T0 };
        var now = function () { return clock.t; };
        var tabA = new StorageAPI.Storage({ backend: backend, now: now, tabId: 'A' });
        var tabB = new StorageAPI.Storage({ backend: backend, now: now, tabId: 'B' });

        tabA.claimLock(clock.t);
        clock.t += Config.BALANCE.tab.staleMs + 1000;   // A 的心跳過期
        equal(tabB.claimLock(clock.t), true, 'B 應能接管');
        equal(tabA.claimLock(clock.t), false, 'A 回來後變成唯讀');
    });

    test('釋放鎖之後其他分頁立即可以接管', function () {
        var backend = memoryBackend();
        var now = function () { return T0; };
        var tabA = new StorageAPI.Storage({ backend: backend, now: now, tabId: 'A' });
        var tabB = new StorageAPI.Storage({ backend: backend, now: now, tabId: 'B' });
        tabA.claimLock(T0);
        tabA.releaseLock();
        equal(tabB.claimLock(T0), true);
    });

    /* ---------------- 11. 大數值與圖片 ---------------- */

    test('大數值不會變成 NaN 或 Infinity', function () {
        var game = makeGame();
        Config.BUILDINGS.forEach(function (b) { game.state.buildings[b.id] = 5000; });
        Content.UPGRADES.forEach(function (u) { game.state.upgrades[u.id] = true; });
        game.refreshStats(game.at());

        ok(isFinite(game.stats.baseCps), 'baseCps 應為有限數');
        ok(isFinite(game.stats.clickValue), 'clickValue 應為有限數');
        game.advance(1000);
        ok(isFinite(game.state.cookies), 'cookies 應為有限數');
        ok(!isNaN(game.state.cookies));

        var text = Format.short(game.state.cookies);
        ok(text.indexOf('NaN') === -1 && text.indexOf('Infinity') === -1, '顯示文字：' + text);
    });

    test('格式化會擋掉壞數字', function () {
        equal(Format.short(NaN), '0');
        equal(Format.short(Infinity), Format.short(Format.MAX_SAFE));
        equal(Format.full(undefined), '0');
        equal(Format.rate(-Infinity), Format.rate(-Format.MAX_SAFE));
        equal(Format.duration(Infinity), '非常久');
    });

    test('數字縮寫與完整值都正確', function () {
        equal(Format.short(0), '0');
        equal(Format.short(999), '999');
        equal(Format.short(12345), '1.23萬');
        equal(Format.short(1.5e8), '1.5億');
        equal(Format.short(2.5e12), '2.5兆');
        equal(Format.full(1234567), '1,234,567');
    });

    test('圖片載入失敗會回報並走降級', function () {
        var store = new ImagesAPI.ImageStore({
            sources: [
                { key: 'cookie', src: 'assets/cookie-main.svg' },
                { key: 'b:granny', src: 'assets/building-02.svg' }
            ],
            createImage: fakeImageLoader(['building-02'])
        });
        return new Promise(function (resolve, reject) {
            store.loadAll(function (summary) {
                try {
                    equal(summary.failed.length, 1);
                    equal(summary.failed[0], 'b:granny');
                    equal(store.get('b:granny'), null, '失敗的要走降級');
                    ok(store.get('cookie'), '成功的要有圖片');
                    equal(summary.allFailed, false);
                    resolve();
                } catch (err) { reject(err); }
            });
        });
    });

    test('全部圖片失敗時遊戲照常運作', function () {
        var store = new ImagesAPI.ImageStore({
            sources: [{ key: 'cookie', src: 'a.svg' }, { key: 'golden', src: 'b.svg' }],
            createImage: fakeImageLoader(['a.svg', 'b.svg'])
        });
        return new Promise(function (resolve, reject) {
            store.loadAll(function (summary) {
                try {
                    equal(summary.allFailed, true);
                    var game = makeGame();
                    game.click(game.at());
                    game.addCookies(1000);
                    ok(game.buyBuilding('clicker', 1, game.at()), '圖片全失敗也要能購買');
                    resolve();
                } catch (err) { reject(err); }
            });
        });
    });

    /* ---------------- 12. 內容一致性 ---------------- */

    test('主餅乾影格設定正確，且每點一次換下一張、循環播放', function () {
        var frames = Config.COOKIE_FRAMES;
        ok(Array.isArray(frames) && frames.length === 5, '應有 5 張影格，實際 ' + (frames && frames.length));
        frames.forEach(function (src, index) {
            ok(typeof src === 'string' && src.indexOf('assets/') === 0, '第 ' + index + ' 張路徑不正確：' + src);
        });
        equal(new Set(frames).size, frames.length, '影格路徑不應重複');

        // 影格索引 = 點擊次數對影格數取餘數
        function frameAt(clicks) { return Math.max(0, Math.floor(clicks)) % frames.length; }
        equal(frameAt(0), 0, '第 0 次點擊用第 1 張');
        equal(frameAt(1), 1);
        equal(frameAt(4), 4, '第 4 次點擊用第 5 張');
        equal(frameAt(5), 0, '第 5 次點擊回到第 1 張');
        equal(frameAt(6), 1);
        equal(frameAt(123), 123 % 5);
    });

    test('內容表數量符合需求', function () {
        equal(Config.BUILDINGS.length, 8, '八種設備');
        ok(Content.UPGRADES.length >= 25, '至少 25 個升級，實際 ' + Content.UPGRADES.length);
        equal(Config.ITEMS.length, 4, '四種道具');
        ok(Content.ACHIEVEMENTS.length >= 20, '至少 20 個成就，實際 ' + Content.ACHIEVEMENTS.length);
    });

    test('每個升級都有唯一 ID、價格與可辨識的效果', function () {
        var seen = {};
        var validTypes = ['clickMult', 'clickFromCps', 'clickFromBuilding', 'lucky', 'combo',
            'buildingMult', 'buildingTierMult', 'buildingMilestone', 'synergyCount', 'synergyTiers',
            'globalMult', 'globalIfAll', 'goldenBoost', 'buffDuration'];
        Content.UPGRADES.forEach(function (u) {
            ok(!seen[u.id], 'ID 重複：' + u.id);
            seen[u.id] = true;
            ok(u.name && u.desc, u.id + ' 缺少名稱或說明');
            ok(u.cost > 0 && isFinite(u.cost), u.id + ' 價格不合理');
            ok(u.effect && validTypes.indexOf(u.effect.type) !== -1, u.id + ' 效果型別無效');
            ok(u.image, u.id + ' 缺少圖片路徑');
        });
    });

    test('每個升級都真的會改變數值（沒有假升級）', function () {
        var game = makeGame();
        // 給足數量，讓所有搭配型升級都有作用對象
        Config.BUILDINGS.forEach(function (b) { game.state.buildings[b.id] = 60; });
        game.state.clicks = 10000;
        game.refreshStats(game.at());

        Content.UPGRADES.forEach(function (upgrade) {
            // 這幾種不是固定的產量加成（機率、連擊、事件、持續時間），改用係數驗證
            var indirect = ['goldenBoost', 'buffDuration', 'lucky', 'combo'];
            if (indirect.indexOf(upgrade.effect.type) !== -1) {
                var fx = Economy.collectEffects({ [upgrade.id]: true }, game.state.buildings);
                var hasEffect = fx.goldenFreqBonus > 0 || fx.goldenRewardBonus > 0 ||
                    fx.buffDurationBonus > 0 || fx.lucky.chance > 0 || fx.combo === true;
                ok(hasEffect, upgrade.id + '（' + upgrade.name + '）應該要有效果');
                return;
            }
            var gain = Economy.upgradeGainOf(game.state, upgrade.id, game.at());
            ok(gain.cps > 0 || gain.click > 0, upgrade.id + '（' + upgrade.name + '）沒有造成任何數值變化');
        });
    });

    test('每個成就都有唯一 ID 與條件，獎勵道具存在', function () {
        var seen = {};
        Content.ACHIEVEMENTS.forEach(function (a) {
            ok(!seen[a.id], 'ID 重複：' + a.id);
            seen[a.id] = true;
            ok(a.name && a.desc, a.id + ' 缺少名稱或說明');
            ok(a.req && Object.keys(a.req).length > 0, a.id + ' 沒有條件');
            if (a.reward) {
                ok(Config.ITEM_BY_ID[a.reward.itemId], a.id + ' 的獎勵道具不存在：' + a.reward.itemId);
                ok(a.reward.amount > 0, a.id + ' 的獎勵數量不合理');
            }
        });
    });

    test('每個設備都有價格、產量與揭曉門檻，且半徑遞增', function () {
        var lastCost = 0;
        var lastCps = 0;
        Config.BUILDINGS.forEach(function (b) {
            ok(b.name && b.desc && b.hint, b.id + ' 缺少文案');
            ok(b.baseCost > lastCost, b.id + ' 價格應遞增');
            ok(b.baseCps > lastCps, b.id + ' 產量應遞增');
            ok(b.growth > 1, b.id + ' 價格成長率應大於 1');
            ok(b.image, b.id + ' 缺少圖片');
            lastCost = b.baseCost;
            lastCps = b.baseCps;
        });
    });

    test('開局前 60 秒內能買到第一個自動設備（每秒 2 下）', function () {
        var game = makeGame();
        var seconds = 0;
        while (seconds < 60 && !game.state.buildings.clicker) {
            game.click(game.at());
            game.click(game.at());
            game._clock.t += 1000;
            game.tick(game._clock.t);
            game.buyBuilding('clicker', 1, game.at());
            seconds++;
        }
        equal(game.state.buildings.clicker, 1, '60 秒內應買到第一台，實際用了 ' + seconds + ' 秒');
        ok(seconds >= 20, '也不該太快就買到（實際 ' + seconds + ' 秒）');
    });

    return { tests: tests, helpers: { makeGame: makeGame, memoryBackend: memoryBackend } };
});
