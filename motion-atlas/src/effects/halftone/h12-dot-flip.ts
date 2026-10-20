import { defineEffect } from '../../engine/define';
import { C } from '../../engine/palette';
import { canvasRuntime, clamp, easeInOut, minSide, mixHex, num, str } from '../../engine/helpers';
import { noise2 } from '../../engine/random';
import { capSpacing, dotGrid } from './_util';

const SHADES = 5;

export default defineEffect({
  id: 'dot-flip',
  code: 'H12',
  nameZh: '點陣翻面',
  nameEn: 'Dot Flip',
  category: 'halftone',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '每顆圓點都是一片雙色小圓片，翻面波掃過時沿垂直軸轉 180°，正面主色、背面次色，一波翻過去、下一波翻回來。',
  tags: ['翻面', 'flip', '圓片', '波浪', '雙色'],
  suitable: ['狀態切換展示', '品牌色轉換', '翻牌式背景'],
  principle:
    'Canvas 2D：每個圓片有延遲 d（線性 = 沿方向投影、放射 = 到中心距離、雜訊 = 2D value noise）。u = t/P − d·spread，n = floor(u) 為已翻過的次數，翻轉進度 p = easeInOut(clamp(frac(u)/flipDur))，角度 θ = π(n + p)。繪製為 rx = r·|cos θ|、ry = r 的橢圓（真正的水平壓縮，不是透明度），cos θ 的正負決定看到正面或背面顏色，接近側面時以較暗的色階表示受光變化並畫出圓片厚度線；翻轉途中圓片放大 1 + 0.18·sin(πp) 表現抬起。',
  defaultText: '',
  palette: 'PASTEL',
  colors: { background: C.cream, primary: C.blue, secondary: C.red },
  controls: ['direction', 'intensity', 'secondary', 'seed'],
  directions: ['right', 'left', 'down', 'up'],
  params: [
    { key: 'spacing', label: '圓片間距', type: 'range', min: 14, max: 48, step: 1, default: 24, unit: 'px' },
    {
      key: 'pattern',
      label: '波形',
      type: 'select',
      default: 'linear',
      options: [
        { value: 'linear', label: '線性（依方向）' },
        { value: 'radial', label: '由中心放射' },
        { value: 'noise', label: '雜訊團塊' },
      ],
    },
    { key: 'spread', label: '波的跨度', type: 'range', min: 0.2, max: 2, step: 0.05, default: 0.9, hint: '越大越像一道道波，越小越接近同時翻' },
    { key: 'period', label: '翻面間隔', type: 'range', min: 1.2, max: 5, step: 0.1, default: 2.4, unit: 's' },
  ],
  recipe: {
    enter: '所有圓片以正面（主色）朝上。',
    motion: '翻面波沿方向掃過，每片以 ease-in-out 繞垂直軸轉 180°：寬度經過 0 再展開成背面顏色，翻轉中微微抬起。',
    hold: '波過後整片停在新顏色，直到下一道波。',
    exit: '下一道波把圓片翻回正面。',
    loop: '正 → 背 → 正 循環。',
  },
  accept: [
    '翻轉時圓片寬度壓扁到接近 0 再展開，不是淡入淡出。',
    '翻過去後顏色變為次色，下一波翻回主色。',
    '翻轉以波浪方式依位置延遲進行；切換方向或波形後波的走向改變。',
    '接近側面時可看到較暗的圓片厚度。',
  ],
  transparent: true,
  posterTime: 1.3,
  cycle: 4.8,
  create(ctx) {
    const spacing = capSpacing(ctx, num(ctx, 'spacing', 24) * (ctx.mode === 'card' ? 1.15 : 1), 2600 * ctx.q);
    const pattern = str(ctx, 'pattern', 'linear');
    const spread = num(ctx, 'spread', 0.9);
    const period = num(ctx, 'period', 2.4);
    const flipDur = clamp(0.62 / (0.5 + 0.5 * ctx.s.intensity), 0.15, 0.8);
    const grid = dotGrid(ctx.width, ctx.height, spacing);
    const ms = minSide(ctx);
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;
    const delay = new Float32Array(grid.n);
    const horiz = ctx.dir === 'left' || ctx.dir === 'right';
    for (let k = 0; k < grid.n; k++) {
      const x = grid.x[k];
      const y = grid.y[k];
      let d: number;
      if (pattern === 'radial') d = Math.hypot(x - cx, y - cy) / (ms * 0.8);
      else if (pattern === 'noise') d = 0.5 + 0.5 * noise2(x / (ms * 0.28), y / (ms * 0.28), ctx.seed);
      else {
        const along = horiz ? x / ctx.width : y / ctx.height;
        d = ctx.dirSign > 0 ? along : 1 - along;
        // a little diagonal skew so the wave reads as a wave, not a wipe
        const across = (horiz ? y / ctx.height : x / ctx.width) - 0.5;
        d += 0.1 * across + 0.05 * Math.sin(across * Math.PI * 3);
      }
      delay[k] = d;
    }
    const r = spacing * 0.4;
    const front = ctx.s.primary;
    const back = ctx.s.secondary;
    const shade = (c: string) => Array.from({ length: SHADES }, (_, i) => mixHex(c, '#000000', 0.42 * (1 - i / (SHADES - 1))));
    const frontShades = shade(front);
    const backShades = shade(back);
    const rimF = mixHex(front, '#000000', 0.5);
    const rimB = mixHex(back, '#000000', 0.5);
    // per-frame buckets: [face(0 front/1 back)][shade] → flat lists
    const buckets: number[][] = Array.from({ length: SHADES * 2 }, () => []);
    const rims: number[][] = [[], []];
    return canvasRuntime(ctx, (g, t) => {
      for (const b of buckets) b.length = 0;
      rims[0].length = 0;
      rims[1].length = 0;
      for (let k = 0; k < grid.n; k++) {
        const u = t / period - delay[k] * spread + 10;
        const n = Math.floor(u);
        const fr = u - n;
        const p = easeInOut(clamp(fr / (flipDur / period), 0, 1));
        const th = Math.PI * (n + p);
        const c = Math.cos(th);
        const ac = Math.abs(c);
        const lift = 1 + 0.18 * Math.sin(Math.PI * p);
        const face = c >= 0 ? 0 : 1;
        const si = Math.min(SHADES - 1, Math.floor(ac * SHADES));
        const rr = r * lift;
        buckets[face * SHADES + si].push(grid.x[k], grid.y[k], rr * Math.max(ac, 0.02), rr);
        if (ac < 0.35) rims[face].push(grid.x[k], grid.y[k], rr, ac);
      }
      // disc thickness: a thin vertical bar visible when nearly edge-on
      for (let f = 0; f < 2; f++) {
        const list = rims[f];
        if (!list.length) continue;
        g.fillStyle = f === 0 ? rimF : rimB;
        g.beginPath();
        for (let i = 0; i < list.length; i += 4) {
          const thick = Math.max(1, list[i + 2] * 0.12) * (1 - list[i + 3] / 0.35);
          g.rect(list[i] - thick / 2, list[i + 1] - list[i + 2], thick, list[i + 2] * 2);
        }
        g.fill();
      }
      for (let f = 0; f < 2; f++)
        for (let s = 0; s < SHADES; s++) {
          const list = buckets[f * SHADES + s];
          if (!list.length) continue;
          g.fillStyle = (f === 0 ? frontShades : backShades)[s];
          g.beginPath();
          for (let i = 0; i < list.length; i += 4) {
            g.moveTo(list[i] + list[i + 2], list[i + 1]);
            g.ellipse(list[i], list[i + 1], list[i + 2], list[i + 3], 0, 0, Math.PI * 2);
          }
          g.fill();
        }
    });
  },
});
