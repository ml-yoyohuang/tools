// 第 0 批：原本圖庫的 11 種圖案，改寫成分層產生器。
// 每個產生器在 0..100 的單位方格裡作畫：
//   L(i) 第 i 層（實色），T(i) 第 i 層的網點層（畫透明度表示明暗），n 可用層數，r 亂數，cut 挖空
// 層由淺到深：L(0) 最淺，L(n - 1) 最深，細節放最後一層。

const TAU = Math.PI * 2;

export const leaves = {
  id: 'leaves', name: '葉', theme: 'nature',
  layouts: ['center', 'repeat', 'grid3', 'badge', 'bigtype'], colors: [2, 3],
  draw({ L, n, r }) {
    const count = 3 + Math.floor(r() * 5), spread = 0.6 + r() * 0.8, base = -Math.PI / 2 + (r() - 0.5) * 0.6;
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * spread / count * 2, len = 26 + r() * 18, w = 0.28 + r() * 0.16;
      const x = L(i % Math.max(1, n - 1));
      x.save(); x.translate(50, 92); x.rotate(a + Math.PI / 2);
      x.beginPath(); x.ellipse(0, -len - 6, len * w, len, 0, 0, TAU); x.fill();
      x.restore();
      const v = L(n - 1);
      v.save(); v.translate(50, 92); v.rotate(a + Math.PI / 2);
      v.lineWidth = 1.6;
      v.beginPath(); v.moveTo(0, 0); v.lineTo(0, -len * 1.9); v.stroke();
      v.restore();
    }
  }
};

export const sea = {
  id: 'sea', name: '海', theme: 'nature',
  layouts: ['center'], colors: [2, 3],
  draw({ L, n, r }) {
    const moon = L(n > 2 ? 1 : 0);
    moon.beginPath(); moon.arc(30 + r() * 40, 24 + r() * 10, 11 + r() * 5, 0, TAU); moon.fill();
    const bands = 4 + Math.floor(r() * 3), amp = 2 + r() * 3, wl = 14 + r() * 12;
    for (let b = 0; b < bands; b++) {
      const x = L(b % 2 ? n - 1 : 0), y0 = 52 + b * (48 / bands);
      x.beginPath(); x.moveTo(0, 100);
      for (let px = 0; px <= 100; px += 2) x.lineTo(px, y0 + Math.sin(px / wl * TAU + b) * amp);
      x.lineTo(100, 100); x.fill();
    }
  }
};

export const fruit = {
  id: 'fruit', name: '果', theme: 'food',
  layouts: ['center', 'repeat', 'grid3', 'badge'], colors: [2, 3],
  draw({ L, n, r, cut }) {
    const rind = L(n - 1), flesh = L(0), seg = 7 + Math.floor(r() * 5);
    rind.beginPath(); rind.arc(50, 50, 46, 0, TAU); rind.fill();
    cut(rind, x => { x.beginPath(); x.arc(50, 50, 41, 0, TAU); x.fill(); });
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * TAU + 0.07, a1 = (i + 1) / seg * TAU - 0.07;
      flesh.beginPath(); flesh.moveTo(50, 50); flesh.arc(50, 50, 37, a0, a1); flesh.closePath(); flesh.fill();
    }
    if (n > 2) {
      const s = L(1);
      for (let i = 0; i < seg; i++) {
        const a = (i + 0.5) / seg * TAU;
        s.beginPath(); s.ellipse(50 + Math.cos(a) * 16, 50 + Math.sin(a) * 16, 1.6, 3.2, a, 0, TAU); s.fill();
      }
    }
  }
};

export const waves = {
  id: 'waves', name: '波', theme: 'geometric',
  layouts: ['full'], colors: [2, 3],
  draw({ L, n, r }) {
    const count = 7 + Math.floor(r() * 5), amp = 2 + r() * 4, wl = 16 + r() * 18, w = 2.5 + r() * 2.5;
    for (let i = 0; i < count; i++) {
      const x = L(i % n);
      x.lineWidth = w;
      const y0 = 6 + i * (88 / (count - 1));
      x.beginPath();
      for (let px = 4; px <= 96; px += 1.5) x[px === 4 ? 'moveTo' : 'lineTo'](px, y0 + Math.sin(px / wl * TAU + i * 0.7) * amp);
      x.stroke();
    }
  }
};

export const dots = {
  id: 'dots', name: '點', theme: 'geometric',
  layouts: ['full'], colors: [2, 3],
  draw({ L, n, r }) {
    const g = 6 + Math.floor(r() * 4), step = 88 / g, grow = r() < 0.5, missing = r() * 0.12;
    for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
      if (r() < missing) continue;   // 局部缺幾顆
      const t = grow ? (i + j) / (2 * g - 2) : r();
      const rad = step * (0.12 + 0.3 * t);
      const x = L((i + 2 * j) % n);
      x.beginPath(); x.arc(6 + step * (i + 0.5), 6 + step * (j + 0.5), rad, 0, TAU); x.fill();
    }
  }
};

export const sun = {
  id: 'sun', name: '日', theme: 'sky', star: true,
  layouts: ['center', 'repeat', 'grid3', 'badge', 'bigtype'], colors: [2, 3],
  draw({ L, n, r, cut }) {
    const rays = 12 + Math.floor(r() * 8), ray = L(0), face = L(n - 1);
    for (let i = 0; i < rays; i++) {
      const a = i / rays * TAU, w = Math.PI / rays * 0.55;
      ray.beginPath();
      ray.moveTo(50 + Math.cos(a - w) * 27, 50 + Math.sin(a - w) * 27);
      ray.lineTo(50 + Math.cos(a) * 47, 50 + Math.sin(a) * 47);
      ray.lineTo(50 + Math.cos(a + w) * 27, 50 + Math.sin(a + w) * 27);
      ray.fill();
    }
    face.beginPath(); face.arc(50, 50, 25, 0, TAU); face.fill();
    const wink = r() < 0.3;
    cut(face, x => {
      x.beginPath(); x.arc(41, 46, 2.6, 0, TAU); x.fill();
      if (wink) { x.lineWidth = 2.2; x.beginPath(); x.moveTo(56, 46); x.lineTo(62, 46); x.stroke(); }
      else { x.beginPath(); x.arc(59, 46, 2.6, 0, TAU); x.fill(); }
      x.lineWidth = 2.4; x.beginPath(); x.arc(50, 52, 10, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
    });
    if (n > 2) {
      const c = L(1);
      c.beginPath(); c.arc(36, 56, 4, 0, TAU); c.arc(64, 56, 4, 0, TAU); c.fill();   // 腮紅
    }
  }
};

export const arches = {
  id: 'arches', name: '拱', theme: 'sky', star: true,
  layouts: ['center', 'grid3', 'badge'], colors: [2, 3],
  draw({ L, n, r, cut }) {
    const bands = 3 + Math.floor(r() * 3), w = 34 / bands;
    for (let i = 0; i < bands; i++) {
      const x = L(i % n);
      x.beginPath(); x.arc(50, 80, 46 - i * w, Math.PI, 0); x.lineTo(50 + 46 - (i + 1) * w, 80);
      x.arc(50, 80, 46 - (i + 1) * w, 0, Math.PI, true); x.closePath(); x.fill();
    }
    const g = L(n - 1);
    g.fillRect(2, 80, 96, 3);
  }
};

export const tiles = {
  id: 'tiles', name: '磚', theme: 'geometric',
  layouts: ['full'], colors: [2, 3],
  draw({ L, n, r }) {
    const g = 4 + Math.floor(r() * 3), s = 92 / g;
    for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
      const px = 4 + i * s, py = 4 + j * s, t = Math.floor(r() * 4), x = L((i + j) % n);
      x.beginPath();
      if (t === 0) { x.moveTo(px, py); x.lineTo(px + s, py); x.lineTo(px, py + s); }
      else if (t === 1) { x.moveTo(px + s, py); x.lineTo(px + s, py + s); x.lineTo(px, py + s); }
      else if (t === 2) { x.moveTo(px, py); x.arc(px, py, s, 0, Math.PI / 2); }
      else { x.moveTo(px + s, py + s); x.arc(px + s, py + s, s, Math.PI, Math.PI * 1.5); }
      x.closePath(); x.fill();
    }
  }
};

export const flower = {
  id: 'flower', name: '花', theme: 'nature',
  layouts: ['center', 'repeat', 'grid3', 'badge', 'bigtype'], colors: [2, 3],
  draw({ L, n, r }) {
    const petals = 5 + Math.floor(r() * 4), pr = 13 + r() * 5, stem = L(n - 1), p = L(0);
    stem.lineWidth = 2.6;
    stem.beginPath(); stem.moveTo(50, 52); stem.quadraticCurveTo(46, 76, 52, 98); stem.stroke();
    stem.beginPath(); stem.ellipse(40, 80, 10, 4, -0.6, 0, TAU); stem.ellipse(61, 86, 10, 4, 0.6, 0, TAU); stem.fill();
    for (let i = 0; i < petals; i++) {
      const a = i / petals * TAU - Math.PI / 2;
      p.save(); p.translate(50 + Math.cos(a) * pr, 40 + Math.sin(a) * pr); p.rotate(a);
      p.beginPath(); p.ellipse(0, 0, pr, pr * 0.6, 0, 0, TAU); p.fill();
      p.restore();
    }
    const c = L(n > 2 ? 1 : n - 1);
    c.beginPath(); c.arc(50, 40, pr * 0.7, 0, TAU); c.fill();
  }
};

export const hills = {
  id: 'hills', name: '山', theme: 'sky', star: true,
  layouts: ['center'], colors: [2, 3],
  draw({ L, T, n, r }) {
    // 天空用網點表現漸層
    const sky = T(0), g = sky.createLinearGradient(0, 0, 0, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    sky.fillStyle = g; sky.fillRect(0, 0, 100, 62);
    const sunL = L(n > 2 ? 1 : n - 1);
    sunL.beginPath(); sunL.arc(30 + r() * 40, 30 + r() * 8, 9 + r() * 4, 0, TAU); sunL.fill();
    const far = L(0);
    far.beginPath(); far.moveTo(0, 64);
    let x = 0;
    while (x < 100) { const nx = x + 18 + r() * 20; far.lineTo((x + nx) / 2, 30 + r() * 20); far.lineTo(nx, 60 + r() * 8); x = nx; }
    far.lineTo(100, 100); far.lineTo(0, 100); far.fill();
    const near = L(n - 1);
    near.beginPath(); near.moveTo(0, 82);
    near.quadraticCurveTo(30 + r() * 20, 58 + r() * 10, 60, 80); near.quadraticCurveTo(82, 92, 100, 74);
    near.lineTo(100, 100); near.lineTo(0, 100); near.fill();
  }
};

export const shapes = {
  id: 'shapes', name: '幾何', theme: 'geometric',
  layouts: ['center', 'grid3'], colors: [2, 3],
  draw({ L, n, r }) {
    const a = L(0), b = L(Math.min(1, n - 1)), c = L(n - 1);
    a.beginPath(); a.arc(30 + r() * 20, 34 + r() * 10, 22 + r() * 6, 0, TAU); a.fill();
    b.fillRect(46 + r() * 10, 40 + r() * 10, 36, 42);
    const tx = 12 + r() * 30;
    const t = n > 2 ? L(1) : a;
    t.beginPath(); t.moveTo(tx, 92); t.lineTo(tx + 26, 54); t.lineTo(tx + 52, 92); t.fill();
    c.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(8, 8 + i * 2.6); c.lineTo(92, 8 + i * 2.6); c.stroke(); }
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(56 + i * 5, 50 + j * 5, 0.9, 0, TAU); c.fill(); }
  }
};

export const CLASSIC = [leaves, sea, fruit, waves, dots, sun, arches, tiles, flower, hills, shapes];
