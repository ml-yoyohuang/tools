/*!
 * 測試案例集（Node 與瀏覽器共用同一份）
 * 直接驅動真實的 Matter.js 物理世界，不使用測試框架。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var deps = isNode
        ? {
            Config: require('../js/config.js'),
            World: require('../js/world.js'),
            Storage: require('../js/storage.js'),
            Images: require('../js/images.js')
        }
        : {
            Config: root.SuikaConfig,
            World: root.SuikaWorld,
            Storage: root.SuikaStorage,
            Images: root.SuikaImages
        };
    var api = factory(deps);
    if (isNode) module.exports = api;
    else root.SuikaSuite = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    var Config = deps.Config;
    var WorldAPI = deps.World;
    var StorageAPI = deps.Storage;
    var ImagesAPI = deps.Images;

    /* ---------- 斷言 ---------- */

    function fail(message) {
        var err = new Error(message);
        err.name = 'AssertionError';
        return err;
    }

    function ok(value, message) {
        if (!value) throw fail(message || '預期為真，實際為 ' + value);
    }

    function equal(actual, expected, message) {
        if (actual !== expected) {
            throw fail((message || '值不相等') + '：預期 ' + JSON.stringify(expected) + '，實際 ' + JSON.stringify(actual));
        }
    }

    function near(actual, expected, tolerance, message) {
        if (Math.abs(actual - expected) > tolerance) {
            throw fail((message || '數值超出容許範圍') + '：預期 ' + expected + ' ±' + tolerance + '，實際 ' + actual);
        }
    }

    /* ---------- 工具 ---------- */

    var STEP = Config.TIMING.stepMs;

    function makeWorld(options) {
        options = options || {};
        return new WorldAPI.World({
            config: Config,
            rng: options.rng || function () { return 0; }   // 預設固定投放等級 1
        });
    }

    /** 直接在指定位置放一顆水果（繞過投放與冷卻），回傳 body。 */
    function place(world, x, y, level) {
        return world._createFruit(x, y, level, { grace: false });
    }

    /**
     * 並排放兩顆同級水果，刻意讓它們稍微重疊，
     * 物理引擎才會在第一步產生碰撞對（剛好相切是不會碰撞的）。
     */
    var OVERLAP = 4;

    function placePair(world, level, y, centerX) {
        var r = Config.levelAt(level).radius;
        var cx = centerX === undefined ? Config.WORLD.width / 2 : centerX;
        var gap = r - OVERLAP / 2;
        return [
            place(world, cx - gap, y, level),
            place(world, cx + gap, y, level)
        ];
    }

    function runSteps(world, count) {
        for (var i = 0; i < count; i++) {
            world.step(STEP);
            if (world.state !== 'running') break;
        }
    }

    /** 讓世界跑到所有水果大致靜止，或達到步數上限。 */
    function settle(world, maxSteps) {
        maxSteps = maxSteps || 420;
        for (var i = 0; i < maxSteps; i++) {
            world.step(STEP);
            if (world.state !== 'running') break;
            var moving = false;
            world.bodies.forEach(function (body) {
                if (Math.abs(body.velocity.y) > 0.08 || Math.abs(body.velocity.x) > 0.08) moving = true;
            });
            if (!moving && i > 20) return i;
        }
        return maxSteps;
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

    /** 假的圖片載入器，可指定哪些等級要失敗。 */
    function fakeImageLoader(failLevels) {
        return function () {
            var image = {};
            Object.defineProperty(image, 'src', {
                set: function (value) {
                    var match = /fruit-(\d+)\.svg$/.exec(value);
                    var level = match ? parseInt(match[1], 10) : 0;
                    var shouldFail = failLevels.indexOf(level) !== -1;
                    var self = this;
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

    /* ---------- 合併規則 ---------- */

    test('同級兩顆相碰會合成下一級並得分', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        var r = Config.levelAt(3).radius;
        placePair(world, 3, W.floorY - r);

        var merged = null;
        world.on('merge', function (event) { merged = event; });
        runSteps(world, 30);

        ok(merged, '應該發生合併');
        equal(merged.level, 4, '應合成等級 4');
        equal(world.fruitCount(), 1, '兩顆變一顆');
        equal(world.score, Config.SCORING.merge[2], '分數應為設定表中 level 3 的合成分數');
        var fruit = world.fruits()[0];
        equal(fruit.level, 4);
        equal(fruit.radius, Config.levelAt(4).radius, '新水果應使用新等級的碰撞半徑');
    });

    test('不同級相碰不會合併', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        place(world, W.width / 2 - 30, W.floorY - 30, 2);
        place(world, W.width / 2 + 30, W.floorY - 40, 4);
        runSteps(world, 120);
        equal(world.fruitCount(), 2, '兩顆應都還在');
        equal(world.score, 0, '不應得分');
        equal(world.mergeCount, 0);
    });

    test('三顆同級同時接觸只合併一次，不重複消耗或計分', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        var r = Config.levelAt(2).radius;
        var y = W.floorY - r;
        // 三顆連成一排且彼此略為重疊，同一次更新中會產生多組碰撞請求
        var span = r * 2 - OVERLAP;
        place(world, W.width / 2 - span, y, 2);
        place(world, W.width / 2, y, 2);
        place(world, W.width / 2 + span, y, 2);

        var merges = [];
        world.on('merge', function (event) { merges.push(event); });
        world.step(STEP);

        equal(merges.length, 1, '同一次更新只應合併一組');
        equal(world.fruitCount(), 2, '三顆應變成兩顆（一顆新的 + 一顆沒配對到的）');
        equal(world.score, Config.SCORING.merge[1], '只應計一次分');

        var levels = world.fruits().map(function (f) { return f.level; }).sort();
        equal(JSON.stringify(levels), JSON.stringify([2, 3]), '應剩下一顆等級 2 與一顆等級 3');
    });

    test('合併請求指向已消失的水果時會被安全忽略', function () {
        var world = makeWorld();
        var a = place(world, 100, 700, 2);
        var b = place(world, 140, 700, 2);
        // 手動塞入一組指向已移除水果的請求
        world._removeFruit(b);
        world.mergeQueue.push({ a: a.plugin.fruit.id, b: b.plugin.fruit.id });
        world._processMerges();
        equal(world.fruitCount(), 1, '不應誤刪或當掉');
        equal(world.score, 0);
    });

    test('連鎖合併：兩組合成後的新水果會繼續往上合成', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        var r = Config.levelAt(1).radius;
        // 兩排各兩顆：下排先合成等級 2，上排也合成等級 2，
        // 上面那顆落到下面那顆上就會再合成等級 3。
        placePair(world, 1, W.floorY - r);
        placePair(world, 1, W.floorY - r * 3 - 2);
        var levels = [];
        world.on('merge', function (event) { levels.push(event.level); });
        runSteps(world, 200);

        ok(levels.indexOf(2) !== -1, '應先合成等級 2');
        ok(levels.indexOf(3) !== -1, '兩顆等級 2 應再合成等級 3');
        equal(world.fruits()[0].level, 3, '最後應剩一顆等級 3');
        equal(world.score, Config.SCORING.merge[0] * 2 + Config.SCORING.merge[1], '分數應為三次合併的總和');
    });

    test('最高級兩顆相碰一起消除並給額外分數，不產生更高級', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        var top = Config.MAX_LEVEL;
        var r = Config.levelAt(top).radius;
        placePair(world, top, W.floorY - r, W.innerLeft + r + (r - OVERLAP / 2));

        var cleared = null;
        world.on('clear', function (event) { cleared = event; });
        runSteps(world, 240);

        ok(cleared, '應觸發最高級消除');
        equal(cleared.score, Config.SCORING.topClear);
        equal(world.score, Config.SCORING.topClear);
        equal(world.fruitCount(), 0, '兩顆都應消失');
        world.fruits().forEach(function (fruit) {
            ok(fruit.level <= top, '不應產生超過最高級的水果');
        });
    });

    test('合併後的新水果速度有上限，不會憑空爆飛', function () {
        var world = makeWorld();
        var Matter = world.engine.world ? null : null;
        var a = place(world, 200, 400, 5);
        var b = place(world, 200 + Config.levelAt(5).radius * 2 - 2, 400, 5);
        // 給兩顆很大的速度再讓它們合併
        a.velocity.x = 60; b.velocity.x = -60;
        world.step(STEP);
        var fruits = world.fruits();
        equal(fruits.length, 1, '應已合併');
        var body = world.bodies.get(fruits[0].id);
        var speed = Math.sqrt(body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y);
        ok(speed <= Config.PHYSICS.maxMergeSpeed + 0.001,
            '合併後速度 ' + speed.toFixed(2) + ' 應不超過上限 ' + Config.PHYSICS.maxMergeSpeed);
    });

    test('合併後的新水果不會超出容器範圍', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        var r = Config.levelAt(6).radius;
        // 緊貼左牆的兩顆，合併後半徑變大
        place(world, W.innerLeft + r, W.floorY - r, 6);
        place(world, W.innerLeft + r * 3 - 2, W.floorY - r, 6);
        runSteps(world, 60);
        var fruit = world.fruits()[0];
        ok(fruit.x - fruit.radius >= W.innerLeft - 2, '不應穿出左牆，實際左緣 ' + (fruit.x - fruit.radius));
        ok(fruit.x + fruit.radius <= W.innerRight + 2, '不應穿出右牆');
    });

    /* ---------- 投放、冷卻與範圍 ---------- */

    test('投放位置依半徑限制在容器內', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        var radius = Config.levelAt(world.currentLevel).radius;

        world.setAim(-9999);
        equal(world.aimX, W.innerLeft + radius, '最左應貼齊內牆加半徑');
        world.setAim(9999);
        equal(world.aimX, W.innerRight - radius, '最右應貼齊內牆減半徑');

        world.setAim(-9999);
        var body = world.drop();
        ok(body.position.x - radius >= W.innerLeft - 0.001, '水果不應生成在牆裡');
    });

    test('投放冷卻中不會再投放', function () {
        var world = makeWorld();
        equal(world.canDrop(), true);
        ok(world.drop(), '第一次應成功');
        equal(world.canDrop(), false, '冷卻中');
        equal(world.drop(), null, '冷卻中投放應被拒絕');
        equal(world.fruitCount(), 1, '只應有一顆');

        runSteps(world, Math.ceil(Config.TIMING.dropCooldownMs / STEP) + 1);
        equal(world.canDrop(), true, '冷卻結束後應可再投放');
        ok(world.drop());
        equal(world.fruitCount(), 2);
    });

    test('連點投放只會產生一顆水果', function () {
        var world = makeWorld();
        for (var i = 0; i < 12; i++) world.drop();
        equal(world.fruitCount(), 1, '連點 12 次只應生成一顆');
        equal(world.dropCount, 1);
    });

    test('暫停與遊戲結束時不接受投放', function () {
        var world = makeWorld();
        world.pause();
        equal(world.drop(), null, '暫停時不應投放');
        equal(world.fruitCount(), 0);
        world.resume();
        ok(world.drop(), '繼續後應可投放');

        world._gameOver();
        world.cooldownUntil = 0;
        equal(world.drop(), null, '遊戲結束後不應投放');
    });

    test('投放後會換成下一顆，並重新夾一次落點', function () {
        var levels = [1, 5, 1, 5];
        var i = 0;
        var world = makeWorld({ rng: function () { return (levels[i++ % levels.length] - 1) / Config.SPAWN.maxLevel + 0.01; } });
        var first = world.currentLevel;
        var queued = world.nextLevel;
        world.drop();
        equal(world.currentLevel, queued, '投放後目前水果應換成原本的下一顆');
        ok(world.currentLevel !== undefined && world.nextLevel !== undefined);
        ok(first >= 1 && first <= Config.SPAWN.maxLevel, '隨機等級應落在前 5 級');
    });

    test('隨機投放只會出現前 5 級', function () {
        var world = makeWorld({ rng: Math.random });
        var seen = {};
        for (var i = 0; i < 400; i++) {
            var level = world._randomLevel();
            ok(level >= 1 && level <= Config.SPAWN.maxLevel, '等級 ' + level + ' 超出允許範圍');
            seen[level] = true;
        }
        equal(Object.keys(seen).length, Config.SPAWN.maxLevel, '等機率下五種等級都應出現過');
    });

    test('機率表可透過設定調整', function () {
        var custom = Object.assign({}, Config, {
            SPAWN: { maxLevel: 5, weights: [0, 0, 1, 0, 0] }
        });
        var world = new WorldAPI.World({ config: custom, rng: Math.random });
        for (var i = 0; i < 50; i++) equal(world._randomLevel(), 3, '權重只給等級 3 時應固定出現 3');
    });

    /* ---------- 警戒線與遊戲結束 ---------- */

    test('超過警戒線但未達指定時間不會結束', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        var body = place(world, W.width / 2, W.warningLineY - 30, 5);
        world.bodies.get(body.plugin.fruit.id).isStatic = true;   // 固定在警戒線上方
        runSteps(world, Math.floor(Config.TIMING.dangerDelayMs / STEP) - 5);
        equal(world.state, 'running', '還沒滿 2 秒不應結束');
        ok(world.dangerRatio > 0.8, '危險指示應接近滿');
    });

    test('持續超過警戒線達指定時間才判定結束', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        var body = place(world, W.width / 2, W.warningLineY - 30, 5);
        body.isStatic = true;
        var over = null;
        world.on('gameover', function (event) { over = event; });
        runSteps(world, Math.ceil(Config.TIMING.dangerDelayMs / STEP) + 2);
        equal(world.state, 'over');
        ok(over, '應發出 gameover 事件');
    });

    test('回到安全區會重置超線計時，不累加不連續的時間', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        var body = place(world, W.width / 2, W.warningLineY - 30, 5);
        body.isStatic = true;
        var fruit = body.plugin.fruit;

        runSteps(world, 60);                       // 累積約 1 秒
        ok(fruit.dangerMs > 800, '應已累積超線時間');

        require_setPosition(world, body, W.width / 2, W.floorY - fruit.radius);
        world.step(STEP);
        equal(fruit.dangerMs, 0, '回到安全區應歸零');

        require_setPosition(world, body, W.width / 2, W.warningLineY - 30);
        runSteps(world, 60);
        ok(world.state === 'running', '重新累積的 1 秒不應直接結束');
        ok(fruit.dangerMs < 1100, '不應把先前的時間加回來');
    });

    test('新投放的水果有入場寬限，不會還沒落下就判定失敗', function () {
        var world = makeWorld();
        var body = world.drop();
        var fruit = body.plugin.fruit;
        ok(fruit.graceUntil > 0, '投放的水果應有寬限');
        body.isStatic = true;      // 卡在出生點（警戒線上方）
        runSteps(world, 20);
        equal(fruit.dangerMs, 0, '寬限內不應累積超線時間');
        equal(world.state, 'running');
    });

    test('合併產生的水果沒有入場寬限，不能用它規避結束判定', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        var y = W.warningLineY - 40;
        var pair = placePair(world, 4, y);
        pair[0].isStatic = true;
        world.step(STEP);
        var fruits = world.fruits();
        equal(fruits.length, 1, '應已合併');
        var merged = world.bodies.get(fruits[0].id);
        equal(merged.plugin.fruit.graceUntil, 0, '合併產生的水果不應取得寬限');

        merged.isStatic = true;
        runSteps(world, Math.ceil(Config.TIMING.dangerDelayMs / STEP) + 2);
        equal(world.state, 'over', '應照常判定結束');
    });

    test('碰到東西就結束入場寬限', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        place(world, W.width / 2, W.floorY - 20, 1);     // 地上先放一顆
        world.setAim(W.width / 2);
        var body = world.drop();
        ok(body.plugin.fruit.graceUntil > 0);
        runSteps(world, 120);                            // 落下並碰到
        equal(body.plugin.fruit.graceUntil, 0, '碰撞後寬限應結束');
    });

    test('暫停時物理、冷卻與危險計時都停住', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        var body = place(world, W.width / 2, W.warningLineY - 30, 5);
        body.isStatic = true;
        world.drop();

        var timeBefore = world.gameTime;
        var dangerBefore = body.plugin.fruit.dangerMs;
        var cooldownBefore = world.cooldownRemaining();

        world.pause();
        for (var i = 0; i < 200; i++) world.update(16.7);

        equal(world.gameTime, timeBefore, '暫停時遊戲時間不應前進');
        equal(body.plugin.fruit.dangerMs, dangerBefore, '危險計時應停住');
        equal(world.cooldownRemaining(), cooldownBefore, '冷卻應停住');
        equal(world.state, 'paused', '不應自己恢復');

        world.resume();
        world.update(16.7);
        ok(world.gameTime > timeBefore, '繼續後才會推進');
    });

    /* ---------- 時間步長 ---------- */

    test('固定步長：單幀補算次數有上限', function () {
        var world = makeWorld();
        var steps = world.update(100000);   // 模擬分頁切回後的巨大 delta
        ok(steps <= Config.TIMING.maxStepsPerFrame, '單幀步數應被限制，實際 ' + steps);
        equal(world.accumulator, 0, '超過上限後應丟棄積欠時間，避免後續爆衝');
    });

    test('相同輸入序列會得到相同結果（可重現）', function () {
        function run() {
            var seed = 1;
            var rng = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
            var world = new WorldAPI.World({ config: Config, rng: rng });
            for (var i = 0; i < 6; i++) {
                world.setAim(120 + i * 40);
                world.drop();
                runSteps(world, 40);
            }
            return { score: world.score, count: world.fruitCount() };
        }
        var a = run();
        var b = run();
        equal(JSON.stringify(a), JSON.stringify(b), '固定亂數來源下結果應一致');
    });

    /* ---------- 重新開始 ---------- */

    test('重新開始會清掉水果、佇列、分數與計時', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        place(world, 100, 700, 2);
        place(world, 140, 700, 2);
        world.drop();
        runSteps(world, 10);
        world.mergeQueue.push({ a: 999, b: 998 });   // 故意留下殘留請求

        world.reset();

        equal(world.fruitCount(), 0, '水果應清空');
        equal(world.mergeQueue.length, 0, '合併佇列不應有殘留');
        equal(world.score, 0);
        equal(world.gameTime, 0);
        equal(world.dropCount, 0);
        equal(world.mergeCount, 0);
        equal(world.dangerRatio, 0);
        equal(world.state, 'running');
        equal(world.cooldownRemaining(), 0, '冷卻應歸零');
    });

    test('重新開始後不會重複註冊碰撞事件或重複計分', function () {
        var world = makeWorld();
        var W = Config.WORLD;
        var r = Config.levelAt(3).radius;

        function mergeOnce() {
            placePair(world, 3, W.floorY - r);
            var count = 0;
            var handler = function () { count++; };
            world.on('merge', handler);
            runSteps(world, 40);
            return count;
        }

        var first = mergeOnce();
        world.reset();
        var second = mergeOnce();
        equal(first, 1, '第一局應只合併一次');
        equal(second, 1, '重新開始後仍只應合併一次（事件沒有被重複綁定）');
        equal(world.score, Config.SCORING.merge[2], '分數不應被重複累加');
    });

    test('遊戲結束後再重新開始可以正常遊玩', function () {
        var world = makeWorld();
        world._gameOver();
        equal(world.state, 'over');
        world.reset();
        equal(world.state, 'running');
        ok(world.drop(), '重新開始後應能投放');
    });

    /* ---------- 穩定性 ---------- */

    test('長時間堆疊不會穿牆或掉出容器', function () {
        var seed = 7;
        var rng = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
        var world = new WorldAPI.World({ config: Config, rng: rng });
        var W = Config.WORLD;

        for (var drop = 0; drop < 40 && world.state === 'running'; drop++) {
            world.cooldownUntil = 0;
            world.setAim(W.innerLeft + rng() * (W.innerRight - W.innerLeft));
            world.drop();
            runSteps(world, 40);

            world.fruits().forEach(function (fruit) {
                ok(fruit.x - fruit.radius > W.innerLeft - 6,
                    '第 ' + drop + ' 次投放後有水果穿出左牆：x=' + fruit.x.toFixed(1));
                ok(fruit.x + fruit.radius < W.innerRight + 6, '有水果穿出右牆');
                ok(fruit.y - fruit.radius < W.floorY + 6, '有水果掉出底部');
            });
        }
    });

    test('堆疊靜止後不會持續震動', function () {
        var world = makeWorld({ rng: Math.random });
        var W = Config.WORLD;
        for (var i = 0; i < 8; i++) {
            world.cooldownUntil = 0;
            world.setAim(W.innerLeft + 40 + i * 45);
            world.drop();
            runSteps(world, 50);
        }
        settle(world, 600);

        var maxSpeed = 0;
        world.bodies.forEach(function (body) {
            var speed = Math.sqrt(body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y);
            if (speed > maxSpeed) maxSpeed = speed;
        });
        ok(maxSpeed < 0.6, '靜止後最大速度應很小，實際 ' + maxSpeed.toFixed(3));
    });

    /* ---------- 圖片降級 ---------- */

    test('圖片載入失敗時回報失敗等級並改走降級繪製', function (done) {
        var store = new ImagesAPI.ImageStore({
            config: Config,
            createImage: fakeImageLoader([3, 7])
        });
        return new Promise(function (resolve, reject) {
            store.loadAll(function (summary) {
                try {
                    equal(summary.failed.length, 2, '應有兩個等級失敗');
                    equal(JSON.stringify(summary.failed), JSON.stringify([3, 7]));
                    equal(store.get(3), null, '失敗的等級應回傳 null');
                    equal(store.isFallback(3), true);
                    equal(store.isFallback(1), false, '成功的等級不應降級');
                    ok(store.get(1), '成功的等級應有圖片');
                    equal(summary.allFailed, false);
                    resolve();
                } catch (err) { reject(err); }
            });
        });
    });

    test('全部圖片失敗時遊戲仍可運作', function () {
        var all = Config.LEVELS.map(function (item) { return item.level; });
        var store = new ImagesAPI.ImageStore({ config: Config, createImage: fakeImageLoader(all) });
        return new Promise(function (resolve, reject) {
            store.loadAll(function (summary) {
                try {
                    equal(summary.allFailed, true);
                    equal(summary.ok, 0);
                    // 物理與合併完全不依賴圖片
                    var world = makeWorld();
                    var W = Config.WORLD;
                    var r = Config.levelAt(2).radius;
                    placePair(world, 2, W.floorY - r);
                    runSteps(world, 30);
                    equal(world.fruitCount(), 1, '圖片全失敗也要能正常合併');
                    resolve();
                } catch (err) { reject(err); }
            });
        });
    });

    test('沒有實際尺寸的圖片視為不可用', function () {
        var store = new ImagesAPI.ImageStore({ config: Config });
        store.images[2] = { naturalWidth: 0, naturalHeight: 0 };
        equal(store.get(2), null, '寬度為 0 的圖片應走降級');
    });

    /* ---------- 儲存降級 ---------- */

    test('儲存不可用時最高分回 0 且不拋錯', function () {
        var throwing = {
            getItem: function () { throw new Error('blocked'); },
            setItem: function () { throw new Error('blocked'); },
            removeItem: function () { throw new Error('blocked'); }
        };
        var storage = new StorageAPI.Storage({ backend: throwing });
        equal(storage.loadBest(), 0);
        equal(storage.saveBest(100), false, '寫入失敗應回傳 false 而不是拋錯');
        equal(storage.writeFailed, true);
        equal(JSON.stringify(storage.loadSettings()), JSON.stringify(StorageAPI.DEFAULT_SETTINGS));
    });

    test('最高分資料損壞時回到 0', function () {
        var backend = memoryBackend();
        backend.setItem(StorageAPI.KEYS.best, 'NaN...');
        var storage = new StorageAPI.Storage({ backend: backend });
        equal(storage.loadBest(), 0);

        backend.setItem(StorageAPI.KEYS.best, '-50');
        equal(storage.loadBest(), 0, '負數應視為無效');
    });

    test('偏好設定損壞或含非法值時回到預設', function () {
        var backend = memoryBackend();
        backend.setItem(StorageAPI.KEYS.settings, '{壞掉的 JSON');
        var storage = new StorageAPI.Storage({ backend: backend });
        equal(JSON.stringify(storage.loadSettings()), JSON.stringify(StorageAPI.DEFAULT_SETTINGS));
        equal(backend.getItem(StorageAPI.KEYS.settings), null, '損壞資料應被清掉');

        equal(StorageAPI.validateSettings({ motion: 'explode', showGuide: 'yes' }).motion, 'system');
        equal(StorageAPI.validateSettings({ motion: 'reduced', showGuide: false }).motion, 'reduced');
    });

    test('最高分可正常寫入與讀回', function () {
        var storage = new StorageAPI.Storage({ backend: memoryBackend() });
        equal(storage.saveBest(1234), true);
        equal(storage.loadBest(), 1234);
        storage.clearAll();
        equal(storage.loadBest(), 0);
    });

    /* ---------- 設定表一致性 ---------- */

    test('設定表：11 個等級、半徑遞增、分數表長度正確', function () {
        equal(Config.LEVELS.length, 11, '應有 11 級');
        equal(Config.MAX_LEVEL, 11);
        for (var i = 1; i < Config.LEVELS.length; i++) {
            ok(Config.LEVELS[i].radius > Config.LEVELS[i - 1].radius, '半徑應遞增');
        }
        equal(Config.SCORING.merge.length, Config.LEVELS.length - 1, '合成分數表應比等級數少一');
        equal(Config.SPAWN.weights.length, Config.SPAWN.maxLevel, '權重長度應等於可投放等級數');
        Config.LEVELS.forEach(function (item) {
            ok(item.name && item.image && item.color, '每一級都要有名稱、圖片路徑與顏色');
            ok(item.radius * 2 < Config.WORLD.innerRight - Config.WORLD.innerLeft, '最大水果應放得進容器');
        });
    });

    /* 讓測試檔在兩種環境都能移動物體 */
    function require_setPosition(world, body, x, y) {
        var Matter = (typeof module === 'object' && module.exports)
            ? require('../vendor/matter-js/matter.min.js')
            : (typeof self !== 'undefined' ? self.Matter : window.Matter);
        Matter.Body.setPosition(body, { x: x, y: y });
    }

    return { tests: tests, helpers: { makeWorld: makeWorld, place: place, placePair: placePair, runSteps: runSteps } };
});
