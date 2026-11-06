// 第 1 批：★ 可愛角色（上）。全部是原創造型，用最簡單的幾何圖形組成。
import { TAU, pick, range, circle, ellipse, roundRect, poly, mark, accent, face } from './parts.js';

const UNIT_LAYOUTS = ['center', 'repeat', 'grid3', 'badge', 'bigtype'];
const base = { theme: 'characters', star: true, layouts: UNIT_LAYOUTS, colors: [2, 3] };

// 幾何小動物：圓臉貓、方形熊、三角狐狸
export const critters = {
  ...base, id: 'critters', name: '小動物',
  draw(o) {
    const { L, r } = o, body = L(0), kind = pick(r, ['cat', 'bear', 'fox']);
    if (kind === 'cat') {
      poly(body, [[24, 40], [30, 14], [46, 30]]);
      poly(body, [[76, 40], [70, 14], [54, 30]]);
      circle(body, 50, 56, 32);
      face(o, 50, 58, 26, { mouth: pick(r, ['cat', 'smile', 'o']) });
      mark(o, x => {
        x.lineWidth = 1.4;
        for (const s of [-1, 1]) for (const dy of [-3, 3]) {
          x.beginPath(); x.moveTo(50 + s * 18, 66 + dy); x.lineTo(50 + s * 34, 63 + dy * 2); x.stroke();
        }
      });
    } else if (kind === 'bear') {
      circle(body, 25, 26, 12); circle(body, 75, 26, 12);
      roundRect(body, 18, 26, 64, 62, 18);
      const a = accent(o);
      if (a) { circle(a, 25, 26, 6); circle(a, 75, 26, 6); ellipse(a, 50, 70, 13, 10); }
      face(o, 50, 56, 26, { mouth: pick(r, ['smile', 'flat', 'o']), blush: false });
      mark(o, x => ellipse(x, 50, 64, 4.5, 3.2));
    } else {
      poly(body, [[14, 22], [86, 22], [50, 88]]);
      poly(body, [[14, 22], [24, 4], [36, 22]]);
      poly(body, [[86, 22], [76, 4], [64, 22]]);
      const a = accent(o);
      if (a) { poly(a, [[20, 21], [25, 11], [31, 21]]); poly(a, [[80, 21], [75, 11], [69, 21]]); }
      face(o, 50, 44, 24, { mouth: pick(r, ['cat', 'smile']), gap: 0.5 });
      mark(o, x => circle(x, 50, 80, 3.5));
    }
  }
};

// 有表情的物件：笑臉、眨眼的杯子、刮板吉祥物
export const objects = {
  ...base, id: 'objects', name: '表情小物',
  draw(o) {
    const { L, r } = o, body = L(0), kind = pick(r, ['smiley', 'cup', 'squeegee']);
    if (kind === 'smiley') {
      circle(body, 50, 50, 42);
      face(o, 50, 52, 36);
    } else if (kind === 'cup') {
      roundRect(body, 22, 34, 46, 54, 10);
      mark(o, x => {
        x.lineWidth = 5;
        x.beginPath(); x.arc(70, 58, 11, -Math.PI / 2, Math.PI / 2); x.stroke();
        x.lineWidth = 2.2;
        for (const sx of [34, 46, 58]) {
          x.beginPath(); x.moveTo(sx, 28);
          x.bezierCurveTo(sx - 5, 22, sx + 5, 18, sx, 10); x.stroke();
        }
      });
      face(o, 45, 62, 20, { eyes: 'wink' });
    } else {
      roundRect(body, 30, 14, 40, 52, 8);           // 握把
      mark(o, x => roundRect(x, 16, 66, 68, 12, 3)); // 刮刀膠條
      face(o, 50, 40, 18, { mouth: pick(r, ['open', 'smile', 'tongue']) });
      mark(o, x => {
        x.lineWidth = 3;
        x.beginPath(); x.moveTo(30, 40); x.lineTo(18, 30); x.stroke();
        x.beginPath(); x.moveTo(70, 40); x.lineTo(82, 30); x.stroke();
      });
    }
  }
};

// 小怪獸：眼睛數量、角、斑點都隨機
export const monster = {
  ...base, id: 'monster', name: '小怪獸',
  draw(o) {
    const { L, r, cut } = o, body = L(0);
    const k = 6 + Math.floor(r() * 4), ph = r() * TAU, wob = range(r, 2, 6);
    body.beginPath();
    for (let i = 0; i <= 60; i++) {
      const a = i / 60 * TAU, rad = 36 + Math.sin(a * k + ph) * wob * (a > Math.PI ? 0.3 : 1);
      body[i ? 'lineTo' : 'moveTo'](50 + Math.cos(a) * rad, 56 + Math.sin(a) * rad);
    }
    body.closePath(); body.fill();
    const horns = Math.floor(r() * 3);
    for (let h = 0; h < horns; h++) {
      const hx = horns === 1 ? 50 : 34 + h * 32;
      poly(body, [[hx - 7, 26], [hx + (h ? 4 : -4), 6], [hx + 7, 26]]);
    }
    const a = accent(o);
    if (a) for (let s = 0; s < 6; s++) circle(a, range(r, 24, 76), range(r, 60, 84), range(r, 2.5, 5));
    const eyes = 1 + Math.floor(r() * 3), er = eyes === 1 ? 11 : 7;
    for (let e = 0; e < eyes; e++) {
      const ex = eyes === 1 ? 50 : 50 + (e - (eyes - 1) / 2) * 18, ey = 46 - (eyes === 3 && e === 1 ? 6 : 0);
      cut(body, x => circle(x, ex, ey, er));
      // 瞳孔：有深色層就用深色；只剩一層時用身體的顏色點在眼白裡
      const pupil = o.n > 1 ? L(o.n - 1) : body;
      circle(pupil, ex + er * 0.2, ey + er * 0.2, er * 0.5);
    }
    mark(o, x => {
      x.lineWidth = 2.4;
      x.beginPath(); x.arc(50, 64, 12, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    });
    cut(body, x => { poly(x, [[44, 75], [47, 75], [45.5, 79]]); poly(x, [[53, 75], [56, 75], [54.5, 79]]); });
  }
};

// 墨水滴寶寶：工作室的吉祥物
export const inkdrop = {
  ...base, id: 'inkdrop', name: '墨水滴寶寶',
  draw(o) {
    const { L, r, cut } = o, body = L(0);
    body.beginPath();
    body.moveTo(50, 8);
    body.bezierCurveTo(60, 30, 82, 46, 82, 64);
    body.arc(50, 64, 32, 0, Math.PI);
    body.bezierCurveTo(18, 46, 40, 30, 50, 8);
    body.fill();
    cut(body, x => ellipse(x, 36, 52, 4, 8, 0.4));   // 反光
    face(o, 52, 68, 22);
    const a = accent(o);
    const splash = o.n > 1 ? L(o.n - 1) : body;
    for (let i = 0; i < 4; i++) circle(splash, range(r, 6, 94), range(r, 90, 98), range(r, 1.5, 3));
    if (a && r() < 0.5) { circle(a, 86, 22, 4); circle(a, 14, 30, 3); }
  }
};

// 食物角色：吐司人、飯糰、牛奶盒
export const foodpals = {
  ...base, id: 'foodpals', name: '食物角色',
  draw(o) {
    const { L, r } = o, body = L(0), kind = pick(r, ['toast', 'riceball', 'milk']);
    if (kind === 'toast') {
      circle(body, 32, 32, 18); circle(body, 68, 32, 18);
      roundRect(body, 14, 30, 72, 60, 8);
      const a = accent(o);
      if (a) roundRect(a, 22, 40, 56, 42, 6);        // 吐司心
      face(o, 50, 60, 22);
    } else if (kind === 'riceball') {
      body.beginPath();
      body.moveTo(50, 12);
      body.quadraticCurveTo(92, 78, 82, 86); body.quadraticCurveTo(50, 96, 18, 86);
      body.quadraticCurveTo(8, 78, 50, 12); body.fill();
      mark(o, x => roundRect(x, 34, 70, 32, 22, 3));   // 海苔
      face(o, 50, 52, 18, { mouth: pick(r, ['smile', 'o', 'cat']) });
    } else {
      poly(body, [[26, 30], [50, 12], [74, 30], [74, 90], [26, 90]]);
      const a = accent(o);
      if (a) poly(a, [[26, 70], [74, 62], [74, 90], [26, 90]]);   // 包裝上的色帶
      mark(o, x => { x.lineWidth = 2; x.beginPath(); x.moveTo(26, 30); x.lineTo(74, 30); x.stroke(); });
      face(o, 50, 50, 18);
    }
  }
};

// 雲朵寶寶：帶腮紅，有時會下小雨
export const cloudbaby = {
  ...base, id: 'cloudbaby', name: '雲朵寶寶',
  draw(o) {
    const { L, r } = o, body = L(0), rain = r() < 0.45;
    const cy = rain ? 40 : 52;
    circle(body, 30, cy + 6, 16); circle(body, 50, cy - 6, 22); circle(body, 70, cy + 4, 17);
    roundRect(body, 16, cy + 2, 68, 22, 11);
    face(o, 50, cy + 6, 18);
    if (rain) {
      const drops = o.n > 1 ? L(o.n - 1) : body;
      for (let i = 0; i < 6; i++) {
        const x = 24 + i * 10 + range(r, -2, 2), y = cy + 36 + (i % 2) * 10;
        drops.beginPath(); drops.moveTo(x, y); drops.quadraticCurveTo(x + 3, y + 6, x, y + 8);
        drops.quadraticCurveTo(x - 3, y + 6, x, y); drops.fill();
      }
    }
  }
};

// 小幽靈：飄在空中，下襬呈波浪狀
export const ghost = {
  ...base, id: 'ghost', name: '小幽靈',
  draw(o) {
    const { L, r } = o, body = L(0), waves = 3 + Math.floor(r() * 3), tilt = range(r, -0.15, 0.15);
    body.save(); body.translate(50, 50); body.rotate(tilt); body.translate(-50, -50);
    body.beginPath();
    body.moveTo(20, 84);
    body.lineTo(20, 44); body.arc(50, 44, 30, Math.PI, 0); body.lineTo(80, 84);
    const w = 60 / waves;
    for (let i = 0; i < waves; i++) {
      const x0 = 80 - i * w;
      body.quadraticCurveTo(x0 - w / 2, 96, x0 - w, 84);
    }
    body.fill();
    ellipse(body, 16, 58, 7, 4, -0.5); ellipse(body, 84, 58, 7, 4, 0.5);   // 小手
    body.restore();
    face(o, 50, 48, 20, { eyes: pick(r, ['big', 'dot', 'sleepy']), mouth: pick(r, ['o', 'open', 'smile']) });
    const a = accent(o);
    if (a) ellipse(a, 50, 98, 20, 2.5);                                     // 地上的影子
  }
};

// 圓滾滾的小恐龍
export const dino = {
  ...base, id: 'dino', name: '小恐龍',
  draw(o) {
    const { L, r } = o, body = L(0), flip = r() < 0.5;
    body.save();
    if (flip) { body.translate(100, 0); body.scale(-1, 1); }
    ellipse(body, 50, 62, 30, 24);                         // 身體
    circle(body, 74, 36, 16);                               // 頭
    poly(body, [[24, 58], [4, 76], [30, 76]]);              // 尾巴
    roundRect(body, 34, 78, 9, 14, 4); roundRect(body, 56, 78, 9, 14, 4);   // 腳
    body.restore();
    const spikes = o.n > 2 ? L(1) : (o.n > 1 ? L(o.n - 1) : null);
    if (spikes) {
      spikes.save();
      if (flip) { spikes.translate(100, 0); spikes.scale(-1, 1); }
      // 背刺沿著身體上緣排列，避開頭部
      for (let i = 0; i < 4; i++) {
        const sx = 26 + i * 9, sy = 62 - 24 * Math.sqrt(1 - ((sx - 50) / 30) ** 2) + 2;
        poly(spikes, [[sx - 4, sy + 2], [sx, sy - 7], [sx + 4, sy + 2]]);
      }
      spikes.restore();
    }
    const fx = flip ? 26 : 74;
    face(o, fx, 38, 12, { blush: false, mouth: pick(r, ['smile', 'open']) });
  }
};

export const CHARACTERS_A = [critters, objects, monster, inkdrop, foodpals, cloudbaby, ghost, dino];
