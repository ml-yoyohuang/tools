/*!
 * 存檔：自動／手動保存、匯出、匯入、版本遷移、多分頁協調
 *
 * 讀取一律先驗證結構與合理性；匯入失敗絕不覆寫原存檔。
 * localStorage 不可用、容量不足或資料損壞時，遊戲仍能遊玩（只是不保存）。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var deps = isNode
        ? { Config: require('./config.js'), Content: require('./content.js') }
        : { Config: root.BakeryConfig, Content: root.BakeryContent };
    var api = factory(deps, root);
    if (isNode) module.exports = api;
    else root.BakeryStorage = api;
})(typeof self !== 'undefined' ? self : this, function (deps, root) {
    'use strict';

    var Config = deps.Config;
    var Content = deps.Content;

    var KEYS = {
        save: 'tools.bakery.save',
        settings: 'tools.bakery.settings',
        lock: 'tools.bakery.lock'
    };

    var DEFAULT_SETTINGS = { theme: 'system', motion: 'system', buyMode: 1, numberStyle: 'short' };
    var THEMES = ['system', 'light', 'dark'];
    var MOTIONS = ['system', 'full', 'reduced'];
    var BUY_MODES = [1, 10, 'max'];
    var NUMBER_STYLES = ['short', 'full'];

    function isNum(value) {
        return typeof value === 'number' && isFinite(value);
    }

    function nonNegative(value) {
        return isNum(value) && value >= 0;
    }

    /* ---------------- 驗證 ---------------- */

    /**
     * 驗證存檔內容。未知的 ID 會被忽略（允許向前相容），
     * 但結構或數值不合理時整份拒絕。
     * 回傳 { ok, state, reason }
     */
    function validateState(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'shape' };

        var numberFields = ['cookies', 'baked', 'bakedAllTime', 'clicks', 'handBaked',
            'itemsUsed', 'goldenClicked', 'goldenSpawned', 'lastSettle', 'startedAt'];
        for (var i = 0; i < numberFields.length; i++) {
            var key = numberFields[i];
            if (raw[key] !== undefined && !nonNegative(raw[key])) return { ok: false, reason: 'number:' + key };
        }
        if (!nonNegative(raw.cookies)) return { ok: false, reason: 'number:cookies' };
        if (!nonNegative(raw.baked)) return { ok: false, reason: 'number:baked' };
        if (raw.baked < raw.cookies - 1) return { ok: false, reason: 'inconsistent' };

        if (!raw.buildings || typeof raw.buildings !== 'object') return { ok: false, reason: 'buildings' };
        var buildings = {};
        for (var b = 0; b < Config.BUILDINGS.length; b++) {
            var id = Config.BUILDINGS[b].id;
            var count = raw.buildings[id];
            if (count === undefined) { buildings[id] = 0; continue; }
            if (!nonNegative(count) || Math.floor(count) !== count || count > 1e7) {
                return { ok: false, reason: 'building:' + id };
            }
            buildings[id] = count;
        }

        var items = {};
        if (raw.items !== undefined && (typeof raw.items !== 'object' || !raw.items)) {
            return { ok: false, reason: 'items' };
        }
        for (var t = 0; t < Config.ITEMS.length; t++) {
            var itemId = Config.ITEMS[t].id;
            var have = raw.items ? raw.items[itemId] : 0;
            if (have === undefined) { items[itemId] = 0; continue; }
            if (!nonNegative(have) || Math.floor(have) !== have || have > 1e6) {
                return { ok: false, reason: 'item:' + itemId };
            }
            items[itemId] = have;
        }

        function pickFlags(source, known) {
            var out = {};
            if (!source || typeof source !== 'object') return out;
            known.forEach(function (entry) {
                if (source[entry.id] === true) out[entry.id] = true;
            });
            return out;
        }

        var buffs = { cps: null, click: null, discount: null };
        if (raw.buffs && typeof raw.buffs === 'object') {
            ['cps', 'click', 'discount'].forEach(function (channel) {
                var buff = raw.buffs[channel];
                if (!buff || typeof buff !== 'object') return;
                if (!nonNegative(buff.expiresAt)) return;
                buffs[channel] = {
                    expiresAt: buff.expiresAt,
                    mult: isNum(buff.mult) ? buff.mult : 1,
                    value: isNum(buff.value) ? buff.value : 0,
                    itemId: typeof buff.itemId === 'string' ? buff.itemId : null
                };
            });
        }

        var state = {
            version: Config.SAVE_VERSION,
            cookies: raw.cookies,
            baked: raw.baked,
            bakedAllTime: nonNegative(raw.bakedAllTime) ? Math.max(raw.bakedAllTime, raw.baked) : raw.baked,
            clicks: nonNegative(raw.clicks) ? Math.floor(raw.clicks) : 0,
            handBaked: nonNegative(raw.handBaked) ? raw.handBaked : 0,
            buildings: buildings,
            upgrades: pickFlags(raw.upgrades, Content.UPGRADES),
            achievements: pickFlags(raw.achievements, Content.ACHIEVEMENTS),
            claimedRewards: pickFlags(raw.claimedRewards, Content.ACHIEVEMENTS),
            items: items,
            itemsUsed: nonNegative(raw.itemsUsed) ? Math.floor(raw.itemsUsed) : 0,
            goldenClicked: nonNegative(raw.goldenClicked) ? Math.floor(raw.goldenClicked) : 0,
            goldenSpawned: nonNegative(raw.goldenSpawned) ? Math.floor(raw.goldenSpawned) : 0,
            buffs: buffs,
            combo: 0,
            lastClickAt: 0,
            golden: null,
            nextGoldenAt: nonNegative(raw.nextGoldenAt) ? raw.nextGoldenAt : 0,
            lastSettle: nonNegative(raw.lastSettle) ? raw.lastSettle : 0,
            startedAt: nonNegative(raw.startedAt) ? raw.startedAt : 0,
            playedMs: nonNegative(raw.playedMs) ? raw.playedMs : 0
        };
        return { ok: true, state: state };
    }

    /**
     * 版本遷移。回傳 { data, migrated }。
     * v1 → v2：補上 bakedAllTime 與 claimedRewards（舊版沒有這兩個欄位，
     *          若直接載入會讓已領過的成就獎勵再發一次）。
     */
    function migrate(payload) {
        var version = isNum(payload.v) ? payload.v : 1;
        var data = payload.state || payload.data || null;
        if (!data || typeof data !== 'object') return { data: null, migrated: false, from: version };
        var migrated = false;

        if (version < 2) {
            data.bakedAllTime = nonNegative(data.bakedAllTime) ? data.bakedAllTime : (data.baked || 0);
            // 舊存檔已解鎖的成就一律視為已領獎，避免重複發道具
            data.claimedRewards = data.claimedRewards || Object.assign({}, data.achievements || {});
            migrated = true;
            version = 2;
        }
        if (version > Config.SAVE_VERSION) return { data: null, migrated: false, from: version, tooNew: true };

        return { data: data, migrated: migrated, from: isNum(payload.v) ? payload.v : 1 };
    }

    /* ---------------- base64（瀏覽器與 Node 都能用） ---------------- */

    function encodeText(text) {
        if (typeof root.btoa === 'function') {
            return root.btoa(unescape(encodeURIComponent(text)));
        }
        return Buffer.from(text, 'utf8').toString('base64');
    }

    function decodeText(code) {
        if (typeof root.atob === 'function') {
            return decodeURIComponent(escape(root.atob(code)));
        }
        return Buffer.from(code, 'base64').toString('utf8');
    }

    /* ---------------- Storage ---------------- */

    function detect(backend) {
        if (backend) return { available: true, backend: backend };
        try {
            var ls = root && root.localStorage ? root.localStorage : null;
            if (!ls) return { available: false, backend: null };
            ls.setItem(KEYS.save + '.probe', '1');
            ls.removeItem(KEYS.save + '.probe');
            return { available: true, backend: ls };
        } catch (err) {
            return { available: false, backend: null };
        }
    }

    function Storage(options) {
        options = options || {};
        var found = detect(options.backend);
        this.available = found.available;
        this.backend = found.backend;
        this.now = options.now || function () { return Date.now(); };
        this.tabId = options.tabId || ('tab-' + Math.random().toString(36).slice(2, 10));
        this.writeFailed = false;
        this.lastError = null;
    }

    Storage.prototype._read = function (key) {
        if (!this.available) return null;
        try { return this.backend.getItem(key); } catch (err) { this.lastError = 'read'; return null; }
    };

    Storage.prototype._write = function (key, value) {
        if (!this.available) return false;
        try {
            this.backend.setItem(key, value);
            return true;
        } catch (err) {
            this.writeFailed = true;
            this.lastError = 'quota';
            return false;
        }
    };

    Storage.prototype._remove = function (key) {
        if (!this.available) return false;
        try { this.backend.removeItem(key); return true; } catch (err) { return false; }
    };

    Storage.prototype.save = function (state) {
        var payload = { v: Config.SAVE_VERSION, savedAt: this.now(), state: state };
        try {
            return this._write(KEYS.save, JSON.stringify(payload));
        } catch (err) {
            return false;
        }
    };

    /** 回傳 { status: 'ok' | 'none' | 'corrupt', state, migrated, reason } */
    Storage.prototype.load = function () {
        var text = this._read(KEYS.save);
        if (!text) return { status: 'none', state: null };

        var payload;
        try {
            payload = JSON.parse(text);
        } catch (err) {
            return { status: 'corrupt', state: null, reason: 'json' };
        }

        var step = migrate(payload);
        if (!step.data) {
            return { status: 'corrupt', state: null, reason: step.tooNew ? 'version-too-new' : 'shape' };
        }
        var checked = validateState(step.data);
        if (!checked.ok) return { status: 'corrupt', state: null, reason: checked.reason };

        return { status: 'ok', state: checked.state, migrated: step.migrated, from: step.from };
    };

    Storage.prototype.clearSave = function () { return this._remove(KEYS.save); };

    Storage.prototype.clearAll = function () {
        this._remove(KEYS.save);
        this._remove(KEYS.settings);
        this._remove(KEYS.lock);
        this.writeFailed = false;
        return true;
    };

    /* ---------------- 匯出／匯入 ---------------- */

    Storage.prototype.exportText = function (state) {
        var payload = { v: Config.SAVE_VERSION, savedAt: this.now(), state: state };
        return 'BAKERY1:' + encodeText(JSON.stringify(payload));
    };

    /**
     * 解析匯入字串。只回傳解析結果，不會寫入任何東西，
     * 由呼叫端確認成功後才套用，因此失敗不可能覆寫原存檔。
     */
    Storage.prototype.parseImport = function (text) {
        if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'empty' };
        var body = text.trim();
        if (body.indexOf('BAKERY1:') === 0) body = body.slice('BAKERY1:'.length);

        var json;
        try {
            json = body.charAt(0) === '{' ? body : decodeText(body);
        } catch (err) {
            return { ok: false, reason: 'decode' };
        }

        var payload;
        try {
            payload = JSON.parse(json);
        } catch (err) {
            return { ok: false, reason: 'json' };
        }

        var step = migrate(payload);
        if (!step.data) return { ok: false, reason: step.tooNew ? 'version-too-new' : 'shape' };
        var checked = validateState(step.data);
        if (!checked.ok) return { ok: false, reason: checked.reason };
        return { ok: true, state: checked.state, migrated: step.migrated };
    };

    /* ---------------- 偏好設定 ---------------- */

    function validateSettings(raw) {
        var out = Object.assign({}, DEFAULT_SETTINGS);
        if (!raw || typeof raw !== 'object') return out;
        if (THEMES.indexOf(raw.theme) !== -1) out.theme = raw.theme;
        if (MOTIONS.indexOf(raw.motion) !== -1) out.motion = raw.motion;
        if (BUY_MODES.indexOf(raw.buyMode) !== -1) out.buyMode = raw.buyMode;
        if (NUMBER_STYLES.indexOf(raw.numberStyle) !== -1) out.numberStyle = raw.numberStyle;
        return out;
    }

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

    /* ---------------- 多分頁協調 ---------------- */

    /**
     * 只讓一個分頁負責寫入與結算收益，其他分頁顯示提示。
     * 主分頁關閉後心跳會過期，另一個分頁就能安全接管。
     * 這是避免兩個分頁互相覆寫存檔的保護，不是防作弊機制。
     */
    Storage.prototype.readLock = function () {
        var text = this._read(KEYS.lock);
        if (!text) return null;
        try {
            var lock = JSON.parse(text);
            if (!lock || typeof lock.tabId !== 'string' || !isNum(lock.at)) return null;
            return lock;
        } catch (err) {
            return null;
        }
    };

    Storage.prototype.isLockStale = function (lock, now) {
        if (!lock) return true;
        var age = now - lock.at;
        return !(age >= 0) || age > Config.BALANCE.tab.staleMs;
    };

    /** 嘗試取得或續約主控權。回傳是否為主分頁。 */
    Storage.prototype.claimLock = function (nowArg) {
        if (!this.available) return true;   // 沒有儲存就沒有互相覆寫的問題
        var now = nowArg === undefined ? this.now() : nowArg;
        var lock = this.readLock();
        if (lock && lock.tabId !== this.tabId && !this.isLockStale(lock, now)) return false;
        this._write(KEYS.lock, JSON.stringify({ tabId: this.tabId, at: now }));
        return true;
    };

    Storage.prototype.releaseLock = function () {
        var lock = this.readLock();
        if (lock && lock.tabId === this.tabId) this._remove(KEYS.lock);
    };

    return {
        Storage: Storage,
        validateState: validateState,
        validateSettings: validateSettings,
        migrate: migrate,
        encodeText: encodeText,
        decodeText: decodeText,
        KEYS: KEYS,
        DEFAULT_SETTINGS: DEFAULT_SETTINGS,
        THEMES: THEMES,
        MOTIONS: MOTIONS,
        BUY_MODES: BUY_MODES
    };
});
