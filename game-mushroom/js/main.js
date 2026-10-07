/*!
 * 組裝層：把戰鬥、經濟、存檔、輸入與畫面接起來
 * 只有一個邏輯迴圈（setInterval），依實際經過時間結算，不假設計時器準時。
 */
(function () {
    'use strict';

    var Config = window.MushConfig;
    var Content = window.MushContent;
    var Format = window.MushFormat;
    var GameAPI = window.MushGame;
    var StorageAPI = window.MushStorage;
    var ImagesAPI = window.MushImages;
    var UIAPI = window.MushUI;

    var LOOP_MS = 100;
    var SLOW_EVERY = 4;

    function $(id) { return document.getElementById(id); }

    function App() {
        this.game = new GameAPI.Game({});
        this.storage = new StorageAPI.Storage({});
        this.settings = this.storage.loadSettings();
        this.isPrimary = true;
        this.slowCounter = 0;
        this.sinceSave = 0;
        this.lastFocus = null;
        this.confirmAction = null;
        this.pendingImport = null;

        this.motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
        this.darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

        this.images = new ImagesAPI.ImageStore({ sources: this._imageSources() });
        this.ui = new UIAPI.UI({
            game: this.game,
            images: this.images,
            handlers: {
                onClickTarget: this.clickTarget.bind(this),
                onBuyDevice: this.buyDevice.bind(this),
                onBuyUpgrade: this.buyUpgrade.bind(this),
                onBuyItem: this.buyItem.bind(this),
                onUseItem: this.useItem.bind(this),
                onEquip: this.equip.bind(this),
                onZone: this.switchZone.bind(this),
                onBoss: this.startBoss.bind(this),
                onExitBoss: this.exitBoss.bind(this),
                onHoldStart: this.holdStart.bind(this),
                onHoldEnd: this.holdEnd.bind(this),
                onUnfreeze: this.unfreeze.bind(this),
                onCourier: this.clickCourier.bind(this),
                onBuyMode: this.setBuyMode.bind(this)
            }
        });

        this.bindGame();
        this.bindUI();
        this.applySettings();

        var self = this;
        this.images.loadAll(function (summary) {
            self.ui.refreshArt();
            if (summary.failed.length) {
                self.ui.toast('有 ' + summary.failed.length + ' 張圖片載入失敗，已改用色塊與名稱顯示，遊戲不受影響。');
            }
        });

        this.loadGame();
        this.claimTab(true);
        this.start();
    }

    App.prototype._imageSources = function () {
        var sources = [{ key: 'courier', src: Config.COURIER_IMAGE }];
        Config.MUSHROOMS.forEach(function (m) { sources.push({ key: 'm:' + m.id, src: m.image }); });
        Config.BOSSES.forEach(function (b) { sources.push({ key: 'k:' + b.id, src: b.image }); });
        Config.DEVICES.forEach(function (d) { sources.push({ key: 'd:' + d.id, src: d.image }); });
        Content.ITEMS.forEach(function (i) { sources.push({ key: 'i:' + i.id, src: i.image }); });
        Content.EQUIPMENT.forEach(function (e) { sources.push({ key: 'e:' + e.id, src: e.image }); });
        Content.UPGRADES.forEach(function (u) { sources.push({ key: 'u:' + u.id, src: u.image }); });
        return sources;
    };

    /* ---------------- 存檔 ---------------- */

    App.prototype.loadGame = function () {
        var result = this.storage.load();
        if (result.status === 'ok') {
            this.game.loadSnapshot(result.state);
            var report = this.game.tick();
            if (result.migrated) this.ui.toast('存檔已從舊版本（v' + result.from + '）升級。');
            if (report.kind === 'offline' && report.coins > 0) this.showOffline(report);
        } else {
            if (result.status === 'corrupt') {
                this.ui.toast('存檔無法讀取（' + result.reason + '），已開始新的一局。可以到設定嘗試還原備份。');
            } else if (!this.storage.available) {
                this.ui.toast('瀏覽器停用了本機儲存，這一局的進度不會被保存。');
            }
            this.game.tick();
        }
        this.updateSaveStatus();
    };

    App.prototype.save = function (manual) {
        if (!this.isPrimary) return false;
        var ok = this.storage.save(this.game.snapshot());
        if (manual) this.ui.toast(ok ? '已存檔。' : '存檔失敗（儲存空間不可用或已滿）。');
        else if (!ok && !this.saveWarned) {
            this.saveWarned = true;
            this.ui.toast('無法寫入本機儲存，進度不會被保存。');
        }
        this.lastSaveAt = Date.now();
        this.updateSaveStatus();
        return ok;
    };

    App.prototype.updateSaveStatus = function () {
        var node = $('save-status');
        if (!node) return;
        if (!this.storage.available) { node.textContent = '本機儲存不可用，這一局不會被保存。'; return; }
        if (!this.isPrimary) { node.textContent = '另一個分頁正在遊戲中，這個分頁不會寫入存檔。'; return; }
        node.textContent = this.lastSaveAt
            ? '每 ' + Config.BALANCE.autoSaveSeconds + ' 秒自動存檔，上次存檔：' +
              new Date(this.lastSaveAt).toLocaleTimeString('zh-TW')
            : '每 ' + Config.BALANCE.autoSaveSeconds + ' 秒自動存檔。';
    };

    /* ---------------- 多分頁 ---------------- */

    App.prototype.claimTab = function (initial) {
        var was = this.isPrimary;
        this.isPrimary = this.storage.claimLock();
        var banner = $('readonly-banner');
        if (banner) banner.hidden = this.isPrimary;
        if (!initial && was !== this.isPrimary) {
            this.ui.toast(this.isPrimary ? '已接管，這個分頁開始計算收益。' : '另一個分頁接管了遊戲。');
        }
        this.updateSaveStatus();
        return this.isPrimary;
    };

    App.prototype.takeover = function () {
        this.storage.forceLock();
        this.isPrimary = true;
        $('readonly-banner').hidden = true;
        this.game.state.lastSettle = Date.now();
        this.ui.toast('這個分頁已接管遊戲。');
        this.updateSaveStatus();
    };

    App.prototype.requirePrimary = function () {
        if (this.isPrimary) return true;
        this.ui.toast('這個分頁是唯讀的。要在這裡遊玩，請先點「改由這個分頁接管」。');
        return false;
    };

    /* ---------------- 主迴圈 ---------------- */

    App.prototype.start = function () {
        var self = this;
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(function () { self.loop(); }, LOOP_MS);
        this.loop();
    };

    App.prototype.loop = function () {
        var now = Date.now();

        if (!this.lastHeartbeat || now - this.lastHeartbeat > Config.BALANCE.tab.heartbeatMs) {
            this.lastHeartbeat = now;
            this.claimTab(false);
        }

        if (this.isPrimary) {
            var report = this.game.tick(now);
            if (report.kind === 'offline' && report.coins > 0) this.showOffline(report);
            this.sinceSave += LOOP_MS;
            if (this.sinceSave >= Config.BALANCE.autoSaveSeconds * 1000) {
                this.sinceSave = 0;
                this.save(false);
            }
        } else {
            this.game.refreshStats(now);
        }

        this.ui.tickFast(now);
        this.slowCounter++;
        if (this.slowCounter >= SLOW_EVERY) {
            this.slowCounter = 0;
            this.ui.tickSlow(now);
        }
    };

    /* ---------------- 遊戲事件 ---------------- */

    App.prototype.bindGame = function () {
        var self = this;
        this.game.on('damage', function (e) { self.ui.queueDamage(e.uid, e.amount, e); });
        this.game.on('blocked', function () { self.ui.floater('護盾擋下', 'block'); });
        this.game.on('achievement', function (a) {
            self.ui.toast('達成成就：' + a.name);
            self.ui.announce('達成成就：' + a.name);
        });
        this.game.on('bossDefeated', function (e) {
            var boss = Config.BOSS_BY_ID[e.bossId];
            var text = '擊敗 ' + boss.name + '！' + boss.reward + '，取得收藏品「' + boss.collection + '」。';
            self.ui.toast(text);
            self.ui.announce(text);
            self.save(false);
        });
        this.game.on('milestone', function (u) { self.ui.toast('取得里程碑升級：' + u.name); });
        this.game.on('flee', function () {
            self.ui.floater('逃走了！', 'block');
            self.ui.announce('寶箱松露逃走了，沒有掉落獎勵。');
        });
        this.game.on('courier', function () { self.ui.announce('迷路的外送員出現了。'); });
        this.game.on('freeze', function (e) { self.ui.announce('有 ' + e.count + ' 台設備被凍結，點擊它們解凍。'); });
        this.game.on('depth', function (e) {
            if (e.zoneId === self.game.state.zoneId) self.ui.floater('採集深度 ' + e.depth, '');
        });
        this.game.on('broth', function (e) { self.ui.floater('+' + e.amount + ' 金湯滴', 'crit'); });
    };

    /* ---------------- 操作 ---------------- */

    App.prototype.clickTarget = function (uid) {
        if (!this.requirePrimary()) return;
        // 快速連點時，上一個目標可能已經被擊敗但畫面還沒重繪；
        // 這時改打場上第一個存活目標，不要讓這次點擊落空。
        var target = this.game._findTarget(uid);
        if (!target) {
            var alive = this.game.aliveTargets();
            if (!alive.length) return;
            uid = alive[0].uid;
        }
        this.game.clickTarget(uid);
        this.game.state.preferredUid = uid;      // 玩家點過的目標成為單體設備的優先目標
        this.ui.tickFast(Date.now());
    };

    App.prototype.buyDevice = function (deviceId) {
        if (!this.requirePrimary()) return;
        var result = this.game.buyDevice(deviceId, this.ui.buyMode);
        if (!result) return;
        var device = Config.DEVICE_BY_ID[deviceId];
        this.ui.announce('購買 ' + device.name + ' ×' + result.count + '，自動火力 ' +
            Format.rate(this.game.stats.autoDps) + '。');
        this.ui.tickSlow(Date.now());
    };

    App.prototype.buyUpgrade = function (upgradeId) {
        if (!this.requirePrimary()) return;
        if (!this.game.buyUpgrade(upgradeId)) return;
        var upgrade = Content.UPGRADE_BY_ID[upgradeId];
        this.ui.toast('已購買升級：' + upgrade.name);
        this.ui.announce('已購買升級 ' + upgrade.name);
        this.ui.tickSlow(Date.now());
    };

    App.prototype.buyItem = function (itemId) {
        if (!this.requirePrimary()) return;
        if (!this.game.buyItem(itemId)) return;
        this.ui.toast('已購買：' + Content.ITEM_BY_ID[itemId].name);
        this.ui.tickSlow(Date.now());
    };

    App.prototype.useItem = function (itemId) {
        if (!this.requirePrimary()) return;
        var result = this.game.useItem(itemId);
        if (!result) return;
        var item = Content.ITEM_BY_ID[itemId];
        var text;
        if (result.kind === 'bomb') text = '引爆 ' + item.name + '，造成 ' + Format.short(result.damage) + ' 真實傷害。';
        else if (result.kind === 'whistle') {
            text = '吹響哨子，取得 ' + Format.short(result.coins) + ' 菇幣（估算擊敗 ' +
                Format.short(result.kills) + ' 隻）。今天還能使用 ' + result.remaining + ' 次。';
        } else text = '使用 ' + item.name + '，效果開始生效。';
        this.ui.toast(text);
        this.ui.announce(text);
        this.ui.tickSlow(Date.now());
    };

    App.prototype.equip = function (equipmentId) {
        if (!this.requirePrimary()) return;
        var next = this.game.state.equipped === equipmentId ? null : equipmentId;
        if (!this.game.equip(next)) return;
        this.ui.toast(next ? ('已裝備：' + Content.EQUIPMENT_BY_ID[next].name) : '已卸下裝備。');
        this.ui.tickSlow(Date.now());
    };

    App.prototype.switchZone = function (zoneId) {
        if (!this.requirePrimary()) return;
        if (!this.game.switchZone(zoneId)) return;
        this.ui.announce('切換到 ' + Config.ZONE_BY_ID[zoneId].name);
        this.ui.tickSlow(Date.now());
    };

    App.prototype.startBoss = function () {
        if (!this.requirePrimary()) return;
        if (!this.game.startBoss()) return;
        this.ui.announce('開始挑戰 ' + this.game.boss.name);
        this.ui.tickFast(Date.now());
    };

    App.prototype.exitBoss = function () {
        if (!this.requirePrimary()) return;
        this.game.exitBoss();
        this.ui.toast('已退出採集，菇王血量已重置，資源保留。');
        this.ui.tickFast(Date.now());
    };

    App.prototype.holdStart = function () { if (this.requirePrimary()) this.game.startHold(); };
    App.prototype.holdEnd = function () { this.game.cancelHold(); };

    App.prototype.unfreeze = function (deviceId) {
        if (!this.requirePrimary()) return;
        if (this.game.unfreezeDevice(deviceId)) {
            this.ui.announce('已解凍 ' + Config.DEVICE_BY_ID[deviceId].name);
            this.ui.tickFast(Date.now());
        }
    };

    App.prototype.clickCourier = function () {
        if (!this.requirePrimary()) return;
        var result = this.game.clickCourier();
        if (!result) return;
        var text = '攔截到外送員，取得道具：' + Content.ITEM_BY_ID[result.itemId].name;
        this.ui.toast(text);
        this.ui.announce(text);
        this.ui.tickSlow(Date.now());
    };

    App.prototype.setBuyMode = function (mode) {
        this.settings.buyMode = mode;
        this.storage.saveSettings(this.settings);
    };

    /* ---------------- 介面事件 ---------------- */

    App.prototype.bindUI = function () {
        var self = this;

        $('res-coins').addEventListener('click', function () {
            self.ui.showFullCoins = !self.ui.showFullCoins;
            self.ui.tickFast(Date.now());
        });
        $('btn-takeover').addEventListener('click', function () { self.takeover(); });
        $('btn-help').addEventListener('click', function () { self.openDialog($('dlg-help')); });
        $('btn-settings').addEventListener('click', function () { self.openDialog($('dlg-settings')); });
        $('btn-save').addEventListener('click', function () { self.save(true); });

        $('btn-backup').addEventListener('click', function () {
            self.save(false);
            self.ui.toast(self.storage.backup() ? '已建立備份。' : '備份失敗（沒有可備份的存檔）。');
        });

        $('btn-restore').addEventListener('click', function () {
            var backup = self.storage.loadBackup();
            if (backup.status !== 'ok') {
                self.ui.toast(backup.status === 'none' ? '沒有可還原的備份。' : '備份資料損壞，無法還原。');
                return;
            }
            self.confirm('還原備份？', '會用備份取代目前的進度，這個動作無法復原。', '還原', function () {
                self.game.loadSnapshot(backup.state);
                self.game.state.lastSettle = Date.now();
                self.save(false);
                self.ui.tickFast(Date.now());
                self.ui.tickSlow(Date.now());
                self.ui.toast('已還原備份。');
            });
        });

        $('btn-export').addEventListener('click', function () {
            $('export-text').value = self.storage.exportText(self.game.snapshot());
            self.openDialog($('dlg-export'));
        });

        $('btn-copy-export').addEventListener('click', function () {
            var area = $('export-text');
            area.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
            if (!ok && navigator.clipboard) {
                navigator.clipboard.writeText(area.value).then(function () { self.ui.toast('已複製存檔字串。'); });
                return;
            }
            self.ui.toast(ok ? '已複製存檔字串。' : '複製失敗，請手動選取複製。');
        });

        $('btn-import').addEventListener('click', function () {
            $('import-text').value = '';
            $('import-error').hidden = true;
            self.openDialog($('dlg-import'));
        });

        $('btn-import-confirm').addEventListener('click', function () {
            var parsed = self.storage.parseImport($('import-text').value);
            if (!parsed.ok) {
                var error = $('import-error');
                error.textContent = '無法匯入：' + self.importErrorText(parsed.reason) + '。目前的存檔沒有被改動。';
                error.hidden = false;
                return;
            }
            self.pendingImport = parsed.state;
            self.closeDialog($('dlg-import'));
            self.confirm('確定要覆寫目前的進度嗎？', '匯入會用存檔字串取代目前的所有進度，這個動作無法復原。', '覆寫並匯入', function () {
                self.storage.backup();
                self.game.loadSnapshot(self.pendingImport);
                self.game.state.lastSettle = Date.now();
                self.pendingImport = null;
                self.save(false);
                self.ui.tickFast(Date.now());
                self.ui.tickSlow(Date.now());
                self.ui.toast('已匯入存檔（先前的進度已自動備份）。');
            });
        });

        $('btn-clear').addEventListener('click', function () {
            self.confirm('清除所有紀錄？', '會刪除存檔、備份、成就與偏好設定，且無法復原。', '清除紀錄', function () {
                self.storage.clearAll();
                self.game = new GameAPI.Game({});
                self.ui.game = self.game;
                self.bindGame();
                self.settings = self.storage.loadSettings();
                self.applySettings();
                self.ui.tickFast(Date.now());
                self.ui.tickSlow(Date.now());
                self.ui.toast('已清除所有紀錄。');
            });
        });

        $('confirm-ok').addEventListener('click', function () {
            var action = self.confirmAction;
            self.confirmAction = null;
            self.closeDialog($('dlg-confirm'));
            if (action) action();
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-close-dialog]'), function (button) {
            button.addEventListener('click', function () {
                var dialog = button.closest('dialog');
                if (dialog) self.closeDialog(dialog);
            });
        });

        Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (dialog) {
            dialog.addEventListener('close', function () {
                if (dialog === $('dlg-confirm')) self.confirmAction = null;
                if (self.lastFocus && document.contains(self.lastFocus)) self.lastFocus.focus();
                self.lastFocus = null;
            });
        });

        ['theme', 'motion', 'numberStyle'].forEach(function (name) {
            Array.prototype.forEach.call(document.querySelectorAll('input[name="' + name + '"]'), function (input) {
                input.addEventListener('change', function () {
                    self.settings[name] = input.value;
                    self.storage.saveSettings(self.settings);
                    self.applySettings();
                });
            });
        });

        [this.darkQuery, this.motionQuery].forEach(function (query) {
            if (!query) return;
            var handler = function () { self.applySettings(); };
            if (query.addEventListener) query.addEventListener('change', handler);
            else if (query.addListener) query.addListener(handler);
        });

        window.addEventListener('pagehide', function () {
            if (self.isPrimary) { self.save(false); self.storage.releaseLock(); }
        });
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && self.isPrimary) self.save(false);
        });
    };

    App.prototype.importErrorText = function (reason) {
        var map = {
            empty: '沒有輸入內容', decode: '字串格式不正確', json: '資料不是有效的 JSON',
            shape: '資料結構不正確', 'version-too-new': '這個存檔來自更新版本的遊戲'
        };
        return map[reason] || ('資料有問題（' + reason + '）');
    };

    /* ---------------- 設定與對話框 ---------------- */

    App.prototype.applySettings = function () {
        var theme = this.settings.theme;
        if (theme === 'system') theme = (this.darkQuery && this.darkQuery.matches) ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);

        var reduced = this.settings.motion === 'reduced' ||
            (this.settings.motion === 'system' && this.motionQuery && this.motionQuery.matches);
        document.documentElement.classList.toggle('reduce-motion', reduced);

        this.ui.setNumberStyle(this.settings.numberStyle);
        this.ui.setBuyMode(this.settings.buyMode);

        ['theme', 'motion', 'numberStyle'].forEach(function (name) {
            var input = document.querySelector('input[name="' + name + '"][value="' + this.settings[name] + '"]');
            if (input) input.checked = true;
        }, this);

        var offline = Config.BALANCE.offline;
        var help = $('help-offline');
        if (help) {
            help.textContent = '離開超過 ' + offline.graceSeconds + ' 秒後回來，會以 ' +
                Math.round(offline.efficiency * 100) + '% 效率結算，最多累積 ' + this.game.offlineCapHours() +
                ' 小時（買下複合利息後為 ' + Config.BALANCE.offline.extendedHours +
                ' 小時），且不計入任何限時加成。';
        }
    };

    App.prototype.openDialog = function (dialog) {
        this.lastFocus = document.activeElement;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    };

    App.prototype.closeDialog = function (dialog) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    };

    App.prototype.confirm = function (title, text, okLabel, onConfirm) {
        $('confirm-title').textContent = title;
        $('confirm-text').textContent = text;
        $('confirm-ok').textContent = okLabel;
        this.confirmAction = onConfirm;
        this.openDialog($('dlg-confirm'));
    };

    App.prototype.showOffline = function (report) {
        var zone = this.game.zone();
        $('offline-text').textContent = '主廚不在的這 ' + Format.duration(report.seconds) +
            '，討伐隊在「' + zone.name + '」沒有偷懶，估計解決了 ' + Format.short(report.kills) +
            ' 朵菇，為公會賺進 ' + Format.short(report.coins) + ' 菇幣。';
        $('offline-note').textContent = '計入 ' + Format.duration(report.countedSeconds) +
            '（上限 ' + report.capHours + ' 小時' + (report.capped ? '，這次已達上限' : '') + '），' +
            '以 ' + Math.round(report.efficiency * 100) + '% 效率估算，不含限時加成與稀有掉落。擊敗數為估算值。';
        this.openDialog($('dlg-offline'));
        this.ui.announce('離線期間獲得 ' + Format.short(report.coins) + ' 菇幣。');
    };

    document.addEventListener('DOMContentLoaded', function () {
        window.mushroomApp = new App();
    });
})();
