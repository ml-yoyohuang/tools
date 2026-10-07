/*!
 * 果實合成 - 組裝層
 * 把世界、繪圖、輸入、儲存與介面接起來。只有一個 requestAnimationFrame 迴圈。
 */
(function () {
    'use strict';

    var Config = window.SuikaConfig;
    var WorldAPI = window.SuikaWorld;
    var RenderAPI = window.SuikaRender;
    var InputAPI = window.SuikaInput;
    var ImagesAPI = window.SuikaImages;
    var StorageAPI = window.SuikaStorage;

    function $(id) { return document.getElementById(id); }

    function Game() {
        this.el = {
            canvas: $('board'),
            score: $('stat-score'),
            best: $('stat-best'),
            merges: $('stat-merges'),
            nextName: $('next-name'),
            nextSwatch: $('next-swatch'),
            currentName: $('current-name'),
            status: $('game-status'),
            danger: $('danger-banner'),
            btnPause: $('btn-pause'),
            btnRestart: $('btn-restart'),
            btnHelp: $('btn-help'),
            btnIndex: $('btn-index'),
            dlgHelp: $('dlg-help'),
            dlgIndex: $('dlg-index'),
            dlgConfirm: $('dlg-confirm'),
            confirmOk: $('confirm-ok'),
            indexList: $('index-list'),
            overlay: $('board-overlay'),
            overlayTitle: $('overlay-title'),
            overlayText: $('overlay-text'),
            overlayActions: $('overlay-actions'),
            live: $('live-region'),
            toast: $('toast'),
            motionInputs: document.querySelectorAll('input[name="motion"]')
        };

        this.storage = new StorageAPI.Storage();
        this.settings = this.storage.loadSettings();
        this.best = this.storage.loadBest();

        this.motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

        this.images = new ImagesAPI.ImageStore({ config: Config });
        this.world = new WorldAPI.World({ config: Config });
        this.renderer = new RenderAPI.Renderer({
            canvas: this.el.canvas,
            config: Config,
            images: this.images,
            reduceMotion: this.reduceMotion()
        });

        this.lastFrame = 0;
        this.rafId = null;
        this.lastFocus = null;
        this.confirmAction = null;
        this.announceTimer = null;
        this.toastTimer = null;

        this.bindWorld();
        this.bindUI();
        this.bindInput();
        this.buildIndexDialog();
        this.applySettings();

        var self = this;
        this.images.loadAll(function (summary) {
            if (summary.failed.length) {
                self.toast('有 ' + summary.failed.length + ' 張水果圖片載入失敗，已改用色球與等級數字顯示，遊戲不受影響。');
            }
        });

        this.updateHud();
        this.start();
    }

    /* ---------- 設定 ---------- */

    Game.prototype.reduceMotion = function () {
        if (this.settings.motion === 'reduced') return true;
        if (this.settings.motion === 'full') return false;
        return !!(this.motionQuery && this.motionQuery.matches);
    };

    Game.prototype.applySettings = function () {
        var reduced = this.reduceMotion();
        document.documentElement.classList.toggle('reduce-motion', reduced);
        if (this.renderer) this.renderer.setReduceMotion(reduced);
        Array.prototype.forEach.call(this.el.motionInputs, function (input) {
            input.checked = input.value === this.settings.motion;
        }, this);
    };

    /* ---------- 世界事件 ---------- */

    Game.prototype.bindWorld = function () {
        var self = this;

        this.world.on('merge', function (event) {
            self.renderer.markPop(event.id);
            self.renderer.addMergeEffect(event.x, event.y, event.level);
            self.renderer.addPopup(event.x, event.y - 10, '+' + event.score);
            self.updateHud();
            self.scheduleAnnounce();
        });

        this.world.on('clear', function (event) {
            self.renderer.addMergeEffect(event.x, event.y, event.level);
            self.renderer.addPopup(event.x, event.y - 10, '+' + event.score);
            self.updateHud();
            self.announce('兩顆' + Config.levelAt(event.level).name + '相撞，一起消除，獲得 ' + event.score + ' 分。', true);
        });

        this.world.on('drop', function () { self.updateHud(); });

        this.world.on('gameover', function (event) {
            self.commitBest();
            self.showOverlay('over');
            self.updateHud();
            self.announce('遊戲結束，本局分數 ' + event.score + ' 分。', true);
        });
    };

    /* ---------- 介面 ---------- */

    Game.prototype.bindUI = function () {
        var self = this;

        this.el.btnPause.addEventListener('click', function () { self.togglePause(); });

        this.el.btnRestart.addEventListener('click', function () {
            if (self.world.state === 'over' || self.world.dropCount === 0) {
                self.restart();
                return;
            }
            self.confirm('重新開始？', '目前這局的分數會歸零，最高分會保留。', '重新開始', function () {
                self.restart();
            });
        });

        this.el.btnHelp.addEventListener('click', function () { self.openDialog(self.el.dlgHelp); });
        this.el.btnIndex.addEventListener('click', function () { self.openDialog(self.el.dlgIndex); });

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

        Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (dialog) {
            dialog.addEventListener('close', function () {
                if (dialog === self.el.dlgConfirm) self.confirmAction = null;
                if (self.lastFocus && document.contains(self.lastFocus)) self.lastFocus.focus();
                self.lastFocus = null;
            });
        });

        Array.prototype.forEach.call(this.el.motionInputs, function (input) {
            input.addEventListener('change', function () {
                self.settings.motion = input.value;
                self.storage.saveSettings(self.settings);
                self.applySettings();
            });
        });

        window.addEventListener('resize', function () { self.renderer.resize(); });
        window.addEventListener('orientationchange', function () {
            // 只重算畫面尺寸，不重建或清空進行中的遊戲
            setTimeout(function () { self.renderer.resize(); }, 150);
        });

        document.addEventListener('visibilitychange', function () {
            // 切到背景自動暫停；回來維持暫停，由玩家手動繼續
            if (document.hidden) self.pauseForBackground();
        });
    };

    Game.prototype.buildIndexDialog = function () {
        var list = this.el.indexList;
        list.textContent = '';
        Config.LEVELS.forEach(function (info) {
            var item = document.createElement('li');
            item.className = 'index-item';

            var swatch = document.createElement('span');
            swatch.className = 'swatch';
            swatch.style.background = info.color;
            swatch.textContent = String(info.level);

            var name = document.createElement('span');
            name.className = 'index-name';
            name.textContent = info.name;

            var meta = document.createElement('span');
            meta.className = 'index-meta';
            var isTop = info.level === Config.MAX_LEVEL;
            meta.textContent = isTop
                ? '最高級 · 兩顆相碰一起消除 +' + Config.SCORING.topClear + ' 分'
                : '合成得分 +' + Config.SCORING.merge[info.level - 1];

            item.appendChild(swatch);
            item.appendChild(name);
            item.appendChild(meta);
            list.appendChild(item);
        });
    };

    Game.prototype.updateHud = function () {
        var world = this.world;
        var current = Config.levelAt(world.currentLevel);
        var next = Config.levelAt(world.nextLevel);

        this.el.score.textContent = String(world.score);
        this.el.best.textContent = String(Math.max(this.best, world.score));
        this.el.merges.textContent = String(world.mergeCount);
        this.el.currentName.textContent = current.name + '（等級 ' + current.level + '）';
        this.el.nextName.textContent = next.name + '（等級 ' + next.level + '）';
        this.el.nextSwatch.style.background = next.color;
        this.el.nextSwatch.textContent = String(next.level);

        var stateText = {
            running: '進行中',
            paused: '已暫停',
            over: '遊戲結束'
        }[world.state] || '進行中';
        this.el.status.textContent = stateText;

        this.el.btnPause.textContent = world.state === 'paused' ? '繼續' : '暫停';
        this.el.btnPause.setAttribute('aria-pressed', world.state === 'paused' ? 'true' : 'false');
        this.el.btnPause.disabled = world.state === 'over';

        var danger = world.dangerRatio > 0.05 && world.state === 'running';
        this.el.danger.hidden = !danger;
        document.body.classList.toggle('is-danger', danger);
    };

    /* ---------- 流程 ---------- */

    Game.prototype.start = function () {
        var self = this;
        this.lastFrame = 0;
        var loop = function (timestamp) {
            self.rafId = window.requestAnimationFrame(loop);
            var delta = self.lastFrame ? timestamp - self.lastFrame : 16.7;
            self.lastFrame = timestamp;
            self.tick(delta);
        };
        if (this.rafId) window.cancelAnimationFrame(this.rafId);   // 永遠只有一個迴圈
        this.rafId = window.requestAnimationFrame(loop);
    };

    Game.prototype.tick = function (delta) {
        var world = this.world;
        if (world.state === 'running') {
            world.update(delta);
            this.renderer.updateEffects(Math.min(delta, 100));
        }
        this.renderer.draw({
            state: world.state,
            aimX: world.aimX,
            currentLevel: world.currentLevel,
            dangerRatio: world.dangerRatio,
            fruitList: world.fruits()
        }, {
            cooldown: world.cooldownRemaining()
        });

        if (world.state === 'running' && this.lastDanger !== (world.dangerRatio > 0.05)) {
            this.lastDanger = world.dangerRatio > 0.05;
            this.updateHud();
            if (this.lastDanger) this.announce('水果快要超過警戒線了。', true);
        }
    };

    Game.prototype.togglePause = function () {
        if (this.world.state === 'over') return;
        if (this.world.state === 'paused') {
            this.world.resume();
            this.hideOverlay();
        } else {
            this.world.pause();
            this.showOverlay('paused');
        }
        this.updateHud();
    };

    Game.prototype.pauseForBackground = function () {
        if (this.world.state !== 'running') return;
        this.world.pause();
        this.showOverlay('paused');
        this.updateHud();
    };

    Game.prototype.restart = function () {
        this.commitBest();
        this.world.reset();
        this.renderer.clearEffects();
        this.hideOverlay();
        this.lastDanger = false;
        this.updateHud();
        this.announce('已開始新的一局。', true);
    };

    Game.prototype.commitBest = function () {
        if (this.world.score > this.best) {
            this.best = this.world.score;
            this.storage.saveBest(this.best);
            if (this.storage.writeFailed && !this.storageWarned) {
                this.storageWarned = true;
                this.toast('無法寫入本機儲存，最高分不會被保存。');
            }
        }
    };

    /* ---------- 輸入 ---------- */

    Game.prototype.bindInput = function () {
        var self = this;
        this.input = new InputAPI.InputController({
            canvas: this.el.canvas,
            toWorldX: function (clientX) { return self.renderer.toWorldX(clientX); },
            onAim: function (x) { self.world.setAim(x); },
            onAimDelta: function (delta) { self.world.moveAim(delta); },
            onDrop: function () { self.tryDrop(); },
            onPause: function () { self.togglePause(); },
            isBlocked: function () { return self.isBlocked(); },
            isPauseBlocked: function () {
                return !!document.querySelector('dialog[open]') || self.world.state === 'over';
            }
        });
    };

    Game.prototype.isBlocked = function () {
        if (document.querySelector('dialog[open]')) return true;
        if (this.world.state !== 'running') return true;
        return false;
    };

    Game.prototype.tryDrop = function () {
        if (this.isBlocked()) return;
        this.world.drop();   // 冷卻由世界自行判斷
    };

    /* ---------- 覆蓋層與對話框 ---------- */

    Game.prototype.showOverlay = function (kind) {
        var self = this;
        var actions = this.el.overlayActions;
        actions.textContent = '';

        if (kind === 'paused') {
            this.el.overlayTitle.textContent = '已暫停';
            this.el.overlayText.textContent = '物理、冷卻與危險計時都停住了，按「繼續」回到遊戲。';
            actions.appendChild(this.button('繼續遊戲', 'btn btn--primary', function () { self.togglePause(); }));
            actions.appendChild(this.button('重新開始', 'btn', function () {
                self.confirm('重新開始？', '目前這局的分數會歸零，最高分會保留。', '重新開始', function () { self.restart(); });
            }));
        } else {
            this.el.overlayTitle.textContent = '遊戲結束';
            this.el.overlayText.textContent = '本局分數 ' + this.world.score +
                '，最高分 ' + Math.max(this.best, this.world.score) + '，合成 ' + this.world.mergeCount + ' 次。';
            actions.appendChild(this.button('再玩一局', 'btn btn--primary', function () { self.restart(); }));
        }

        this.el.overlay.hidden = false;
        var first = actions.querySelector('button');
        if (first) first.focus();
    };

    Game.prototype.hideOverlay = function () {
        if (this.el.overlay.hidden) return;
        this.el.overlay.hidden = true;
        this.el.overlayActions.textContent = '';
    };

    Game.prototype.button = function (label, className, onClick) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
    };

    Game.prototype.openDialog = function (dialog) {
        this.lastFocus = document.activeElement;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    };

    Game.prototype.closeDialog = function (dialog) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    };

    Game.prototype.confirm = function (title, text, okLabel, onConfirm) {
        $('confirm-title').textContent = title;
        $('confirm-text').textContent = text;
        this.el.confirmOk.textContent = okLabel;
        this.confirmAction = onConfirm;
        this.openDialog(this.el.dlgConfirm);
    };

    /* ---------- 宣告與提示 ---------- */

    Game.prototype.scheduleAnnounce = function () {
        var self = this;
        if (this.announceTimer) clearTimeout(this.announceTimer);
        this.announceTimer = setTimeout(function () {
            self.announceTimer = null;
            self.announce('分數 ' + self.world.score + ' 分，合成 ' + self.world.mergeCount + ' 次。');
        }, 1200);
    };

    Game.prototype.announce = function (message, immediate) {
        if (immediate && this.announceTimer) {
            clearTimeout(this.announceTimer);
            this.announceTimer = null;
        }
        this.el.live.textContent = message;
    };

    Game.prototype.toast = function (message) {
        var self = this;
        this.el.toast.textContent = message;
        this.el.toast.hidden = false;
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(function () {
            self.el.toast.hidden = true;
            self.toastTimer = null;
        }, 6000);
    };

    document.addEventListener('DOMContentLoaded', function () {
        window.suikaGame = new Game();
    });
})();
