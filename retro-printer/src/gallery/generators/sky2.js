// 第 4 批：★ 天空與宇宙（下）。全部是原創造型；星座名稱都是虛構的。
import { TAU, pick, range, circle, ellipse, roundRect, poly, accent } from './parts.js';

const base = { theme: 'sky', star: true, layouts: ['center', 'repeat', 'grid3', 'badge', 'bigtype'], colors: [2, 3] };
const detail = o => (o.n > 1 ? o.L(o.n - 1) : o.L(0));
const FONT = '"Helvetica Neue", Helvetica, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif';

function star4(x, cx, cy, s) {
  poly(x, [[cx, cy - s], [cx + s * 0.28, cy - s * 0.28], [cx + s, cy], [cx + s * 0.28, cy + s * 0.28],
    [cx, cy + s], [cx - s * 0.28, cy + s * 0.28], [cx - s, cy], [cx - s * 0.28, cy - s * 0.28]]);
}
function star5(x, cx, cy, R, rr = R * 0.45, rot = -Math.PI / 2) {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + i * Math.PI / 5, d = i % 2 ? rr : R;
    x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * d, cy + Math.sin(a) * d);
  }
  x.closePath(); x.fill();
}
function sprinkle(x, r, count, avoid = () => false) {
  for (let i = 0; i < count; i++) {
    const px = range(r, 4, 96), py = range(r, 4, 96);
    if (avoid(px, py)) continue;
    if (r() < 0.35) star4(x, px, py, range(r, 1.8, 3.6));
    else circle(x, px, py, range(r, 0.6, 1.2));
  }
}

// 自創星座：隨機的星點加連線，再配上虛構的星座名
const CONSTELLATIONS = ['刮板座', '墨滴座', '網框座', '小貓座', '吐司座', '茶杯座', '紙飛機座', '雨傘座', '毛線球座', '飯糰座', '拖鞋座', '牛奶盒座'];
export const constellation = {
  ...base, id: 'constellation', name: '自創星座', layouts: ['center', 'badge', 'grid3'],
  draw(o) {
    const { L, r } = o, n = 5 + Math.floor(r() * 4), pts = [];
    for (let i = 0; i < n; i++) pts.push([range(r, 14, 86), range(r, 12, 72)]);
    pts.sort((a, b) => a[0] - b[0]);
    const line = L(0);
    line.lineWidth = 1;
    line.beginPath();
    pts.forEach(([x, y], i) => line[i ? 'lineTo' : 'moveTo'](x, y));
    if (r() < 0.5) { const k = 1 + Math.floor(r() * (n - 2)); line.moveTo(...pts[k]); line.lineTo(range(r, 20, 80), range(r, 70, 80)); }
    line.stroke();
    const st = detail(o);
    pts.forEach(([x, y], i) => (i % 3 === 0 ? star5(st, x, y, 4.2) : circle(st, x, y, range(r, 1.6, 2.6))));
    if (o.n > 2) sprinkle(L(1), r, 34, (px, py) => py > 80);
    const name = pick(r, CONSTELLATIONS);
    const t = detail(o);
    t.save(); t.font = `500 8px ${FONT}`; t.textAlign = 'center'; t.textBaseline = 'middle';
    t.fillText(name, 50, 90); t.restore();
  }
};

// 銀河漩渦：用點和曲線構成
export const galaxy = {
  ...base, id: 'galaxy', name: '銀河',
  draw(o) {
    const { L, r } = o, arms = 2 + Math.floor(r() * 2), twist = range(r, 2.4, 3.6), rot = r() * TAU;
    const curve = L(0);
    curve.lineWidth = 2.2;
    for (let k = 0; k < arms; k++) {
      curve.beginPath();
      for (let t = 0; t <= 1; t += 0.02) {
        const a = rot + k / arms * TAU + t * twist, rad = 4 + t * 40;
        curve[t ? 'lineTo' : 'moveTo'](50 + Math.cos(a) * rad, 50 + Math.sin(a) * rad);
      }
      curve.stroke();
    }
    const dots = o.n > 2 ? L(1) : L(0);
    for (let i = 0; i < 90; i++) {
      const k = Math.floor(r() * arms), t = Math.pow(r(), 0.8), a = rot + k / arms * TAU + t * twist + range(r, -0.25, 0.25);
      const rad = 4 + t * 40 + range(r, -3, 3);
      circle(dots, 50 + Math.cos(a) * rad, 50 + Math.sin(a) * rad, range(r, 0.5, 1.6) * (1.3 - t * 0.6));
    }
    circle(detail(o), 50, 50, 6);
    star4(detail(o), 50, 50, 11);
  }
};

// 月球表面：坑洞以圓形堆疊
export const moonsurface = {
  ...base, id: 'moonsurface', name: '月球表面', layouts: ['center'],
  draw(o) {
    const { L, r, cut } = o, ground = L(0);
    ground.beginPath(); ground.arc(50, 150, 96, Math.PI * 1.18, Math.PI * 1.82); ground.lineTo(100, 100); ground.lineTo(0, 100); ground.closePath(); ground.fill();
    const rim = detail(o), craters = 6 + Math.floor(r() * 5);
    for (let i = 0; i < craters; i++) {
      const cx = range(r, 8, 92), cy = range(r, 66, 96), rad = range(r, 2.5, 7);
      if (Math.hypot(cx - 50, cy - 150) > 94) continue;
      rim.lineWidth = 1.2;
      rim.beginPath(); rim.ellipse(cx, cy, rad, rad * 0.45, 0, 0, TAU); rim.stroke();
      cut(ground, x => ellipse(x, cx, cy + rad * 0.08, rad * 0.85, rad * 0.32));
    }
    const sky = o.n > 2 ? L(1) : detail(o);
    circle(sky, range(r, 20, 80), range(r, 18, 34), range(r, 8, 13));   // 遠方的星球
    sprinkle(detail(o), r, 14, (px, py) => py > 52);
  }
};

// 日蝕或月蝕：兩個圓重疊，剛好展示套色效果
export const eclipse = {
  ...base, id: 'eclipse', name: '日月蝕',
  draw(o) {
    const { L, T, r } = o, sun = L(0), moon = detail(o), shift = range(r, 9, 20) * (r() < 0.5 ? -1 : 1);
    // 日冕：網點光暈
    const glow = T(0), g = glow.createRadialGradient(50, 50, 22, 50, 50, 46);
    g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    glow.fillStyle = g; glow.beginPath(); glow.arc(50, 50, 46, 0, TAU); glow.fill();
    circle(sun, 50, 50, 24);
    const mid = accent(o);
    if (mid) for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; poly(mid, [[50 + Math.cos(a - 0.08) * 27, 50 + Math.sin(a - 0.08) * 27], [50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36], [50 + Math.cos(a + 0.08) * 27, 50 + Math.sin(a + 0.08) * 27]]); }
    circle(moon, 50 + shift, 50 - shift * 0.4, 23);
  }
};

// 極光：幾道波浪色帶，下方有山的剪影
export const aurora = {
  ...base, id: 'aurora', name: '極光', layouts: ['center'],
  draw(o) {
    const { L, T, r } = o, bands = 2 + Math.floor(r() * 2);
    // 每道極光是一片光簾：沿著彎曲的上緣，一條條垂直的光往下垂，越往下越淡
    for (let b = 0; b < bands; b++) {
      const t = T(b % Math.max(1, o.n - 1)), y0 = 18 + b * 12, amp = range(r, 4, 9), ph = r() * TAU;
      const x0 = range(r, 4, 14), x1 = range(r, 86, 96), thick = range(r, 24, 36);
      const top = x => y0 + Math.sin(x / 16 + ph) * amp;
      const env = x => Math.pow(Math.sin(Math.PI * (x - x0) / (x1 - x0)), 0.5);
      for (let x = x0; x <= x1; x += 2.4) {
        const y = top(x), h = thick * env(x) * range(r, 0.75, 1);
        const g = t.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        t.fillStyle = g;
        t.fillRect(x, y, 1.7, h);
      }
    }
    const m = detail(o);
    m.beginPath(); m.moveTo(0, 100); m.lineTo(0, 80);
    let x = 0;
    while (x < 100) { const nx = x + range(r, 22, 34); m.lineTo((x + nx) / 2, range(r, 62, 72)); m.lineTo(nx, range(r, 80, 86)); x = nx; }
    m.lineTo(100, 100); m.closePath(); m.fill();
    sprinkle(m, r, 10, (px, py) => py > 30);
  }
};

// 望遠鏡和滿天星星
export const telescope = {
  ...base, id: 'telescope', name: '望遠鏡',
  draw(o) {
    const { L, r } = o, body = L(0), d = detail(o), ang = range(r, -0.75, -0.45);
    d.lineWidth = 2.2;
    for (const [fx, fy] of [[34, 96], [50, 98], [64, 96]]) { d.beginPath(); d.moveTo(50, 64); d.lineTo(fx, fy); d.stroke(); }
    body.save(); body.translate(50, 62); body.rotate(ang);
    roundRect(body, -30, -6, 52, 12, 3);
    roundRect(body, 20, -8, 12, 16, 2);
    roundRect(body, -38, -4, 10, 8, 2);
    body.restore();
    d.save(); d.translate(50, 62); d.rotate(ang); d.fillRect(-2, -7, 4, 14); d.restore();
    const sky = o.n > 2 ? L(1) : d;
    const tip = [50 + Math.cos(ang) * 40, 62 + Math.sin(ang) * 40];
    star5(sky, tip[0] + 6, tip[1] - 14, 6);
    sprinkle(sky, r, 16, (px, py) => py > 56 || Math.hypot(px - tip[0] - 6, py - tip[1] + 14) < 9);
  }
};

// 人造衛星：太陽能板加天線的簡單造型
export const satellite = {
  ...base, id: 'satellite', name: '人造衛星',
  draw(o) {
    const { L, r, cut } = o, panel = L(0), d = detail(o), tilt = range(r, -0.6, 0.6);
    const tr = x => { x.save(); x.translate(50, 50); x.rotate(tilt); x.translate(-50, -50); };
    tr(panel);
    panel.fillRect(6, 40, 30, 20); panel.fillRect(64, 40, 30, 20);
    panel.restore();
    cut(panel, x => {
      tr(x); x.lineWidth = 1.2;
      for (const ox of [6, 64]) {
        for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(ox + i * 7.5, 40); x.lineTo(ox + i * 7.5, 60); x.stroke(); }
        x.beginPath(); x.moveTo(ox, 50); x.lineTo(ox + 30, 50); x.stroke();
      }
      x.restore();
    });
    tr(d);
    d.fillRect(36, 48, 28, 4);                      // 支架
    roundRect(d, 40, 38, 20, 24, 3);                // 本體
    d.lineWidth = 1.6; d.beginPath(); d.moveTo(50, 38); d.lineTo(50, 24); d.stroke();
    d.beginPath(); d.arc(50, 22, 7, 0.1 * Math.PI, 0.9 * Math.PI); d.closePath(); d.fill();
    d.restore();
    const a = accent(o);
    if (a) { tr(a); roundRect(a, 44, 44, 12, 12, 2); a.restore(); }
    if (o.n > 1) { const s = d; for (let i = 0; i < 3; i++) { s.lineWidth = 0.9; s.beginPath(); s.arc(50, 20, 10 + i * 5, 1.25 * Math.PI, 1.75 * Math.PI); s.stroke(); } }
  }
};

// 外星小生物：觸角、單眼，隨機配色
export const alien = {
  ...base, id: 'alien', name: '外星小生物',
  draw(o) {
    const { L, r, cut } = o, body = L(0), eyes = pick(r, [1, 1, 2, 3]), d = detail(o);
    ellipse(body, 50, 56, 26, 28);
    body.lineWidth = 2.5;
    for (const s of [-1, 1]) {
      body.beginPath(); body.moveTo(50 + s * 10, 32); body.quadraticCurveTo(50 + s * 22, 20, 50 + s * 18, 12); body.stroke();
      circle(o.n > 2 ? L(1) : body, 50 + s * 18, 12, 4);
    }
    for (let i = 0; i < 3; i++) roundRect(body, 30 + i * 15, 78, 9, 14, 4.5);
    const er = eyes === 1 ? 11 : 6.5;
    for (let e = 0; e < eyes; e++) {
      const ex = eyes === 1 ? 50 : 50 + (e - (eyes - 1) / 2) * 15, ey = 50;
      cut(body, x => circle(x, ex, ey, er));
      circle(o.n > 1 ? d : body, ex, ey + er * 0.15, er * 0.5);
    }
    if (o.n > 1) { d.lineWidth = 2; d.beginPath(); d.arc(50, 64, 7, 0.15 * Math.PI, 0.85 * Math.PI); d.stroke(); }
    const a = accent(o);
    if (a) for (let i = 0; i < 4; i++) circle(a, range(r, 32, 68), range(r, 66, 78), range(r, 1.5, 3));
  }
};

// 星星糖罐：玻璃罐裡裝滿小星星
export const starjar = {
  ...base, id: 'starjar', name: '星星糖罐',
  draw(o) {
    const { L, r } = o, d = detail(o);
    // 罐子：粗輪廓
    d.lineWidth = 2.6;
    d.beginPath(); d.moveTo(30, 26); d.lineTo(30, 32); d.quadraticCurveTo(18, 38, 18, 52); d.lineTo(18, 84);
    d.quadraticCurveTo(18, 94, 30, 94); d.lineTo(70, 94); d.quadraticCurveTo(82, 94, 82, 84); d.lineTo(82, 52);
    d.quadraticCurveTo(82, 38, 70, 32); d.lineTo(70, 26); d.stroke();
    roundRect(o.n > 2 ? L(1) : d, 26, 14, 48, 12, 3);                   // 蓋子
    // 罐裡的星星
    for (let i = 0; i < 26; i++) {
      const x = range(r, 26, 74), y = range(r, 50, 88);
      const layer = L(Math.floor(r() * Math.max(1, o.n - (o.n > 2 ? 1 : 0))));
      star5(layer, x, y, range(r, 3, 5), undefined, r() * TAU);
    }
    // 標籤上的小星星與反光
    if (o.n > 1) { d.lineWidth = 1.6; d.beginPath(); d.moveTo(25, 46); d.lineTo(25, 64); d.stroke(); }
    if (r() < 0.6) sprinkle(L(0), r, 6, (px, py) => px > 14 && px < 86);
  }
};

export const SKY_B = [constellation, galaxy, moonsurface, eclipse, aurora, telescope, satellite, alien, starjar];
