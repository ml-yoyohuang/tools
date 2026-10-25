/*!
 * 圖片載入與降級
 * 圖片與遊戲邏輯完全分離：載入失敗時回傳 null，畫面改用色塊與名稱縮寫，遊戲照常運作。
 * 載入器可注入，方便測試模擬失敗。
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.MushImages = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * @param {Object} options
     *  - sources: [{ key, src }]
     *  - createImage: () => { src, onload, onerror }
     */
    function ImageStore(options) {
        options = options || {};
        this.sources = options.sources || [];
        this.createImage = options.createImage || function () { return new Image(); };
        this.images = {};
        this.failures = {};
        this.loaded = false;
    }

    ImageStore.prototype.loadAll = function (done) {
        var self = this;
        var pending = this.sources.length;
        if (!pending) {
            this.loaded = true;
            if (done) done(this.summary());
            return;
        }

        this.sources.forEach(function (entry) {
            var image = self.createImage();
            image.onload = function () { self.images[entry.key] = image; finish(); };
            image.onerror = function () {
                self.failures[entry.key] = true;
                self.images[entry.key] = null;
                finish();
            };
            image.src = entry.src;
        });

        function finish() {
            pending--;
            if (pending > 0) return;
            self.loaded = true;
            if (done) done(self.summary());
        }
    };

    /** 取得可用的圖片；回傳 null 代表要走降級顯示。 */
    ImageStore.prototype.get = function (key) {
        var image = this.images[key];
        if (!image) return null;
        if (typeof image.naturalWidth === 'number' && image.naturalWidth === 0) return null;
        return image;
    };

    ImageStore.prototype.isFallback = function (key) { return this.get(key) === null; };

    ImageStore.prototype.summary = function () {
        var failed = Object.keys(this.failures);
        return {
            total: this.sources.length,
            failed: failed,
            ok: this.sources.length - failed.length,
            allFailed: failed.length === this.sources.length && this.sources.length > 0
        };
    };

    return { ImageStore: ImageStore };
});
