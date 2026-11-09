// 第 6 批：★ 音樂與娛樂（下）。全部是原創造型；牌面與數字都是虛構的，不出現任何品牌。
import { TAU, pick, range, circle, ellipse, roundRect, poly, accent } from './parts.js';

const base = { theme: 'music', star: true, layouts: ['center', 'repeat', 'grid3', 'badge', 'bigtype'], colors: [2, 3] };
const detail = o => (o.n > 1 ? o.L(o.n - 1) : o.L(0));
const mid = o => (o.n > 2 ? o.L(1) : o.L(0));
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const rotated = (x, a, cx, cy, fn) => { x.save(); x.translate(cx, cy); x.rotate(a); x.translate(-cx, -cy); fn(x); x.restore(); };

// 撲克牌花色（原創的簡單幾何造型）
export function suit(x, kind, cx, cy, s) {
  if (kind === 'heart') {
    x.beginPath(); x.arc(cx - s * 0.5, cy - s * 0.2, s * 0.55, Math.PI, 0); x.arc(cx + s * 0.5, cy - s * 0.2, s * 0.55, Math.PI, 0);
    x.lineTo(cx, cy + s); x.closePath(); x.fill();
  } else if (kind === 'diamond') poly(x, [[cx, cy - s], [cx + s * 0.75, cy], [cx, cy + s], [cx - s * 0.75, cy]]);
  else if (kind === 'spade') {
    x.beginPath(); x.moveTo(cx, cy - s); x.lineTo(cx + s, cy + s * 0.15); x.arc(cx + s * 0.5, cy + s * 0.15, s * 0.5, 0, Math.PI);
    x.arc(cx - s * 0.5, cy + s * 0.15, s * 0.5, 0, Math.PI); x.closePath(); x.fill();
    poly(x, [[cx, cy + s * 0.2], [cx + s * 0.35, cy + s], [cx - s * 0.35, cy + s]]);
  } else {
    circle(x, cx, cy - s * 0.45, s * 0.42); circle(x, cx - s * 0.48, cy + s * 0.12, s * 0.42); circle(x, cx + s * 0.48, cy + s * 0.12, s * 0.42);
    poly(x, [[cx, cy], [cx + s * 0.3, cy + s], [cx - s * 0.3, cy + s]]);
  }
}
const SUITS = ['heart', 'diamond', 'spade', 'club'];

// 等化器：高低不一的長條排列
export const equalizer = {
  ...base, id: 'equalizer', name: '等化器',
  draw(o) {
    const { L, r } = o, bars = 8 + Math.floor(r() * 5), w = 90 / bars, ph = r() * TAU, seg = 4.2;
    const top = o.n > 1 ? detail(o) : L(0), body = L(0), m = accent(o);
    for (let i = 0; i < bars; i++) {
      const h = 18 + Math.abs(Math.sin(i * 0.7 + ph)) * 50 + range(r, -6, 6), x = 5 + i * w;
      const blocks = Math.floor(h / seg);
      for (let k = 0; k < blocks; k++) {
        const y = 90 - (k + 1) * seg;
        const layer = k === blocks - 1 ? top : (m && k > blocks * 0.6 ? m : body);
        layer.fillRect(x + 0.6, y + 0.6, w - 1.2, seg - 1.2);
      }
    }
    top.fillRect(4, 91, 92, 1.2);
  }
};

// 音波：一條起伏的聲波線，或鏡像的長條聲紋
export const soundwave = {
  ...base, id: 'soundwave', name: '音波', layouts: ['center', 'badge', 'grid3', 'full'],
  draw(o) {
    const { L, r } = o, kind = r() < 0.5 ? 'line' : 'bars', ph = r() * TAU;
    const env = x => Math.sin(Math.PI * x / 100) ** 0.7;
    if (kind === 'line') {
      for (let k = 0; k < o.n; k++) {
        const x = L(k);
        x.lineWidth = k === o.n - 1 ? 2.4 : 1.6;
        x.beginPath();
        for (let px = 0; px <= 100; px += 0.8) {
          const y = 50 + Math.sin(px * (0.35 + k * 0.08) + ph + k) * 30 * env(px) * Math.sin(px * 0.06 + k);
          x[px ? 'lineTo' : 'moveTo'](px, y);
        }
        x.stroke();
      }
    } else {
      const count = 34, w = 100 / count;
      for (let i = 0; i < count; i++) {
        const h = (6 + Math.abs(Math.sin(i * 0.5 + ph) * Math.cos(i * 0.21)) * 34) * env(i * w + w / 2) + 2;
        roundRect(L(i % o.n), i * w + 0.5, 50 - h, w - 1, h * 2, (w - 1) / 2);
      }
    }
  }
};

// 節拍器
export const metronome = {
  ...base, id: 'metronome', name: '節拍器',
  draw(o) {
    const { L, r, cut } = o, body = L(0), d = detail(o), swing = range(r, -0.45, 0.45);
    poly(body, [[38, 10], [62, 10], [80, 88], [20, 88]]);
    cut(body, x => poly(x, [[44, 18], [56, 18], [62, 62], [38, 62]]));
    d.lineWidth = 0.8;
    for (let k = 0; k < 8; k++) { const y = 22 + k * 5; d.beginPath(); d.moveTo(49, y); d.lineTo(51, y); d.stroke(); }
    roundRect(d, 16, 86, 68, 7, 2);
    rotated(d, swing, 50, 70, x => { x.lineWidth = 2; x.beginPath(); x.moveTo(50, 70); x.lineTo(50, 14); x.stroke(); });
    const w = mid(o);
    rotated(w === body ? d : w, swing, 50, 70, x => roundRect(x, 45, 30, 10, 7, 2));
    roundRect(d, 36, 70, 28, 8, 2);
  }
};

// 遊戲手把：按鈕以圓形和十字構成
export const gamepad = {
  ...base, id: 'gamepad', name: '遊戲手把',
  draw(o) {
    const { L, r } = o, body = L(0), d = detail(o), btn = mid(o) === body ? d : mid(o), tilt = range(r, -0.15, 0.15);
    rotated(body, tilt, 50, 50, x => {
      roundRect(x, 12, 30, 76, 34, 17);
      circle(x, 24, 60, 14); circle(x, 76, 60, 14);
    });
    rotated(d, tilt, 50, 50, x => { x.fillRect(19, 40, 6, 18); x.fillRect(13, 46, 18, 6); roundRect(x, 42, 42, 6, 3, 1.5); roundRect(x, 52, 42, 6, 3, 1.5); });
    rotated(btn, tilt, 50, 50, x => { circle(x, 76, 40, 3.6); circle(x, 84, 48, 3.6); circle(x, 68, 48, 3.6); circle(x, 76, 56, 3.6); });
    if (r() < 0.5) { d.lineWidth = 1.4; d.beginPath(); d.moveTo(50, 32); d.bezierCurveTo(50, 18, 70, 18, 72, 4); d.stroke(); }
  }
};

// 遊樂園：摩天輪、旋轉木馬或雲霄飛車的軌道線條
export const funfair = {
  ...base, id: 'funfair', name: '遊樂園', layouts: ['center', 'badge'],
  draw(o) {
    const { L, r, cut } = o, d = detail(o), kind = pick(r, ['wheel', 'carousel', 'coaster']), m = mid(o);
    if (kind === 'wheel') {
      const R = 34, cars = 8, rot = r() * TAU;
      d.lineWidth = 2; d.beginPath(); d.arc(50, 44, R, 0, TAU); d.stroke();
      d.lineWidth = 0.8;
      for (let i = 0; i < cars; i++) { const a = rot + i / cars * TAU; d.beginPath(); d.moveTo(50, 44); d.lineTo(50 + Math.cos(a) * R, 44 + Math.sin(a) * R); d.stroke(); }
      d.lineWidth = 2.4; d.beginPath(); d.moveTo(50, 44); d.lineTo(34, 94); d.moveTo(50, 44); d.lineTo(66, 94); d.stroke();
      for (let i = 0; i < cars; i++) { const a = rot + i / cars * TAU; roundRect(L(i % o.n), 50 + Math.cos(a) * R - 4.5, 44 + Math.sin(a) * R, 9, 8, 3); }
      circle(d, 50, 44, 3);
    } else if (kind === 'carousel') {
      const roof = L(0);
      poly(roof, [[50, 8], [88, 34], [12, 34]]);
      for (let i = 0; i < 6; i++) cut(roof, x => { x.beginPath(); x.arc(18 + i * 12.8, 34, 6.4, 0, Math.PI); x.fill(); });
      circle(d, 50, 8, 2.4);
      d.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) { const px = 22 + i * 18.6; d.beginPath(); d.moveTo(px, 36); d.lineTo(px, 84); d.stroke(); }
      roundRect(d, 10, 84, 80, 6, 2);
      for (let i = 0; i < 4; i++) { const px = 22 + i * 18.6, py = 54 + (i % 2) * 10; ellipse(m === roof ? d : m, px, py, 7, 4); poly(m === roof ? d : m, [[px + 5, py - 2], [px + 9, py - 9], [px + 9, py - 1]]); }
    } else {
      const track = d, ph = r() * TAU;
      const y = x => 56 + Math.sin(x / 14 + ph) * 22 + Math.sin(x / 6) * 3;
      // 軌道下方的山丘印在淺色層
      const hill = L(0);
      hill.beginPath(); hill.moveTo(0, 100);
      for (let x = 0; x <= 100; x += 2) hill.lineTo(x, Math.max(y(x) + 14, 70 + Math.sin(x / 9) * 6));
      hill.lineTo(100, 100); hill.closePath(); hill.fill();
      track.lineWidth = 2;
      for (const off of [0, 4]) { track.beginPath(); for (let x = 0; x <= 100; x += 1) track[x ? 'lineTo' : 'moveTo'](x, y(x) + off); track.stroke(); }
      track.lineWidth = 1;
      for (let x = 4; x < 100; x += 8) { track.beginPath(); track.moveTo(x, y(x) + 4); track.lineTo(x, 96); track.stroke(); }
      const cx = range(r, 20, 70);
      for (let k = 0; k < 3; k++) roundRect(mid(o) === L(0) ? d : mid(o), cx + k * 8, y(cx + k * 8) - 7, 7, 6, 2);
    }
  }
};

// 派對：彩帶、紙花、拉炮
export const party = {
  ...base, id: 'party', name: '派對', layouts: ['center', 'badge', 'full'],
  draw(o) {
    const { L, r } = o, d = detail(o);
    // 拉炮：尖端朝左下，寬口朝右上，對著噴出來的彩帶與紙花
    rotated(L(0), 0.6, 26, 78, x => poly(x, [[17, 58], [35, 58], [26, 98]]));
    rotated(d, 0.6, 26, 78, x => {
      x.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) { const y = 66 + k * 9, hw = 9 * (1 - (y - 58) / 40); x.beginPath(); x.moveTo(26 - hw, y); x.lineTo(26 + hw, y); x.stroke(); }
    });
    // 彩帶
    for (let i = 0; i < 5; i++) {
      const x = L(i % o.n), x0 = 40 + range(r, -6, 6), y0 = 56 + range(r, -6, 6), a = -Math.PI / 2 + range(r, -1, 1);
      x.lineWidth = 1.6; x.beginPath(); x.moveTo(x0, y0);
      for (let t = 0; t <= 1; t += 0.05) { const len = t * 40; x.lineTo(x0 + Math.cos(a) * len + Math.sin(t * 18) * 3, y0 + Math.sin(a) * len + Math.cos(t * 18) * 3); }
      x.stroke();
    }
    // 紙花
    for (let i = 0; i < 26; i++) {
      const x = L(i % o.n), px = range(r, 30, 96), py = range(r, 4, 70), s = range(r, 1.4, 3);
      if (r() < 0.5) circle(x, px, py, s * 0.7);
      else rotated(x, r() * TAU, px, py, c => c.fillRect(px - s, py - s * 0.4, s * 2, s * 0.8));
    }
  }
};

// 拼圖塊：3×3 拼到一半，有幾塊散落、少了幾塊。
// 每塊是方塊，加上凸出的圓（凸榫）或挖掉的圓（凹槽）；相鄰兩塊一凸一凹，且印在不同層。
export const puzzle = {
  ...base, id: 'puzzle', name: '拼圖',
  draw(o) {
    const { L, r, cut } = o, s = 22, k = 4;
    // 右邊與下邊的凸凹：+1 凸、-1 凹；左邊、上邊與鄰居相反
    const right = (i, j) => ((i + j) % 2 ? 1 : -1), down = (i, j) => ((i + j) % 2 ? -1 : 1);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      if (r() < 0.2) continue;                                       // 少了這一塊
      const loose = r() < 0.3, dx = loose ? range(r, -7, 7) : 0, dy = loose ? range(r, -7, 7) : 0;
      const px = 17 + i * s + dx, py = 17 + j * s + dy, x = L((i + j) % o.n);
      const sides = [];
      if (i < 2) sides.push([px + s, py + s / 2, right(i, j)]);
      if (j < 2) sides.push([px + s / 2, py + s, down(i, j)]);
      if (i > 0) sides.push([px, py + s / 2, -right(i - 1, j)]);
      if (j > 0) sides.push([px + s / 2, py, -down(i, j - 1)]);
      rotated(x, loose ? range(r, -0.3, 0.3) : 0, px + s / 2, py + s / 2, c => {
        c.fillRect(px + 0.5, py + 0.5, s - 1, s - 1);
        for (const [sx, sy, sign] of sides) {
          const nx = Math.sign(sx - (px + s / 2)), ny = Math.sign(sy - (py + s / 2));
          if (sign > 0) circle(c, sx + nx * k * 0.6, sy + ny * k * 0.6, k);
          else cut(c, q => circle(q, sx - nx * k * 0.6, sy - ny * k * 0.6, k));
        }
      });
    }
  }
};

// 溜溜球和彈珠
export const yoyo = {
  ...base, id: 'yoyo', name: '溜溜球與彈珠',
  draw(o) {
    const { L, r, cut } = o, d = detail(o), body = L(0);
    d.lineWidth = 1.2; d.beginPath(); d.moveTo(34, 2); d.bezierCurveTo(28, 14, 42, 22, 34, 31); d.stroke();
    circle(body, 34, 52, 21);
    cut(body, x => { x.lineWidth = 2; x.beginPath(); x.arc(34, 52, 14, 0, TAU); x.stroke(); });
    circle(d, 34, 52, 4);
    const marbles = 4 + Math.floor(r() * 3);
    for (let i = 0; i < marbles; i++) {
      const mx = range(r, 60, 90), my = range(r, 58, 92), mr = range(r, 6, 9), layer = L(i % o.n);
      circle(layer, mx, my, mr);
      cut(layer, x => ellipse(x, mx - mr * 0.35, my - mr * 0.35, mr * 0.22, mr * 0.16, -0.6));
      if (o.n > 1 && layer !== d) { d.lineWidth = 0.9; d.beginPath(); d.arc(mx, my, mr * 0.55, 0.2, 2); d.stroke(); }
    }
  }
};

// 賓果卡：格子裡的數字全是虛構的，幾格被圈起來
export const bingo = {
  ...base, id: 'bingo', name: '賓果卡', layouts: ['center', 'grid3'],
  draw(o) {
    const { L, r } = o, card = L(0), d = detail(o), m = accent(o);
    roundRect(card, 10, 6, 80, 88, 4);
    d.save(); d.font = `900 9px ${FONT}`; d.textAlign = 'center'; d.textBaseline = 'middle';
    'BINGO'.split('').forEach((ch, i) => d.fillText(ch, 18 + i * 16, 15));
    d.font = `600 7px ${FONT}`;
    const used = new Set();
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const cx = 18 + i * 16, cy = 30 + j * 14;
      if (i === 2 && j === 2) { star(d, cx, cy, 4.5); continue; }   // 中間是免費格
      let v; do { v = 1 + i * 15 + Math.floor(r() * 15); } while (used.has(v));
      used.add(v);
      d.fillText(String(v), cx, cy);
      if (r() < 0.28) { const mk = m || d; mk.lineWidth = 1.4; mk.beginPath(); mk.arc(cx, cy, 5.6, 0, TAU); (m ? mk.fill() : mk.stroke()); }
    }
    d.restore();
    d.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) { d.beginPath(); d.moveTo(10 + i * 16, 22); d.lineTo(10 + i * 16, 92); d.stroke(); }
    for (let j = 0; j <= 5; j++) { d.beginPath(); d.moveTo(10, 23 + j * 14); d.lineTo(90, 23 + j * 14); d.stroke(); }
  }
};
function star(x, cx, cy, R) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? R * 0.45 : R; x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  x.closePath(); x.fill();
}

// 撲克牌疊成扇形，牌面是原創設計
export const cards = {
  ...base, id: 'cards', name: '撲克牌',
  draw(o) {
    const { L, r } = o, count = 3 + Math.floor(r() * 3), spread = 0.28;
    const RANKS = ['A', '2', '3', '5', '7', '9', 'J', 'Q', 'K'];
    for (let i = 0; i < count; i++) {
      // 前兩張固定一紅一黑，三色時中間層與深色層才一定有花色
      const a = (i - (count - 1) / 2) * spread, kind = i === 0 ? 'heart' : i === 1 ? 'spade' : SUITS[Math.floor(r() * 4)];
      const face = L(0), ink = (kind === 'heart' || kind === 'diamond') && o.n > 2 ? L(1) : detail(o);
      rotated(face, a, 50, 92, x => roundRect(x, 33, 22, 34, 48, 3));
      rotated(ink, a, 50, 92, x => {
        x.lineWidth = 0.9; x.beginPath(); x.rect(33, 22, 34, 48); x.stroke();
        suit(x, kind, 50, 46, 7);
        x.font = `700 7px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(pick(r, RANKS), 37.5, 28);
        suit(x, kind, 37.5, 35, 2.2);
      });
    }
  }
};

// 骰子、撲克牌的花色、西洋棋子
export const gamepieces = {
  ...base, id: 'gamepieces', name: '桌遊小物',
  draw(o) {
    const { L, r, cut } = o, kind = pick(r, ['dice', 'suits', 'chess']), d = detail(o);
    if (kind === 'dice') {
      for (const [cx, cy, a, v] of [[34, 44, -0.25, 1 + Math.floor(r() * 6)], [64, 62, 0.3, 1 + Math.floor(r() * 6)]]) {
        const pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
        const face = cx < 50 ? L(0) : mid(o);
        rotated(face, a, cx, cy, x => roundRect(x, cx - 15, cy - 15, 30, 30, 6));
        rotated(d, a, cx, cy, x => pips.forEach(([px, py]) => circle(x, cx + px * 8, cy + py * 8, 2.8)));
      }
    } else if (kind === 'suits') {
      SUITS.forEach((s, i) => suit(L(i % o.n), s, 30 + (i % 2) * 40, 30 + Math.floor(i / 2) * 40, 13));
    } else {
      const piecesKinds = ['pawn', 'rook', 'bishop', 'king'];
      piecesKinds.forEach((p, i) => {
        const x = L(i % o.n), cx = 16 + i * 22.5, by = 88;
        roundRect(x, cx - 9, by - 5, 18, 5, 1.5);
        poly(x, [[cx - 6, by - 5], [cx + 6, by - 5], [cx + 3.5, by - 30], [cx - 3.5, by - 30]]);
        if (p === 'pawn') circle(x, cx, by - 34, 6);
        else if (p === 'rook') { x.fillRect(cx - 6, by - 42, 12, 12); cut(x, c => { c.fillRect(cx - 2, by - 42, 4, 4); }); }
        else if (p === 'bishop') { ellipse(x, cx, by - 38, 5.5, 9); cut(x, c => { c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx + 1, by - 44); c.lineTo(cx + 4, by - 39); c.stroke(); }); }
        else { ellipse(x, cx, by - 36, 6.5, 7); x.fillRect(cx - 1.2, by - 52, 2.4, 10); x.fillRect(cx - 4, by - 48, 8, 2.4); }
      });
    }
  }
};

export const MUSIC_B = [equalizer, soundwave, metronome, gamepad, funfair, party, puzzle, yoyo, bingo, cards, gamepieces];
