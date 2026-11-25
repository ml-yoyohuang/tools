// 第 10 批：鹹食。畫法跟其他食物圖案一樣：平塗的幾何形，淺色層是主體、
// 中間層是點綴、最深一層是細節；只剩一層時，細節改從主體挖空。全部是原創造型。
import { TAU, pick, range, circle, ellipse, roundRect, poly, mark } from './parts.js';

const detail = o => (o.n > 1 ? o.L(o.n - 1) : o.L(0));
const mid = o => (o.n > 2 ? o.L(1) : o.L(0));
const accentOr = o => (mid(o) === o.L(0) ? detail(o) : mid(o));   // 點綴：沒有中間層時用最深一層
const rotated = (x, a, cx, cy, fn) => { x.save(); x.translate(cx, cy); x.rotate(a); x.translate(-cx, -cy); fn(x); x.restore(); };
const steam = (x, xs, y0, h) => { x.lineWidth = 2; for (const sx of xs) { x.beginPath(); x.moveTo(sx, y0); x.bezierCurveTo(sx - 4, y0 - h * 0.35, sx + 4, y0 - h * 0.65, sx, y0 - h); x.stroke(); } };
const UNIT = ['center', 'repeat', 'grid3', 'badge', 'bigtype'];
const salty = { theme: 'savory', colors: [2, 3], layouts: UNIT };

// 薯條：紙盒裡插著長短不一的薯條
export const fries = {
  ...salty, id: 'fries', name: '薯條',
  draw(o) {
    const { L, r, cut } = o, b = L(0), box = accentOr(o);
    for (let k = 0; k < 8; k++) {
      const x = 30 + k * 5.6 + range(r, -1, 1), h = range(r, 30, 46), a = range(r, -0.14, 0.14);
      rotated(b, a, x, 60, c => roundRect(c, x - 2.6, 60 - h, 5.2, h + 4, 1.4));
    }
    box.beginPath(); box.moveTo(26, 52); box.quadraticCurveTo(50, 60, 74, 52); box.lineTo(68, 94); box.lineTo(32, 94); box.closePath(); box.fill();
    if (box === b) cut(b, c => { c.lineWidth = 2; c.beginPath(); c.moveTo(26, 51); c.quadraticCurveTo(50, 59, 74, 51); c.stroke(); });
    cut(box, c => roundRect(c, 36, 70, 28, 9, 4.5));                                      // 紙盒上的橫條標籤
    if (box !== detail(o)) roundRect(detail(o), 40, 73, 20, 3, 1.5);
  }
};

// 漢堡：一層一層疊起來，每一層之間留一點縫，一色時也看得出層次
export const burger = {
  ...salty, id: 'burger', name: '漢堡',
  draw(o) {
    const { L, r, cut } = o, b = L(0), m = accentOr(o), d = detail(o);
    b.beginPath(); b.moveTo(18, 46); b.quadraticCurveTo(18, 22, 50, 22); b.quadraticCurveTo(82, 22, 82, 46); b.closePath(); b.fill();  // 上層麵包
    mark(o, c => { for (const [x, y] of [[36, 32], [48, 28], [60, 32], [42, 38], [56, 38]]) ellipse(c, x, y, 1.3, 2.2, 0.4); }); // 芝麻
    m.beginPath(); m.moveTo(16, 50);                                                       // 生菜
    for (let k = 0; k <= 10; k++) m.quadraticCurveTo(19 + k * 6.8 - 3.4, 58, 16 + k * 6.8 + 0.6, 51);
    m.lineTo(84, 48); m.lineTo(16, 48); m.closePath(); m.fill();
    poly(m, [[20, 57], [80, 57], [74, 64], [66, 58], [54, 66], [44, 58], [30, 64]]);      // 起司
    roundRect(d, 19, 60, 62, 11, 5);                                                       // 肉
    roundRect(b, 20, 73, 60, 10, 4);                                                       // 下層麵包
    if (d === b) cut(b, c => { c.fillRect(14, 71, 72, 1.6); c.fillRect(14, 47, 72, 1.4); });
  }
};

// 拉麵：碗、湯面、半顆蛋、魚板，筷子夾起一撮麵
export const ramen = {
  ...salty, id: 'ramen', name: '拉麵',
  draw(o) {
    const { L, r, cut } = o, b = L(0), m = accentOr(o), d = detail(o);
    b.beginPath(); b.moveTo(14, 54); b.lineTo(86, 54); b.quadraticCurveTo(84, 86, 50, 88); b.quadraticCurveTo(16, 86, 14, 54); b.fill();
    roundRect(b, 38, 86, 24, 6, 2);                                                        // 碗底
    mark(o, c => { c.lineWidth = 1.6; c.beginPath(); for (let k = 0; k <= 12; k++) c.lineTo(20 + k * 5, 66 + (k % 2) * 5); c.stroke(); }); // 碗上的紋樣
    ellipse(m, 50, 54, 35, 6);                                                             // 湯面
    circle(b, 34, 50, 8.5); circle(m === b ? d : m, 34, 50, 4.2);                          // 半顆蛋
    circle(b, 62, 51, 7); mark(o, c => { c.lineWidth = 1.4; c.beginPath(); for (let t = 0; t < 1; t += 0.02) { const a = t * TAU * 2, rr = t * 5.5; c.lineTo(62 + Math.cos(a) * rr, 51 + Math.sin(a) * rr); } c.stroke(); }); // 魚板
    d.lineWidth = 2.6; d.beginPath(); d.moveTo(56, 12); d.lineTo(78, 44); d.moveTo(64, 10); d.lineTo(82, 42); d.stroke(); // 筷子
    d.lineWidth = 1.6;
    for (let k = 0; k < 4; k++) { const x0 = 66 + k * 2.6; d.beginPath(); d.moveTo(x0, 26 + k); for (let y = 0; y <= 20; y += 2.5) d.lineTo(x0 + Math.sin(y * 0.9 + k) * 1.6 - y * 0.25, 26 + k + y); d.stroke(); }
    if (r() < 0.6) steam(d, [24, 32], 44, 16);
  }
};

// 飯糰：圓角三角形加一片海苔，上面一顆梅子
export const onigiri = {
  ...salty, id: 'onigiri', name: '飯糰',
  draw(o) {
    const { L, r, cut } = o, b = L(0), d = detail(o), m = accentOr(o);
    b.save(); b.lineJoin = 'round'; b.lineWidth = 16;
    b.beginPath(); b.moveTo(50, 22); b.lineTo(80, 76); b.lineTo(20, 76); b.closePath(); b.stroke(); b.fill(); b.restore();
    roundRect(d, 38, 60, 24, 24, 2);                                                       // 海苔
    if (d === b) cut(b, c => { c.fillRect(36, 58, 28, 1.6); c.fillRect(36, 58, 1.6, 28); c.fillRect(62.4, 58, 1.6, 28); });
    // 頂端露出的餡料：梅子，或一小塊鮭魚
    if (r() < 0.5) circle(m, 50, 40, 6);
    else { m.beginPath(); m.moveTo(42, 46); m.quadraticCurveTo(50, 32, 58, 46); m.closePath(); m.fill(); }
    if (r() < 0.5) mark(o, c => { for (const [x, y] of [[34, 62], [66, 62], [40, 52], [60, 52]]) ellipse(c, x, y, 1, 1.8, r() * TAU); }); // 芝麻
  }
};

// 煎餃：半月形、上緣有褶子、底部煎得金黃
export const gyoza = {
  ...salty, id: 'gyoza', name: '煎餃',
  draw(o) {
    const { L, r } = o, b = L(0), m = accentOr(o), d = detail(o);
    const one = (cx, cy, a) => {
      rotated(b, a, cx, cy, c => { c.beginPath(); c.moveTo(cx - 20, cy + 6); c.quadraticCurveTo(cx, cy - 26, cx + 20, cy + 6); c.quadraticCurveTo(cx, cy + 12, cx - 20, cy + 6); c.fill(); });
      rotated(m, a, cx, cy, c => { c.beginPath(); c.moveTo(cx - 18, cy + 6); c.quadraticCurveTo(cx, cy + 12, cx + 18, cy + 6); c.quadraticCurveTo(cx, cy + 4, cx - 18, cy + 6); c.fill(); });
      mark(o, c => rotated(c, a, cx, cy, cc => {
        cc.lineWidth = 1.4;
        for (let k = -2; k <= 2; k++) { const px = cx + k * 6; cc.beginPath(); cc.moveTo(px, cy - 9 + Math.abs(k) * 1.6); cc.quadraticCurveTo(px + 2, cy - 3, px + 1, cy + 1); cc.stroke(); }
      }));
    };
    ellipse(d, 50, 74, 42, 6);                                                             // 盤子
    one(30, 52, -0.12); one(70, 52, 0.12); one(50, 38, 0);
  }
};

// 小籠包：蒸籠上三顆，頂端收褶，冒著熱氣
export const xiaolongbao = {
  ...salty, id: 'xiaolongbao', name: '小籠包',
  draw(o) {
    const { L, r } = o, b = L(0), m = accentOr(o), d = detail(o);
    roundRect(m, 12, 66, 76, 22, 4);                                                       // 蒸籠
    mark(o, c => { c.lineWidth = 1.2; for (let k = 1; k < 9; k++) { c.beginPath(); c.moveTo(12 + k * 8.4, 70); c.lineTo(12 + k * 8.4, 84); c.stroke(); } });
    const bun = (cx, cy, s) => {
      b.beginPath(); b.moveTo(cx - 15 * s, cy + 10 * s); b.quadraticCurveTo(cx - 16 * s, cy - 8 * s, cx, cy - 12 * s);
      b.quadraticCurveTo(cx + 16 * s, cy - 8 * s, cx + 15 * s, cy + 10 * s); b.closePath(); b.fill();
      mark(o, c => { c.lineWidth = 1.2; for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(cx + k * 1.2 * s, cy - 11 * s); c.quadraticCurveTo(cx + k * 3.2 * s, cy - 6 * s, cx + k * 4.4 * s, cy + 2 * s); c.stroke(); } });
    };
    bun(30, 54, 1); bun(70, 54, 1); bun(50, 50, 1.15);
    if (r() < 0.7) steam(d, [36, 50, 64], 28, 16);
  }
};

// 披薩切片：餅皮邊、起司、臘腸，尖端牽一點起司
export const pizza = {
  ...salty, id: 'pizza', name: '披薩',
  draw(o) {
    const { L, r, cut } = o, b = L(0), m = accentOr(o), d = detail(o);
    const tilt = range(r, -0.25, 0.25);
    rotated(b, tilt, 50, 50, c => { poly(c, [[20, 24], [80, 24], [50, 88]]); });           // 起司
    rotated(m, tilt, 50, 50, c => { roundRect(c, 16, 16, 68, 12, 6); });                   // 餅皮邊
    if (m === b) cut(b, c => rotated(c, tilt, 50, 50, cc => cc.fillRect(14, 28, 72, 1.6)));
    rotated(d, tilt, 50, 50, c => {
      for (const [x, y, rr] of [[38, 38, 6], [60, 40, 5.5], [50, 58, 5]]) circle(c, x, y, rr);
    });
    if (d === b) cut(b, c => rotated(c, tilt, 50, 50, cc => { for (const [x, y, rr] of [[38, 38, 6], [60, 40, 5.5], [50, 58, 5]]) { cc.lineWidth = 1.6; cc.beginPath(); cc.arc(x, y, rr, 0, TAU); cc.stroke(); } }));
    rotated(b, tilt, 50, 50, c => { roundRect(c, 46, 84, 4, 8, 2); circle(c, 48, 93, 3); }); // 牽絲的起司
  }
};

// 爆米花：條紋紙桶，上面堆滿雲朵狀的爆米花
export const popcorn = {
  ...salty, id: 'popcorn', name: '爆米花',
  draw(o) {
    const { L, r, cut } = o, b = L(0), box = accentOr(o);
    for (let k = 0; k < 14; k++) {
      const x = range(r, 28, 72), y = range(r, 22, 44), s = range(r, 4.5, 6.5);
      for (let j = 0; j < 3; j++) { const a = j * TAU / 3 + k; circle(b, x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6, s * 0.7); }
    }
    poly(box, [[24, 44], [76, 44], [68, 94], [32, 94]]);
    cut(box, c => { for (let k = 0; k < 4; k++) { const x0 = 30 + k * 12.5, x1 = 35 + k * 9.5; poly(c, [[x0, 44], [x0 + 6, 44], [x1 + 4.5, 94], [x1, 94]]); } });
    if (box === b) cut(b, c => c.fillRect(20, 42.5, 60, 1.8));
    cut(box, c => roundRect(c, 37, 58, 26, 12, 3));                                        // 紙桶上的標籤
    if (box !== detail(o)) roundRect(detail(o), 41, 62, 18, 4, 2);
  }
};

export const SAVORY = [fries, burger, ramen, onigiri, gyoza, xiaolongbao, pizza, popcorn];
