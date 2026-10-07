/*!
 * 組裝層：把遊戲、存檔、圖片與畫面接起來
 * 只有一個邏輯迴圈（setInterval），依實際經過時間結算，不假設計時器準時。
 */
(function () {
    'use strict';

    var Config = window.BakeryConfig;
    var Content = window.BakeryContent;
    var Economy = window.BakeryEconomy;
    var Format = window.BakeryFormat;
    var GameAPI = window.BakeryGame;
    var StorageAPI = window.BakeryStorage;
    var ImagesAPI = window.BakeryImages;
    var UIAPI = window.BakeryUI;

    var LOOP_MS = 100;
    var SLOW_EVERY = 3;   // 每 3 次迴圈更新一次商店（約 300ms）

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
            onBuyBuilding: this.buyBuilding.bind(this),
            onBuyUpgrade: this.buyUpgrade.bind(this),
            onUseItem: this.useItem.bind(this),
            onBuyModeChange: this.setBuyMode.bind(this)
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
        var sources = [
            { key: 'cookie', src: Config.MAIN_COOKIE_IMAGE },
            { key: 'golden', src: Config.GOLDEN_COOKIE_IMAGE }
        ];
        Config.BUILDINGS.forEach(function (b) { sources.push({ key: 'b:' + b.id, src: b.image }); });
        Config.ITEMS.forEach(function (i) { sources.push({ key: 'i:' + i.id, src: i.image }); });
        Content.UPGRADES.forEach(function (u) { sources.push({ key: 'u:' + u.id, src: u.image }); });
        return sources;
    };

    /* ---------------- 存檔 ---------------- */

    App.prototype.loadGame = function () {
        var result = this.storage.load();
        if (result.status === 'ok') {
            this.game.loadSnapshot(result.state);
            var report = this.game.tick();      // 進門先結算離線時間
            if (result.migrated) {
                this.ui.toast('存檔已從舊版本（v' + result.from + '）升級。');
            }
            if (report.kind === 'offline' && report.earned > 0) this.showOffline(report);
        } else {
            if (result.status === 'corrupt') {
                this.ui.toast('存檔無法讀取（' + result.reason + '），已開始新的一局。');
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
        if (manual) {
            this.ui.toast(ok ? '已存檔。' : '存檔失敗（儲存空間不可用或已滿）。');
        } else if (!ok && !this.saveWarned) {
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
        if (!this.storage.available) {
            node.textContent = '本機儲存不可用，這一局不會被保存。';
            return;
        }
        if (!this.isPrimary) {
            node.textContent = '另一個分頁正在遊戲中，這個分頁不會寫入存檔。';
            return;
        }
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
        // 強制接管：直接覆寫鎖，原本的主分頁下次心跳就會變成唯讀
        this.storage._write(StorageAPI.KEYS.lock, JSON.stringify({ tabId: this.storage.tabId, at: Date.now() }));
        this.isPrimary = true;
        var banner = $('readonly-banner');
        if (banner) banner.hidden = true;
        this.game.state.lastSettle = Date.now();
        this.ui.toast('這個分頁已接管遊戲。');
        this.updateSaveStatus();
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

        // 心跳：確認自己還是主分頁
        if (!this.lastHeartbeat || now - this.lastHeartbeat > Config.BALANCE.tab.heartbeatMs) {
            this.lastHeartbeat = now;
            this.claimTab(false);
        }

        if (this.isPrimary) {
            var report = this.game.tick(now);
            if (report.kind === 'offline' && report.earned > 0) this.showOffline(report);

            this.sinceSave += LOOP_MS;
            if (this.sinceSave >= Config.BALANCE.autoSaveSeconds * 1000) {
                this.sinceSave = 0;
                this.save(false);
            }
        } else {
            // 唯讀分頁：只重新整理畫面，不推進時間也不寫入
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
        this.game.on('achievement', function (ach) {
            var text = '達成成就：' + ach.name;
            if (ach.reward) {
                var item = Config.ITEM_BY_ID[ach.reward.itemId];
                text += '，獲得 ' + (item ? item.name : '') + ' ×' + ach.reward.amount;
            }
            self.ui.toast(text);
            self.ui.announce(text);
        });
        this.game.on('goldenSpawn', function () {
            self.ui.announce('黃金餅乾出現了。');
        });
    };

    /* ---------------- 操作 ---------------- */

    App.prototype.buyBuilding = function (buildingId) {
        if (!this.requirePrimary()) return;
        var result = this.game.buyBuilding(buildingId, this.ui.buyMode);
        if (!result) return;
        var building = Config.BUILDING_BY_ID[buildingId];
        this.ui.announce('購買 ' + building.name + ' ×' + result.count +
            '，花費 ' + Format.short(result.cost) + ' 塊，目前每秒 ' + Format.rate(this.game.stats.cps) + ' 塊。');
        this.ui.tickSlow(Date.now());
    };

    App.prototype.buyUpgrade = function (upgradeId) {
        if (!this.requirePrimary()) return;
        if (!this.game.buyUpgrade(upgradeId)) return;
        var upgrade = Content.UPGRADE_BY_ID[upgradeId];
        this.ui.toast('已購買升級：' + upgrade.name);
        this.ui.announce('已購買升級 ' + upgrade.name + '，目前每秒 ' + Format.rate(this.game.stats.cps) + ' 塊。');
        this.ui.tickSlow(Date.now());
    };

    App.prototype.useItem = function (itemId) {
        if (!this.requirePrimary()) return;
        var result = this.game.useItem(itemId);
        if (!result) return;
        var item = Config.ITEM_BY_ID[itemId];
        var text;
        if (result.kind === 'instant') {
            text = '使用 ' + item.name + '，立即獲得 ' + Format.short(result.gain) + ' 塊餅乾。';
        } else {
            text = '使用 ' + item.name + '，效果剩餘 ' + Format.clock(result.remaining) + '。';
        }
        this.ui.toast(text);
        this.ui.announce(text);
        this.ui.tickSlow(Date.now());
    };

    App.prototype.setBuyMode = function (mode) {
        this.settings.buyMode = mode;
        this.storage.saveSettings(this.settings);
    };

    App.prototype.requirePrimary = function () {
        if (this.isPrimary) return true;
        this.ui.toast('這個分頁是唯讀的。要在這裡遊玩，請先點「改由這個分頁接管」。');
        return false;
    };

    /* ---------------- 畫面操作 ---------------- */

    App.prototype.bindUI = function () {
        var self = this;

        // 大餅乾：只用 click，不另外綁 touch，避免一次操作算成兩次
        $('cookie-button').addEventListener('click', function () {
            if (!self.requirePrimary()) return;
            var result = self.game.click();
            self.ui.floater('+' + Format.short(result.gain), result.lucky);
            self.ui.tickFast(Date.now());
        });

        $('golden-cookie').addEventListener('click', function () {
            if (!self.requirePrimary()) return;
            var reward = self.game.clickGolden();
            if (!reward) return;
            var text;
            if (reward.kind === 'cookies') {
                text = '黃金餅乾：獲得 ' + Format.short(reward.gain) + ' 塊餅乾！';
            } else {
                var item = Config.ITEM_BY_ID[reward.itemId];
                text = '黃金餅乾：獲得道具「' + (item ? item.name : reward.itemId) + '」！';
            }
            self.ui.toast(text);
            self.ui.announce(text);
            self.ui.tickSlow(Date.now());
        });

        $('counter-cookies').addEventListener('click', function () {
            self.ui.showFullCookies = !self.ui.showFullCookies;
            self.ui.tickFast(Date.now());
        });

        $('btn-takeover').addEventListener('click', function () { self.takeover(); });
        $('btn-help').addEventListener('click', function () { self.openDialog($('dlg-help')); });
        $('btn-settings').addEventListener('click', function () { self.openDialog($('dlg-settings')); });
        $('btn-save').addEventListener('click', function () { self.save(true); });

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
                self.game.loadSnapshot(self.pendingImport);
                self.game.state.lastSettle = Date.now();
                self.pendingImport = null;
                self.save(false);
                self.ui.tickFast(Date.now());
                self.ui.tickSlow(Date.now());
                self.ui.toast('已匯入存檔。');
            });
        });

        $('btn-clear').addEventListener('click', function () {
            self.confirm('清除所有紀錄？', '會刪除存檔、成就與偏好設定，且無法復原。', '清除紀錄', function () {
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
            if (self.isPrimary) {
                self.save(false);
                self.storage.releaseLock();
            }
        });

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && self.isPrimary) self.save(false);
        });
    };

    App.prototype.importErrorText = function (reason) {
        var map = {
            empty: '沒有輸入內容',
            decode: '字串格式不正確',
            json: '資料不是有效的 JSON',
            shape: '資料結構不正確',
            'version-too-new': '這個存檔來自更新版本的遊戲'
        };
        return map[reason] || ('資料有問題（' + reason + '）');
    };

    /* ---------------- 設定 ---------------- */

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
                Math.round(offline.efficiency * 100) + '% 效率結算，最多累積 ' + offline.maxHours +
                ' 小時，而且不計入任何限時加成。';
        }
    };

    /* ---------------- 對話框 ---------------- */

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
        $('offline-text').textContent = '你離開了 ' + Format.duration(report.seconds) +
            '，計入 ' + Format.duration(report.countedSeconds) +
            '，獲得 ' + Format.short(report.earned) + ' 塊餅乾。';
        $('offline-note').textContent = '離線以 ' + Math.round(report.efficiency * 100) +
            '% 效率結算，最多累積 ' + report.maxHours + ' 小時' +
            (report.capped ? '（這次已達上限）' : '') + '，且不計入限時加成。';
        this.openDialog($('dlg-offline'));
        this.ui.announce('離線期間獲得 ' + Format.short(report.earned) + ' 塊餅乾。');
    };

    document.addEventListener('DOMContentLoaded', function () {
        window.bakeryApp = new App();
    });
})();
