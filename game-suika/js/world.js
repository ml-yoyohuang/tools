/*!
 * 果實合成 - 遊戲世界（物理 + 合併規則 + 危險判定）
 *
 * 這一層不依賴 DOM、Canvas 或任何瀏覽器 API，可以在 Node 中直接驅動真實物理做測試。
 * 亂數來源可注入，方便重現問題。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var deps = isNode
        ? { Matter: require('../vendor/matter-js/matter.min.js'), Config: require('./config.js') }
        : { Matter: root.Matter, Config: root.SuikaConfig };
    var api = factory(deps);
    if (isNode) module.exports = api;
    else root.SuikaWorld = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    var Matter = deps.Matter;
    var Engine = Matter.Engine;
    var Composite = Matter.Composite;
    var Bodies = Matter.Bodies;
    var Body = Matter.Body;
    var Events = Matter.Events;

    var WALL_LABEL = 'wall';
    var FRUIT_LABEL = 'fruit';

    function clamp(value, min, max) {
        if (max < min) return (min + max) / 2;
        return value < min ? min : (value > max ? max : value);
    }

    /* ---------- 迷你事件發送器 ---------- */

    function Emitter() { this._handlers = {}; }

    Emitter.prototype.on = function (name, handler) {
        (this._handlers[name] = this._handlers[name] || []).push(handler);
        return this;
    };

    Emitter.prototype.emit = function (name, payload) {
        var list = this._handlers[name];
        if (!list) return;
        for (var i = 0; i < list.length; i++) list[i](payload);
    };

    /* ---------- 世界 ---------- */

    /**
     * @param {Object} options
     *  - config: 設定表（預設使用 SuikaConfig）
     *  - rng: 亂數來源，回傳 [0, 1)
     */
    function World(options) {
        options = options || {};
        this.config = options.config || deps.Config;
        this.rng = options.rng || Math.random;

        this.emitter = new Emitter();
        this.engine = Engine.create({
            gravity: { x: 0, y: this.config.PHYSICS.gravityY },
            positionIterations: this.config.PHYSICS.positionIterations,
            velocityIterations: this.config.PHYSICS.velocityIterations,
            constraintIterations: this.config.PHYSICS.constraintIterations,
            enableSleeping: false
        });

        this.bodies = new Map();      // fruitId -> Matter body
        this.mergeQueue = [];
        this.walls = [];

        this._buildWalls();
        this._bindCollisions();       // 只註冊一次，重新開始不會重複綁定
        this.reset();
    }

    World.prototype.on = function (name, handler) { this.emitter.on(name, handler); return this; };

    World.prototype._buildWalls = function () {
        var W = this.config.WORLD;
        var thickness = W.wall;
        var options = {
            isStatic: true,
            label: WALL_LABEL,
            friction: this.config.PHYSICS.friction,
            restitution: 0.02,
            slop: this.config.PHYSICS.slop
        };
        var tall = W.height * 2;
        this.walls = [
            // 牆做得比容器高很多，水果從上方落下時不會從側邊溜出去
            Bodies.rectangle(W.innerLeft - thickness / 2, W.height - tall / 2, thickness, tall, options),
            Bodies.rectangle(W.innerRight + thickness / 2, W.height - tall / 2, thickness, tall, options),
            Bodies.rectangle(W.width / 2, W.floorY + thickness / 2, W.width, thickness, options)
        ];
        Composite.add(this.engine.world, this.walls);
    };

    World.prototype._bindCollisions = function () {
        var self = this;
        Events.on(this.engine, 'collisionStart', function (event) {
            var pairs = event.pairs;
            for (var i = 0; i < pairs.length; i++) {
                self._onPair(pairs[i].bodyA, pairs[i].bodyB);
            }
        });
    };

    World.prototype._onPair = function (bodyA, bodyB) {
        var a = bodyA.plugin && bodyA.plugin.fruit;
        var b = bodyB.plugin && bodyB.plugin.fruit;

        // 碰到任何東西就結束入場寬限，避免新水果靠寬限賴在警戒線上方
        if (a) a.graceUntil = 0;
        if (b) b.graceUntil = 0;

        if (!a || !b) return;
        if (a.level !== b.level) return;
        if (a.merged || b.merged) return;

        // 碰撞階段只排隊，實際合併留到物理更新結束後的安全階段處理
        this.mergeQueue.push({ a: a.id, b: b.id });
    };

    /* ---------- 局面控制 ---------- */

    World.prototype.reset = function () {
        var self = this;
        this.bodies.forEach(function (body) { Composite.remove(self.engine.world, body); });
        this.bodies.clear();
        this.mergeQueue.length = 0;

        this.nextFruitId = 1;
        this.score = 0;
        this.gameTime = 0;
        this.accumulator = 0;
        this.cooldownUntil = 0;
        this.dangerRatio = 0;
        this.state = 'running';       // running | paused | over
        this.dropCount = 0;
        this.mergeCount = 0;

        this.currentLevel = this._randomLevel();
        this.nextLevel = this._randomLevel();
        this.aimX = this.config.WORLD.width / 2;
        this.setAim(this.aimX);

        this.emitter.emit('reset', this.snapshot());
        return this;
    };

    World.prototype._randomLevel = function () {
        var spawn = this.config.SPAWN;
        var weights = spawn.weights;
        var total = 0;
        var i;
        for (i = 0; i < weights.length; i++) total += weights[i];
        var roll = this.rng() * total;
        for (i = 0; i < weights.length; i++) {
            roll -= weights[i];
            if (roll < 0) return i + 1;
        }
        return Math.min(weights.length, spawn.maxLevel);
    };

    World.prototype.pause = function () {
        if (this.state !== 'running') return false;
        this.state = 'paused';
        this.accumulator = 0;          // 丟掉積欠的時間，返回時不會突然跳動
        this.emitter.emit('pause');
        return true;
    };

    World.prototype.resume = function () {
        if (this.state !== 'paused') return false;
        this.state = 'running';
        this.accumulator = 0;
        this.emitter.emit('resume');
        return true;
    };

    World.prototype.isOver = function () { return this.state === 'over'; };

    World.prototype._gameOver = function () {
        if (this.state === 'over') return;
        this.state = 'over';
        this.accumulator = 0;
        this.emitter.emit('gameover', { score: this.score });
    };

    /* ---------- 投放 ---------- */

    /** 依目前水果半徑把落點限制在容器內，避免生成在牆裡。 */
    World.prototype.setAim = function (x) {
        var W = this.config.WORLD;
        var radius = this.config.levelAt(this.currentLevel).radius;
        this.aimX = clamp(x, W.innerLeft + radius, W.innerRight - radius);
        return this.aimX;
    };

    World.prototype.moveAim = function (delta) { return this.setAim(this.aimX + delta); };

    World.prototype.canDrop = function () {
        return this.state === 'running' && this.gameTime >= this.cooldownUntil;
    };

    World.prototype.cooldownRemaining = function () {
        return Math.max(0, this.cooldownUntil - this.gameTime);
    };

    World.prototype.drop = function () {
        if (!this.canDrop()) return null;

        var level = this.currentLevel;
        var body = this._createFruit(this.aimX, this.config.WORLD.spawnY, level, { grace: true });

        this.cooldownUntil = this.gameTime + this.config.TIMING.dropCooldownMs;
        this.dropCount++;
        this.currentLevel = this.nextLevel;
        this.nextLevel = this._randomLevel();
        this.setAim(this.aimX);        // 換成新水果後重新夾一次落點

        this.emitter.emit('drop', { level: level, x: body.position.x, y: body.position.y });
        return body;
    };

    World.prototype._createFruit = function (x, y, level, opts) {
        opts = opts || {};
        var P = this.config.PHYSICS;
        var W = this.config.WORLD;
        var info = this.config.levelAt(level);
        var radius = info.radius;

        var body = Bodies.circle(
            clamp(x, W.innerLeft + radius, W.innerRight - radius),
            Math.min(y, W.floorY - radius),
            radius,
            {
                label: FRUIT_LABEL,
                restitution: P.restitution,
                friction: P.friction,
                frictionStatic: P.frictionStatic,
                frictionAir: P.frictionAir,
                density: P.density,
                slop: P.slop
            }
        );

        var id = this.nextFruitId++;
        body.plugin.fruit = {
            id: id,
            level: level,
            radius: radius,
            merged: false,
            // 只有「玩家投放」才有入場寬限；合併產生的水果沒有，不能靠它規避結束判定
            graceUntil: opts.grace ? this.gameTime + this.config.TIMING.entryGraceMs : 0,
            dangerMs: 0,
            bornAt: this.gameTime
        };

        this.bodies.set(id, body);
        Composite.add(this.engine.world, body);
        return body;
    };

    /* ---------- 更新迴圈 ---------- */

    /**
     * 以真實經過時間推進。固定步長 + 補算上限，
     * 低幀率或分頁切回時不會一次補算太多而爆衝。
     */
    World.prototype.update = function (realDeltaMs) {
        if (this.state !== 'running') return 0;
        var T = this.config.TIMING;

        this.accumulator += clamp(realDeltaMs, 0, T.maxFrameMs);

        var steps = 0;
        while (this.accumulator >= T.stepMs && steps < T.maxStepsPerFrame) {
            this.step(T.stepMs);
            this.accumulator -= T.stepMs;
            steps++;
            if (this.state !== 'running') break;
        }
        if (steps >= T.maxStepsPerFrame) this.accumulator = 0;   // 放棄追趕，避免雪球效應
        return steps;
    };

    /** 單一固定步長：物理 → 合併 → 危險判定。 */
    World.prototype.step = function (dt) {
        this.gameTime += dt;
        Engine.update(this.engine, dt);
        this._processMerges();
        this._cullStrays();
        this._updateDanger(dt);
    };

    World.prototype._processMerges = function () {
        var queue = this.mergeQueue;
        if (!queue.length) return;
        // 整批取出：這一輪產生的新水果要等下一次更新才可能再合併
        var requests = queue.splice(0, queue.length);

        for (var i = 0; i < requests.length; i++) {
            var request = requests[i];
            var bodyA = this.bodies.get(request.a);
            var bodyB = this.bodies.get(request.b);

            // 合併前再次驗證：三顆同級同時接觸時，先完成的那組會讓其餘請求失效
            if (!bodyA || !bodyB) continue;
            var a = bodyA.plugin.fruit;
            var b = bodyB.plugin.fruit;
            if (a.merged || b.merged) continue;
            if (a.level !== b.level) continue;

            a.merged = true;
            b.merged = true;
            this._merge(bodyA, bodyB);
        }
    };

    World.prototype._merge = function (bodyA, bodyB) {
        var P = this.config.PHYSICS;
        var level = bodyA.plugin.fruit.level;
        var x = (bodyA.position.x + bodyB.position.x) / 2;
        var y = (bodyA.position.y + bodyB.position.y) / 2;

        this._removeFruit(bodyA);
        this._removeFruit(bodyB);
        this.mergeCount++;

        if (level >= this.config.MAX_LEVEL) {
            // 最高級兩顆相碰：一起消除，不再生成更高級
            this.score += this.config.SCORING.topClear;
            this.emitter.emit('clear', {
                level: level, x: x, y: y,
                score: this.config.SCORING.topClear, total: this.score
            });
            this.emitter.emit('score', { score: this.score });
            return null;
        }

        var gained = this.config.SCORING.merge[level - 1] || 0;
        this.score += gained;

        var body = this._createFruit(x, y, level + 1, { grace: false });

        // 保留一點來源動量，但設上限，避免憑空產生巨大動能
        var vx = (bodyA.velocity.x + bodyB.velocity.x) / 2 * P.mergeVelocityDamping;
        var vy = (bodyA.velocity.y + bodyB.velocity.y) / 2 * P.mergeVelocityDamping;
        var speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > P.maxMergeSpeed) {
            var scale = P.maxMergeSpeed / speed;
            vx *= scale;
            vy *= scale;
        }
        Body.setVelocity(body, { x: vx, y: vy });
        Body.setAngularVelocity(body, 0);

        this.emitter.emit('merge', {
            id: body.plugin.fruit.id,
            level: level + 1, x: body.position.x, y: body.position.y,
            score: gained, total: this.score
        });
        this.emitter.emit('score', { score: this.score });
        return body;
    };

    World.prototype._removeFruit = function (body) {
        this.bodies.delete(body.plugin.fruit.id);
        Composite.remove(this.engine.world, body);
    };

    /** 保險機制：萬一有物體被擠出容器，直接移除，避免留下看不見的殘留。 */
    World.prototype._cullStrays = function () {
        var W = this.config.WORLD;
        var self = this;
        var strays = [];
        this.bodies.forEach(function (body) {
            var p = body.position;
            if (p.y > W.height + 400 || p.x < -300 || p.x > W.width + 300) strays.push(body);
        });
        strays.forEach(function (body) { self._removeFruit(body); });
    };

    World.prototype._updateDanger = function (dt) {
        var W = this.config.WORLD;
        var T = this.config.TIMING;
        var self = this;
        var worst = 0;
        var dead = false;

        this.bodies.forEach(function (body) {
            var fruit = body.plugin.fruit;
            var top = body.position.y - fruit.radius;

            if (self.gameTime < fruit.graceUntil) {
                fruit.dangerMs = 0;         // 入場寬限內不累積
                return;
            }
            if (top < W.warningLineY) {
                fruit.dangerMs += dt;       // 每顆各自計時
                if (fruit.dangerMs >= T.dangerDelayMs) dead = true;
            } else {
                fruit.dangerMs = 0;         // 回到安全區就歸零，不累加不連續的超線時間
            }
            if (fruit.dangerMs > worst) worst = fruit.dangerMs;
        });

        this.dangerRatio = Math.min(1, worst / T.dangerDelayMs);
        if (dead) this._gameOver();
    };

    /* ---------- 對外查詢 ---------- */

    World.prototype.fruitCount = function () { return this.bodies.size; };

    /** 給繪圖層使用的輕量快照。 */
    World.prototype.fruits = function () {
        var list = [];
        this.bodies.forEach(function (body) {
            var fruit = body.plugin.fruit;
            list.push({
                id: fruit.id,
                level: fruit.level,
                radius: fruit.radius,
                x: body.position.x,
                y: body.position.y,
                angle: body.angle,
                dangerMs: fruit.dangerMs
            });
        });
        return list;
    };

    World.prototype.snapshot = function () {
        return {
            state: this.state,
            score: this.score,
            currentLevel: this.currentLevel,
            nextLevel: this.nextLevel,
            aimX: this.aimX,
            dangerRatio: this.dangerRatio,
            fruitCount: this.bodies.size,
            drops: this.dropCount,
            merges: this.mergeCount
        };
    };

    return { World: World, Emitter: Emitter, FRUIT_LABEL: FRUIT_LABEL, WALL_LABEL: WALL_LABEL };
});
