/*!
 * 外觀與動畫偏好
 * theme: system | light | dark
 * motion: system | full | reduced（system 代表尊重 prefers-reduced-motion）
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.Game2048Settings = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function media(query) {
        if (typeof window === 'undefined' || !window.matchMedia) return null;
        return window.matchMedia(query);
    }

    function SettingsController(options) {
        options = options || {};
        this.root = options.rootEl || document.documentElement;
        this.onChange = options.onChange || function () {};
        this.darkQuery = media('(prefers-color-scheme: dark)');
        this.motionQuery = media('(prefers-reduced-motion: reduce)');
        this.values = { theme: 'system', motion: 'system' };
        this._listen();
    }

    SettingsController.prototype._listen = function () {
        var self = this;
        var handler = function () { self.apply(self.values); };
        [this.darkQuery, this.motionQuery].forEach(function (query) {
            if (!query) return;
            if (query.addEventListener) query.addEventListener('change', handler);
            else if (query.addListener) query.addListener(handler);
        });
    };

    SettingsController.prototype.resolvedTheme = function () {
        if (this.values.theme !== 'system') return this.values.theme;
        return this.darkQuery && this.darkQuery.matches ? 'dark' : 'light';
    };

    SettingsController.prototype.prefersReducedMotion = function () {
        if (this.values.motion === 'reduced') return true;
        if (this.values.motion === 'full') return false;
        return !!(this.motionQuery && this.motionQuery.matches);
    };

    /** 套用設定到 <html>，並回報解析後的結果。 */
    SettingsController.prototype.apply = function (values) {
        this.values = {
            theme: values && values.theme ? values.theme : 'system',
            motion: values && values.motion ? values.motion : 'system'
        };
        var theme = this.resolvedTheme();
        var reduced = this.prefersReducedMotion();
        this.root.setAttribute('data-theme', theme);
        this.root.classList.toggle('reduce-motion', reduced);
        this.onChange({ theme: theme, reduceMotion: reduced, values: this.values });
        return { theme: theme, reduceMotion: reduced };
    };

    return { SettingsController: SettingsController };
});
