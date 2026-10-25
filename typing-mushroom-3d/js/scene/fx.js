/*!
 * 3D 特效：粒子、投射物、光束、衝擊環
 *
 * 全部使用物件池（InstancedMesh 與預先建立的網格），數量有上限，避免長時間遊玩後變慢。
 * 特效只呈現結果，播放與否都不影響遊戲計算。
 */
import * as THREE from 'three';

const MAX_PARTICLES = 520;
const MAX_COINS = 140;
const MAX_PROJECTILES = 48;

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpEuler = new THREE.Euler();
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

class InstancedPool {
    constructor(scene, geometry, material, max) {
        this.mesh = new THREE.InstancedMesh(geometry, material, max);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.items = [];
        this.max = max;
        for (let i = 0; i < max; i++) {
            this.mesh.setMatrixAt(i, hidden);
            this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
        }
        scene.add(this.mesh);
    }
    spawn(item) {
        if (this.items.length >= this.max) this.items.shift();
        this.items.push(item);
        return item;
    }
    update(dt) {
        const items = this.items;
        let write = 0;
        for (let i = 0; i < items.length; i++) {
            const p = items[i];
            p.age += dt;
            if (p.age >= p.life) continue;
            if (p.update) p.update(p, dt);
            else {
                p.vel.y -= (p.gravity || 0) * dt;
                p.vel.multiplyScalar(1 - (p.drag || 0) * dt);
                p.pos.addScaledVector(p.vel, dt);
                if (p.floor !== undefined && p.pos.y < p.floor) { p.pos.y = p.floor; p.vel.y *= -0.35; p.vel.x *= 0.7; p.vel.z *= 0.7; }
            }
            p.spin = (p.spin || 0) + (p.spinSpeed || 0) * dt;
            const k = 1 - p.age / p.life;
            const size = p.size * (p.shrink === false ? 1 : Math.max(0.05, k));
            tmpEuler.set(p.spin, p.spin * 0.7, 0);
            tmpQuat.setFromEuler(tmpEuler);
            tmpScale.set(size, size * (p.stretch || 1), size);
            tmpMatrix.compose(p.pos, tmpQuat, tmpScale);
            this.mesh.setMatrixAt(write, tmpMatrix);
            this.mesh.setColorAt(write, p.color);
            items[write++] = p;
        }
        items.length = write;
        for (let j = write; j < (this.lastCount || 0); j++) this.mesh.setMatrixAt(j, hidden);
        this.lastCount = write;
        this.mesh.count = Math.max(1, write);
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
}

export class Effects {
    constructor(scene) {
        this.scene = scene;
        this.reduced = false;
        this.particles = new InstancedPool(scene, new THREE.IcosahedronGeometry(1, 0),
            new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_PARTICLES);
        this.coins = new InstancedPool(scene, new THREE.CylinderGeometry(1, 1, 0.25, 14),
            new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.35, roughness: 0.25, emissive: 0x6b4a00, emissiveIntensity: 0.35 }), MAX_COINS);
        this.projectiles = new InstancedPool(scene, new THREE.SphereGeometry(1, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_PROJECTILES);
        this.beams = [];
        this.rings = [];
        for (let i = 0; i < 4; i++) {
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1, 16, 1, true),
                new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
            beam.visible = false;
            scene.add(beam);
            this.beams.push({ mesh: beam, age: 0, life: 0 });
        }
        for (let i = 0; i < 10; i++) {
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48),
                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
            ring.rotation.x = -Math.PI / 2;
            ring.visible = false;
            scene.add(ring);
            this.rings.push({ mesh: ring, age: 0, life: 0 });
        }
    }

    density(n) { return this.reduced ? Math.max(1, Math.ceil(n / 3)) : n; }

    burst(pos, opts) {
        opts = opts || {};
        const count = this.density(opts.count || 12);
        const color = new THREE.Color(opts.color === undefined ? 0xffffff : opts.color);
        const speed = opts.speed || 2.4;
        for (let i = 0; i < count; i++) {
            const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * (opts.up === undefined ? 0.9 : opts.up) + 0.1, Math.random() - 0.5).normalize();
            const c = color.clone();
            if (opts.vary) c.offsetHSL((Math.random() - 0.5) * opts.vary, 0, (Math.random() - 0.5) * 0.15);
            this.particles.spawn({
                pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * (opts.spread || 0.2), (Math.random() - 0.5) * (opts.spread || 0.2), (Math.random() - 0.5) * (opts.spread || 0.2))),
                vel: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.8)),
                age: 0, life: (opts.life || 0.7) * (0.6 + Math.random() * 0.6),
                size: (opts.size || 0.06) * (0.6 + Math.random() * 0.8),
                gravity: opts.gravity === undefined ? 5 : opts.gravity, drag: opts.drag || 0.6,
                color: c, spinSpeed: (Math.random() - 0.5) * 12, floor: opts.floor
            });
        }
    }

    /** 擊敗獎勵：金幣從蘑菇噴出，飛向畫面上方的菇幣計數。 */
    coinFountain(pos, count, rich) {
        const n = this.density(count);
        const gold = new THREE.Color(0xffc93a);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const c = gold.clone().offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.2);
            this.coins.spawn({
                pos: pos.clone().add(new THREE.Vector3(0, 0.2, 0)),
                vel: new THREE.Vector3(Math.cos(a) * (1 + Math.random() * 1.6), 3.5 + Math.random() * (rich ? 4 : 2.5), Math.sin(a) * (1 + Math.random() * 1.6)),
                age: 0, life: 1.0 + Math.random() * 0.5, size: rich ? 0.11 : 0.085, gravity: 9, drag: 0.4,
                color: c, spinSpeed: 10 + Math.random() * 8, shrink: false, floor: 0.02
            });
        }
    }

    /** 投射物：從 from 飛向 to，到達時呼叫 onArrive。 */
    shoot(from, to, opts) {
        opts = opts || {};
        const color = new THREE.Color(opts.color === undefined ? 0xffb347 : opts.color);
        const arc = opts.arc === undefined ? 0.6 : opts.arc;
        const duration = opts.duration || 0.18;
        const start = from.clone();
        const end = to.clone();
        this.projectiles.spawn({
            pos: start.clone(), vel: new THREE.Vector3(), age: 0, life: duration,
            size: opts.size || 0.08, color, shrink: false, stretch: 1,
            update: (p) => {
                const k = Math.min(1, p.age / duration);
                p.pos.lerpVectors(start, end, k);
                p.pos.y += Math.sin(k * Math.PI) * arc;
                if (k >= 0.999 && !p.done) { p.done = true; if (opts.onArrive) opts.onArrive(); }
            }
        });
        if (!this.reduced && opts.trail !== false) {
            // 簡短拖尾
            for (let i = 1; i <= 3; i++) {
                const delay = i * 0.025;
                this.projectiles.spawn({
                    pos: start.clone(), vel: new THREE.Vector3(), age: -delay, life: duration,
                    size: (opts.size || 0.08) * (1 - i * 0.22), color: color.clone().multiplyScalar(0.85), shrink: false,
                    update: (p) => {
                        const k = Math.max(0, Math.min(1, p.age / duration));
                        p.pos.lerpVectors(start, end, k);
                        p.pos.y += Math.sin(k * Math.PI) * arc;
                    }
                });
            }
        }
    }

    beam(pos, color) {
        const slot = this.beams.find((b) => b.age >= b.life) || this.beams[0];
        slot.age = 0;
        slot.life = 0.55;
        slot.mesh.material.color.set(color || 0x8fd3ff);
        slot.mesh.position.set(pos.x, 6, pos.z);
        slot.mesh.scale.set(1, 12, 1);
        slot.mesh.visible = true;
    }

    ring(pos, opts) {
        opts = opts || {};
        const slot = this.rings.find((r) => r.age >= r.life) || this.rings[0];
        slot.age = 0;
        slot.life = opts.life || 0.55;
        slot.from = opts.from || 0.3;
        slot.to = opts.to || 1.8;
        slot.opacity = opts.opacity || 0.8;
        slot.mesh.material.color.set(opts.color === undefined ? 0xffffff : opts.color);
        slot.mesh.position.set(pos.x, (opts.y === undefined ? 0.04 : opts.y), pos.z);
        slot.mesh.rotation.x = opts.vertical ? 0 : -Math.PI / 2;
        slot.mesh.visible = true;
    }

    update(dt) {
        this.particles.update(dt);
        this.coins.update(dt);
        this.projectiles.update(dt);
        this.beams.forEach((b) => {
            if (!b.mesh.visible) return;
            b.age += dt;
            const k = b.age / b.life;
            if (k >= 1) { b.mesh.visible = false; return; }
            b.mesh.material.opacity = 0.75 * (1 - k);
            const w = 1 + Math.sin(k * Math.PI) * 0.6;
            b.mesh.scale.set(w, 12, w);
        });
        this.rings.forEach((r) => {
            if (!r.mesh.visible) return;
            r.age += dt;
            const k = r.age / r.life;
            if (k >= 1) { r.mesh.visible = false; return; }
            const s = r.from + (r.to - r.from) * (1 - Math.pow(1 - k, 2));
            r.mesh.scale.set(s, s, s);
            r.mesh.material.opacity = r.opacity * (1 - k);
        });
    }
}
