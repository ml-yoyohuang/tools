// 第 7 批：幾何、抽象與有機、符號與圖示。全部是原創圖形。
import { TAU, pick, range, circle, ellipse, roundRect, poly, accent } from './parts.js';

const detail = o => (o.n > 1 ? o.L(o.n - 1) : o.L(0));
const rotated = (x, a, cx, cy, fn) => { x.save(); x.translate(cx, cy); x.rotate(a); x.translate(-cx, -cy); fn(x); x.restore(); };
const geo = { theme: 'geometric', colors: [2, 3] };
const abs = { theme: 'abstract', colors: [2, 3] };
const sym = { theme: 'symbols', colors: [2, 3] };

// 平滑閉合曲線（通過一圈點）
function blob(x, cx, cy, R, r, wob = 0.25, k = 7) {
  const pts = [];
  for (let i = 0; i < k; i++) { const a = i / k * TAU, d = R * (1 - wob / 2 + r() * wob); pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); }
  x.beginPath();
  for (let i = 0; i < k; i++) {
    const p0 = pts[(i - 1 + k) % k], p1 = pts[i], p2 = pts[(i + 1) % k], p3 = pts[(i + 2) % k];
    if (i === 0) x.moveTo(p1[0], p1[1]);
    x.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  x.closePath(); x.fill();
}

/* ───────── 幾何 ───────── */

// 粗條紋與格紋：套色重疊處自然變深
export const plaid = {
  ...geo, id: 'plaid', name: '格紋', layouts: ['full'],
  draw(o) {
    const { L, r } = o, check = r() < 0.65, w = range(r, 8, 14), gap = w * range(r, 1.4, 2.4);
    let k = 0;
    for (let y = 2; y < 100; y += gap, k++) L(check ? 0 : k % Math.max(1, o.n - 1)).fillRect(0, y, 100, w);   // 只有條紋時兩色交替
    if (check) for (let x = 2; x < 100; x += gap) L(Math.min(1, o.n - 1)).fillRect(x, 0, w, 100);
    const d = detail(o);
    d.lineWidth = 0.8;
    for (let y = 2 + w / 2; y < 100; y += gap) { d.beginPath(); d.moveTo(0, y); d.lineTo(100, y); d.stroke(); }
    if (check) for (let x = 2 + w / 2; x < 100; x += gap) { d.beginPath(); d.moveTo(x, 0); d.lineTo(x, 100); d.stroke(); }
  }
};

// 同心圓和波紋
export const ripples = {
  ...geo, id: 'ripples', name: '波紋', layouts: ['full', 'center', 'badge'],
  draw(o) {
    const { L, r } = o, centers = 1 + Math.floor(r() * 2);
    for (let c = 0; c < centers; c++) {
      const cx = centers === 1 ? 50 : range(r, 20, 80), cy = centers === 1 ? 50 : range(r, 20, 80);
      const step = range(r, 4, 6.5);
      let k = c;
      for (let R = step; R < 70; R += step, k++) {           // 一圈一圈交替換色
        const x = L(k % o.n);
        x.lineWidth = step * 0.45; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.stroke();
      }
    }
    if (o.n > 2) circle(L(o.n - 1), 50, 50, range(r, 4, 8));
  }
};

// 包浩斯風格的色塊構成：圓、半圓、方塊的拼貼
export const bauhaus = {
  ...geo, id: 'bauhaus', name: '色塊構成', layouts: ['center', 'grid3', 'badge'],
  draw(o) {
    const { L, r } = o, g = pick(r, [2, 3]), s = 96 / g, shift = Math.floor(r() * o.n);
    for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
      // 輪流分配到每一層，確保每一色都用得到
      const x0 = 2 + i * s, y0 = 2 + j * s, x = L((j * g + i + shift) % o.n), rot = Math.floor(r() * 4) * Math.PI / 2;
      rotated(x, rot, x0 + s / 2, y0 + s / 2, c => {
        const kind = pick(r, ['circle', 'half', 'quarter', 'square', 'tri', 'ring']);
        if (kind === 'circle') circle(c, x0 + s / 2, y0 + s / 2, s * 0.42);
        else if (kind === 'half') { c.beginPath(); c.arc(x0 + s / 2, y0 + s, s / 2, Math.PI, 0); c.fill(); }
        else if (kind === 'quarter') { c.beginPath(); c.moveTo(x0, y0 + s); c.arc(x0, y0 + s, s, -Math.PI / 2, 0); c.fill(); }
        else if (kind === 'square') c.fillRect(x0 + s * 0.12, y0 + s * 0.12, s * 0.76, s * 0.76);
        else if (kind === 'tri') poly(c, [[x0, y0 + s], [x0 + s, y0 + s], [x0, y0]]);
        else { c.lineWidth = s * 0.14; c.beginPath(); c.arc(x0 + s / 2, y0 + s / 2, s * 0.32, 0, TAU); c.stroke(); }
      });
    }
    const d = detail(o);
    if (o.n > 1) { d.lineWidth = 1.2; d.beginPath(); d.moveTo(range(r, 4, 96), 0); d.lineTo(range(r, 4, 96), 100); d.stroke(); circle(d, range(r, 10, 90), range(r, 10, 90), 3); }
  }
};

// 復古花磚：對稱的四方連續圖案
export const floortile = {
  ...geo, id: 'floortile', name: '花磚', layouts: ['full'],
  draw(o) {
    const { L, r } = o, g = pick(r, [2, 3]), s = 100 / g;
    const petal = range(r, 0.3, 0.45), dot = range(r, 0.08, 0.14), diamond = r() < 0.5;
    for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
      const cx = (i + 0.5) * s, cy = (j + 0.5) * s;
      // 每一塊花磚：中心花朵 + 四角的四分之一圓（拼起來成為另一朵）
      for (let q = 0; q < 4; q++) {
        const a = q * Math.PI / 2;
        rotated(L(0), a, cx, cy, x => ellipse(x, cx, cy - s * petal * 0.6, s * 0.1, s * petal * 0.55));
        rotated(L(Math.min(1, o.n - 1)), a, cx, cy, x => {
          x.beginPath(); x.arc(cx - s / 2, cy - s / 2, s * 0.24, 0, Math.PI / 2); x.lineTo(cx - s / 2, cy - s / 2); x.fill();
          if (diamond) poly(x, [[cx, cy - s * 0.5], [cx + s * 0.06, cy - s * 0.42], [cx, cy - s * 0.34], [cx - s * 0.06, cy - s * 0.42]]);
        });
      }
      circle(detail(o), cx, cy, s * dot);
    }
    const d = detail(o);
    d.lineWidth = 0.6;
    for (let k = 0; k <= g; k++) { d.beginPath(); d.moveTo(k * s, 0); d.lineTo(k * s, 100); d.moveTo(0, k * s); d.lineTo(100, k * s); d.stroke(); }
  }
};

// 棋盤格加上扭曲變形
export const warpcheck = {
  ...geo, id: 'warpcheck', name: '扭曲棋盤', layouts: ['full', 'badge'],
  draw(o) {
    const { L, r } = o, g = 8 + Math.floor(r() * 4), amp = range(r, 3, 7), fx = range(r, 0.04, 0.09), ph = r() * TAU;
    const warp = (u, v) => [u + Math.sin(v * fx + ph) * amp, v + Math.sin(u * fx * 1.3 + ph) * amp];
    const s = 100 / g;
    for (let j = -1; j <= g; j++) for (let i = -1; i <= g; i++) {
      if ((i + j) % 2) continue;
      const x = L((((i + j) / 2) % o.n + o.n) % o.n);   // 斜向輪流換色
      const pts = [];
      const steps = 6;
      for (let k = 0; k <= steps; k++) pts.push(warp(i * s + k * s / steps, j * s));
      for (let k = 0; k <= steps; k++) pts.push(warp((i + 1) * s, j * s + k * s / steps));
      for (let k = 0; k <= steps; k++) pts.push(warp((i + 1) * s - k * s / steps, (j + 1) * s));
      for (let k = 0; k <= steps; k++) pts.push(warp(i * s, (j + 1) * s - k * s / steps));
      poly(x, pts);
    }
  }
};

/* ───────── 抽象與有機 ───────── */

// 流體色塊：像熔岩燈的不規則形狀
export const lava = {
  ...abs, id: 'lava', name: '流體色塊', layouts: ['center', 'full', 'badge'],
  draw(o) {
    const { L, r } = o, count = 4 + Math.floor(r() * 4);
    for (let i = 0; i < count; i++) {
      const R = i === 0 ? range(r, 26, 34) : range(r, 6, 18);
      blob(L(i % o.n), range(r, 22, 78), range(r, 18, 82), R, r, 0.45, 6 + Math.floor(r() * 3));
    }
  }
};

// 隨機曲線構成的線條畫
export const scribble = {
  ...abs, id: 'scribble', name: '線條畫', layouts: ['center', 'full', 'badge', 'grid3'],
  draw(o) {
    const { L, r } = o;
    for (let k = 0; k < o.n; k++) {
      const x = L(k), pts = [];
      const count = 6 + Math.floor(r() * 5);
      for (let i = 0; i < count; i++) pts.push([range(r, 4, 96), range(r, 4, 96)]);
      x.lineWidth = k === o.n - 1 ? 1.6 : range(r, 5, 9);
      x.beginPath(); x.moveTo(...pts[0]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        x.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      x.stroke();
    }
  }
};

// 碎紙拼貼：隨機多邊形散落，邊緣有撕紙的鋸齒
export const collage = {
  ...abs, id: 'collage', name: '碎紙拼貼', layouts: ['center', 'full', 'badge'],
  draw(o) {
    const { L, r } = o, count = 6 + Math.floor(r() * 5);
    for (let i = 0; i < count; i++) {
      const cx = range(r, 12, 88), cy = range(r, 12, 88), R = range(r, 12, 26), sides = 3 + Math.floor(r() * 3), rot = r() * TAU;
      const pts = [];
      for (let k = 0; k < sides; k++) {
        const a0 = rot + k / sides * TAU, a1 = rot + (k + 1) / sides * TAU;
        const p0 = [cx + Math.cos(a0) * R * range(r, 0.7, 1), cy + Math.sin(a0) * R * range(r, 0.7, 1)];
        const p1 = [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R];
        const torn = r() < 0.5;
        for (let t = 0; t < 1; t += torn ? 0.12 : 1) pts.push([p0[0] + (p1[0] - p0[0]) * t + (torn ? range(r, -1.2, 1.2) : 0), p0[1] + (p1[1] - p0[1]) * t + (torn ? range(r, -1.2, 1.2) : 0)]);
      }
      poly(L(i % o.n), pts);
    }
  }
};

// 迷宮圖案
export const maze = {
  ...abs, id: 'maze', name: '迷宮', layouts: ['full', 'center', 'badge'],
  draw(o) {
    const { L, r } = o, g = 7 + Math.floor(r() * 4), s = 90 / g, ox = 5;
    const seen = new Uint8Array(g * g), walls = { h: new Uint8Array((g + 1) * g).fill(1), v: new Uint8Array((g + 1) * g).fill(1) };
    // 深度優先走訪（不用遞迴）
    const stack = [[0, 0]]; seen[0] = 1;
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const a = i + dx, b = j + dy; return a >= 0 && b >= 0 && a < g && b < g && !seen[b * g + a]; });
      if (!nb.length) { stack.pop(); continue; }
      const [dx, dy] = nb[Math.floor(r() * nb.length)];
      if (dx === 1) walls.v[j * (g + 1) + i + 1] = 0; if (dx === -1) walls.v[j * (g + 1) + i] = 0;
      if (dy === 1) walls.h[(j + 1) * g + i] = 0; if (dy === -1) walls.h[j * g + i] = 0;
      seen[(j + dy) * g + i + dx] = 1; stack.push([i + dx, j + dy]);
    }
    walls.v[0] = 0; walls.v[(g - 1) * (g + 1) + g] = 0;            // 入口與出口
    if (o.n > 2) L(0).fillRect(ox, ox, g * s, g * s);         // 三色：迷宮底色
    if (o.n > 1) for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) if (r() < 0.18) L(o.n > 2 ? 1 : 0).fillRect(ox + i * s + 1, ox + j * s + 1, s - 2, s - 2);
    const d = detail(o);
    d.lineWidth = s * 0.22; d.lineCap = 'square';
    for (let j = 0; j <= g; j++) for (let i = 0; i < g; i++) if (walls.h[j * g + i]) { d.beginPath(); d.moveTo(ox + i * s, ox + j * s); d.lineTo(ox + (i + 1) * s, ox + j * s); d.stroke(); }
    for (let j = 0; j < g; j++) for (let i = 0; i <= g; i++) if (walls.v[j * (g + 1) + i]) { d.beginPath(); d.moveTo(ox + i * s, ox + j * s); d.lineTo(ox + i * s, ox + (j + 1) * s); d.stroke(); }
  }
};

// 指紋般的同心曲線
export const fingerprint = {
  ...abs, id: 'fingerprint', name: '指紋', layouts: ['center', 'full', 'badge'],
  draw(o) {
    const { L, r } = o, d = detail(o), cx = range(r, 44, 56), cy = range(r, 46, 58), rot = range(r, -0.5, 0.5);
    if (o.n > 1) blob(L(0), 50, 52, 40, r, 0.15, 8);
    d.lineWidth = 1.5;
    for (let k = 1; k < 16; k++) {
      const rx = k * 2.7, ry = k * 3.3, gapA = r() * TAU, gapW = r() < 0.4 ? range(r, 0.3, 0.8) : 0;
      d.save(); d.translate(cx, cy); d.rotate(rot);
      d.beginPath();
      for (let a = gapA + gapW; a <= gapA + TAU; a += 0.05) {
        const wob = 1 + Math.sin(a * 3 + k) * 0.04;
        d.lineTo(Math.cos(a) * rx * wob, Math.sin(a) * ry * wob - (a > Math.PI ? k * 0.3 : 0));
      }
      d.stroke(); d.restore();
    }
    const a = accent(o);
    if (a) for (let i = 0; i < 5; i++) circle(a, range(r, 20, 80), range(r, 20, 84), range(r, 2, 4));
  }
};

/* ───────── 符號與圖示 ───────── */

function heart(x, cx, cy, s) {
  x.beginPath(); x.moveTo(cx, cy + s * 0.9);
  x.bezierCurveTo(cx - s * 1.3, cy, cx - s * 0.7, cy - s * 0.95, cx, cy - s * 0.35);
  x.bezierCurveTo(cx + s * 0.7, cy - s * 0.95, cx + s * 1.3, cy, cx, cy + s * 0.9);
  x.fill();
}
function bolt(x, cx, cy, s) { poly(x, [[cx + s * 0.2, cy - s], [cx - s * 0.5, cy + s * 0.1], [cx - s * 0.05, cy + s * 0.1], [cx - s * 0.25, cy + s], [cx + s * 0.5, cy - s * 0.15], [cx + s * 0.05, cy - s * 0.15]]); }
function star5(x, cx, cy, R) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? R * 0.45 : R; x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  x.closePath(); x.fill();
}

// 愛心、閃電、星星的大集合
export const symbols = {
  ...sym, id: 'symbols', name: '愛心閃電星星', layouts: ['center', 'full', 'badge'],
  draw(o) {
    const { L, r } = o, g = 4, s = 100 / g;
    for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
      const cx = (i + 0.5) * s + range(r, -3, 3), cy = (j + 0.5) * s + range(r, -3, 3), k = Math.floor(r() * 3), x = L((i + j * 2 + k) % o.n);
      rotated(x, range(r, -0.4, 0.4), cx, cy, c => [heart, bolt, star5][k](c, cx, cy, s * range(r, 0.26, 0.36)));
    }
  }
};

// 箭頭構成的圖案
export const arrows = {
  ...sym, id: 'arrows', name: '箭頭', layouts: ['full', 'center', 'badge'],
  draw(o) {
    const { L, r } = o, g = pick(r, [4, 5, 6]), s = 100 / g, mode = pick(r, ['flow', 'turn', 'random']), ph = r() * TAU;
    for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
      const cx = (i + 0.5) * s, cy = (j + 0.5) * s;
      const a = mode === 'flow' ? Math.sin(i * 0.6 + ph) * 0.8 + Math.cos(j * 0.5) * 0.6 : mode === 'turn' ? (i + j) * Math.PI / 4 : Math.floor(r() * 4) * Math.PI / 2;
      rotated(L((i + j) % o.n), a, cx, cy, x => {
        const l = s * 0.36, w = s * 0.1;
        x.fillRect(cx - l, cy - w / 2, l * 1.3, w);
        poly(x, [[cx + l * 0.2, cy - s * 0.2], [cx + l, cy], [cx + l * 0.2, cy + s * 0.2]]);
      });
    }
  }
};

// 眼睛圖騰：一隻大眼，或滿版小眼睛
function eye(o, x0, cx, cy, w, look) {
  const { cut } = o, lid = x0, d = detail(o);
  lid.beginPath(); lid.moveTo(cx - w, cy); lid.quadraticCurveTo(cx, cy - w * 0.95, cx + w, cy); lid.quadraticCurveTo(cx, cy + w * 0.95, cx - w, cy); lid.fill();
  const iris = o.n > 2 ? o.L(1) : null;
  if (iris) circle(iris, cx + look[0] * w * 0.2, cy + look[1] * w * 0.1, w * 0.42);
  circle(d === lid ? lid : d, cx + look[0] * w * 0.2, cy + look[1] * w * 0.1, w * 0.2);
  cut(d, c => circle(c, cx + look[0] * w * 0.2 - w * 0.07, cy - w * 0.07, w * 0.06));
  if (d !== lid) { d.lineWidth = w * 0.06; for (let k = -2; k <= 2; k++) { const a = -Math.PI / 2 + k * 0.32; d.beginPath(); d.moveTo(cx + Math.cos(a) * w * 0.5, cy - w * 0.42 + Math.sin(a) * 0.1); d.lineTo(cx + Math.cos(a) * w * 0.68, cy - w * 0.6 + Math.sin(a) * w * 0.12); d.stroke(); } }
}
export const eyes = {
  ...sym, id: 'eyes', name: '眼睛圖騰', layouts: ['center', 'full', 'badge', 'grid3'],
  draw(o) {
    const { L, r } = o, many = r() < 0.5;
    if (!many) {
      eye(o, L(0), 50, 54, 40, [range(r, -1, 1), range(r, -1, 1)]);
    } else {
      for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) eye(o, L(0), 18 + i * 32 + (j % 2) * 14 - 7, 14 + j * 24, 12, [range(r, -1, 1), range(r, -1, 1)]);
    }
  }
};

// 手勢：比讚、OK、揮手，用簡單的幾何形呈現
export const hands = {
  ...sym, id: 'hands', name: '手勢', layouts: ['center', 'grid3', 'badge'],
  draw(o) {
    const { L, r } = o, palm = L(0), d = detail(o), kind = pick(r, ['thumb', 'ok', 'wave']);
    const cuff = d;                                             // 袖口印在深色層
    // 三色時，中間層加幾顆小閃光
    if (o.n > 2) {
      const sp = L(1);
      for (const [sx, sy, s] of [[16, 24, 5], [84, 30, 6], [82, 66, 4]]) {
        poly(sp, [[sx, sy - s], [sx + s * 0.25, sy - s * 0.25], [sx + s, sy], [sx + s * 0.25, sy + s * 0.25], [sx, sy + s], [sx - s * 0.25, sy + s * 0.25], [sx - s, sy], [sx - s * 0.25, sy - s * 0.25]]);
      }
    }
    if (kind === 'thumb') {
      roundRect(palm, 30, 42, 38, 36, 9);
      roundRect(palm, 36, 14, 13, 34, 6.5);                    // 豎起的大拇指
      d.lineWidth = 1.4; for (let k = 0; k < 3; k++) { d.beginPath(); d.moveTo(52, 52 + k * 8); d.lineTo(66, 52 + k * 8); d.stroke(); }
      roundRect(cuff, 32, 78, 34, 12, 3);
    } else if (kind === 'ok') {
      roundRect(palm, 32, 46, 36, 34, 10);
      for (let k = 0; k < 3; k++) roundRect(palm, 46 + k * 8, 14 + k * 2, 7, 36, 3.5);
      palm.lineWidth = 7; palm.beginPath(); palm.arc(36, 46, 9, 0, TAU); palm.stroke();
      d.lineWidth = 1.2; for (let k = 1; k < 3; k++) { d.beginPath(); d.moveTo(45.5 + k * 8, 44); d.lineTo(45.5 + k * 8, 56); d.stroke(); }   // 指縫
      roundRect(cuff, 34, 80, 32, 12, 3);
    } else {
      rotated(palm, range(r, -0.35, -0.1), 50, 70, x => {
        roundRect(x, 30, 44, 40, 36, 10);
        for (let k = 0; k < 4; k++) roundRect(x, 31 + k * 10, 14 + Math.abs(k - 1.5) * 3, 8, 34, 4);
        roundRect(x, 18, 52, 26, 9, 4.5);
      });
      d.lineWidth = 1.8;
      for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { d.beginPath(); d.arc(50, 40, 40 + k * 7, s > 0 ? -0.5 : Math.PI - 0.2, s > 0 ? -0.2 : Math.PI + 0.1); d.stroke(); }
      roundRect(cuff, 32, 80, 34, 12, 3);
    }
  }
};

export const PATTERNS = [plaid, ripples, bauhaus, floortile, warpcheck, lava, scribble, collage, maze, fingerprint, symbols, arrows, eyes, hands];
