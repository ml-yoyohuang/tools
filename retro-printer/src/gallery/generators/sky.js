// 第 3 批：★ 天空與宇宙（上）。全部是原創造型；明暗用網點層 T(i) 表現。
import { TAU, pick, range, circle, ellipse, roundRect, poly, accent } from './parts.js';

const base = { theme: 'sky', star: true, layouts: ['center', 'repeat', 'grid3', 'badge', 'bigtype'], colors: [2, 3] };

function star4(x, cx, cy, s) {
  poly(x, [[cx, cy - s], [cx + s * 0.28, cy - s * 0.28], [cx + s, cy], [cx + s * 0.28, cy + s * 0.28],
    [cx, cy + s], [cx - s * 0.28, cy + s * 0.28], [cx - s, cy], [cx - s * 0.28, cy - s * 0.28]]);
}
function sprinkle(o, x, r, count, avoid = () => false) {
  for (let i = 0; i < count; i++) {
    const px = range(r, 4, 96), py = range(r, 4, 96);
    if (avoid(px, py)) continue;
    if (r() < 0.35) star4(x, px, py, range(r, 2, 4));
    else circle(x, px, py, range(r, 0.6, 1.3));
  }
}
const detail = o => (o.n > 1 ? o.L(o.n - 1) : o.L(0));

// 行星和光環
export const planet = {
  ...base, id: 'planet', name: '行星',
  draw(o) {
    const { L, T, r, cut } = o, body = L(0), tilt = range(r, -0.5, 0.5), R = range(r, 22, 28);
    circle(body, 50, 50, R);
    // 陰影：一側用網點漸層
    const sh = T(o.n > 2 ? 1 : 0), g = sh.createLinearGradient(50 - R, 0, 50 + R, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
    sh.save(); sh.beginPath(); sh.arc(50, 50, R, 0, TAU); sh.clip(); sh.fillStyle = g; sh.fillRect(0, 0, 100, 100); sh.restore();
    const a = accent(o);
    if (a) {
      a.save(); a.beginPath(); a.arc(50, 50, R, 0, TAU); a.clip();
      a.translate(50, 50); a.rotate(tilt);
      for (const y of [-R * 0.5, -R * 0.05, R * 0.4]) a.fillRect(-R, y, R * 2, R * 0.16);
      a.restore();
    }
    const ring = detail(o);
    ring.save(); ring.translate(50, 50); ring.rotate(tilt);
    ring.lineWidth = 3.5;
    ring.beginPath(); ring.ellipse(0, 0, R * 1.75, R * 0.45, 0, 0, TAU); ring.stroke();
    ring.restore();
    // 光環在行星後面的那一段挖掉
    cut(ring, x => {
      x.save(); x.translate(50, 50); x.rotate(tilt);
      x.beginPath(); x.rect(-60, -60, 120, 60); x.clip();
      x.rotate(-tilt); x.beginPath(); x.arc(0, 0, R + 0.5, 0, TAU); x.fill();
      x.restore();
    });
    if (o.n > 1) sprinkle(o, L(o.n - 1), r, 10, (px, py) => Math.hypot(px - 50, py - 50) < R * 1.9);
  }
};

// 雲朵：蓬鬆的圓弧堆疊
export const clouds = {
  ...base, id: 'clouds', name: '雲朵',
  draw(o) {
    const { L, r } = o, count = Math.max(o.n, 2 + Math.floor(r() * 2));   // 每一層至少一朵
    // 雲朵左右交錯、上下錯開，彼此只稍微重疊
    const rows = count === 2 ? [32, 66] : [24, 50, 76];
    for (let c = 0; c < count; c++) {
      const x = L(c % o.n), w = range(r, 17, 23), cy = rows[c];
      const cx = (c % 2 ? 62 : 38) + range(r, -6, 6);
      const puffs = 3 + Math.floor(r() * 2);
      for (let i = 0; i < puffs; i++) {
        const t = i / (puffs - 1), px = cx - w * 0.8 + t * w * 1.6, rad = w * (0.32 + 0.28 * Math.sin(t * Math.PI));
        circle(x, px, cy - rad * 0.35, rad);
      }
      ellipse(x, cx, cy + w * 0.05, w * 1.15, w * 0.3);
    }
  }
};

// 流星、彗星尾巴
export const meteor = {
  ...base, id: 'meteor', name: '流星',
  draw(o) {
    const { L, T, r } = o, count = 1 + Math.floor(r() * 3), ang = range(r, 0.45, 0.85);
    // 由右上往左下墜落：星頭在左下，尾巴拖向右上
    for (let i = 0; i < count; i++) {
      const s = i === 0 ? 1 : range(r, 0.35, 0.55);
      const hx = i === 0 ? 30 : range(r, 15, 60), hy = i === 0 ? 68 : range(r, 30, 90);
      const len = 72 * s, w = 13 * s;
      const tx = hx + Math.cos(ang) * len, ty = hy - Math.sin(ang) * len;
      // 尾巴：網點漸層，越遠越淡
      const tl = T(0), g = tl.createLinearGradient(hx, hy, tx, ty);
      g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
      tl.fillStyle = g;
      const nx = Math.sin(ang) * w, ny = Math.cos(ang) * w;
      tl.beginPath(); tl.moveTo(hx + nx, hy + ny); tl.lineTo(tx, ty); tl.lineTo(hx - nx, hy - ny); tl.closePath(); tl.fill();
      // 實色的細尾線
      const line = L(Math.min(1, o.n - 1));
      line.lineWidth = 1.4 * s;
      for (const k of [-0.5, 0.5]) { line.beginPath(); line.moveTo(hx + nx * k, hy + ny * k); line.lineTo(hx + nx * k * 0.3 + Math.cos(ang) * len * 0.95, hy + ny * k * 0.3 - Math.sin(ang) * len * 0.95); line.stroke(); }
      star4(detail(o), hx, hy, 12 * s);
    }
  }
};

// 彩虹：2～3 色疊出層次，兩端各有一朵雲
export const rainbow = {
  ...base, id: 'rainbow', name: '彩虹',
  draw(o) {
    const { L, r } = o, bands = o.n + 1, w = 26 / bands;
    for (let i = 0; i < bands; i++) {
      const x = L(i % o.n), R = 42 - i * w * 0.8;
      x.lineWidth = w;
      x.beginPath(); x.arc(50, 70, R, Math.PI, 0); x.stroke();
    }
    const cl = L(0);
    for (const cx of [14, 86]) { circle(cl, cx - 7, 72, 8); circle(cl, cx + 2, 66, 10); circle(cl, cx + 9, 73, 7); roundRect(cl, cx - 14, 70, 30, 9, 4.5); }
    if (r() < 0.5 && o.n > 1) sprinkle(o, L(o.n - 1), r, 6, (px, py) => py > 30);
  }
};

// 月相變化：從新月到滿月排成一排
export const moonphases = {
  ...base, id: 'moonphases', name: '月相', layouts: ['center', 'badge', 'bigtype'],
  draw(o) {
    const { L, r } = o, lit = L(0), dark = o.n > 1 ? L(o.n - 1) : null, R = 9;
    const shifts = [0, 0.55, 1.05, 1.55, 2.2], flip = r() < 0.5;
    // 沿著一道大弧排列：新月在一端，滿月在另一端
    shifts.forEach((_, i) => {
      const s = shifts[flip ? 4 - i : i];
      const th = Math.PI * (1 - (0.09 + 0.82 * i / 4));
      const cx = 50 + Math.cos(th) * 38, cy = 66 - Math.sin(th) * 34;
      if (dark) {
        circle(lit, cx, cy, R);
        // 暗面 = 月面 ∩ 往左錯開的圓
        dark.save(); dark.beginPath(); dark.arc(cx - s * R, cy, R, 0, TAU); dark.clip();
        circle(dark, cx, cy, R); dark.restore();
      } else {
        lit.save(); lit.beginPath(); lit.rect(0, 0, 100, 100); lit.arc(cx - s * R, cy, R, 0, TAU, true); lit.clip('evenodd');
        circle(lit, cx, cy, R); lit.restore();
        lit.lineWidth = 0.8; lit.beginPath(); lit.arc(cx, cy, R, 0, TAU); lit.stroke();
      }
    });
    if (o.n > 2) sprinkle(o, L(1), r, 30, (px, py) => Math.hypot(px - 50, (py - 66) * 38 / 34) > 26 && Math.hypot(px - 50, (py - 66) * 38 / 34) < 50);
  }
};

// 太陽系：行星沿軌道排列，大小和顏色隨機
export const solarsystem = {
  ...base, id: 'solarsystem', name: '太陽系', layouts: ['center', 'badge'],
  draw(o) {
    const { L, r } = o, orbits = 4 + Math.floor(r() * 3), line = detail(o);
    circle(L(0), 50, 50, 9);
    if (o.n > 2) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; poly(L(1), [[50 + Math.cos(a) * 11, 50 + Math.sin(a) * 11], [50 + Math.cos(a + 0.12) * 15, 50 + Math.sin(a + 0.12) * 15], [50 + Math.cos(a + 0.24) * 11, 50 + Math.sin(a + 0.24) * 11]]); }
    for (let k = 0; k < orbits; k++) {
      const R = 18 + k * (30 / orbits);
      line.lineWidth = 0.6;
      line.beginPath(); line.arc(50, 50, R, 0, TAU); line.stroke();
      const a = r() * TAU, pr = range(r, 1.8, 4.2), px = 50 + Math.cos(a) * R, py = 50 + Math.sin(a) * R;
      circle(L(Math.floor(r() * o.n)), px, py, pr);
      if (pr > 3.6) { line.lineWidth = 0.9; line.beginPath(); line.ellipse(px, py, pr * 1.8, pr * 0.5, -0.4, 0, TAU); line.stroke(); }
    }
  }
};

// 火箭升空，底部有雲狀的煙
export const rocket = {
  ...base, id: 'rocket', name: '火箭',
  draw(o) {
    const { L, r, cut } = o, body = L(0), d = detail(o), tilt = range(r, -0.3, 0.3);
    const smoke = o.n > 2 ? L(1) : L(0);
    for (let i = 0; i < 6; i++) circle(smoke, 20 + i * 12 + range(r, -3, 3), 86 + range(r, -4, 4), range(r, 7, 11));
    body.save(); body.translate(50, 50); body.rotate(tilt); body.translate(-50, -50);
    body.beginPath(); body.moveTo(50, 6); body.bezierCurveTo(66, 18, 64, 50, 62, 66); body.lineTo(38, 66); body.bezierCurveTo(36, 50, 34, 18, 50, 6); body.fill();
    body.restore();
    d.save(); d.translate(50, 50); d.rotate(tilt); d.translate(-50, -50);
    poly(d, [[38, 50], [26, 70], [38, 66]]); poly(d, [[62, 50], [74, 70], [62, 66]]); poly(d, [[46, 62], [54, 62], [50, 74]]);
    d.lineWidth = 2.5; d.beginPath(); d.arc(50, 34, 7, 0, TAU); d.stroke();
    d.restore();
    cut(body, x => { x.save(); x.translate(50, 50); x.rotate(tilt); x.translate(-50, -50); circle(x, 50, 34, 5.5); x.restore(); });
    const flame = accent(o);
    if (flame) { flame.save(); flame.translate(50, 50); flame.rotate(tilt); flame.translate(-50, -50); poly(flame, [[42, 68], [58, 68], [50, 84]]); flame.restore(); }
  }
};

// 原創小太空人：圓頭盔，在太空中漂浮
export const astronaut = {
  ...base, id: 'astronaut', name: '小太空人',
  draw(o) {
    const { L, r, cut } = o, suit = L(0), d = detail(o), tilt = range(r, -0.6, 0.6);
    const tr = x => { x.save(); x.translate(50, 50); x.rotate(tilt); x.translate(-50, -50); };
    tr(suit);
    roundRect(suit, 36, 48, 28, 30, 10);                       // 身體
    roundRect(suit, 24, 52, 14, 9, 4.5); roundRect(suit, 62, 46, 14, 9, 4.5);   // 手
    roundRect(suit, 38, 74, 10, 16, 5); roundRect(suit, 52, 74, 10, 14, 5);     // 腳
    circle(suit, 50, 34, 20);                                  // 頭盔
    suit.restore();
    tr(d);
    roundRect(d, 37, 26, 26, 17, 8.5);                         // 面罩
    roundRect(d, 44, 56, 12, 8, 2);                            // 胸前面板
    d.restore();
    cut(d, x => { tr(x); ellipse(x, 44, 31, 3, 1.6, -0.4); x.restore(); });   // 面罩反光
    const a = accent(o);
    if (a) { tr(a); roundRect(a, 26, 40, 8, 26, 3); a.restore(); }   // 背包
    // 安全繩
    if (o.n > 1) { d.lineWidth = 1.2; d.beginPath(); d.moveTo(36, 66); d.bezierCurveTo(10, 70, 20, 96, 4, 92); d.stroke(); }
    if (o.n > 1) sprinkle(o, L(o.n - 1), r, 6, (px, py) => Math.hypot(px - 50, py - 55) < 34);
  }
};

// 飛碟：底部射出光束，下方有小東西被吸上去
export const ufo = {
  ...base, id: 'ufo', name: '飛碟',
  draw(o) {
    const { L, T, r, cut } = o, body = L(0), d = detail(o);
    // 光束：網點漸層，往下越淡
    const beam = T(0), g = beam.createLinearGradient(0, 36, 0, 96);
    g.addColorStop(0, 'rgba(0,0,0,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0.08)');
    beam.fillStyle = g;
    beam.beginPath(); beam.moveTo(42, 36); beam.lineTo(58, 36); beam.lineTo(76, 96); beam.lineTo(24, 96); beam.closePath(); beam.fill();
    const dome = o.n > 2 ? L(1) : body;
    dome.beginPath(); dome.arc(50, 26, 13, Math.PI, 0); dome.closePath(); dome.fill();
    ellipse(body, 50, 30, 34, 9);
    ellipse(d, 50, 33, 22, 4);
    for (let i = 0; i < 5; i++) cut(d, x => circle(x, 34 + i * 8, 33, 1.6));
    // 被吸上去的小東西
    const thing = pick(r, ['cube', 'star', 'cat']), ty = range(r, 64, 80);
    if (thing === 'cube') { d.save(); d.translate(50, ty); d.rotate(0.4); d.fillRect(-5, -5, 10, 10); d.restore(); }
    else if (thing === 'star') star4(d, 50, ty, 6);
    else { circle(d, 50, ty, 5); poly(d, [[45.5, ty - 2], [46.5, ty - 8], [49, ty - 4]]); poly(d, [[54.5, ty - 2], [53.5, ty - 8], [51, ty - 4]]); }
  }
};

export const SKY_A = [planet, clouds, meteor, rainbow, moonphases, solarsystem, rocket, astronaut, ufo];
