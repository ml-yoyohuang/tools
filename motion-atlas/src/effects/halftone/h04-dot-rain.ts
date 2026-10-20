import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeOut3, minSide, mod, num, TAU } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { DotBatch } from './_util';

interface Drop {
  x: number;
  landY: number;
  depth: number;
  fall: number;
  period: number;
  offset: number;
  col: number;
}

export default defineEffect({
  id: 'dot-rain',
  code: 'H04',
  nameZh: '點雨',
  nameEn: 'Dot Rain',
  category: 'halftone',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '圓點雨滴拖著虛點尾巴落下，落地時濺起小點並擴散成由圓點組成的橢圓波紋。',
  tags: ['雨', '落下', '波紋', 'ripple', '圓點'],
  suitable: ['天氣／氛圍背景', '冷靜的待機畫面', '音樂視覺'],
  principle:
    'Canvas 2D 純時間函數：每滴雨有 seeded 的 x、景深 d、落點 y、週期 P 與相位；局部時間 τ = mod(t + φ, P)。τ < F 時 y = y0 + (落點 − y0)·(τ/F)^1.5（加速落下），尾巴是沿軌跡往回取樣的 3 顆遞減圓點；落地後 τ − F 進入波紋：兩圈延遲 0.18 s 的橢圓（ry = rx·透視壓扁 0.22–0.38），每圈由 16 顆圓點組成，半徑 easeOut3 擴張、點尺寸隨年齡縮小，另有 3 顆濺起點走拋物線。景深決定落點高度、尺寸與速度。',
  defaultText: '',
  palette: 'PASTEL',
  colors: { primary: C.blue, secondary: C.pink, accent: '#9A86DE' },
  controls: ['scale', 'secondary', 'accent', 'seed'],
  params: [
    { key: 'count', label: '雨滴數量', type: 'range', min: 6, max: 90, step: 1, default: 34 },
    { key: 'speed', label: '落下速度', type: 'range', min: 0.4, max: 2.5, step: 0.05, default: 1 },
    { key: 'level', label: '落點高度', type: 'range', min: 0.45, max: 0.95, step: 0.01, default: 0.8, hint: '地面線在舞台高度的位置' },
    { key: 'spread', label: '落點景深分布', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'ripple', label: '波紋大小', type: 'range', min: 0.3, max: 2, step: 0.05, default: 1 },
    { key: 'mix', label: '雨滴混入強調色', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '雨已在下，畫面中隨機分布正在下落與正在擴散的雨滴。',
    motion: '雨滴以加速度落下並帶虛點尾巴；落地瞬間濺起 3 顆小點，兩圈點狀橢圓波紋以 ease-out 擴張。',
    hold: '連續降雨，無停頓。',
    exit: '波紋擴張時點逐漸縮小至消失。',
    loop: '每滴雨各自週期循環，整體不會同步閃爍。',
  },
  accept: [
    '雨滴是圓點且有落下加速感，落地處出現兩圈點狀波紋。',
    '「落點高度」與「景深分布」改變落地位置；景深遠的雨滴較小、較高。',
    '「落下速度」加快時雨滴更快、更頻繁。',
    '次色控制波紋色，強調色混入部分雨滴。',
  ],
  transparent: true,
  posterTime: 1.6,
  cycle: 8,
  create(ctx) {
    const count = Math.max(4, Math.round(num(ctx, 'count', 34) * (0.5 + 0.5 * ctx.q)));
    const speed = num(ctx, 'speed', 1);
    const level = num(ctx, 'level', 0.8);
    const spread = num(ctx, 'spread', 0.6);
    const rippleK = num(ctx, 'ripple', 1);
    const mixAccent = ctx.s.params.mix !== false;
    const H = ctx.height;
    const W = ctx.width;
    const ms = minSide(ctx);
    const dotR = ms * 0.015 * ctx.s.scale;
    const rippleLife = 1.1;
    const drops: Drop[] = [];
    for (let i = 0; i < count; i++) {
      const depth = ctx.rand();
      const landY = H * clamp(level - spread * 0.42 * (1 - depth), 0.08, 0.97);
      const v = H * (0.9 + 0.5 * depth) * speed; // px/s average
      const fall = (landY + dotR * 8) / v;
      const period = fall + rippleLife + (0.2 + ctx.rand() * 1.4) / speed;
      drops.push({
        x: W * (0.03 + 0.94 * ctx.rand()),
        landY,
        depth,
        fall,
        period,
        offset: ctx.rand() * period,
        col: mixAccent && i % 3 === 2 ? 1 : 0,
      });
    }
    drops.sort((a, b) => a.depth - b.depth);
    const RING = 16;
    return canvasRuntime(ctx, (g, t) => {
      const dropB = [new DotBatch(g), new DotBatch(g)];
      const ring = new DotBatch(g);
      dropB[0].begin();
      dropB[1].begin();
      ring.begin();
      for (const d of drops) {
        const tau = mod(t + d.offset, d.period);
        const sz = dotR * (0.55 + 0.45 * d.depth);
        const y0 = -sz * 6;
        if (tau < d.fall) {
          const b = dropB[d.col];
          const p = tau / d.fall;
          for (let k = 0; k < 4; k++) {
            const pk = p - k * 0.035;
            if (pk < 0) break;
            const y = y0 + (d.landY - y0) * pk ** 1.5;
            b.dot(d.x, y, sz * (1 - k * 0.24));
          }
          continue;
        }
        const age = tau - d.fall;
        if (age > rippleLife) continue;
        const maxR = ms * 0.085 * rippleK * (0.5 + 0.5 * d.depth) * ctx.s.scale;
        const squash = 0.22 + 0.16 * d.depth;
        for (let r = 0; r < 2; r++) {
          const a = age - r * 0.18;
          if (a <= 0) continue;
          const p = a / (rippleLife - r * 0.18);
          const rx = maxR * easeOut3(p) * (1 - r * 0.35);
          const ds = sz * 0.62 * (1 - p * 0.85);
          for (let k = 0; k < RING; k++) {
            const th = (k / RING) * TAU;
            ring.dot(d.x + Math.cos(th) * rx, d.landY + Math.sin(th) * rx * squash, ds);
          }
        }
        // splash: three droplets on parabolas
        if (age < 0.4) {
          const b = dropB[d.col];
          for (let k = -1; k <= 1; k++) {
            const vx = k * maxR * 1.4;
            const vy = -maxR * (k === 0 ? 3.2 : 2.4);
            b.dot(d.x + vx * age, d.landY + vy * age + 0.5 * maxR * 20 * age * age, sz * 0.45 * (1 - age / 0.4));
          }
        }
      }
      ring.fill(ctx.s.secondary);
      dropB[0].fill(ctx.s.primary);
      dropB[1].fill(ctx.s.accent);
    });
  },
});
