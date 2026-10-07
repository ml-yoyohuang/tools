/*!
 * 存檔與偏好設定（localStorage）
 * 所有讀取都先驗證結構與合理性，不直接信任儲存內容。
 */
(function (root, factory) {
    'use strict';
    var api = factory(root);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.Game2048Storage = api;
    }
})(typeof self !== 'undefined' ? self : this, function (root) {
    'use strict';

    var KEYS = {
        game: 'tools.2048.game.v1',
        best: 'tools.2048.best.v1',
        settings: 'tools.2048.settings.v1'
    };

    var SAVE_VERSION = 1;
    var MAX_VALUE = Math.pow(2, 20); // 1048576，超過視為不合理資料
    var THEMES = ['system', 'light', 'dark'];
    var MOTIONS = ['system', 'full', 'reduced'];

    var DEFAULT_SETTINGS = { theme: 'system', motion: 'system' };

    /** 包一層偵測：localStorage 可能被停用或丟出例外。 */
    function probe() {
        try {
            var ls = root && root.localStorage ? root.localStorage : null;
            if (!ls) return { available: false, reason: 'unavailable' };
            var probeKey = 'tools.2048.probe';
            ls.setItem(probeKey, '1');
            ls.removeItem(probeKey);
            return { available: true, storage: ls, reason: null };
        } catch (err) {
            return { available: false, reason: err && err.name === 'SecurityError' ? 'blocked' : 'error' };
        }
    }

    function isInt(value) {
        return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
    }

    function isPowerOfTwoTile(value) {
        if (!isInt(value) || value < 2 || value > MAX_VALUE) return false;
        return (value & (value - 1)) === 0;
    }

    /**
     * 驗證存檔結構與合理性。回傳 { ok, data, reason }。
     * 任何欄位不符即整份拒絕，由呼叫端決定如何提示。
     */
    function validateGame(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'shape' };
        if (raw.v !== SAVE_VERSION) return { ok: false, reason: 'version' };
        if (!isInt(raw.size) || raw.size < 2 || raw.size > 8) return { ok: false, reason: 'size' };
        if (!Array.isArray(raw.grid) || raw.grid.length !== raw.size) return { ok: false, reason: 'grid' };

        var filled = 0;
        var maxValue = 0;
        for (var row = 0; row < raw.size; row++) {
            var line = raw.grid[row];
            if (!Array.isArray(line) || line.length !== raw.size) return { ok: false, reason: 'grid' };
            for (var col = 0; col < raw.size; col++) {
                var value = line[col];
                if (value === 0) continue;
                if (!isPowerOfTwoTile(value)) return { ok: false, reason: 'tile' };
                filled++;
                if (value > maxValue) maxValue = value;
            }
        }

        if (!isInt(raw.score) || raw.score < 0 || raw.score > Number.MAX_SAFE_INTEGER) return { ok: false, reason: 'score' };
        if (!isInt(raw.moves) || raw.moves < 0) return { ok: false, reason: 'moves' };
        if (typeof raw.won !== 'boolean' || typeof raw.keepPlaying !== 'boolean') return { ok: false, reason: 'flags' };
        if (raw.over !== undefined && typeof raw.over !== 'boolean') return { ok: false, reason: 'flags' };
        if (filled === 0) return { ok: false, reason: 'empty' };
        if (raw.won && maxValue < 2048) return { ok: false, reason: 'inconsistent' };

        return {
            ok: true,
            data: {
                v: raw.v,
                size: raw.size,
                score: raw.score,
                moves: raw.moves,
                won: raw.won,
                keepPlaying: raw.keepPlaying,
                over: raw.over,
                grid: raw.grid.map(function (line) { return line.slice(); })
            }
        };
    }

    function validateSettings(raw) {
        var settings = { theme: DEFAULT_SETTINGS.theme, motion: DEFAULT_SETTINGS.motion };
        if (!raw || typeof raw !== 'object') return settings;
        if (THEMES.indexOf(raw.theme) !== -1) settings.theme = raw.theme;
        if (MOTIONS.indexOf(raw.motion) !== -1) settings.motion = raw.motion;
        return settings;
    }

    /**
     * Storage 物件：對外只暴露語意化方法，內部吞掉所有例外並記錄最後的錯誤原因。
     */
    function Storage(options) {
        options = options || {};
        var detected = options.backend ? { available: true, storage: options.backend } : probe();
        this.available = detected.available;
        this.backend = detected.storage || null;
        this.lastError = detected.available ? null : (detected.reason || 'unavailable');
        this.quotaExceeded = false;
    }

    Storage.prototype._read = function (key) {
        if (!this.available) return null;
        try {
            return this.backend.getItem(key);
        } catch (err) {
            this.lastError = 'read';
            return null;
        }
    };

    Storage.prototype._write = function (key, value) {
        if (!this.available) return false;
        try {
            this.backend.setItem(key, value);
            return true;
        } catch (err) {
            // QuotaExceededError 或隱私模式下的寫入失敗
            this.quotaExceeded = true;
            this.lastError = 'quota';
            return false;
        }
    };

    Storage.prototype._remove = function (key) {
        if (!this.available) return false;
        try {
            this.backend.removeItem(key);
            return true;
        } catch (err) {
            this.lastError = 'remove';
            return false;
        }
    };

    /** 讀取本局進度。回傳 { status: 'ok'|'none'|'corrupt', data, reason } */
    Storage.prototype.loadGame = function () {
        var text = this._read(KEYS.game);
        if (text === null || text === undefined || text === '') return { status: 'none', data: null };
        var parsed;
        try {
            parsed = JSON.parse(text);
        } catch (err) {
            this._remove(KEYS.game);
            return { status: 'corrupt', data: null, reason: 'json' };
        }
        var result = validateGame(parsed);
        if (!result.ok) {
            this._remove(KEYS.game);
            return { status: 'corrupt', data: null, reason: result.reason };
        }
        return { status: 'ok', data: result.data };
    };

    Storage.prototype.saveGame = function (state) {
        try {
            return this._write(KEYS.game, JSON.stringify(state));
        } catch (err) {
            return false;
        }
    };

    Storage.prototype.clearGame = function () {
        return this._remove(KEYS.game);
    };

    Storage.prototype.loadBest = function () {
        var text = this._read(KEYS.best);
        var value = parseInt(text, 10);
        if (!isInt(value) || value < 0) return 0;
        return value;
    };

    Storage.prototype.saveBest = function (value) {
        if (!isInt(value) || value < 0) return false;
        return this._write(KEYS.best, String(value));
    };

    Storage.prototype.loadSettings = function () {
        var text = this._read(KEYS.settings);
        if (!text) return validateSettings(null);
        try {
            return validateSettings(JSON.parse(text));
        } catch (err) {
            this._remove(KEYS.settings);
            return validateSettings(null);
        }
    };

    Storage.prototype.saveSettings = function (settings) {
        return this._write(KEYS.settings, JSON.stringify(validateSettings(settings)));
    };

    /** 清除所有本遊戲的紀錄。 */
    Storage.prototype.clearAll = function () {
        var ok = true;
        ok = this._remove(KEYS.game) && ok;
        ok = this._remove(KEYS.best) && ok;
        ok = this._remove(KEYS.settings) && ok;
        this.quotaExceeded = false;
        return ok;
    };

    return {
        Storage: Storage,
        validateGame: validateGame,
        validateSettings: validateSettings,
        isPowerOfTwoTile: isPowerOfTwoTile,
        DEFAULT_SETTINGS: DEFAULT_SETTINGS,
        THEMES: THEMES,
        MOTIONS: MOTIONS,
        KEYS: KEYS,
        SAVE_VERSION: SAVE_VERSION
    };
});
