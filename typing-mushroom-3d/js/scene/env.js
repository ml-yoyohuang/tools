/*!
 * 地區場景：新手木砧板、沸騰大鐵鍋、阿嬤的冰箱
 *
 * 全部以程式產生幾何與畫布貼圖，沒有外部模型或圖片。
 * 白天偏淺藍、淺綠；黑夜偏深藍、深綠，並加上暖色檯燈。
 */
import * as THREE from 'three';

const PALETTE = {
    light: {
        zone_01: { sky: 0xcfe9ee, fog: 0xd8eeee, wall: 0xe9f3ea, tile: 0xcfe3d6, hemiSky: 0xf3fbff, hemiGround: 0xb59a6e, key: 1.25, hemi: 0.95 },
        zone_02: { sky: 0xd9ece6, fog: 0xe6e9df, wall: 0xe5ece4, tile: 0xc9d9cf, hemiSky: 0xfff6ea, hemiGround: 0x8e4a2a, key: 1.2, hemi: 0.9 },
        zone_03: { sky: 0xdff2fa, fog: 0xe4f4fb, wall: 0xf2f9fc, tile: 0xd5e9f2, hemiSky: 0xf1fbff, hemiGround: 0x8cb7cc, key: 1.1, hemi: 1.05 }
    },
    dark: {
        zone_01: { sky: 0x102631, fog: 0x10262e, wall: 0x1c3a3c, tile: 0x173133, hemiSky: 0x6d93b8, hemiGround: 0x2a1f14, key: 0.75, hemi: 0.55 },
        zone_02: { sky: 0x13212a, fog: 0x172126, wall: 0x1f3233, tile: 0x1a2a2b, hemiSky: 0x7a8fb0, hemiGround: 0x3c160a, key: 0.7, hemi: 0.5 },
        zone_03: { sky: 0x0d2433, fog: 0x0f2838, wall: 0x1b3946, tile: 0x15303c, hemiSky: 0x8fb8d8, hemiGround: 0x16303d, key: 0.75, hemi: 0.6 }
    }
};

export function paletteFor(zoneId, theme) {
    const set = PALETTE[theme === 'dark' ? 'dark' : 'light'];
    return set[zoneId] || set.zone_01;
}

function canvasTexture(size, draw, repeat) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    draw(ctx, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    if (repeat) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeat[0], repeat[1]);
    }
    return tex;
}

function woodTexture(dark) {
    return canvasTexture(512, (ctx, s) => {
        ctx.fillStyle = dark ? '#6a4a2c' : '#d7b07a';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 70; i++) {
            const y = Math.random() * s;
            ctx.strokeStyle = dark ? `rgba(30,18,8,${0.15 + Math.random() * 0.2})` : `rgba(140,92,44,${0.12 + Math.random() * 0.22})`;
            ctx.lineWidth = 1 + Math.random() * 3;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= s; x += 32) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 4);
            ctx.stroke();
        }
        for (let k = 0; k < 6; k++) {
            ctx.strokeStyle = dark ? 'rgba(20,12,4,.35)' : 'rgba(120,76,36,.35)';
            ctx.beginPath();
            ctx.ellipse(Math.random() * s, Math.random() * s, 10 + Math.random() * 16, 5 + Math.random() * 6, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        // 刀痕
        ctx.strokeStyle = dark ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.35)';
        for (let c = 0; c < 26; c++) {
            const x = Math.random() * s, y = Math.random() * s, a = Math.random() * Math.PI;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40); ctx.stroke();
        }
    }, [2, 2]);
}

function tileTexture(base, line) {
    return canvasTexture(256, (ctx, s) => {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = line;
        ctx.lineWidth = 6;
        for (let i = 0; i <= 4; i++) {
            ctx.beginPath(); ctx.moveTo(i * s / 4, 0); ctx.lineTo(i * s / 4, s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * s / 4); ctx.lineTo(s, i * s / 4); ctx.stroke();
        }
    }, [6, 3]);
}

function brothTexture(dark) {
    return canvasTexture(256, (ctx, s) => {
        const g = ctx.createRadialGradient(s / 2, s / 2, 10, s / 2, s / 2, s / 2);
        g.addColorStop(0, dark ? '#c86a2a' : '#f2a24a');
        g.addColorStop(1, dark ? '#6a2a10' : '#c0541f');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = `rgba(255,220,140,${0.15 + Math.random() * 0.25})`;
            ctx.beginPath();
            ctx.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 8, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function frostTexture() {
    return canvasTexture(256, (ctx, s) => {
        ctx.fillStyle = '#eaf6fb';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(140,190,215,.5)';
        for (let i = 0; i < 60; i++) {
            const x = Math.random() * s, y = Math.random() * s;
            ctx.lineWidth = 1;
            for (let k = 0; k < 6; k++) {
                const a = k * Math.PI / 3;
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); ctx.stroke();
            }
        }
    }, [3, 3]);
}

let blobTex = null;
export function blobShadowTexture() {
    if (blobTex) return blobTex;
    blobTex = canvasTexture(128, (ctx, s) => {
        const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, 'rgba(0,0,0,.42)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
    });
    return blobTex;
}

function mat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, opts || {}));
}

/** 共同的背景牆與料理台面。 */
function kitchenShell(group, pal, theme, counterColor, counterTop) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 14),
        new THREE.MeshStandardMaterial({ map: tileTexture('#' + new THREE.Color(pal.wall).getHexString(), '#' + new THREE.Color(pal.tile).getHexString()), roughness: 0.95 }));
    wall.position.set(0, 6, -9);
    group.add(wall);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 30), mat(counterColor, { roughness: 0.9 }));
    counter.position.set(0, (counterTop === undefined ? -0.3 : counterTop) - 0.5, -2);
    group.add(counter);
    if (theme === 'dark') {
        // 夜間暖色檯燈
        const lamp = new THREE.PointLight(0xffc98a, 18, 16, 1.6);
        lamp.position.set(-3.5, 5, 1);
        group.add(lamp);
    }
}

function buildCuttingBoard(group, pal, theme) {
    kitchenShell(group, pal, theme, theme === 'dark' ? 0x2b3b3a : 0xbfd3c6);
    const board = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 8.5), mat(0xffffff, { map: woodTexture(theme === 'dark'), roughness: 0.75 }));
    board.position.set(0, -0.15, -0.8);
    group.add(board);
    // 菜刀
    const blade = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.05, 0.9), mat(0xd9e1e8, { metalness: 0.35, roughness: 0.25 }));
    blade.position.set(4.2, 0.04, -3.6);
    blade.rotation.y = 0.5;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.3), mat(0x3a2a1e));
    handle.position.set(5.9, 0.08, -2.7);
    handle.rotation.y = 0.5;
    group.add(blade, handle);
    // 菜渣
    const bitColors = [0x6fbf5a, 0xf07b3c, 0xf1d36a, 0xffffff];
    for (let i = 0; i < 26; i++) {
        const bit = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), mat(bitColors[i % bitColors.length]));
        const edge = Math.random() < 0.5 ? -1 : 1;
        bit.position.set(edge * (3.2 + Math.random() * 2.4), 0.04, -4 + Math.random() * 6);
        bit.rotation.y = Math.random() * 3;
        group.add(bit);
    }
    // 後方調味罐
    const jarColors = [0xe9c46a, 0x2a9d8f, 0xe76f51];
    jarColors.forEach((c, i) => {
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 20), mat(c, { roughness: 0.5 }));
        jar.position.set(-5 + i * 1.2, 0.65, -6.5);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.22, 20), mat(0x6b4f3a));
        lid.position.set(jar.position.x, 1.4, -6.5);
        group.add(jar, lid);
    });
    return { update() {} };
}

function buildIronPot(group, pal, theme) {
    kitchenShell(group, pal, theme, theme === 'dark' ? 0x252d2f : 0x9aa7a6, -1.6);
    // 鍋身與鍋緣：蘑菇站在橫跨鍋口的木鏟上，四周是滾燙的高湯
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.0, 2.4, 56, 1, true), mat(0x2b2f36, { metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide }));
    pot.position.set(0, -0.95, -2.6);
    group.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.22, 12, 72), mat(0x4a525c, { metalness: 0.3, roughness: 0.35 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 0.25, -2.6);
    group.add(rim);
    [-1, 1].forEach((side) => {
        const ear = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.14, 10, 24, Math.PI), mat(0x3d434b, { roughness: 0.4 }));
        ear.position.set(side * 6.9, 0.3, -2.6);
        ear.rotation.set(0, side * Math.PI / 2, -Math.PI / 2);
        group.add(ear);
    });
    const brothMat = new THREE.MeshStandardMaterial({ map: brothTexture(theme === 'dark'), roughness: 0.35, emissive: 0x7a2a08, emissiveIntensity: theme === 'dark' ? 0.55 : 0.25 });
    const broth = new THREE.Mesh(new THREE.CircleGeometry(6.5, 56), brothMat);
    broth.rotation.x = -Math.PI / 2;
    broth.position.set(0, -0.32, -2.6);
    group.add(broth);
    // 蘑菇站的鍋鏟平台
    const spatula = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.25, 4.6), mat(0x9a6634, { roughness: 0.6 }));
    spatula.position.set(0, -0.12, -0.3);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 6), mat(0x7a4a22, { roughness: 0.6 }));
    handle.position.set(0, -0.1, 4.6);
    group.add(spatula, handle);
    // 爐火光
    const glow = new THREE.PointLight(0xff7a2e, theme === 'dark' ? 26 : 12, 14, 1.4);
    glow.position.set(0, 0.6, -4);
    group.add(glow);
    // 冒泡與蒸氣
    const bubbleGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const bubbleMat = mat(0xffc27a, { roughness: 0.2, transparent: true, opacity: 0.85 });
    const bubbles = [];
    for (let i = 0; i < 16; i++) {
        const b = new THREE.Mesh(bubbleGeo, bubbleMat);
        b.userData.phase = Math.random() * 3;
        const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 5;
        b.userData.spot = new THREE.Vector3(Math.cos(a) * r, -0.32, -2.6 + Math.sin(a) * r);
        if (Math.abs(b.userData.spot.x) < 3.8 && b.userData.spot.z > -2.7) b.userData.spot.x = Math.sign(b.userData.spot.x || 1) * (4 + Math.random() * 1.8);
        bubbles.push(b);
        group.add(b);
    }
    const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false });
    const steam = [];
    for (let i = 0; i < 14; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), steamMat.clone());
        puff.userData.phase = Math.random() * 6;
        puff.userData.x = (Math.random() - 0.5) * 11;
        puff.userData.z = -4.5 - Math.random() * 3;
        steam.push(puff);
        group.add(puff);
    }
    return {
        update(dt, t, reduced) {
            if (reduced) return;
            bubbles.forEach((b) => {
                const p = (t * 0.6 + b.userData.phase) % 1.6;
                const s = p < 1 ? p : Math.max(0, 1 - (p - 1) * 4);
                b.position.copy(b.userData.spot);
                b.scale.setScalar(0.4 + s);
            });
            steam.forEach((puff) => {
                const p = (t * 0.12 + puff.userData.phase / 6) % 1;
                puff.position.set(puff.userData.x + Math.sin(t + puff.userData.phase) * 0.4, p * 6, puff.userData.z);
                puff.scale.setScalar(0.6 + p * 1.6);
                puff.material.opacity = 0.22 * (1 - p);
            });
        }
    };
}

function buildFridge(group, pal, theme) {
    const inner = theme === 'dark' ? 0x1e3c4a : 0xeef8fc;
    const shellMat = mat(inner, { roughness: 0.6 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshStandardMaterial({ map: frostTexture(), color: inner, roughness: 0.7 }));
    back.position.set(0, 5, -8);
    group.add(back);
    [-1, 1].forEach((side) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 14, 20), shellMat);
        wall.position.set(side * 9, 5, -2);
        group.add(wall);
    });
    // 玻璃層架（地面）
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 14), new THREE.MeshStandardMaterial({ color: 0xbfe6f5, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
    shelf.position.set(0, -0.1, -1.5);
    group.add(shelf);
    const under = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 14), mat(theme === 'dark' ? 0x12303c : 0xcfe6ef));
    under.position.set(0, -0.6, -1.5);
    group.add(under);
    // 上層架與保鮮盒
    const upper = new THREE.Mesh(new THREE.BoxGeometry(18, 0.15, 5), new THREE.MeshStandardMaterial({ color: 0xcdeefa, transparent: true, opacity: 0.55, roughness: 0.1 }));
    upper.position.set(0, 4.6, -6);
    group.add(upper);
    const boxColors = [0xf4a261, 0x90be6d, 0xf9c74f, 0xa7c7e7];
    boxColors.forEach((c, i) => {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), mat(c, { roughness: 0.4, transparent: true, opacity: 0.9 }));
        box.position.set(-5 + i * 3.2, 5.15, -6);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.3), mat(0xffffff, { roughness: 0.3 }));
        lid.position.set(box.position.x, 5.66, -6);
        group.add(box, lid);
    });
    // 冷光
    const cold = new THREE.PointLight(0xbfe9ff, theme === 'dark' ? 30 : 14, 18, 1.4);
    cold.position.set(0, 7, -2);
    group.add(cold);
    // 霜霧粒子
    const flakeGeo = new THREE.OctahedronGeometry(0.05, 0);
    const flakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    const flakes = [];
    for (let i = 0; i < 60; i++) {
        const f = new THREE.Mesh(flakeGeo, flakeMat);
        f.userData = { x: (Math.random() - 0.5) * 16, z: -7 + Math.random() * 9, phase: Math.random() * 10, speed: 0.15 + Math.random() * 0.25 };
        flakes.push(f);
        group.add(f);
    }
    return {
        update(dt, t, reduced) {
            flakes.forEach((f) => {
                const d = f.userData;
                const y = reduced ? (d.phase % 6) : 6 - ((t * d.speed + d.phase) % 6);
                f.position.set(d.x + (reduced ? 0 : Math.sin(t * 0.5 + d.phase) * 0.3), y, d.z);
            });
        }
    };
}

/** 建立指定地區的環境；回傳 { group, update, palette }。 */
export function buildEnvironment(zoneId, theme) {
    const pal = paletteFor(zoneId, theme);
    const group = new THREE.Group();
    group.name = 'env-' + zoneId;
    let env;
    if (zoneId === 'zone_02') env = buildIronPot(group, pal, theme);
    else if (zoneId === 'zone_03') env = buildFridge(group, pal, theme);
    else env = buildCuttingBoard(group, pal, theme);
    return { group, update: env.update, palette: pal };
}

export function disposeGroup(group) {
    group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            const list = Array.isArray(obj.material) ? obj.material : [obj.material];
            list.forEach((m) => {
                if (m.map && m.map !== blobTex) m.map.dispose();
                m.dispose();
            });
        }
    });
}
