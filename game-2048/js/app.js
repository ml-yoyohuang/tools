/*!
 * 應用組裝層：把規則引擎、輸入、渲染、儲存與設定接起來
 * 不包含遊戲規則本身，規則一律由 engine.js 決定。
 */
(function () {
    'use strict';

    var Engine = window.Game2048Engine;
    var SessionAPI = window.Game2048Session;
    var StorageAPI = window.Game2048Storage;
    var RenderAPI = window.Game2048Render;
    var InputAPI = window.Game2048Input;
    var SettingsAPI = window.Game2048Settings;

    var MOVE_MS = 110;
    var POP_MS = 150;
    var QUEUE_MAX = 2;          // 連續輸入最多排隊兩步，避免無限累積
    var ANNOUNCE_DELAY = 900;   // 分數朗讀的節流時間

    function $(id) { return document.getElementById(id); }

    function App() {
        this.el = {
            board: $('board'),
            grid: $('board-grid'),
            tiles: $('board-tiles'),
            overlay: $('board-overlay'),
            overlayTitle: $('overlay-title'),
            overlayText: $('overlay-text'),
            overlayActions: $('overlay-actions'),
            score: $('stat-score'),
            best: $('stat-best'),
            moves: $('stat-moves'),
            max: $('stat-max'),
            delta: $('score-delta'),
            btnNew: $('btn-new'),
            btnUndo: $('btn-undo'),
            btnHelp: $('btn-help'),
            btnSettings: $('btn-settings'),
            dlgHelp: $('dlg-help'),
            dlgSettings: $('dlg-settings'),
            dlgConfirm: $('dlg-confirm'),
            confirmTitle: $('confirm-title'),
            confirmText: $('confirm-text'),
            confirmOk: $('confirm-ok'),
            btnClearData: $('btn-clear-data'),
            btnExport: $('btn-export'),
            btnImport: $('btn-import'),
            dlgExport: $('dlg-export'),
            dlgImport: $('dlg-import'),
            exportText: $('export-text'),
            importText: $('import-text'),
            importError: $('import-error'),
            btnCopyExport: $('btn-copy-export'),
            btnImportConfirm: $('btn-import-confirm'),
            live: $('live-region'),
            toast: $('toast')
        };

        this.storage = new StorageAPI.Storage();
        this.settings = new SettingsAPI.SettingsController({
            onChange: this.onSettingsChange.bind(this)
        });

        this.session = new SessionAPI.Session({
            size: Engine.DEFAULT_SIZE,
            best: this.storage.loadBest()
        });
        this.game = this.session.game;

        this.busy = false;
        this.queue = [];
        this.token = 0;          // 每次重置／悔棋遞增，讓舊的延遲回呼失效
        this.releaseTimer = null;
        this.announceTimer = null;
        this.toastTimer = null;
        this.lastFocus = null;
        this.confirmAction = null;
        this.storageWarned = false;

        this.renderer = new RenderAPI.Renderer({
            gridEl: this.el.grid,
            tilesEl: this.el.tiles,
            size: this.session.game.size,
            moveDuration: MOVE_MS,
            popDuration: POP_MS,
            reduceMotion: false
        });

        this.input = new InputAPI.InputController({
            boardEl: this.el.board,
            onDirection: this.requestMove.bind(this),
            isBlocked: this.isBlocked.bind(this)
        });
        this.input.bindButtons(Array.prototype.slice.call(document.querySelectorAll('[data-dir]')));

        this.bindUI();
        this.settings.apply(this.storage.loadSettings());
        this.start();
    }

    /* ---------- 啟動與存檔 ---------- */

    App.prototype.start = function () {
        var saved = this.storage.loadGame();
        if (saved.status === 'ok') {
            this.session.restore(saved.data, this.storage.loadBest());
            this.afterReset({ announce: false });
            this.toast('已載入上次的進度，可直接續玩。');
        } else {
            if (saved.status === 'corrupt') {
                this.toast('上次的存檔無法讀取（資料損毀），已為你開新局。');
            } else if (!this.storage.available) {
                this.toast('瀏覽器停用了本機儲存，本局進度不會被保存。');
                this.storageWarned = true;
            }
            this.session.newGame();
            this.afterReset({ announce: false });
        }
    };

    App.prototype.save = function () {
        if (!this.storage.available) return;
        var ok = this.storage.saveGame(this.game.toJSON());
        this.storage.saveBest(this.session.best);
        if (!ok && !this.storageWarned) {
            this.storageWarned = true;
            this.toast('無法寫入本機儲存（空間不足或被封鎖），進度不會被保存。');
        }
    };

    /** 重置畫面狀態（新局、悔棋、載入存檔共用）。 */
    App.prototype.afterReset = function (opts) {
        opts = opts || {};
        this.token++;
        this.queue.length = 0;
        this.busy = false;
        if (this.releaseTimer) { clearTimeout(this.releaseTimer); this.releaseTimer = null; }

        this.renderer.setReduceMotion(this.settings.prefersReducedMotion());
        this.renderer.renderStatic(this.game.tiles());
        this.hideOverlay();
        if (this.game.over) this.showOverlay('over');
        else if (this.game.won && !this.game.keepPlaying) this.showOverlay('win');

        this.updateStats();
        this.updateUndoButton();
        if (opts.announce) this.announce(opts.announce, true);
    };

    /* ---------- 遊戲流程 ---------- */

    App.prototype.isBlocked = function () {
        if (document.querySelector('dialog[open]')) return true;
        if (!this.el.overlay.hidden) return true;
        return false;
    };

    App.prototype.requestMove = function (direction) {
        if (this.isBlocked()) return;
        if (this.game.over) return;
        if (this.busy) {
            if (this.queue.length < QUEUE_MAX) this.queue.push(direction);
            return;
        }
        this.performMove(direction);
    };

    App.prototype.performMove = function (direction) {
        var result = this.session.move(direction);

        if (!result.moved) {
            // 無效移動：盤面沒變，不計步、不生成、不動悔棋紀錄
            return;
        }

        this.renderer.setReduceMotion(this.settings.prefersReducedMotion());
        this.renderer.render(this.game.tiles(), { animate: true });
        this.updateStats();
        this.updateUndoButton();
        this.showDelta(result.gained);
        this.save();

        if (result.won && !this.game.keepPlaying) {
            this.showOverlay('win');
        } else if (result.over) {
            this.showOverlay('over');
        }
        this.scheduleAnnounce();

        this.lock();
    };

    /** 動畫期間鎖住輸入，結束後處理佇列中的下一步。 */
    App.prototype.lock = function () {
        var self = this;
        var token = this.token;
        var wait = this.settings.prefersReducedMotion() ? 0 : MOVE_MS;

        if (wait === 0) {
            // 沒有滑動動畫時不需要鎖，每次輸入都即時處理
            this.busy = false;
            return;
        }

        this.busy = true;
        if (this.releaseTimer) clearTimeout(this.releaseTimer);
        this.releaseTimer = setTimeout(function () {
            self.releaseTimer = null;
            if (token !== self.token) return;   // 期間已重新開始或悔棋
            self.busy = false;
            var next = self.queue.shift();
            if (next && !self.isBlocked() && !self.game.over) self.performMove(next);
        }, wait);
    };

    App.prototype.newGame = function () {
        this.session.newGame();
        this.afterReset({ announce: '已開始新遊戲。' });
        this.save();
    };

    App.prototype.undo = function () {
        if (!this.session.undo()) return;
        this.afterReset({ announce: '已悔棋一步。' });
        this.save();
    };

    /* ---------- 畫面更新 ---------- */

    App.prototype.updateStats = function () {
        this.el.score.textContent = String(this.game.score);
        this.el.best.textContent = String(this.session.best);
        this.el.moves.textContent = String(this.game.moves);
        this.el.max.textContent = String(this.game.maxTile());
    };

    App.prototype.updateUndoButton = function () {
        this.el.btnUndo.disabled = !this.session.canUndo;
    };

    App.prototype.showDelta = function (gained) {
        if (!gained) return;
        var el = this.el.delta;
        el.textContent = '+' + gained;
        el.classList.remove('is-active');
        void el.offsetWidth;
        el.classList.add('is-active');
    };

    App.prototype.showOverlay = function (kind) {
        var self = this;
        var actions = this.el.overlayActions;
        actions.textContent = '';

        if (kind === 'win') {
            this.el.overlayTitle.textContent = '達成 2048！';
            this.el.overlayText.textContent = '目前分數 ' + this.game.score + '，要繼續挑戰更大的數字嗎？';
            actions.appendChild(this.makeButton('繼續挑戰', 'btn btn--primary', function () {
                self.session.continuePlaying();
                self.hideOverlay();
                self.save();
                self.announce('繼續挑戰模式，勝利提示不會再出現。', true);
            }));
            actions.appendChild(this.makeButton('開新遊戲', 'btn', function () { self.newGame(); }));
            this.announce('恭喜達成 2048！', true);
        } else {
            this.el.overlayTitle.textContent = '遊戲結束';
            this.el.overlayText.textContent = '沒有可移動的步數了。本局分數 ' + this.game.score +
                '，最大方塊 ' + this.game.maxTile() + '。';
            actions.appendChild(this.makeButton('再玩一局', 'btn btn--primary', function () { self.newGame(); }));
            if (this.session.canUndo) {
                actions.appendChild(this.makeButton('悔棋一步', 'btn', function () { self.undo(); }));
            }
            this.announce('遊戲結束，分數 ' + this.game.score + '。', true);
        }

        this.el.overlay.hidden = false;
        var first = actions.querySelector('button');
        if (first) first.focus();
    };

    App.prototype.hideOverlay = function () {
        if (this.el.overlay.hidden) return;
        this.el.overlay.hidden = true;
        this.el.overlayActions.textContent = '';
    };

    App.prototype.makeButton = function (label, className, onClick) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
    };

    /* ---------- 無障礙宣告與提示 ---------- */

    App.prototype.scheduleAnnounce = function () {
        var self = this;
        if (this.announceTimer) clearTimeout(this.announceTimer);
        this.announceTimer = setTimeout(function () {
            self.announceTimer = null;
            self.announce('分數 ' + self.game.score + '，步數 ' + self.game.moves +
                '，最大方塊 ' + self.game.maxTile() + '。');
        }, ANNOUNCE_DELAY);
    };

    App.prototype.announce = function (message, immediate) {
        if (immediate && this.announceTimer) {
            clearTimeout(this.announceTimer);
            this.announceTimer = null;
        }
        this.el.live.textContent = message;
    };

    App.prototype.toast = function (message) {
        var self = this;
        this.el.toast.textContent = message;
        this.el.toast.hidden = false;
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(function () {
            self.el.toast.hidden = true;
            self.toastTimer = null;
        }, 5000);
    };

    /* ---------- 對話框 ---------- */

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
        this.confirmTitleText = title;
        this.el.confirmTitle.textContent = title;
        this.el.confirmText.textContent = text;
        this.el.confirmOk.textContent = okLabel;
        this.confirmAction = onConfirm;
        this.openDialog(this.el.dlgConfirm);
    };

    /* ---------- 事件綁定 ---------- */

    App.prototype.bindUI = function () {
        var self = this;

        this.el.btnNew.addEventListener('click', function () {
            if (self.game.moves === 0 && !self.game.over) {
                self.newGame();
                return;
            }
            self.confirm('重新開始？', '目前這局的分數與進度會被清除，最高分會保留。', '重新開始', function () {
                self.newGame();
            });
        });

        this.el.btnUndo.addEventListener('click', function () { self.undo(); });
        this.el.btnHelp.addEventListener('click', function () { self.openDialog(self.el.dlgHelp); });
        this.el.btnSettings.addEventListener('click', function () { self.openDialog(self.el.dlgSettings); });

        this.el.btnClearData.addEventListener('click', function () {
            self.closeDialog(self.el.dlgSettings);
            self.confirm('清除所有紀錄？', '會刪除本局進度、最高分與偏好設定，且無法復原。', '清除紀錄', function () {
                self.storage.clearAll();
                self.session.best = 0;
                self.storageWarned = false;
                self.settings.apply({ theme: 'system', motion: 'system' });
                self.syncSettingsForm();
                self.session.newGame();
                self.afterReset({ announce: '已清除所有紀錄並開始新遊戲。' });
                self.toast('已清除所有紀錄。');
            });
        });

        this.el.btnExport.addEventListener('click', function () {
            self.el.exportText.value = self.storage.exportText({
                game: self.game.toJSON(),
                best: self.session.best,
                settings: self.settings.values
            });
            self.openDialog(self.el.dlgExport);
        });

        this.el.btnCopyExport.addEventListener('click', function () {
            var area = self.el.exportText;
            area.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
            if (!ok && navigator.clipboard) {
                navigator.clipboard.writeText(area.value).then(function () { self.toast('已複製存檔字串。'); });
                return;
            }
            self.toast(ok ? '已複製存檔字串。' : '複製失敗，請手動選取複製。');
        });

        this.el.btnImport.addEventListener('click', function () {
            self.el.importText.value = '';
            self.el.importError.hidden = true;
            self.openDialog(self.el.dlgImport);
        });

        this.el.btnImportConfirm.addEventListener('click', function () {
            var parsed = self.storage.parseImport(self.el.importText.value);
            if (!parsed.ok) {
                self.el.importError.textContent =
                    '無法匯入：' + self.importErrorText(parsed.reason) + '。目前的紀錄沒有被改動。';
                self.el.importError.hidden = false;
                return;
            }
            self.pendingImport = parsed.data;
            self.closeDialog(self.el.dlgImport);
            self.confirm('確定要覆寫目前的紀錄嗎？', '匯入會取代本局進度、最高分與偏好設定，這個動作無法復原。', '覆寫並匯入', function () {
                var data = self.pendingImport;
                self.pendingImport = null;
                self.storage.applyImport(data);
                if (data.game) self.session.restore(data.game, data.best);
                else { self.session.newGame(); self.session.best = data.best; }
                self.settings.apply(data.settings);
                self.afterReset({ announce: '已匯入紀錄。' });
                self.toast('已匯入紀錄。');
            });
        });

        this.el.confirmOk.addEventListener('click', function () {
            var action = self.confirmAction;
            self.confirmAction = null;
            self.closeDialog(self.el.dlgConfirm);
            if (action) action();
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-close-dialog]'), function (button) {
            button.addEventListener('click', function () {
                var dialog = button.closest('dialog');
                if (dialog) self.closeDialog(dialog);
            });
        });

        // 對話框關閉後把焦點還給原本的位置
        Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (dialog) {
            dialog.addEventListener('close', function () {
                if (dialog === self.el.dlgConfirm) self.confirmAction = null;
                if (self.lastFocus && document.contains(self.lastFocus)) {
                    self.lastFocus.focus();
                }
                self.lastFocus = null;
            });
        });

        Array.prototype.forEach.call(document.querySelectorAll('input[name="theme"]'), function (radio) {
            radio.addEventListener('change', function () { self.applySettingsFromForm(); });
        });
        Array.prototype.forEach.call(document.querySelectorAll('input[name="motion"]'), function (radio) {
            radio.addEventListener('change', function () { self.applySettingsFromForm(); });
        });

        // 悔棋快捷鍵
        document.addEventListener('keydown', function (event) {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key !== 'u' && event.key !== 'U') return;
            var target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            if (self.isBlocked()) return;
            event.preventDefault();
            self.undo();
        });

        window.addEventListener('pagehide', function () { self.save(); });
    };

    App.prototype.importErrorText = function (reason) {
        var map = {
            empty: '沒有輸入內容',
            decode: '字串格式不正確',
            json: '資料不是有效的 JSON',
            shape: '資料結構不正確',
            'version-too-new': '這個紀錄來自更新版本的遊戲'
        };
        if (reason && reason.indexOf('game:') === 0) return '本局進度的資料有問題（' + reason.slice(5) + '）';
        return map[reason] || ('資料有問題（' + reason + '）');
    };

    App.prototype.applySettingsFromForm = function () {
        var theme = document.querySelector('input[name="theme"]:checked');
        var motion = document.querySelector('input[name="motion"]:checked');
        var values = {
            theme: theme ? theme.value : 'system',
            motion: motion ? motion.value : 'system'
        };
        this.settings.apply(values);
        this.storage.saveSettings(values);
    };

    App.prototype.syncSettingsForm = function () {
        var values = this.settings.values;
        var theme = document.querySelector('input[name="theme"][value="' + values.theme + '"]');
        var motion = document.querySelector('input[name="motion"][value="' + values.motion + '"]');
        if (theme) theme.checked = true;
        if (motion) motion.checked = true;
    };

    App.prototype.onSettingsChange = function (state) {
        if (this.renderer) this.renderer.setReduceMotion(state.reduceMotion);
        this.syncSettingsForm();
    };

    document.addEventListener('DOMContentLoaded', function () {
        window.game2048App = new App();
    });
})();
