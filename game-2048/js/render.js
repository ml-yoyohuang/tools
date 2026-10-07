/*!
 * 畫面渲染與動畫
 * 以 tile id 追蹤方塊身分：同一個 id 重用同一個 DOM 節點，
 * 合併時保留兩個來源節點滑到目標位置，再疊上新方塊，避免重影或跳位。
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.Game2048Render = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function Renderer(options) {
        this.gridEl = options.gridEl;
        this.tilesEl = options.tilesEl;
        this.size = options.size || 4;
        this.moveDuration = options.moveDuration || 110;
        this.popDuration = options.popDuration || 150;
        this.reduceMotion = !!options.reduceMotion;
        this.nodes = new Map();   // tile id -> DOM 節點
        this.ghosts = [];         // 合併動畫中暫留的來源節點
        this.timers = [];
        this.generation = 0;      // 每次渲染遞增，讓舊的延遲回呼失效
        this.buildGrid();
    }

    Renderer.prototype.buildGrid = function () {
        var frag = document.createDocumentFragment();
        for (var i = 0; i < this.size * this.size; i++) {
            var cell = document.createElement('div');
            cell.className = 'board__cell';
            frag.appendChild(cell);
        }
        this.gridEl.textContent = '';
        this.gridEl.appendChild(frag);
    };

    Renderer.prototype.setReduceMotion = function (value) {
        this.reduceMotion = !!value;
    };

    /** 取消所有待執行的清理，避免重新開始／悔棋時被舊動畫覆寫。 */
    Renderer.prototype.cancelPending = function () {
        this.generation++;
        this.timers.forEach(function (id) { clearTimeout(id); });
        this.timers = [];
        this.ghosts.forEach(function (node) {
            if (node.parentNode) node.parentNode.removeChild(node);
        });
        this.ghosts = [];
    };

    Renderer.prototype._later = function (fn, delay) {
        var self = this;
        var gen = this.generation;
        var id = setTimeout(function () {
            if (gen !== self.generation) return;   // 已被新的渲染取代
            fn();
        }, delay);
        this.timers.push(id);
    };

    Renderer.prototype._position = function (node, row, col) {
        node.style.setProperty('--row', row);
        node.style.setProperty('--col', col);
    };

    Renderer.prototype._paint = function (node, value) {
        var text = String(value);
        node.dataset.value = text;
        node.dataset.len = String(text.length);
        if (value > 2048) {
            node.dataset.super = 'true';
        } else {
            delete node.dataset.super;
        }
        var inner = node.firstChild;
        if (inner.textContent !== text) inner.textContent = text;
    };

    Renderer.prototype._createNode = function (tile, extraClass) {
        var node = document.createElement('div');
        node.className = 'tile' + (extraClass ? ' ' + extraClass : '');
        var inner = document.createElement('span');
        inner.className = 'tile__inner';
        node.appendChild(inner);
        this._paint(node, tile.value);
        return node;
    };

    /**
     * 將遊戲狀態畫到畫面上。
     * @param {Array} tiles 目前盤面上的方塊（含 prevRow/prevCol/isNew/mergedFrom）
     * @param {Object} opts { animate: boolean }
     */
    Renderer.prototype.render = function (tiles, opts) {
        opts = opts || {};
        var self = this;
        var animate = !!opts.animate && !this.reduceMotion;
        var moveMs = this.reduceMotion ? 0 : this.moveDuration;

        this.cancelPending();

        var seen = new Set();
        var fragment = document.createDocumentFragment();
        var pendingPositions = [];

        tiles.forEach(function (tile) {
            seen.add(tile.id);
            var node = self.nodes.get(tile.id);

            if (node) {
                // 既有方塊：更新數值與位置，交給 CSS transition 做滑動
                self._paint(node, tile.value);
                node.classList.remove('tile--new', 'tile--merged', 'is-animating');
                self._position(node, tile.row, tile.col);
                return;
            }

            if (tile.mergedFrom && animate) {
                // 合併產生的新方塊：先放到目標位置，動畫延遲到滑動結束後彈出
                node = self._createNode(tile, 'tile--merged is-animating');
                self._position(node, tile.row, tile.col);

                tile.mergedFrom.forEach(function (source) {
                    var ghost = self.nodes.get(source.id);
                    if (!ghost) return;
                    self.nodes.delete(source.id);
                    ghost.classList.add('tile--ghost');
                    self._position(ghost, tile.row, tile.col);
                    self.ghosts.push(ghost);
                });
                self._later(function () {
                    self.ghosts.forEach(function (ghost) {
                        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
                    });
                    self.ghosts = [];
                }, moveMs + 20);
            } else if (tile.mergedFrom) {
                node = self._createNode(tile, 'tile--merged');
                self._position(node, tile.row, tile.col);
                tile.mergedFrom.forEach(function (source) {
                    var ghost = self.nodes.get(source.id);
                    if (ghost) {
                        self.nodes.delete(source.id);
                        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
                    }
                });
            } else if (tile.isNew && animate) {
                node = self._createNode(tile, 'tile--new is-animating');
                self._position(node, tile.row, tile.col);
            } else {
                node = self._createNode(tile, '');
                self._position(node, tile.row, tile.col);
            }

            self.nodes.set(tile.id, node);
            fragment.appendChild(node);
            pendingPositions.push({ node: node, tile: tile });
        });

        // 移除已不存在的方塊（合併來源的 ghost 已另外處理）
        this.nodes.forEach(function (node, id) {
            if (seen.has(id)) return;
            self.nodes.delete(id);
            if (node.parentNode) node.parentNode.removeChild(node);
        });

        if (fragment.childNodes.length) this.tilesEl.appendChild(fragment);
        // 讀一次版面，確保新節點的初始 transform 已套用，後續變更才會有過場
        if (pendingPositions.length) void this.tilesEl.offsetHeight;
    };

    /** 不帶任何動畫地重畫（載入存檔、悔棋、重新開始時使用）。 */
    Renderer.prototype.renderStatic = function (tiles) {
        this.cancelPending();
        this.nodes.forEach(function (node) {
            if (node.parentNode) node.parentNode.removeChild(node);
        });
        this.nodes.clear();
        this.tilesEl.textContent = '';
        this.render(tiles, { animate: false });
    };

    return { Renderer: Renderer };
});
