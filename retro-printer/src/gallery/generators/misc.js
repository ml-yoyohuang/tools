// 第 9 批：字體與排版、絹印工作室、生活小物、交通與旅行、季節與節慶。
// 全部是原創圖形；所有文字都是虛構的，不出現真實的店名、人名、活動或品牌。
import { TAU, pick, range, circle, ellipse, roundRect, poly, mark } from './parts.js';
import { sun, flower, leaves } from './classic.js';
import { cactus, lighthouse } from './nature.js';

const detail = o => (o.n > 1 ? o.L(o.n - 1) : o.L(0));
const mid = o => (o.n > 2 ? o.L(1) : o.L(0));
const rotated = (x, a, cx, cy, fn) => { x.save(); x.translate(cx, cy); x.rotate(a); x.translate(-cx, -cy); fn(x); x.restore(); };
const UNIT = ['center', 'repeat', 'grid3', 'badge'];
const SANS = '"Helvetica Neue", Helvetica, Arial, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
const HEAVY = '"Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif';
const text = (x, str, cx, cy, size, { weight = 700, font = SANS, align = 'center' } = {}) => {
  x.save(); x.font = `${weight} ${size}px ${font}`; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(str, cx, cy); x.restore();
};
// 在單位方格裡的一小塊區域，畫另一個產生器（例如郵票裡的小圖）
function inset(o, x0, y0, s, fn) {
  const used = new Set();
  const enter = c => { if (!used.has(c)) { c.save(); c.translate(x0, y0); c.scale(s / 100, s / 100); used.add(c); } return c; };
  fn({ ...o, L: i => enter(o.L(i)), T: i => enter(o.T(i)) });
  for (const c of used) c.restore();
}
function star5(x, cx, cy, R, rot = -Math.PI / 2) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, d = i % 2 ? R * 0.45 : R; x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  x.closePath(); x.fill();
}

/* ───────── 字體與排版 ───────── */
const type = { theme: 'type', colors: [2, 3] };
const WORDS = ['HELLO', 'PRINT', 'INK', 'LAYER', 'PULL', 'MESH', 'TONE', 'PAPER', 'DOTS', 'SPLASH'];

// 大字報：一個巨大的字母或數字，疊上另一色的圖形
export const bigletter = {
  ...type, id: 'bigletter', name: '大字報', layouts: ['center', 'grid3'],
  draw(o) {
    const { L, r, n } = o, ch = pick(r, 'ABCDEFGHKMNPRSTWXYZ23456789'.split('')), shape = pick(r, ['circle', 'stripes', 'dots', 'tri']);
    const s = L(0), deco = n > 2 ? L(1) : s;
    if (n > 1) {
      if (shape === 'circle') circle(s, range(r, 38, 62), range(r, 38, 62), range(r, 26, 34));
      else if (shape === 'stripes') for (let k = 0; k < 6; k++) s.fillRect(0, 6 + k * 16, 100, 8);
      else if (shape === 'dots') for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) circle(s, 10 + i * 20, 10 + j * 20, 6);
      else poly(s, [[range(r, 4, 24), 94], [range(r, 76, 96), 94], [range(r, 36, 64), 8]]);
      if (n > 2) { deco.fillRect(8, 86, 84, 8); }
    }
    text(detail(o), ch, 50, 52, 96, { weight: 900, font: HEAVY });
  }
};

// 重複排列的短字詞
export const wordrepeat = {
  ...type, id: 'wordrepeat', name: '重複字詞', layouts: ['full', 'center'],
  draw(o) {
    const { L, r } = o, word = pick(r, WORDS), rows = 7, tilt = r() < 0.4 ? -0.2 : 0;
    for (let k = 0; k < rows; k++) {
      const x = L(k % o.n), y = 8 + k * 14;
      rotated(x, tilt, 50, 50, c => { c.save(); c.font = `900 ${12}px ${HEAVY}`; c.textBaseline = 'middle'; const w = c.measureText(word + ' ').width; for (let px = -w + (k % 2) * w / 2; px < 110; px += w) c.fillText(word, px, y); c.restore(); });
    }
  }
};

// 圓形環繞文字，像徽章或貼紙
export const textbadge = {
  ...type, id: 'textbadge', name: '環繞文字', layouts: ['center', 'grid3', 'repeat'],
  draw(o) {
    const { L, r, cut } = o, ring = L(0), d = detail(o), phrase = pick(r, ['PRINTED BY HAND', 'ONE LAYER AT A TIME', 'SMALL BATCH INK', 'PULL · LIFT · REPEAT', 'MADE ON PAPER']);
    circle(ring, 50, 50, 46); cut(ring, x => circle(x, 50, 50, 30));
    const letters = (phrase + ' · ').split(''), step = TAU / letters.length;
    letters.forEach((ch, i) => {
      const a = -Math.PI / 2 + i * step;
      cut(ring, x => { x.save(); x.translate(50 + Math.cos(a) * 38, 50 + Math.sin(a) * 38); x.rotate(a + Math.PI / 2); x.font = `800 9px ${SANS}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 0, 0); x.restore(); });
    });
    const center = mid(o) === ring ? d : mid(o);
    pick(r, [() => star5(center, 50, 50, 20), () => circle(center, 50, 50, 18), () => text(center, pick(r, ['INK', 'NO.1', 'A+', 'OK']), 50, 52, 18, { weight: 900, font: HEAVY })])();
    if (o.n > 1 && center !== d) circle(d, 50, 50, 4);
  }
};

// 假的活動海報：日期、地點和大標題的排版結構，內容全部虛構
export const fakeposter = {
  ...type, id: 'fakeposter', name: '活動海報', layouts: ['center'],
  draw(o) {
    const { L, r } = o, d = detail(o), block = L(0);
    const titles = [['SOFT', 'PAPER', 'FAIR'], ['NIGHT', 'INK', 'CLUB'], ['TWO', 'COLOR', 'WEEK'], ['DOT', 'DOT', 'DOT']];
    const t = pick(r, titles), day = 1 + Math.floor(r() * 28), month = 1 + Math.floor(r() * 12);
    block.fillRect(8, 6, 84, 88);
    const shape = mid(o) === block ? d : mid(o);
    circle(shape, range(r, 56, 76), range(r, 22, 34), range(r, 14, 20));
    o.cut(block, x => { x.fillRect(8, 56, 84, 1.5); });
    const place = pick(r, ['舊倉庫 2F', '河邊小屋', '第三層市集', '紙箱劇場']);
    mark(o, x => {
      t.forEach((w, i) => text(x, w, 14, 64 + i * 9, 9, { weight: 900, font: HEAVY, align: 'left' }));
      text(x, `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`, 86, 64, 8, { weight: 700, align: 'right' });
      text(x, place, 86, 73, 5.5, { weight: 600, align: 'right' });
      text(x, 'FREE ENTRY', 86, 82, 4.5, { weight: 600, align: 'right' });
    });
  }
};

/* ───────── 絹印工作室 ───────── */
const studio = { theme: 'studio', colors: [2, 3] };

// 墨水罐、刮板、網框的圖示組合
export const studiotools = {
  ...studio, id: 'studiotools', name: '工作室器材', layouts: UNIT,
  draw(o) {
    const { L, r, cut } = o, d = detail(o), b = L(0);
    // 墨水罐
    roundRect(b, 8, 46, 26, 34, 4); roundRect(d, 6, 40, 30, 8, 2);
    const ink = mid(o) === b ? d : mid(o);
    ink.beginPath(); ink.moveTo(16, 40); ink.quadraticCurveTo(14, 30, 20, 26); ink.quadraticCurveTo(24, 32, 22, 40); ink.fill();
    cut(b, x => roundRect(x, 12, 56, 18, 12, 2));
    // 網框：粗框加細網目，上面躺著一支刮板
    d.lineWidth = 4; d.strokeRect(46, 16, 44, 64);
    b.lineWidth = 0.7; b.beginPath();
    for (let k = 1; k < 11; k++) { b.moveTo(48 + k * 4, 18); b.lineTo(48 + k * 4, 78); }
    for (let k = 1; k < 15; k++) { b.moveTo(48, 18 + k * 4); b.lineTo(88, 18 + k * 4); }
    b.stroke();
    if (ink !== d) ellipse(ink, 68, 30, 14, 5);
    rotated(d, range(r, -0.35, -0.15), 68, 58, x => { roundRect(x, 42, 52, 52, 7, 3); x.fillRect(44, 59, 48, 4); });
  }
};

// 色票條排列
export const swatchstrip = {
  ...studio, id: 'swatchstrip', name: '色票條', layouts: ['center', 'grid3'],
  draw(o) {
    const { L, r } = o, d = detail(o), strips = 5, fan = r() < 0.6;
    for (let i = 0; i < strips; i++) {
      const a = fan ? (i - (strips - 1) / 2) * 0.18 : 0, ox = fan ? 0 : (i - 2) * 16;
      rotated(L(0), a, 50, 92, x => roundRect(x, 42 + ox, 8, 16, 80, 2));
      rotated(L(i % o.n), a, 50, 92, x => { for (let k = 0; k < 4; k++) x.fillRect(43 + ox, 10 + k * 14, 14, 11); });
      rotated(d, a, 50, 92, x => { x.fillRect(44 + ox, 70, 12, 1); x.fillRect(44 + ox, 74, 8, 1); });
    }
    circle(d, 50, 84, 2.5);
  }
};

// 「PRINT ME」「INK LAB」「LAYER 1/2/3」這類字樣
export const studiowords = {
  ...studio, id: 'studiowords', name: '工作室字樣', layouts: ['center', 'grid3', 'badge'],
  draw(o) {
    const { L, r } = o, kind = pick(r, ['printme', 'inklab', 'layers']);
    if (kind === 'layers') {
      for (let k = 0; k < 3; k++) {
        const x = L(k % o.n);
        x.fillRect(18 + k * 6, 16 + k * 22, 64, 18);
        o.cut(x, c => text(c, `LAYER ${k + 1}`, 50 + k * 6, 25 + k * 22, 10, { weight: 900, font: HEAVY }));
      }
    } else {
      const word = kind === 'printme' ? ['PRINT', 'ME'] : ['INK', 'LAB'];
      const sh = L(0);
      if (kind === 'inklab') { sh.beginPath(); sh.moveTo(50, 8); sh.bezierCurveTo(64, 30, 86, 44, 86, 62); sh.arc(50, 62, 36, 0, Math.PI); sh.bezierCurveTo(14, 44, 36, 30, 50, 8); sh.fill(); }
      else roundRect(sh, 8, 22, 84, 56, 28);
      mark(o, t => {
      text(t, word[0], 50, kind === 'inklab' ? 56 : 42, kind === 'inklab' ? 18 : 22, { weight: 900, font: HEAVY });
      text(t, word[1], 50, kind === 'inklab' ? 74 : 62, kind === 'inklab' ? 14 : 18, { weight: 900, font: HEAVY });
      });
      if (o.n > 2) for (let i = 0; i < 6; i++) circle(L(1), range(r, 8, 92), range(r, 84, 96), range(r, 1.5, 3));
    }
  }
};

// 對位十字標記做成的圖案
export const regmarks = {
  ...studio, id: 'regmarks', name: '對位十字', layouts: ['full', 'center'],
  draw(o) {
    const { L, r } = o, g = pick(r, [3, 4, 5]), s = 100 / g;
    for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
      const cx = (i + 0.5) * s, cy = (j + 0.5) * s, x = L((i + j) % o.n), R = s * 0.22;
      x.lineWidth = s * 0.05;
      x.beginPath(); x.moveTo(cx - s * 0.4, cy); x.lineTo(cx + s * 0.4, cy); x.moveTo(cx, cy - s * 0.4); x.lineTo(cx, cy + s * 0.4); x.stroke();
      x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.stroke();
      if ((i * 3 + j) % 4 === 0) { x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R, 0, Math.PI / 2); x.closePath(); x.fill(); x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R, Math.PI, Math.PI * 1.5); x.closePath(); x.fill(); }
    }
  }
};

/* ───────── 生活小物 ───────── */
const life = { theme: 'life', colors: [2, 3] };

// 鑰匙、剪刀、迴紋針、圖釘
export const stationery = {
  ...life, id: 'stationery', name: '文具小物', layouts: ['center', 'badge', 'grid3', 'full'],
  draw(o) {
    const { L, r, cut } = o, d = detail(o), b = L(0), m = mid(o) === b ? d : mid(o);
    // 鑰匙
    rotated(b, -0.5, 28, 30, x => { circle(x, 18, 30, 10); x.fillRect(26, 27, 26, 6); x.fillRect(44, 33, 4, 6); x.fillRect(38, 33, 4, 4); });
    cut(b, x => rotated(x, -0.5, 28, 30, c => circle(c, 18, 30, 4)));
    // 剪刀
    d.lineWidth = 2.6;
    for (const s of [-1, 1]) { d.beginPath(); d.arc(66 + s * 8, 22, 6, 0, TAU); d.stroke(); }
    poly(d, [[62, 27], [94, 54], [91, 57], [70, 30]]); poly(d, [[70, 27], [70, 32], [86, 62], [89, 60]]);
    // 迴紋針
    m.lineWidth = 2.2;
    rotated(m, 0.4, 28, 72, x => { x.beginPath(); x.moveTo(22, 88); x.lineTo(22, 60); x.arc(28, 60, 6, Math.PI, 0); x.lineTo(34, 84); x.arc(30, 84, 4, 0, Math.PI); x.lineTo(26, 64); x.stroke(); });
    // 圖釘
    circle(b, 62, 76, 9); roundRect(b, 59, 70, 6, 14, 2); d.lineWidth = 1.4; d.beginPath(); d.moveTo(62, 85); d.lineTo(62, 96); d.stroke();
  }
};

// 盆栽：各種形狀的盆器搭配不同植物
export const pots = {
  ...life, id: 'pots', name: '盆栽', layouts: UNIT,
  draw(o) {
    const { L, r } = o, d = detail(o), pot = mid(o) === L(0) ? d : mid(o), leaf = L(0);
    const kind = pick(r, ['monstera', 'snake', 'round']), shape = pick(r, ['tapered', 'bowl', 'cylinder']);
    if (kind === 'monstera') for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.45; rotated(leaf, a + Math.PI / 2, 50, 62, x => { ellipse(x, 50, 34, 11, 18); o.cut(x, c => { c.lineWidth = 1.4; for (const t of [-1, 1]) { c.beginPath(); c.moveTo(50, 30); c.lineTo(50 + t * 9, 26); c.stroke(); } }); }); }
    else if (kind === 'snake') for (let k = 0; k < 5; k++) { const x0 = 34 + k * 8; poly(leaf, [[x0 - 4, 64], [x0 + 4, 64], [x0 + range(r, -3, 3), range(r, 10, 26)]]); }
    else { for (let k = 0; k < 7; k++) circle(leaf, 50 + range(r, -16, 16), 40 + range(r, -14, 14), range(r, 8, 12)); }
    if (shape === 'tapered') poly(pot, [[28, 62], [72, 62], [64, 94], [36, 94]]);
    else if (shape === 'bowl') { pot.beginPath(); pot.moveTo(24, 64); pot.lineTo(76, 64); pot.quadraticCurveTo(74, 94, 50, 94); pot.quadraticCurveTo(26, 94, 24, 64); pot.fill(); }
    else roundRect(pot, 30, 62, 40, 32, 4);
    if (pot !== d) { d.lineWidth = 1.4; d.beginPath(); d.moveTo(30, 70); d.lineTo(70, 70); d.stroke(); }
  }
};

// 檯燈、時鐘、雨傘
export const homeitems = {
  ...life, id: 'homeitems', name: '家用小物', layouts: UNIT,
  draw(o) {
    const { L, r, cut } = o, d = detail(o), b = L(0), m = mid(o) === b ? d : mid(o), kind = pick(r, ['lamp', 'clock', 'umbrella']);
    if (kind === 'lamp') {
      poly(b, [[30, 18], [62, 18], [74, 46], [18, 46]]);
      d.lineWidth = 3; d.beginPath(); d.moveTo(46, 46); d.lineTo(46, 86); d.stroke();
      roundRect(d, 30, 86, 32, 6, 2);
      if (m !== d) poly(m, [[26, 48], [66, 48], [86, 96], [6, 96]]);
    } else if (kind === 'clock') {
      circle(b, 50, 52, 38); cut(b, x => circle(x, 50, 52, 32));
      if (m !== d) circle(m, 50, 52, 31);
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; circle(d, 50 + Math.cos(a) * 27, 52 + Math.sin(a) * 27, k % 3 ? 1 : 2); }
      const h = r() * TAU, mi = r() * TAU;
      d.lineWidth = 3; d.beginPath(); d.moveTo(50, 52); d.lineTo(50 + Math.cos(h) * 14, 52 + Math.sin(h) * 14); d.stroke();
      d.lineWidth = 2; d.beginPath(); d.moveTo(50, 52); d.lineTo(50 + Math.cos(mi) * 22, 52 + Math.sin(mi) * 22); d.stroke();
      circle(d, 50, 52, 2.5); circle(b, 26, 18, 8); circle(b, 74, 18, 8);
    } else {
      b.beginPath(); b.arc(50, 50, 40, Math.PI, 0);
      for (let k = 4; k >= 0; k--) b.quadraticCurveTo(10 + k * 16 + 8, 42, 10 + k * 16, 50);
      b.fill();
      if (m !== d) for (let k = 0; k < 5; k += 2) { m.beginPath(); m.moveTo(50, 10); m.lineTo(10 + k * 16, 50); m.lineTo(26 + k * 16, 50); m.closePath(); m.fill(); }
      d.lineWidth = 2.6; d.beginPath(); d.moveTo(50, 10); d.lineTo(50, 84); d.arc(44, 84, 6, 0, Math.PI); d.stroke();
      circle(d, 50, 9, 2);
    }
  }
};

// 衣物：襪子、毛帽、手套，排成一列
export const clothesline = {
  ...life, id: 'clothesline', name: '晾衣繩', layouts: ['center', 'badge'],
  draw(o) {
    const { L, r } = o, d = detail(o);
    d.lineWidth = 1; d.beginPath(); d.moveTo(0, 24); d.quadraticCurveTo(50, 34, 100, 24); d.stroke();
    const items = ['sock', 'hat', 'mitten', 'sock'].sort(() => r() - 0.5);
    items.forEach((it, i) => {
      const x = L(i % o.n), cx = 14 + i * 24, top = 26 + Math.sin((cx / 100) * Math.PI) * 6;
      d.fillRect(cx - 1.5, top - 4, 3, 7);
      if (it === 'sock') { roundRect(x, cx - 6, top, 12, 30, 4); roundRect(x, cx - 6, top + 22, 20, 10, 5); }
      else if (it === 'hat') { x.beginPath(); x.arc(cx, top + 22, 12, Math.PI, 0); x.fill(); x.fillRect(cx - 13, top + 20, 26, 7); circle(x, cx, top + 7, 4.5); }
      else { roundRect(x, cx - 9, top, 18, 28, 8); roundRect(x, cx - 15, top + 8, 8, 14, 4); roundRect(x, cx - 9, top + 26, 18, 6, 2); }
      o.cut(x, c => { c.lineWidth = 1; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(cx - 6, top + 6 + k * 4); c.lineTo(cx + 6, top + 6 + k * 4); c.stroke(); } });
    });
  }
};

/* ───────── 交通與旅行 ───────── */
const travel = { theme: 'travel', colors: [2, 3] };

// 腳踏車、復古小汽車、熱氣球
export const vehicles = {
  ...travel, id: 'vehicles', name: '交通工具', layouts: UNIT,
  draw(o) {
    const { L, r, cut } = o, d = detail(o), b = L(0), m = mid(o) === b ? d : mid(o), kind = pick(r, ['bike', 'car', 'balloon']);
    if (kind === 'bike') {
      d.lineWidth = 2.4;
      for (const wx of [26, 74]) { d.beginPath(); d.arc(wx, 66, 18, 0, TAU); d.stroke(); }
      b.lineWidth = 3.4; b.beginPath(); b.moveTo(26, 66); b.lineTo(44, 40); b.lineTo(66, 40); b.lineTo(74, 66); b.moveTo(44, 40); b.lineTo(50, 66); b.lineTo(66, 40); b.moveTo(26, 66); b.lineTo(50, 66); b.stroke();
      roundRect(d, 38, 32, 12, 4, 2); d.lineWidth = 2; d.beginPath(); d.moveTo(66, 40); d.lineTo(64, 30); d.lineTo(72, 28); d.stroke();
      if (m !== d) roundRect(m, 64, 18, 18, 10, 2);
    } else if (kind === 'car') {
      roundRect(b, 10, 46, 80, 26, 10); roundRect(b, 26, 28, 44, 24, 10);
      cut(b, x => { roundRect(x, 32, 33, 14, 13, 3); roundRect(x, 50, 33, 14, 13, 3); });
      for (const wx of [30, 70]) { circle(d, wx, 72, 10); cut(d, x => circle(x, wx, 72, 4)); }
      if (m !== d) { circle(m, 86, 56, 4); m.fillRect(10, 58, 80, 4); }
    } else {
      b.beginPath(); b.arc(50, 38, 30, Math.PI * 0.8, Math.PI * 2.2); b.quadraticCurveTo(66, 66, 56, 72); b.lineTo(44, 72); b.quadraticCurveTo(34, 66, 26, 55); b.fill();
      if (m !== d) for (let k = 0; k < 3; k++) { m.save(); m.beginPath(); m.arc(50, 38, 30, 0, TAU); m.clip(); m.fillRect(36 + k * 10 - 3, 8, 6, 64); m.restore(); }
      d.lineWidth = 1; d.beginPath(); d.moveTo(44, 72); d.lineTo(44, 82); d.moveTo(56, 72); d.lineTo(56, 82); d.stroke();
      roundRect(d, 42, 82, 16, 11, 2);
    }
  }
};

// 郵票造型：鋸齒邊框裡放一個小圖
const STAMP_INNER = [sun, flower, leaves, cactus, lighthouse];
export const stamp = {
  ...travel, id: 'stamp', name: '郵票', layouts: ['center', 'grid3', 'repeat'],
  draw(o) {
    const { L, r, cut } = o, paper = L(0), d = detail(o);
    paper.fillRect(14, 8, 72, 84);
    for (let k = 0; k <= 9; k++) { cut(paper, x => { circle(x, 14 + k * 8, 8, 2.6); circle(x, 14 + k * 8, 92, 2.6); }); }
    for (let k = 0; k <= 10; k++) { cut(paper, x => { circle(x, 14, 8 + k * 8.4, 2.6); circle(x, 86, 8 + k * 8.4, 2.6); }); }
    cut(paper, x => x.fillRect(22, 16, 56, 56));
    const inner = pick(r, STAMP_INNER);
    inset(o, 24, 18, 52, oo => inner.draw(oo));
    if (o.n > 2) { const f = L(1); f.lineWidth = 3; f.strokeRect(19.5, 13.5, 61, 61); }
    const val = `${pick(r, [3, 5, 8, 12, 25])}`, label = pick(r, ['PAPER POST', 'INK MAIL', 'DOT POST']);
    mark(o, x => { text(x, val, 76, 82, 9, { weight: 900, font: HEAVY, align: 'right' }); text(x, label, 24, 82, 4.5, { weight: 700, align: 'left' }); });
  }
};

// 行李吊牌、機票的版面結構，內容虛構
export const ticket = {
  ...travel, id: 'ticket', name: '票券吊牌', layouts: ['center', 'grid3'],
  draw(o) {
    const { L, r, cut } = o, b = L(0), kind = pick(r, ['tag', 'ticket']);
    if (kind === 'tag') {
      rotated(b, -0.2, 50, 50, x => poly(x, [[30, 10], [70, 10], [80, 22], [80, 92], [20, 92], [20, 22]]));
      if (o.n > 2) rotated(L(1), -0.2, 50, 50, x => { circle(x, 50, 20, 7.5); x.fillRect(20, 80, 60, 12); });
      cut(b, x => rotated(x, -0.2, 50, 50, c => circle(c, 50, 20, 4)));
      mark(o, dd => rotated(dd, -0.2, 50, 50, x => {
        x.lineWidth = 1.2; x.beginPath(); x.moveTo(50, 20); x.bezierCurveTo(60, 0, 80, 4, 90, -6); x.stroke();
        text(x, pick(r, ['FRAGILE', 'HANDLE WITH INK', 'PRIORITY']), 50, 38, 6.5, { weight: 800 });
        x.fillRect(28, 46, 44, 1);
        text(x, 'FROM  PAP', 28, 56, 5, { weight: 600, align: 'left' }); text(x, 'TO  DOT', 28, 66, 5, { weight: 600, align: 'left' });
        for (let k = 0; k < 12; k++) x.fillRect(28 + k * 3.6, 74, k % 3 ? 1.2 : 2.2, 12);
      }));
    } else {
      roundRect(b, 4, 26, 92, 48, 4);
      cut(b, x => { circle(x, 68, 26, 4); circle(x, 68, 74, 4); });
      const m = mid(o) === b ? detail(o) : mid(o);
      m.fillRect(4, 26, 92, 10);
      const gate = `GATE ${pick(r, ['A2', 'B7', 'C4'])}  SEAT ${1 + Math.floor(r() * 30)}${pick(r, ['A', 'C', 'F'])}`;
      mark(o, d => {
      text(d, 'PAP', 14, 52, 13, { weight: 900, font: HEAVY, align: 'left' });
      text(d, 'DOT', 46, 52, 13, { weight: 900, font: HEAVY, align: 'left' });
      poly(d, [[38, 52], [33, 48], [33, 56]]);
      text(d, gate, 14, 64, 4.5, { weight: 600, align: 'left' });
      d.lineWidth = 0.8; d.setLineDash?.([2, 2]); d.beginPath(); d.moveTo(68, 30); d.lineTo(68, 70); d.stroke(); d.setLineDash?.([]);
      for (let k = 0; k < 8; k++) d.fillRect(74 + k * 2.4, 46, k % 2 ? 1 : 1.8, 18);
      });
    }
  }
};

/* ───────── 季節與節慶 ───────── */
const season = { theme: 'season', colors: [2, 3] };

// 春天：花苞和蝴蝶
export const spring = {
  ...season, id: 'spring', name: '春', layouts: UNIT,
  draw(o) {
    const { L, r } = o, d = detail(o), b = L(0), m = mid(o) === b ? d : mid(o);
    d.lineWidth = 1.8; d.beginPath(); d.moveTo(20, 96); d.quadraticCurveTo(30, 60, 24, 40); d.stroke();
    for (const [bx, by, a] of [[24, 38, 0], [28, 62, 0.6], [20, 74, -0.6]]) rotated(b, a, bx, by, x => { ellipse(x, bx, by - 6, 5, 8); poly(x, [[bx - 5, by - 2], [bx + 5, by - 2], [bx, by + 4]]); });
    const bx = range(r, 56, 70), by = range(r, 34, 50), tilt = range(r, -0.3, 0.3);
    rotated(m, tilt, bx, by, x => { ellipse(x, bx - 11, by - 8, 11, 13, -0.4); ellipse(x, bx + 11, by - 8, 11, 13, 0.4); ellipse(x, bx - 8, by + 9, 7, 9, 0.4); ellipse(x, bx + 8, by + 9, 7, 9, -0.4); });
    rotated(d, tilt, bx, by, x => { ellipse(x, bx, by, 2.2, 13); x.lineWidth = 1; x.beginPath(); x.moveTo(bx, by - 12); x.quadraticCurveTo(bx - 4, by - 22, bx - 8, by - 22); x.moveTo(bx, by - 12); x.quadraticCurveTo(bx + 4, by - 22, bx + 8, by - 22); x.stroke(); });
    if (m === d) rotated(b, tilt, bx, by, x => { circle(x, bx - 11, by - 8, 4); circle(x, bx + 11, by - 8, 4); });
  }
};

// 夏天：西瓜、扇子和陽光
export const summer = {
  ...season, id: 'summer', name: '夏', layouts: UNIT,
  draw(o) {
    const { L, r, cut } = o, d = detail(o), b = L(0), m = mid(o) === b ? d : mid(o);
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; poly(b, [[78 + Math.cos(a - 0.15) * 11, 20 + Math.sin(a - 0.15) * 11], [78 + Math.cos(a) * 18, 20 + Math.sin(a) * 18], [78 + Math.cos(a + 0.15) * 11, 20 + Math.sin(a + 0.15) * 11]]); }
    circle(b, 78, 20, 10);
    // 扇子
    for (let k = 0; k < 9; k++) { const a = Math.PI * (1.15 + k * 0.0875); m.beginPath(); m.moveTo(30, 64); m.arc(30, 64, 30, a, a + 0.08); m.closePath(); m.fill(); }
    d.lineWidth = 2; d.beginPath(); d.moveTo(30, 64); d.lineTo(30, 80); d.stroke(); circle(d, 30, 64, 2.5);
    // 西瓜片
    d.beginPath(); d.moveTo(56, 72); d.arc(74, 72, 22, 0, Math.PI); d.closePath(); d.fill();
    cut(d, x => { x.beginPath(); x.arc(74, 72, 18, 0, Math.PI); x.closePath(); x.fill(); });
    b.beginPath(); b.arc(74, 72, 17.5, 0, Math.PI); b.closePath(); b.fill();
    for (let k = 0; k < 5; k++) ellipse(d, 64 + k * 5, 80 + (k % 2) * 3, 0.9, 1.6);
  }
};

// 秋天：落葉和栗子
export const autumn = {
  ...season, id: 'autumn', name: '秋', layouts: ['center', 'full'],
  draw(o) {
    const { L, r, cut } = o, d = detail(o);
    for (let i = 0; i < 9; i++) {
      const x = L(i % Math.max(1, o.n - (o.n > 2 ? 1 : 0))), cx = range(r, 10, 90), cy = range(r, 12, 62), a = r() * TAU, s = range(r, 9, 14);
      rotated(x, a, cx, cy, c => {
        if (r() < 0.5) { for (let k = 0; k < 5; k++) { const t = -Math.PI / 2 + (k - 2) * 0.55; ellipse(c, cx + Math.cos(t) * s * 0.6, cy + Math.sin(t) * s * 0.6, s * 0.3, s * 0.7, t + Math.PI / 2); } }
        else ellipse(c, cx, cy, s * 0.45, s);
        c.lineWidth = 0.8; c.beginPath(); c.moveTo(cx, cy + s * 0.3); c.lineTo(cx, cy + s * 1.2); c.stroke();
      });
    }
    // 栗子
    for (const [cx, cy] of [[34, 82], [54, 86], [72, 80]]) {
      d.beginPath(); d.moveTo(cx, cy - 10); d.quadraticCurveTo(cx + 11, cy - 4, cx + 9, cy + 6); d.lineTo(cx - 9, cy + 6); d.quadraticCurveTo(cx - 11, cy - 4, cx, cy - 10); d.fill();
      cut(d, x => ellipse(x, cx - 3, cy - 3, 1.5, 3, 0.5));
      const cap = o.n > 2 ? L(1) : null; if (cap) roundRect(cap, cx - 9, cy + 3, 18, 4, 2);
    }
  }
};

// 冬天：雪花和毛線紋樣
export const winter = {
  ...season, id: 'winter', name: '冬', layouts: ['full', 'center', 'badge'],
  draw(o) {
    const { L, r } = o, d = detail(o);
    // 毛線紋樣帶
    for (let row = 0; row < 2; row++) {
      const x = L(row % Math.max(1, o.n - 1)), y0 = row ? 74 : 8;
      x.fillRect(0, y0, 100, 18);
      o.cut(x, c => { for (let k = 0; k < 12; k++) { const cx = 4 + k * 8.4; poly(c, [[cx, y0 + 4], [cx + 3, y0 + 9], [cx, y0 + 14], [cx - 3, y0 + 9]]); } });
    }
    // 雪花
    for (let i = 0; i < 6; i++) {
      const cx = range(r, 12, 88), cy = range(r, 34, 66), s = range(r, 5, 9);
      d.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * TAU;
        d.beginPath(); d.moveTo(cx, cy); d.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); d.stroke();
        for (const t of [-0.5, 0.5]) { d.beginPath(); d.moveTo(cx + Math.cos(a) * s * 0.6, cy + Math.sin(a) * s * 0.6); d.lineTo(cx + Math.cos(a) * s * 0.6 + Math.cos(a + t) * s * 0.35, cy + Math.sin(a) * s * 0.6 + Math.sin(a + t) * s * 0.35); d.stroke(); }
      }
    }
  }
};

// 生日：蛋糕、氣球、派對帽
export const birthday = {
  ...season, id: 'birthday', name: '生日', layouts: UNIT,
  draw(o) {
    const { L, r, cut } = o, d = detail(o), b = L(0), m = mid(o) === b ? d : mid(o);
    // 氣球
    for (const [bx, by, layer] of [[22, 26, b], [38, 18, m], [16, 46, b]]) {
      ellipse(layer, bx, by, 9, 11); poly(layer, [[bx - 2, by + 11], [bx + 2, by + 11], [bx, by + 14]]);
      d.lineWidth = 0.8; d.beginPath(); d.moveTo(bx, by + 14); d.quadraticCurveTo(bx + 6, by + 30, bx + 2, by + 46); d.stroke();
    }
    // 蛋糕
    roundRect(b, 46, 58, 44, 30, 3); roundRect(m === b ? d : m, 46, 58, 44, 8, 3);
    for (let k = 0; k < 4; k++) { const cx = 52 + k * 11; d.fillRect(cx - 1.2, 46, 2.4, 12); ellipse(m === b ? d : m, cx, 42, 2, 3.4); }
    cut(b, x => { for (let k = 0; k < 5; k++) circle(x, 52 + k * 8, 78, 1.6); });
    // 派對帽
    poly(d, [[66, 8], [80, 38], [56, 38]]); circle(b, 66, 8, 3.5);
  }
};

export const MISC = [bigletter, wordrepeat, textbadge, fakeposter, studiotools, swatchstrip, studiowords, regmarks,
  stationery, pots, homeitems, clothesline, vehicles, stamp, ticket, spring, summer, autumn, winter, birthday];
