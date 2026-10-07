/*!
 * 數字格式化
 * 縮寫採中文數量級（萬／億／兆／京），超過範圍改用科學記號。
 * 所有函式都會擋掉 NaN / Infinity，不讓壞數字流到畫面上。
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BakeryFormat = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var UNITS = [
        { value: 1e20, suffix: '垓' },
        { value: 1e16, suffix: '京' },
        { value: 1e12, suffix: '兆' },
        { value: 1e8, suffix: '億' },
        { value: 1e4, suffix: '萬' }
    ];

    var MAX_SAFE = 1e300;

    /** 把任何輸入夾成可用的有限數字。 */
    function sanitize(value, fallback) {
        var fb = fallback === undefined ? 0 : fallback;
        if (typeof value !== 'number' || isNaN(value)) return fb;
        // Infinity 夾到上限而不是變成 0，避免畫面上出現莫名其妙的 0
        if (value > MAX_SAFE) return MAX_SAFE;
        if (value < -MAX_SAFE) return -MAX_SAFE;
        return value;
    }

    function trimZero(text) {
        if (text.indexOf('.') === -1) return text;
        return text.replace(/\.?0+$/, '');
    }

    /** 縮寫顯示，例如 12345 → 1.23萬 */
    function short(value, digits) {
        var n = sanitize(value);
        var sign = n < 0 ? '-' : '';
        n = Math.abs(n);
        var decimals = digits === undefined ? 2 : digits;

        if (n < 1000) {
            if (n === 0) return '0';
            if (n < 10) return sign + trimZero(n.toFixed(Math.min(2, decimals + 1)));
            if (n < 100) return sign + trimZero(n.toFixed(Math.min(1, decimals)));
            return sign + String(Math.floor(n));
        }
        if (n < 1e4) return sign + trimZero(n.toFixed(0));

        // 超過最大單位還要四位數以上就改用科學記號，不會出現「1e280垓」這種寫法
        for (var i = 0; i < UNITS.length; i++) {
            if (n < UNITS[i].value) continue;
            var scaled = n / UNITS[i].value;
            if (scaled >= 1e4) break;
            return sign + trimZero(scaled.toFixed(decimals)) + UNITS[i].suffix;
        }
        return sign + n.toExponential(2).replace('e+', 'e');
    }

    /** 完整數值，加上千分位；超過安全整數範圍改用科學記號。 */
    function full(value) {
        var n = sanitize(value);
        if (Math.abs(n) >= 1e21) return n.toExponential(6).replace('e+', 'e');
        var rounded = Math.abs(n) < 1e15 ? Math.round(n * 100) / 100 : Math.round(n);
        var parts = String(rounded).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    }

    /** 每秒產量：小數點位數依大小自動調整。 */
    function rate(value) {
        var n = sanitize(value);
        if (n > 0 && n < 1) return trimZero(n.toFixed(2));
        if (n < 1000) return trimZero(n.toFixed(1));
        return short(n);
    }

    function percent(value, digits) {
        var n = sanitize(value);
        return trimZero((n * 100).toFixed(digits === undefined ? 1 : digits)) + '%';
    }

    /** 秒數轉中文時間敘述。 */
    function duration(seconds) {
        var s = sanitize(seconds);
        if (s < 0) s = 0;
        if (!isFinite(s) || s > 3.15e10) return '非常久';
        if (s < 1) return '不到 1 秒';
        if (s < 60) return Math.round(s) + ' 秒';

        var minutes = Math.floor(s / 60);
        var rest = Math.round(s % 60);
        if (minutes < 60) return minutes + ' 分' + (rest ? ' ' + rest + ' 秒' : '');

        var hours = Math.floor(minutes / 60);
        var restMin = minutes % 60;
        if (hours < 24) return hours + ' 小時' + (restMin ? ' ' + restMin + ' 分' : '');

        var days = Math.floor(hours / 24);
        var restHour = hours % 24;
        if (days < 365) return days + ' 天' + (restHour ? ' ' + restHour + ' 小時' : '');
        return Math.floor(days / 365) + ' 年以上';
    }

    /** 倒數計時：mm:ss */
    function clock(seconds) {
        var s = Math.max(0, Math.ceil(sanitize(seconds)));
        var m = Math.floor(s / 60);
        var rest = s % 60;
        return m + ':' + (rest < 10 ? '0' : '') + rest;
    }

    return {
        sanitize: sanitize,
        short: short,
        full: full,
        rate: rate,
        percent: percent,
        duration: duration,
        clock: clock,
        MAX_SAFE: MAX_SAFE
    };
});
