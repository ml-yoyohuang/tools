/*!
 * 畫面層
 *
 * 只負責把狀態畫出來與收集操作，所有規則都在 economy / game 裡。
 * 為了效能：節點建立一次之後重複使用，更新時只改變動過的文字，
 * 不會每一幀重建整個商店。
 */
(function (root, factory) {
    'use strict';
    var api = factory({
        Config: root.BakeryConfig,
        Content: root.BakeryContent,
        Economy: root.BakeryEconomy,
        Format: root.BakeryFormat
    });
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BakeryUI = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    var Config = deps.Config;
    var Content = deps.Content;
    var Economy = deps.Economy;
    var Format = deps.Format;

    var MAX_FLOATERS = 18;

    function $(id) { return document.getElementById(id); }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function setText(node, text) {
        if (node && node.textContent !== text) node.textContent = text;
    }

    /* ---------------- UI ---------------- */

    function UI(options) {
        this.game = options.game;
        this.images = options.images;
        this.onBuyBuilding = options.onBuyBuilding || function () {};
        this.onBuyUpgrade = options.onBuyUpgrade || function () {};
        this.onUseItem = options.onUseItem || function () {};
        this.onBuyModeChange = options.onBuyModeChange || function () {};

        this.numberStyle = 'short';
        this.buyMode = 1;
        this.showFullCookies = false;
        this.floaterCount = 0;
        this.toastTimer = null;

        this.el = {
            cookies: $('counter-cookies'),
            rate: $('counter-rate'),
            clickValue: $('click-value'),
            cookieArt: $('cookie-art'),
            goldenArt: $('golden-art'),
            golden: $('golden-cookie'),
            stage: $('cookie-stage'),
            floaters: $('floaters'),
            buffBar: $('buff-bar'),
            statBaked: $('stat-baked'),
            statAllTime: $('stat-all-time'),
            statClicks: $('stat-clicks'),
            statGolden: $('stat-golden'),
            goalsList: $('goals-list'),
            buildingList: $('building-list'),
            upgradeList: $('upgrade-list'),
            upgradeOwned: $('upgrade-owned'),
            itemList: $('item-list'),
            achievementList: $('achievement-list'),
            achievementCount: $('achievement-count'),
            achievementTotal: $('achievement-total'),
            badgeUpgrades: $('badge-upgrades'),
            badgeItems: $('badge-items'),
            live: $('live-region'),
            toast: $('toast')
        };

        this.rows = {};        // buildingId -> 節點集合
        this.upgradeNodes = {};
        this.itemNodes = {};
        this.achievementNodes = {};
        this.lastSignature = '';

        this._buildStatic();
        this._bindTabs();
        this._bindBuyMode();
    }

    /* ---------------- 圖片 ---------------- */

    /** 建立圖示節點；圖片載入失敗時改用色塊與名稱，遊戲照常運作。 */
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
        this.el.cookieArt.textContent = '';
        this.el.cookieArt.appendChild(this.icon('cookie', Config.MAIN_COOKIE_IMAGE, '餅乾'));
        this.el.goldenArt.textContent = '';
        this.el.goldenArt.appendChild(this.icon('golden', Config.GOLDEN_COOKIE_IMAGE, '黃金'));

        var self = this;
        Config.BUILDINGS.forEach(function (b) {
            var holder = self.rows[b.id] && self.rows[b.id].icon;
            if (!holder) return;
            holder.textContent = '';
            holder.appendChild(self.icon('b:' + b.id, b.image, b.short));
        });
        Config.ITEMS.forEach(function (item) {
            var holder = self.itemNodes[item.id] && self.itemNodes[item.id].icon;
            if (!holder) return;
            holder.textContent = '';
            holder.appendChild(self.icon('i:' + item.id, item.image, item.name.slice(0, 2)));
        });
    };

    /* ---------------- 靜態結構 ---------------- */

    UI.prototype._buildStatic = function () {
        var self = this;

        Config.BUILDINGS.forEach(function (building) {
            var row = el('button', 'shop-row');
            row.type = 'button';
            row.dataset.buildingId = building.id;

            var icon = el('span', 'shop-row__icon');
            var mid = el('span');
            var name = el('span', 'shop-row__name', building.name);
            var meta = el('span', 'shop-row__meta');
            mid.appendChild(name);
            mid.appendChild(meta);

            var right = el('span', 'shop-row__right');
            var count = el('span', 'shop-row__count', '0');
            var cost = el('span', 'shop-row__cost');
            var payback = el('span', 'shop-row__payback');
            right.appendChild(count);
            right.appendChild(cost);
            right.appendChild(payback);

            row.appendChild(icon);
            row.appendChild(mid);
            row.appendChild(right);
            row.addEventListener('click', function () { self.onBuyBuilding(building.id); });

            var li = el('li');
            li.appendChild(row);
            self.el.buildingList.appendChild(li);
            self.rows[building.id] = {
                row: row, icon: icon, name: name, meta: meta,
                count: count, cost: cost, payback: payback
            };
        });

        Config.ITEMS.forEach(function (item) {
            var card = el('li', 'item-card');
            var icon = el('span', 'item-card__icon');
            var mid = el('span');
            mid.appendChild(el('span', 'item-card__name', item.name));
            mid.appendChild(el('p', 'item-card__desc', item.desc));
            mid.appendChild(el('p', 'item-card__note', item.note));

            var right = el('span', 'item-card__right');
            var count = el('span', 'item-card__count', '×0');
            var use = el('button', 'btn btn--primary btn--small', '使用');
            use.type = 'button';
            use.addEventListener('click', function () { self.onUseItem(item.id); });
            right.appendChild(count);
            right.appendChild(use);

            card.appendChild(icon);
            card.appendChild(mid);
            card.appendChild(right);
            self.el.itemList.appendChild(card);
            self.itemNodes[item.id] = { card: card, icon: icon, count: count, use: use };
        });

        Content.ACHIEVEMENTS.forEach(function (ach) {
            var node = el('li', 'achievement');
            node.appendChild(el('span', 'achievement__name', ach.name));
            node.appendChild(el('p', 'achievement__desc', ach.desc));
            if (ach.reward) {
                var item = Config.ITEM_BY_ID[ach.reward.itemId];
                node.appendChild(el('p', 'achievement__reward',
                    '獎勵：' + (item ? item.name : ach.reward.itemId) + ' ×' + ach.reward.amount));
            }
            self.el.achievementList.appendChild(node);
            self.achievementNodes[ach.id] = node;
        });

        setText(this.el.achievementTotal, String(Content.ACHIEVEMENTS.length));
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
                next.focus();
                next.click();
            });
        });
    };

    UI.prototype._bindBuyMode = function () {
        var self = this;
        var chips = Array.prototype.slice.call(document.querySelectorAll('[data-buy-mode]'));
        chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                var value = chip.dataset.buyMode === 'max' ? 'max' : Number(chip.dataset.buyMode);
                self.setBuyMode(value);
                self.onBuyModeChange(value);
            });
        });
        this._buyChips = chips;
    };

    UI.prototype.setBuyMode = function (mode) {
        this.buyMode = mode;
        (this._buyChips || []).forEach(function (chip) {
            var value = chip.dataset.buyMode === 'max' ? 'max' : Number(chip.dataset.buyMode);
            chip.setAttribute('aria-pressed', value === mode ? 'true' : 'false');
        });
    };

    UI.prototype.setNumberStyle = function (style) { this.numberStyle = style; };

    UI.prototype.num = function (value) {
        return this.numberStyle === 'full' ? Format.full(value) : Format.short(value);
    };

    /* ---------------- 快速更新（約每 100ms） ---------------- */

    UI.prototype.tickFast = function (now) {
        var game = this.game;
        var state = game.state;
        var stats = game.stats;

        var cookieText = (this.showFullCookies || this.numberStyle === 'full')
            ? Format.full(state.cookies)
            : Format.short(state.cookies);
        setText(this.el.cookies, cookieText);
        this.el.cookies.title = Format.full(state.cookies) + ' 塊';

        setText(this.el.rate, '每秒 ' + Format.rate(stats.cps) + ' 塊');
        this.el.rate.title = '未含限時效果：每秒 ' + Format.full(stats.baseCps) + ' 塊';

        var clickText = '每次點擊 ' + this.num(stats.clickValue) + ' 塊';
        if (stats.lucky.chance > 0) {
            clickText += '（' + Format.percent(stats.lucky.chance, 0) + ' 機率 ×' + stats.lucky.mult + '）';
        }
        if (stats.comboEnabled && stats.comboMult > 1.001) {
            clickText += '　連擊 +' + Format.percent(stats.comboMult - 1, 0);
        }
        setText(this.el.clickValue, clickText);

        this._renderBuffs(stats, now);
        this._renderGolden(state, now);
    };

    UI.prototype._renderBuffs = function (stats, now) {
        var list = stats.buffs.active;
        var bar = this.el.buffBar;
        var signature = list.map(function (b) { return b.channel + ':' + Math.ceil(b.remaining); }).join('|');
        if (signature === this._buffSignature) return;
        this._buffSignature = signature;

        bar.textContent = '';
        list.forEach(function (buff) {
            var label = buff.channel === 'cps' ? '產量 ×' + buff.mult
                : buff.channel === 'click' ? '點擊 ×' + buff.mult
                    : '價格 -' + Format.percent(buff.value, 0);
            var node = el('li', 'buff');
            node.appendChild(el('span', '', label));
            node.appendChild(el('span', 'buff__time', Format.clock(buff.remaining)));
            bar.appendChild(node);
        });
    };

    UI.prototype._renderGolden = function (state, now) {
        var node = this.el.golden;
        if (!state.golden || now >= state.golden.expiresAt) {
            if (!node.hidden) node.hidden = true;
            return;
        }
        if (node.hidden) {
            node.hidden = false;
            node.style.left = (state.golden.x * 100) + '%';
            node.style.top = (state.golden.y * 100) + '%';
        }
    };

    /* ---------------- 慢速更新（約每 250ms） ---------------- */

    UI.prototype.tickSlow = function (now) {
        var game = this.game;
        var state = game.state;
        var stats = game.stats;

        setText(this.el.statBaked, this.num(state.baked));
        setText(this.el.statAllTime, this.num(state.bakedAllTime));
        setText(this.el.statClicks, Format.full(state.clicks));
        setText(this.el.statGolden, Format.full(state.goldenClicked));

        this._renderBuildings(now);
        this._renderUpgrades(now);
        this._renderItems();
        this._renderAchievements();
        this._renderGoals(stats);
    };

    UI.prototype._renderBuildings = function (now) {
        var game = this.game;
        var state = game.state;
        var discount = game.currentDiscount(now);
        var self = this;

        Config.BUILDINGS.forEach(function (building) {
            var nodes = self.rows[building.id];
            var owned = state.buildings[building.id] || 0;
            var revealed = Economy.isRevealed(building, state);

            if (!revealed) {
                nodes.row.classList.add('is-locked');
                nodes.row.classList.remove('is-affordable');
                nodes.row.disabled = true;
                setText(nodes.name, '？？？');
                setText(nodes.meta, building.hint);
                setText(nodes.count, '');
                setText(nodes.cost, '尚未解鎖');
                setText(nodes.payback, '累積 ' + self.num(building.revealAt) + ' 塊後揭曉');
                nodes.row.setAttribute('aria-label', '尚未解鎖的設備：' + building.hint);
                return;
            }

            nodes.row.classList.remove('is-locked');
            nodes.row.disabled = false;
            setText(nodes.name, building.name);

            var plan = Economy.planPurchase(building, owned, state.cookies, self.buyMode, discount);
            var each = game.stats.perBuilding[building.id];
            var gain = Economy.cpsGainOf(state, building.id, plan.count || 1, now);
            var payback = gain > 0 ? plan.cost / gain : Infinity;

            var metaText = '每個 ' + Format.rate(each.each) + '/秒';
            if (owned > 0) metaText += '　共 ' + Format.rate(each.total) + '/秒';
            setText(nodes.meta, metaText);
            setText(nodes.count, String(owned));

            var label = self.buyMode === 'max'
                ? (plan.count > 0 ? '買 ' + plan.count + ' 個' : '買 0 個')
                : '買 ' + plan.count + ' 個';
            setText(nodes.cost, (plan.count > 0 ? self.num(plan.cost) : '—') + ' 塊');
            nodes.cost.classList.toggle('is-too-much', !plan.affordable);
            setText(nodes.payback, plan.count > 0
                ? label + '　+' + Format.rate(gain) + '/秒　回本 ' + Format.duration(payback)
                : '餘額不足');

            var affordable = plan.affordable && plan.count > 0;
            nodes.row.classList.toggle('is-affordable', affordable);
            nodes.row.disabled = !affordable;
            nodes.row.setAttribute('aria-label',
                building.name + '，已擁有 ' + owned + ' 個，' + label +
                '，花費 ' + Format.full(plan.cost) + ' 塊，每秒增加 ' + Format.rate(gain) + ' 塊');
        });
    };

    UI.prototype._renderUpgrades = function (now) {
        var game = this.game;
        var state = game.state;
        var self = this;

        var available = Content.UPGRADES.filter(function (upgrade) {
            return !state.upgrades[upgrade.id] && Economy.meetsRequirement(upgrade.req, state, game.stats);
        });
        var owned = Content.UPGRADES.filter(function (upgrade) { return state.upgrades[upgrade.id]; });

        var signature = available.map(function (u) { return u.id; }).join(',') + '#' + owned.length;
        if (signature !== this._upgradeSignature) {
            this._upgradeSignature = signature;
            this.el.upgradeList.textContent = '';
            this.upgradeNodes = {};

            if (!available.length) {
                var empty = el('li', 'panel__note', '目前沒有可購買的升級，繼續累積設備與點擊就會解鎖新的。');
                this.el.upgradeList.appendChild(empty);
            }

            available.forEach(function (upgrade) {
                var card = el('button', 'upgrade-card');
                card.type = 'button';
                var icon = el('span', 'upgrade-card__icon');
                icon.appendChild(self.icon('u:' + upgrade.id, upgrade.image, upgrade.name.slice(0, 2)));
                var mid = el('span');
                mid.appendChild(el('span', 'upgrade-card__name', upgrade.name));
                mid.appendChild(el('p', 'upgrade-card__desc', upgrade.desc));
                var gainNode = el('p', 'upgrade-card__gain');
                mid.appendChild(gainNode);
                var cost = el('span', 'upgrade-card__cost');
                card.appendChild(icon);
                card.appendChild(mid);
                card.appendChild(cost);
                card.addEventListener('click', function () { self.onBuyUpgrade(upgrade.id); });

                var li = el('li');
                li.appendChild(card);
                self.el.upgradeList.appendChild(li);
                self.upgradeNodes[upgrade.id] = { card: card, cost: cost, gain: gainNode };
            });

            this.el.upgradeOwned.textContent = '';
            owned.forEach(function (upgrade) {
                var card = el('div', 'upgrade-card');
                var icon = el('span', 'upgrade-card__icon');
                icon.appendChild(self.icon('u:' + upgrade.id, upgrade.image, upgrade.name.slice(0, 2)));
                var mid = el('span');
                mid.appendChild(el('span', 'upgrade-card__name', upgrade.name));
                mid.appendChild(el('p', 'upgrade-card__desc', upgrade.desc));
                card.appendChild(icon);
                card.appendChild(mid);
                card.title = upgrade.desc;
                var li = el('li');
                li.appendChild(card);
                self.el.upgradeOwned.appendChild(li);
            });
        }

        var affordableCount = 0;
        available.forEach(function (upgrade) {
            var nodes = self.upgradeNodes[upgrade.id];
            if (!nodes) return;
            var affordable = state.cookies + Economy.EPS >= upgrade.cost;
            if (affordable) affordableCount++;
            setText(nodes.cost, self.num(upgrade.cost) + ' 塊');
            nodes.cost.classList.toggle('is-too-much', !affordable);
            nodes.card.classList.toggle('is-affordable', affordable);
            nodes.card.disabled = !affordable;

            var gain = Economy.upgradeGainOf(state, upgrade.id, now);
            var parts = [];
            if (gain.cps > 0) parts.push('每秒 +' + Format.rate(gain.cps));
            if (gain.click > 0) parts.push('每次點擊 +' + Format.short(gain.click));
            setText(nodes.gain, parts.length ? '預估：' + parts.join('　') : '');
            nodes.card.setAttribute('aria-label',
                upgrade.name + '，花費 ' + Format.full(upgrade.cost) + ' 塊。' + upgrade.desc);
        });

        if (affordableCount > 0) {
            this.el.badgeUpgrades.hidden = false;
            setText(this.el.badgeUpgrades, String(affordableCount));
        } else {
            this.el.badgeUpgrades.hidden = true;
        }
    };

    UI.prototype._renderItems = function () {
        var state = this.game.state;
        var self = this;
        var total = 0;
        Config.ITEMS.forEach(function (item) {
            var nodes = self.itemNodes[item.id];
            var count = state.items[item.id] || 0;
            total += count;
            setText(nodes.count, '×' + count);
            nodes.use.disabled = count <= 0;
            nodes.use.setAttribute('aria-label', '使用 ' + item.name + '，目前持有 ' + count + ' 個');
        });
        if (total > 0) {
            this.el.badgeItems.hidden = false;
            setText(this.el.badgeItems, String(total));
        } else {
            this.el.badgeItems.hidden = true;
        }
    };

    UI.prototype._renderAchievements = function () {
        var state = this.game.state;
        var self = this;
        var count = 0;
        Content.ACHIEVEMENTS.forEach(function (ach) {
            var node = self.achievementNodes[ach.id];
            var unlocked = !!state.achievements[ach.id];
            if (unlocked) count++;
            if (node.classList.contains('is-unlocked') !== unlocked) {
                node.classList.toggle('is-unlocked', unlocked);
            }
        });
        setText(this.el.achievementCount, String(count));
    };

    UI.prototype._renderGoals = function (stats) {
        var goals = Economy.nextGoals(this.game.state, stats, 3);
        var signature = goals.map(function (g) { return g.label + g.need; }).join('|');
        if (signature === this._goalSignature) {
            // 只更新進度條寬度
            var bars = this.el.goalsList.querySelectorAll('.goal__fill');
            for (var i = 0; i < bars.length && i < goals.length; i++) {
                bars[i].style.width = Math.max(0, Math.min(100, goals[i].progress * 100)).toFixed(1) + '%';
            }
            return;
        }
        this._goalSignature = signature;

        this.el.goalsList.textContent = '';
        if (!goals.length) {
            this.el.goalsList.appendChild(el('li', 'goal__need', '目前的內容都已經解鎖了，繼續擴張產量吧。'));
            return;
        }
        goals.forEach(function (goal) {
            var li = el('li');
            li.appendChild(el('span', 'goal__label', goal.label));
            li.appendChild(el('span', 'goal__need', goal.need));
            var bar = el('div', 'goal__bar');
            var fill = el('div', 'goal__fill');
            fill.style.width = Math.max(0, Math.min(100, goal.progress * 100)).toFixed(1) + '%';
            bar.appendChild(fill);
            li.appendChild(bar);
            this.el.goalsList.appendChild(li);
        }, this);
    };

    /* ---------------- 回饋 ---------------- */

    /** 浮動收益數字。同時存在的節點有上限，快速點擊不會無限累積。 */
    UI.prototype.floater = function (text, lucky) {
        if (document.documentElement.classList.contains('reduce-motion')) return;
        if (this.floaterCount >= MAX_FLOATERS) return;

        var node = el('span', 'floater' + (lucky ? ' floater--lucky' : ''), text);
        node.style.left = (35 + Math.random() * 30) + '%';
        node.style.top = (30 + Math.random() * 30) + '%';
        this.el.floaters.appendChild(node);
        this.floaterCount++;

        var self = this;
        var remove = function () {
            if (node.parentNode) node.parentNode.removeChild(node);
            self.floaterCount = Math.max(0, self.floaterCount - 1);
        };
        node.addEventListener('animationend', remove);
        setTimeout(remove, 1500);   // 保險：動畫被中斷時也要清掉
    };

    UI.prototype.toast = function (message) {
        var self = this;
        setText(this.el.toast, message);
        this.el.toast.hidden = false;
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(function () {
            self.el.toast.hidden = true;
            self.toastTimer = null;
        }, 5000);
    };

    /** 只在重要事件時朗讀，持續變動的數字不進這裡。 */
    UI.prototype.announce = function (message) {
        setText(this.el.live, message);
    };

    return { UI: UI, MAX_FLOATERS: MAX_FLOATERS };
});
