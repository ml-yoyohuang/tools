// 把「圖案 × 版面」畫成一層一層的遮罩（圖案區 0..360 座標）。
// 產生器在 0..100 的單位方格裡作畫；版面負責把單位方格排到圖案區上。
import { seeded } from '../engine/random.js';
import { halftone, DOT_ANGLES } from '../engine/separate.js';

const SIZE = 360;
const BIG_FONT = '900 300px "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif';
const LETTERS = 'ABDEGHKMNPRSTWXYZ2345678';

// 版面：(drawUnit, ctx 工具, rnd) → 在圖案區排出單位圖案
//   unit(box, { seed, shift })：box 為 {x, y, s}（圖案區座標），shift 讓單位圖案往上層移
export const LAYOUTS = {
  // 單一大圖置中
  center: ({ unit, seed }) => unit({ x: 40, y: 40, s: 280 }, { seed }),
  // 滿版：單位方格就是整個圖案區（給本身就是紋樣的產生器）
  full: ({ unit, seed }) => unit({ x: 0, y: 0, s: SIZE }, { seed }),
  // 滿版重複紋樣：同一個圖案，隔列錯半格
  repeat: ({ unit, seed, rnd }) => {
    const g = rnd() < 0.5 ? 4 : 5, c = SIZE / g, brick = rnd() < 0.5;
    for (let j = -1; j <= g; j++) for (let i = -1; i <= g; i++) {
      const x = i * c + (brick && j % 2 ? c / 2 : 0);
      unit({ x: x + c * 0.1, y: j * c + c * 0.1, s: c * 0.8 }, { seed });
    }
  },
  // 3×3 格子：每格一個變化
  grid3: ({ unit, seed }) => {
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      unit({ x: 12 + i * 114, y: 12 + j * 114, s: 108 }, { seed: seed * 31 + j * 3 + i + 1 });
    }
  },
  // 徽章：淺色圓底、深色外環與一圈小點，單位圖案在中間
  badge: ({ unit, seed, L, n }) => {
    const base = L(0), edge = L(n - 1);
    base.beginPath(); base.arc(180, 180, 160, 0, Math.PI * 2); base.fill();
    edge.lineWidth = 6;
    edge.beginPath(); edge.arc(180, 180, 172, 0, Math.PI * 2); edge.stroke();
    for (let k = 0; k < 36; k++) {
      const a = k / 36 * Math.PI * 2;
      edge.beginPath(); edge.arc(180 + Math.cos(a) * 145, 180 + Math.sin(a) * 145, 3, 0, Math.PI * 2); edge.fill();
    }
    unit({ x: 95, y: 95, s: 170 }, { seed, shift: 1 });
  },
  // 大字疊圖形：一個巨大的字母或數字墊底，圖案疊在上面
  bigtype: ({ unit, seed, L, rnd }) => {
    const base = L(0), ch = LETTERS[Math.floor(rnd() * LETTERS.length)];
    base.save();
    base.font = BIG_FONT;
    base.textAlign = 'center';
    base.textBaseline = 'middle';
    base.fillText(ch, 180, 192);
    base.restore();
    unit({ x: 70, y: 70, s: 220 }, { seed, shift: 1 });
  }
};

function layerCanvas(D) {
  const c = document.createElement('canvas');
  c.width = c.height = D;
  const x = c.getContext('2d');
  x.setTransform(D / SIZE, 0, 0, D / SIZE, 0, 0);
  x.beginPath(); x.rect(0, 0, SIZE, SIZE); x.clip();
  x.fillStyle = x.strokeStyle = '#000';
  x.lineCap = x.lineJoin = 'round';
  return { canvas: c, ctx: x };
}

// 畫出一件作品的各層。spec：{ gen, layout, seed, n }；D：圖案區的像素邊長
// 回傳 Float32Array[]（每層 D × D，0..1）。產生器可以把明暗畫在「網點層」T(i)，會轉成網點。
export function composeMasks(spec, D) {
  const { gen, layout, seed, n } = spec;
  const solid = Array.from({ length: n }, () => layerCanvas(D));
  const tone = [];
  const L = i => solid[Math.max(0, Math.min(n - 1, i))].ctx;
  const T = i => {
    const k = Math.max(0, Math.min(n - 1, i));
    if (!tone[k]) tone[k] = layerCanvas(D);
    return tone[k].ctx;
  };
  const rnd = seeded(seed);
  const unit = (box, { seed: s = seed, shift = 0 } = {}) => {
    const k = box.s / 100, boxed = new Set();
    // 第一次用到某一層時，才套上單位方格的座標轉換
    const enter = ctx => {
      if (!boxed.has(ctx)) { ctx.save(); ctx.translate(box.x, box.y); ctx.scale(k, k); boxed.add(ctx); }
      return ctx;
    };
    gen.draw({
      L: i => enter(L(i + shift)),
      T: i => enter(T(i + shift)),
      n: Math.max(1, n - shift),
      r: seeded(s),
      // 在某一層上挖空（例如臉上的五官）
      cut: (ctx, fn) => { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; fn(ctx); ctx.restore(); }
    });
    for (const ctx of boxed) ctx.restore();
  };
  LAYOUTS[layout]({ unit, seed, rnd, L, n });

  const cell = 13 * D / 720;
  return solid.map(({ canvas }, i) => {
    const a = alphaOf(canvas, D);
    if (tone[i]) {
      const dots = halftone(alphaOf(tone[i].canvas, D), D, D, { angle: DOT_ANGLES[i % DOT_ANGLES.length], cell });
      for (let p = 0; p < a.length; p++) if (dots[p] > a[p]) a[p] = dots[p];
    }
    return a;
  });
}

function alphaOf(canvas, D) {
  const d = canvas.getContext('2d').getImageData(0, 0, D, D).data, out = new Float32Array(D * D);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] / 255;
  return out;
}
