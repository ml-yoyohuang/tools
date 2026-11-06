import { seeded } from '../engine/random.js';
import { DESIGN_PX } from './registration.js';
import { SAMPLES } from './samples.js';

// 圖庫：用程式生成的原創圖，2–4 色、平塗為主。
// 每張圖以固定種子生成，所以同一張永遠長一樣；排列順序由提供圖片站每次打亂。
// 座標為 0..360（圖案區的紙張座標）。
const GROUND = '#F5F0E6';   // 與紙色相同，分色時視為紙

const COMBOS = [
  ['#F07C6A', '#F2B632', '#3E8E5A', '#2C3D62'],
  ['#2C3D62', '#EE7F3A', '#7FC2DC', '#F2B632'],
  ['#D9483B', '#2A8C8C', '#E8B23A', '#222222'],
  ['#3B5BA9', '#F28FAD', '#F2C14E', '#1E1E1E'],
  ['#E9573F', '#4A7C59', '#F4C542', '#2E2E2E'],
  ['#1F6F78', '#F2A541', '#C8553D', '#8A5A44'],
  ['#7A4EAB', '#F6AE2D', '#2F9C95', '#E86A92'],
  ['#264653', '#E76F51', '#E9C46A', '#2A9D8F']
];

const GENERATORS = {
  leaves(x, r, c) {
    for (let i = 0; i < 7; i++) {
      const cx = 50 + r() * 260, cy = 50 + r() * 260, a = r() * Math.PI, len = 50 + r() * 50;
      x.save(); x.translate(cx, cy); x.rotate(a);
      x.fillStyle = c[i % 2];
      x.beginPath(); x.ellipse(0, 0, len, len * 0.38, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = GROUND; x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(-len * 0.85, 0); x.lineTo(len * 0.85, 0); x.stroke();
      x.restore();
    }
  },
  sea(x, r, c) {
    x.fillStyle = c[2];
    x.beginPath(); x.arc(110 + r() * 140, 90 + r() * 30, 40 + r() * 15, 0, Math.PI * 2); x.fill();
    const bands = 5, amp = 8 + r() * 8, wl = 50 + r() * 40;
    for (let b = 0; b < bands; b++) {
      x.fillStyle = b % 2 ? c[0] : c[1];
      const y0 = 190 + b * 34;
      x.beginPath(); x.moveTo(0, 360);
      for (let px = 0; px <= 360; px += 6) x.lineTo(px, y0 + Math.sin(px / wl * Math.PI * 2 + b) * amp);
      x.lineTo(360, 360); x.fill();
    }
  },
  fruit(x, r, c) {
    const cx = 180, cy = 180, R = 130;
    x.fillStyle = c[1]; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
    x.fillStyle = c[2]; x.beginPath(); x.arc(cx, cy, R - 14, 0, Math.PI * 2); x.fill();
    const n = 8 + Math.floor(r() * 4);
    x.fillStyle = c[0];
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2 + 0.06, a1 = (i + 1) / n * Math.PI * 2 - 0.06;
      x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R - 24, a0, a1); x.closePath(); x.fill();
    }
    x.fillStyle = c[2]; x.beginPath(); x.arc(cx, cy, 14, 0, Math.PI * 2); x.fill();
  },
  waves(x, r, c) {
    const n = 7 + Math.floor(r() * 4), amp = 10 + r() * 14, wl = 60 + r() * 60;
    for (let i = 0; i < n; i++) {
      x.strokeStyle = c[i % 2]; x.lineWidth = 12 + r() * 8; x.lineCap = 'round';
      x.beginPath();
      const y0 = 30 + i * (300 / (n - 1));
      for (let px = 20; px <= 340; px += 5) x[px === 20 ? 'moveTo' : 'lineTo'](px, y0 + Math.sin(px / wl * Math.PI * 2 + i * 0.6) * amp);
      x.stroke();
    }
  },
  dots(x, r, c) {
    const g = 6 + Math.floor(r() * 3), step = 300 / g;
    for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
      const k = (i + j) % 3;
      x.fillStyle = c[k];
      const rad = step * (0.18 + 0.3 * r());
      x.beginPath(); x.arc(30 + step * (i + 0.5), 30 + step * (j + 0.5), rad, 0, Math.PI * 2); x.fill();
    }
  },
  sun(x, r, c) {
    const n = 12 + Math.floor(r() * 8), cx = 180, cy = 180;
    x.fillStyle = c[1];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, w = Math.PI / n * 0.55;
      x.beginPath();
      x.moveTo(cx + Math.cos(a - w) * 95, cy + Math.sin(a - w) * 95);
      x.lineTo(cx + Math.cos(a) * 165, cy + Math.sin(a) * 165);
      x.lineTo(cx + Math.cos(a + w) * 95, cy + Math.sin(a + w) * 95);
      x.fill();
    }
    x.fillStyle = c[0]; x.beginPath(); x.arc(cx, cy, 88, 0, Math.PI * 2); x.fill();
    // 五官鏤空成紙色
    x.fillStyle = GROUND;
    x.beginPath(); x.arc(cx - 30, cy - 10, 9, 0, Math.PI * 2); x.arc(cx + 30, cy - 10, 9, 0, Math.PI * 2); x.fill();
    x.strokeStyle = GROUND; x.lineWidth = 8; x.lineCap = 'round';
    x.beginPath(); x.arc(cx, cy + 10, 34, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
  },
  arches(x, r, c) {
    const n = 4 + Math.floor(r() * 2), w = 300 / n;
    for (let i = 0; i < n; i++) {
      x.fillStyle = c[i % 4];
      x.beginPath(); x.arc(180, 300, 150 - i * w / 2 * 1.0, Math.PI, 0); x.fill();
    }
    x.fillStyle = GROUND; x.beginPath(); x.arc(180, 300, 150 - n * w / 2, Math.PI, 0); x.fill();
    x.fillStyle = c[0]; x.fillRect(30, 300, 300, 12);
  },
  tiles(x, r, c) {
    const g = 4 + Math.floor(r() * 3), s = 300 / g;
    for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
      const px = 30 + i * s, py = 30 + j * s, t = Math.floor(r() * 4);
      x.fillStyle = c[(i + j) % 2];
      x.beginPath();
      if (t === 0) { x.moveTo(px, py); x.lineTo(px + s, py); x.lineTo(px, py + s); }
      else if (t === 1) { x.moveTo(px + s, py); x.lineTo(px + s, py + s); x.lineTo(px, py + s); }
      else if (t === 2) x.arc(px, py, s, 0, Math.PI / 2);
      else x.arc(px + s, py + s, s, Math.PI, Math.PI * 1.5);
      x.lineTo(px + (t === 2 ? 0 : s), py + (t === 2 ? 0 : s));
      x.fill();
    }
  }
};

const NAMES = { leaves: '葉', sea: '海', fruit: '果', waves: '波', dots: '點', sun: '日', arches: '拱', tiles: '磚' };
const COLORS = { leaves: 2, sea: 3, fruit: 3, waves: 2, dots: 3, sun: 2, arches: 4, tiles: 2 };

// 圖庫清單：手繪的三張，加上每個生成器三張
export const LIBRARY = [
  ...SAMPLES.map(s => ({ id: s.id, name: s.name, colors: s.colors, draw: x => s.draw(x) })),
  ...Object.keys(GENERATORS).flatMap((key, gi) => [1, 2, 3].map(v => {
    const seed = 1000 + gi * 10 + v;
    return {
      id: `${key}-${v}`, name: `${NAMES[key]} ${v}`, colors: COLORS[key],
      draw: x => {
        const rnd = seeded(seed);
        const combo = COMBOS[Math.floor(rnd() * COMBOS.length)];
        GENERATORS[key](x, rnd, combo);
      }
    };
  }))
];

function render(item, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d'), k = size / 360;
  x.setTransform(k, 0, 0, k, 0, 0);
  x.fillStyle = GROUND;
  x.fillRect(0, 0, 360, 360);
  item.draw(x);
  return c;
}

export const thumbOf = (item, size = 112) => render(item, size);

// 製版用的圖：{ id, name, colors, canvas, data, w, h }
const cache = new Map();
export function libraryImage(id) {
  if (cache.has(id)) return cache.get(id);
  const item = LIBRARY.find(i => i.id === id) || LIBRARY[0];
  const canvas = render(item, DESIGN_PX);
  const data = canvas.getContext('2d').getImageData(0, 0, DESIGN_PX, DESIGN_PX).data;
  const image = { id: item.id, name: item.name, colors: item.colors, canvas, data, w: DESIGN_PX, h: DESIGN_PX };
  cache.set(item.id, image);
  return image;
}

export { GROUND };
