/*!
 * 組裝層：把戰鬥、經濟、存檔、英打、HUD 與 3D 場景接起來
 *
 * 只有一個邏輯迴圈（setInterval），依實際經過時間結算，不假設計時器準時。
 * 3D 場景用自己的 requestAnimationFrame 繪圖，只讀取遊戲狀態與事件；
 * 場景載入失敗、分頁在背景或動畫被減少時，遊戲計算完全不受影響。
 */
(function () {
    'use strict';

    var Config = window.MushConfig;
    var Content = window.MushContent;
    var Format = window.MushFormat;
    var GameAPI = window.MushGame;
    var StorageAPI = window.MushStorage;
    var ImagesAPI = window.MushImages;
    var HUDAPI = window.MushHUD;
    var Typing = window.MushTyping;

    var LOOP_MS = 100;
    var SLOW_EVERY = 4;
    var SAVE_KEYS = {
        save: 'tools.mushroom3d.save',
        backup: 'tools.mushroom3d.backup',
        settings: 'tools.mushroom3d.settings',
        lock: 'tools.mushroom3d.lock'
    };
    /** 交給 3D 場景播放的遊戲事件（只呈現，不回寫）。 */
    var SCENE_EVENTS = ['spawn', 'deviceFire', 'haste', 'cheer', 'soften', 'blocked', 'flee',
        'bossMilestone', 'bossStart', 'bossExit', 'bossDefeated', 'buyDevice', 'zone', 'courier',
        'shieldWordProgress', 'broth', 'equip', 'useItem'];

    function $(id) { return document.getElementById(id); }

    function App() {
        this.storage = new StorageAPI.Storage({ keys: SAVE_KEYS });
        this.originalStorage = new StorageAPI.Storage({});      // 原版存檔，只讀取不寫入
        this.settings = this.storage.loadSettings();
        this.isPrimary = true;
        this.slowCounter = 0;
        this.sinceSave = 0;
        this.lastFocus = null;
        this.confirmAction = null;
        this.pendingImport = null;
        this.scene = null;

        this.motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
        this.darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

        this.images = new ImagesAPI.ImageStore({ sources: this._imageSources() });
        this.createGame();
        this.ui = new HUDAPI.UI({
            game: this.game,
            images: this.images,
            typingVocab: window.MushTypingVocab,
            handlers: {
                onTypingKey: this.typingKey.bind(this),
                onSkipPrompt: this.skipTypingPrompt.bind(this),
                onTypingMaskChange: this.typingMaskChanged.bind(this),
                onPickTarget: this.pickTarget.bind(this),
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

        this.bindUI();
        this.applySettings();

        var self = this;
        this.images.loadAll(function (summary) {
            self.ui.refreshArt();
            if (summary.failed.length) {
                self.ui.toast('有 ' + summary.failed.length + ' 張圖示載入失敗，已改用色塊與名稱顯示，遊戲不受影響。');
            }
        });

        this.loadGame();
        this.renderTyping('直接開始打字，每個正確字元都會攻擊。', false);
        this.claimTab(true);
        this.start();
        this.showTitleScreen();
        this.waitForScene();
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

    App.prototype.createGame = function () {
        this.game = new GameAPI.Game({});
        this.typing = new Typing.TypingSession({
            game: this.game,
            banks: {
                sentences: window.MushTypingPrompts,
                geptElementary: window.MushTypingVocab.geptElementary,
                geptIntermediate: window.MushTypingVocab.geptIntermediate
            },
            bank: this.settings.typingBank
        });
        if (this.ui) {
            this.ui.game = this.game;
            this.typing.masked = this.ui.maskVocabulary;
        }
        if (this.scene) this.scene.setGame(this.game);
        this.bindGame();
    };

    /* ---------------- 3D 場景 ---------------- */

    /** 場景模組（ES module）載入完成後接手戰場；失敗則維持 2D 備援戰場。 */
    App.prototype.waitForScene = function () {
        var self = this;
        var stage = $('stage');
        if (/[?&]flat\b/.test(window.location.search)) {
            this.useFallback('已依網址參數 ?flat 改用 2D 戰場（適合效能較弱的裝置），所有機制照常運作。');
            return;
        }
        var attach = function () {
            if (self.scene || !window.MushScene3D) return;
            try {
                self.scene = window.MushScene3D.create({
                    stage: stage,
                    game: self.game,
                    hud: self.ui,
                    isReducedMotion: function () { return document.documentElement.classList.contains('reduce-motion'); },
                    getTheme: function () { return document.documentElement.getAttribute('data-theme'); },
                    onPickTarget: self.pickTarget.bind(self),
                    onCourier: self.clickCourier.bind(self),
                    onUnfreeze: self.unfreeze.bind(self)
                });
            } catch (err) {
                self.scene = null;
                if (window.console) console.error(err);
            }
            if (!self.scene) { self.useFallback('此裝置無法啟動 3D 繪圖，已改用 2D 戰場，所有機制照常運作。'); return; }
            self.ui.scene = self.scene;
            self.scene.setTitleScreen(self.titleScreenActive);
            stage.classList.add('is-3d');
            stage.classList.remove('is-loading', 'is-fallback');
            self.ui.tickFast(Date.now());
            self.ui.layout();
        };
        if (window.MushScene3D) { attach(); return; }
        window.addEventListener('mush-scene-ready', attach, { once: true });
        window.addEventListener('mush-scene-failed', function () {
            self.useFallback('3D 場景載入失敗，已改用 2D 戰場，所有機制照常運作。');
        }, { once: true });
        setTimeout(function () {
            if (!self.scene) self.useFallback('3D 場景載入逾時，先以 2D 戰場進行；載入完成後會自動切換。');
        }, 6000);
    };

    App.prototype.useFallback = function (message) {
        var stage = $('stage');
        if (stage.classList.contains('is-fallback')) return;
        stage.classList.remove('is-loading');
        stage.classList.add('is-fallback');
        this.ui.toast(message);
    };

    /* ---------------- 標題畫面 ---------------- */

    App.prototype.showTitleScreen = function () {
        var self = this;
        var root = document.documentElement;
        var titleScreen = $('title-screen');
        var state = this.game.state;
        var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        this.titleScreenActive = true;
        root.classList.add('is-title-screen');
        if (this.scene) this.scene.setTitleScreen(true);

        var hasProgress = state.clicks > 0 || state.lifetimeCoins > 0;
        var bosses = Config.BOSSES.filter(function (b) { return state.bosses[b.id]; }).length;
        var zone = this.game.zone();
        $('title-screen-progress').textContent = hasProgress
            ? zone.name + '・深度 ' + this.game.depthOf(zone.id) + '・菇幣 ' + Format.short(state.coins) + '・菇王 ' + bosses + '/' + Config.BOSSES.length
            : '新的冒險即將開始';
        $('title-screen-start-label').textContent = hasProgress ? '繼續討伐' : '開始討伐';
        $('title-screen-hint').textContent = coarse ? '點一下畫面開始' : '按任意鍵開始';
        $('title-screen-bank').textContent = '題庫：' + Typing.BANK_NAMES[this.typing.bank];

        if (this._titleScreenBound) return;
        this._titleScreenBound = true;
        $('btn-title-start').addEventListener('click', function (event) {
            event.stopPropagation();
            self.startFromTitleScreen();
        });
        $('btn-title-help').addEventListener('click', function (event) {
            event.stopPropagation();
            self.openDialog($('dlg-help'));
        });
        $('btn-title-settings').addEventListener('click', function (event) {
            event.stopPropagation();
            self.openDialog($('dlg-settings'));
        });
        titleScreen.addEventListener('click', function () { self.startFromTitleScreen(); });
        // 標題畫面上的按鍵只用來開始，不會被當成英打輸入
        window.addEventListener('keydown', function (event) {
            if (!self.titleScreenActive || document.querySelector('dialog[open]')) return;
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            var target = event.target;
            var onTitleLink = target && target.closest && target.closest('.title-screen__link');
            if (onTitleLink && (event.key === 'Enter' || event.key === ' ')) return;
            if (event.key === 'Enter' || event.key === ' ' || (event.key && event.key.length === 1)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                self.startFromTitleScreen();
            }
        }, true);
    };

    App.prototype.startFromTitleScreen = function () {
        if (!this.titleScreenActive) return;
        var self = this;
        var root = document.documentElement;
        var titleScreen = $('title-screen');
        this.titleScreenActive = false;
        if (this.scene) this.scene.setTitleScreen(false);       // 鏡頭推進第一人稱視角
        // 在同一個點擊／按鍵事件中聚焦，手機才會叫出軟鍵盤
        this.ui.focusTypingInput();
        titleScreen.classList.add('is-leaving');
        var done = function () {
            titleScreen.classList.remove('is-leaving');
            root.classList.remove('is-title-screen');
            self.ui.layout();
            self.ui.announce('開始討伐！直接打字攻擊蘑菇。');
        };
        var reduced = root.classList.contains('reduce-motion');
        setTimeout(done, reduced ? 0 : 650);
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
            if (result.status === 'none') this.offerOriginalImport(true);
        }
        this.updateSaveStatus();
    };

    /** 首次開啟 3D 版時，如果本機有原版進度，詢問是否承接。 */
    App.prototype.offerOriginalImport = function (firstRun) {
        var original = this.originalStorage.load();
        var self = this;
        if (original.status !== 'ok') {
            if (!firstRun) this.ui.toast(original.status === 'none' ? '這個瀏覽器沒有原版（2D）存檔。' : '原版存檔無法讀取，沒有進行匯入。');
            return;
        }
        var s = original.state;
        var bosses = Config.BOSSES.filter(function (b) { return s.bosses && s.bosses[b.id]; }).length;
        var summary = '原版進度：歷史累積 ' + Format.short(s.lifetimeCoins || 0) + ' 菇幣、英打攻擊 ' +
            Format.full(s.clicks || 0) + ' 次、擊敗菇王 ' + bosses + ' 隻。';
        $('migrate-summary').textContent = summary;
        $('migrate-note').textContent = firstRun
            ? '要把原版進度帶進 3D 版嗎？原版存檔不會被修改，之後也能在設定中再次匯入。'
            : '匯入會用原版進度取代 3D 版目前的進度（會先自動備份）。原版存檔不會被修改。';
        this.migrateAction = function () {
            if (!firstRun) self.storage.backup();
            self.game.loadSnapshot(original.state);
            self.game.state.lastSettle = Date.now();
            self.save(false);
            self.ui.tickFast(Date.now());
            self.ui.tickSlow(Date.now());
            self.ui.toast('已匯入原版進度。');
        };
        this.openDialog($('dlg-migrate'));
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
        node.textContent = (this.lastSaveAt
            ? '每 ' + Config.BALANCE.autoSaveSeconds + ' 秒自動存檔，上次存檔：' +
              new Date(this.lastSaveAt).toLocaleTimeString('zh-TW') + '。'
            : '每 ' + Config.BALANCE.autoSaveSeconds + ' 秒自動存檔。') + '3D 版使用獨立存檔，不會改動原版進度。';
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
        var game = this.game;
        game.on('damage', function (e) { if (self.game === game) self.ui.queueDamage(e.uid, e.amount, e); });
        game.on('kill', function (e) {
            if (self.game !== game) return;
            var mushroom = Config.MUSHROOM_BY_ID[e.typeId];
            self.ui.killReward(mushroom ? mushroom.name : '蘑菇', e);
        });
        game.on('blocked', function (e) { if (self.game === game) self.ui.floater('護盾擋下', 'block', e.uid); });
        game.on('shieldBreak', function (event) {
            if (self.game !== game) return;
            self.ui.shieldBreak(event.uid, event.left, event.layer);
            self.ui.announce(event.left > 0
                ? '第 ' + event.layer + ' 層護盾裂開！還有 ' + event.left + ' 層。'
                : '三層護盾全部破除，可以攻擊菇王了。');
        });
        game.on('shieldWordProgress', function (gate) {
            if (self.game !== game || !gate) return;
            self.ui.floater('護盾門檻 ' + gate.progress + ' / ' + gate.goal + ' 個單字', 'shield');
            if (gate.canBreak) self.ui.announce('第 ' + gate.layer + ' 層護盾可以蓄力破除了。');
        });
        game.on('bossStart', function () { if (self.game === game) self.ui.bossSceneTransition('enter'); });
        game.on('bossExit', function () { if (self.game === game) self.ui.bossSceneTransition('exit'); });
        game.on('achievement', function (a) {
            if (self.game !== game) return;
            self.ui.toast('達成成就：' + a.name);
            self.ui.announce('達成成就：' + a.name);
        });
        game.on('bossDefeated', function (e) {
            if (self.game !== game) return;
            self.ui.bossSceneTransition('exit');
            var boss = Config.BOSS_BY_ID[e.bossId];
            var text = e.firstClear
                ? '擊敗 ' + boss.name + '！' + boss.reward + '，取得收藏品「' + boss.collection + '」。英打傷害永久 ×' +
                    Format.short(e.typingDamageMult) + '（每擊敗一位菇王翻倍）。'
                : '再次擊敗 ' + boss.name + '！獲得 +' + Format.short(e.bounty) + ' 菇幣與 ' + e.broth + ' 金湯滴。';
            self.ui.floater(boss.name + ' 擊敗！', 'combo-max', undefined, 'crown');
            self.ui.toast(text);
            self.ui.announce(text);
            self.save(false);
        });
        game.on('bossMilestone', function (e) {
            if (self.game === game) self.ui.floater('菇王資源噴發 +' + Format.short(e.coins) + ' 菇幣', 'luck', undefined, 'cash');
        });
        game.on('milestone', function (u) { if (self.game === game) self.ui.toast('取得里程碑升級：' + u.name); });
        game.on('flee', function (e) {
            if (self.game !== game) return;
            self.ui.floater('逃走了！沒有掉落獎勵', 'block', e.uid);
            self.ui.announce('寶箱松露逃走了，沒有掉落獎勵。');
        });
        game.on('courier', function () {
            if (self.game !== game) return;
            self.ui.floater('迷路的外送員出現了！', 'courier', undefined, 'moped');
            self.ui.announce('迷路的外送員出現了，12 秒內點擊可攔截。');
        });
        game.on('freeze', function (e) {
            if (self.game !== game) return;
            self.ui.freezeAlert();
            self.ui.announce('急凍菇凍結了 ' + e.count + ' 種設備。設備區已標示，按住結冰設備 2 秒即可解凍。');
        });
        game.on('unfreeze', function (e) { if (self.game === game) self.ui.unfreezeAlert(e.deviceId); });
        game.on('depth', function (e) {
            if (self.game === game && e.zoneId === self.game.state.zoneId) {
                self.ui.depthUp(e.depth);
                self.ui.announce('採集深度提升到 ' + e.depth + '。');
            }
        });
        game.on('broth', function (e) { if (self.game === game) self.ui.floater('+' + e.amount + ' 金湯滴', 'crit'); });
        SCENE_EVENTS.forEach(function (name) {
            game.on(name, function (payload) {
                if (self.game === game && self.scene) self.scene.onGameEvent(name, payload);
            });
        });
    };

    /* ---------------- 操作 ---------------- */

    /** 點選蘑菇（3D 場景或名牌）：只指定優先目標，不造成攻擊。 */
    App.prototype.pickTarget = function (uid) {
        if (!this.requirePrimary()) return;
        if (!this.game._findTarget(uid)) return;
        this.game.state.preferredUid = uid;
        this.ui.tickFast(Date.now());
    };

    App.prototype.attackTarget = function (uid, options) {
        // 快速連打時，上一個目標可能已經被擊敗但畫面還沒重繪；改打場上第一個存活目標。
        var target = this.game._findTarget(uid);
        if (!target) {
            var alive = this.game.aliveTargets();
            if (!alive.length) return null;
            uid = alive[0].uid;
        }
        var result = this.game.clickTarget(uid, undefined, options);
        this.game.state.preferredUid = uid;
        return result;
    };

    App.prototype.typingKey = function (key) {
        if (!this.requirePrimary()) return;
        var self = this;
        var r = this.typing.key(key, function (uid, options) { return self.attackTarget(uid, options); });
        if (!r.correct) {
            this.renderTyping('再試一次：注意下一個字元' + (r.expected === ' ' ? '是空格' : '、空格與標點') + '。', true);
            if (this.scene) this.scene.miss();
            return;
        }
        if (r.attacked) this.ui.typingShot(r.lucky);
        if (r.combo) this.ui.comboMilestone(r.combo.stacks, r.combo.mult, r.combo.isMax);
        if (r.lucky) {
            this.ui.luckyHit(r.targetUid, r.luckyMult);
            this.ui.announce('幸運加成！這次英打攻擊傷害 ×' + r.luckyMult + '。');
        }
        if (r.blindMilestone) this.ui.blindTypingMilestone(r.blindMilestone.streak, r.blindMilestone.mult);
        if (r.crazyTriggered) this.save(false);
        this.ui.tickFast(Date.now());
        if (r.crazyStarted) this.ui.crazyStart();
        if (r.completedPrompt) {
            this.renderTyping(r.crazyStarted ? '瘋狂連打！每個 a 都會攻擊。'
                : (r.wasCrazy ? '瘋狂連打完成！繼續輸入下一題。' : '題目完成！繼續輸入下一題。'), false, true);
        } else {
            this.renderTyping(this.typing.crazyActive ? '瘋狂連打！每個 a 都會攻擊。' : '輸入中：每個正確字元都會攻擊。', false);
        }
        this.ui.pulseTypingCharacter();
    };

    App.prototype.skipTypingPrompt = function () {
        if (!this.requirePrimary()) return;
        var r = this.typing.skip();
        this.ui.showPass();
        if (r.crazyTriggered) this.save(false);
        this.renderTyping(r.crazyStarted ? '瘋狂連打！每個 a 都會攻擊。' : '已跳過，換一題試試。', false, true);
        if (r.crazyStarted) this.ui.crazyStart();
        this.ui.focusTypingInput();
    };

    App.prototype.typingMaskChanged = function (masked) {
        this.typing.setMasked(masked);
        this.ui.tickFast(Date.now());
    };

    App.prototype.renderTyping = function (status, error, forceStatusAnimation) {
        var prompt = this.typing.current();
        this.ui.renderTyping(prompt.text, this.typing.index, status, error, prompt.translation, prompt.crazy, forceStatusAnimation);
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
        this.ui.focusTypingInput();
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
            this.ui.tickSlow(Date.now());
        }
    };

    App.prototype.clickCourier = function () {
        if (!this.requirePrimary()) return;
        var result = this.game.clickCourier();
        if (!result) return;
        var item = Content.ITEM_BY_ID[result.itemId];
        var text = '攔截到外送員，取得道具：' + item.name;
        this.ui.courierCaught(item.name);
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

        $('btn-import-original').addEventListener('click', function () {
            self.closeDialog($('dlg-settings'));
            self.offerOriginalImport(false);
        });
        $('migrate-ok').addEventListener('click', function () {
            var action = self.migrateAction;
            self.migrateAction = null;
            self.closeDialog($('dlg-migrate'));
            if (action) action();
        });
        $('migrate-skip').addEventListener('click', function () {
            self.migrateAction = null;
            self.closeDialog($('dlg-migrate'));
            self.save(false);       // 寫入 3D 版存檔，下次不再詢問
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
            self.confirm('清除 3D 版所有紀錄？', '會刪除 3D 版的存檔、備份、成就與偏好設定，且無法復原。原版（2D）存檔不受影響。', '清除紀錄', function () {
                self.storage.clearAll();
                self.settings = self.storage.loadSettings();
                self.createGame();
                self.applySettings();
                self.renderTyping('已重新開始，點一下輸入框開始攻擊。', false);
                self.ui.tickFast(Date.now());
                self.ui.tickSlow(Date.now());
                self.save(false);
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

        ['theme', 'motion', 'numberStyle', 'typingBank'].forEach(function (name) {
            Array.prototype.forEach.call(document.querySelectorAll('input[name="' + name + '"]'), function (input) {
                input.addEventListener('change', function () {
                    self.settings[name] = input.value;
                    self.storage.saveSettings(self.settings);
                    self.applySettings();
                    if (name === 'typingBank') {
                        self.typing.setBank(input.value);
                        if (self.titleScreenActive) $('title-screen-bank').textContent = '題庫：' + Typing.BANK_NAMES[input.value];
                        self.renderTyping('已切換至「' + Typing.BANK_NAMES[input.value] + '」。', false);
                    }
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
        // 失焦時清除所有按住中的蓄力，避免操作卡死
        window.addEventListener('blur', function () { self.game.cancelHold(); });
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
        var themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) themeColor.setAttribute('content', theme === 'dark' ? '#0d1c24' : '#e6f3f6');

        var reduced = this.settings.motion === 'reduced' ||
            (this.settings.motion === 'system' && this.motionQuery && this.motionQuery.matches);
        document.documentElement.classList.toggle('reduce-motion', reduced);

        this.ui.setNumberStyle(this.settings.numberStyle);
        this.ui.setBuyMode(this.settings.buyMode);
        if (this.scene) this.scene.applySettings();

        ['theme', 'motion', 'numberStyle', 'typingBank'].forEach(function (name) {
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
        if (dialog.open) return;
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
            '以 ' + Math.round(report.efficiency * 100) + '% 效率估算，不含限時加成、菇王與稀有掉落。擊敗數為估算值。';
        this.openDialog($('dlg-offline'));
        this.ui.announce('離線期間獲得 ' + Format.short(report.coins) + ' 菇幣。');
    };

    document.addEventListener('DOMContentLoaded', function () {
        window.mushroomApp = new App();
    });
})();
