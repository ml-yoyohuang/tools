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
            btnExport: $('btn-export'),
            btnImport: $('btn-import'),
            dlgExport: $('dlg-export'),
            dlgImport: $('dlg-import'),
            exportText: $('export-text'),
            importText: $('import-text'),
            importError: $('import-error'),
            btnCopyExport: $('btn-copy-export'),
            btnImportConfirm: $('btn-import-confirm'),
            indexList: $('index-list'),
            overlay: $('board-overlay'),
            overlayTitle: $('overlay-title'),
            overlayText: $('overlay-text'),
            overlayActions: $('overlay-actions'),
            live: $('live-region'),
            toast: $('toast'),
            motionInputs: document.querySelectorAll('input[name="motion"]')
        };

        this.el.titleScreen = $('title-screen');
        this.el.drawingScreen = $('drawing-screen');
        this.el.gameScreen = $('game-screen');
        this.el.customGame = $('btn-custom-game');
        this.el.defaultGame = $('btn-default-game');
        this.el.btnTitle = $('btn-title');
        this.el.drawingHome = $('btn-drawing-home');
        this.el.fruitCanvas = $('fruit-canvas');
        this.el.imageCanvas = $('image-canvas');
        this.el.drawingTitle = $('drawing-title');
        this.el.drawingStep = $('drawing-step');
        this.el.drawingProgress = $('drawing-progress');
        this.el.drawingPrev = $('btn-drawing-prev');
        this.el.drawingNext = $('btn-drawing-next');
        this.el.drawingStatus = $('drawing-save-status');
        this.el.brushSize = $('brush-size');
        this.el.brushSizeValue = $('brush-size-value');
        this.el.palette = $('color-palette');
        this.el.customColor = $('custom-color');
        this.el.undo = $('btn-undo');
        this.el.clearDrawing = $('btn-clear-drawing');
        this.el.brushTool = $('btn-tool-brush');
        this.el.bucketTool = $('btn-tool-bucket');
        this.el.imageUpload = $('image-upload');
        this.el.placeImage = $('btn-place-image');
        this.el.cancelImage = $('btn-cancel-image');
        this.el.drawingTip = $('drawing-tip');

        this.storage = new StorageAPI.Storage();
        this.settings = this.storage.loadSettings();
        this.best = this.storage.loadBest();

        this.motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

        this.images = new ImagesAPI.ImageStore({ config: Config });
        this.artwork = this.loadArtwork();
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
        this.bindDrawingUI();
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
        this.world.pause();
        this.buildColorPalette();
        this.renderDrawingProgress();
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

        this.el.customGame.addEventListener('click', function () { self.showDrawingScreen(); });
        this.el.defaultGame.addEventListener('click', function () {
            self.images.clearCustom();
            self.showScreen('game');
            self.restart();
        });
        this.el.drawingHome.addEventListener('click', function (event) {
            event.preventDefault();
            self.storeDrawing();
            self.showScreen('title');
        });
        this.el.btnTitle.addEventListener('click', function () {
            if (self.world.dropCount === 0) { self.showScreen('title'); return; }
            self.confirm('回到標題畫面？', '目前這局會結束，分數會保留在最高分紀錄。', '回到標題', function () {
                self.commitBest(); self.world.reset(); self.world.pause(); self.updateHud(); self.showScreen('title');
            });
        });

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

        this.el.btnExport.addEventListener('click', function () {
            self.el.exportText.value = self.storage.exportText({
                best: self.best,
                settings: self.settings
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
            self.confirm('確定要覆寫目前的紀錄嗎？', '匯入會取代最高分與偏好設定，這個動作無法復原。', '覆寫並匯入', function () {
                var data = self.pendingImport;
                self.pendingImport = null;
                self.storage.applyImport(data);
                self.best = data.best;
                self.settings = data.settings;
                self.applySettings();
                self.updateHud();
                self.toast('已匯入紀錄。');
                self.announce('已匯入紀錄，最高分 ' + data.best + '。', true);
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

    Game.prototype.showScreen = function (name) {
        this.el.titleScreen.hidden = name !== 'title';
        this.el.drawingScreen.hidden = name !== 'drawing';
        this.el.gameScreen.hidden = name !== 'game';
        document.body.classList.toggle('is-drawing-screen', name === 'drawing');
        if (name === 'game') this.renderer.resize();
    };

    Game.prototype.loadArtwork = function () {
        try {
            var value = JSON.parse(window.localStorage.getItem('suika_artwork_v1') || '{}');
            return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        } catch (err) { return {}; }
    };

    Game.prototype.saveArtwork = function () {
        try { window.localStorage.setItem('suika_artwork_v1', JSON.stringify(this.artwork)); }
        catch (err) { this.toast('瀏覽器儲存空間不足，這次繪圖只會保留到關閉頁面前。'); }
    };

    Game.prototype.buildColorPalette = function () {
        var self = this;
        ['#e0486b','#c6283c','#e08900','#4f9a2a','#e2690d','#b2243a','#9aa832','#e4718a','#d6a318','#6fa86a','#2f7d4f','#603a2a','#f4c542','#ffffff','#292522','#6d5dfc'].forEach(function (color) {
            var button = document.createElement('button');
            button.type = 'button'; button.style.background = color; button.setAttribute('aria-label', color);
            button.setAttribute('aria-pressed', 'false');
            button.addEventListener('click', function () { self.setBrushColor(color); });
            self.el.palette.appendChild(button);
        });
        this.setBrushColor('#e0486b');
    };

    Game.prototype.setBrushColor = function (color) {
        this.brushColor = color;
        this.el.customColor.value = color;
        Array.prototype.forEach.call(this.el.palette.children, function (button) {
            button.setAttribute('aria-pressed', button.getAttribute('aria-label') === color ? 'true' : 'false');
        });
    };

    Game.prototype.bindDrawingUI = function () {
        var self = this, canvas = this.el.fruitCanvas, ctx = canvas.getContext('2d');
        this.drawCtx = ctx; this.drawingLevel = 0; this.drawingDirty = false; this.hasUserEdit = false; this.undoStack = [];
        this.drawingTool = 'brush'; this.imagePointers = new Map(); this.floatingImage = null;
        this.imageCtx = this.el.imageCanvas.getContext('2d');
        this.el.brushTool.addEventListener('click', function () { self.setDrawingTool('brush'); });
        this.el.bucketTool.addEventListener('click', function () { self.setDrawingTool('bucket'); });
        this.el.imageUpload.addEventListener('change', function () { self.loadFloatingImage(self.el.imageUpload.files[0]); });
        this.el.placeImage.addEventListener('click', function () { self.finishImagePlacement(); });
        this.el.cancelImage.addEventListener('click', function () { self.cancelFloatingImage(); });
        this.el.customColor.addEventListener('input', function () { self.setBrushColor(self.el.customColor.value); });
        this.el.brushSize.addEventListener('input', function () { self.el.brushSizeValue.textContent = self.el.brushSize.value; });
        this.el.undo.addEventListener('click', function () {
            var previous = self.undoStack.pop();
            if (!previous) return;
            ctx.putImageData(previous.image, 0, 0);
            self.hasUserEdit = previous.hasUserEdit;
            self.drawingDirty = true; self.updateDrawingControls();
        });
        this.el.clearDrawing.addEventListener('click', function () {
            self.pushDrawingUndo(); self.paintFruitBase(self.drawingLevel + 1);
            self.hasUserEdit = false; self.drawingDirty = true;
            self.updateDrawingControls();
        });
        this.el.drawingPrev.addEventListener('click', function () { self.storeDrawing(); self.openDrawingLevel(Math.max(0, self.drawingLevel - 1)); });
        this.el.drawingNext.addEventListener('click', function () {
            self.storeDrawing();
            if (self.drawingLevel >= Config.MAX_LEVEL - 1) self.beginCustomGame();
            else self.openDrawingLevel(self.drawingLevel + 1);
        });
        var point = function (event) {
            var rect = canvas.getBoundingClientRect();
            return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
        };
        canvas.addEventListener('pointerdown', function (event) {
            if (self.drawingTool === 'bucket') {
                var fillPoint = point(event);
                self.bucketFill(Math.floor(fillPoint.x), Math.floor(fillPoint.y));
                return;
            }
            event.preventDefault(); canvas.setPointerCapture(event.pointerId);
            self.pushDrawingUndo();
            var p = point(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.lineWidth = Number(self.el.brushSize.value); ctx.strokeStyle = self.brushColor; ctx.fillStyle = self.brushColor;
            ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(p.x, p.y);
            self.isDrawing = true; self.drawingDirty = true; self.hasUserEdit = true; self.updateDrawingControls();
        });
        canvas.addEventListener('pointermove', function (event) {
            if (!self.isDrawing) return;
            var p = point(event); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y);
        });
        var end = function () { self.isDrawing = false; };
        canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

        var imageCanvas = this.el.imageCanvas;
        var imagePoint = function (event) {
            var rect = imageCanvas.getBoundingClientRect();
            return { x: (event.clientX - rect.left) * imageCanvas.width / rect.width, y: (event.clientY - rect.top) * imageCanvas.height / rect.height };
        };
        imageCanvas.addEventListener('pointerdown', function (event) {
            if (!self.floatingImage) return;
            event.preventDefault(); imageCanvas.setPointerCapture(event.pointerId);
            var p = imagePoint(event); self.imagePointers.set(event.pointerId, p); self.resetImageGesture();
        });
        imageCanvas.addEventListener('pointermove', function (event) {
            if (!self.floatingImage || !self.imagePointers.has(event.pointerId)) return;
            self.imagePointers.set(event.pointerId, imagePoint(event));
            var points = Array.from(self.imagePointers.values()), g = self.imageGesture;
            if (points.length >= 2 && g && g.kind === 'pinch') {
                var midX = (points[0].x + points[1].x) / 2, midY = (points[0].y + points[1].y) / 2;
                var dx = points[0].x - points[1].x, dy = points[0].y - points[1].y;
                self.floatingImage.x = g.x + midX - g.midX;
                self.floatingImage.y = g.y + midY - g.midY;
                self.floatingImage.scale = Math.max(g.minScale * 0.35, Math.min(g.minScale * 4, g.scale * Math.sqrt(dx * dx + dy * dy) / Math.max(1, g.distance)));
                self.drawFloatingImage();
            } else if (points.length === 1 && g && g.kind === 'drag') {
                self.floatingImage.x = g.x + points[0].x - g.startX;
                self.floatingImage.y = g.y + points[0].y - g.startY;
                self.drawFloatingImage();
            }
        });
        var endImageGesture = function (event) {
            self.imagePointers.delete(event.pointerId);
            if (self.floatingImage) self.resetImageGesture();
        };
        imageCanvas.addEventListener('pointerup', endImageGesture);
        imageCanvas.addEventListener('pointercancel', endImageGesture);
        imageCanvas.addEventListener('wheel', function (event) {
            if (!self.floatingImage) return;
            event.preventDefault();
            var minScale = Math.min(250 / self.floatingImage.image.naturalWidth, 250 / self.floatingImage.image.naturalHeight);
            self.floatingImage.scale = Math.max(minScale * 0.35, Math.min(minScale * 4, self.floatingImage.scale * Math.exp(-event.deltaY * 0.001)));
            self.drawFloatingImage();
        }, { passive: false });
    };

    Game.prototype.pushDrawingUndo = function () {
        this.undoStack.push({
            image: this.drawCtx.getImageData(0, 0, this.el.fruitCanvas.width, this.el.fruitCanvas.height),
            hasUserEdit: this.hasUserEdit
        });
        if (this.undoStack.length > 20) this.undoStack.shift();
    };

    Game.prototype.paintFruitBase = function (level) {
        var info = Config.levelAt(level), canvas = this.el.fruitCanvas;
        this.drawCtx.clearRect(0, 0, canvas.width, canvas.height);
        this.drawCtx.fillStyle = info.color;
        this.drawCtx.fillRect(0, 0, canvas.width, canvas.height);
    };

    Game.prototype.setDrawingTool = function (tool) {
        this.drawingTool = tool;
        this.el.brushTool.classList.toggle('is-selected', tool === 'brush');
        this.el.bucketTool.classList.toggle('is-selected', tool === 'bucket');
        this.el.brushTool.setAttribute('aria-pressed', tool === 'brush' ? 'true' : 'false');
        this.el.bucketTool.setAttribute('aria-pressed', tool === 'bucket' ? 'true' : 'false');
        this.el.fruitCanvas.style.cursor = tool === 'bucket' ? 'cell' : 'crosshair';
    };

    Game.prototype.bucketFill = function (x, y) {
        var canvas = this.el.fruitCanvas;
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
        var image = this.drawCtx.getImageData(0, 0, canvas.width, canvas.height);
        var data = image.data, original = new Uint8ClampedArray(image.data), width = canvas.width, height = canvas.height;
        var start = (y * width + x) * 4, tr = data[start], tg = data[start + 1], tb = data[start + 2], ta = data[start + 3];
        var color = this.brushColor, rgb = color.match(/[0-9a-f]{2}/ig).map(function (part) { return parseInt(part, 16); });
        if (ta > 245 && tr === rgb[0] && tg === rgb[1] && tb === rgb[2]) return;
        var count = width * height, visited = new Uint8Array(count), stack = new Int32Array(count), top = 0;
        var matches = function (index) {
            var i = index * 4, a = original[i + 3];
            if (ta < 16) return a < 16;
            return a >= 16 && Math.abs(original[i] - tr) <= 28 && Math.abs(original[i + 1] - tg) <= 28 && Math.abs(original[i + 2] - tb) <= 28 && Math.abs(a - ta) <= 56;
        };
        this.pushDrawingUndo();
        var seed = y * width + x; stack[top++] = seed; visited[seed] = 1;
        while (top) {
            var index = stack[--top], px = index % width, py = (index / width) | 0, offset = index * 4;
            if (!matches(index)) continue;
            data[offset] = rgb[0]; data[offset + 1] = rgb[1]; data[offset + 2] = rgb[2]; data[offset + 3] = 255;
            var neighbors = [px > 0 ? index - 1 : -1, px < width - 1 ? index + 1 : -1, py > 0 ? index - width : -1, py < height - 1 ? index + width : -1];
            for (var n = 0; n < neighbors.length; n++) {
                var neighbor = neighbors[n];
                if (neighbor >= 0 && !visited[neighbor] && matches(neighbor)) { visited[neighbor] = 1; stack[top++] = neighbor; }
            }
        }
        this.drawCtx.putImageData(image, 0, 0);
        this.drawingDirty = true; this.hasUserEdit = true; this.updateDrawingControls();
    };

    Game.prototype.loadFloatingImage = function (file) {
        var self = this;
        if (!file || !/^image\//i.test(file.type)) return;
        var url = URL.createObjectURL(file), image = new Image();
        image.onload = function () {
            URL.revokeObjectURL(url);
            var fit = Math.min(250 / image.naturalWidth, 250 / image.naturalHeight);
            self.floatingImage = { image: image, x: 180, y: 180, scale: fit };
            self.el.imageCanvas.hidden = false;
            self.el.placeImage.hidden = false; self.el.cancelImage.hidden = false;
            self.el.drawingTip.textContent = '拖曳移動圖片，雙指捏合或滑鼠滾輪縮放；調整好後按「放置完成」。';
            self.el.brushTool.disabled = true; self.el.bucketTool.disabled = true; self.el.imageUpload.disabled = true;
            self.drawFloatingImage(); self.resetImageGesture();
        };
        image.onerror = function () { URL.revokeObjectURL(url); self.toast('這張圖片無法載入，請選擇其他圖片。'); };
        image.src = url;
        this.el.imageUpload.value = '';
    };

    Game.prototype.drawFloatingImage = function () {
        var canvas = this.el.imageCanvas, ctx = this.imageCtx, item = this.floatingImage;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!item) return;
        var w = item.image.naturalWidth * item.scale, h = item.image.naturalHeight * item.scale;
        ctx.drawImage(item.image, item.x - w / 2, item.y - h / 2, w, h);
        ctx.save(); ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.strokeStyle = '#c2631c';
        ctx.strokeRect(item.x - w / 2, item.y - h / 2, w, h); ctx.restore();
    };

    Game.prototype.resetImageGesture = function () {
        if (!this.floatingImage) return;
        var points = Array.from(this.imagePointers.values()), item = this.floatingImage;
        if (points.length >= 2) {
            var dx = points[0].x - points[1].x, dy = points[0].y - points[1].y;
            this.imageGesture = { kind: 'pinch', x: item.x, y: item.y, scale: item.scale,
                distance: Math.sqrt(dx * dx + dy * dy), midX: (points[0].x + points[1].x) / 2, midY: (points[0].y + points[1].y) / 2,
                minScale: Math.min(250 / item.image.naturalWidth, 250 / item.image.naturalHeight) };
        } else if (points.length === 1) {
            this.imageGesture = { kind: 'drag', x: item.x, y: item.y, startX: points[0].x, startY: points[0].y };
        } else this.imageGesture = null;
    };

    Game.prototype.finishImagePlacement = function () {
        if (!this.floatingImage) return;
        this.pushDrawingUndo();
        var item = this.floatingImage, w = item.image.naturalWidth * item.scale, h = item.image.naturalHeight * item.scale;
        this.drawCtx.drawImage(item.image, item.x - w / 2, item.y - h / 2, w, h);
        this.floatingImage = null; this.imagePointers.clear(); this.imageGesture = null;
        this.imageCtx.clearRect(0, 0, this.el.imageCanvas.width, this.el.imageCanvas.height);
        this.el.imageCanvas.hidden = true; this.el.placeImage.hidden = true; this.el.cancelImage.hidden = true;
        this.el.brushTool.disabled = false; this.el.bucketTool.disabled = false; this.el.imageUpload.disabled = false;
        this.el.drawingTip.textContent = '每種水果已有底色，可直接塗畫或使用油漆桶填色。';
        this.drawingDirty = true; this.hasUserEdit = true; this.updateDrawingControls();
    };

    Game.prototype.cancelFloatingImage = function () {
        if (!this.floatingImage) return;
        this.floatingImage = null; this.imagePointers.clear(); this.imageGesture = null;
        this.imageCtx.clearRect(0, 0, this.el.imageCanvas.width, this.el.imageCanvas.height);
        this.el.imageCanvas.hidden = true; this.el.placeImage.hidden = true; this.el.cancelImage.hidden = true;
        this.el.brushTool.disabled = false; this.el.bucketTool.disabled = false; this.el.imageUpload.disabled = false;
        this.el.drawingTip.textContent = '每種水果已有底色，可直接塗畫或使用油漆桶填色。';
    };

    Game.prototype.showDrawingScreen = function () {
        this.showScreen('drawing');
        this.openDrawingLevel(0);
    };

    Game.prototype.openDrawingLevel = function (index) {
        var self = this, info = Config.levelAt(index + 1), canvas = this.el.fruitCanvas;
        this.drawingLevel = index; this.undoStack = []; this.drawingDirty = false;
        this.hasUserEdit = !!this.artwork[index + 1];
        this.paintFruitBase(index + 1);
        this.el.drawingTitle.textContent = '畫出' + info.name;
        this.el.drawingStep.textContent = 'FRUIT ' + String(index + 1).padStart(2, '0') + ' / ' + Config.MAX_LEVEL;
        this.el.drawingPrev.disabled = index === 0;
        var source = this.artwork[index + 1];
        if (source) {
            var image = new Image();
            image.onload = function () { if (self.drawingLevel === index && !self.drawingDirty) self.drawCtx.drawImage(image, 0, 0, canvas.width, canvas.height); };
            image.src = source;
        }
        this.el.drawingStatus.textContent = source ? '已經畫過了，可以繼續修改或直接前往下一種' : '完成這個水果的圖案後繼續';
        this.updateDrawingControls(); this.renderDrawingProgress();
    };

    Game.prototype.updateDrawingControls = function () {
        var ready = this.hasUserEdit;
        this.el.drawingNext.disabled = !ready;
        this.el.drawingNext.textContent = this.drawingLevel === Config.MAX_LEVEL - 1 ? '開始遊戲' : '下一種水果';
        this.el.drawingStatus.textContent = ready ? '圖案已完成，可以繼續' : '完成這個水果的圖案後繼續';
        this.renderDrawingProgress();
    };

    Game.prototype.storeDrawing = function () {
        if (this.floatingImage) this.finishImagePlacement();
        var level = this.drawingLevel + 1;
        if (!this.drawingDirty) return;
        if (this.hasUserEdit) this.artwork[level] = this.el.fruitCanvas.toDataURL('image/png');
        else delete this.artwork[level];
        this.drawingDirty = false; this.saveArtwork(); this.renderDrawingProgress();
    };

    Game.prototype.renderDrawingProgress = function () {
        if (!this.el.drawingProgress) return;
        var self = this, list = this.el.drawingProgress; list.textContent = '';
        Config.LEVELS.forEach(function (info) {
            var button = document.createElement('button');
            button.type = 'button'; button.title = info.name; button.setAttribute('aria-label', info.name + (self.artwork[info.level] ? '：已完成' : '：未完成'));
            var done = info.level === self.drawingLevel + 1 ? self.hasUserEdit : !!self.artwork[info.level];
            if (done) button.classList.add('is-done');
            if (self.drawingLevel === info.level - 1) button.classList.add('is-current');
            button.addEventListener('click', function () {
                var complete = info.level === self.drawingLevel + 1 ? self.hasUserEdit : !!self.artwork[info.level];
                if (!complete && info.level - 1 > self.drawingLevel) return;
                self.storeDrawing(); self.openDrawingLevel(info.level - 1);
            });
            list.appendChild(button);
        });
    };

    Game.prototype.beginCustomGame = function () {
        var self = this, levels = Config.LEVELS, remaining = 0;
        this.showScreen('game'); this.images.clearCustom();
        levels.forEach(function (info) { if (self.artwork[info.level]) remaining++; });
        if (!remaining) { this.restart(); return; }
        levels.forEach(function (info) {
            if (!self.artwork[info.level]) return;
            self.images.setCustom(info.level, self.artwork[info.level], function () {
                remaining--;
                if (!remaining) self.restart();
            });
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

    Game.prototype.importErrorText = function (reason) {
        var map = {
            empty: '沒有輸入內容',
            decode: '字串格式不正確',
            json: '資料不是有效的 JSON',
            shape: '資料結構不正確',
            best: '最高分的數值不合理',
            'version-too-new': '這個紀錄來自更新版本的遊戲'
        };
        return map[reason] || ('資料有問題（' + reason + '）');
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
