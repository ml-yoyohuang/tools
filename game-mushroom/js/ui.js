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
    function formatPayback(seconds) {
        if (seconds === null || !isFinite(seconds) || seconds < 0) return '';
        var total = Math.ceil(seconds);
        var minutes = Math.floor(total / 60);
        var rest = total % 60;
        return Format.full(minutes) + '分' + (rest < 10 ? '0' : '') + rest + '秒回本';
    }
    function appendPayback(text, seconds) {
        var payback = formatPayback(seconds);
        return payback ? text + '　' + payback : text;
    }

    function UI(options) {
        this.game = options.game;
        this.images = options.images;
        this.handlers = options.handlers || {};
        this.wordDexEntries = buildWordDex(options.typingVocab || {});
        this.wordDexByLetter = {};
        this.wordDexSelectedLetter = 'a';
        this.wordDexFilter = 'all';
        this._wordDexSignature = null;
        this.wordDexEntries.forEach(function (entry) {
            var letter = entry.key.charAt(0);
            if (!this.wordDexByLetter[letter]) this.wordDexByLetter[letter] = [];
            this.wordDexByLetter[letter].push(entry);
        }, this);

        this.numberStyle = 'short';
        this.buyMode = 1;
        this.showFullCoins = false;
        this.previousBurstCount = null;
        this.burstTrend = 'is-steady';
        this.lastBurstTrendAt = null;
        this.highTypingSince = 0;
        this.floaterCount = 0;
        this.toastTimer = null;
        this.pending = {};        // 傷害數字合併緩衝：uid -> {amount, crit, auto, until}
        this.sceneTransitionTimer = null;
        this.passStageTimer = null;
        this.passBadgeTimer = null;
        this.passBadge = null;
        this.frozenHold = null;
        this.maskVocabulary = false;
        this.currentTypingView = null;
        this.blindMilestoneTimer = null;

        this.el = {
            coins: $('res-coins'), broth: $('res-broth'), click: $('res-click'), bossTyping: $('res-boss-typing'), dps: $('res-dps'),
            typingCount: $('res-typing-count'),
            lifetimeCoins: $('res-lifetime-coins'), totalDamage: $('res-total-damage'),
            brothLifetime: $('res-broth-lifetime'), deviceTotal: $('res-device-total'),
            couriersCaught: $('res-couriers-caught'),
            zoneTabs: $('zone-tabs'), zoneDepth: $('zone-depth'), zoneDesc: $('zone-desc'),
            deviceFreezeNote: $('device-freeze-note'),
            buffBar: $('buff-bar'), stage: $('stage'), stageImage: document.querySelector('.stage__image'), targets: $('targets'), floaters: $('floaters'),
            typingPrompt: $('typing-prompt'), typingTranslation: $('typing-translation'), typingInput: $('typing-input'), typingStatus: $('typing-status'),
            typingMaskTools: $('typing-mask-tools'), btnTypingMask: $('btn-typing-mask'),
            typingRate: $('typing-rate'),
            typingSection: document.querySelector('.typing'),
            btnTypingFloat: $('btn-typing-float'), btnTypingFloatClose: $('btn-typing-float-close'),
            typingAlert: $('typing-alert'),
            btnSkipPrompt: $('btn-skip-prompt'),
            courier: $('courier'), courierArt: $('courier-art'),
            bossPanel: $('boss-panel'), bossHelp: $('boss-help'), bossProgress: $('boss-progress'),
            bossCombo: $('boss-combo'), bossComboValue: $('boss-combo-value'), bossComboFill: $('boss-combo-fill'), bossComboHint: $('boss-combo-hint'),
            btnHold: $('btn-hold'),
            btnExitBoss: $('btn-exit-boss'), holdFill: $('hold-fill'), holdLabel: $('hold-label'),
            frozenList: $('frozen-list'), fieldActions: $('field-actions'), btnBoss: $('btn-boss'),
            deviceList: $('device-list'), upgradeList: $('upgrade-list'), upgradeOwned: $('upgrade-owned'),
            itemList: $('item-list'), itemNote: $('item-note'),
            equipmentList: $('equipment-list'), equipNote: $('equip-note'),
            dexList: $('dex-list'), collectionList: $('collection-list'),
            wordDexSummary: $('word-dex-summary'), wordDexFilters: $('word-dex-filters'),
            wordDexLetters: $('word-dex-letters'), wordDexList: $('word-dex-list'),
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
        this._bindTyping();
        this._bindWordDex();
        this._renderWordDex();
    }

    function buildWordDex(banks) {
        var entries = {};
        ['geptElementary', 'geptIntermediate'].forEach(function (bankId) {
            (banks[bankId] || []).forEach(function (item) {
                var text = String(item.text || '').trim();
                var key = text.toLowerCase();
                if (!/^[a-z]/.test(key)) return;
                var entry = entries[key];
                if (!entry) entry = entries[key] = { key: key, text: text, translations: [], banks: {} };
                if (item.translation && entry.translations.indexOf(item.translation) === -1) {
                    entry.translations.push(item.translation);
                }
                entry.banks[bankId] = true;
            });
        });
        return Object.keys(entries).map(function (key) { return entries[key]; }).sort(function (a, b) {
            return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0);
        });
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
        this._renderWordDex();
    };

    UI.prototype._bindWordDex = function () {
        var self = this;
        this.wordDexFilterButtons = [];
        [
            { id: 'all', label: '全部' },
            { id: 'geptElementary', label: '初級' },
            { id: 'geptIntermediate', label: '中級' }
        ].forEach(function (filter) {
            var button = el('button', 'word-dex__filter', filter.label);
            button.type = 'button';
            button.setAttribute('aria-pressed', 'false');
            button.addEventListener('click', function () {
                self.wordDexFilter = filter.id;
                self._renderWordDex();
            });
            self.wordDexFilterButtons.push({ id: filter.id, button: button });
            self.el.wordDexFilters.appendChild(button);
        });
        this.wordDexLetters = [];
        for (var code = 97; code <= 122; code++) {
            var letter = String.fromCharCode(code);
            var button = el('button', 'word-dex__letter', letter.toUpperCase());
            button.type = 'button';
            button.setAttribute('aria-pressed', 'false');
            button.addEventListener('click', function (selected) {
                return function () {
                    self.wordDexSelectedLetter = selected;
                    self._renderWordDex();
                };
            }(letter));
            this.wordDexLetters.push(button);
            this.el.wordDexLetters.appendChild(button);
        }
    };

    UI.prototype._renderWordDex = function () {
        var letter = this.wordDexSelectedLetter;
        var filter = this.wordDexFilter;
        var getEntries = function (selectedLetter) {
            return (this.wordDexByLetter[selectedLetter] || []).filter(function (entry) {
                return filter === 'all' || !!entry.banks[filter];
            });
        }.bind(this);
        var entries = getEntries(letter);
        if (!entries.length) {
            for (var code = 97; code <= 122; code++) {
                var candidate = String.fromCharCode(code);
                if (getEntries(candidate).length) {
                    letter = candidate;
                    this.wordDexSelectedLetter = candidate;
                    entries = getEntries(candidate);
                    break;
                }
            }
        }
        var self = this;
        var filterCount = this.wordDexEntries.filter(function (entry) {
            return filter === 'all' || !!entry.banks[filter];
        }).length;
        this.wordDexFilterButtons.forEach(function (item) {
            item.button.setAttribute('aria-pressed', item.id === filter ? 'true' : 'false');
        });
        this.wordDexLetters.forEach(function (button) {
            var selectedLetter = button.textContent.toLowerCase();
            var count = getEntries(selectedLetter).length;
            button.disabled = count === 0;
            button.setAttribute('aria-label', selectedLetter.toUpperCase() + ' 開頭，共 ' + count + ' 個單字');
        });
        this.wordDexLetters.forEach(function (button) {
            button.setAttribute('aria-pressed', button.textContent.toLowerCase() === letter ? 'true' : 'false');
        });
        setText(this.el.wordDexSummary,
            (filter === 'all' ? '全部級別' : (filter === 'geptElementary' ? '初級' : '中級')) +
            '共 ' + filterCount + ' 個單字　｜　' + letter.toUpperCase() + ' 開頭 ' + entries.length + ' 個');
        this.el.wordDexList.textContent = '';
        entries.forEach(function (entry) {
            var item = el('li', 'word-dex__entry');
            var head = el('div', 'word-dex__head');
            head.appendChild(el('span', 'word-dex__word', entry.text));
            var levels = [];
            if (entry.banks.geptElementary) levels.push('初級');
            if (entry.banks.geptIntermediate) levels.push('中級');
            head.appendChild(el('span', 'word-dex__level', levels.join('・')));
            item.appendChild(head);
            item.appendChild(el('p', 'word-dex__translation', entry.translations.join('；') || '（尚無中文解釋）'));
            self.el.wordDexList.appendChild(item);
        });
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
            } else if (event.type === 'pointerdown') {
                if (event.button !== 0) return;
                if (hold.setPointerCapture && event.pointerId !== undefined) {
                    try { hold.setPointerCapture(event.pointerId); } catch (ignore) {}
                }
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
        hold.addEventListener('lostpointercapture', stop);
        hold.addEventListener('keydown', start);
        hold.addEventListener('keyup', stop);
        hold.addEventListener('blur', stop);
        // 避免長按在手機上跳出系統選單
        hold.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    };

    /** 結冰設備需按住蓄力解凍；提早放開只會清空進度。 */
    UI.prototype._bindFrozenHold = function (button, deviceId) {
        var self = this;
        var fill = button.querySelector('.frozen-chip__fill');
        var duration = 2000;

        var reset = function () {
            if (!self.frozenHold || self.frozenHold.button !== button) return;
            clearInterval(self.frozenHold.timer);
            self.frozenHold = null;
            fill.style.width = '0%';
        };
        var start = function (event) {
            if (event.type === 'keydown') {
                if (event.key !== ' ' && event.key !== 'Enter') return;
                if (event.repeat) return;
                event.preventDefault();
            } else if (event.type === 'pointerdown') {
                if (event.button !== 0) return;
                if (button.setPointerCapture && event.pointerId !== undefined) {
                    try { button.setPointerCapture(event.pointerId); } catch (ignore) {}
                }
            }
            if (self.frozenHold) return;
            var hold = { button: button, startedAt: Date.now(), timer: null };
            self.frozenHold = hold;
            hold.timer = setInterval(function () {
                if (self.frozenHold !== hold) return;
                var progress = Math.min(1, (Date.now() - hold.startedAt) / duration);
                fill.style.width = (progress * 100).toFixed(1) + '%';
                if (progress >= 1) {
                    clearInterval(hold.timer);
                    self.frozenHold = null;
                    self.handlers.onUnfreeze(deviceId);
                }
            }, 30);
        };
        var stop = function (event) {
            if (event.type === 'keyup' && event.key !== ' ' && event.key !== 'Enter') return;
            reset();
        };

        button.addEventListener('pointerdown', start);
        button.addEventListener('pointerup', stop);
        button.addEventListener('pointercancel', stop);
        button.addEventListener('lostpointercapture', stop);
        button.addEventListener('keydown', start);
        button.addEventListener('keyup', stop);
        button.addEventListener('blur', stop);
        button.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    };

    UI.prototype._bindTyping = function () {
        var self = this;
        var composing = false;
        var compositionHandled = false;
        var ignoreCompositionInput = false;

        function physicalTypingKey(event) {
            if (event.key && event.key.length === 1) return event.key;
            var code = event.code || '';
            if (/^Key[A-Z]$/.test(code)) {
                var caps = event.getModifierState && event.getModifierState('CapsLock');
                var upper = !!event.shiftKey !== !!caps;
                var letter = code.slice(3);
                return upper ? letter : letter.toLowerCase();
            }
            if (code === 'Space') return ' ';
            var shiftedKeys = {
                Digit0: [')', '0'], Digit1: ['!', '1'], Digit2: ['@', '2'],
                Digit3: ['#', '3'], Digit4: ['$', '4'], Digit5: ['%', '5'],
                Digit6: ['^', '6'], Digit7: ['&', '7'], Digit8: ['*', '8'], Digit9: ['(', '9'],
                Minus: ['_', '-'], Equal: ['+', '='], BracketLeft: ['{', '['], BracketRight: ['}', ']'],
                Backslash: ['|', '\\'], Semicolon: [':', ';'], Quote: ['"', "'"],
                Backquote: ['~', '`'], Comma: ['<', ','], Period: ['>', '.'], Slash: ['?', '/']
            };
            var pair = shiftedKeys[code];
            return pair ? pair[event.shiftKey ? 0 : 1] : '';
        }

        function sendText(text) {
            if (!text) return;
            for (var i = 0; i < text.length; i++) {
                var character = text.charAt(i);
                if (/^[\x20-\x7E]$/.test(character)) self.handlers.onTypingKey(character);
            }
        }

        this.el.btnSkipPrompt.addEventListener('click', function () { self.handlers.onSkipPrompt(); });
        this.el.btnTypingFloat.addEventListener('click', function () { self.setTypingFloating(true); });
        this.el.btnTypingFloatClose.addEventListener('click', function () { self.setTypingFloating(false); });
        window.addEventListener('resize', function () {
            if (self.el.typingSection.classList.contains('is-floating') && window.innerWidth > 900) {
                self.setTypingFloating(false);
            }
        });
        this.el.btnTypingMask.addEventListener('click', function () {
            self.maskVocabulary = !self.maskVocabulary;
            self.el.btnTypingMask.setAttribute('aria-pressed', self.maskVocabulary ? 'true' : 'false');
            self.el.btnTypingMask.setAttribute('aria-label', self.maskVocabulary ? '顯示完整單字' : '遮住單字');
            self.el.btnTypingMask.title = self.maskVocabulary ? '顯示完整單字' : '遮住尚未輸入的字母';
            if (self.handlers.onTypingMaskChange) self.handlers.onTypingMaskChange(self.maskVocabulary);
            if (self.currentTypingView) self._renderTypingPrompt();
        });
        this.el.typingInput.addEventListener('keydown', function (event) {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            var isComposing = composing || event.isComposing || event.key === 'Process' || event.keyCode === 229;
            if (isComposing) {
                var composingKey = physicalTypingKey(event);
                if (composingKey) {
                    event.preventDefault();
                    compositionHandled = true;
                    self.handlers.onTypingKey(composingKey);
                }
                return;
            }
            if (!event.key || event.key.length !== 1) return;
            event.preventDefault();
            self.handlers.onTypingKey(event.key);
        });
        this.el.typingInput.addEventListener('compositionstart', function () {
            composing = true;
            compositionHandled = false;
        });
        this.el.typingInput.addEventListener('compositionend', function (event) {
            composing = false;
            if (!compositionHandled) sendText(event.data || '');
            compositionHandled = false;
            ignoreCompositionInput = true;
            self.el.typingInput.value = '';
            setTimeout(function () { ignoreCompositionInput = false; }, 0);
        });
        // 保留 IME 組字；一般軟鍵盤輸入則逐字送進英打判定。
        this.el.typingInput.addEventListener('input', function (event) {
            if (composing || event.isComposing) return;
            if (ignoreCompositionInput) {
                this.value = '';
                ignoreCompositionInput = false;
                return;
            }
            sendText(event.data || this.value);
            this.value = '';
        });
        this.el.typingInput.addEventListener('paste', function (event) { event.preventDefault(); });

    };

    UI.prototype.focusTypingInput = function () { this.el.typingInput.focus(); };
    UI.prototype.setTypingFloating = function (active) {
        var section = this.el.typingSection;
        if (!section) return;
        active = !!active && window.matchMedia('(max-width: 900px)').matches;
        if (active) {
            if (!this.typingFloatSpacer) {
                this.typingFloatSpacer = document.createElement('div');
                this.typingFloatSpacer.className = 'typing-float-spacer';
                section.parentNode.insertBefore(this.typingFloatSpacer, section);
            }
            this.typingFloatSpacer.style.height = section.offsetHeight + 'px';
        } else if (this.typingFloatSpacer) {
            this.typingFloatSpacer.remove();
            this.typingFloatSpacer = null;
        }
        section.classList.toggle('is-floating', active);
        this.el.btnTypingFloat.hidden = active;
        this.el.btnTypingFloat.setAttribute('aria-pressed', active ? 'true' : 'false');
        this.el.btnTypingFloatClose.hidden = !active;
    };
    UI.prototype.pulseTypingCharacter = function () {
        var character = this.el.typingPrompt.querySelector('.typing__typed-hit');
        if (character) {
            character.classList.remove('is-hit');
            void character.offsetWidth;
            character.classList.add('is-hit');
        }
    };
    UI.prototype.renderTyping = function (prompt, index, status, error, translation, crazy, forceStatusAnimation) {
        this.currentTypingView = {
            prompt: prompt, index: index, status: status, error: error, translation: translation,
            crazy: crazy, forceStatusAnimation: forceStatusAnimation
        };
        this._renderTypingPrompt();
    };
    UI.prototype._renderTypingPrompt = function () {
        var view = this.currentTypingView;
        if (!view) return;
        var prompt = view.prompt;
        var index = view.index;
        var status = view.status;
        var error = view.error;
        var translation = view.translation;
        var crazy = view.crazy;
        var forceStatusAnimation = view.forceStatusAnimation;
        var isVocabulary = !!translation && !crazy;
        var masked = this.maskVocabulary && isVocabulary;
        this._updateBlindTypingTier(this.game.state.blindCombo, masked);
        var done = el('span', 'typing__done');
        if (index > 1) done.appendChild(document.createTextNode(prompt.slice(0, index - 1)));
        if (index > 0) {
            var lastTyped = prompt.charAt(index - 1);
            done.appendChild(el('span', 'typing__typed-hit', lastTyped === ' ' ? '\u00a0' : lastTyped));
        }
        var rest = prompt.slice(index);
        this.el.typingPrompt.textContent = '';
        this.el.typingPrompt.appendChild(done);
        if (masked && rest) {
            this.el.typingPrompt.appendChild(el('span', 'typing__masked-char', '•'.repeat(rest.length)));
        } else if (rest) {
            this.el.typingPrompt.appendChild(el('span', 'typing__next', rest.charAt(0) === ' ' ? '␣' : rest.charAt(0)));
            this.el.typingPrompt.appendChild(document.createTextNode(rest.slice(1)));
        }
        this.el.typingMaskTools.hidden = !isVocabulary;
        this.el.btnTypingMask.setAttribute('aria-pressed', this.maskVocabulary ? 'true' : 'false');
        this.el.btnTypingMask.setAttribute('aria-label', this.maskVocabulary ? '顯示完整單字' : '遮住單字');
        this.el.btnTypingMask.title = this.maskVocabulary ? '顯示完整單字' : '遮住尚未輸入的字母';
        var statusText = status || '';
        var statusChanged = this.el.typingStatus.textContent !== statusText;
        setText(this.el.typingStatus, statusText);
        if (statusChanged || forceStatusAnimation) {
            this.el.typingStatus.classList.remove('is-hit');
            void this.el.typingStatus.offsetWidth;
            this.el.typingStatus.classList.add('is-hit');
        }
        setText(this.el.typingTranslation, translation || '');
        this.el.typingTranslation.hidden = !translation;
        this.el.typingTranslation.classList.toggle('is-crazy', !!crazy);
        this.el.typingSection.classList.toggle('is-crazy', !!crazy);
        this.el.typingStatus.classList.toggle('is-error', !!error);
        if (this.typingFloatSpacer) this.typingFloatSpacer.style.height = this.el.typingSection.offsetHeight + 'px';
        if (error) {
            this.el.typingInput.classList.remove('has-error');
            // 重新觸發輕微提示動畫
            void this.el.typingInput.offsetWidth;
            this.el.typingInput.classList.add('has-error');
        } else {
            this.el.typingInput.classList.remove('has-error');
        }
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
        var targetNodes = this.targetNodes.get(uid);
        if (targetNodes) this.pulseTarget(targetNodes);
        var entry = this.pending[uid];
        if (!entry || now > entry.until) {
            this.pending[uid] = { amount: amount, crit: !!opts.crit, auto: !!opts.fromAuto, until: now + Config.BALANCE.damageMergeMs };
            return;
        }
        entry.amount += amount;
        entry.crit = entry.crit || !!opts.crit;
        entry.auto = entry.auto && !!opts.fromAuto;
    };

    UI.prototype.pulseTarget = function (nodes) {
        var pulseNodes = [nodes.button, nodes.art, nodes.hpText];
        if (nodes.hitTimer) clearTimeout(nodes.hitTimer);
        pulseNodes.forEach(function (node) { node.classList.remove('is-hit'); });
        void nodes.art.offsetWidth;
        pulseNodes.forEach(function (node) { node.classList.add('is-hit'); });
        nodes.hitTimer = setTimeout(function () {
            pulseNodes.forEach(function (node) { node.classList.remove('is-hit'); });
            nodes.hitTimer = null;
        }, 360);
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

    UI.prototype.killReward = function (name, reward) {
        var burst = el('div', 'kill-reward');
        burst.setAttribute('aria-hidden', 'true');
        burst.style.left = (26 + Math.random() * 48) + '%';
        burst.style.top = (18 + Math.random() * 34) + '%';
        burst.appendChild(el('span', 'kill-reward__title', name + ' 擊敗！'));
        burst.appendChild(el('strong', 'kill-reward__coins', '+' + Format.short(reward.bounty) + ' 菇幣'));
        burst.appendChild(el('span', 'kill-reward__bonus', '額外懸賞 +' + Format.short(reward.bonusBounty)));
        this.el.stage.appendChild(burst);
        setTimeout(function () {
            if (burst.parentNode) burst.parentNode.removeChild(burst);
        }, 1500);
    };

    UI.prototype.showPass = function () {
        var self = this;
        var stage = this.el.stage;
        if (this.passBadgeTimer) clearTimeout(this.passBadgeTimer);
        if (this.passBadge && this.passBadge.parentNode) this.passBadge.parentNode.removeChild(this.passBadge);
        this.passBadge = el('span', 'pass-badge', 'PASS');
        this.passBadge.setAttribute('aria-hidden', 'true');
        stage.appendChild(this.passBadge);
        this.passBadgeTimer = setTimeout(function () {
            if (self.passBadge && self.passBadge.parentNode) self.passBadge.parentNode.removeChild(self.passBadge);
            self.passBadge = null;
            self.passBadgeTimer = null;
        }, 1300);

        if (this.passStageTimer) clearTimeout(this.passStageTimer);
        stage.classList.remove('is-pass');
        void stage.offsetWidth;
        stage.classList.add('is-pass');
        this.passStageTimer = setTimeout(function () {
            stage.classList.remove('is-pass');
            self.passStageTimer = null;
        }, 720);

        var index = 0;
        this.targetNodes.forEach(function (nodes) {
            if (nodes.passTimer) clearTimeout(nodes.passTimer);
            nodes.art.classList.remove('is-pass-nod');
            nodes.art.style.animationDelay = (index * 65) + 'ms';
            void nodes.art.offsetWidth;
            nodes.art.classList.add('is-pass-nod');
            var delay = index * 65;
            nodes.passTimer = setTimeout(function () {
                nodes.art.classList.remove('is-pass-nod');
                nodes.art.style.animationDelay = '';
                nodes.passTimer = null;
            }, 760 + delay);
            index++;
        });
    };

    UI.prototype.shieldBreak = function (uid) {
        var nodes = this.targetNodes.get(uid);
        if (nodes) {
            if (nodes.shieldBreakTimer) clearTimeout(nodes.shieldBreakTimer);
            nodes.art.classList.remove('is-shield-break');
            void nodes.art.offsetWidth;
            nodes.art.classList.add('is-shield-break');
            nodes.shieldBreakTimer = setTimeout(function () {
                nodes.art.classList.remove('is-shield-break');
                nodes.shieldBreakTimer = null;
            }, 820);
        }
        this.floater('✦ 護盾破裂！', 'shield');
    };

    UI.prototype.bossSceneTransition = function (direction) {
        var stage = this.el.stage;
        if (this.sceneTransitionTimer) clearTimeout(this.sceneTransitionTimer);
        stage.classList.remove('is-boss-entering', 'is-boss-exiting');
        void stage.offsetWidth;
        stage.classList.add(direction === 'enter' ? 'is-boss-entering' : 'is-boss-exiting');
        this.sceneTransitionTimer = setTimeout(function () {
            stage.classList.remove('is-boss-entering', 'is-boss-exiting');
            this.sceneTransitionTimer = null;
        }.bind(this), 760);
    };

    UI.prototype.luckyHit = function (uid, multiplier) {
        var stage = this.el.stage;
        var nodes = this.targetNodes.get(uid);
        stage.classList.remove('is-lucky-hit');
        void stage.offsetWidth;
        stage.classList.add('is-lucky-hit');
        if (stage.luckyHitTimer) clearTimeout(stage.luckyHitTimer);
        stage.luckyHitTimer = setTimeout(function () {
            stage.classList.remove('is-lucky-hit');
            stage.luckyHitTimer = null;
        }, 850);
        if (nodes) {
            if (nodes.luckyHitTimer) clearTimeout(nodes.luckyHitTimer);
            nodes.button.classList.remove('is-lucky-hit');
            void nodes.button.offsetWidth;
            nodes.button.classList.add('is-lucky-hit');
            nodes.luckyHitTimer = setTimeout(function () {
                nodes.button.classList.remove('is-lucky-hit');
                nodes.luckyHitTimer = null;
            }, 760);
        }
        this.floater('✨ 幸運加成 ×' + multiplier + '！', 'luck');
    };

    UI.prototype.comboMilestone = function (stacks, multiplier, isMax) {
        var stage = this.el.stage;
        stage.classList.remove('is-combo-surge');
        void stage.offsetWidth;
        stage.classList.add('is-combo-surge');
        if (stage.comboSurgeTimer) clearTimeout(stage.comboSurgeTimer);
        stage.comboSurgeTimer = setTimeout(function () {
            stage.classList.remove('is-combo-surge');
            stage.comboSurgeTimer = null;
        }, 900);
        var combo = this.el.bossCombo;
        combo.classList.remove('is-surge', 'is-max');
        void combo.offsetWidth;
        combo.classList.add('is-surge');
        if (isMax) combo.classList.add('is-max');
        this.floater(isMax
            ? '🔥 連擊全開！英打傷害 ×' + multiplier.toFixed(2)
            : '⚡ 連擊 ' + stacks + ' 層！傷害 ×' + multiplier.toFixed(2), 'combo');
    };

    UI.prototype.blindTypingMilestone = function (streak, multiplier) {
        var button = this.el.btnTypingMask;
        button.classList.remove('is-blind-surge');
        void button.offsetWidth;
        button.classList.add('is-blind-surge');
        if (this.blindMilestoneTimer) clearTimeout(this.blindMilestoneTimer);
        this.blindMilestoneTimer = setTimeout(function () {
            button.classList.remove('is-blind-surge');
            this.blindMilestoneTimer = null;
        }.bind(this), 650);
        this.floater('👁 盲打連擊 ' + streak + '！英打傷害 +' + Math.round((multiplier - 1) * 100) + '%', 'combo');
    };

    UI.prototype._updateBlindTypingTier = function (streak, active) {
        var button = this.el.btnTypingMask;
        for (var tier = 0; tier <= 5; tier++) button.classList.remove('blind-tier-' + tier);
        if (active && streak > 0) {
            var currentTier = Math.min(5, Math.floor(streak / Config.BALANCE.blindCombo.charsPerBonus));
            button.classList.add('blind-tier-' + currentTier);
        }
    };

    /* ---------------- 快速更新 ---------------- */

    UI.prototype.tickFast = function (now) {
        var game = this.game;
        var state = game.state;
        var stats = game.stats;
        var activeBlindVocabulary = this.maskVocabulary && this.currentTypingView &&
            !!this.currentTypingView.translation && !this.currentTypingView.crazy;
        this._updateBlindTypingTier(state.blindCombo, activeBlindVocabulary);

        setText(this.el.coins, (this.showFullCoins || this.numberStyle === 'full')
            ? Format.full(state.coins) : Format.short(state.coins));
        this.el.coins.title = Format.full(state.coins) + ' 菇幣';
        setText(this.el.broth, Format.full(state.broth));
        setText(this.el.click, this.num(Combat.expectedClickDamage(stats)) + ' / 每字');
        setText(this.el.bossTyping, '菇王 ×' + Format.short(stats.bossTypingMult) +
            '　設備 ×' + Format.short(stats.deviceTypingMult));
        setText(this.el.dps, this.num(stats.autoDps) + ' / 每秒');
        setText(this.el.typingCount, Format.full(state.clicks));
        var burstCount = (state.burstWindow || []).reduce(function (count, attackAt) {
            return count + (now - attackAt <= 10000 ? 1 : 0);
        }, 0);
        if (this.lastBurstTrendAt === null) {
            this.lastBurstTrendAt = now;
            this.previousBurstCount = burstCount;
        } else if (now - this.lastBurstTrendAt >= 3000) {
            if (burstCount > this.previousBurstCount) this.burstTrend = 'is-rising';
            else if (burstCount < this.previousBurstCount) this.burstTrend = 'is-falling';
            else this.burstTrend = 'is-steady';
            this.previousBurstCount = burstCount;
            this.lastBurstTrendAt = now;
        }
        var typingRate = burstCount / 10;
        if (typingRate >= 3.5) {
            if (!this.highTypingSince) this.highTypingSince = now;
        } else {
            this.highTypingSince = 0;
        }
        var sustainedHigh = this.highTypingSince && now - this.highTypingSince >= 3000;
        var trend = typingRate === 0 ? '' : sustainedHigh ? '🔥' : (this.burstTrend === 'is-rising' ? '▲' : this.burstTrend === 'is-falling' ? '▼' : '→');
        setText(this.el.typingRate, (trend ? trend + ' ' : '') + typingRate.toFixed(1) + ' 字/秒');
        this.el.typingRate.classList.remove('is-rising', 'is-falling', 'is-steady', 'is-fire');
        this.el.typingRate.classList.add(sustainedHigh ? 'is-fire' : this.burstTrend);
        setText(this.el.lifetimeCoins, Format.full(state.lifetimeCoins));
        setText(this.el.totalDamage, Format.full(state.totalDamage));
        setText(this.el.brothLifetime, Format.full(state.brothLifetime));
        var deviceTotal = 0;
        Config.DEVICES.forEach(function (device) { deviceTotal += state.devices[device.id] || 0; });
        setText(this.el.deviceTotal, Format.full(deviceTotal));
        setText(this.el.couriersCaught, Format.full(state.couriersCaught));
        var spongePresent = game.aliveTargets().some(function (target) {
            var mushroom = Config.MUSHROOM_BY_ID[target.typeId];
            return mushroom && mushroom.traits.indexOf('regen') !== -1;
        });
        this.el.typingAlert.hidden = !spongePresent;
        if (spongePresent) {
            var spongeAlertText = '遭遇吸湯海綿菇！超過 3 秒沒有手動英打攻擊後，牠每秒會恢復最大血量的 15%。持續手打可阻止回血。';
            if (this.el.typingAlert.textContent !== spongeAlertText) setText(this.el.typingAlert, spongeAlertText);
        }

        this._renderBuffs(stats, now);
        this._renderTargets(now);
        this._renderBossPanel(now);
        this._renderCourier(now);
        this.flushDamage();
    };

    UI.prototype._renderBuffs = function (stats, now) {
        var state = this.game.state;
        var list = [];
        if (state.buffs.energy > now) list.push({ label: '提神飲料 英打傷害 ×3', left: (state.buffs.energy - now) / 1000 });
        if (state.buffs.broth > now) list.push({ label: '金湯膠囊 菇幣 ×5', left: (state.buffs.broth - now) / 1000 });
        if (state.buffs.haste > now) list.push({ label: '辣油加速 速度 ×1.2', left: (state.buffs.haste - now) / 1000 });
        if (stats.comboMult > 1.001 && this.game.mode !== 'boss') list.push({ label: '連擊 ×' + stats.comboMult.toFixed(2), left: null });
        if (state.blindCombo > 0) {
            var blindTier = Math.min(5, Math.floor(state.blindCombo / Config.BALANCE.blindCombo.charsPerBonus));
            list.push({
                label: '閉眼連擊 ' + state.blindCombo + ' / ' + Config.BALANCE.blindCombo.maxStacks + '｜英打傷害 +' + Math.round((this.game.blindTypingDamageMult() - 1) * 100) + '%',
                left: null, className: 'buff--blind-tier-' + blindTier
            });
        }
        if (state.cheerCharge) list.push({ label: '下次擊敗雙倍菇幣', left: null });
        if (stats.ruthlessActive) list.push({ label: '無情機器 ×1.5', left: null });

        var signature = list.map(function (b) { return b.label + (b.left === null ? '' : Math.ceil(b.left)) + (b.className || ''); }).join('|');
        if (signature === this._buffSignature) return;
        this._buffSignature = signature;

        this.el.buffBar.textContent = '';
        list.forEach(function (buff) {
            var node = el('li', 'buff' + (buff.className ? ' ' + buff.className : ''));
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
        this.el.stage.classList.toggle('is-crowded', targets.length >= 4);

        targets.forEach(function (target) {
            seen.add(target.uid);
            var nodes = self.targetNodes.get(target.uid);
            var isBoss = target.kind === 'boss';
            var info = isBoss ? Config.BOSS_BY_ID[target.typeId] : Config.MUSHROOM_BY_ID[target.typeId];
            if (!info) return;

            if (!nodes) {
                var button = el('div', 'target' + (isBoss ? ' is-boss' : ''));
                button.setAttribute('role', 'img');
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
                var li = el('li'); li.appendChild(button);
                self.el.targets.appendChild(li);
                nodes = { li: li, button: button, art: art, fill: fill, hpText: hpText, tags: tags };
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
                if (info.traits.indexOf('regen') !== -1) tagText.push('吸血：3 秒沒手打後回血');
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
                (tagText.length ? '，' + tagText.join('、') : '') + '。');
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
        this.el.bossCombo.hidden = !inBoss;
        this.el.fieldActions.hidden = !!inBoss;

        if (!inBoss) {
            var zone = game.zone();
            var boss = Config.BOSS_BY_ID[zone.bossId];
            var respawn = boss && game.bossRespawnStatus(boss.id);
            this.el.btnBoss.disabled = !respawn || !respawn.canChallenge;
            if (!boss) setText(this.el.btnBoss, '此地區沒有菇王');
            else if (respawn.firstClear && respawn.canChallenge) setText(this.el.btnBoss, '挑戰菇王：' + boss.name);
            else if (respawn.canChallenge) setText(this.el.btnBoss, '菇王已重生：再次挑戰 ' + boss.name);
            else setText(this.el.btnBoss,
                (respawn.firstClear ? '首次挑戰進度 ' : '重生進度 ') +
                Format.full(respawn.progress) + ' / ' + Format.full(respawn.goal) + ' 次英打攻擊');
            return;
        }

        var comboState = game.state;
        var comboMax = Config.BALANCE.combo.maxStacks;
        var comboStacks = Math.min(comboMax, comboState.combo || 0);
        var comboProgress = comboMax > 0 ? comboStacks / comboMax * 100 : 0;
        var comboProtected = comboState.buffs.energy > now;
        var comboLeft = Math.max(0, Config.BALANCE.combo.windowSeconds - (now - comboState.lastClickAt) / 1000);
        var comboTrack = this.el.bossComboFill.parentNode;
        this.el.bossComboFill.style.width = comboProgress.toFixed(1) + '%';
        comboTrack.setAttribute('aria-valuenow', String(comboStacks));
        setText(this.el.bossComboValue,
            '連擊 ' + comboStacks + ' / ' + comboMax + '　傷害 ×' + game.stats.comboMult.toFixed(2));
        setText(this.el.bossComboHint, comboStacks <= 0
            ? '開始正確輸入累積連擊；停打 3 秒就會歸零。'
            : comboProtected
                ? '連擊保護中！持續輸入，火力不斷升高。'
                : '保持節奏！' + comboLeft.toFixed(1) + ' 秒內再輸入即可維持連擊。');
        this.el.bossCombo.classList.toggle('is-active', comboStacks > 0);
        this.el.bossCombo.classList.toggle('is-max', comboStacks >= comboMax);

        setText(this.el.bossHelp, game.boss.intro + '　' + game.boss.help);
        var milestone = game.boss.mechanic === 'clickMilestone' ? game.boss.clickMilestone : 0;
        var shieldGate = game.bossShieldGateStatus();
        this.el.bossProgress.hidden = !milestone && !shieldGate;
        if (milestone) {
            var milestoneTarget = game.targets[0];
            var count = milestoneTarget ? milestoneTarget.clickCount : 0;
            var current = count % milestone;
            var remaining = milestone - current;
            setText(this.el.bossProgress, '本場英打進度 ' + current + ' / ' + milestone + ' 次；再 ' + remaining + ' 次就會噴出資源。');
        }
        var needsHold = game.boss.mechanic === 'holdShield' && game.targets[0] && game.targets[0].shields > 0;
        this.el.btnHold.hidden = !needsHold;
        if (needsHold) {
            var gate = shieldGate;
            this.el.btnHold.disabled = !gate.canBreak;
            this.el.holdFill.style.width = (gate.canBreak ? game.holdProgress(now) * 100 : 0).toFixed(1) + '%';
            setText(this.el.holdLabel, gate.canBreak
                ? '按住 ' + game.boss.holdSeconds + ' 秒後放開破第 ' + gate.layer + ' 層（剩 ' + gate.left + ' 層）'
                : '先完成 ' + gate.goal + ' 個單字（' + gate.progress + ' / ' + gate.goal + '）');
            if (gate.goal > 0) {
                setText(this.el.bossProgress,
                    '第 ' + gate.layer + ' 層護盾：再完成 ' + (gate.goal - gate.progress) +
                    ' 個單字（' + gate.progress + ' / ' + gate.goal + '），即可蓄力破盾。');
            } else {
                setText(this.el.bossProgress, '第 1 層護盾可直接蓄力。每層需分開按住；放開太早就重新蓄力。');
            }
        } else if (game.boss.mechanic === 'holdShield' && game.targets[0] && game.targets[0].shields <= 0) {
            this.el.bossProgress.hidden = false;
            setText(this.el.bossProgress, '護盾全數破除！現在可以攻擊菇王。');
        } else {
            this.el.holdFill.style.width = '0%';
        }

        var frozen = Object.keys(game.state.frozen);
        var signature = frozen.join('|');
        if (signature !== this._frozenSignature) {
            if (this.frozenHold) {
                clearInterval(this.frozenHold.timer);
                this.frozenHold = null;
            }
            this._frozenSignature = signature;
            this.el.frozenList.textContent = '';
            var self = this;
            frozen.forEach(function (deviceId) {
                var device = Config.DEVICE_BY_ID[deviceId];
                var li = el('li');
                var chip = el('button', 'frozen-chip');
                chip.type = 'button';
                chip.setAttribute('aria-label', '按住 2 秒解凍 ' + (device ? device.name : deviceId));
                var fill = el('span', 'frozen-chip__fill');
                fill.setAttribute('aria-hidden', 'true');
                var label = el('span', 'frozen-chip__label', '❄ ' + (device ? device.name : deviceId) + '：按住 2 秒解凍');
                chip.appendChild(fill);
                chip.appendChild(label);
                self._bindFrozenHold(chip, deviceId);
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
        this.el.stage.dataset.zoneId = zone.id;
        var mobileBackdrop = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
        var stageImage = 'assets/bg-' + zone.id.replace('zone_', 'zone-') +
            (mobileBackdrop ? '-mobile' : '') + '.svg';
        if (this.el.stageImage.getAttribute('src') !== stageImage) this.el.stageImage.setAttribute('src', stageImage);
        var depth = game.depthOf(zone.id);
        var depthRange = Math.max(1, Config.BALANCE.depth.maxSteps - 1);
        this.el.zoneDepth.style.setProperty('--depth-hue', String(Math.round(120 * (1 - (depth - 1) / depthRange))));
        setText(this.el.zoneDepth, String(depth));
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
        var frozenNames = Config.DEVICES.filter(function (device) {
            return !!game.state.frozen[device.id] && (game.state.devices[device.id] || 0) > 0;
        }).map(function (device) { return device.name; });
        this.el.deviceFreezeNote.hidden = frozenNames.length === 0;
        if (frozenNames.length) {
            setText(this.el.deviceFreezeNote,
                '急凍菇凍結了 ' + frozenNames.length + ' 種設備：' + frozenNames.join('、') +
                '。這些設備的自動效果暫停，英打加成仍保留。請回到菇王挑戰畫面，按住結冰設備按鈕 2 秒解凍。');
        }
        Config.DEVICES.forEach(function (device) {
            var nodes = self.deviceNodes[device.id];
            var owned = game.state.devices[device.id] || 0;
            var unlocked = game.deviceUnlocked(device);
            var frozen = !!game.state.frozen[device.id];

            setText(nodes.count, String(owned));
            nodes.row.classList.toggle('is-frozen', frozen);
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
            var paybackCount = plan.count || 1;
            var paybackCost = plan.count ? plan.cost : game.deviceUnitCost(device, owned);
            var payback = game.devicePaybackSeconds(device.id, paybackCount, paybackCost, now);
            var info = game.stats.perDevice[device.id];
            var effectText;
            var typingEffect = owned
                ? '首台英打加成已啟用 ×' + self.num(device.typingDamageMult)
                : '首台啟用英打傷害 ×' + self.num(device.typingDamageMult);
            if (device.role === 'attack') {
                effectText = '每台 ' + self.num(info.dps) + ' 傷害 / 秒' +
                    (owned ? '　持有合計 ' + self.num(info.totalDps) + ' 傷害 / 秒' : '') +
                    '　' + typingEffect;
                effectText = appendPayback(effectText, payback);
            } else if (device.role === 'support') {
                effectText = device.support.type === 'haste'
                    ? '每 ' + (device.cooldown / Math.max(0.0001, game.stats.speedMult)).toFixed(1) + ' 秒讓全設備速度 ×1.2，持續 3 秒'
                    : '每 ' + device.cooldown + ' 秒讓下一次擊敗掉落雙倍菇幣';
                effectText += '　' + typingEffect;
                effectText = appendPayback(effectText, payback);
            } else {
                effectText = '依歷史菇幣提供全設備乘區，目前 ×' + game.stats.inductionMult.toFixed(2) +
                    '（上限 ×' + Config.BALANCE.induction.cap + '）　' + typingEffect;
                effectText = appendPayback(effectText, payback);
            }
            if (frozen) effectText = '❄ 冰凍中・停止運作　' + effectText;
            setText(nodes.effect, effectText);

            var unitBrothCost = owned === 0 && device.brothCost ? device.brothCost : 0;
            var unitCostText = self.num(game.deviceUnitCost(device, owned));
            var costText = plan.count > 0
                ? 'x' + plan.count + '台　' + self.num(plan.cost) + ' 菇幣' + (plan.brothCost ? ' + ' + plan.brothCost + ' 金湯滴' : '')
                : '菇幣不足　' + unitCostText + ' 菇幣' + (unitBrothCost ? ' + ' + unitBrothCost + ' 金湯滴' : '');
            if (plan.count > 0) {
                setText(nodes.cost, costText);
            } else {
                nodes.cost.textContent = '';
                nodes.cost.appendChild(document.createTextNode('菇幣不足　'));
                nodes.cost.appendChild(el('strong', '', unitCostText + ' 菇幣'));
                if (unitBrothCost) nodes.cost.appendChild(document.createTextNode(' + ' + unitBrothCost + ' 金湯滴'));
            }
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
        });
        var pendingMilestones = Content.UPGRADES.filter(function (u) {
            return !state.upgrades[u.id] && u.auto;
        });
        var owned = Content.UPGRADES.filter(function (u) { return state.upgrades[u.id]; });

        var signature = available.map(function (u) { return u.id; }).join(',') + '#' +
            locked.map(function (u) { return u.id; }).join(',') + '#' +
            pendingMilestones.map(function (u) { return u.id; }).join(',') + '#' + owned.length;
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
                mid.appendChild(el('p', 'shop-row__effect', '解鎖條件：' + upgrade.reqText));
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

            pendingMilestones.forEach(function (upgrade) {
                var row = el('li', 'shop-row is-locked');
                var icon = el('span', 'shop-row__icon');
                icon.appendChild(self.icon('u:' + upgrade.id, upgrade.image, upgrade.name.slice(0, 2)));
                var mid = el('span');
                mid.appendChild(el('span', 'shop-row__name', upgrade.name));
                mid.appendChild(el('p', 'shop-row__desc', upgrade.desc));
                mid.appendChild(el('p', 'shop-row__effect', '自動取得條件：' + upgrade.reqText));
                row.appendChild(icon); row.appendChild(mid);
                self.el.upgradeList.appendChild(row);
            });

            if (!available.length && !locked.length && !pendingMilestones.length) {
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
            setText(nodes.cost, self.num(cost) + ' 菇幣' + (brothCost ? ' + ' + brothCost + ' 金湯滴' : ''));
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
