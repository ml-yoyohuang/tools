import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeIn3, minSide, mod, num, str, TAU } from '../../engine/helpers';
import { backOut, sparkPath } from './_util';

export default defineEffect({
  id: 'star-spark',
  code: 'C07',
  nameZh: '星芒閃光',
  nameEn: 'Star Spark',
  category: 'comic',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '四角／多角星芒沿順時針次序一顆接一顆彈大、旋轉、再收成一點，像漫畫裡的閃亮特效。',
  tags: ['漫畫', '星芒', '閃光', '亮晶晶', 'sparkle'],
  suitable: ['新品亮相', '得獎公告', '按鈕點綴', '節慶貼圖'],
  principle:
    'Canvas 2D：星芒是內凹星形——尖端之間以二次貝茲曲線連接，控制點拉向中心（內徑比例 = 銳利度）。每顆星有 seed 位置與大小，依繞中心的角度排序，第 i 顆在 i/N·P 秒點亮；生命期內 scale：0–35% back.out 彈大、35–55% 停住、55–100% easeIn³ 收成一點，同時旋轉 90°×強度，峰值時加上細長十字光芒。',
  defaultText: '',
  palette: 'COOL',
  controls: ['intensity', 'scale', 'direction', 'secondary', 'accent', 'seed'],
  directions: ['cw', 'ccw'],
  params: [
    {
      key: 'points',
      label: '星芒角數',
      type: 'select',
      options: [
        { value: '4', label: '四角' },
        { value: 'mix', label: '四角＋八角混合' },
        { value: '6', label: '六角' },
        { value: '8', label: '八角' },
      ],
      default: 'mix',
    },
    { key: 'count', label: '星芒數量', type: 'range', min: 5, max: 30, step: 1, default: 14 },
    { key: 'sharp', label: '銳利度', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.16, hint: '越小越尖細' },
    { key: 'life', label: '單顆時長', type: 'range', min: 0.5, max: 1.8, step: 0.05, default: 0.95, unit: 's' },
  ],
  recipe: {
    enter: '中央大星芒先以 back.out 彈出。',
    motion: '周圍星芒依角度次序（順／逆時針）接力點亮；每顆放大時旋轉，峰值時伸出細十字光芒，再以 easeIn³ 收成一點。',
    hold: '無整體停留：任何時刻只有部分星芒在亮，像一圈流動的閃光。',
    exit: '每顆星各自縮回消失。',
    loop: '週期 P = 數量 × 0.15 秒，接力無縫循環。',
  },
  accept: [
    '星芒尖端之間為內凹曲線，形狀像漫畫閃光而不是普通五角星。',
    '可清楚看到星芒依角度順序接力出現，方向切換後順序相反。',
    '每顆星都經歷放大、旋轉、縮小三段。',
    '強度為 0 時星芒不旋轉。',
  ],
  transparent: true,
  cycle: 4.2,
  posterTime: 0.5,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const cx = w / 2;
    const cy = h / 2;
    const mode = str(ctx, 'points', 'mix');
    const count = Math.round(num(ctx, 'count', 14));
    const sharp = num(ctx, 'sharp', 0.16);
    const life = num(ctx, 'life', 0.95);
    const sc = ctx.s.scale;
    const P = Math.max(life + 0.6, count * 0.15);
    const pickN = (i: number) => (mode === 'mix' ? (i % 3 === 2 ? 8 : 4) : Number(mode) || 4);
    // seeded positions with a minimum spacing, avoiding the hero in the middle
    const stars: { x: number; y: number; r: number; n: number; rot: number; ang: number; col: number }[] = [];
    const minD = m * 0.12 * sc;
    for (let i = 0, tries = 0; stars.length < count && tries < count * 60; tries++) {
      const x = w * (0.08 + ctx.rand() * 0.84);
      const y = h * (0.1 + ctx.rand() * 0.8);
      const r = m * (0.035 + ctx.rand() ** 1.5 * 0.08) * sc;
      const dc = Math.hypot((x - cx) / w, (y - cy) / h);
      if (dc < 0.17) continue;
      if (stars.some((s) => Math.hypot(s.x - x, s.y - y) < minD + (s.r + r) * 0.6)) continue;
      stars.push({ x, y, r, n: pickN(i++), rot: ctx.rand() * TAU, ang: Math.atan2(y - cy, x - cx), col: ctx.rand() < 0.3 ? 1 : 0 });
    }
    // order around the centre, clockwise or counter-clockwise
    stars.sort((a, b) => mod(a.ang * ctx.dirSign, TAU) - mod(b.ang * ctx.dirSign, TAU));
    const hero = { x: cx, y: cy, r: m * 0.2 * sc, n: mode === 'mix' ? 4 : Number(mode) || 4, rot: 0 };
    const dots = Array.from({ length: Math.round(40 * ctx.q) }, () => ({ x: ctx.rand() * w, y: ctx.rand() * h, ph: ctx.rand() * TAU, r: m * (0.002 + ctx.rand() * 0.004) }));
    const sizeAt = (p: number) => (p < 0.35 ? backOut(p / 0.35, 2.4) : p < 0.55 ? 1 : 1 - easeIn3((p - 0.55) / 0.45));
    const drawStar = (g: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, rot: number, p: number, fill: string) => {
      const k = sizeAt(p);
      if (k <= 0.01) return;
      const spin = rot + ctx.dirSign * ctx.s.intensity * (Math.PI / 2) * Math.min(1, p / 0.55) ** 0.6;
      // cross flare at the peak
      const fl = clamp(1 - Math.abs(p - 0.45) / 0.2, 0, 1);
      if (fl > 0) {
        g.strokeStyle = ctx.s.secondary;
        g.lineWidth = Math.max(1, r * 0.04);
        g.globalAlpha = fl;
        g.beginPath();
        const L = r * (1.3 + fl * 1.1);
        g.moveTo(x - L, y);
        g.lineTo(x + L, y);
        g.moveTo(x, y - L);
        g.lineTo(x, y + L);
        g.stroke();
        g.globalAlpha = 1;
      }
      g.beginPath();
      sparkPath(g, x, y, r * k, sharp, n, spin - Math.PI / 2);
      g.fillStyle = fill;
      g.fill();
      if (n > 4) {
        g.beginPath();
        sparkPath(g, x, y, r * k * 0.55, sharp, 4, spin - Math.PI / 2 + Math.PI / 4);
        g.fillStyle = ctx.s.secondary;
        g.fill();
      }
    };
    return canvasRuntime(ctx, (g, t) => {
      g.fillStyle = ctx.s.accent;
      for (const d of dots) {
        g.globalAlpha = 0.25 + 0.25 * Math.sin(t * 1.3 + d.ph);
        g.beginPath();
        g.arc(d.x, d.y, d.r, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      stars.forEach((s, i) => {
        const local = mod(t - 0.35 - (i / stars.length) * P, P);
        if (local < life) drawStar(g, s.x, s.y, s.r, s.n, s.rot, local / life, s.col ? ctx.s.accent : ctx.s.primary);
      });
      const hl = mod(t, P);
      const heroLife = life * 1.4;
      if (hl < heroLife) drawStar(g, hero.x, hero.y, hero.r, hero.n, hero.rot, hl / heroLife, ctx.s.primary);
    });
  },
});
