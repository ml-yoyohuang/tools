/*!
 * 測試案例集（同一份在 Node 與瀏覽器中執行）
 * 不依賴任何測試框架。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var deps = isNode
        ? { Engine: require('../js/engine.js'), Storage: require('../js/storage.js'), Session: require('../js/session.js') }
        : { Engine: root.Game2048Engine, Storage: root.Game2048Storage, Session: root.Game2048Session };
    var api = factory(deps);
    if (isNode) module.exports = api;
    else root.Game2048Suite = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    var Engine = deps.Engine;
    var StorageAPI = deps.Storage;
    var SessionAPI = deps.Session;

    /* ---------- 迷你斷言 ---------- */

    function AssertionError(message) {
        var err = new Error(message);
        err.name = 'AssertionError';
        return err;
    }

    function ok(value, message) {
        if (!value) throw AssertionError(message || '預期為真，實際為 ' + value);
    }

    function equal(actual, expected, message) {
        if (actual !== expected) {
            throw AssertionError((message || '值不相等') + '：預期 ' + JSON.stringify(expected) + '，實際 ' + JSON.stringify(actual));
        }
    }

    function deepEqual(actual, expected, message) {
        var a = JSON.stringify(actual);
        var b = JSON.stringify(expected);
        if (a !== b) throw AssertionError((message || '結構不相等') + '：\n  預期 ' + b + '\n  實際 ' + a);
    }

    /* ---------- 測試工具 ---------- */

    /**
     * 可預測的亂數來源。
     * values 用完後固定回傳 0（挑第一個空格、生成 2）。
     */
    function scriptedRng(values) {
        var i = 0;
        return function () {
            return i < values.length ? values[i++] : 0;
        };
    }

    /** 生成固定落在「最後一個空格」、數值固定為 2 的亂數來源。 */
    function lastCellRng() {
        var callCount = 0;
        return function () {
            callCount++;
            // 奇數次決定位置（0.999 → 最後一個空格），偶數次決定數值（< 0.9 → 2）
            return callCount % 2 === 1 ? 0.999 : 0.1;
        };
    }

    /** 生成固定落在「第一個空格」、數值固定為 2 的亂數來源。 */
    function firstCellRng() {
        return scriptedRng([]);   // 一律回傳 0：挑第一個空格、生成 2
    }

    /** 建立指定盤面的遊戲，新方塊固定生成在最後一個空格。 */
    function gameWith(grid) {
        var game = new Engine.Game({ rng: lastCellRng() });
        game.setGrid(grid);
        return game;
    }

    function row(values) {
        return [values, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    }

    /** 只比較第一列，避免被新生成的方塊干擾。 */
    function firstRowAfter(values, direction) {
        var game = gameWith(row(values));
        var result = game.move(direction);
        return { grid: game.valueGrid(), row: game.valueGrid()[0], result: result, game: game };
    }

    function memoryBackend(seed) {
        var map = Object.assign({}, seed || {});
        return {
            data: map,
            getItem: function (key) { return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null; },
            setItem: function (key, value) { map[key] = String(value); },
            removeItem: function (key) { delete map[key]; }
        };
    }

    /* ---------- 測試案例 ---------- */

    var tests = [];
    function test(name, fn) { tests.push({ name: name, fn: fn }); }

    /* --- 壓縮與合併 --- */

    test('向左：2,2,2,2 → 4,4,0,0（一次兩組合併）', function () {
        var out = firstRowAfter([2, 2, 2, 2], 'left');
        deepEqual(out.row, [4, 4, 0, 0]);
        equal(out.result.gained, 8, '分數應累加兩組合併');
    });

    test('向左：2,2,4,0 → 4,4,0,0，不會直接變成 8', function () {
        var out = firstRowAfter([2, 2, 4, 0], 'left');
        deepEqual(out.row, [4, 4, 0, 0]);
        equal(out.result.gained, 4, '只有一組合併');
    });

    test('向左：2,0,2,2 → 4,2,0,0（靠近方向的先合併）', function () {
        var out = firstRowAfter([2, 0, 2, 2], 'left');
        deepEqual(out.row, [4, 2, 0, 0]);
        equal(out.result.gained, 4);
    });

    test('向右：2,2,2,2 → 0,0,4,4', function () {
        var out = firstRowAfter([2, 2, 2, 2], 'right');
        deepEqual(out.row, [0, 0, 4, 4]);
    });

    test('向右：0,4,2,2 → 0,0,4,4，不會變成 8', function () {
        var out = firstRowAfter([0, 4, 2, 2], 'right');
        deepEqual(out.row, [0, 0, 4, 4]);
        equal(out.result.gained, 4);
    });

    test('向上：整欄 2,2,2,2 → 4,4,0,0', function () {
        var game = gameWith([[2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0]]);
        game.move('up');
        var column = game.valueGrid().map(function (line) { return line[0]; });
        deepEqual(column, [4, 4, 0, 0]);
    });

    test('向下：整欄 2,2,4,0 → 0,0,4,4', function () {
        var game = gameWith([[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [0, 0, 0, 0]]);
        game.move('down');
        var column = game.valueGrid().map(function (line) { return line[0]; });
        deepEqual(column, [0, 0, 4, 4]);
    });

    test('合併後的新方塊不會在同回合再次合併（4,2,2 → 4,4 而非 8）', function () {
        var out = firstRowAfter([4, 2, 2, 0], 'left');
        deepEqual(out.row, [4, 4, 0, 0]);
    });

    test('多組合併的分數累加（4,4,8,8 → 8,16，得分 24）', function () {
        var out = firstRowAfter([4, 4, 8, 8], 'left');
        deepEqual(out.row, [8, 16, 0, 0]);
        equal(out.result.gained, 24);
        equal(out.game.score, 24, '總分應等於本回合所得');
    });

    test('純移動不得分', function () {
        var out = firstRowAfter([0, 0, 0, 2], 'left');
        equal(out.result.gained, 0);
        equal(out.result.moved, true);
    });

    /* --- 無效移動 --- */

    test('無效移動：不生成方塊、不增加步數、不計分', function () {
        var game = gameWith([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        var before = game.valueGrid();
        var tileCount = game.tiles().length;
        var result = game.move('left');
        equal(result.moved, false, 'left 應為無效移動');
        equal(result.spawned, null, '不應生成新方塊');
        equal(game.tiles().length, tileCount, '方塊數不變');
        equal(game.moves, 0, '步數不增加');
        equal(game.score, 0, '分數不變');
        deepEqual(game.valueGrid(), before, '盤面不變');
    });

    test('無效移動不覆寫悔棋紀錄', function () {
        // 新方塊補在第一個空格 (0,1)，盤面變成 [4,2,0,0]，再往左就無效
        var session = new SessionAPI.Session({ rng: firstCellRng() });
        session.game.setGrid([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        var valid = session.move('left');
        equal(valid.moved, true);
        var snapshotAfterValid = JSON.stringify(session.undoSnapshot);

        var invalid = session.move('left');  // 已靠左，再往左無效
        equal(invalid.moved, false, '第二次 left 應無效');
        equal(JSON.stringify(session.undoSnapshot), snapshotAfterValid, '悔棋紀錄不應被覆寫');
        equal(session.canUndo, true);
    });

    /* --- 勝負判斷 --- */

    test('滿盤但仍可合併時不算結束', function () {
        var game = gameWith([
            [2, 4, 2, 4],
            [4, 2, 4, 2],
            [2, 4, 2, 4],
            [4, 2, 4, 4]
        ]);
        equal(game.emptyCells().length, 0, '盤面應為滿');
        equal(game.movesAvailable(), true, '最後一列有相鄰的 4,4');
        equal(game.isOver(), false);
    });

    test('滿盤且無相鄰同值才判定結束', function () {
        var game = gameWith([
            [2, 4, 2, 4],
            [4, 2, 4, 2],
            [2, 4, 2, 4],
            [4, 2, 4, 2]
        ]);
        equal(game.movesAvailable(), false);
        equal(game.isOver(), true);
        var result = game.move('left');
        equal(result.moved, false, '結束後移動應無效');
    });

    test('判斷可移動性不會改動正式棋盤', function () {
        var game = gameWith([
            [2, 4, 2, 4],
            [4, 2, 4, 2],
            [2, 4, 2, 4],
            [4, 2, 4, 4]
        ]);
        var before = game.valueGrid();
        var score = game.score;
        game.movesAvailable();
        game.isOver();
        deepEqual(game.valueGrid(), before, '盤面不應被試算改動');
        equal(game.score, score);
    });

    test('移動後填滿且無法再合併 → over 為 true', function () {
        // 盤面只剩一格空位，生成固定落在最後一格且為 2，移動後無相鄰同值
        var game = new Engine.Game({ rng: scriptedRng([0, 0.1]) });
        game.setGrid([
            [0, 4, 2, 4],
            [2, 4, 2, 4],
            [4, 2, 4, 2],
            [2, 4, 2, 4]
        ]);
        var result = game.move('left');   // 第一列往左靠成 4,2,4，空格移到最右
        equal(result.moved, true);
        equal(game.emptyCells().length, 0, '新方塊應補滿最後一格');
        equal(result.over, true, '無相鄰同值應判定結束');
        equal(game.over, true);
    });

    /* --- 勝利與續玩 --- */

    test('首次達成 2048 回報勝利，續玩後不再回報', function () {
        var game = gameWith([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        var result = game.move('left');
        equal(result.won, true, '首次達成應回報勝利');
        equal(game.won, true);
        equal(game.maxTile(), 2048);

        game.keepPlaying = true;
        game.setGrid([[2048, 2048, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        game.won = true;
        var again = game.move('left');
        equal(again.won, false, '已勝利過不應再次回報');
        equal(game.maxTile(), 4096, '仍可繼續合併出更大的數字');
    });

    test('勝利僅在達到 2048 當下觸發，非每次合併', function () {
        var game = gameWith([[512, 512, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        var result = game.move('left');
        equal(result.won, false);
        equal(game.won, false);
    });

    /* --- 悔棋 --- */

    test('悔棋完整還原盤面、分數與步數', function () {
        var session = new SessionAPI.Session({ rng: lastCellRng() });
        session.game.setGrid([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        var before = session.game.valueGrid();

        session.move('left');
        equal(session.game.score, 4);
        equal(session.game.moves, 1);

        equal(session.undo(), true);
        deepEqual(session.game.valueGrid(), before, '盤面應完全還原');
        equal(session.game.score, 0, '分數應還原');
        equal(session.game.moves, 0, '步數應還原');
    });

    test('悔棋不可連續執行', function () {
        var session = new SessionAPI.Session({ rng: lastCellRng() });
        session.game.setGrid([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        session.move('left');
        equal(session.undo(), true);
        equal(session.canUndo, false);
        equal(session.undo(), false, '第二次悔棋應被拒絕');
    });

    test('悔棋後最高分不倒退', function () {
        var session = new SessionAPI.Session({ rng: lastCellRng() });
        session.game.setGrid([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        session.move('left');
        equal(session.best, 4);
        session.undo();
        equal(session.game.score, 0);
        equal(session.best, 4, '最高分應保留');
    });

    test('悔棋可還原遊戲結束狀態', function () {
        var session = new SessionAPI.Session({ rng: scriptedRng([0, 0.1]) });
        session.game.setGrid([
            [0, 4, 2, 4],
            [2, 4, 2, 4],
            [4, 2, 4, 2],
            [2, 4, 2, 4]
        ]);
        var result = session.move('left');
        equal(result.over, true);
        equal(session.game.over, true);
        equal(session.undo(), true);
        equal(session.game.over, false, '悔棋後應回到可繼續的狀態');
        equal(session.game.emptyCells().length, 1);
    });

    test('悔棋可還原勝利狀態', function () {
        var session = new SessionAPI.Session({ rng: lastCellRng() });
        session.game.setGrid([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        var result = session.move('left');
        equal(result.won, true);
        equal(session.game.won, true);
        session.undo();
        equal(session.game.won, false, '悔棋後勝利狀態應一併還原');
        equal(session.game.maxTile(), 1024);
    });

    test('新遊戲會清掉悔棋紀錄', function () {
        var session = new SessionAPI.Session({ rng: lastCellRng() });
        session.game.setGrid([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        session.move('left');
        equal(session.canUndo, true);
        session.newGame();
        equal(session.canUndo, false);
        equal(session.game.moves, 0);
        equal(session.game.score, 0);
        equal(session.game.tiles().length, 2, '開局應有兩個方塊');
    });

    /* --- 生成規則 --- */

    test('開局在不同空格生成兩個方塊', function () {
        for (var i = 0; i < 50; i++) {
            var game = new Engine.Game();
            game.setup();
            var tiles = game.tiles();
            equal(tiles.length, 2, '開局應有兩個方塊');
            ok(tiles[0].row !== tiles[1].row || tiles[0].col !== tiles[1].col, '兩個方塊不應重疊');
            ok(tiles[0].value === 2 || tiles[0].value === 4, '初始值只能是 2 或 4');
        }
    });

    test('生成機率：rng < 0.9 為 2，否則為 4', function () {
        var two = new Engine.Game({ rng: scriptedRng([0, 0.89]) });
        two.addRandomTile();
        equal(two.tiles()[0].value, 2);

        var four = new Engine.Game({ rng: scriptedRng([0, 0.9]) });
        four.addRandomTile();
        equal(four.tiles()[0].value, 4);
    });

    test('生成位置只會落在空格', function () {
        var game = new Engine.Game({ rng: Math.random });
        game.setGrid([
            [2, 4, 8, 16],
            [32, 64, 128, 256],
            [512, 1024, 2048, 4096],
            [8192, 16384, 0, 0]
        ]);
        for (var i = 0; i < 2; i++) {
            var tile = game.addRandomTile();
            ok(tile, '仍有空格時應能生成');
            equal(tile.row, 3);
            ok(tile.col === 2 || tile.col === 3, '只能生成在空格');
        }
        equal(game.addRandomTile(), null, '沒有空格時回傳 null');
    });

    /* --- 動畫所需的方塊身分追蹤 --- */

    test('移動後保留方塊身分與來源位置', function () {
        var game = gameWith([[2, 0, 0, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        var movedTile = game.tileAt(0, 3);
        var id = movedTile.id;
        game.move('left');
        var after = game.tileAt(0, 1);
        equal(after.id, id, '同一個方塊應保留 id');
        equal(after.prevCol, 3, '應記住移動前的位置');
        equal(after.isNew, false);
    });

    test('合併產生的方塊帶有兩個來源的位置資訊', function () {
        var game = gameWith([[2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        var ids = [game.tileAt(0, 0).id, game.tileAt(0, 3).id];
        game.move('left');
        var merged = game.tileAt(0, 0);
        equal(merged.value, 4);
        ok(merged.mergedFrom && merged.mergedFrom.length === 2, '應記錄兩個來源');
        deepEqual(merged.mergedFrom.map(function (s) { return s.id; }), ids);
        deepEqual(merged.mergedFrom.map(function (s) { return s.prevCol; }), [0, 3]);
    });

    /* --- 存檔 --- */

    test('存檔可完整還原進度', function () {
        var backend = memoryBackend();
        var storage = new StorageAPI.Storage({ backend: backend });
        var session = new SessionAPI.Session({ rng: lastCellRng(), best: 100 });
        session.game.setGrid([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        session.game.score = 120;
        session.game.moves = 7;
        session.best = 120;

        ok(storage.saveGame(session.game.toJSON()), '應能寫入');
        ok(storage.saveBest(session.best));

        var loaded = storage.loadGame();
        equal(loaded.status, 'ok');
        var restored = new SessionAPI.Session();
        restored.restore(loaded.data, storage.loadBest());
        deepEqual(restored.game.valueGrid(), session.game.valueGrid());
        equal(restored.game.score, 120);
        equal(restored.game.moves, 7);
        equal(restored.best, 120);
        equal(restored.canUndo, false, '重新載入後不應能悔棋');
    });

    test('損壞存檔（非 JSON）會被拒絕並清除', function () {
        var backend = memoryBackend();
        backend.setItem(StorageAPI.KEYS.game, '{這不是 JSON');
        var storage = new StorageAPI.Storage({ backend: backend });
        var loaded = storage.loadGame();
        equal(loaded.status, 'corrupt');
        equal(loaded.reason, 'json');
        equal(backend.getItem(StorageAPI.KEYS.game), null, '損壞資料應被清掉');
    });

    test('存檔結構或數值不合理會被拒絕', function () {
        var cases = [
            [{ v: 1, size: 4, score: 0, moves: 0, won: false, keepPlaying: false, grid: [[2, 0, 0, 0]] }, 'grid'],
            [{ v: 1, size: 4, score: 0, moves: 0, won: false, keepPlaying: false, grid: gridOf(3) }, 'tile'],
            [{ v: 1, size: 4, score: -5, moves: 0, won: false, keepPlaying: false, grid: gridOf(2) }, 'score'],
            [{ v: 1, size: 4, score: 0, moves: 1.5, won: false, keepPlaying: false, grid: gridOf(2) }, 'moves'],
            [{ v: 1, size: 4, score: 0, moves: 0, won: 'yes', keepPlaying: false, grid: gridOf(2) }, 'flags'],
            [{ v: 2, size: 4, score: 0, moves: 0, won: false, keepPlaying: false, grid: gridOf(2) }, 'version'],
            [{ v: 1, size: 4, score: 0, moves: 0, won: false, keepPlaying: false, grid: gridOf(0) }, 'empty'],
            [{ v: 1, size: 4, score: 0, moves: 0, won: true, keepPlaying: false, grid: gridOf(2) }, 'inconsistent'],
            ['字串', 'shape'],
            [null, 'shape']
        ];
        cases.forEach(function (pair) {
            var result = StorageAPI.validateGame(pair[0]);
            equal(result.ok, false, '應拒絕：' + JSON.stringify(pair[0]).slice(0, 60));
            equal(result.reason, pair[1], '拒絕原因');
        });

        function gridOf(value) {
            var grid = [];
            for (var r = 0; r < 4; r++) grid.push([0, 0, 0, 0]);
            if (value) grid[0][0] = value;
            return grid;
        }
    });

    test('合法存檔會通過驗證', function () {
        var game = new Engine.Game();
        game.setup();
        var result = StorageAPI.validateGame(game.toJSON());
        equal(result.ok, true, result.reason);
    });

    test('匯出與匯入可以往返（本局進度、最高分、偏好設定）', function () {
        var storage = new StorageAPI.Storage({ backend: memoryBackend() });
        var session = new SessionAPI.Session({ rng: lastCellRng(), best: 4096 });
        session.game.setGrid([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        session.game.score = 512;
        session.game.moves = 33;

        var text = storage.exportText({
            game: session.game.toJSON(), best: session.best, settings: { theme: 'dark', motion: 'reduced' }
        });
        ok(text.indexOf('T2048-1:') === 0, '應有前綴');

        var parsed = storage.parseImport(text);
        equal(parsed.ok, true);
        equal(parsed.data.game.score, 512);
        equal(parsed.data.game.moves, 33);
        equal(parsed.data.best, 4096);
        equal(parsed.data.settings.theme, 'dark');
        deepEqual(parsed.data.game.grid[0], [2, 4, 8, 16], '盤面應完整保留');
    });

    test('匯入失敗不會動到現有紀錄', function () {
        var backend = memoryBackend();
        var storage = new StorageAPI.Storage({ backend: backend });
        var game = new Engine.Game();
        game.setup();
        storage.saveGame(game.toJSON());
        storage.saveBest(777);
        var beforeGame = backend.getItem(StorageAPI.KEYS.game);
        var beforeBest = backend.getItem(StorageAPI.KEYS.best);

        ['', '亂七八糟', 'T2048-1:###', JSON.stringify({ v: 99 })].forEach(function (bad) {
            equal(storage.parseImport(bad).ok, false, '應拒絕：' + bad);
        });
        // 盤面資料不合理也要擋下
        var badGame = storage.exportText({ game: { v: 1, size: 4, score: 0, moves: 0, won: false, keepPlaying: false, grid: [[3, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] }, best: 0 });
        var result = storage.parseImport(badGame);
        equal(result.ok, false, '非 2 的次方應被拒絕');
        ok(result.reason.indexOf('game:') === 0, '原因應指出是盤面的問題：' + result.reason);

        equal(backend.getItem(StorageAPI.KEYS.game), beforeGame, '原本的盤面不應被動到');
        equal(backend.getItem(StorageAPI.KEYS.best), beforeBest, '原本的最高分不應被動到');
    });

    test('匯入時最高分不會低於本局分數', function () {
        var storage = new StorageAPI.Storage({ backend: memoryBackend() });
        var game = new Engine.Game();
        game.setGrid([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        game.score = 9999;
        var text = storage.exportText({ game: game.toJSON(), best: 10 });
        var parsed = storage.parseImport(text);
        equal(parsed.data.best, 9999, '最高分應被提升到本局分數');
    });

    test('套用匯入會寫進儲存，空盤面則清掉本局進度', function () {
        var backend = memoryBackend();
        var storage = new StorageAPI.Storage({ backend: backend });
        var game = new Engine.Game();
        game.setup();
        storage.saveGame(game.toJSON());

        storage.applyImport({ game: null, best: 321, settings: { theme: 'light', motion: 'full' } });
        equal(backend.getItem(StorageAPI.KEYS.game), null, '沒有本局進度時應清掉');
        equal(storage.loadBest(), 321);
        equal(storage.loadSettings().theme, 'light');
    });

    test('localStorage 不可用時遊戲仍能運作', function () {
        var throwing = {
            getItem: function () { throw new Error('blocked'); },
            setItem: function () { throw new Error('blocked'); },
            removeItem: function () { throw new Error('blocked'); }
        };
        var storage = new StorageAPI.Storage({ backend: throwing });
        equal(storage.loadGame().status, 'none', '讀取失敗應視為沒有存檔');
        equal(storage.saveGame({ v: 1 }), false, '寫入失敗應回傳 false 而非拋錯');
        equal(storage.loadBest(), 0);
        deepEqual(storage.loadSettings(), { theme: 'system', motion: 'system' }, '應回到預設設定');
    });

    test('容量不足時寫入失敗但不拋錯', function () {
        var full = {
            getItem: function () { return null; },
            setItem: function () {
                var err = new Error('quota');
                err.name = 'QuotaExceededError';
                throw err;
            },
            removeItem: function () {}
        };
        var storage = new StorageAPI.Storage({ backend: full });
        equal(storage.saveGame({ v: 1 }), false);
        equal(storage.quotaExceeded, true, '應記錄容量問題供介面提示');
    });

    test('偏好設定只接受允許的值', function () {
        deepEqual(StorageAPI.validateSettings({ theme: 'dark', motion: 'reduced' }), { theme: 'dark', motion: 'reduced' });
        deepEqual(StorageAPI.validateSettings({ theme: '<script>', motion: 42 }), { theme: 'system', motion: 'system' });
        deepEqual(StorageAPI.validateSettings(null), { theme: 'system', motion: 'system' });
    });

    test('清除紀錄會移除三組資料', function () {
        var backend = memoryBackend();
        var storage = new StorageAPI.Storage({ backend: backend });
        storage.saveBest(10);
        storage.saveSettings({ theme: 'dark', motion: 'full' });
        storage.saveGame(new Engine.Game().setup().toJSON());
        storage.clearAll();
        equal(backend.getItem(StorageAPI.KEYS.game), null);
        equal(backend.getItem(StorageAPI.KEYS.best), null);
        equal(backend.getItem(StorageAPI.KEYS.settings), null);
    });

    /* --- 連續輸入的一致性 --- */

    test('連續多步後分數等於每步所得總和', function () {
        var game = new Engine.Game({ rng: Math.random });
        game.setup();
        var total = 0;
        var directions = ['left', 'up', 'right', 'down'];
        for (var i = 0; i < 300 && !game.over; i++) {
            var result = game.move(directions[i % 4]);
            total += result.gained;
        }
        equal(game.score, total, '總分應等於各步得分累加');
        ok(game.tiles().length <= 16, '方塊數不應超過格數');
        game.tiles().forEach(function (tile) {
            ok(tile.value >= 2 && (tile.value & (tile.value - 1)) === 0, '所有方塊都應是 2 的次方');
        });
    });

    test('隨機對局不會出現重複 id 或重疊方塊', function () {
        var game = new Engine.Game({ rng: Math.random });
        game.setup();
        var directions = ['left', 'up', 'right', 'down'];
        for (var i = 0; i < 400 && !game.over; i++) {
            game.move(directions[Math.floor(Math.random() * 4)]);
            var ids = {};
            var cells = {};
            game.tiles().forEach(function (tile) {
                ok(!ids[tile.id], '方塊 id 應唯一');
                ids[tile.id] = true;
                var key = tile.row + ',' + tile.col;
                ok(!cells[key], '不應有兩個方塊在同一格');
                cells[key] = true;
                equal(game.tileAt(tile.row, tile.col), tile, '方塊座標應與格子一致');
            });
        }
    });

    return {
        tests: tests,
        helpers: { scriptedRng: scriptedRng, firstCellRng: firstCellRng, gameWith: gameWith, memoryBackend: memoryBackend }
    };
});
