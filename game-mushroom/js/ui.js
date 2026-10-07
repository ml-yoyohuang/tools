/*!
 * 畫面層
 *
 * 只負責呈現與收集操作，所有規則都在 combat / game 裡。
 * 特效只呈現結果，不參與任何戰鬥計算。
 * 效能：節點重用、傷害數字依目標與時間窗口合併、浮字數量有上限。
 */
(function (root, factory) {
    'use strict';
    var api = factory({
        Config: root.MushConfig, Content: root.MushContent,
        Combat: root.MushCombat, Format: root.MushFormat
    });
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.MushUI = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    var Config = deps.Config;
    var Content = deps.Content;
    var Combat = deps.Combat;
    var Format = deps.Format;

    var MAX_FLOATERS = 14;

    function $(id) { return document.getElementById(id); }
    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function setText(node, text) { if (node && node.textContent !== text) node.textContent = text; }

    function UI(options) {
        this.game = options.game;
        this.images = options.images;
        this.handlers = options.handlers || {};

        this.numberStyle = 'short';
        this.buyMode = 1;
        this.showFullCoins = false;
        this.floaterCount = 0;
        this.toastTimer = null;
        this.pending = {};        // 傷害數字合併緩衝：uid -> {amount, crit, auto, until}

        this.el = {
            coins: $('res-coins'), broth: $('res-broth'), click: $('res-click'), dps: $('res-dps'),
            zoneTabs: $('zone-tabs'), zoneDepth: $('zone-depth'), zoneDesc: $('zone-desc'),
            buffBar: $('buff-bar'), stage: $('stage'), targets: $('targets'), floaters: $('floaters'),
            courier: $('courier'), courierArt: $('courier-art'),
            bossPanel: $('boss-panel'), bossHelp: $('boss-help'), btnHold: $('btn-hold'),
            btnExitBoss: $('btn-exit-boss'), holdBar: $('hold-bar'), holdFill: $('hold-fill'),
            frozenList: $('frozen-list'), fieldActions: $('field-actions'), btnBoss: $('btn-boss'),
            deviceList: $('device-list'), upgradeList: $('upgrade-list'), upgradeOwned: $('upgrade-owned'),
            itemList: $('item-list'), itemNote: $('item-note'),
            equipmentList: $('equipment-list'), equipNote: $('equip-note'),
            dexList: $('dex-list'), collectionList: $('collection-list'),
            achList: $('ach-list'), achCount: $('ach-count'), achTotal: $('ach-total'),
            badgeUpgrades: $('badge-upgrades'), badgeItems: $('badge-items'),
            live: $('live-region'), toast: $('toast')
        };

        this.targetNodes = new Map();
        this.deviceNodes = {};
        this.itemNodes = {};
        this.equipNodes = {};
        this.achNodes = {};

        this._buildStatic();
        this._bindTabs();
        this._bindBuyMode();
        this._bindStage();
    }

    /* ---------------- 圖片 ---------------- */

    UI.prototype.icon = function (key, src, label) {
        var image = this.images ? this.images.get(key) : null;
        if (image) {
            var img = document.createElement('img');
            img.src = src;
            img.alt = '';
            img.decoding = 'async';
            img.draggable = false;
            return img;
        }
        var fallback = el('span', 'art-fallback', label);
        fallback.setAttribute('aria-hidden', 'true');
        return fallback;
    };

    UI.prototype.refreshArt = function () {
        var self = this;
        this.el.courierArt.textContent = '';
        this.el.courierArt.appendChild(this.icon('courier', Config.COURIER_IMAGE, '外送'));
        Config.DEVICES.forEach(function (d) {
            var holder = self.deviceNodes[d.id] && self.deviceNodes[d.id].icon;
            if (holder) { holder.textContent = ''; holder.appendChild(self.icon('d:' + d.id, d.image, d.name.slice(0, 3))); }
        });
        Content.ITEMS.forEach(function (i) {
            var holder = self.itemNodes[i.id] && self.itemNodes[i.id].icon;
            if (holder) { holder.textContent = ''; holder.appendChild(self.icon('i:' + i.id, i.image, i.name.slice(0, 2))); }
        });
        Content.EQUIPMENT.forEach(function (e) {
            var holder = self.equipNodes[e.id] && self.equipNodes[e.id].icon;
            if (holder) { holder.textContent = ''; holder.appendChild(self.icon('e:' + e.id, e.image, e.name.slice(0, 2))); }
        });
        this.targetNodes.clear();
        this.el.targets.textContent = '';
        this._renderDex();
    };

    /* ---------------- 靜態結構 ---------------- */

    UI.prototype._buildStatic = function () {
        var self = this;

        Config.ZONES.forEach(function (zone) {
            var button = el('button', 'zone-tab', zone.name);
            button.type = 'button';
            button.dataset.zoneId = zone.id;
            button.addEventListener('click', function () { self.handlers.onZone(zone.id); });
            self.el.zoneTabs.appendChild(button);
        });

        Config.DEVICES.forEach(function (device) {
            var row = el('button', 'shop-row');
            row.type = 'button';
            var icon = el('span', 'shop-row__icon');
            var mid = el('span');
            var name = el('span', 'shop-row__name', device.name);
            var desc = el('p', 'shop-row__desc', device.flavor);
            var effect = el('p', 'shop-row__effect');
            mid.appendChild(name); mid.appendChild(desc); mid.appendChild(effect);
            var right = el('span', 'shop-row__right');
            var count = el('span', 'shop-row__count', '0');
            var cost = el('span', 'shop-row__cost');
            right.appendChild(count); right.appendChild(cost);
            row.appendChild(icon); row.appendChild(mid); row.appendChild(right);
            row.addEventListener('click', function () { self.handlers.onBuyDevice(device.id); });
            var li = el('li'); li.appendChild(row);
            self.el.deviceList.appendChild(li);
            self.deviceNodes[device.id] = { row: row, icon: icon, name: name, desc: desc, effect: effect, count: count, cost: cost };
        });

        Content.ITEMS.forEach(function (item) {
            var row = el('li', 'shop-row');
            var icon = el('span', 'shop-row__icon');
            var mid = el('span');
            mid.appendChild(el('span', 'shop-row__name', item.name));
            mid.appendChild(el('p', 'shop-row__desc', item.desc));
            mid.appendChild(el('p', 'shop-row__desc', item.note));
            var right = el('span', 'shop-row__right');
            var count = el('span', 'shop-row__count', '×0');
            var buy = el('button', 'btn btn--small', '購買');
            var use = el('button', 'btn btn--primary btn--small', '使用');
            buy.type = 'button'; use.type = 'button';
            buy.addEventListener('click', function () { self.handlers.onBuyItem(item.id); });
            use.addEventListener('click', function () { self.handlers.onUseItem(item.id); });
            right.appendChild(count); right.appendChild(buy); right.appendChild(use);
            row.appendChild(icon); row.appendChild(mid); row.appendChild(right);
            self.el.itemList.appendChild(row);
            self.itemNodes[item.id] = { row: row, icon: icon, count: count, buy: buy, use: use };
        });

        Content.EQUIPMENT.forEach(function (equip) {
            var row = el('li', 'shop-row');
            var icon = el('span', 'shop-row__icon');
            var mid = el('span');
            mid.appendChild(el('span', 'shop-row__name', equip.name));
            mid.appendChild(el('p', 'shop-row__desc', equip.desc));
            var right = el('span', 'shop-row__right');
            var button = el('button', 'btn btn--small', '裝備');
            button.type = 'button';
            button.addEventListener('click', function () { self.handlers.onEquip(equip.id); });
            right.appendChild(button);
            row.appendChild(icon); row.appendChild(mid); row.appendChild(right);
            self.el.equipmentList.appendChild(row);
            self.equipNodes[equip.id] = { row: row, icon: icon, button: button };
        });

        Content.ACHIEVEMENTS.forEach(function (ach) {
            var node = el('li', 'ach');
            node.appendChild(el('span', 'ach__name', ach.name));
            node.appendChild(el('p', 'ach__desc', ach.desc));
            if (ach.optional) node.appendChild(el('p', 'ach__optional', '可選挑戰，不影響主線'));
            self.el.achList.appendChild(node);
            self.achNodes[ach.id] = node;
        });
        setText(this.el.achTotal, String(Content.ACHIEVEMENTS.length));

        this.el.btnBoss.addEventListener('click', function () { self.handlers.onBoss(); });
        this.el.btnExitBoss.addEventListener('click', function () { self.handlers.onExitBoss(); });
        this.el.courier.addEventListener('click', function () { self.handlers.onCourier(); });
    };

    UI.prototype._bindTabs = function () {
        var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                tabs.forEach(function (other) {
                    var selected = other === tab;
                    other.setAttribute('aria-selected', selected ? 'true' : 'false');
                    var panel = document.getElementById(other.getAttribute('aria-controls'));
                    if (panel) panel.hidden = !selected;
                });
            });
            tab.addEventListener('keydown', function (event) {
                var index = tabs.indexOf(tab);
                var next = null;
                if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
                if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
                if (!next) return;
                event.preventDefault();
                next.focus(); next.click();
            });
        });
    };

    UI.prototype._bindBuyMode = function () {
        var self = this;
        this._buyChips = Array.prototype.slice.call(document.querySelectorAll('[data-buy-mode]'));
        this._buyChips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                var value = chip.dataset.buyMode === 'max' ? 'max' : Number(chip.dataset.buyMode);
                self.setBuyMode(value);
                self.handlers.onBuyMode(value);
            });
        });
    };

    /** 長按破盾：滑鼠、觸控與鍵盤等效，取消不會誤判。 */
    UI.prototype._bindStage = function () {
        var self = this;
        var hold = this.el.btnHold;

        var start = function (event) {
            if (event.type === 'keydown') {
                if (event.key !== ' ' && event.key !== 'Enter') return;
                if (event.repeat) return;
                event.preventDefault();
            }
            self.handlers.onHoldStart();
        };
        var stop = function (event) {
            if (event.type === 'keyup' && event.key !== ' ' && event.key !== 'Enter') return;
            self.handlers.onHoldEnd();
        };

        hold.addEventListener('pointerdown', start);
        hold.addEventListener('pointerup', stop);
        hold.addEventListener('pointercancel', stop);
        hold.addEventListener('pointerleave', stop);
        hold.addEventListener('keydown', start);
        hold.addEventListener('keyup', stop);
        hold.addEventListener('blur', stop);
        // 避免長按在手機上跳出系統選單
        hold.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    };

    UI.prototype.setBuyMode = function (mode) {
        this.buyMode = mode;
        (this._buyChips || []).forEach(function (chip) {
            var value = chip.dataset.buyMode === 'max' ? 'max' : Number(chip.dataset.buyMode);
            chip.setAttribute('aria-pressed', value === mode ? 'true' : 'false');
        });
    };

    UI.prototype.setNumberStyle = function (style) { this.numberStyle = style; };
    UI.prototype.num = function (v) { return this.numberStyle === 'full' ? Format.full(v) : Format.short(v); };

    /* ---------------- 傷害數字合併 ---------------- */

    /** 同一個目標在時間窗口內的多次傷害，視覺上合併成一個數字。 */
    UI.prototype.queueDamage = function (uid, amount, opts) {
        opts = opts || {};
        var now = Date.now();
        var entry = this.pending[uid];
        if (!entry || now > entry.until) {
            this.pending[uid] = { amount: amount, crit: !!opts.crit, auto: !!opts.fromAuto, until: now + Config.BALANCE.damageMergeMs };
            return;
        }
        entry.amount += amount;
        entry.crit = entry.crit || !!opts.crit;
        entry.auto = entry.auto && !!opts.fromAuto;
    };

    UI.prototype.flushDamage = function () {
        var now = Date.now();
        var uids = Object.keys(this.pending);
        for (var i = 0; i < uids.length; i++) {
            var entry = this.pending[uids[i]];
            if (now < entry.until) continue;
            delete this.pending[uids[i]];
            if (entry.amount <= 0) continue;
            this.floater((entry.crit ? '暴擊 ' : '') + this.num(entry.amount),
                entry.crit ? 'crit' : (entry.auto ? 'auto' : ''));
        }
    };

    UI.prototype.floater = function (text, variant) {
        if (document.documentElement.classList.contains('reduce-motion')) return;
        if (this.floaterCount >= MAX_FLOATERS) return;
        var node = el('span', 'floater' + (variant ? ' floater--' + variant : ''), text);
        node.style.left = (30 + Math.random() * 40) + '%';
        node.style.top = (25 + Math.random() * 40) + '%';
        this.el.floaters.appendChild(node);
        this.floaterCount++;
        var self = this;
        var remove = function () {
            if (node.parentNode) node.parentNode.removeChild(node);
            self.floaterCount = Math.max(0, self.floaterCount - 1);
        };
        node.addEventListener('animationend', remove);
        setTimeout(remove, 1500);
    };

    /* ---------------- 快速更新 ---------------- */

    UI.prototype.tickFast = function (now) {
        var game = this.game;
        var state = game.state;
        var stats = game.stats;

        setText(this.el.coins, (this.showFullCoins || this.numberStyle === 'full')
            ? Format.full(state.coins) : Format.short(state.coins));
        this.el.coins.title = Format.full(state.coins) + ' 菇幣';
        setText(this.el.broth, Format.full(state.broth));
        setText(this.el.click, this.num(Combat.expectedClickDamage(stats)));
        setText(this.el.dps, this.num(stats.autoDps));

        this._renderBuffs(stats, now);
        this._renderTargets(now);
        this._renderBossPanel(now);
        this._renderCourier(now);
        this.flushDamage();
    };

    UI.prototype._renderBuffs = function (stats, now) {
        var state = this.game.state;
        var list = [];
        if (state.buffs.energy > now) list.push({ label: '提神飲料 點擊 ×3', left: (state.buffs.energy - now) / 1000 });
        if (state.buffs.broth > now) list.push({ label: '金湯膠囊 菇幣 ×5', left: (state.buffs.broth - now) / 1000 });
        if (state.buffs.haste > now) list.push({ label: '辣油加速 速度 ×1.2', left: (state.buffs.haste - now) / 1000 });
        if (stats.comboMult > 1.001) list.push({ label: '連擊 ×' + stats.comboMult.toFixed(2), left: null });
        if (state.cheerCharge) list.push({ label: '下次擊敗雙倍菇幣', left: null });
        if (stats.ruthlessActive) list.push({ label: '無情機器 ×1.5', left: null });

        var signature = list.map(function (b) { return b.label + (b.left === null ? '' : Math.ceil(b.left)); }).join('|');
        if (signature === this._buffSignature) return;
        this._buffSignature = signature;

        this.el.buffBar.textContent = '';
        list.forEach(function (buff) {
            var node = el('li', 'buff');
            node.appendChild(el('span', '', buff.label));
            if (buff.left !== null) node.appendChild(el('span', 'buff__time', Format.clock(buff.left)));
            this.el.buffBar.appendChild(node);
        }, this);
    };

    UI.prototype._renderTargets = function (now) {
        var game = this.game;
        var targets = game.aliveTargets();
        var self = this;
        var seen = new Set();

        targets.forEach(function (target) {
            seen.add(target.uid);
            var nodes = self.targetNodes.get(target.uid);
            var isBoss = target.kind === 'boss';
            var info = isBoss ? Config.BOSS_BY_ID[target.typeId] : Config.MUSHROOM_BY_ID[target.typeId];
            if (!info) return;

            if (!nodes) {
                var button = el('button', 'target' + (isBoss ? ' is-boss' : ''));
                button.type = 'button';
                var art = el('span', 'target__art');
                art.appendChild(self.icon((isBoss ? 'k:' : 'm:') + info.id, info.image, info.name.slice(0, 3)));
                var name = el('span', 'target__name', info.name);
                var bar = el('span', 'target__hpbar');
                var fill = el('span', 'target__hpfill');
                bar.appendChild(fill);
                var hpText = el('span', 'target__hptext');
                var tags = el('span', 'target__tags');
                button.appendChild(art); button.appendChild(name);
                button.appendChild(bar); button.appendChild(hpText); button.appendChild(tags);
                button.addEventListener('click', function () { self.handlers.onClickTarget(target.uid); });
                var li = el('li'); li.appendChild(button);
                self.el.targets.appendChild(li);
                nodes = { li: li, button: button, fill: fill, hpText: hpText, tags: tags };
                self.targetNodes.set(target.uid, nodes);
            }

            var ratio = target.maxHp > 0 ? Math.max(0, target.hp / target.maxHp) : 0;
            nodes.fill.style.width = (ratio * 100).toFixed(1) + '%';
            setText(nodes.hpText, self.num(target.hp) + ' / ' + self.num(target.maxHp));

            var tagText = [];
            if (Combat.isShielded(target)) tagText.push('護盾 ×' + target.shields);
            if (Combat.isSoftened(target, now)) tagText.push('軟化');
            if (target.armorThreshold > 0) tagText.push('岩殼 ' + self.num(target.armorThreshold));
            if (target.fleeAt) tagText.push('逃跑 ' + Math.max(0, Math.ceil((target.fleeAt - now) / 1000)) + 's');
            if (!isBoss && info.traits) {
                if (info.traits.indexOf('slow') !== -1) tagText.push('緩速：設備減半');
                if (info.traits.indexOf('regen') !== -1) tagText.push('吸血：停手會回血');
                if (info.traits.indexOf('jackpot') !== -1) tagText.push('必掉金湯滴');
            }
            var signature = tagText.join('|');
            if (nodes.tagSignature !== signature) {
                nodes.tagSignature = signature;
                nodes.tags.textContent = '';
                tagText.forEach(function (text) {
                    var cls = 'tag' + (text.indexOf('護盾') === 0 ? ' tag--shield' : text === '軟化' ? ' tag--soften' : '');
                    nodes.tags.appendChild(el('span', cls, text));
                });
            }
            nodes.button.classList.toggle('is-preferred', game.state.preferredUid === target.uid);
            nodes.button.setAttribute('aria-label',
                info.name + '，血量 ' + Format.short(target.hp) + ' / ' + Format.short(target.maxHp) +
                (tagText.length ? '，' + tagText.join('、') : '') + '。點擊攻擊');
        });

        this.targetNodes.forEach(function (nodes, uid) {
            if (seen.has(uid)) return;
            self.targetNodes.delete(uid);
            if (nodes.li.parentNode) nodes.li.parentNode.removeChild(nodes.li);
        });
    };

    UI.prototype._renderBossPanel = function (now) {
        var game = this.game;
        var inBoss = game.mode === 'boss' && game.boss;
        this.el.bossPanel.hidden = !inBoss;
        this.el.fieldActions.hidden = !!inBoss;

        if (!inBoss) {
            var zone = game.zone();
            var boss = Config.BOSS_BY_ID[zone.bossId];
            var defeated = boss && game.state.bosses[boss.id];
            this.el.btnBoss.disabled = !boss || defeated;
            setText(this.el.btnBoss, defeated ? '這一區的菇王已被擊敗' : ('挑戰菇王：' + (boss ? boss.name : '')));
            return;
        }

        setText(this.el.bossHelp, game.boss.intro + '　' + game.boss.help);
        var needsHold = game.boss.mechanic === 'holdShield' && game.targets[0] && game.targets[0].shields > 0;
        this.el.btnHold.hidden = !needsHold;
        this.el.holdBar.hidden = !needsHold;
        if (needsHold) {
            this.el.holdFill.style.width = (game.holdProgress(now) * 100).toFixed(1) + '%';
        }

        var frozen = Object.keys(game.state.frozen);
        var signature = frozen.join('|');
        if (signature !== this._frozenSignature) {
            this._frozenSignature = signature;
            this.el.frozenList.textContent = '';
            var self = this;
            frozen.forEach(function (deviceId) {
                var device = Config.DEVICE_BY_ID[deviceId];
                var li = el('li');
                var chip = el('button', 'frozen-chip', '❄ ' + (device ? device.name : deviceId) + '：點我解凍');
                chip.type = 'button';
                chip.addEventListener('click', function () { self.handlers.onUnfreeze(deviceId); });
                li.appendChild(chip);
                self.el.frozenList.appendChild(li);
            });
        }
    };

    UI.prototype._renderCourier = function (now) {
        var courier = this.game.state.courier;
        var node = this.el.courier;
        if (!courier || now >= courier.expiresAt) {
            if (!node.hidden) node.hidden = true;
            return;
        }
        if (node.hidden) {
            node.hidden = false;
            node.style.top = (courier.y * 100) + '%';
        }
    };

    /* ---------------- 慢速更新 ---------------- */

    UI.prototype.tickSlow = function (now) {
        var game = this.game;
        var zone = game.zone();
        setText(this.el.zoneDepth, '採集深度 ' + game.depthOf(zone.id));
        setText(this.el.zoneDesc, zone.desc);

        Array.prototype.forEach.call(this.el.zoneTabs.children, function (button) {
            var id = button.dataset.zoneId;
            var unlocked = !!game.state.unlockedZones[id];
            button.disabled = !unlocked;
            button.setAttribute('aria-pressed', id === game.state.zoneId ? 'true' : 'false');
            setText(button, unlocked ? Config.ZONE_BY_ID[id].name : '？？？');
        });

        this._renderDevices(now);
        this._renderUpgrades(now);
        this._renderItems(now);
        this._renderEquipment();
        this._renderAchievements();
    };

    UI.prototype._renderDevices = function (now) {
        var game = this.game;
        var self = this;
        Config.DEVICES.forEach(function (device) {
            var nodes = self.deviceNodes[device.id];
            var owned = game.state.devices[device.id] || 0;
            var unlocked = game.deviceUnlocked(device);

            setText(nodes.count, String(owned));
            if (!unlocked) {
                nodes.row.classList.add('is-locked');
                nodes.row.classList.remove('is-affordable');
                nodes.row.disabled = true;
                setText(nodes.cost, '尚未解鎖');
                setText(nodes.effect, '解鎖條件：' + device.unlockText);
                nodes.row.setAttribute('aria-label', device.name + '，尚未解鎖，條件：' + device.unlockText);
                return;
            }
            nodes.row.classList.remove('is-locked');

            var plan = game.planDevicePurchase(device.id, self.buyMode);
            var info = game.stats.perDevice[device.id];
            var effectText;
            if (device.role === 'attack') {
                effectText = '單次 ' + self.num(info.damage) + ' 傷害 / ' +
                    (info.cooldown ? info.cooldown.toFixed(2) + ' 秒' : '—') +
                    (owned ? '　合計 ' + self.num(info.dps) + ' DPS' : '');
            } else if (device.role === 'support') {
                effectText = device.support.type === 'haste'
                    ? '每 ' + (device.cooldown / Math.max(0.0001, game.stats.speedMult)).toFixed(1) + ' 秒讓全設備速度 ×1.2，持續 3 秒'
                    : '每 ' + device.cooldown + ' 秒讓下一次擊敗掉落雙倍菇幣';
            } else {
                effectText = '依歷史菇幣提供全設備乘區，目前 ×' + game.stats.inductionMult.toFixed(2) +
                    '（上限 ×' + Config.BALANCE.induction.cap + '）';
            }
            setText(nodes.effect, effectText);

            var costText = plan.count > 0
                ? '買 ' + plan.count + ' 台　' + self.num(plan.cost) + (plan.brothCost ? ' + ' + plan.brothCost + ' 金湯滴' : '')
                : '菇幣不足';
            setText(nodes.cost, costText);
            nodes.cost.classList.toggle('is-too-much', !plan.affordable);
            nodes.row.classList.toggle('is-affordable', plan.affordable && plan.count > 0);
            nodes.row.disabled = !(plan.affordable && plan.count > 0);
            nodes.row.setAttribute('aria-label',
                device.name + '，已擁有 ' + owned + ' 台，' + costText + '。' + effectText);
        });
    };

    UI.prototype._renderUpgrades = function (now) {
        var game = this.game;
        var self = this;
        var state = game.state;

        var available = Content.UPGRADES.filter(function (u) {
            return !state.upgrades[u.id] && !u.auto && game.meetsRequirement(u.req);
        });
        var locked = Content.UPGRADES.filter(function (u) {
            return !state.upgrades[u.id] && !u.auto && !game.meetsRequirement(u.req);
        }).slice(0, 4);
        var owned = Content.UPGRADES.filter(function (u) { return state.upgrades[u.id]; });

        var signature = available.map(function (u) { return u.id; }).join(',') + '#' +
            locked.map(function (u) { return u.id; }).join(',') + '#' + owned.length;
        if (signature !== this._upgradeSignature) {
            this._upgradeSignature = signature;
            this.el.upgradeList.textContent = '';
            this.upgradeNodes = {};

            available.forEach(function (upgrade) {
                var row = el('button', 'shop-row');
                row.type = 'button';
                var icon = el('span', 'shop-row__icon');
                icon.appendChild(self.icon('u:' + upgrade.id, upgrade.image, upgrade.name.slice(0, 2)));
                var mid = el('span');
                mid.appendChild(el('span', 'shop-row__name', upgrade.name));
                mid.appendChild(el('p', 'shop-row__desc', upgrade.desc));
                var right = el('span', 'shop-row__right');
                var cost = el('span', 'shop-row__cost');
                right.appendChild(cost);
                row.appendChild(icon); row.appendChild(mid); row.appendChild(right);
                row.addEventListener('click', function () { self.handlers.onBuyUpgrade(upgrade.id); });
                var li = el('li'); li.appendChild(row);
                self.el.upgradeList.appendChild(li);
                self.upgradeNodes[upgrade.id] = { row: row, cost: cost };
            });

            locked.forEach(function (upgrade) {
                var row = el('li', 'shop-row is-locked');
                var icon = el('span', 'shop-row__icon');
                icon.appendChild(self.icon('u:' + upgrade.id, upgrade.image, upgrade.name.slice(0, 2)));
                var mid = el('span');
                mid.appendChild(el('span', 'shop-row__name', upgrade.name));
                mid.appendChild(el('p', 'shop-row__desc', upgrade.desc));
                mid.appendChild(el('p', 'shop-row__effect', '解鎖條件：' + upgrade.reqText));
                row.appendChild(icon); row.appendChild(mid);
                self.el.upgradeList.appendChild(row);
            });

            if (!available.length && !locked.length) {
                self.el.upgradeList.appendChild(el('li', 'panel__note', '所有升級都已取得。'));
            }

            this.el.upgradeOwned.textContent = '';
            owned.forEach(function (upgrade) {
                var item = el('li', 'owned-item');
                item.appendChild(self.icon('u:' + upgrade.id, upgrade.image, upgrade.name.slice(0, 2)));
                item.appendChild(el('span', '', upgrade.name));
                item.title = upgrade.desc;
                self.el.upgradeOwned.appendChild(item);
            });
        }

        var affordable = 0;
        available.forEach(function (upgrade) {
            var nodes = self.upgradeNodes[upgrade.id];
            if (!nodes) return;
            var cost = upgrade.cost * game.stats.shopDiscount;
            var brothCost = upgrade.brothCost || 0;
            var canBuy = state.coins + 1e-6 >= cost && state.broth >= brothCost;
            if (canBuy) affordable++;
            setText(nodes.cost, self.num(cost) + (brothCost ? ' + ' + brothCost + ' 金湯滴' : ''));
            nodes.cost.classList.toggle('is-too-much', !canBuy);
            nodes.row.classList.toggle('is-affordable', canBuy);
            nodes.row.disabled = !canBuy;
            nodes.row.setAttribute('aria-label', upgrade.name + '，花費 ' + Format.full(cost) + ' 菇幣。' + upgrade.desc);
        });

        this.el.badgeUpgrades.hidden = affordable <= 0;
        if (affordable > 0) setText(this.el.badgeUpgrades, String(affordable));
    };

    UI.prototype._renderItems = function (now) {
        var game = this.game;
        var self = this;
        var open = game.itemShopOpen();
        setText(this.el.itemNote, open
            ? '道具由商店購買或外送員掉落。時間快轉哨子今天還能使用 ' + game.whistleRemaining(now) + ' 次（以台北時間計算）。'
            : '道具商店會在擊敗第二區菇王後開放。');

        var total = 0;
        Content.ITEMS.forEach(function (item) {
            var nodes = self.itemNodes[item.id];
            var count = game.state.items[item.id] || 0;
            total += count;
            setText(nodes.count, '×' + count);
            var cost = item.cost * game.stats.shopDiscount;
            setText(nodes.buy, open ? '購買 ' + self.num(cost) : '尚未開放');
            nodes.buy.disabled = !open || game.state.coins < cost;

            var cooling = (game.state.itemCooldowns[item.id] || 0) > now;
            var blocked = false;
            if (item.effect.type === 'energy') blocked = game.state.buffs.energy > now;
            if (item.effect.type === 'brothCapsule') blocked = game.state.buffs.broth > now;
            if (item.effect.type === 'whistle') blocked = game.whistleRemaining(now) <= 0;
            nodes.use.disabled = count <= 0 || cooling || blocked;
            setText(nodes.use, cooling ? '冷卻中' : (blocked ? '無法使用' : '使用'));
            nodes.use.setAttribute('aria-label', '使用 ' + item.name + '，持有 ' + count + ' 個');
        });
        this.el.badgeItems.hidden = total <= 0;
        if (total > 0) setText(this.el.badgeItems, String(total));
    };

    UI.prototype._renderEquipment = function () {
        var game = this.game;
        var self = this;
        var open = Object.keys(game.state.equipmentOwned).length > 0;
        setText(this.el.equipNote, open
            ? '只有一個欄位，效果僅在裝備時生效，切換不會累加。'
            : '裝備系統會在擊敗第三區菇王後開放。');

        Content.EQUIPMENT.forEach(function (equip) {
            var nodes = self.equipNodes[equip.id];
            var ownedIt = !!game.state.equipmentOwned[equip.id];
            var equipped = game.state.equipped === equip.id;
            nodes.button.disabled = !ownedIt;
            setText(nodes.button, equipped ? '使用中' : (ownedIt ? '裝備' : '未取得'));
            nodes.row.classList.toggle('is-affordable', equipped);
            nodes.row.classList.toggle('is-locked', !ownedIt);
        });
    };

    UI.prototype._renderDex = function () {
        var game = this.game;
        var self = this;
        this.el.dexList.textContent = '';
        Config.MUSHROOMS.forEach(function (m) {
            var found = !!game.state.seen[m.id];
            var entry = el('li', 'dex-entry' + (found ? ' is-found' : ''));
            entry.appendChild(self.icon('m:' + m.id, m.image, m.name.slice(0, 2)));
            var text = el('span');
            text.appendChild(el('span', 'dex-name', found ? m.name : '？？？'));
            text.appendChild(el('p', 'dex-sub', found
                ? m.dex + '（已擊敗 ' + (game.state.kills[m.id] || 0) + ' 隻）'
                : '尚未遭遇'));
            entry.appendChild(text);
            self.el.dexList.appendChild(entry);
        });

        this.el.collectionList.textContent = '';
        Config.BOSSES.forEach(function (b) {
            var found = !!game.state.collections[b.id];
            var entry = el('li', 'dex-entry is-collection' + (found ? ' is-found' : ''));
            entry.appendChild(self.icon('k:' + b.id, b.image, b.name.slice(0, 2)));
            var text = el('span');
            text.appendChild(el('span', 'dex-name', found ? b.collection : '？？？'));
            text.appendChild(el('p', 'dex-sub', found ? '擊敗 ' + b.name + ' 取得' : '擊敗對應菇王後取得'));
            entry.appendChild(text);
            self.el.collectionList.appendChild(entry);
        });
    };

    UI.prototype._renderAchievements = function () {
        var state = this.game.state;
        var self = this;
        var count = 0;
        var dexDirty = false;
        Content.ACHIEVEMENTS.forEach(function (ach) {
            var node = self.achNodes[ach.id];
            var unlocked = !!state.achievements[ach.id];
            if (unlocked) count++;
            if (node.classList.contains('is-unlocked') !== unlocked) node.classList.toggle('is-unlocked', unlocked);
        });
        setText(this.el.achCount, String(count));

        var dexSignature = Object.keys(state.seen).length + ':' + Object.keys(state.collections).length +
            ':' + state.killsTotal;
        if (dexSignature !== this._dexSignature) {
            this._dexSignature = dexSignature;
            this._renderDex();
        }
    };

    /* ---------------- 提示 ---------------- */

    UI.prototype.toast = function (message) {
        var self = this;
        setText(this.el.toast, message);
        this.el.toast.hidden = false;
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(function () { self.el.toast.hidden = true; self.toastTimer = null; }, 5000);
    };

    /** 只在重要事件時朗讀，持續變動的數字不進這裡。 */
    UI.prototype.announce = function (message) { setText(this.el.live, message); };

    return { UI: UI, MAX_FLOATERS: MAX_FLOATERS };
});
