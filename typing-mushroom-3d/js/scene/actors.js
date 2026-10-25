/*!
 * 角色模型：7 種蘑菇、3 隻菇王、8 種設備、外送員與第一人稱湯杓砲
 *
 * 全部為程式產生的低多邊形模型。每個建構函式回傳：
 *  - group：放在場景中的根節點（位置由場景排版決定）
 *  - body：受擊、歪頭、呼吸等動畫作用的節點
 *  - materials：受擊閃光、幸運金光要調整 emissive 的材質
 *  - height：模型頂端高度（名牌錨點）
 */
import * as THREE from 'three';
import { blobShadowTexture } from './env.js';

function mat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.65, metalness: 0 }, opts || {}));
}

function addShadow(group, radius) {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2.4, radius * 2.4),
        new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    shadow.renderOrder = 1;
    group.add(shadow);
    return shadow;
}

/** 可愛臉：兩顆亮眼睛、腮紅與嘴巴，朝向 +z（玩家）。 */
function addFace(parent, y, z, scale, opts) {
    opts = opts || {};
    const face = new THREE.Group();
    const eyeMat = mat(0x1d1a1a, { roughness: 0.3 });
    const shine = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 });
    [-1, 1].forEach((side) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), eyeMat);
        eye.scale.set(1, opts.angry ? 0.8 : 1.25, 0.6);
        eye.position.set(side * 0.16, 0, 0);
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), shine);
        glint.position.set(side * 0.16 + 0.025, 0.035, 0.045);
        face.add(eye, glint);
        if (opts.angry) {
            const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.03), eyeMat);
            brow.position.set(side * 0.16, 0.13, 0.02);
            brow.rotation.z = side * -0.45;     // 內側眉尾下壓＝生氣
            face.add(brow);
        }
        const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), mat(0xff9a9a, { transparent: true, opacity: 0.75 }));
        cheek.position.set(side * 0.27, -0.08, 0.005);
        face.add(cheek);
    });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI), eyeMat);
    mouth.rotation.z = opts.angry ? 0 : Math.PI;
    mouth.position.set(0, opts.angry ? -0.12 : -0.08, 0.01);
    face.add(mouth);
    face.position.set(0, y, z);
    face.scale.setScalar(scale);
    parent.add(face);
    return face;
}

function capGeometry(radius, flat) {
    const geo = new THREE.SphereGeometry(radius, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    geo.scale(1, flat, 1);
    return geo;
}

/* ---------------- 普通蘑菇 ---------------- */

export function buildMushroom(def) {
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    const materials = [];
    // 純金大香菇：沒有環境貼圖時金屬會發黑，改用低金屬度＋金色自發光呈現金光
    const capMat = def.shape === 'gold'
        ? mat(0xf2c94c, { roughness: 0.3, metalness: 0.15, emissive: 0x8a5a00, emissiveIntensity: 0.45 })
        : mat(def.color, { roughness: 0.6, metalness: 0 });
    const stemMat = mat(def.shape === 'chest' ? 0x2b2228 : 0xf6efe2, { roughness: 0.8 });
    materials.push(capMat, stemMat);
    let height = 1.1;
    let radius = 0.55;
    const extras = {};

    if (def.shape === 'slim') {
        // 金針瘦瘦菇：細長身體、小小的頭
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.15, 12), stemMat);
        stem.position.y = 0.575;
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), capMat);
        cap.scale.set(1, 0.75, 1);
        cap.position.y = 1.2;
        body.add(stem, cap);
        addFace(body, 0.82, 0.11, 0.55);
        height = 1.36; radius = 0.25;
    } else if (def.shape === 'chest') {
        // 寶箱松露：圓滾黑松露，綁著金色帶子與鎖頭，長了小腳
        const truffle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), capMat);
        truffle.position.y = 0.66;
        truffle.scale.set(1, 0.9, 1);
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.05, 8, 24), mat(def.accent, { metalness: 0.35, roughness: 0.3 }));
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.66;
        const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.08), mat(def.accent, { metalness: 0.35, roughness: 0.3 }));
        lock.position.set(0, 0.52, 0.52);
        materials.push(band.material);
        [-1, 1].forEach((side) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.22, 8), stemMat);
            leg.position.set(side * 0.22, 0.11, 0);
            body.add(leg);
            (extras.legs = extras.legs || []).push(leg);
        });
        body.add(truffle, band, lock);
        addFace(body, 0.78, 0.5, 0.9);
        height = 1.22; radius = 0.58;
    } else {
        const stemH = def.shape === 'nut' ? 0.5 : 0.62;
        const stemR = def.shape === 'sponge' ? 0.26 : 0.22;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(stemR * 0.9, stemR * 1.15, stemH, 18), stemMat);
        stem.position.y = stemH / 2;
        const capR = def.shape === 'sponge' ? 0.62 : (def.shape === 'nut' ? 0.55 : 0.58);
        const cap = new THREE.Mesh(capGeometry(capR, def.shape === 'nut' ? 0.85 : 0.7), capMat);
        cap.position.y = stemH - 0.04;
        const under = new THREE.Mesh(new THREE.CircleGeometry(capR, 28), mat(def.accent, { side: THREE.DoubleSide }));
        under.rotation.x = Math.PI / 2;
        under.position.y = stemH - 0.04;
        body.add(stem, cap, under);
        addFace(body, stemH * 0.55, stemR * 0.98, 0.75);
        height = stemH + capR * (def.shape === 'nut' ? 0.85 : 0.7);
        radius = capR;

        if (def.shape === 'round') {
            const spotMat = mat(0xffffff, { roughness: 0.5 });
            for (let i = 0; i < 5; i++) {
                const a = i / 5 * Math.PI * 2;
                const spot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), spotMat);
                spot.position.set(Math.cos(a) * 0.36, stemH + 0.22, Math.sin(a) * 0.36);
                spot.scale.y = 0.4;
                body.add(spot);
            }
        } else if (def.shape === 'nut') {
            // 岩殼：帽子上覆蓋石板
            const rockMat = mat(0x6f6458, { roughness: 1, flatShading: true });
            materials.push(rockMat);
            for (let i = 0; i < 9; i++) {
                const a = i / 9 * Math.PI * 2;
                const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), rockMat);
                const ring = i % 2 ? 0.42 : 0.28;
                rock.position.set(Math.cos(a) * ring, stemH + 0.24 + (i % 2 ? 0 : 0.12), Math.sin(a) * ring);
                rock.rotation.set(a, a * 2, 0);
                body.add(rock);
            }
            const top = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), rockMat);
            top.position.y = stemH + 0.44;
            body.add(top);
            extras.rocks = true;
        } else if (def.shape === 'sponge') {
            const poreMat = mat(def.accent, { roughness: 1 });
            for (let i = 0; i < 18; i++) {
                const phi = Math.random() * Math.PI * 0.42;
                const theta = Math.random() * Math.PI * 2;
                const pore = new THREE.Mesh(new THREE.CircleGeometry(0.045 + Math.random() * 0.03, 10), poreMat);
                const p = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi) * 0.7, Math.sin(phi) * Math.sin(theta)).multiplyScalar(capR + 0.005);
                pore.position.set(p.x, stemH - 0.04 + p.y, p.z);
                pore.lookAt(pore.position.clone().multiplyScalar(2));
                body.add(pore);
            }
        } else if (def.shape === 'ice') {
            const crystalMat = mat(0xe8f8ff, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x6fc8f0, emissiveIntensity: 0.35 });
            materials.push(crystalMat);
            for (let i = 0; i < 7; i++) {
                const a = i / 7 * Math.PI * 2;
                const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 6), crystalMat);
                spike.position.set(Math.cos(a) * 0.3, stemH + 0.32, Math.sin(a) * 0.3);
                spike.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
                body.add(spike);
            }
            const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), crystalMat);
            crown.position.y = stemH + 0.52;
            body.add(crown);
            height += 0.2;
            extras.cold = true;
        } else if (def.shape === 'gold') {
            const sparkle = mat(0xfff3b0, { emissive: 0xffd34d, emissiveIntensity: 1 });
            for (let i = 0; i < 4; i++) {
                const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), sparkle);
                s.userData.orbit = i / 4 * Math.PI * 2;
                body.add(s);
                (extras.sparkles = extras.sparkles || []).push(s);
            }
            extras.gold = true;
        }
    }
    const shadow = addShadow(group, radius);
    group.userData.kind = 'mushroom';
    return { group, body, materials, height, radius, shadow, extras };
}

/* ---------------- 菇王 ---------------- */

export function buildBoss(def) {
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    const materials = [];
    const extras = {};
    let height = 3;
    let radius = 1.2;

    if (def.id === 'boss_king') {
        // 巨無霸杏鮑菇：粗壯的柱子
        const stemMat = mat(0xf2e6c8, { roughness: 0.75 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 2.6, 28), stemMat);
        stem.position.y = 1.3;
        const capMat = mat(0x9c7a4a, { roughness: 0.7 });
        const cap = new THREE.Mesh(capGeometry(1.05, 0.55), capMat);
        cap.position.y = 2.55;
        const ridges = mat(0xd9c69c);
        for (let i = 0; i < 10; i++) {
            const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.8, 0.06), ridges);
            const a = i / 10 * Math.PI * 2;
            r.position.set(Math.cos(a) * 0.82, 1.2, Math.sin(a) * 0.82);
            body.add(r);
        }
        body.add(stem, cap);
        materials.push(stemMat, capMat);
        addFace(body, 1.9, 0.83, 2.2, { angry: true });
        height = 3.15; radius = 1.05;
    } else if (def.id === 'boss_tofu') {
        // 絕對防禦百葉豆腐菇：層層豆腐皮身體 + 菇帽，外圍三層護盾
        const skinMat = mat(0xf4ecd6, { roughness: 0.85 });
        for (let i = 0; i < 6; i++) {
            const layer = new THREE.Mesh(new THREE.BoxGeometry(1.7 - i * 0.04, 0.3, 1.5 - i * 0.04), skinMat);
            layer.position.y = 0.17 + i * 0.32;
            layer.rotation.y = (i % 2 ? 0.06 : -0.06);
            body.add(layer);
        }
        const capMat = mat(0xd8cfb4, { roughness: 0.7 });
        const cap = new THREE.Mesh(capGeometry(1.15, 0.6), capMat);
        cap.position.y = 1.95;
        body.add(cap);
        materials.push(skinMat, capMat);
        addFace(body, 1.05, 0.76, 2.1, { angry: true });
        height = 2.75; radius = 1.15;
        extras.shields = [];
        const shieldColors = [0x7fe3ff, 0x9ad7ff, 0xc8b8ff];
        for (let i = 0; i < 3; i++) {
            const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75 + i * 0.28, 1),
                new THREE.MeshStandardMaterial({
                    color: shieldColors[i], transparent: true, opacity: 0.16 + i * 0.03, roughness: 0.2,
                    emissive: shieldColors[i], emissiveIntensity: 0.35, flatShading: true, depthWrite: false, side: THREE.DoubleSide
                }));
            shell.position.y = 1.35;
            const wire = new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry),
                new THREE.LineBasicMaterial({ color: shieldColors[i], transparent: true, opacity: 0.55 }));
            shell.add(wire);
            shell.userData.layerIndex = i;
            group.add(shell);
            extras.shields.push(shell);
        }
    } else {
        // 過期三週的急凍菇：冰封的藍色大菇
        const iceMat = mat(0xaedcf0, { roughness: 0.3, emissive: 0x2a6f95, emissiveIntensity: 0.25 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.6, 24), mat(0xe6f2f6, { roughness: 0.5 }));
        stem.position.y = 0.8;
        const cap = new THREE.Mesh(capGeometry(1.35, 0.62), iceMat);
        cap.position.y = 1.55;
        const crystalMat = mat(0xeaf9ff, { transparent: true, opacity: 0.8, roughness: 0.05, emissive: 0x7fd3ff, emissiveIntensity: 0.5 });
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2;
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7 + (i % 3) * 0.2, 6), crystalMat);
            spike.position.set(Math.cos(a) * 0.9, 2.0, Math.sin(a) * 0.9);
            spike.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
            body.add(spike);
        }
        const block = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.0), mat(0xd7f1fb, { transparent: true, opacity: 0.7, roughness: 0.1 }));
        block.position.y = 0.25;
        body.add(stem, cap, block);
        materials.push(iceMat, crystalMat, stem.material);
        addFace(body, 1.05, 0.56, 1.7, { angry: true });
        height = 2.8; radius = 1.35;
        extras.cold = true;
    }
    const shadow = addShadow(group, radius * 1.1);
    group.userData.kind = 'boss';
    return { group, body, materials, height, radius, shadow, extras };
}

/* ---------------- 設備 ---------------- */

export function buildDevice(def) {
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    const main = mat(def.color, { metalness: 0.35, roughness: 0.45 });
    const accent = mat(def.accent, { metalness: 0.3, roughness: 0.5 });
    const materials = [main, accent];
    const parts = {};
    let height = 0.8;

    switch (def.id) {
        case 'auto_tongs': {
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.12, 16), accent);
            base.position.y = 0.06;
            const hinge = new THREE.Group();
            hinge.position.y = 0.16;
            [-1, 1].forEach((side) => {
                const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.85), main);
                arm.position.set(side * 0.06, 0, -0.42);
                arm.rotation.y = side * 0.12;
                hinge.add(arm);
            });
            hinge.rotation.x = -0.35;
            body.add(base, hinge);
            parts.hinge = hinge;
            height = 0.6;
            break;
        }
        case 'pepper_drone': {
            const shaker = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.42, 16), mat(0xf4f1ea, { roughness: 0.4 }));
            const top = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), main);
            top.position.y = 0.21;
            const pepper = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 16), mat(0x3a302a));
            pepper.position.y = -0.08;
            body.add(shaker, top, pepper);
            parts.rotors = [];
            [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([x, z]) => {
                const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.03), accent);
                arm.position.set(x * 0.17, 0.12, z * 0.17);
                arm.rotation.y = x * z * Math.PI / 4;
                const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.01, 0.04), mat(0x222222));
                rotor.position.set(x * 0.3, 0.15, z * 0.3);
                body.add(arm, rotor);
                parts.rotors.push(rotor);
            });
            body.position.y = 1.15;
            parts.hover = true;
            height = 1.55;
            break;
        }
        case 'garlic_mech': {
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.5), main);
            box.position.y = 0.21;
            const lever = new THREE.Group();
            lever.position.set(0, 0.44, 0.22);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.7), accent);
            arm.position.z = -0.35;
            const garlic = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(0xf7f2e4));
            garlic.position.set(0, 0.5, 0);
            lever.add(arm);
            lever.rotation.x = 0.6;
            body.add(box, lever, garlic);
            parts.lever = lever;
            height = 0.8;
            break;
        }
        case 'tenderizer_array': {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.3), accent);
            frame.position.y = 0.6;
            [-1, 0, 1].forEach((x) => {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), accent);
                post.position.set(x * 0.32, 0.3, 0);
                body.add(post);
            });
            parts.mallets = [];
            [-0.2, 0, 0.2].forEach((x) => {
                const m = new THREE.Group();
                m.position.set(x, 0.58, 0);
                const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), main);
                handle.position.y = -0.2;
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.12), mat(0xc5c9cf, { metalness: 0.35, roughness: 0.3 }));
                head.position.y = -0.42;
                m.add(handle, head);
                body.add(m);
                parts.mallets.push(m);
            });
            body.add(frame);
            height = 0.75;
            break;
        }
        case 'spicy_sprinkler': {
            const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.5, 16), mat(0xd4452f, { roughness: 0.25, transparent: true, opacity: 0.92 }));
            bottle.position.y = 0.25;
            const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.18, 12), main);
            neck.position.y = 0.58;
            const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), mat(0x222222));
            nozzle.position.set(0, 0.7, -0.08);
            nozzle.rotation.x = -1.1;
            body.add(bottle, neck, nozzle);
            height = 0.85;
            break;
        }
        case 'cheer_timer': {
            const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.22, 20), main);
            lower.position.y = 0.11;
            const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.2, 20), mat(0xffffff, { roughness: 0.4 }));
            dial.position.y = 0.32;
            const knob = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 12), accent);
            knob.position.y = 0.5;
            const hand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.2), mat(0xd03a2a));
            hand.position.set(0, 0.43, 0.08);
            body.add(lower, dial, knob, hand);
            parts.dial = dial;
            height = 0.65;
            break;
        }
        case 'induction_field': {
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), main);
            plate.position.y = 0.04;
            const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 24), mat(def.accent, { emissive: def.accent, emissiveIntensity: 1.2 }));
            coil.rotation.x = Math.PI / 2;
            coil.position.y = 0.09;
            body.add(plate, coil);
            parts.coil = coil;
            height = 0.35;
            break;
        }
        case 'orbital_micro': {
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.4), main);
            box.position.y = 0.19;
            const door = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), mat(0x1b2333, { emissive: 0x3b6cff, emissiveIntensity: 0.25 }));
            door.position.set(-0.06, 0.2, 0.201);
            const dish = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), accent);
            dish.position.set(0, 0.52, 0);
            dish.rotation.x = Math.PI;
            const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), accent);
            antenna.position.y = 0.55;
            body.add(box, door, dish, antenna);
            parts.door = door;
            height = 0.8;
            break;
        }
        default: {
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), main);
            box.position.y = 0.25;
            body.add(box);
        }
    }
    // 冰凍外殼：設備被急凍菇凍住時顯示
    const ice = new THREE.Mesh(new THREE.BoxGeometry(0.95, height + 0.25, 0.95),
        new THREE.MeshStandardMaterial({ color: 0xc8f0ff, transparent: true, opacity: 0.55, roughness: 0.05, emissive: 0x6fd0ff, emissiveIntensity: 0.4, depthWrite: false }));
    ice.position.y = (height + 0.25) / 2 - 0.05;
    const iceEdges = new THREE.LineSegments(new THREE.EdgesGeometry(ice.geometry), new THREE.LineBasicMaterial({ color: 0xffffff }));
    ice.add(iceEdges);
    ice.visible = false;
    group.add(ice);
    // 解凍蓄力環
    const holdRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 40, 1, 0, 0.0001),
        new THREE.MeshBasicMaterial({ color: 0xff9a3c, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
    holdRing.rotation.x = -Math.PI / 2;
    holdRing.position.y = 0.03;
    holdRing.visible = false;
    group.add(holdRing);
    addShadow(group, 0.45);
    return { group, body, materials, parts, height, ice, holdRing };
}

/* ---------------- 外送員 ---------------- */

export function buildCourier() {
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.32, 12), mat(0xf6efe2));
    stem.position.y = 0.3;
    const cap = new THREE.Mesh(capGeometry(0.28, 0.7), mat(0xf28b30));
    cap.position.y = 0.44;
    const helmet = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 16), mat(0x2a9d8f));
    helmet.rotation.x = Math.PI / 2;
    helmet.position.y = 0.5;
    addFace(body, 0.3, 0.14, 0.42);
    const legs = [];
    [-1, 1].forEach((side) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.16, 8), mat(0x3a2f2a));
        leg.position.set(side * 0.08, 0.08, 0);
        body.add(leg);
        legs.push(leg);
    });
    // 大便當袋（比外送員本人還大）
    const bag = new THREE.Group();
    const sack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.42), mat(0xd9483b, { roughness: 0.7 }));
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.1, 0.44), mat(0xffffff));
    stripe.position.y = 0.05;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16, Math.PI), mat(0x3a2f2a));
    handle.position.y = 0.25;
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.02), mat(0xffe066, { emissive: 0xffc400, emissiveIntensity: 0.4 }));
    tag.position.set(0, -0.06, 0.225);
    bag.add(sack, stripe, handle, tag);
    bag.position.set(-0.05, 0.86, -0.08);
    bag.rotation.z = 0.12;
    body.add(stem, cap, helmet, bag);
    addShadow(group, 0.4);
    group.userData.courier = true;
    group.traverse((o) => { o.userData.courier = true; });
    return { group, body, legs, bag, height: 1.15 };
}

/* ---------------- 第一人稱湯杓砲 ---------------- */

export function buildViewmodel() {
    const group = new THREE.Group();
    const gun = new THREE.Group();
    group.add(gun);
    const steel = mat(0xd5dde4, { metalness: 0.1, roughness: 0.35 });
    const wood = mat(0x8b5a2b, { roughness: 0.7 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.62, 12), wood);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, -0.02, 0.18);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), steel);
    bowl.position.set(0, 0.02, -0.18);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.36, 16), steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.07, -0.3);
    const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 16), mat(0xf2c14e, { metalness: 0.35, roughness: 0.3 }));
    muzzleRing.position.set(0, 0.07, -0.48);
    const broth = new THREE.Mesh(new THREE.CircleGeometry(0.12, 18), mat(0xf2a24a, { emissive: 0xc0541f, emissiveIntensity: 0.4 }));
    broth.rotation.x = -Math.PI / 2;
    broth.position.set(0, 0.015, -0.18);
    gun.add(handle, bowl, barrel, muzzleRing, broth);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0, depthWrite: false }));
    flash.position.set(0, 0.07, -0.55);
    gun.add(flash);
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0xff7a2e, transparent: true, opacity: 0, depthWrite: false }));
    aura.position.set(0, 0.07, -0.3);
    gun.add(aura);
    return { group, gun, flash, aura, brothMat: broth.material, muzzle: new THREE.Vector3(0, 0.07, -0.55) };
}
