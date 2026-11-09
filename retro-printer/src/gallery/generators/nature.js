// 第 8 批：植物與自然、食物與甜點、海洋。全部是原創造型。
import { TAU, pick, range, circle, ellipse, roundRect, poly, accent, face } from './parts.js';

const detail = o => (o.n > 1 ? o.L(o.n - 1) : o.L(0));
const mid = o => (o.n > 2 ? o.L(1) : o.L(0));
const rotated = (x, a, cx, cy, fn) => { x.save(); x.translate(cx, cy); x.rotate(a); x.translate(-cx, -cy); fn(x); x.restore(); };
const UNIT = ['center', 'repeat', 'grid3', 'badge', 'bigtype'];
const nat = { theme: 'nature', colors: [2, 3], layouts: UNIT };
const food = { theme: 'food', colors: [2, 3], layouts: UNIT };
const sea = { theme: 'ocean', colors: [2, 3], layouts: UNIT };

function star5(x, cx, cy, R, rot = -Math.PI / 2) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, d = i % 2 ? R * 0.45 : R; x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  x.closePath(); x.fill();
}
const steam = (x, xs, y0, h) => { x.lineWidth = 2; for (const sx of xs) { x.beginPath(); x.moveTo(sx, y0); x.bezierCurveTo(sx - 4, y0 - h * 0.35, sx + 4, y0 - h * 0.65, sx, y0 - h); x.stroke(); } };

/* ───────── 植物與自然 ───────── */

// 小花朵紋樣：五瓣花加圓心，滿版散落
export const florals = {
  ...nat, id: 'florals', name: '小碎花', layouts: ['full'],
  draw(o) {
    const { L, r } = o, g = 5, s = 100 / g;
    for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
      const cx = (i + 0.5 + (j % 2) * 0.5) * s + range(r, -3, 3), cy = (j + 0.5) * s + range(r, -3, 3);
      if (cx > 104) continue;
      const pr = range(r, 3, 4.4), petals = L((i + j) % Math.max(1, o.n - 1)), rot = r() * TAU;
      for (let k = 0; k < 5; k++) { const a = rot + k / 5 * TAU; circle(petals, cx + Math.cos(a) * pr, cy + Math.sin(a) * pr, pr * 0.72); }
      circle(detail(o), cx, cy, pr * 0.45);
      if (r() < 0.5) rotated(mid(o) === L(0) ? detail(o) : mid(o), rot, cx, cy, x => ellipse(x, cx + s * 0.38, cy + s * 0.12, 3, 1.4, 0.5));
    }
  }
};

// 太陽、月亮和星星
export const sunmoon = {
  ...nat, id: 'sunmoon', name: '日月星',
  draw(o) {
    const { L, r, cut } = o, sun = L(0), moon = detail(o);
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; poly(sun, [[32 + Math.cos(a - 0.12) * 18, 38 + Math.sin(a - 0.12) * 18], [32 + Math.cos(a) * 27, 38 + Math.sin(a) * 27], [32 + Math.cos(a + 0.12) * 18, 38 + Math.sin(a + 0.12) * 18]]); }
    circle(sun, 32, 38, 17);
    circle(moon, 70, 64, 18);
    cut(moon, x => circle(x, 79, 57, 15));
    const st = mid(o) === sun ? moon : mid(o);
    for (let i = 0; i < 5; i++) star5(st, range(r, 54, 94), range(r, 10, 40), range(r, 2.5, 5), r() * TAU);
    for (let i = 0; i < 4; i++) star5(st, range(r, 8, 40), range(r, 66, 94), range(r, 2.5, 4.5), r() * TAU);
  }
};

// 波浪和山形線條
export const ridges = {
  ...nat, id: 'ridges', name: '山形線條', layouts: ['center', 'full', 'badge'],
  draw(o) {
    const { L, r } = o, rows = 7 + Math.floor(r() * 4), wave = r() < 0.5;
    for (let k = 0; k < rows; k++) {
      const x = L(k % o.n), y0 = 14 + k * (76 / rows), amp = range(r, 4, 9), ph = r() * TAU, period = range(r, 16, 28);
      x.lineWidth = range(r, 1.6, 3.2);
      x.beginPath();
      for (let px = 0; px <= 100; px += 1.5) {
        const t = (px / period + ph) % 1;
        const y = wave ? Math.sin((px / period) * TAU + ph) * amp : (t < 0.5 ? t : 1 - t) * 2 * amp * 2 - amp;
        x[px ? 'lineTo' : 'moveTo'](px, y0 - y);
      }
      x.stroke();
    }
  }
};

// 仙人掌、蘑菇這類可愛的造型
export const cactus = {
  ...nat, id: 'cactus', name: '仙人掌蘑菇',
  draw(o) {
    const { L, r, cut } = o, plant = L(0), d = detail(o), kind = pick(r, ['cactus', 'mushroom']);
    if (kind === 'cactus') {
      roundRect(plant, 40, 18, 20, 64, 10);
      roundRect(plant, 22, 40, 12, 26, 6); plant.fillRect(30, 58, 12, 8);
      roundRect(plant, 66, 30, 12, 26, 6); plant.fillRect(58, 48, 12, 8);
      d.lineWidth = 0.9;
      for (const [x0, y0, x1, y1] of [[50, 24, 50, 76], [28, 46, 28, 62], [72, 36, 72, 52]]) { d.beginPath(); d.moveTo(x0, y0); d.lineTo(x1, y1); d.stroke(); }
      const pot = mid(o) === plant ? d : mid(o);
      poly(pot, [[28, 80], [72, 80], [66, 98], [34, 98]]);
      if (r() < 0.6) { const f = pot === d ? plant : d; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; circle(f, 50 + Math.cos(a) * 3.5, 16 + Math.sin(a) * 3.5, 2.6); } }
      face(o, 50, 52, 9, { blush: false, mouth: 'smile', eyes: pick(r, ['dot', 'happy']) });
    } else {
      const cap = mid(o) === plant ? d : mid(o);
      roundRect(plant, 38, 48, 24, 44, 10);
      cap.beginPath(); cap.arc(50, 52, 34, Math.PI, 0); cap.quadraticCurveTo(50, 60, 16, 52); cap.fill();
      for (const [cx, cy, cr] of [[34, 38, 5], [52, 30, 6.5], [68, 40, 4.5], [44, 46, 3]]) cut(cap, x => circle(x, cx, cy, cr));
      face(o, 50, 72, 10, { blush: true });
      // 底部一排草，印在深色層
      if (o.n > 1) for (let k = 0; k < 9; k++) { const gx = 10 + k * 10 + range(r, -2, 2); poly(d, [[gx - 3, 96], [gx + range(r, -2, 2), range(r, 84, 90)], [gx + 3, 96]]); }
    }
  }
};

/* ───────── 食物與甜點 ───────── */

// 水果切面：西瓜、奇異果、檸檬
export const fruitslice = {
  ...food, id: 'fruitslice', name: '水果切面',
  draw(o) {
    const { L, r, cut } = o, d = detail(o), kind = pick(r, ['watermelon', 'kiwi', 'lemon']);
    if (kind === 'watermelon') {
      const rind = d, flesh = L(0);
      rind.beginPath(); rind.arc(50, 40, 44, 0, Math.PI); rind.closePath(); rind.fill();
      cut(rind, x => { x.beginPath(); x.arc(50, 40, 38, 0, Math.PI); x.closePath(); x.fill(); });
      flesh.beginPath(); flesh.arc(50, 40, 37, 0, Math.PI); flesh.closePath(); flesh.fill();
      const seed = mid(o) === flesh ? d : mid(o);
      for (let k = 0; k < 9; k++) { const a = 0.25 + k / 8 * (Math.PI - 0.5), rr = range(r, 14, 28); ellipse(seed, 50 + Math.cos(a) * rr, 40 + Math.sin(a) * rr, 1.4, 2.4, a); }
    } else if (kind === 'kiwi') {
      circle(d, 50, 50, 42);
      cut(d, x => circle(x, 50, 50, 38));
      circle(L(0), 50, 50, 37);
      const core = mid(o) === L(0) ? d : mid(o);
      cut(L(0), x => ellipse(x, 50, 50, 11, 8));
      for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; ellipse(d, 50 + Math.cos(a) * 15, 50 + Math.sin(a) * 15, 2.4, 1.2, a); }
      if (core !== d) ellipse(core, 50, 50, 10, 7);
    } else {
      circle(d, 50, 50, 42);
      cut(d, x => circle(x, 50, 50, 38));
      const seg = 9;
      for (let i = 0; i < seg; i++) { const a0 = i / seg * TAU + 0.06, a1 = (i + 1) / seg * TAU - 0.06; L(0).beginPath(); L(0).moveTo(50, 50); L(0).arc(50, 50, 34, a0, a1); L(0).closePath(); L(0).fill(); }
      circle(mid(o) === L(0) ? d : mid(o), 50, 50, 4);
    }
  }
};

// 甜點：甜甜圈、冰淇淋甜筒、布丁、草莓蛋糕
export const desserts = {
  ...food, id: 'desserts', name: '甜點',
  draw(o) {
    const { L, r, cut } = o, base = L(0), d = detail(o), top = mid(o) === base ? d : mid(o), kind = pick(r, ['donut', 'icecream', 'pudding', 'cake']);
    if (kind === 'donut') {
      circle(base, 50, 50, 40); cut(base, x => circle(x, 50, 50, 13));
      top.beginPath();
      for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU, rr = 34 + Math.sin(a * 7) * 2.5; top[i ? 'lineTo' : 'moveTo'](50 + Math.cos(a) * rr, 50 + Math.sin(a) * rr); }
      top.closePath(); top.fill(); cut(top, x => circle(x, 50, 50, 17));
      for (let k = 0; k < 16; k++) { const a = r() * TAU, rr = range(r, 21, 31); rotated(d, r() * TAU, 50 + Math.cos(a) * rr, 50 + Math.sin(a) * rr, x => x.fillRect(50 + Math.cos(a) * rr - 2, 50 + Math.sin(a) * rr - 0.7, 4, 1.4)); }
    } else if (kind === 'icecream') {
      poly(base, [[34, 50], [66, 50], [50, 96]]);
      // 甜筒的格紋只畫在甜筒裡
      d.save(); d.beginPath(); d.moveTo(34, 50); d.lineTo(66, 50); d.lineTo(50, 96); d.closePath(); d.clip();
      d.lineWidth = 0.9;
      for (let k = -4; k <= 4; k++) { d.beginPath(); d.moveTo(36 + k * 6, 50); d.lineTo(56 + k * 6, 96); d.moveTo(64 - k * 6, 50); d.lineTo(44 - k * 6, 96); d.stroke(); }
      d.restore();
      circle(top, 50, 40, 18); circle(top, 38, 48, 8); circle(top, 50, 50, 8); circle(top, 62, 48, 8);
      circle(d, 50, 18, 5); d.lineWidth = 1.2; d.beginPath(); d.moveTo(50, 13); d.quadraticCurveTo(54, 6, 58, 8); d.stroke();
    } else if (kind === 'pudding') {
      poly(base, [[28, 88], [72, 88], [64, 38], [36, 38]]);
      top.beginPath(); top.moveTo(36, 38); top.lineTo(64, 38); top.lineTo(65.5, 48);
      for (let k = 0; k <= 4; k++) top.quadraticCurveTo(62 - k * 6, 56, 59 - k * 6, 48 + (k % 2) * 2);
      top.lineTo(34.5, 48); top.closePath(); top.fill();
      ellipse(d, 50, 90, 30, 4);
      circle(d, 50, 32, 5);
    } else {
      roundRect(base, 20, 44, 60, 40, 3);
      top.fillRect(20, 44, 60, 9); top.fillRect(20, 62, 60, 5);
      for (let k = 0; k < 4; k++) { const sx = 28 + k * 15; poly(d, [[sx - 5, 40], [sx + 5, 40], [sx, 30]]); circle(d, sx, 41, 5); }
      cut(base, x => { for (let k = 0; k < 4; k++) circle(x, 30 + k * 13, 76, 1.2); });
    }
  }
};

// 一杯咖啡或茶，冒著熱氣的波浪線
export const cuppa = {
  ...food, id: 'cuppa', name: '咖啡與茶',
  draw(o) {
    const { L, r } = o, cup = L(0), d = detail(o), kind = pick(r, ['mug', 'teacup', 'glass']);
    if (kind === 'mug') {
      roundRect(cup, 22, 34, 46, 54, 6);
      d.lineWidth = 5; d.beginPath(); d.arc(70, 58, 11, -Math.PI / 2, Math.PI / 2); d.stroke();
      const band = mid(o); if (band !== cup) band.fillRect(22, 50, 46, 10);
      steam(d, [34, 46, 58], 28, 20);
    } else if (kind === 'teacup') {
      cup.beginPath(); cup.moveTo(16, 46); cup.lineTo(76, 46); cup.quadraticCurveTo(74, 76, 46, 78); cup.quadraticCurveTo(18, 76, 16, 46); cup.fill();
      ellipse(d, 46, 84, 36, 5);
      d.lineWidth = 4; d.beginPath(); d.arc(78, 56, 8, -Math.PI / 2, Math.PI / 2); d.stroke();
      const tag = mid(o); if (tag !== cup) { tag.lineWidth = 1; tag.beginPath(); tag.moveTo(40, 46); tag.lineTo(30, 62); tag.stroke(); roundRect(tag, 24, 62, 10, 12, 1.5); }
      steam(d, [38, 52], 40, 22);
    } else {
      poly(cup, [[28, 30], [72, 30], [66, 92], [34, 92]]);
      const drink = mid(o) === cup ? d : mid(o);
      poly(drink, [[30, 46], [70, 46], [66, 90], [34, 90]]);
      for (let k = 0; k < 5; k++) roundRect(d, range(r, 36, 58), range(r, 52, 82), 6, 6, 1.5);
      d.lineWidth = 3; d.beginPath(); d.moveTo(56, 92); d.lineTo(64, 14); d.stroke();
    }
  }
};

// 早餐組合：荷包蛋、吐司、牛奶盒
export const breakfast = {
  ...food, id: 'breakfast', name: '早餐', layouts: ['center', 'badge', 'grid3'],
  draw(o) {
    const { L, r } = o, b = L(0), d = detail(o), yolk = mid(o) === b ? d : mid(o);
    // 吐司（左上）與荷包蛋（右下）分開放，同一層才不會黏在一起
    circle(b, 19, 28, 10); circle(b, 35, 28, 10); roundRect(b, 9, 26, 36, 30, 5);
    const ex = 64, ey = 74;
    b.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, rr = 18 + Math.sin(a * 5 + 1) * 2.5; b[i ? 'lineTo' : 'moveTo'](ex + Math.cos(a) * rr, ey + Math.sin(a) * rr * 0.8); }
    b.closePath(); b.fill();
    circle(yolk, ex + 2, ey - 2, 8);
    // 牛奶盒
    poly(d, [[70, 22], [80, 12], [90, 22], [90, 50], [70, 50]]);
    o.cut(d, x => x.fillRect(73, 30, 14, 12));
    d.lineWidth = 1.4; d.beginPath(); d.moveTo(19, 44); d.quadraticCurveTo(27, 50, 35, 44); d.stroke();
  }
};

// 糖果：棒棒糖、包裝糖、軟糖小熊
export const candy = {
  ...food, id: 'candy', name: '糖果',
  draw(o) {
    const { L, r, cut } = o, d = detail(o), kind = pick(r, ['lollipop', 'wrapped', 'gummy']);
    if (kind === 'lollipop') {
      d.lineWidth = 3.4; d.beginPath(); d.moveTo(50, 56); d.lineTo(50, 96); d.stroke();
      circle(L(0), 50, 36, 26);
      const sw = mid(o) === L(0) ? d : mid(o);
      sw.lineWidth = 5; sw.beginPath();
      for (let t = 0; t < 1; t += 0.01) { const a = t * TAU * 3, rr = t * 22; sw.lineTo(50 + Math.cos(a) * rr, 36 + Math.sin(a) * rr); }
      sw.stroke();
    } else if (kind === 'wrapped') {
      const rot = range(r, -0.4, 0.4);
      rotated(L(0), rot, 50, 50, x => { ellipse(x, 50, 50, 22, 15); poly(x, [[30, 50], [10, 36], [14, 50], [10, 64]]); poly(x, [[70, 50], [90, 36], [86, 50], [90, 64]]); });
      rotated(d, rot, 50, 50, x => { x.lineWidth = 4; for (const k of [-10, 0, 10]) { x.beginPath(); x.moveTo(50 + k - 4, 37); x.lineTo(50 + k + 4, 63); x.stroke(); } });
      if (o.n > 2) rotated(L(1), rot, 50, 50, x => { circle(x, 14, 50, 3); circle(x, 86, 50, 3); });   // 兩端的扭結
      cut(L(0), x => rotated(x, rot, 50, 50, c => { c.lineWidth = 1; c.beginPath(); c.moveTo(14, 43); c.lineTo(28, 49); c.moveTo(86, 43); c.lineTo(72, 49); c.stroke(); }));
    } else {
      // 軟糖小熊：圓頭圓耳、圓身體、四隻小手腳
      for (let k = 0; k < 3; k++) {
        const x = L(k % o.n), cx = 22 + k * 28, cy = 52 + (k % 2) * 10;
        circle(x, cx - 6, cy - 22, 4.5); circle(x, cx + 6, cy - 22, 4.5); circle(x, cx, cy - 15, 9);
        ellipse(x, cx, cy + 4, 11, 13); circle(x, cx - 11, cy - 2, 4); circle(x, cx + 11, cy - 2, 4); circle(x, cx - 6, cy + 17, 4.5); circle(x, cx + 6, cy + 17, 4.5);
        cut(x, c => { circle(c, cx - 3, cy - 16, 1.2); circle(c, cx + 3, cy - 16, 1.2); });
      }
    }
  }
};

/* ───────── 海洋 ───────── */

function fish(x, cx, cy, s, dir) {
  x.save(); x.translate(cx, cy); x.scale(dir * s, s);
  x.beginPath(); x.moveTo(-10, 0); x.quadraticCurveTo(0, -9, 10, 0); x.quadraticCurveTo(0, 9, -10, 0); x.fill();
  poly(x, [[-9, 0], [-16, -6], [-16, 6]]);
  x.restore();
}

// 魚群：同一種魚重複排列，其中一條轉向
export const fishschool = {
  ...sea, id: 'fishschool', name: '魚群', layouts: ['center', 'full', 'badge'],
  draw(o) {
    const { L, r, cut } = o, rows = 4, cols = 4, odd = [Math.floor(r() * cols), Math.floor(r() * rows)];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const cx = 16 + i * 23 + (j % 2) * 8, cy = 16 + j * 22, turned = i === odd[0] && j === odd[1];
      const x = turned && o.n > 1 ? detail(o) : L(0);
      fish(x, cx, cy, 0.8, turned ? -1 : 1);
      cut(x, c => circle(c, cx + (turned ? -4.8 : 4.8), cy - 1.2, 1.2));
    }
    if (o.n > 2) for (let k = 0; k < 8; k++) { const bx = range(r, 6, 94), by = range(r, 6, 94); mid(o).lineWidth = 0.8; mid(o).beginPath(); mid(o).arc(bx, by, range(r, 1.2, 2.4), 0, TAU); mid(o).stroke(); }
  }
};

// 貝殼、海星、水母
export const seashore = {
  ...sea, id: 'seashore', name: '貝殼海星水母',
  draw(o) {
    const { L, r, cut } = o, d = detail(o), kind = pick(r, ['shell', 'starfish', 'jelly']);
    if (kind === 'shell') {
      const b = L(0);
      b.beginPath(); b.moveTo(50, 86);
      for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.08 + i / 8 * 0.84); b.lineTo(50 + Math.cos(a) * 40, 70 + Math.sin(a) * 52); }
      b.closePath(); b.fill();
      d.lineWidth = 1.4; for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.08 + i / 8 * 0.84); d.beginPath(); d.moveTo(50, 84); d.lineTo(50 + Math.cos(a) * 36, 70 + Math.sin(a) * 46); d.stroke(); }
      roundRect(mid(o) === b ? d : mid(o), 40, 82, 20, 10, 3);
    } else if (kind === 'starfish') {
      star5(L(0), 50, 54, 42, -Math.PI / 2 + range(r, -0.3, 0.3));
      for (let k = 0; k < 5; k++) for (let t = 1; t <= 3; t++) { const a = -Math.PI / 2 + k / 5 * TAU; circle(d, 50 + Math.cos(a) * t * 9, 54 + Math.sin(a) * t * 9, 1.8); }
      face(o, 50, 54, 10, { blush: false });
      if (o.n > 2) for (const [bx, by, br] of [[84, 18, 4], [90, 30, 2.5], [80, 30, 2]]) { L(1).lineWidth = 1; L(1).beginPath(); L(1).arc(bx, by, br, 0, TAU); L(1).stroke(); }   // 泡泡
    } else {
      const bell = L(0);
      bell.beginPath(); bell.arc(50, 44, 28, Math.PI, 0); bell.quadraticCurveTo(50, 54, 22, 44); bell.fill();
      const t = d;                                              // 觸手印在深色層
      if (o.n > 2) { const m = L(1); for (let k = 0; k < 5; k++) circle(m, 30 + k * 10, 46, 4); }   // 傘緣的花紋
      t.lineWidth = 2;
      for (let k = 0; k < 6; k++) { const x0 = 28 + k * 9; t.beginPath(); t.moveTo(x0, 50); for (let y = 50; y <= 92; y += 2) t.lineTo(x0 + Math.sin(y / 5 + k) * 3, y); t.stroke(); }
      face(o, 50, 36, 12);
    }
  }
};

// 船帆和燈塔
export const lighthouse = {
  ...sea, id: 'lighthouse', name: '燈塔與帆船', layouts: ['center', 'badge'],
  draw(o) {
    const { L, r, cut } = o, d = detail(o), tower = L(0);
    poly(tower, [[24, 88], [44, 88], [40, 30], [28, 30]]);
    const stripes = mid(o) === tower ? d : mid(o);
    for (const y of [42, 60, 78]) stripes.fillRect(25 + (88 - y) * 0.06, y, 18 - (88 - y) * 0.12, 6);
    roundRect(d, 26, 18, 16, 12, 2); poly(d, [[24, 18], [44, 18], [34, 8]]);
    cut(d, x => x.fillRect(29, 21, 10, 6));
    // 光束
    const beam = L(0);
    poly(beam, [[42, 22], [96, 10], [96, 34]]);
    // 帆船
    const bx = range(r, 58, 72);
    poly(d, [[bx - 14, 74], [bx + 16, 74], [bx + 10, 82], [bx - 8, 82]]);
    poly(stripes, [[bx, 44], [bx, 72], [bx + 16, 72]]);
    poly(tower, [[bx - 2, 50], [bx - 2, 72], [bx - 14, 72]]);
    // 海面
    d.lineWidth = 1.6;
    for (let k = 0; k < 2; k++) { d.beginPath(); for (let x = 4; x <= 96; x += 2) d.lineTo(x, 88 + k * 5 + Math.sin(x / 5 + k) * 1.5); d.stroke(); }
  }
};

// 魚鱗或波浪的四方連續紋樣
export const scales = {
  ...sea, id: 'scales', name: '魚鱗波紋', layouts: ['full'],
  draw(o) {
    const { L, r } = o, kind = pick(r, ['scale', 'seigaiha']), s = range(r, 10, 15);
    const cols = Math.ceil(100 / s) + 2;
    for (let j = 0; j < Math.ceil(100 / (s / 2)) + 2; j++) for (let i = -1; i < cols; i++) {
      const cx = i * s + (j % 2) * s / 2, cy = j * s / 2;
      if (kind === 'scale') {
        const x = L((i + j) % o.n);
        x.beginPath(); x.arc(cx, cy, s / 2, 0, Math.PI); x.closePath(); x.fill();
        o.cut(x, c => { c.lineWidth = 0.8; c.beginPath(); c.arc(cx, cy, s / 2 - 1.5, 0.15, Math.PI - 0.15); c.stroke(); });
      } else {
        for (let k = 0; k < 3; k++) {
          const x = L(k % o.n);
          x.beginPath(); x.arc(cx, cy, s * (0.62 - k * 0.18), Math.PI, 0); x.closePath(); x.fill();
          o.cut(x, c => { c.beginPath(); c.arc(cx, cy, s * (0.62 - k * 0.18) - 1.4, Math.PI, 0); c.closePath(); c.fill(); });
        }
      }
    }
  }
};

export const NATURE = [florals, sunmoon, ridges, cactus, fruitslice, desserts, cuppa, breakfast, candy, fishschool, seashore, lighthouse, scales];
