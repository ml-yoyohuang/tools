/*!
 * 果實合成 - Canvas 繪圖
 *
 * 一律以邏輯座標（config.WORLD）繪製，縮放只發生在 Canvas 變換矩陣上，
 * 不會影響物理世界尺寸。合併動畫與粒子都只是畫面效果，不參與碰撞。
 */
(function (root, factory) {
    'use strict';
    var api = factory(root.SuikaConfig);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SuikaRender = api;
})(typeof self !== 'undefined' ? self : this, function (Config) {
    'use strict';

    var TAU = Math.PI * 2;

    function Renderer(options) {
        this.canvas = options.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.config = options.config || Config;
        this.images = options.images;
        this.reduceMotion = !!options.reduceMotion;

        this.scale = 1;
        this.dpr = 1;
        this.particles = [];
        this.popups = [];
        this.pops = new Map();     // fruitId -> 剩餘時間，合併後的縮放回饋

        this.resize();
    }

    Renderer.prototype.setReduceMotion = function (value) {
        this.reduceMotion = !!value;
        if (value) {
            this.particles.length = 0;
            this.popups.length = 0;
        }
    };

    /** 依 CSS 尺寸與裝置像素比重建繪圖緩衝區。 */
    Renderer.prototype.resize = function () {
        var W = this.config.WORLD;
        var rect = this.canvas.getBoundingClientRect();
        var cssWidth = rect.width || this.canvas.clientWidth || W.width;
        var cssHeight = rect.height || this.canvas.clientHeight || W.height;
        if (!cssWidth || !cssHeight) return;

        this.dpr = Math.min(window.devicePixelRatio || 1, 3);
        var width = Math.round(cssWidth * this.dpr);
        var height = Math.round(cssHeight * this.dpr);
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;

        // 等比縮放並置中，畫面比例改變時不會拉扁水果
        this.scale = Math.min(cssWidth / W.width, cssHeight / W.height);
        this.offsetX = (cssWidth - W.width * this.scale) / 2;
        this.offsetY = (cssHeight - W.height * this.scale) / 2;
        this.cssWidth = cssWidth;
        this.cssHeight = cssHeight;
    };

    /** 把畫面座標換算成邏輯世界座標。 */
    Renderer.prototype.toWorldX = function (clientX) {
        var rect = this.canvas.getBoundingClientRect();
        return (clientX - rect.left - this.offsetX) / this.scale;
    };

    Renderer.prototype.toWorldY = function (clientY) {
        var rect = this.canvas.getBoundingClientRect();
        return (clientY - rect.top - this.offsetY) / this.scale;
    };

    /* ---------- 特效 ---------- */

    Renderer.prototype.addMergeEffect = function (x, y, level) {
        var info = this.config.levelAt(level);
        if (this.reduceMotion) return;

        var count = Math.min(16, 6 + level);
        for (var i = 0; i < count; i++) {
            var angle = (i / count) * TAU + Math.random() * 0.4;
            var speed = 1.4 + Math.random() * 2.6 + level * 0.12;
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                life: 420 + Math.random() * 260,
                maxLife: 680,
                size: 2 + Math.random() * 3 + level * 0.18,
                color: info ? info.accent : '#ffffff'
            });
        }
    };

    Renderer.prototype.addPopup = function (x, y, text) {
        if (this.reduceMotion) return;
        this.popups.push({ x: x, y: y, text: text, life: 760, maxLife: 760 });
    };

    Renderer.prototype.markPop = function (fruitId) {
        this.pops.set(fruitId, this.config.TIMING.mergePopMs);
    };

    Renderer.prototype.clearEffects = function () {
        this.particles.length = 0;
        this.popups.length = 0;
        this.pops.clear();
    };

    Renderer.prototype.updateEffects = function (dt) {
        var i;
        for (i = this.particles.length - 1; i >= 0; i--) {
            var p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            p.vy += 0.16;
            p.x += p.vx;
            p.y += p.vy;
        }
        for (i = this.popups.length - 1; i >= 0; i--) {
            var popup = this.popups[i];
            popup.life -= dt;
            popup.y -= dt * 0.03;
            if (popup.life <= 0) this.popups.splice(i, 1);
        }
        this.pops.forEach(function (value, key, map) {
            var next = value - dt;
            if (next <= 0) map.delete(key);
            else map.set(key, next);
        });
    };

    /* ---------- 繪製 ---------- */

    Renderer.prototype.draw = function (world, view) {
        var W = this.config.WORLD;
        var ctx = this.ctx;
        view = view || {};

        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);

        this._drawContainer(ctx, world);
        this._drawWarningLine(ctx, world);
        if (world.state !== 'over') this._drawAim(ctx, world, view);
        this._drawFruits(ctx, world);
        this._drawParticles(ctx);
        this._drawPopups(ctx);

        ctx.restore();
    };

    Renderer.prototype._drawContainer = function (ctx, world) {
        var W = this.config.WORLD;
        var styles = getComputedStyle(this.canvas);
        var inner = styles.getPropertyValue('--c-jar').trim() || '#f6ecdc';
        var wall = styles.getPropertyValue('--c-jar-wall').trim() || '#c9a87c';

        ctx.fillStyle = inner;
        ctx.beginPath();
        ctx.moveTo(W.innerLeft, 0);
        ctx.lineTo(W.innerLeft, W.floorY - 18);
        ctx.quadraticCurveTo(W.innerLeft, W.floorY, W.innerLeft + 18, W.floorY);
        ctx.lineTo(W.innerRight - 18, W.floorY);
        ctx.quadraticCurveTo(W.innerRight, W.floorY, W.innerRight, W.floorY - 18);
        ctx.lineTo(W.innerRight, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = wall;
        ctx.lineWidth = W.wall;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(W.innerLeft - W.wall / 2, 0);
        ctx.lineTo(W.innerLeft - W.wall / 2, W.floorY + W.wall / 2);
        ctx.lineTo(W.innerRight + W.wall / 2, W.floorY + W.wall / 2);
        ctx.lineTo(W.innerRight + W.wall / 2, 0);
        ctx.stroke();
    };

    Renderer.prototype._drawWarningLine = function (ctx, world) {
        var W = this.config.WORLD;
        var ratio = world.dangerRatio || 0;
        ctx.save();
        ctx.setLineDash([14, 10]);
        ctx.lineWidth = ratio > 0 ? 3.5 : 2.5;
        ctx.strokeStyle = ratio > 0
            ? 'rgba(211, 47, 47, ' + (0.55 + ratio * 0.45).toFixed(3) + ')'
            : 'rgba(176, 124, 60, .55)';
        ctx.beginPath();
        ctx.moveTo(W.innerLeft, W.warningLineY);
        ctx.lineTo(W.innerRight, W.warningLineY);
        ctx.stroke();
        ctx.restore();

        if (ratio > 0) {
            ctx.save();
            ctx.globalAlpha = 0.1 + ratio * 0.25;
            ctx.fillStyle = '#d32f2f';
            ctx.fillRect(W.innerLeft, 0, W.innerRight - W.innerLeft, W.warningLineY);
            ctx.restore();
        }
    };

    Renderer.prototype._drawAim = function (ctx, world, view) {
        var W = this.config.WORLD;
        var info = this.config.levelAt(world.currentLevel);
        if (!info) return;

        // 落點參考線
        ctx.save();
        ctx.setLineDash([6, 9]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(90, 70, 50, .38)';
        ctx.beginPath();
        ctx.moveTo(world.aimX, W.spawnY + info.radius);
        ctx.lineTo(world.aimX, W.floorY);
        ctx.stroke();
        ctx.restore();

        var alpha = world.state === 'running' ? 1 : 0.45;
        if (view.cooldown > 0) alpha *= 0.5;
        ctx.save();
        ctx.globalAlpha = alpha;
        this._drawFruitShape(ctx, world.aimX, W.spawnY, info.radius, info.level, 0, 1);
        ctx.restore();
    };

    Renderer.prototype._drawFruits = function (ctx, world) {
        var list = world.fruitList || [];
        for (var i = 0; i < list.length; i++) {
            var fruit = list[i];
            var pop = this.pops.get(fruit.id) || 0;
            var scale = 1;
            if (pop > 0 && !this.reduceMotion) {
                var t = pop / this.config.TIMING.mergePopMs;   // 1 → 0
                scale = 1 + Math.sin(t * Math.PI) * 0.16;
            }
            this._drawFruitShape(ctx, fruit.x, fruit.y, fruit.radius, fruit.level, fruit.angle, scale);
        }
    };

    /** 畫一顆水果：有圖就用圖（跟隨旋轉），沒有就降級成色球加等級數字。 */
    Renderer.prototype._drawFruitShape = function (ctx, x, y, radius, level, angle, scale) {
        var info = this.config.levelAt(level);
        if (!info) return;
        var image = this.images ? this.images.get(level) : null;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle || 0);
        if (scale !== 1) ctx.scale(scale, scale);

        if (image) {
            var size = radius * 2 * (info.imageScale || 1);
            var ratio = (image.naturalWidth && image.naturalHeight)
                ? image.naturalWidth / image.naturalHeight
                : 1;
            var drawWidth = size;
            var drawHeight = size;
            if (ratio > 1) drawHeight = size / ratio;       // 保持長寬比
            else if (ratio < 1) drawWidth = size * ratio;
            var offset = info.imageOffset || { x: 0, y: 0 };
            ctx.drawImage(image, -drawWidth / 2 + offset.x, -drawHeight / 2 + offset.y, drawWidth, drawHeight);
        } else {
            // 降級繪製
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, TAU);
            ctx.fillStyle = info.color;
            ctx.fill();
            ctx.lineWidth = Math.max(1.5, radius * 0.08);
            ctx.strokeStyle = 'rgba(0, 0, 0, .28)';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(-radius * 0.3, -radius * 0.34, radius * 0.26, 0, TAU);
            ctx.fillStyle = 'rgba(255, 255, 255, .3)';
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = '700 ' + Math.max(10, radius * 0.8) + 'px "Segoe UI", system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = 'rgba(0, 0, 0, .45)';
            ctx.lineWidth = Math.max(2, radius * 0.1);
            ctx.strokeText(String(level), 0, 0);
            ctx.fillText(String(level), 0, 0);
        }
        ctx.restore();
    };

    Renderer.prototype._drawParticles = function (ctx) {
        for (var i = 0; i < this.particles.length; i++) {
            var p = this.particles[i];
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    };

    Renderer.prototype._drawPopups = function (ctx) {
        for (var i = 0; i < this.popups.length; i++) {
            var popup = this.popups[i];
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, popup.life / popup.maxLife));
            ctx.font = '800 26px "Segoe UI", "PingFang TC", system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'rgba(255, 255, 255, .85)';
            ctx.strokeText(popup.text, popup.x, popup.y);
            ctx.fillStyle = '#b3541e';
            ctx.fillText(popup.text, popup.x, popup.y);
            ctx.restore();
        }
    };

    return { Renderer: Renderer };
});
