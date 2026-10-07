/*!
 * 果實合成 - 輸入
 *
 * 一律使用 Pointer Events，不混用 touch/click，避免手機上一次操作投放兩顆。
 * 這一層只負責「玩家想把水果放在哪裡／現在要投放」，是否允許由上層判斷。
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SuikaInput = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var FORM_TAGS = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'];
    var KEY_STEP = 14;         // 鍵盤單次移動距離（邏輯單位）
    var KEY_STEP_FAST = 42;    // 按住 Shift 的加速距離

    /**
     * @param {Object} options
     *  - canvas: 畫布元素
     *  - toWorldX(clientX): 座標換算
     *  - onAim(worldX): 指定絕對落點
     *  - onAimDelta(delta): 相對移動落點（鍵盤）
     *  - onDrop(), onPause()
     *  - isBlocked(): true 時忽略投放與瞄準
     *  - isPauseBlocked(): true 時連暫停鍵也忽略（對話框開啟或遊戲結束）
     */
    function InputController(options) {
        this.canvas = options.canvas;
        this.toWorldX = options.toWorldX;
        this.onAim = options.onAim || function () {};
        this.onAimDelta = options.onAimDelta || function () {};
        this.onDrop = options.onDrop || function () {};
        this.onPause = options.onPause || function () {};
        this.isBlocked = options.isBlocked || function () { return false; };
        this.isPauseBlocked = options.isPauseBlocked || function () { return false; };

        this.activePointerId = null;
        this.cancelled = false;
        this.moved = false;
        this._bind();
    }

    InputController.prototype._bind = function () {
        var self = this;
        var canvas = this.canvas;

        this._onPointerDown = function (event) {
            if (self.isBlocked()) return;
            if (self.activePointerId !== null) {
                // 已經有一根手指在操作：第二根手指不另外投放，也不打斷原本的手勢
                return;
            }
            if (event.pointerType === 'mouse' && event.button !== 0) return;

            self.activePointerId = event.pointerId;
            self.cancelled = false;
            self.moved = false;
            if (canvas.setPointerCapture) {
                try { canvas.setPointerCapture(event.pointerId); } catch (err) { /* 忽略 */ }
            }
            self.onAim(self.toWorldX(event.clientX));
        };

        this._onPointerMove = function (event) {
            if (self.isBlocked()) return;
            if (self.activePointerId === null) {
                // 桌機沒有按住時也能用滑鼠移動落點
                if (event.pointerType === 'mouse') self.onAim(self.toWorldX(event.clientX));
                return;
            }
            if (event.pointerId !== self.activePointerId) return;
            self.moved = true;
            self.onAim(self.toWorldX(event.clientX));
        };

        this._onPointerUp = function (event) {
            if (event.pointerId !== self.activePointerId) return;
            var cancelled = self.cancelled;
            self.activePointerId = null;
            self.cancelled = false;
            if (canvas.releasePointerCapture) {
                try { canvas.releasePointerCapture(event.pointerId); } catch (err) { /* 忽略 */ }
            }
            if (cancelled) return;          // 取消手勢不投放
            if (self.isBlocked()) return;
            self.onAim(self.toWorldX(event.clientX));
            self.onDrop();
        };

        this._onPointerCancel = function (event) {
            if (event.pointerId !== self.activePointerId) return;
            self.activePointerId = null;
            self.cancelled = false;
        };

        canvas.addEventListener('pointerdown', this._onPointerDown);
        canvas.addEventListener('pointermove', this._onPointerMove);
        canvas.addEventListener('pointerup', this._onPointerUp);
        canvas.addEventListener('pointercancel', this._onPointerCancel);
        canvas.addEventListener('pointerleave', function (event) {
            // 滑鼠移出畫布時不投放，但保留目前落點
            if (event.pointerType === 'mouse' && self.activePointerId === event.pointerId) {
                self.cancelled = true;
            }
        });
        // 畫布本身用 CSS touch-action: none 擋捲動，這裡再擋掉 iOS 的彈性捲動
        canvas.addEventListener('touchmove', function (event) {
            if (self.activePointerId !== null && event.cancelable) event.preventDefault();
        }, { passive: false });

        this._onKeyDown = function (event) {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            var target = event.target;
            // 操作按鈕或輸入元件時不應同時投放水果
            if (target && (FORM_TAGS.indexOf(target.tagName) !== -1 || target.isContentEditable)) {
                if (event.key === ' ' || event.key === 'Enter') return;
            }
            if (event.key === 'p' || event.key === 'P') {
                // 暫停鍵在暫停中也必須有效，否則就回不去了
                if (self.isPauseBlocked()) return;
                event.preventDefault();
                self.onPause();
                return;
            }
            if (self.isBlocked()) return;

            var step = event.shiftKey ? KEY_STEP_FAST : KEY_STEP;
            switch (event.key) {
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    event.preventDefault();
                    self.onAimDelta(-step);
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    event.preventDefault();
                    self.onAimDelta(step);
                    break;
                case ' ':
                case 'Spacebar':
                case 'Enter':
                case 'ArrowDown':
                    if (target && FORM_TAGS.indexOf(target.tagName) !== -1) return;
                    event.preventDefault();
                    self.onDrop();
                    break;
                default:
                    break;
            }
        };

        document.addEventListener('keydown', this._onKeyDown);
    };

    InputController.prototype.destroy = function () {
        document.removeEventListener('keydown', this._onKeyDown);
    };

    return { InputController: InputController, KEY_STEP: KEY_STEP, KEY_STEP_FAST: KEY_STEP_FAST };
});
