/*!
 * 輸入處理：鍵盤、觸控滑動、方向按鈕
 * 只負責辨識「玩家想往哪個方向移動」，實際排隊與節流交給上層。
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.Game2048Input = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var KEY_MAP = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', a: 'left', s: 'down', d: 'right',
        W: 'up', A: 'left', S: 'down', D: 'right',
        k: 'up', h: 'left', j: 'down', l: 'right'
    };

    var FORM_TAGS = ['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'];

    var MIN_SWIPE = 24;      // 最小滑動距離（px）
    var AXIS_RATIO = 1.25;   // 主要軸需明顯大於次要軸才算有效方向

    /**
     * @param {Object} options
     *  - boardEl: 棋盤元素（手勢範圍）
     *  - onDirection(dir, source): 方向回呼
     *  - isBlocked(): 回傳 true 時忽略輸入（例如對話框開啟中）
     */
    function InputController(options) {
        this.boardEl = options.boardEl;
        this.onDirection = options.onDirection;
        this.isBlocked = options.isBlocked || function () { return false; };
        this.pointerId = null;
        this.startX = 0;
        this.startY = 0;
        this.gestureCancelled = false;
        this._bind();
    }

    InputController.prototype._emit = function (dir, source) {
        if (this.isBlocked()) return;
        this.onDirection(dir, source);
    };

    InputController.prototype._bind = function () {
        var self = this;

        this._onKeyDown = function (event) {
            if (event.defaultPrevented) return;
            if (event.ctrlKey || event.metaKey || event.altKey) return;

            var target = event.target;
            var isFormField = target && (
                FORM_TAGS.indexOf(target.tagName) !== -1 ||
                target.isContentEditable
            );
            // 在輸入欄位或對話框中操作時，不應觸發棋盤移動
            if (isFormField) return;
            if (self.isBlocked()) return;

            var dir = KEY_MAP[event.key];
            if (!dir) return;
            // WASD 若焦點在按鈕上仍視為遊戲操作；方向鍵則一併阻止頁面捲動
            event.preventDefault();
            self._emit(dir, 'keyboard');
        };

        document.addEventListener('keydown', this._onKeyDown);

        if (!this.boardEl) return;

        this._onPointerDown = function (event) {
            if (self.pointerId !== null) {
                // 已有進行中的手勢（多指觸控）：直接取消，避免誤判方向
                self.gestureCancelled = true;
                return;
            }
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            self.pointerId = event.pointerId;
            self.gestureCancelled = false;
            self.startX = event.clientX;
            self.startY = event.clientY;
        };

        this._onPointerUp = function (event) {
            if (event.pointerId !== self.pointerId) return;
            var cancelled = self.gestureCancelled;
            self.pointerId = null;
            self.gestureCancelled = false;
            if (cancelled) return;

            var dx = event.clientX - self.startX;
            var dy = event.clientY - self.startY;
            var absX = Math.abs(dx);
            var absY = Math.abs(dy);

            if (Math.max(absX, absY) < MIN_SWIPE) return;            // 距離不足視為點擊
            if (absX >= absY && absX < absY * AXIS_RATIO) return;     // 方向不明確
            if (absY > absX && absY < absX * AXIS_RATIO) return;

            var dir = absX > absY ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            self._emit(dir, 'touch');
        };

        this._onPointerCancel = function (event) {
            if (event.pointerId !== self.pointerId) return;
            self.pointerId = null;
            self.gestureCancelled = false;
        };

        this.boardEl.addEventListener('pointerdown', this._onPointerDown);
        this.boardEl.addEventListener('pointerup', this._onPointerUp);
        this.boardEl.addEventListener('pointercancel', this._onPointerCancel);
        this.boardEl.addEventListener('pointerleave', this._onPointerCancel);
        // 棋盤本身用 CSS touch-action: none 阻擋捲動，這裡再擋掉 iOS 的彈性捲動
        this.boardEl.addEventListener('touchmove', function (event) {
            if (self.pointerId !== null && event.cancelable) event.preventDefault();
        }, { passive: false });
    };

    /** 綁定畫面上的方向按鈕。 */
    InputController.prototype.bindButtons = function (buttons) {
        var self = this;
        buttons.forEach(function (button) {
            button.addEventListener('click', function () {
                self._emit(button.dataset.dir, 'button');
            });
        });
    };

    InputController.prototype.destroy = function () {
        document.removeEventListener('keydown', this._onKeyDown);
    };

    return {
        InputController: InputController,
        KEY_MAP: KEY_MAP,
        MIN_SWIPE: MIN_SWIPE,
        AXIS_RATIO: AXIS_RATIO
    };
});
