/*!
 * 第一人稱 3D 戰場
 *
 * 玩家站在料理台前，手持湯杓砲；蘑菇在前方，設備排在兩側。
 * 這個模組只「讀」遊戲狀態與事件來呈現畫面：位置、動畫、粒子與鏡頭都不回寫任何數值，
 * 動畫有沒有播完也不會改變傷害、獎勵或進度（規格第 8 節）。
 *
 * 操作：拖曳環視（滑鼠／觸控），點擊蘑菇或名牌指定優先目標，按住結冰設備 2 秒解凍。
 * 鍵盤字母全部留給英打，因此不使用 WASD 移動。
 */
import * as THREE from 'three';
import { buildEnvironment, disposeGroup } from './env.js?v=20261025-title';
import { buildMushroom, buildBoss, buildDevice, buildCourier, buildViewmodel } from './actors.js?v=20261025-title';
import { Effects } from './fx.js?v=20261025-title';
import { Labels } from './labels.js?v=20261025-title';

const Config = window.MushConfig;
const Combat = window.MushCombat;

const PRESETS = {
    field: { pos: new THREE.Vector3(0, 1.55, 4.0), look: new THREE.Vector3(0, 0.72, 0), fov: 50 },
    boss: { pos: new THREE.Vector3(0, 2.1, 5.6), look: new THREE.Vector3(0, 1.4, -1.2), fov: 52 }
};
const DEVICE_SLOT_Z = [1.4, 0.5, -0.4, -1.3];
const DEVICE_SLOT_Z_BOSS = [-0.2, -1.0, -1.8, -2.6];   // 菇王戰：設備往後排，避開下方連擊列，結冰狀態看得見
const BOSS_POS = new THREE.Vector3(0, 0, -1.2);
const UP = new THREE.Vector3(0, 1, 0);

const easeOutBack = (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const easeInOut = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function webglAvailable() {
    try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (err) {
        return false;
    }
}

class World {
    constructor(opts) {
        this.stage = opts.stage;
        this.game = opts.game;
        this.hud = opts.hud;
        this.opts = opts;
        this.actors = new Map();
        this.devices = new Map();
        this.courier = null;
        this.clock = performance.now() / 1000;
        this.shake = 0;
        this.look = { yaw: 0, pitch: 0, lastInput: 0 };
        this.drag = null;
        this.deviceHold = null;
        this.tween = null;
        this.presetKey = null;
        this.pendingTransition = null;
        this.labelTick = 0;
        this.lastRect = { w: 1, h: 1 };
        this.insets = { top: 0, right: 0, bottom: 0, left: 0 };

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        this.renderer = renderer;
        this.canvas = renderer.domElement;
        this.canvas.className = 'stage__canvas';
        this.canvas.setAttribute('aria-hidden', 'true');
        this.stage.insertBefore(this.canvas, this.stage.firstChild);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 80);
        this.scene.add(this.camera);
        this.camState = { pos: PRESETS.field.pos.clone(), look: PRESETS.field.look.clone(), fov: 55 };

        this.hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1);
        this.key = new THREE.DirectionalLight(0xfff4e0, 1.2);
        this.key.position.set(-3, 8, 6);
        this.fill = new THREE.DirectionalLight(0xcfe8ff, 0.35);
        this.fill.position.set(5, 3, 4);
        this.scene.add(this.hemi, this.key, this.fill);

        this.fx = new Effects(this.scene);
        this.labels = new Labels(document.getElementById('scene-labels'), (uid) => this.opts.onPickTarget(uid));
        this.viewmodel = buildViewmodel();
        this.camera.add(this.viewmodel.group);
        this.recoil = 0;
        this.missT = -10;

        // 優先目標光圈
        this.focusRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 48),
            new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
        this.focusRing.rotation.x = -Math.PI / 2;
        this.focusRing.position.y = 0.03;
        this.scene.add(this.focusRing);
        // 啦啦隊充能（下次擊敗雙倍菇幣）與電磁爐光環
        this.cheerRing = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.035, 8, 64),
            new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.0 }));
        this.cheerRing.rotation.x = Math.PI / 2;
        this.cheerRing.position.y = 0.05;
        this.scene.add(this.cheerRing);
        this.inductionRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.06, 8, 72),
            new THREE.MeshStandardMaterial({ color: 0xd03a2a, emissive: 0xd03a2a, emissiveIntensity: 1.4, transparent: true, opacity: 0.85 }));
        this.inductionRing.rotation.x = Math.PI / 2;
        this.inductionRing.position.set(0, 0.04, -0.2);
        this.inductionRing.visible = false;
        this.scene.add(this.inductionRing);

        this.raycaster = new THREE.Raycaster();
        this.ndc = new THREE.Vector2();
        this.tmp = new THREE.Vector3();

        this.applySettings();
        this.bindInput();
        this.observeResize();

        this.canvas.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            this.contextLost = true;
            this.hud.scene = null;
            this.stage.classList.add('is-fallback');
            this.hud.toast('3D 場景暫停（顯示卡資源被回收），已改用 2D 戰場，進度不受影響。');
        });
        this.canvas.addEventListener('webglcontextrestored', () => {
            this.contextLost = false;
            this.hud.scene = this;
            this.stage.classList.remove('is-fallback');
            this.envKey = null;
        });

        this.frame = this.frame.bind(this);
        requestAnimationFrame(this.frame);
    }

    /* ---------------- 設定與狀態 ---------------- */

    reduced() { return !!this.opts.isReducedMotion(); }

    applySettings() {
        this.fx.reduced = this.reduced();
        this.envKey = null;          // 主題可能改變，下一幀重建環境
    }

    setGame(game) {
        this.game = game;
        this.actors.forEach((actor) => this.removeActor(actor));
        this.actors.clear();
        this.devices.forEach((d) => { this.scene.remove(d.group); disposeGroup(d.group); });
        this.devices.clear();
        if (this.courier) { this.scene.remove(this.courier.group); this.courier = null; }
        this.envKey = null;
    }

    resetView() {
        this.look.yaw = 0;
        this.look.pitch = 0;
        this.look.lastInput = 0;
    }

    /* ---------------- 版面與鏡頭 ---------------- */

    observeResize() {
        const apply = () => {
            const rect = this.stage.getBoundingClientRect();
            const w = Math.max(1, Math.round(rect.width));
            const h = Math.max(1, Math.round(rect.height));
            if (w === this.lastRect.w && h === this.lastRect.h) return;
            this.lastRect = { w, h };
            this.renderer.setSize(w, h, false);
            this.camera.aspect = w / h;
            this.applyViewOffset();
        };
        if (window.ResizeObserver) new ResizeObserver(apply).observe(this.stage);
        window.addEventListener('resize', apply);
        apply();
    }

    presetFor(key) { return PRESETS[key]; }

    /** HUD 遮住的範圍（px）。鏡頭的視野中心移到沒被遮住的區域，戰場就不會被 HUD 蓋住。 */
    setViewInsets(insets) {
        const next = {
            top: Math.max(0, Math.round(insets.top || 0)), right: Math.max(0, Math.round(insets.right || 0)),
            bottom: Math.max(0, Math.round(insets.bottom || 0)), left: Math.max(0, Math.round(insets.left || 0))
        };
        const prev = this.insets;
        if (prev.top === next.top && prev.right === next.right && prev.bottom === next.bottom && prev.left === next.left) return;
        this.insets = next;
        this.applyViewOffset();
    }

    applyViewOffset() {
        const { w, h } = this.lastRect;
        const ins = this.insets;
        // 可用區太小（例如縮小戰場）時只部分位移，避免畫面被推出邊界
        const maxX = w * 0.3, maxY = h * 0.3;
        const dx = clamp((ins.right - ins.left) / 2, -maxX, maxX);
        const dy = clamp((ins.bottom - ins.top) / 2, -maxY, maxY);
        this.camera.setViewOffset(w, h, dx, dy, w, h);
        this.camera.updateProjectionMatrix();
    }

    /** 沒被 HUD 遮住的可視寬高比，用來排版蘑菇與設備。 */
    usableAspect() {
        const { w, h } = this.lastRect;
        const ins = this.insets;
        const uw = Math.max(120, w - ins.left - ins.right);
        const uh = Math.max(100, h - ins.top - ins.bottom);
        return clamp(uw / uh, 0.6, 3.2);
    }

    /** 在指定鏡頭下，某個 z 深度的地面可見半寬。 */
    halfWidthAt(preset, z) {
        const vfov = THREE.MathUtils.degToRad(preset.fov);
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * Math.min(this.camera.aspect, this.usableAspect() * 1.15));
        return Math.tan(hfov / 2) * Math.max(0.5, preset.pos.z - z);
    }

    startTween(fromKey, toKey, kind) {
        const to = PRESETS[toKey];
        const reduced = this.reduced();
        if (reduced || kind === 'instant') {
            this.tween = null;
            this.camState.pos.copy(to.pos);
            this.camState.look.copy(to.look);
            this.camState.fov = to.fov;
            return;
        }
        const from = { pos: this.camState.pos.clone(), look: this.camState.look.clone(), fov: this.camState.fov };
        let control = null;
        let duration = 0.4;
        if (kind === 'enter') {
            // 推近：從菇王正後方高處快速推向菇王
            from.pos = to.pos.clone().add(new THREE.Vector3(0, 1.2, 4.5));
            from.fov = 62;
            duration = 0.8;
        } else if (kind === 'title') {
            duration = 1.1;
        } else if (kind === 'exit') {
            // 拉遠：先往後拉高，再回到料理台
            control = from.pos.clone().add(new THREE.Vector3(0, 1.4, 4.2));
            duration = 0.85;
        }
        this.tween = { from, to, control, t: 0, duration };
    }

    updateCamera(dt, t) {
        const key = this.game.mode === 'boss' ? 'boss' : 'field';
        if (key !== this.presetKey) {
            let kind = 'instant';
            if (this.presetKey !== null) {
                if (this.pendingTransition && (key === 'boss' || this.presetKey === 'boss')) kind = this.pendingTransition;
                else kind = 'soft';
            }
            this.startTween(this.presetKey, key, kind);
            this.pendingTransition = null;
            this.presetKey = key;
        }
        const preset = PRESETS[key];
        if (this.tween) {
            const tw = this.tween;
            tw.t += dt;
            const k = Math.min(1, tw.t / tw.duration);
            const e = easeInOut(k);
            if (tw.control) {
                const a = tw.from.pos, c = tw.control, b = tw.to.pos;
                const u = 1 - e;
                this.camState.pos.set(
                    u * u * a.x + 2 * u * e * c.x + e * e * b.x,
                    u * u * a.y + 2 * u * e * c.y + e * e * b.y,
                    u * u * a.z + 2 * u * e * c.z + e * e * b.z);
            } else {
                this.camState.pos.lerpVectors(tw.from.pos, tw.to.pos, e);
            }
            this.camState.look.lerpVectors(tw.from.look, tw.to.look, e);
            this.camState.fov = tw.from.fov + (tw.to.fov - tw.from.fov) * e;
            if (k >= 1) this.tween = null;
        } else {
            this.camState.pos.copy(preset.pos);
            this.camState.look.copy(preset.look);
            this.camState.fov = preset.fov;
        }
        if (this.titleScreen && !this.tween) {
            // 標題畫面運鏡：以戰場為中心左右環繞、拉高拉遠
            const angle = this.reduced() ? 0.35 : Math.sin(t * 0.16) * 0.6 + 0.15;
            const look = preset.look;
            const offset = preset.pos.clone().sub(look).multiplyScalar(1.35);
            offset.applyAxisAngle(UP, angle);
            this.camState.pos.copy(look).add(offset);
            this.camState.pos.y += 0.6;
            this.camState.look.copy(look).add(new THREE.Vector3(0, 0.25, 0));
            this.camState.fov = preset.fov;
        }

        // 一段時間沒有操作，視角自動回正
        const idle = t - this.look.lastInput;
        if (!this.drag && idle > 4) {
            if (this.reduced()) { this.look.yaw = 0; this.look.pitch = 0; }
            else {
                this.look.yaw *= Math.pow(0.04, dt);
                this.look.pitch *= Math.pow(0.04, dt);
            }
        }

        const cam = this.camera;
        cam.position.copy(this.camState.pos);
        if (this.shake > 0 && !this.reduced()) {
            const s = this.shake;
            cam.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0));
        }
        this.shake = Math.max(0, this.shake - dt * 0.6);
        cam.lookAt(this.camState.look);
        cam.rotateOnWorldAxis(UP, this.look.yaw);
        cam.rotateX(this.look.pitch);
        if (Math.abs(cam.fov - this.camState.fov) > 0.01) {
            cam.fov = this.camState.fov;
            cam.updateProjectionMatrix();
        }
        return preset;
    }

    /* ---------------- 輸入 ---------------- */

    bindInput() {
        const c = this.canvas;
        c.style.touchAction = 'none';
        // 點場景不搶走英打輸入框的焦點，手機軟鍵盤也不會因此收起
        c.addEventListener('mousedown', (event) => event.preventDefault());
        c.addEventListener('pointerdown', (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            event.preventDefault();
            try { c.setPointerCapture(event.pointerId); } catch (ignore) { /* 部分瀏覽器不支援 */ }
            this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, sx: event.clientX, sy: event.clientY, moved: false };
            const hit = this.pick(event.clientX, event.clientY);
            if (hit && hit.deviceId && this.game.state.frozen[hit.deviceId]) {
                this.deviceHold = { deviceId: hit.deviceId, start: performance.now() };
            }
        });
        c.addEventListener('pointermove', (event) => {
            const d = this.drag;
            if (!d || d.id !== event.pointerId) {
                if (event.pointerType === 'mouse') this.hover(event.clientX, event.clientY);
                return;
            }
            const dx = event.clientX - d.x, dy = event.clientY - d.y;
            if (!d.moved && Math.hypot(event.clientX - d.sx, event.clientY - d.sy) > 6) {
                d.moved = true;
                this.deviceHold = null;
                this.stage.classList.add('has-looked');
            }
            if (d.moved) {
                this.look.yaw = clamp(this.look.yaw - dx * 0.0045, -0.62, 0.62);
                this.look.pitch = clamp(this.look.pitch - dy * 0.0035, -0.32, 0.28);
                this.look.lastInput = performance.now() / 1000;
            }
            d.x = event.clientX;
            d.y = event.clientY;
        });
        const end = (event, cancelled) => {
            const d = this.drag;
            if (!d || d.id !== event.pointerId) return;
            this.drag = null;
            this.deviceHold = null;
            if (cancelled || d.moved) return;
            const hit = this.pick(event.clientX, event.clientY);
            if (!hit) return;
            if (hit.courier) this.opts.onCourier();
            else if (hit.uid !== undefined) this.opts.onPickTarget(hit.uid);
            else if (hit.deviceId && this.game.state.frozen[hit.deviceId]) {
                this.hud.floater('按住結冰設備 2 秒解凍', 'freeze');
            }
        };
        c.addEventListener('pointerup', (event) => end(event, false));
        c.addEventListener('pointercancel', (event) => end(event, true));
        c.addEventListener('lostpointercapture', (event) => end(event, true));
        window.addEventListener('blur', () => { this.drag = null; this.deviceHold = null; });
    }

    pick(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const candidates = [];
        this.actors.forEach((a) => { if (!a.dyingT && !a.leaving) candidates.push(a.group); });
        this.devices.forEach((d) => candidates.push(d.group));
        if (this.courier && !this.courier.leaving) candidates.push(this.courier.group);
        const hits = this.raycaster.intersectObjects(candidates, true);
        for (const h of hits) {
            let o = h.object;
            while (o) {
                if (o.userData.courier) return { courier: true };
                if (o.userData.uid !== undefined) return { uid: o.userData.uid };
                if (o.userData.deviceId) return { deviceId: o.userData.deviceId };
                o = o.parent;
            }
        }
        return null;
    }

    hover(x, y) {
        const now = performance.now();
        if (this.lastHover && now - this.lastHover < 80) return;
        this.lastHover = now;
        const hit = this.pick(x, y);
        this.canvas.style.cursor = hit && (hit.uid !== undefined || hit.courier || (hit.deviceId && this.game.state.frozen[hit.deviceId])) ? 'pointer' : 'grab';
    }

    /* ---------------- 投影工具 ---------------- */

    project(v) {
        const p = v.clone().project(this.camera);
        return {
            x: (p.x + 1) / 2 * this.lastRect.w,
            y: (1 - p.y) / 2 * this.lastRect.h,
            visible: p.z < 1 && p.z > -1
        };
    }

    headOf(actor) {
        return actor.group.position.clone().add(new THREE.Vector3(0, actor.height * actor.group.scale.y + 0.08, 0));
    }

    centerOf(actor) {
        return actor.group.position.clone().add(new THREE.Vector3(0, actor.height * actor.group.scale.y * 0.5, 0));
    }

    /** 浮字錨點：目標頭頂（或身體中央）。沒有目標時回傳場景空位。 */
    anchorFor(uid, body) {
        if (uid === undefined || uid === null) {
            const spot = this.emptySpot();
            if (!spot) return null;
            const margin = Math.min(150, this.lastRect.w / 2);
            return { x: clamp(spot.x + (Math.random() - 0.5) * 60, margin, this.lastRect.w - margin), y: spot.y + 40 + Math.random() * 30 };
        }
        const actor = this.actors.get(uid);
        if (!actor) return null;
        const p = this.project(body ? this.centerOf(actor) : this.headOf(actor));
        if (!p.visible) return null;
        return {
            x: clamp(p.x + (Math.random() - 0.5) * 36, Math.min(110, this.lastRect.w / 2), this.lastRect.w - Math.min(110, this.lastRect.w / 2)),
            y: clamp(p.y - (body ? 0 : 52) + (Math.random() - 0.5) * 16, 24, this.lastRect.h - 24)
        };
    }

    /** 找一個遠離蘑菇臉與名牌的空位（PASS 等提示用）。 */
    emptySpot() {
        const ins = this.insets;
        const x0 = ins.left, y0 = ins.top, w = this.lastRect.w - ins.left - ins.right, h = this.lastRect.h - ins.top - ins.bottom;
        const candidates = [[0.18, 0.2], [0.82, 0.2], [0.5, 0.1], [0.16, 0.6], [0.84, 0.6]].map(([x, y]) => ({ x: x0 + x * w, y: y0 + y * h }));
        const obstacles = [];
        this.actors.forEach((a) => {
            if (a.dyingT) return;
            const face = this.project(this.centerOf(a));
            const head = this.project(this.headOf(a));
            obstacles.push(face, { x: head.x, y: head.y - 30 });
        });
        if (!obstacles.length) return candidates[2];
        let best = candidates[0], bestScore = -1;
        candidates.forEach((c) => {
            const score = Math.min(...obstacles.map((o) => Math.hypot(o.x - c.x, (o.y - c.y) * 1.3)));
            if (score > bestScore) { bestScore = score; best = c; }
        });
        return best;
    }

    /* ---------------- 環境 ---------------- */

    syncEnvironment() {
        const theme = this.opts.getTheme() === 'dark' ? 'dark' : 'light';
        const zoneId = this.game.state.zoneId;
        const key = zoneId + ':' + theme;
        if (key === this.envKey) return;
        this.envKey = key;
        if (this.env) { this.scene.remove(this.env.group); disposeGroup(this.env.group); }
        this.env = buildEnvironment(zoneId, theme);
        this.scene.add(this.env.group);
        const pal = this.env.palette;
        this.scene.background = new THREE.Color(pal.sky);
        this.scene.fog = new THREE.Fog(pal.fog, 12, 30);
        this.hemi.color.set(pal.hemiSky);
        this.hemi.groundColor.set(pal.hemiGround);
        this.hemi.intensity = pal.hemi;
        this.key.intensity = pal.key;
        this.fill.intensity = theme === 'dark' ? 0.25 : 0.4;
        this.renderer.toneMappingExposure = theme === 'dark' ? 1.15 : 1.05;
    }

    /* ---------------- 蘑菇與菇王 ---------------- */

    createActor(target, t) {
        const isBoss = target.kind === 'boss';
        const def = isBoss ? Config.BOSS_BY_ID[target.typeId] : Config.MUSHROOM_BY_ID[target.typeId];
        if (!def) return null;
        const model = isBoss ? buildBoss(def) : buildMushroom(def);
        model.group.traverse((o) => { o.userData.uid = target.uid; });
        model.materials.forEach((m) => { m.userData.baseEmissive = m.emissive.clone(); m.userData.baseIntensity = m.emissiveIntensity; });
        const actor = Object.assign(model, {
            uid: target.uid, kind: target.kind, typeId: target.typeId, def,
            spawnT: this.reduced() ? -10 : t + (isBoss ? 0.25 : 0), hitT: -10, hitPower: 0, luckyT: -10,
            passT: -10, passDelay: 0, dyingT: 0, leaving: 0, regenT: -10, lastHp: target.hp,
            slot: new THREE.Vector3(), slotScale: 1, shieldsShown: isBoss ? (target.shields || 0) : 0,
            seed: Math.random() * 10, softT: -10
        });
        if (isBoss) actor.group.position.copy(BOSS_POS);
        if (actor.extras.shields) {
            actor.extras.shields.forEach((shell, i) => { shell.visible = i < actor.shieldsShown; });
        }
        if (target.fleeAt) {
            // 寶箱松露逃跑倒數：腳下的地面環逐漸縮短
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.9, 48, 1, 0, Math.PI * 2),
                new THREE.MeshBasicMaterial({ color: 0xffd34d, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.035;
            actor.group.add(ring);
            actor.fleeRing = ring;
        }
        this.scene.add(actor.group);
        this.actors.set(target.uid, actor);
        return actor;
    }

    removeActor(actor) {
        this.scene.remove(actor.group);
        disposeGroup(actor.group);
        this.labels.remove(actor.uid);
        this.actors.delete(actor.uid);
    }

    layoutTargets(alive, presetKey, preset) {
        if (presetKey === 'boss') {
            alive.forEach((t) => {
                const a = this.actors.get(t.uid);
                if (a) { a.slot.copy(BOSS_POS); a.slotScale = 1; }
            });
            return;
        }
        const n = alive.length;
        const ownedDevices = Config.DEVICES.some((d) => (this.game.state.devices[d.id] || 0) > 0);
        const half = this.halfWidthAt(preset, 0);
        const usable = Math.max(1.0, half - (ownedDevices ? 1.0 : 0.55));
        const spacing = n > 1 ? Math.min(1.5, (usable * 2) / n) : 0;
        const scale = clamp(spacing ? spacing / 1.2 : 1, 0.55, 1);
        alive.forEach((t, i) => {
            const a = this.actors.get(t.uid);
            if (!a) return;
            const x = (i - (n - 1) / 2) * spacing;
            const stagger = n >= 4 ? (i % 2 ? -0.45 : 0.1) : 0;
            a.slot.set(x, 0, stagger);
            a.slotScale = scale;
        });
    }

    syncActors(t, now, presetKey, preset) {
        const game = this.game;
        const alive = game.aliveTargets();
        const seen = new Set();
        alive.forEach((target) => {
            seen.add(target.uid);
            let actor = this.actors.get(target.uid);
            if (!actor) actor = this.createActor(target, t);
            if (!actor) return;
            actor.target = target;
            if (target.hp > actor.lastHp + 1e-9 && target.kind !== 'boss') {
                if (t - actor.regenT > 0.45) {
                    actor.regenT = t;
                    this.fx.burst(this.centerOf(actor), { color: 0x6fdc7a, count: 6, up: 1.4, gravity: -1.5, size: 0.05, speed: 1.2, life: 0.8 });
                }
            }
            actor.lastHp = target.hp;
            if (actor.extras.shields && (target.shields || 0) < actor.shieldsShown) {
                this.shatterShell(actor, target.shields || 0);
            }
        });
        this.layoutTargets(alive, presetKey, preset);
        this.actors.forEach((actor, uid) => {
            if (seen.has(uid) || actor.dyingT || actor.leaving) return;
            // 不再存活：被擊敗的已在 kill 事件標記；其他（逃跑、切換地區、退出菇王）淡出
            actor.leaving = t;
            this.labels.remove(uid);
        });
        return alive;
    }

    animateActors(dt, t, now) {
        const reduced = this.reduced();
        const preferred = this.game.state.preferredUid;
        let focus = null;
        this.actors.forEach((a) => {
            const g = a.group;
            const body = a.body;
            if (!a.dyingT && !a.leaving) {
                if (reduced) g.position.copy(a.slot);
                else g.position.lerp(a.slot, 1 - Math.pow(0.0008, dt));
            }
            let s = a.slotScale;
            if (!reduced && t < a.spawnT + 0.5) s *= Math.max(0, easeOutBack(clamp((t - a.spawnT) / 0.5, 0, 1)));
            if (t < a.spawnT) s = 0;
            g.scale.setScalar(Math.max(0.0001, s));

            body.scale.set(1, 1, 1);
            body.rotation.set(0, 0, 0);
            body.position.set(0, 0, 0);
            if (!reduced && !a.dyingT) {
                const breathe = Math.sin(t * 2.2 + a.seed) * 0.025;
                body.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
                if (a.typeId === 'sh_chest') body.rotation.y = Math.sin(t * 9) * 0.12;     // 坐立不安，準備逃跑
            }
            const hk = Math.max(0, 1 - (t - a.hitT) / 0.24);
            if (hk > 0 && !reduced) {
                const p = a.hitPower * hk;
                body.scale.y *= 1 - 0.18 * p;
                body.scale.x *= 1 + 0.12 * p;
                body.scale.z *= 1 + 0.12 * p;
                body.rotation.x = -0.28 * p;
            }
            const pk = (t - a.passT - a.passDelay) / 0.7;
            if (pk > 0 && pk < 1) body.rotation.z = Math.sin(pk * Math.PI) * (reduced ? 0.18 : 0.38) * (a.seed > 5 ? 1 : -1);

            // 受擊白光、幸運金光、海綿回血綠光
            const lk = Math.max(0, 1 - (t - a.luckyT) / 0.85);
            const rk = Math.max(0, 1 - (t - a.regenT) / 0.5);
            a.materials.forEach((m) => {
                const base = m.userData.baseEmissive;
                if (lk > 0) { m.emissive.setRGB(1, 0.75, 0.15); m.emissiveIntensity = 1.3 * lk + 0.2; }
                else if (hk > 0) { m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 0.75 * hk * a.hitPower; }
                else if (rk > 0) { m.emissive.setRGB(0.3, 0.95, 0.4); m.emissiveIntensity = 0.6 * rk; }
                else { m.emissive.copy(base); m.emissiveIntensity = m.userData.baseIntensity; }
            });

            if (a.extras.sparkles) {
                a.extras.sparkles.forEach((sp) => {
                    const o = sp.userData.orbit + t * 1.6;
                    sp.position.set(Math.cos(o) * 0.75, 0.75 + Math.sin(t * 3 + o) * 0.15, Math.sin(o) * 0.75);
                });
            }
            if (a.extras.cold && !reduced && Math.random() < dt * (a.kind === 'boss' ? 6 : 1.5)) {
                const p = g.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * a.radius * 2, a.height * g.scale.y, (Math.random() - 0.5) * a.radius));
                this.fx.burst(p, { color: 0xe6f7ff, count: 1, up: 0.2, gravity: 0.6, size: 0.035, speed: 0.4, life: 1.4 });
            }
            if (a.fleeRing && a.target && a.target.fleeAt) {
                const total = (a.def.fleeSeconds || 14) * 1000;
                const left = clamp((a.target.fleeAt - now) / total, 0, 1);
                a.fleeRing.geometry.dispose();
                a.fleeRing.geometry = new THREE.RingGeometry(0.78, 0.9, 48, 1, Math.PI / 2, Math.max(0.0001, Math.PI * 2 * left));
                a.fleeRing.material.color.set(left < 0.3 ? 0xff5a4a : 0xffd34d);
            }
            if (a.extras.shields) this.animateShields(a, t, now);
            if (Combat.isSoftened(a.target || {}, now) && !reduced && Math.random() < dt * 4) {
                this.fx.burst(this.centerOf(a), { color: 0xff9ad5, count: 1, up: 1, gravity: -0.5, size: 0.04, speed: 0.6, life: 0.6 });
            }

            // 擊敗：先膨脹再縮小消失，噴出孢子
            if (a.dyingT) {
                const k = (t - a.dyingT) / (a.kind === 'boss' ? 0.9 : 0.45);
                if (k >= 1) { this.removeActor(a); return; }
                const pop = reduced ? 1 - k : (k < 0.3 ? 1 + k * 0.6 : 1.18 * (1 - (k - 0.3) / 0.7));
                g.scale.setScalar(Math.max(0.0001, a.slotScale * pop));
                if (!reduced) body.rotation.y = k * 4;
            } else if (a.leaving) {
                const k = (t - a.leaving) / 0.6;
                if (k >= 1) { this.removeActor(a); return; }
                if (a.fled) { g.position.y = -k * a.height * 1.2; }
                else g.scale.setScalar(Math.max(0.0001, a.slotScale * (1 - k)));
            }
            if (!a.dyingT && !a.leaving && a.uid === preferred) focus = a;
        });
        if (!focus) {
            const first = this.game.aliveTargets()[0];
            focus = first ? this.actors.get(first.uid) : null;
        }
        if (focus) {
            this.focusRing.visible = true;
            this.focusRing.position.x = focus.group.position.x;
            this.focusRing.position.z = focus.group.position.z;
            const r = focus.radius * focus.group.scale.x * 1.35;
            const pulse = this.reduced() ? 1 : 1 + Math.sin(t * 5) * 0.05;
            this.focusRing.scale.setScalar(Math.max(0.3, r) * pulse);
            this.focusRing.material.color.set(this.game.state.preferredUid === focus.uid ? 0xffe066 : 0xffffff);
            this.focusRing.material.opacity = this.game.state.preferredUid === focus.uid ? 0.9 : 0.35;
        } else this.focusRing.visible = false;
    }

    animateShields(actor, t, now) {
        const hold = this.game.holdProgress(now);
        actor.extras.shields.forEach((shell, i) => {
            if (!shell.visible) return;
            const outer = i === actor.shieldsShown - 1;
            shell.rotation.y = t * (0.2 + i * 0.1) * (i % 2 ? -1 : 1);
            shell.rotation.x = Math.sin(t * 0.5 + i) * 0.1;
            const charge = outer ? hold : 0;
            shell.material.emissiveIntensity = 0.35 + charge * 1.6 + (outer ? Math.sin(t * 3) * 0.08 : 0);
            shell.material.opacity = 0.16 + i * 0.03 + charge * 0.25;
            const jitter = charge > 0 && !this.reduced() ? (Math.random() - 0.5) * 0.04 * charge : 0;
            shell.scale.setScalar(1 + jitter + charge * 0.06);
            shell.children[0].material.opacity = 0.55 + charge * 0.45;
            shell.children[0].material.color.set(charge > 0.66 ? 0xffffff : (charge > 0.01 ? 0xffe08a : shell.material.color.getHex()));
        });
    }

    shatterShell(actor, left) {
        const shell = actor.extras.shields[left];
        actor.shieldsShown = left;
        if (!shell || !shell.visible) return;
        shell.visible = false;
        const center = actor.group.position.clone().add(new THREE.Vector3(0, 1.35, 0));
        const radius = 1.75 + left * 0.28;
        const color = shell.material.color.getHex();
        const n = this.fx.density(46);
        for (let i = 0; i < n; i++) {
            const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
            this.fx.particles.spawn({
                pos: center.clone().addScaledVector(dir, radius), vel: dir.multiplyScalar(3 + Math.random() * 3),
                age: 0, life: 0.9 + Math.random() * 0.4, size: 0.09 + Math.random() * 0.08, gravity: 6, drag: 0.5,
                color: new THREE.Color(color), spinSpeed: 14, stretch: 0.3, floor: 0.02
            });
        }
        this.fx.ring(center, { color, from: 0.5, to: 4, life: 0.6, y: 1.35, vertical: true });
        this.kick(0.22);
    }

    /* ---------------- 設備 ---------------- */

    syncDevices(t, now, presetKey, preset) {
        const state = this.game.state;
        const owned = Config.DEVICES.filter((d) => (state.devices[d.id] || 0) > 0);
        owned.forEach((def) => {
            if (this.devices.has(def.id)) return;
            const model = buildDevice(def);
            model.group.traverse((o) => { o.userData.deviceId = def.id; });
            model.materials.forEach((m) => { m.userData.baseEmissive = m.emissive.clone(); m.userData.baseIntensity = m.emissiveIntensity; });
            Object.assign(model, { def, fireT: -10, spawnT: this.reduced() ? -10 : t, lastVisual: 0 });
            this.scene.add(model.group);
            this.devices.set(def.id, model);
        });
        this.devices.forEach((d, id) => {
            if ((state.devices[id] || 0) <= 0) {
                this.scene.remove(d.group);
                disposeGroup(d.group);
                this.devices.delete(id);
            }
        });
        // 依設備順序左右交錯排在料理台兩側，貼著畫面邊緣，不擋住蘑菇
        const layoutKey = presetKey;
        const lp = PRESETS[layoutKey];
        let index = 0;
        const reduced = this.reduced();
        const hasted = state.buffs && state.buffs.haste > now;
        Config.DEVICES.forEach((def) => {
            const d = this.devices.get(def.id);
            if (!d) return;
            const side = index % 2 === 0 ? -1 : 1;
            const row = Math.floor(index / 2);
            index++;
            // 窄螢幕（手機）的近處可見寬度太窄，設備改排在較遠處的兩側
            const narrow = this.usableAspect() < 1.45;
            const z = (layoutKey === 'boss' || narrow ? DEVICE_SLOT_Z_BOSS : DEVICE_SLOT_Z)[row] - (narrow && layoutKey !== 'boss' ? 0.4 : 0);
            const minX = layoutKey === 'boss' ? 2.2 : (narrow ? 1.35 : 1.55);
            const x = side * Math.max(minX, this.halfWidthAt(lp, z) - (layoutKey === 'boss' ? 0.7 : 0.55));
            const target = new THREE.Vector3(x, 0, z);
            if (reduced || !d.placed) d.group.position.copy(target);
            else d.group.position.lerp(target, 1 - Math.pow(0.002, 0.016));
            d.placed = true;
            d.group.rotation.y = Math.atan2(-d.group.position.x, -0.5 - d.group.position.z) + Math.PI;   // 模型朝 -z，轉向戰場中央
            let s = 1;
            if (!reduced && t < d.spawnT + 0.5) s = Math.max(0.0001, easeOutBack(clamp((t - d.spawnT) / 0.5, 0, 1)));
            d.group.scale.setScalar(s);

            const frozen = !!state.frozen[def.id];
            d.ice.visible = frozen;
            this.animateDevice(d, t, reduced, frozen, hasted);
            // 解凍蓄力環（只在按住時顯示）
            const hold = this.deviceHold && this.deviceHold.deviceId === def.id && frozen ? this.deviceHold : null;
            if (hold) {
                const k = clamp((performance.now() - hold.start) / 2000, 0, 1);
                d.holdRing.visible = true;
                d.holdRing.geometry.dispose();
                d.holdRing.geometry = new THREE.RingGeometry(0.55, 0.68, 40, 1, Math.PI / 2, Math.max(0.0001, Math.PI * 2 * k));
                if (k >= 1) {
                    this.deviceHold = null;
                    d.holdRing.visible = false;
                    if (this.opts.onUnfreeze) this.opts.onUnfreeze(def.id);
                }
            } else d.holdRing.visible = false;
        });
        this.inductionRing.visible = !!this.devices.get('induction_field') && this.game.mode !== 'boss';
        if (this.inductionRing.visible) {
            this.inductionRing.material.emissiveIntensity = reduced ? 1.2 : 1 + Math.sin(t * 2.4) * 0.5;
            this.inductionRing.position.y = 0.04;
        }
        const cheer = !!state.cheerCharge && this.game.mode !== 'boss';
        this.cheerRing.material.opacity = cheer ? (reduced ? 0.7 : 0.5 + Math.sin(t * 6) * 0.25) : 0;
    }

    animateDevice(d, t, reduced, frozen, hasted) {
        const k = clamp((t - d.fireT) / 0.35, 0, 1);
        const firing = k < 1 && !frozen;
        const wave = Math.sin(k * Math.PI);
        const p = d.parts;
        d.materials.forEach((m) => {
            if (frozen) { m.emissive.setRGB(0.3, 0.6, 0.9); m.emissiveIntensity = 0.35; }
            else if (hasted) { m.emissive.setRGB(1, 0.25, 0.1); m.emissiveIntensity = reduced ? 0.25 : 0.2 + Math.sin(t * 10) * 0.12; }
            else if (firing) { m.emissive.setRGB(1, 0.9, 0.6); m.emissiveIntensity = 0.4 * wave; }
            else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseIntensity; }
        });
        if (frozen) return;
        if (p.hover) d.body.position.y = 1.15 + (reduced ? 0 : Math.sin(t * 3 + d.def.index) * 0.08);
        if (p.rotors && !reduced) p.rotors.forEach((r, i) => { r.rotation.y = t * 30 + i; });
        if (p.hinge) p.hinge.rotation.x = -0.35 + (firing ? wave * 0.45 : 0);
        if (p.lever) p.lever.rotation.x = 0.6 - (firing ? wave * 0.9 : 0);
        if (p.mallets) p.mallets.forEach((m, i) => { m.rotation.x = firing ? Math.sin(clamp(k * 1.4 - i * 0.15, 0, 1) * Math.PI) * -1.1 : 0; });
        if (p.coil) p.coil.material.emissiveIntensity = reduced ? 1.2 : 1 + Math.sin(t * 4) * 0.6;
        if (p.door) p.door.material.emissiveIntensity = firing ? 2.5 * wave : 0.25;
        if (p.dial && !reduced) p.dial.rotation.y = t * 0.6;
        if (d.def.id === 'pepper_drone' && firing && !reduced) d.body.rotation.z = Math.sin(k * 30) * 0.25 * (1 - k);
        else if (d.def.id === 'pepper_drone') d.body.rotation.z = 0;
    }

    deviceFire(payload) {
        const d = this.devices.get(payload.deviceId);
        if (!d) return;
        const t = this.clock;
        if (t - d.lastVisual < 0.22) return;       // 視覺節流：結算照常，畫面不過度擁擠
        d.lastVisual = t;
        d.fireT = t;
        const from = d.group.position.clone().add(new THREE.Vector3(0, d.height * 0.9, 0));
        if (d.def.id === 'pepper_drone') {
            (payload.uids || []).forEach((uid) => {
                const a = this.actors.get(uid);
                if (!a) return;
                this.fx.shoot(from, this.centerOf(a), { color: 0x4a3b30, size: 0.05, arc: 0.4, duration: 0.3, trail: false,
                    onArrive: () => this.fx.burst(this.headOf(a), { color: 0x3a302a, count: 5, size: 0.03, speed: 1, gravity: 2 }) });
            });
            return;
        }
        const target = this.actors.get(payload.uid);
        if (!target) return;
        const to = this.centerOf(target);
        if (d.def.id === 'orbital_micro') {
            this.fx.beam(target.group.position, 0x9fd8ff);
            this.fx.ring(target.group.position, { color: 0x9fd8ff, to: 2.2 });
            this.kick(0.06);
            return;
        }
        const colors = { auto_tongs: 0xdfe6ee, garlic_mech: 0xf7f2e4, tenderizer_array: 0xffb37a };
        const sizes = { auto_tongs: 0.06, garlic_mech: 0.13, tenderizer_array: 0.1 };
        this.fx.shoot(from, to, {
            color: colors[d.def.id] || 0xffffff, size: sizes[d.def.id] || 0.07, arc: 0.7, duration: 0.24,
            onArrive: () => {
                this.fx.burst(to, { color: colors[d.def.id] || 0xffffff, count: d.def.id === 'garlic_mech' ? 10 : 4, size: 0.04, speed: 1.6 });
                if (d.def.id === 'garlic_mech') this.fx.ring(target.group.position, { color: 0xf7f2e4, to: 1.6 });
            }
        });
    }

    /* ---------------- 外送員 ---------------- */

    syncCourier(t, now) {
        const state = this.game.state;
        const courier = state.courier;
        const button = document.getElementById('courier');
        if (courier && now < courier.expiresAt) {
            if (!this.courier) {
                const model = buildCourier();
                Object.assign(model, { startT: t });
                this.courier = model;
                this.scene.add(model.group);
                if (!this.reduced()) this.fx.burst(new THREE.Vector3(-3, 0.4, 1.6), { color: 0xf28b30, count: 10 });
            }
            const life = Config.BALANCE.courier.lifetimeSeconds * 1000;
            const k = clamp(1 - (courier.expiresAt - now) / life, 0, 1);
            const span = Math.max(1.8, this.halfWidthAt(PRESETS[this.game.mode === 'boss' ? 'boss' : 'field'], 1.0) - 0.3);
            const g = this.courier.group;
            g.position.set(-span + k * span * 2, 0, 1.0);
            g.scale.setScalar(0.62);
            g.rotation.y = Math.PI / 2 * 0.6;
            if (!this.reduced()) {
                this.courier.legs.forEach((leg, i) => { leg.position.z = Math.sin(t * 12 + i * Math.PI) * 0.06; });
                this.courier.body.position.y = Math.abs(Math.sin(t * 12)) * 0.04;
                this.courier.bag.rotation.z = 0.12 + Math.sin(t * 6) * 0.06;
            }
            const feet = this.project(g.position.clone().add(new THREE.Vector3(0, -0.05, 0)));
            if (button && feet.visible) {
                button.style.left = clamp(feet.x, 50, this.lastRect.w - 50) + 'px';
                button.style.top = clamp(feet.y + 6, 0, this.lastRect.h - 34) + 'px';
            }
        } else if (this.courier) {
            const g = this.courier.group;
            if (this.courierCaughtFlag) {
                this.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.8, 0)), { color: 0xffe066, count: 24, vary: 0.3, speed: 3 });
                this.fx.ring(g.position, { color: 0xffe066, to: 1.6 });
            }
            this.courierCaughtFlag = false;
            this.scene.remove(g);
            disposeGroup(g);
            this.courier = null;
        }
    }

    courierCaught() { this.courierCaughtFlag = true; }

    /* ---------------- 名牌 ---------------- */

    syncLabels(t, now) {
        const refresh = t - this.labelTick > 0.1;
        if (refresh) this.labelTick = t;
        const list = [];
        this.actors.forEach((a) => {
            if (a.dyingT || a.leaving || !a.target) return;
            const head = this.project(this.headOf(a));
            list.push({ a, head });
        });
        list.sort((p, q) => q.a.group.position.z - p.a.group.position.z);
        list.forEach(({ a, head }, order) => {
            if (refresh || !this.labels.nodes.has(a.uid)) {
                const view = this.hud.describeTarget(a.target, now);
                if (view) this.labels.setContent(a.uid, view);
            }
            const spawning = t < a.spawnT + 0.25;
            // 菇王改用畫面上方的大血條，不再顯示頭頂名牌
            this.labels.place(a.uid, head.x, head.y - 2, head.visible && !spawning && a.kind !== 'boss', list.length - order);
        });
    }

    /* ---------------- 第一人稱湯杓砲 ---------------- */

    updateViewmodel(dt, t) {
        const vm = this.viewmodel;
        const reduced = this.reduced();
        vm.group.visible = !this.titleScreen;          // 標題畫面運鏡時收起湯杓砲
        const vfov = THREE.MathUtils.degToRad(this.camera.fov);
        const hh = Math.tan(vfov / 2) * 0.95;
        const hw = hh * this.camera.aspect;
        vm.group.position.set(Math.min(0.46, hw * 0.66), -hh * 0.72, -0.95);
        vm.group.rotation.set(0.1, 0.16, 0);
        vm.group.scale.setScalar(this.camera.aspect < 1.3 ? 0.48 : 0.5);
        this.recoil = Math.max(0, this.recoil - dt * 6);
        const bob = reduced ? 0 : Math.sin(t * 2) * 0.006;
        vm.gun.position.set(0, bob - this.recoil * 0.02, this.recoil * 0.09);
        vm.gun.rotation.x = this.recoil * 0.18;
        const mk = clamp(1 - (t - this.missT) / 0.3, 0, 1);
        vm.gun.rotation.z = reduced ? 0 : Math.sin(mk * 30) * 0.06 * mk;
        vm.flash.material.opacity = Math.max(0, vm.flash.material.opacity - dt * 7);
        vm.flash.scale.setScalar(1 + (1 - vm.flash.material.opacity));
        // 菇王連擊：層數越高，砲口光環越亮，滿層轉金
        const combo = this.game.mode === 'boss' ? (this.game.state.combo || 0) : 0;
        const max = Config.BALANCE.combo.maxStacks;
        vm.aura.material.opacity = this.crazy ? 0.9 : (combo > 0 ? 0.25 + 0.6 * combo / max : 0);
        vm.aura.material.color.set(this.crazy ? 0xff6a1a : (combo >= max ? 0xffd34d : (combo >= 5 ? 0xff5a2e : 0xff9a3c)));
        if (!reduced) vm.aura.rotation.z = t * (this.crazy ? 9 : 4);
        if ((combo >= max || this.crazy) && !reduced && Math.random() < dt * 20) {
            const muzzle = vm.muzzle.clone();
            vm.gun.localToWorld(muzzle);
            this.fx.burst(muzzle, { color: 0xffb02e, count: 1, up: 1.4, gravity: -2, size: 0.02, speed: 0.4, life: 0.4 });
        }
        const energy = this.game.state.buffs && this.game.state.buffs.energy > Date.now();
        vm.brothMat.emissive.set(energy ? 0x3fae63 : 0xc0541f);
        vm.brothMat.emissiveIntensity = energy ? 0.9 : 0.4;
    }

    shoot(lucky) {
        const vm = this.viewmodel;
        this.recoil = Math.min(1.4, this.recoil + 0.75);
        vm.flash.material.opacity = 1;
        vm.flash.material.color.set(lucky ? 0xffd34d : 0xffe6a0);
        const alive = this.game.aliveTargets();
        const uid = this.game.state.preferredUid;
        const actor = this.actors.get(uid) || (alive[0] && this.actors.get(alive[0].uid));
        if (!actor) return;
        const muzzle = vm.muzzle.clone();
        vm.gun.localToWorld(muzzle);
        const to = this.centerOf(actor).add(new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, 0));
        this.fx.shoot(muzzle, to, {
            color: lucky ? 0xffd34d : 0xf2a24a, size: lucky ? 0.12 : 0.065, arc: 0.12, duration: 0.11,
            onArrive: () => this.fx.burst(to, { color: lucky ? 0xffd34d : 0xf2c88a, count: lucky ? 14 : 4, size: 0.035, speed: 1.8, gravity: 4 })
        });
    }

    miss() {
        this.missT = this.clock;
    }

    /* ---------------- 回饋事件（由 HUD／app 呼叫） ---------------- */

    /** 標題畫面：鏡頭在料理台上方慢慢環繞；離開時推進第一人稱視角。 */
    setTitleScreen(active) {
        const was = !!this.titleScreen;
        this.titleScreen = !!active;
        if (was && !this.titleScreen && this.presetKey) this.startTween(this.presetKey, this.presetKey, 'title');
    }

    /** 瘋狂連打期間：湯杓砲冒火。 */
    setCrazy(active) { this.crazy = !!active; }

    crazyStart() {
        this.kick(0.12);
        this.fx.ring(new THREE.Vector3(0, 0, 0), { color: 0xff7a2e, to: 4.5, life: 0.8, opacity: 0.85 });
        const muzzle = this.viewmodel.muzzle.clone();
        this.viewmodel.gun.localToWorld(muzzle);
        this.fx.burst(muzzle, { color: 0xffa23a, count: 18, up: 1.2, gravity: -1, size: 0.03, speed: 1.4, life: 0.6 });
    }

    kick(amount) { if (!this.reduced()) this.shake = Math.max(this.shake, amount); }

    hit(uid, opts) {
        const actor = this.actors.get(uid);
        if (!actor) return;
        actor.hitT = this.clock;
        actor.hitPower = opts && opts.fromAuto ? 0.55 : 1;
        if (opts && opts.crit) {
            this.fx.burst(this.headOf(actor), { color: 0xffe066, count: 8, size: 0.05, speed: 2.2 });
            this.kick(0.05);
        }
        this.labels.flashHit(uid);
    }

    kill(uid, reward) {
        const actor = this.actors.get(uid);
        if (!actor || actor.dyingT) return;
        actor.dyingT = this.clock;
        this.labels.remove(uid);
        const center = this.centerOf(actor);
        this.fx.burst(center, { color: actor.def.color, count: 18, vary: 0.05, speed: 3, size: 0.07 });
        this.fx.coinFountain(center, reward && reward.broth ? 26 : 16, !!(reward && reward.doubled));
        this.fx.ring(actor.group.position, { color: 0xffd34d, to: 1.8 });
        if (reward && reward.broth) this.fx.burst(center, { color: 0xffb800, count: 12, size: 0.09, speed: 2.4, up: 1.6 });
    }

    pass() {
        const t = this.clock;
        let i = 0;
        this.actors.forEach((a) => {
            if (a.dyingT || a.leaving) return;
            a.passT = t;
            a.passDelay = i++ * 0.065;
        });
    }

    lucky(uid) {
        const actor = this.actors.get(uid) || this.actors.get(this.game.state.preferredUid);
        if (!actor) return;
        actor.luckyT = this.clock;
        this.fx.burst(this.headOf(actor), { color: 0xffd34d, count: 26, vary: 0.08, speed: 3.2, size: 0.06, gravity: 2 });
        this.fx.ring(actor.group.position, { color: 0xffd34d, to: 2.4, life: 0.8 });
        this.kick(0.08);
    }

    shieldBreak(uid, left) {
        const actor = this.actors.get(uid);
        if (actor && actor.extras.shields && actor.shieldsShown > left) this.shatterShell(actor, left);
    }

    bossTransition(direction) {
        this.pendingTransition = direction === 'enter' ? 'enter' : 'exit';
    }

    comboMilestone(stacks, isMax) {
        this.kick(isMax ? 0.16 : (stacks >= 5 ? 0.09 : 0.06));
        const boss = Array.from(this.actors.values()).find((a) => a.kind === 'boss' && !a.dyingT);
        const pos = boss ? boss.group.position : new THREE.Vector3();
        this.fx.ring(pos, { color: isMax ? 0xffd34d : 0xff7a2e, to: isMax ? 4 : 2.6, life: 0.7 });
        if (isMax) this.fx.burst(pos.clone().add(new THREE.Vector3(0, 2, 0)), { color: 0xffd34d, count: 40, vary: 0.1, speed: 4, size: 0.07 });
    }

    freeze() {
        this.kick(0.12);
        const boss = Array.from(this.actors.values()).find((a) => a.kind === 'boss');
        if (boss) this.fx.ring(boss.group.position, { color: 0x9fe4ff, to: 8, life: 0.9, opacity: 0.9 });
        this.devices.forEach((d, id) => {
            if (!this.game.state.frozen[id]) return;
            this.fx.burst(d.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)), { color: 0xd8f6ff, count: 14, speed: 2, size: 0.05 });
        });
    }

    unfreeze(deviceId) {
        const d = this.devices.get(deviceId);
        if (!d) return;
        const p = d.group.position.clone().add(new THREE.Vector3(0, 0.5, 0));
        this.fx.burst(p, { color: 0xc8f0ff, count: 22, speed: 3, size: 0.07, gravity: 7, floor: 0.02 });
        this.fx.ring(d.group.position, { color: 0xff9a3c, to: 1.6 });
    }

    depthUp() {
        const depth = this.game.depthOf();
        const hue = 120 * (1 - (depth - 1) / Math.max(1, Config.BALANCE.depth.maxSteps - 1));
        this.fx.ring(new THREE.Vector3(0, 0, 0), { color: new THREE.Color().setHSL(hue / 360, 0.7, 0.55).getHex(), to: 4, life: 0.8, opacity: 0.6 });
    }

    onGameEvent(name, payload) {
        payload = payload || {};
        const t = this.clock;
        switch (name) {
            case 'deviceFire': this.deviceFire(payload); break;
            case 'haste': {
                const d = this.devices.get('spicy_sprinkler');
                if (d) {
                    d.fireT = t;
                    const from = d.group.position.clone().add(new THREE.Vector3(0, 0.75, 0));
                    for (let i = 0; i < this.fx.density(14); i++) {
                        this.fx.particles.spawn({
                            pos: from.clone(), vel: new THREE.Vector3(-Math.sign(from.x) * (1 + Math.random() * 2), 2 + Math.random() * 1.5, -Math.random()),
                            age: 0, life: 0.8, size: 0.05, gravity: 6, color: new THREE.Color(0xe0442a), floor: 0.02
                        });
                    }
                }
                break;
            }
            case 'cheer': {
                const d = this.devices.get('cheer_timer');
                if (d) {
                    d.fireT = t;
                    this.fx.ring(d.group.position, { color: 0xffd34d, to: 1.4 });
                    this.fx.burst(d.group.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { color: 0xff7ab8, count: 12, vary: 0.8, speed: 2.4, size: 0.04 });
                }
                break;
            }
            case 'soften': {
                const a = this.actors.get(payload.uid);
                if (a) this.fx.burst(this.headOf(a), { color: 0xff9ad5, count: 8, size: 0.05, speed: 1.6, gravity: 1 });
                break;
            }
            case 'blocked': {
                const a = this.actors.get(payload.uid);
                if (a && t - (this.lastBlock || 0) > 0.12) {
                    this.lastBlock = t;
                    const spot = a.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.2 + Math.random(), 1.9));
                    this.fx.burst(spot, { color: 0x9fe8ff, count: 6, size: 0.04, speed: 2, gravity: 1 });
                }
                break;
            }
            case 'flee': {
                const a = this.actors.get(payload.uid);
                if (a) {
                    a.fled = true;
                    a.leaving = t;
                    this.labels.remove(a.uid);
                    this.fx.burst(a.group.position.clone().add(new THREE.Vector3(0, 0.1, 0)), { color: 0x7a5a3a, count: 18, speed: 2, size: 0.06, floor: 0.02 });
                }
                break;
            }
            case 'bossMilestone': {
                const boss = Array.from(this.actors.values()).find((a) => a.kind === 'boss' && !a.dyingT);
                if (boss) this.fx.coinFountain(this.centerOf(boss).add(new THREE.Vector3(0, 0.6, 0.6)), 34, true);
                break;
            }
            case 'bossDefeated': {
                const boss = Array.from(this.actors.values()).find((a) => a.kind === 'boss' && !a.dyingT);
                if (boss) {
                    boss.dyingT = t;
                    this.labels.remove(boss.uid);
                    const c = this.centerOf(boss);
                    this.fx.burst(c, { color: boss.def.color, count: 60, vary: 0.1, speed: 5, size: 0.1 });
                    this.fx.coinFountain(c, 80, true);
                    this.fx.ring(boss.group.position, { color: 0xffd34d, to: 6, life: 1 });
                    this.kick(0.25);
                }
                break;
            }
            case 'buyDevice': {
                const d = this.devices.get(payload.deviceId);
                if (d) {
                    d.spawnT = this.reduced() ? -10 : t;
                    this.fx.burst(d.group.position.clone().add(new THREE.Vector3(0, 0.4, 0)), { color: 0xffe066, count: 12, speed: 2 });
                }
                break;
            }
            case 'useItem': {
                if (payload.kind === 'bomb') {
                    this.actors.forEach((a) => {
                        if (a.dyingT || a.leaving) return;
                        this.fx.burst(this.centerOf(a), { color: 0xff4a2a, count: 26, vary: 0.08, speed: 4, size: 0.08 });
                        this.fx.ring(a.group.position, { color: 0xff6a3a, to: 2.6 });
                    });
                    this.kick(0.22);
                } else if (payload.kind === 'whistle') {
                    this.fx.ring(new THREE.Vector3(0, 0, 0), { color: 0xc9d2dc, to: 5, life: 0.9 });
                }
                break;
            }
            case 'zone': this.envKey = null; break;
            default: break;
        }
    }

    /* ---------------- 主迴圈 ---------------- */

    frame() {
        requestAnimationFrame(this.frame);
        if (document.hidden || this.contextLost) return;
        const t = performance.now() / 1000;
        const dt = Math.min(0.05, Math.max(0, t - this.clock));
        this.clock = t;
        const now = Date.now();
        try {
            this.syncEnvironment();
            const preset = this.updateCamera(dt, t);
            const presetKey = this.presetKey;
            this.syncActors(t, now, presetKey, preset);
            this.animateActors(dt, t, now);
            this.syncDevices(t, now, presetKey, preset);
            this.syncCourier(t, now);
            this.updateViewmodel(dt, t);
            if (this.env && this.env.update) this.env.update(dt, t, this.reduced());
            this.fx.update(dt);
            this.camera.updateMatrixWorld();
            this.syncLabels(t, now);
            this.renderer.render(this.scene, this.camera);
            if (this.stage.classList.contains('is-loading')) this.stage.classList.remove('is-loading');
        } catch (err) {
            if (!this.reportedError) {
                this.reportedError = true;
                if (window.console) console.error('3D 場景發生錯誤', err);
            }
        }
    }
}

try {
    window.MushScene3D = {
        create(opts) {
            if (!webglAvailable()) return null;
            return new World(opts);
        }
    };
    window.dispatchEvent(new Event('mush-scene-ready'));
} catch (err) {
    window.dispatchEvent(new Event('mush-scene-failed'));
}
