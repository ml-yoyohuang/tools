import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeIn3, easeOut3, minSide, num, phase, TAU } from '../../engine/helpers';
import { layoutText, phrases } from '../../engine/text';
import { backOut, inkText } from './_util';

export default defineEffect({
  id: 'thought-bubble',
  code: 'C05',
  nameZh: '思考氣泡',
  nameEn: 'Thought Bubble',
  category: 'comic',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '小圓泡從角落依序冒出連向主雲朵，雲朵外緣一團團鼓起成形，文字稍後浮現。',
  tags: ['漫畫', '思考', '雲朵', '泡泡', 'thought bubble'],
  suitable: ['內心獨白', '腦力激盪', '提示說明', '教學旁白'],
  principle:
    'Canvas 2D：主雲朵 = 橢圓核心 + K 個沿橢圓周均分的圓（scallop）。先以 2×線寬描所有圓的外框、再填滿所有圓與核心，得到無內線的聯集輪廓。小圓泡位於來源點到雲朵邊緣的直線上、半徑等比遞增，依序以 back.out 彈出；雲朵的每個 scallop 從靠近小圓泡的一側開始依序鼓起；整體以低頻正弦漂浮。',
  defaultText: '晚餐吃什麼呢…',
  palette: 'PASTEL',
  colors: { background: '#F2E8D5', primary: '#141414', secondary: '#F2A2C0', accent: '#FFFFFF' },
  controls: ['text', 'font', 'weight', 'tracking', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['left', 'right'],
  textHint: '用「／」分隔多個念頭，依序出現。',
  maxChars: 50,
  params: [
    { key: 'puffs', label: '雲朵團數', type: 'range', min: 7, max: 18, step: 1, default: 11 },
    { key: 'dots', label: '小圓泡數', type: 'range', min: 2, max: 5, step: 1, default: 3 },
    { key: 'float', label: '漂浮幅度', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.6, max: 3, step: 0.1, default: 1.6, unit: 's' },
  ],
  recipe: {
    enter: '小圓泡由小到大、自來源角落往雲朵方向每 0.16 秒彈出一顆（back.out）。',
    motion: '最後一顆圓泡出現後，雲朵的每一團從靠近圓泡那側依序鼓起；全部成形 0.2 秒後文字淡入並上浮 6%。',
    hold: '雲朵與文字整體緩慢上下漂浮，文字不變形。',
    exit: '雲朵先縮小消失，小圓泡再由大到小反向消失。',
    loop: '下一個念頭從另一側角落冒出。',
  },
  accept: [
    '可清楚看出小圓泡依序出現並連到主雲朵。',
    '雲朵輪廓由多個圓團組成，內部沒有交疊線。',
    '文字在雲朵成形後才出現。',
    '方向改變時小圓泡來源換到另一側角落。',
  ],
  transparent: true,
  cycle: 6,
  posterTime: 2.4,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const thoughts = phrases(ctx.text);
    const K = Math.round(num(ctx, 'puffs', 11));
    const nd = Math.round(num(ctx, 'dots', 3));
    const floatK = num(ctx, 'float', 0.5);
    const hold = num(ctx, 'hold', 1.6);
    const lw = Math.max(2, m * 0.008);
    const items = thoughts.map((th, i) => {
      const side = (i % 2 === 0 ? -1 : 1) * (ctx.dir === 'right' ? -1 : 1);
      const cx = w / 2 - side * w * 0.06;
      const cy = h * 0.43;
      const layout = layoutText(ctx, th, { cx, cy, maxWidth: w * 0.5, maxHeight: h * 0.3, fill: 0.92 });
      const ex = Math.min(w * 0.36, layout.width / 2 + m * 0.08);
      const ey = Math.min(h * 0.26, layout.height / 2 + m * 0.07);
      // scallops: radius from the arc spacing
      const per = Math.PI * (3 * (ex + ey) - Math.sqrt((3 * ex + ey) * (ex + 3 * ey)));
      const rs = (per / K) * 0.62;
      const src = { x: w / 2 + side * w * 0.36, y: h * 0.9 };
      const srcA = Math.atan2(src.y - cy, (src.x - cx) * (ey / ex));
      const puffs = Array.from({ length: K }, (_, k) => {
        const a = srcA + (k / K) * TAU;
        // order: nearest to the dots first, then alternating around both sides
        const d = Math.min(k, K - k);
        return { x: cx + Math.cos(a) * ex, y: cy + Math.sin(a) * ey, r: rs * (0.86 + ctx.rand() * 0.3), order: d };
      });
      const edge = { x: cx + Math.cos(srcA) * (ex + rs), y: cy + Math.sin(srcA) * (ey + rs) };
      const dots = Array.from({ length: nd }, (_, k) => {
        const u = (k + 0.6) / (nd + 0.4);
        return { x: src.x + (edge.x - src.x) * u, y: src.y + (edge.y - src.y) * u, r: m * (0.012 + 0.03 * ((k + 1) / nd) ** 1.2) };
      });
      return { layout, cx, cy, ex, ey, puffs, dots, maxOrder: Math.floor(K / 2) };
    });
    const DOT = 0.16;
    const PUFF = 0.07;
    const durs = items.flatMap((it) => [nd * DOT + 0.1, (it.maxOrder + 1) * PUFF + 0.25, 0.5, hold, 0.45]);
    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, durs);
      const ii = Math.floor(ph.i / 5);
      const seg = ph.i % 5;
      const it = items[ii];
      const local = ph.p * durs[ph.i];
      const fy = Math.sin(t * TAU * 0.45) * m * 0.012 * floatK;
      // dot scales
      const dotS = it.dots.map((_, k) => {
        if (seg === 0) return backOut(clamp((local - k * DOT) / 0.22, 0, 1), 2.6);
        if (seg === 4) return 1 - easeIn3(clamp((ph.p - 0.35 - (nd - 1 - k) * (0.6 / nd / 1.6)) / 0.3, 0, 1));
        return 1;
      });
      const puffS = it.puffs.map((p) => {
        if (seg === 0) return 0;
        if (seg === 1) return backOut(clamp((local - p.order * PUFF) / 0.24, 0, 1), 2);
        if (seg === 4) return 1 - easeIn3(clamp(ph.p / 0.4, 0, 1));
        return 1;
      });
      const coreS = seg === 0 ? 0 : seg === 1 ? easeOut3(clamp(local / ((it.maxOrder + 1) * PUFF), 0, 1)) : seg === 4 ? puffS[0] : 1;
      const textA = seg === 2 ? easeOut3(ph.p) : seg === 3 ? 1 : seg === 4 ? 1 - clamp(ph.p / 0.25, 0, 1) : 0;
      g.save();
      g.translate(0, fy);
      g.lineJoin = 'round';
      // small dots (each with its own lag in the float)
      it.dots.forEach((d, k) => {
        const s = dotS[k];
        if (s <= 0.001) return;
        const lag = Math.sin(t * TAU * 0.45 - (k + 1) * 0.5) * m * 0.008 * floatK - fy;
        g.beginPath();
        g.arc(d.x, d.y + lag, d.r * s, 0, TAU);
        g.fillStyle = ctx.s.accent;
        g.fill();
        g.strokeStyle = ctx.s.primary;
        g.lineWidth = lw;
        g.stroke();
      });
      // cloud: shadow, outline pass, fill pass
      const draw = (mode: 'shadow' | 'line' | 'fill') => {
        g.beginPath();
        for (let k = 0; k < it.puffs.length; k++) {
          const p = it.puffs[k];
          const s = puffS[k];
          if (s <= 0.001) continue;
          const px = it.cx + (p.x - it.cx) * (0.75 + 0.25 * coreS);
          const py = it.cy + (p.y - it.cy) * (0.75 + 0.25 * coreS);
          g.moveTo(px + p.r * s, py);
          g.arc(px, py, p.r * s, 0, TAU);
        }
        if (coreS > 0) {
          g.moveTo(it.cx + it.ex * coreS, it.cy);
          g.ellipse(it.cx, it.cy, it.ex * coreS, it.ey * coreS, 0, 0, TAU);
        }
        if (mode === 'line') {
          g.lineWidth = lw * 2;
          g.strokeStyle = ctx.s.primary;
          g.stroke();
        } else {
          g.fillStyle = mode === 'shadow' ? ctx.s.secondary : ctx.s.accent;
          g.fill('nonzero');
        }
      };
      g.save();
      g.translate(m * 0.018, m * 0.022);
      draw('shadow');
      g.restore();
      draw('line');
      draw('fill');
      if (textA > 0) {
        g.globalAlpha = textA;
        inkText(g, it.layout, ctx.s.primary, null, 0, 0, (1 - textA) * m * 0.04);
        g.globalAlpha = 1;
      }
      g.restore();
    });
  },
});
