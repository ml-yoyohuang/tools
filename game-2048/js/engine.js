/*!
 * 2048 核心規則引擎（純邏輯，不依賴 DOM）
 * 可注入亂數來源，方便重現測試。
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.Game2048Engine = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var DEFAULT_SIZE = 4;
    var WIN_VALUE = 2048;
    var SAVE_VERSION = 1;

    var VECTORS = {
        up: { dr: -1, dc: 0 },
        down: { dr: 1, dc: 0 },
        left: { dr: 0, dc: -1 },
        right: { dr: 0, dc: 1 }
    };

    var DIRECTIONS = Object.keys(VECTORS);

    /**
     * 盤面以一維陣列儲存，索引 = row * size + col，格子內容為 tile 物件或 null。
     * tile: { id, value, row, col, prevRow, prevCol, isNew, mergedFrom }
     * prevRow / prevCol 為本回合移動前的位置（供動畫使用），isNew 代表本回合生成。
     */
    function Game(options) {
        options = options || {};
        this.size = options.size || DEFAULT_SIZE;
        this.winValue = options.winValue || WIN_VALUE;
        this.rng = options.rng || Math.random;
        this._nextId = 1;
        this.reset();
    }

    Game.prototype.reset = function () {
        this.cells = new Array(this.size * this.size).fill(null);
        this.score = 0;
        this.moves = 0;
        this.won = false;
        this.keepPlaying = false;
        this.over = false;
        this.lastGained = 0;
        this.lastSpawnId = null;
    };

    /** 開新局：清空並在不同空格生成兩個方塊。 */
    Game.prototype.setup = function () {
        this.reset();
        this.addRandomTile();
        this.addRandomTile();
        return this;
    };

    Game.prototype.index = function (row, col) {
        return row * this.size + col;
    };

    Game.prototype.tileAt = function (row, col) {
        if (row < 0 || col < 0 || row >= this.size || col >= this.size) return null;
        return this.cells[this.index(row, col)];
    };

    Game.prototype.setTile = function (row, col, tile) {
        this.cells[this.index(row, col)] = tile;
        if (tile) {
            tile.row = row;
            tile.col = col;
        }
    };

    Game.prototype.tiles = function () {
        var list = [];
        for (var i = 0; i < this.cells.length; i++) {
            if (this.cells[i]) list.push(this.cells[i]);
        }
        return list;
    };

    Game.prototype.emptyCells = function () {
        var list = [];
        for (var i = 0; i < this.cells.length; i++) {
            if (!this.cells[i]) list.push(i);
        }
        return list;
    };

    Game.prototype.maxTile = function () {
        var max = 0;
        for (var i = 0; i < this.cells.length; i++) {
            if (this.cells[i] && this.cells[i].value > max) max = this.cells[i].value;
        }
        return max;
    };

    Game.prototype.createTile = function (row, col, value) {
        return {
            id: this._nextId++,
            value: value,
            row: row,
            col: col,
            prevRow: null,
            prevCol: null,
            isNew: true,
            mergedFrom: null
        };
    };

    /** 從空格中均勻隨機挑一格，90% 生成 2、10% 生成 4。 */
    Game.prototype.addRandomTile = function () {
        var empty = this.emptyCells();
        if (!empty.length) return null;
        var slot = Math.floor(this.rng() * empty.length);
        if (!(slot >= 0 && slot < empty.length)) slot = 0;
        var pick = empty[slot];
        var value = this.rng() < 0.9 ? 2 : 4;
        var row = Math.floor(pick / this.size);
        var col = pick % this.size;
        var tile = this.createTile(row, col, value);
        this.cells[pick] = tile;
        return tile;
    };

    /** 取得某條線上的座標，順序由移動方向的邊界往內。 */
    Game.prototype.lineCoords = function (lineIndex, direction) {
        var size = this.size;
        var coords = [];
        var i;
        if (direction === 'left' || direction === 'right') {
            for (i = 0; i < size; i++) {
                coords.push({ row: lineIndex, col: direction === 'left' ? i : size - 1 - i });
            }
        } else {
            for (i = 0; i < size; i++) {
                coords.push({ row: direction === 'up' ? i : size - 1 - i, col: lineIndex });
            }
        }
        return coords;
    };

    /**
     * 執行一次移動。
     * 回傳 { moved, gained, merges, spawned, won, over }。
     * 只有 moved 為 true（盤面真的改變）才會生成新方塊並增加步數。
     */
    Game.prototype.move = function (direction) {
        if (!VECTORS[direction]) throw new Error('未知的方向：' + direction);
        if (this.over) {
            return { moved: false, gained: 0, merges: [], spawned: null, won: false, over: true };
        }

        var self = this;
        var before = this.tiles();
        before.forEach(function (tile) {
            tile.prevRow = tile.row;
            tile.prevCol = tile.col;
            tile.isNew = false;
            tile.mergedFrom = null;
        });

        var moved = false;
        var gained = 0;
        var merges = [];
        var justWon = false;
        var line, i, j;

        for (line = 0; line < this.size; line++) {
            var coords = this.lineCoords(line, direction);
            var existing = [];
            coords.forEach(function (pos) {
                var tile = self.tileAt(pos.row, pos.col);
                if (tile) existing.push(tile);
            });

            var result = [];
            for (i = 0; i < existing.length; i++) {
                var current = existing[i];
                var next = existing[i + 1];
                // 每個方塊每回合最多合併一次：合併後直接跳過下一個，
                // 新產生的方塊只放進 result，不再參與本回合後續比較。
                if (next && next.value === current.value) {
                    var target = coords[result.length];
                    var merged = this.createTile(target.row, target.col, current.value * 2);
                    merged.isNew = false;
                    merged.mergedFrom = [
                        { id: current.id, value: current.value, prevRow: current.prevRow, prevCol: current.prevCol },
                        { id: next.id, value: next.value, prevRow: next.prevRow, prevCol: next.prevCol }
                    ];
                    gained += merged.value;
                    merges.push(merged.value);
                    if (merged.value >= this.winValue && !this.won) {
                        this.won = true;
                        justWon = true;
                    }
                    result.push(merged);
                    moved = true;
                    i++;
                } else {
                    result.push(current);
                }
            }

            for (j = 0; j < coords.length; j++) {
                var pos2 = coords[j];
                var tile2 = result[j] || null;
                if (tile2 && !tile2.mergedFrom && (tile2.row !== pos2.row || tile2.col !== pos2.col)) {
                    moved = true;
                }
                this.setTile(pos2.row, pos2.col, tile2);
            }
        }

        if (!moved) {
            // 無效移動：不計分、不生成方塊、不增加步數，呼叫端也不應覆寫悔棋紀錄。
            before.forEach(function (tile) {
                tile.prevRow = tile.row;
                tile.prevCol = tile.col;
            });
            this.lastGained = 0;
            this.lastSpawnId = null;
            return { moved: false, gained: 0, merges: [], spawned: null, won: false, over: this.over };
        }

        this.score += gained;
        this.moves += 1;
        var spawned = this.addRandomTile();
        this.lastGained = gained;
        this.lastSpawnId = spawned ? spawned.id : null;
        this.over = !this.movesAvailable();

        return {
            moved: true,
            gained: gained,
            merges: merges,
            spawned: spawned,
            won: justWon,
            over: this.over
        };
    };

    /** 是否還有可走的步。純查詢，不會改動正式棋盤。 */
    Game.prototype.movesAvailable = function () {
        for (var i = 0; i < this.cells.length; i++) {
            if (!this.cells[i]) return true;
        }
        for (var row = 0; row < this.size; row++) {
            for (var col = 0; col < this.size; col++) {
                var tile = this.tileAt(row, col);
                if (!tile) continue;
                var right = this.tileAt(row, col + 1);
                var down = this.tileAt(row + 1, col);
                if (right && right.value === tile.value) return true;
                if (down && down.value === tile.value) return true;
            }
        }
        return false;
    };

    Game.prototype.isOver = function () {
        return !this.movesAvailable();
    };

    /** 盤面數值快照（測試與存檔用），空格為 0。 */
    Game.prototype.valueGrid = function () {
        var grid = [];
        for (var row = 0; row < this.size; row++) {
            var line = [];
            for (var col = 0; col < this.size; col++) {
                var tile = this.tileAt(row, col);
                line.push(tile ? tile.value : 0);
            }
            grid.push(line);
        }
        return grid;
    };

    Game.prototype.toJSON = function () {
        return {
            v: SAVE_VERSION,
            size: this.size,
            score: this.score,
            moves: this.moves,
            won: this.won,
            keepPlaying: this.keepPlaying,
            over: this.over,
            grid: this.valueGrid()
        };
    };

    /** 從（已驗證的）資料還原盤面；還原後的方塊視為靜態，不帶動畫資訊。 */
    Game.prototype.load = function (data) {
        this.size = data.size;
        this.cells = new Array(this.size * this.size).fill(null);
        for (var row = 0; row < this.size; row++) {
            for (var col = 0; col < this.size; col++) {
                var value = data.grid[row][col];
                if (value) {
                    var tile = this.createTile(row, col, value);
                    tile.isNew = false;
                    this.cells[this.index(row, col)] = tile;
                }
            }
        }
        this.score = data.score;
        this.moves = data.moves;
        this.won = !!data.won;
        this.keepPlaying = !!data.keepPlaying;
        this.over = typeof data.over === 'boolean' ? data.over : !this.movesAvailable();
        this.lastGained = 0;
        this.lastSpawnId = null;
        return this;
    };

    /** 以數值矩陣直接布置盤面（測試與情境重現用）。 */
    Game.prototype.setGrid = function (grid) {
        this.size = grid.length;
        this.cells = new Array(this.size * this.size).fill(null);
        for (var row = 0; row < this.size; row++) {
            for (var col = 0; col < this.size; col++) {
                var value = grid[row][col];
                if (value) {
                    var tile = this.createTile(row, col, value);
                    tile.isNew = false;
                    this.cells[this.index(row, col)] = tile;
                }
            }
        }
        this.over = !this.movesAvailable();
        return this;
    };

    return {
        Game: Game,
        DIRECTIONS: DIRECTIONS,
        VECTORS: VECTORS,
        WIN_VALUE: WIN_VALUE,
        SAVE_VERSION: SAVE_VERSION,
        DEFAULT_SIZE: DEFAULT_SIZE
    };
});
