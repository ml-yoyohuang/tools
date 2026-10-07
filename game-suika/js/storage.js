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

    Storage.prototype.clearAll = function () {
        this._remove(KEYS.best);
        this._remove(KEYS.settings);
        this.writeFailed = false;
        return true;
    };

    return {
        Storage: Storage,
        validateSettings: validateSettings,
        KEYS: KEYS,
        MOTIONS: MOTIONS,
        DEFAULT_SETTINGS: DEFAULT_SETTINGS
    };
});
