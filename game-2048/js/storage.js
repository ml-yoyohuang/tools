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

    /* ---------- base64（瀏覽器與 Node 都能用） ---------- */

    function encodeText(text) {
        if (root && typeof root.btoa === 'function') {
            return root.btoa(unescape(encodeURIComponent(text)));
        }
        return Buffer.from(text, 'utf8').toString('base64');
    }

    function decodeText(code) {
        if (root && typeof root.atob === 'function') {
            return decodeURIComponent(escape(root.atob(code)));
        }
        return Buffer.from(code, 'base64').toString('utf8');
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

    /* ---------- 匯出與匯入 ---------- */

    /** 把本局進度、最高分與偏好設定打包成一串文字。 */
    Storage.prototype.exportText = function (payload) {
        var body = {
            v: SAVE_VERSION,
            savedAt: Date.now(),
            game: (payload && payload.game) || null,
            best: (payload && isInt(payload.best) && payload.best >= 0) ? payload.best : 0,
            settings: validateSettings(payload && payload.settings)
        };
        return 'T2048-1:' + encodeText(JSON.stringify(body));
    };

    /**
     * 解析匯入字串。只回傳解析結果，不寫入任何東西，
     * 由呼叫端確認成功後才套用，因此失敗不可能覆寫原存檔。
     * 回傳 { ok, data, reason }
     */
    Storage.prototype.parseImport = function (text) {
        if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'empty' };
        var body = text.trim();
        if (body.indexOf('T2048-1:') === 0) body = body.slice('T2048-1:'.length);

        var json;
        try {
            // 以 { 或 [ 開頭視為直接貼上的明文 JSON，其餘當 base64
            var head = body.charAt(0);
            json = (head === '{' || head === '[') ? body : decodeText(body);
        } catch (err) {
            return { ok: false, reason: 'decode' };
        }

        var payload;
        try {
            payload = JSON.parse(json);
        } catch (err) {
            return { ok: false, reason: 'json' };
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return { ok: false, reason: 'shape' };
        }
        if (isInt(payload.v) && payload.v > SAVE_VERSION) {
            return { ok: false, reason: 'version-too-new' };
        }

        // 本局進度可以是空的（例如剛開新局就匯出），但有值就必須通過驗證
        var game = null;
        if (payload.game !== null && payload.game !== undefined) {
            var checked = validateGame(payload.game);
            if (!checked.ok) return { ok: false, reason: 'game:' + checked.reason };
            game = checked.data;
        }

        var best = (isInt(payload.best) && payload.best >= 0) ? payload.best : 0;
        if (game && game.score > best) best = game.score;   // 最高分不該低於本局分數

        return {
            ok: true,
            data: { game: game, best: best, settings: validateSettings(payload.settings) }
        };
    };

    /** 套用已驗證的匯入資料。 */
    Storage.prototype.applyImport = function (data) {
        if (!data) return false;
        if (data.game) this.saveGame(data.game);
        else this.clearGame();
        this.saveBest(data.best);
        this.saveSettings(data.settings);
        return true;
    };

    return {
        Storage: Storage,
        validateGame: validateGame,
        encodeText: encodeText,
        decodeText: decodeText,
        validateSettings: validateSettings,
        isPowerOfTwoTile: isPowerOfTwoTile,
        DEFAULT_SETTINGS: DEFAULT_SETTINGS,
        THEMES: THEMES,
        MOTIONS: MOTIONS,
        KEYS: KEYS,
        SAVE_VERSION: SAVE_VERSION
    };
});
