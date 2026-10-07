/*!
 * 果實合成 - 圖片載入
 *
 * 圖片與碰撞範圍是分開的：這裡只負責載入與降級，
 * 載入失敗的等級會回傳 null，繪圖層改畫色球與等級數字，遊戲照常進行。
 * 載入器可注入，測試時能模擬失敗。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var api = factory(isNode ? require('./config.js') : root.SuikaConfig);
    if (isNode) module.exports = api;
    else root.SuikaImages = api;
})(typeof self !== 'undefined' ? self : this, function (Config) {
    'use strict';

    /**
     * @param {Object} options
     *  - config: 設定表
     *  - createImage: () => { src, onload, onerror }，預設使用瀏覽器的 Image
     */
    function ImageStore(options) {
        options = options || {};
        this.config = options.config || Config;
        this.createImage = options.createImage || function () { return new Image(); };
        this.images = {};     // level -> 圖片物件
        this.failures = {};   // level -> true
        this.loaded = false;
    }

    /** 載入全部等級的圖片。無論成功失敗都會呼叫 done(summary)。 */
    ImageStore.prototype.loadAll = function (done) {
        var self = this;
        var levels = this.config.LEVELS;
        var pending = levels.length;

        if (!pending) {
            this.loaded = true;
            if (done) done(this.summary());
            return;
        }

        levels.forEach(function (info) {
            var image = self.createImage();
            image.onload = function () {
                self.images[info.level] = image;
                finish();
            };
            image.onerror = function () {
                // 降級：記錄失敗，繪圖層會改用色球 + 等級數字
                self.failures[info.level] = true;
                self.images[info.level] = null;
                finish();
            };
            image.src = info.image;
        });

        function finish() {
            pending--;
            if (pending > 0) return;
            self.loaded = true;
            if (done) done(self.summary());
        }
    };

    /** 取得可直接繪製的圖片；回傳 null 代表該等級要走降級繪製。 */
    ImageStore.prototype.get = function (level) {
        var image = this.images[level];
        if (!image) return null;
        // 瀏覽器中如果圖片沒有實際尺寸，也視為不可用
        if (typeof image.naturalWidth === 'number' && image.naturalWidth === 0) return null;
        return image;
    };

    ImageStore.prototype.isFallback = function (level) { return this.get(level) === null; };

    ImageStore.prototype.summary = function () {
        var failed = Object.keys(this.failures).map(Number).sort(function (a, b) { return a - b; });
        return {
            total: this.config.LEVELS.length,
            failed: failed,
            ok: this.config.LEVELS.length - failed.length,
            allFailed: failed.length === this.config.LEVELS.length
        };
    };

    return { ImageStore: ImageStore };
});
