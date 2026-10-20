import { defineEffect } from '../../engine/define';
import { autoPath, canvasRuntime, clamp, minSide, mixHex, mod, num, pointerOrAuto } from '../../engine/helpers';
import { DotBatch } from './_util';

interface Layer {
  spacing: number;
  r: number;
  depth: number;
  ox: number;
  oy: number;
  color: string;
  stagger: boolean;
}

export default defineEffect({
  id: 'parallax-dots',
  code: 'H10',
  nameZh: '點陣視差',
  nameEn: 'Parallax Dots',
  category: 'halftone',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '遠、中、近多層尺寸不同的點陣隨指標或自動軌跡偏移，近層大點移動快、遠層小點幾乎不動，形成景深。',
  tags: ['視差', 'parallax', '景深', '互動', '點陣'],
  suitable: ['互動首頁背景', '游標跟隨效果', '太空／景深意象'],
  principle:
    'Canvas 2D：每層是一張可無限平鋪的點陣（偏移量 mod 點距），層 i 的偏移 = (指標 − 舞台中心)·depth_i·strength + 自動漂移·depth_i，depth 由遠到近呈幾何級數（約 0.08 → 1.2），點距與點半徑也隨深度放大，因此近層又大又快、遠層又小又慢。真實指標以指數平滑追隨；閒置或卡片模式改用 Lissajous 自動軌跡。',
  defaultText: '',
  palette: 'STREET',
  controls: ['intensity', 'scale', 'secondary', 'accent', 'seed'],
  interactive: true,
  params: [
    { key: 'layers', label: '層數', type: 'range', min: 2, max: 4, step: 1, default: 3 },
    { key: 'depth', label: '視差強度', type: 'range', min: 0.1, max: 1.5, step: 0.05, default: 0.7 },
    { key: 'drift', label: '自動漂移速度', type: 'range', min: 0, max: 1, step: 0.05, default: 0.25 },
  ],
  recipe: {
    enter: '多層點陣疊在一起，靜止時看似一張複雜網點。',
    motion: '指標（或自動軌跡）移動時各層依深度以不同速度偏移；同時以極慢的整體漂移保持動態。',
    hold: '指標停住時各層平滑減速停在新位置。',
    exit: '無離場。',
    loop: '自動軌跡為週期路徑；詳情頁移動滑鼠即改為跟隨指標。',
  },
  accept: [
    '至少可分辨兩層以上不同大小與顏色的點陣。',
    '近層（大點）移動距離明顯大於遠層（小點）。',
    '詳情頁移動滑鼠時各層朝指標相反方向偏移。',
    '調整「視差強度」改變層間速度差。',
  ],
  transparent: true,
  posterTime: 1.5,
  cycle: 10,
  create(ctx) {
    const nl = Math.round(clamp(num(ctx, 'layers', 3), 2, 4));
    const strength = num(ctx, 'depth', 0.7) * (0.5 + 0.5 * ctx.s.intensity);
    const drift = num(ctx, 'drift', 0.25) * ctx.s.intensity;
    const ms = minSide(ctx);
    const unit = ms * 0.03 * ctx.s.scale * (ctx.mode === 'card' ? 1.15 : 1);
    // far layers fade toward the background (atmospheric depth); the nearest two use secondary / primary
    const S = ctx.s;
    const colorFor = (i: number) => {
      const fromNear = nl - 1 - i;
      if (fromNear === 0) return S.primary;
      if (fromNear === 1) return S.secondary;
      return mixHex(S.accent, S.background, fromNear === 2 ? 0.55 : 0.75);
    };
    const layers: Layer[] = [];
    for (let i = 0; i < nl; i++) {
      const f = nl === 1 ? 1 : i / (nl - 1); // 0 far → 1 near
      const spacing = Math.max(unit * (0.9 + 3.2 * f), Math.sqrt((ctx.width * ctx.height) / (2600 * ctx.q)));
      layers.push({
        spacing,
        r: spacing * (0.14 + 0.12 * f),
        depth: 0.08 * Math.pow(15, f),
        ox: ctx.rand() * spacing,
        oy: ctx.rand() * spacing,
        color: colorFor(i),
        stagger: i % 2 === 1,
      });
    }
    const phase0 = ctx.rand() * 20;
    let sx = 0;
    let sy = 0;
    let init = false;
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;
    return canvasRuntime(ctx, (g, t, _cv, dt) => {
      const p = pointerOrAuto(ctx, t, (tt) => autoPath(ctx, tt + phase0, 0.42, 0.34, 0.09, 0.14));
      const tx = p.x - cx;
      const ty = p.y - cy;
      if (p.real && init && dt > 0) {
        const k = 1 - Math.exp(-dt * 6);
        sx += (tx - sx) * k;
        sy += (ty - sy) * k;
      } else {
        sx = tx;
        sy = ty;
      }
      init = true;
      const b = new DotBatch(g);
      for (const L of layers) {
        const offX = -sx * L.depth * strength + t * drift * ms * 0.25 * L.depth;
        const offY = -sy * L.depth * strength;
        const s = L.spacing;
        const bx = mod(L.ox + offX, s) - s;
        const by = mod(L.oy + offY, s * 2) - s * 2;
        b.begin();
        let row = 0;
        for (let y = by; y < ctx.height + s; y += s, row++) {
          const shift = L.stagger && mod(row, 2) === 1 ? s / 2 : 0;
          for (let x = bx + shift; x < ctx.width + s; x += s) b.dot(x, y, L.r);
        }
        b.fill(L.color);
      }
    });
  },
});
