/*!
 * 對局狀態：在規則引擎之外管理最高分與悔棋紀錄。
 * 同樣不依賴 DOM，方便測試。
 */
(function (root, factory) {
    'use strict';
    var api = factory(
        typeof module === 'object' && module.exports ? require('./engine.js') : root.Game2048Engine
    );
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.Game2048Session = api;
    }
})(typeof self !== 'undefined' ? self : this, function (Engine) {
    'use strict';

    function Session(options) {
        options = options || {};
        this.game = new Engine.Game({ size: options.size, rng: options.rng });
        this.best = options.best || 0;
        this.undoSnapshot = null;
        this.canUndo = false;
    }

    Session.prototype.newGame = function () {
        this.game.setup();
        this.undoSnapshot = null;
        this.canUndo = false;
        return this;
    };

    /**
     * 執行一步。有效移動才會寫入悔棋紀錄與更新最高分。
     * 回傳引擎的結果並補上 { bestChanged }。
     */
    Session.prototype.move = function (direction) {
        var snapshot = this.game.toJSON();
        var result = this.game.move(direction);
        if (!result.moved) {
            // 無效移動：悔棋紀錄維持原樣
            result.bestChanged = false;
            return result;
        }
        this.undoSnapshot = snapshot;
        this.canUndo = true;
        var bestChanged = false;
        if (this.game.score > this.best) {
            this.best = this.game.score;
            bestChanged = true;
        }
        result.bestChanged = bestChanged;
        return result;
    };

    /** 回到上一個有效移動之前。最高分不會跟著倒退，且不可連續悔棋。 */
    Session.prototype.undo = function () {
        if (!this.canUndo || !this.undoSnapshot) return false;
        this.game.load(this.undoSnapshot);
        this.undoSnapshot = null;
        this.canUndo = false;
        return true;
    };

    /** 達成 2048 後選擇繼續挑戰：之後不再跳出勝利提示。 */
    Session.prototype.continuePlaying = function () {
        this.game.keepPlaying = true;
        return this;
    };

    /** 從存檔還原（資料需先經 storage 驗證）。 */
    Session.prototype.restore = function (data, best) {
        this.game.load(data);
        this.best = Math.max(best || 0, this.game.score);
        this.undoSnapshot = null;
        this.canUndo = false;
        return this;
    };

    Session.prototype.stats = function () {
        return {
            score: this.game.score,
            best: this.best,
            moves: this.game.moves,
            max: this.game.maxTile(),
            won: this.game.won,
            keepPlaying: this.game.keepPlaying,
            over: this.game.over,
            canUndo: this.canUndo
        };
    };

    return { Session: Session };
});
