// 第 2 批：★ 可愛角色（下）。全部是原創造型，用最簡單的幾何圖形組成。
import { TAU, pick, range, circle, ellipse, roundRect, poly, mark, accent, face } from './parts.js';

const UNIT_LAYOUTS = ['center', 'repeat', 'grid3', 'badge', 'bigtype'];
const base = { theme: 'characters', star: true, layouts: UNIT_LAYOUTS, colors: [2, 3] };

// 刺蝟：背上的刺用圓點或三角形排列
export const hedgehog = {
  ...base, id: 'hedgehog', name: '刺蝟',
  draw(o) {
    const { L, r } = o, body = L(0), dots = r() < 0.5;
    const spikes = o.n > 2 ? L(1) : (o.n > 1 ? L(o.n - 1) : body);
    // 刺：沿著背的半圓排幾圈
    for (let ring = 0; ring < 3; ring++) {
      const R = 34 - ring * 9, count = 9 - ring * 2;
      for (let i = 0; i < count; i++) {
        const a = Math.PI * (1.05 + 0.9 * i / (count - 1)), x = 46 + Math.cos(a) * R, y = 62 + Math.sin(a) * R;
        if (dots) circle(spikes, x, y, 4.2 - ring * 0.6);
        else poly(spikes, [[x + Math.cos(a) * 9, y + Math.sin(a) * 9], [x + Math.cos(a + 1.6) * 4, y + Math.sin(a + 1.6) * 4], [x + Math.cos(a - 1.6) * 4, y + Math.sin(a - 1.6) * 4]]);
      }
    }
    ellipse(body, 50, 64, 34, 22);                              // 身體
    poly(body, [[72, 52], [94, 66], [72, 76]]);                  // 尖鼻子
    mark(o, x => { circle(x, 93, 66, 3); circle(x, 76, 60, 2.6); });
    roundRect(body, 32, 80, 8, 10, 3); roundRect(body, 56, 80, 8, 10, 3);
    const a = accent(o);
    if (a) ellipse(a, 72, 70, 4, 2.5);
  }
};

// 青蛙、鴨子、企鵝：最簡單的幾何造型
export const pond = {
  ...base, id: 'pond', name: '池邊朋友',
  draw(o) {
    const { L, r, cut } = o, body = L(0), kind = pick(r, ['frog', 'duck', 'penguin']);
    if (kind === 'frog') {
      circle(body, 30, 30, 14); circle(body, 70, 30, 14);
      ellipse(body, 50, 60, 40, 30);
      cut(body, x => { circle(x, 30, 30, 8); circle(x, 70, 30, 8); });
      mark(o, x => { circle(x, 31, 31, 4.5); circle(x, 71, 31, 4.5); x.lineWidth = 2.4; x.beginPath(); x.arc(50, 56, 20, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); });
      const a = accent(o);
      if (a) { ellipse(a, 26, 66, 6, 3.5); ellipse(a, 74, 66, 6, 3.5); }
    } else if (kind === 'duck') {
      circle(body, 58, 34, 18);
      ellipse(body, 48, 68, 34, 22);
      poly(body, [[14, 60], [24, 50], [26, 66]]);                // 尾巴
      const beak = o.n > 1 ? L(o.n > 2 ? 1 : o.n - 1) : body;
      ellipse(beak, 80, 38, 10, 5);
      mark(o, x => { circle(x, 62, 30, 3); x.lineWidth = 2; x.beginPath(); x.arc(46, 66, 14, 1.1 * Math.PI, 1.9 * Math.PI); x.stroke(); });
    } else {
      ellipse(body, 50, 56, 30, 38);
      poly(body, [[22, 50], [10, 70], [24, 72]]); poly(body, [[78, 50], [90, 70], [76, 72]]);   // 翅膀
      cut(body, x => ellipse(x, 50, 62, 19, 28));                // 白肚子
      const feet = o.n > 1 ? L(o.n > 2 ? 1 : o.n - 1) : body;
      ellipse(feet, 40, 94, 8, 4); ellipse(feet, 60, 94, 8, 4);
      poly(feet, [[44, 40], [56, 40], [50, 48]]);                // 嘴
      mark(o, x => { circle(x, 41, 32, 3); circle(x, 59, 32, 3); });
    }
  }
};

// 小章魚：觸手的數量和捲曲方向隨機
export const octopus = {
  ...base, id: 'octopus', name: '小章魚',
  draw(o) {
    const { L, r } = o, body = L(0), legs = 5 + Math.floor(r() * 4);
    const arm = L(o.n - 1);                                       // 觸手印在深色層，頭是淺色層
    arm.lineWidth = 7;
    for (let i = 0; i < legs; i++) {
      const t = i / (legs - 1), x0 = 26 + t * 48, dir = r() < 0.5 ? -1 : 1, len = range(r, 28, 38);
      const spread = (t - 0.5) * 22;                              // 外側的觸手往外張
      arm.beginPath(); arm.moveTo(x0, 56);
      arm.bezierCurveTo(x0 + spread * 0.4, 56 + len * 0.45, x0 + spread - dir * 9, 56 + len * 0.75, x0 + spread + dir * 7, 56 + len);
      arm.stroke();
      circle(arm, x0 + spread + dir * 7, 56 + len, 4.5);          // 捲起的末端
    }
    ellipse(body, 50, 34, 30, 28);
    const a = accent(o);
    if (a) for (let i = 0; i < 4; i++) circle(a, range(r, 30, 70), range(r, 12, 24), range(r, 2, 3.5));
    face(o, 50, 38, 18);
  }
};

// 蔬菜家族：紅蘿蔔、蘑菇、豌豆莢排排站
export const veggies = {
  ...base, id: 'veggies', name: '蔬菜家族', layouts: ['center', 'badge', 'grid3'],
  draw(o) {
    const { L, r } = o, body = L(0), leaf = o.n > 1 ? L(o.n - 1) : body;
    const pair = o.n > 2 ? L(1) : body;
    // 紅蘿蔔
    poly(body, [[8, 40], [30, 40], [19, 92]]);
    leaf.lineWidth = 3;
    for (const dx of [-5, 0, 5]) { leaf.beginPath(); leaf.moveTo(19, 40); leaf.lineTo(19 + dx * 1.6, 26); leaf.stroke(); }
    // 蘑菇
    pair.beginPath(); pair.arc(50, 52, 18, Math.PI, 0); pair.closePath(); pair.fill();
    roundRect(body, 43, 50, 14, 36, 5);
    if (pair !== body) for (const [cx, cy] of [[42, 44], [55, 40], [52, 48]]) o.cut(pair, x => circle(x, cx, cy, 2.6));
    // 豌豆莢
    leaf.beginPath(); leaf.moveTo(70, 82); leaf.quadraticCurveTo(64, 50, 82, 30); leaf.quadraticCurveTo(96, 54, 86, 84);
    leaf.quadraticCurveTo(78, 90, 70, 82); leaf.fill();
    for (let i = 0; i < 3; i++) o.cut(leaf, x => circle(x, 79 + i * 1.2, 46 + i * 12, 4.2));
    for (let i = 0; i < 3; i++) circle(body, 79 + i * 1.2, 46 + i * 12, 3.2);
    const kinds = ['dot', 'happy', 'sleepy'];
    mark(o, x => {
      for (const [cx, cy] of [[19, 56], [50, 66]]) {
        const k = pick(r, kinds);
        x.lineWidth = 1.6;
        for (const s of [-1, 1]) {
          if (k === 'dot') circle(x, cx + s * 3.5, cy, 1.4);
          else { x.beginPath(); x.arc(cx + s * 3.5, cy + (k === 'happy' ? 1 : -1), 2, k === 'happy' ? Math.PI * 1.15 : Math.PI * 0.15, k === 'happy' ? Math.PI * 1.85 : Math.PI * 0.85); x.stroke(); }
        }
        x.beginPath(); x.arc(cx, cy + 3, 2.6, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
      }
    });
  }
};

// 一筆畫小貓：只用一條連續的線構成，三色時旁邊墊一塊錯開的色塊
export const linecat = {
  ...base, id: 'linecat', name: '一筆畫小貓',
  draw(o) {
    const { L, r } = o, n = o.n, line = L(n - 1);
    const sit = r() < 0.5, tail = range(r, -1, 1);
    if (n > 1) {                                   // 墊底的色塊，故意錯開
      const blob = L(0), dx = range(r, -8, 8), dy = range(r, -6, 6);
      ellipse(blob, 50 + dx, 60 + dy, 28, sit ? 30 : 22);
    }
    line.lineWidth = 3;
    line.beginPath();
    // 從尾巴尖端起筆 → 背 → 耳朵 → 頭頂 → 另一耳 → 臉頰 → 胸前 → 腳 → 回到尾巴根部
    line.moveTo(86, 40 + tail * 10);
    line.bezierCurveTo(96, 62, 84, 84, 70, 86);
    line.lineTo(sit ? 34 : 24, 86);
    line.bezierCurveTo(sit ? 26 : 18, 86, sit ? 24 : 14, sit ? 70 : 76, sit ? 30 : 22, sit ? 58 : 62);
    line.lineTo(sit ? 30 : 22, 42);
    line.lineTo(sit ? 28 : 20, 22);
    line.lineTo(sit ? 38 : 30, 32);
    line.quadraticCurveTo(sit ? 46 : 38, 29, sit ? 54 : 46, 32);
    line.lineTo(sit ? 64 : 56, 22);
    line.lineTo(sit ? 62 : 54, 44);
    line.bezierCurveTo(sit ? 62 : 54, 52, sit ? 56 : 48, 56, sit ? 46 : 38, 56);
    line.bezierCurveTo(sit ? 58 : 62, 62, 70, 70, 70, 86);
    line.stroke();
    circle(line, sit ? 41 : 33, 42, 1.8); circle(line, sit ? 51 : 43, 42, 1.8);
    // 三色時，旁邊多一顆毛線球
    if (n > 2) {
      const yarn = L(1), yx = sit ? 16 : 84, yy = sit ? 82 : 22;
      circle(yarn, yx, yy, 9);
      o.cut(yarn, x => { x.lineWidth = 1.2; for (const k of [-4, 0, 4]) { x.beginPath(); x.arc(yx + k, yy, 9, -1, 1); x.stroke(); } });
      yarn.lineWidth = 1.4;
      yarn.beginPath(); yarn.moveTo(yx + (sit ? 8 : -8), yy); yarn.quadraticCurveTo(50, sit ? 98 : 8, sit ? 30 : 70, sit ? 90 : 14); yarn.stroke();
    }
  }
};

// 錯位雙影：同一個角色印兩次，刻意錯開，看起來像在發抖或分身
export const shaky = {
  ...base, id: 'shaky', name: '錯位雙影', layouts: ['center', 'grid3', 'repeat'],
  draw(o) {
    const { L, r } = o, n = o.n, who = pick(r, ['blob', 'cat', 'ghost']);
    const dx = range(r, 5, 9) * (r() < 0.5 ? -1 : 1), dy = range(r, -4, 4);
    const shape = (x, ox, oy) => {
      x.save(); x.translate(ox, oy);
      if (who === 'blob') ellipse(x, 50, 54, 32, 30);
      else if (who === 'cat') { poly(x, [[22, 40], [28, 14], [44, 30]]); poly(x, [[78, 40], [72, 14], [56, 30]]); circle(x, 50, 56, 32); }
      else { x.beginPath(); x.moveTo(20, 86); x.lineTo(20, 46); x.arc(50, 46, 30, Math.PI, 0); x.lineTo(80, 86); x.lineTo(65, 78); x.lineTo(50, 86); x.lineTo(35, 78); x.closePath(); x.fill(); }
      x.restore();
    };
    shape(L(0), 0, 0);
    if (n > 1) {
      // 最深的一層只印輪廓與五官，位置錯開：先印整個形狀，再挖掉縮小的內部
      const top = L(n - 1);
      shape(top, dx, dy);
      o.cut(top, x => { x.save(); x.translate(dx, dy); x.translate(50, 54); x.scale(0.86, 0.86); x.translate(-50, -54); shape(x, 0, 0); x.restore(); });
      if (n > 2) shape(L(1), -dx * 0.5, -dy * 0.5);
    }
    face(o, 50 + (n > 1 ? dx : 0), 56 + (n > 1 ? dy : 0), 22, { blush: false });
  }
};

// 頭像格子：同一個角色在 3×3 格子裡做出九種表情
export const ninefaces = {
  ...base, id: 'ninefaces', name: '九種表情', layouts: ['full'],
  draw(o) {
    const { L, r } = o, body = L(0), kind = pick(r, ['round', 'square', 'bear']);
    const eyes = ['dot', 'happy', 'sparkle', 'sleepy', 'wink', 'big', 'dot', 'happy', 'sleepy'];
    const mouths = ['smile', 'open', 'o', 'cat', 'flat', 'tongue', 'o', 'smile', 'open'];
    const order = eyes.map((_, i) => i).sort(() => r() - 0.5);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const cx = 18 + i * 32, cy = 18 + j * 32, k = order[j * 3 + i];
      if (kind === 'round') circle(body, cx, cy + 1, 13);
      else if (kind === 'square') roundRect(body, cx - 13, cy - 12, 26, 26, 6);
      else { circle(body, cx - 9, cy - 9, 5); circle(body, cx + 9, cy - 9, 5); circle(body, cx, cy + 1, 12.5); }
      face(o, cx, cy + 2, 12.5, { eyes: eyes[k], mouth: mouths[k] });
    }
  }
};

// 角色組合產生器：臉型、眼睛、嘴巴、耳朵、配件各自隨機
export const mixer = {
  ...base, id: 'mixer', name: '角色組合',
  draw(o) {
    const { L, r, cut } = o, body = L(0);
    const shape = pick(r, ['round', 'square', 'tri', 'blob', 'pill']);
    const ears = pick(r, ['cat', 'bear', 'bunny', 'antenna', 'horns', 'none']);
    const extra = pick(r, ['bow', 'hat', 'glasses', 'flower', 'none']);
    const deco = o.n > 2 ? L(1) : (o.n > 1 ? L(o.n - 1) : body);
    // 耳朵（畫在臉的後面）
    if (ears === 'cat') { poly(body, [[24, 42], [28, 16], [44, 32]]); poly(body, [[76, 42], [72, 16], [56, 32]]); }
    else if (ears === 'bear') { circle(body, 27, 30, 11); circle(body, 73, 30, 11); }
    else if (ears === 'bunny') { ellipse(body, 36, 18, 7, 18, -0.15); ellipse(body, 64, 18, 7, 18, 0.15); }
    else if (ears === 'antenna') {
      body.lineWidth = 2.5;
      body.beginPath(); body.moveTo(42, 32); body.lineTo(34, 10); body.moveTo(58, 32); body.lineTo(66, 10); body.stroke();
      circle(deco, 34, 10, 4.5); circle(deco, 66, 10, 4.5);
    } else if (ears === 'horns') { poly(body, [[30, 34], [26, 12], [40, 28]]); poly(body, [[70, 34], [74, 12], [60, 28]]); }
    // 臉
    if (shape === 'round') circle(body, 50, 56, 32);
    else if (shape === 'square') roundRect(body, 18, 26, 64, 62, 14);
    else if (shape === 'tri') poly(body, [[50, 22], [90, 88], [10, 88]]);
    else if (shape === 'pill') roundRect(body, 24, 22, 52, 70, 26);
    else {
      body.beginPath();
      const ph = r() * TAU;
      for (let i = 0; i <= 48; i++) {
        const a = i / 48 * TAU, rad = 32 + Math.sin(a * 3 + ph) * 3;
        body[i ? 'lineTo' : 'moveTo'](50 + Math.cos(a) * rad, 58 + Math.sin(a) * rad);
      }
      body.closePath(); body.fill();
    }
    const cy = shape === 'tri' ? 66 : 58;
    face(o, 50, cy, shape === 'tri' ? 18 : 24);
    // 配件
    if (extra === 'bow') { poly(deco, [[50, 24], [36, 16], [36, 32]]); poly(deco, [[50, 24], [64, 16], [64, 32]]); circle(deco, 50, 24, 4); }
    else if (extra === 'hat') { roundRect(deco, 34, 4, 32, 18, 3); roundRect(deco, 24, 20, 52, 6, 3); }
    else if (extra === 'glasses') mark(o, x => {
      x.lineWidth = 2;
      for (const s of [-1, 1]) { x.beginPath(); x.arc(50 + s * 11, cy - 3, 8, 0, TAU); x.stroke(); }
      x.beginPath(); x.moveTo(47, cy - 3); x.lineTo(53, cy - 3); x.stroke();
    });
    else if (extra === 'flower') {
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; circle(deco, 76 + Math.cos(a) * 5, 30 + Math.sin(a) * 5, 4); }
      cut(deco, x => circle(x, 76, 30, 2.5));
    }
  }
};

export const CHARACTERS_B = [hedgehog, pond, octopus, veggies, linecat, shaky, ninefaces, mixer];
