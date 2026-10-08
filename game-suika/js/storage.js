/*!
 * 果實合成 - 最高分與偏好設定
 * localStorage 不可用、寫入失敗或資料損壞時，遊戲照常運作。
 */
(function (root, factory) {
    'use strict';
    var api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SuikaStorage = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
    'use strict';

    var KEYS = {
        best: 'tools.suika.best.v1',
        settings: 'tools.suika.settings.v1'
    };

    var MOTIONS = ['system', 'full', 'reduced'];
    var DEFAULT_SETTINGS = { motion: 'system' };

    function detect(backend) {
        if (backend) return { available: true, backend: backend };
        try {
            var ls = root && root.localStorage ? root.localStorage : null;
            if (!ls) return { available: false, backend: null };
            var probe = 'tools.suika.probe';
            ls.setItem(probe, '1');
            ls.removeItem(probe);
            return { available: true, backend: ls };
        } catch (err) {
            return { available: false, backend: null };
        }
    }

    function isNonNegativeInt(value) {
        return typeof value === 'number' && isFinite(value) && value >= 0 && Math.floor(value) === value;
    }

    function validateSettings(raw) {
        var settings = { motion: DEFAULT_SETTINGS.motion };
        if (!raw || typeof raw !== 'object') return settings;
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

    function Storage(options) {
        options = options || {};
        var found = detect(options.backend);
        this.available = found.available;
        this.backend = found.backend;
        this.writeFailed = false;
    }

    Storage.prototype._read = function (key) {
        if (!this.available) return null;
        try { return this.backend.getItem(key); } catch (err) { return null; }
    };

    Storage.prototype._write = function (key, value) {
        if (!this.available) return false;
        try {
            this.backend.setItem(key, value);
            return true;
        } catch (err) {
            this.writeFailed = true;   // 容量不足或被封鎖
            return false;
        }
    };

    Storage.prototype._remove = function (key) {
        if (!this.available) return false;
        try { this.backend.removeItem(key); return true; } catch (err) { return false; }
    };

    /** 最高分：任何無法解析或不合理的值都回 0。 */
    Storage.prototype.loadBest = function () {
        var value = parseInt(this._read(KEYS.best), 10);
        return isNonNegativeInt(value) ? value : 0;
    };

    Storage.prototype.saveBest = function (value) {
        if (!isNonNegativeInt(value)) return false;
        return this._write(KEYS.best, String(value));
    };

    Storage.prototype.loadSettings = function () {
        var text = this._read(KEYS.settings);
        if (!text) return validateSettings(null);
        try {
            return validateSettings(JSON.parse(text));
        } catch (err) {
            this._remove(KEYS.settings);   // 損壞就丟掉，回到預設
            return validateSettings(null);
        }
    };

    Storage.prototype.saveSettings = function (settings) {
        return this._write(KEYS.settings, JSON.stringify(validateSettings(settings)));
    };

    /* ---------- 匯出與匯入 ---------- */

    /**
     * 把最高分與偏好設定打包成一串文字。
     * 這個遊戲不保存進行中的盤面，所以匯出的就是這兩項。
     */
    Storage.prototype.exportText = function (payload) {
        var best = (payload && isNonNegativeInt(payload.best)) ? payload.best : 0;
        var body = { v: 1, savedAt: Date.now(), best: best, settings: validateSettings(payload && payload.settings) };
        return 'SUIKA1:' + encodeText(JSON.stringify(body));
    };

    /**
     * 解析匯入字串。只回傳解析結果，不寫入任何東西，
     * 由呼叫端確認成功後才套用，因此失敗不可能覆寫原紀錄。
     * 回傳 { ok, data, reason }
     */
    Storage.prototype.parseImport = function (text) {
        if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'empty' };
        var body = text.trim();
        if (body.indexOf('SUIKA1:') === 0) body = body.slice('SUIKA1:'.length);

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
        if (typeof payload.v === 'number' && payload.v > 1) {
            return { ok: false, reason: 'version-too-new' };
        }
        if (!isNonNegativeInt(payload.best)) return { ok: false, reason: 'best' };

        return { ok: true, data: { best: payload.best, settings: validateSettings(payload.settings) } };
    };

    /** 套用已驗證的匯入資料。 */
    Storage.prototype.applyImport = function (data) {
        if (!data) return false;
        this.saveBest(data.best);
        this.saveSettings(data.settings);
        return true;
    };

    Storage.prototype.clearAll = function () {
        this._remove(KEYS.best);
        this._remove(KEYS.settings);
        this.writeFailed = false;
        return true;
    };

    return {
        Storage: Storage,
        validateSettings: validateSettings,
        encodeText: encodeText,
        decodeText: decodeText,
        KEYS: KEYS,
        MOTIONS: MOTIONS,
        DEFAULT_SETTINGS: DEFAULT_SETTINGS
    };
});
