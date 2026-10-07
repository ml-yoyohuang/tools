/*!
 * 存檔：自動／手動保存、匯出、匯入、備份、版本遷移、多分頁協調
 * 讀取一律先驗證；匯入失敗絕不覆寫原存檔。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var deps = isNode
        ? { Config: require('./config.js'), Content: require('./content.js') }
        : { Config: root.MushConfig, Content: root.MushContent };
    var api = factory(deps, root);
    if (isNode) module.exports = api;
    else root.MushStorage = api;
})(typeof self !== 'undefined' ? self : this, function (deps, root) {
    'use strict';

    var Config = deps.Config;
    var Content = deps.Content;

    var KEYS = {
        save: 'tools.mushroom.save',
        backup: 'tools.mushroom.backup',
        settings: 'tools.mushroom.settings',
        lock: 'tools.mushroom.lock'
    };

    var DEFAULT_SETTINGS = { theme: 'system', motion: 'system', buyMode: 1, numberStyle: 'short' };
    var THEMES = ['system', 'light', 'dark'];
    var MOTIONS = ['system', 'full', 'reduced'];
    var BUY_MODES = [1, 10, 'max'];
    var NUMBER_STYLES = ['short', 'full'];

    function isNum(v) { return typeof v === 'number' && isFinite(v); }
    function nonNeg(v) { return isNum(v) && v >= 0; }

    /** 驗證存檔。未知 ID 忽略，結構或數值不合理則整份拒絕。 */
    function validateState(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'shape' };

        var nums = ['coins', 'lifetimeCoins', 'broth', 'brothLifetime', 'totalDamage',
            'clicks', 'killsTotal', 'lazyStreak', 'lastSettle', 'startedAt'];
        for (var i = 0; i < nums.length; i++) {
            var key = nums[i];
            if (raw[key] !== undefined && !nonNeg(raw[key])) return { ok: false, reason: 'number:' + key };
        }
        if (!nonNeg(raw.coins)) return { ok: false, reason: 'number:coins' };
        if (!nonNeg(raw.lifetimeCoins)) return { ok: false, reason: 'number:lifetimeCoins' };
        if (raw.lifetimeCoins + 1 < raw.coins) return { ok: false, reason: 'inconsistent' };
        if (raw.brothLifetime !== undefined && raw.broth !== undefined &&
            raw.brothLifetime + 0.5 < raw.broth) return { ok: false, reason: 'inconsistent' };

        if (!raw.devices || typeof raw.devices !== 'object') return { ok: false, reason: 'devices' };
        var devices = {};
        for (var d = 0; d < Config.DEVICES.length; d++) {
            var id = Config.DEVICES[d].id;
            var count = raw.devices[id];
            if (count === undefined) { devices[id] = 0; continue; }
            if (!nonNeg(count) || Math.floor(count) !== count || count > 1e7) {
                return { ok: false, reason: 'device:' + id };
            }
            devices[id] = count;
        }

        var items = {};
        for (var t = 0; t < Content.ITEMS.length; t++) {
            var itemId = Content.ITEMS[t].id;
            var have = raw.items ? raw.items[itemId] : 0;
            if (have === undefined) { items[itemId] = 0; continue; }
            if (!nonNeg(have) || Math.floor(have) !== have || have > 1e6) {
                return { ok: false, reason: 'item:' + itemId };
            }
            items[itemId] = have;
        }

        function pickFlags(source, known) {
            var out = {};
            if (!source || typeof source !== 'object') return out;
            known.forEach(function (entry) { if (source[entry.id] === true) out[entry.id] = true; });
            return out;
        }
        function pickZoneNumbers(source, min, max) {
            var out = {};
            if (!source || typeof source !== 'object') return out;
            Config.ZONES.forEach(function (z) {
                var v = source[z.id];
                if (nonNeg(v) && v >= min && v <= max) out[z.id] = Math.floor(v);
            });
            return out;
        }

        function pickCounts(source, known) {
            var out = {};
            if (!source || typeof source !== 'object') return out;
            known.forEach(function (entry) {
                var v = source[entry.id];
                if (nonNeg(v)) out[entry.id] = Math.floor(v);
            });
            return out;
        }

        var zones = { zone_01: true };
        if (raw.unlockedZones && typeof raw.unlockedZones === 'object') {
            Config.ZONES.forEach(function (z) { if (raw.unlockedZones[z.id] === true) zones[z.id] = true; });
        }

        var equipped = null;
        if (typeof raw.equipped === 'string' && Content.EQUIPMENT_BY_ID[raw.equipped]) equipped = raw.equipped;

        var buffs = { energy: 0, broth: 0, haste: 0 };
        if (raw.buffs && typeof raw.buffs === 'object') {
            ['energy', 'broth', 'haste'].forEach(function (k) {
                if (nonNeg(raw.buffs[k])) buffs[k] = raw.buffs[k];
            });
        }

        var whistle = { date: '', used: 0 };
        if (raw.whistle && typeof raw.whistle === 'object') {
            if (typeof raw.whistle.date === 'string') whistle.date = raw.whistle.date.slice(0, 10);
            if (nonNeg(raw.whistle.used)) whistle.used = Math.min(99, Math.floor(raw.whistle.used));
        }

        var flags = {};
        if (raw.flags && typeof raw.flags === 'object') {
            ['coldWin', 'chestEscaped'].forEach(function (k) { if (raw.flags[k] === true) flags[k] = true; });
        }

        var state = {
            version: Config.SAVE_VERSION,
            coins: raw.coins,
            lifetimeCoins: raw.lifetimeCoins,
            broth: nonNeg(raw.broth) ? Math.floor(raw.broth) : 0,
            brothLifetime: nonNeg(raw.brothLifetime) ? Math.floor(raw.brothLifetime) : (nonNeg(raw.broth) ? Math.floor(raw.broth) : 0),
            totalDamage: nonNeg(raw.totalDamage) ? raw.totalDamage : 0,
            clicks: nonNeg(raw.clicks) ? Math.floor(raw.clicks) : 0,
            devices: devices,
            deviceCooldowns: {},
            frozen: {},
            upgrades: pickFlags(raw.upgrades, Content.UPGRADES),
            achievements: pickFlags(raw.achievements, Content.ACHIEVEMENTS),
            claimed: pickFlags(raw.claimed, Content.ACHIEVEMENTS),
            items: items,
            equipmentOwned: pickFlags(raw.equipmentOwned, Content.EQUIPMENT),
            equipped: equipped,
            zoneId: zones[raw.zoneId] ? raw.zoneId : 'zone_01',
            unlockedZones: zones,
            depths: pickZoneNumbers(raw.depths, 1, 100000),
            depthKills: pickZoneNumbers(raw.depthKills, 0, 100000),
            bosses: pickFlags(raw.bosses, Config.BOSSES),
            collections: pickFlags(raw.collections, Config.BOSSES),
            kills: pickCounts(raw.kills, Config.MUSHROOMS),
            killsTotal: nonNeg(raw.killsTotal) ? Math.floor(raw.killsTotal) : 0,
            seen: pickFlags(raw.seen, Config.MUSHROOMS),
            buffs: buffs,
            itemCooldowns: {},
            combo: 0,
            lastClickAt: 0,
            comboMaxSince: 0,
            comboHoldBest: nonNeg(raw.comboHoldBest) ? raw.comboHoldBest : 0,
            cheerCharge: raw.cheerCharge === true,
            cheerTimer: 0,
            lazyStreak: nonNeg(raw.lazyStreak) ? Math.floor(raw.lazyStreak) : 0,
            burstWindow: [],
            burstBest: nonNeg(raw.burstBest) ? Math.floor(raw.burstBest) : 0,
            whistle: whistle,
            flags: flags,
            courier: null,
            nextCourierAt: nonNeg(raw.nextCourierAt) ? raw.nextCourierAt : 0,
            slowActive: false,
            baseDamageAuto: nonNeg(raw.baseDamageAuto) ? raw.baseDamageAuto : 0,
            baseDamageClick: nonNeg(raw.baseDamageClick) ? raw.baseDamageClick : 0,
            lastSettle: nonNeg(raw.lastSettle) ? raw.lastSettle : 0,
            startedAt: nonNeg(raw.startedAt) ? raw.startedAt : 0,
            playedMs: nonNeg(raw.playedMs) ? raw.playedMs : 0
        };
        return { ok: true, state: state };
    }

    /**
     * 版本遷移。
     * v1 → v2：舊版沒有 brothLifetime 與 equipmentOwned；
     *          已擊敗第三隻菇王的存檔要補上裝備擁有紀錄，否則裝備系統會是空的。
     */
    function migrate(payload) {
        var version = isNum(payload.v) ? payload.v : 1;
        var data = payload.state || payload.data || null;
        if (!data || typeof data !== 'object') return { data: null, migrated: false, from: version };
        var migrated = false;

        if (version < 2) {
            if (!nonNeg(data.brothLifetime)) data.brothLifetime = nonNeg(data.broth) ? data.broth : 0;
            if (!data.equipmentOwned) {
                data.equipmentOwned = {};
                if (data.bosses && data.bosses.boss_frozen) {
                    Content.EQUIPMENT.forEach(function (e) { data.equipmentOwned[e.id] = true; });
                }
            }
            migrated = true;
            version = 2;
        }
        if (version > Config.SAVE_VERSION) return { data: null, migrated: false, from: version, tooNew: true };
        return { data: data, migrated: migrated, from: isNum(payload.v) ? payload.v : 1 };
    }

    function encodeText(text) {
        if (typeof root.btoa === 'function') return root.btoa(unescape(encodeURIComponent(text)));
        return Buffer.from(text, 'utf8').toString('base64');
    }
    function decodeText(code) {
        if (typeof root.atob === 'function') return decodeURIComponent(escape(root.atob(code)));
        return Buffer.from(code, 'base64').toString('utf8');
    }

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
    }

    Storage.prototype._read = function (key) {
        if (!this.available) return null;
        try { return this.backend.getItem(key); } catch (err) { return null; }
    };
    Storage.prototype._write = function (key, value) {
        if (!this.available) return false;
        try { this.backend.setItem(key, value); return true; }
        catch (err) { this.writeFailed = true; return false; }
    };
    Storage.prototype._remove = function (key) {
        if (!this.available) return false;
        try { this.backend.removeItem(key); return true; } catch (err) { return false; }
    };

    Storage.prototype.save = function (state) {
        var payload = { v: Config.SAVE_VERSION, savedAt: this.now(), state: state };
        try { return this._write(KEYS.save, JSON.stringify(payload)); }
        catch (err) { return false; }
    };

    /** 把目前的存檔複製一份到備份槽。 */
    Storage.prototype.backup = function () {
        var text = this._read(KEYS.save);
        if (!text) return false;
        return this._write(KEYS.backup, text);
    };

    Storage.prototype.loadFrom = function (key) {
        var text = this._read(key);
        if (!text) return { status: 'none', state: null };
        var payload;
        try { payload = JSON.parse(text); }
        catch (err) { return { status: 'corrupt', state: null, reason: 'json' }; }

        var step = migrate(payload);
        if (!step.data) return { status: 'corrupt', state: null, reason: step.tooNew ? 'version-too-new' : 'shape' };
        var checked = validateState(step.data);
        if (!checked.ok) return { status: 'corrupt', state: null, reason: checked.reason };
        return { status: 'ok', state: checked.state, migrated: step.migrated, from: step.from };
    };

    Storage.prototype.load = function () { return this.loadFrom(KEYS.save); };
    Storage.prototype.loadBackup = function () { return this.loadFrom(KEYS.backup); };

    Storage.prototype.clearAll = function () {
        this._remove(KEYS.save);
        this._remove(KEYS.backup);
        this._remove(KEYS.settings);
        this._remove(KEYS.lock);
        this.writeFailed = false;
        return true;
    };

    Storage.prototype.exportText = function (state) {
        return 'MUSH1:' + encodeText(JSON.stringify({ v: Config.SAVE_VERSION, savedAt: this.now(), state: state }));
    };

    /** 只解析，不寫入；由呼叫端確認後才套用，因此失敗不可能覆寫原存檔。 */
    Storage.prototype.parseImport = function (text) {
        if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'empty' };
        var body = text.trim();
        if (body.indexOf('MUSH1:') === 0) body = body.slice('MUSH1:'.length);
        var json;
        try { json = body.charAt(0) === '{' ? body : decodeText(body); }
        catch (err) { return { ok: false, reason: 'decode' }; }
        var payload;
        try { payload = JSON.parse(json); }
        catch (err) { return { ok: false, reason: 'json' }; }
        var step = migrate(payload);
        if (!step.data) return { ok: false, reason: step.tooNew ? 'version-too-new' : 'shape' };
        var checked = validateState(step.data);
        if (!checked.ok) return { ok: false, reason: checked.reason };
        return { ok: true, state: checked.state, migrated: step.migrated };
    };

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
        try { return validateSettings(JSON.parse(text)); }
        catch (err) { this._remove(KEYS.settings); return validateSettings(null); }
    };

    Storage.prototype.saveSettings = function (settings) {
        return this._write(KEYS.settings, JSON.stringify(validateSettings(settings)));
    };

    /* ---------------- 多分頁 ---------------- */

    Storage.prototype.readLock = function () {
        var text = this._read(KEYS.lock);
        if (!text) return null;
        try {
            var lock = JSON.parse(text);
            if (!lock || typeof lock.tabId !== 'string' || !isNum(lock.at)) return null;
            return lock;
        } catch (err) { return null; }
    };

    Storage.prototype.isLockStale = function (lock, now) {
        if (!lock) return true;
        var age = now - lock.at;
        return !(age >= 0) || age > Config.BALANCE.tab.staleMs;
    };

    Storage.prototype.claimLock = function (nowArg) {
        if (!this.available) return true;
        var now = nowArg === undefined ? this.now() : nowArg;
        var lock = this.readLock();
        if (lock && lock.tabId !== this.tabId && !this.isLockStale(lock, now)) return false;
        this._write(KEYS.lock, JSON.stringify({ tabId: this.tabId, at: now }));
        return true;
    };

    Storage.prototype.forceLock = function (nowArg) {
        var now = nowArg === undefined ? this.now() : nowArg;
        this._write(KEYS.lock, JSON.stringify({ tabId: this.tabId, at: now }));
        return true;
    };

    Storage.prototype.releaseLock = function () {
        var lock = this.readLock();
        if (lock && lock.tabId === this.tabId) this._remove(KEYS.lock);
    };

    return {
        Storage: Storage, validateState: validateState, validateSettings: validateSettings,
        migrate: migrate, encodeText: encodeText, decodeText: decodeText,
        KEYS: KEYS, DEFAULT_SETTINGS: DEFAULT_SETTINGS, THEMES: THEMES, MOTIONS: MOTIONS, BUY_MODES: BUY_MODES
    };
});
