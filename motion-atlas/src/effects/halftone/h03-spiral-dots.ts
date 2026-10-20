import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, minSide, mod, num, smoothstep, TAU } from '../../engine/helpers';
import { DotBatch } from './_util';

export default defineEffect({
  id: 'spiral-dots',
  code: 'H03',
  nameZh: '螺旋圓點',
  nameEn: 'Spiral Dots',
  category: 'halftone',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '圓點沿多臂阿基米德螺旋排列，一邊旋轉一邊沿螺旋路徑向中心流入，越往內越小。',
  tags: ['螺旋', 'spiral', '圓點', '催眠', '流動'],
  suitable: ['載入動畫', '音樂視覺', '催眠／迷幻背景'],
  principle:
    'Canvas 2D：每臂 N 顆點，參數 u_i = √mod(i/N − v·t, 1)（等弧長分布，隨時間遞減 → 向內流且越近中心越快），位置 r = R·u、θ = turns·2π·u + 2π·arm/arms + ω·t·dir。沿路徑點距約為臂間距的 0.6 倍，使點連成清楚的臂；點半徑 ∝ 點距·dotSize·(0.35 + 0.65u)，再乘上沿 θ 傳遞的相位脈動 0.82 + 0.18·sin(3θ − 5t)；外緣 u > 0.9 以 smoothstep 淡入，中心自然縮為 0，使流入無縫。',
  defaultText: '',
  palette: 'POP',
  controls: ['direction', 'intensity', 'scale', 'secondary'],
  directions: ['cw', 'ccw'],
  params: [
    { key: 'turns', label: '圈數', type: 'range', min: 1.5, max: 12, step: 0.5, default: 5 },
    { key: 'dot', label: '點尺寸', type: 'range', min: 0.3, max: 1.6, step: 0.05, default: 0.9 },
    { key: 'arms', label: '螺旋臂數', type: 'range', min: 1, max: 4, step: 1, default: 2 },
    { key: 'flow', label: '流入速度', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0.07 },
  ],
  recipe: {
    enter: '螺旋已排滿畫面中央。',
    motion: '整個螺旋以等速旋轉，同時每顆點沿路徑往中心滑入並縮小；點大小以相位波沿螺旋傳遞。',
    hold: '連續流動，無停頓。',
    exit: '點在中心縮到 0 後於外緣重新淡入。',
    loop: '流入與旋轉皆為週期運動，可無限循環。',
  },
  accept: [
    '圓點清楚排成螺旋臂，臂數與參數一致。',
    '「圈數」增加時螺旋更緊密、點更小。',
    '點持續由外往內移動，中心點最小。',
    '切換 cw / ccw 後旋轉方向相反。',
  ],
  transparent: true,
  posterTime: 1,
  cycle: 10,
  create(ctx) {
    const turns = num(ctx, 'turns', 5);
    const dotK = num(ctx, 'dot', 0.9);
    const arms = Math.round(clamp(num(ctx, 'arms', 2), 1, 4));
    const flow = num(ctx, 'flow', 0.07);
    const R = minSide(ctx) * 0.47 * ctx.s.scale;
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;
    const gap = R / turns / arms;
    // equal arc-length spacing: an Archimedean arm is ≈ π·R·turns long
    const along = (gap * 0.62) / Math.sqrt(0.6 + 0.4 * ctx.q);
    const N = Math.max(12, Math.min(Math.round((Math.PI * R * turns) / along), Math.floor(4200 / arms)));
    const omega = 0.35 * ctx.s.intensity * ctx.dirSign;
    const colors = [ctx.s.primary, ctx.s.secondary];
    return canvasRuntime(ctx, (g, t) => {
      const rot = omega * t;
      const b = new DotBatch(g);
      for (let a = 0; a < arms; a++) {
        b.begin();
        const armOff = (TAU * a) / arms;
        for (let i = 0; i < N; i++) {
          // arc length grows ~u², so u = √v keeps dots evenly spaced (and speeds them up near the centre)
          const u = Math.sqrt(mod(i / N - flow * t, 1));
          const r = R * u;
          const th = turns * TAU * u * ctx.dirSign + armOff + rot;
          const pulse = 0.82 + 0.18 * Math.sin(3 * th * ctx.dirSign - 5 * t);
          const fade = 1 - smoothstep(0.9, 1, u);
          const rad = along * 0.5 * dotK * (0.35 + 0.65 * u) * pulse * fade;
          b.dot(cx + Math.cos(th) * r, cy + Math.sin(th) * r, rad);
        }
        b.fill(colors[a % 2]);
      }
    });
  },
});
