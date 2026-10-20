import { defineEffect } from '../../engine/define';
import { C } from '../../engine/palette';
import { canvasRuntime, easeOutBack, minSide, mod, num, smoothstep, str, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { capSpacing, DotBatch, dotGrid } from './_util';

type Pattern = 'wave' | 'stripes' | 'radar' | 'blocks';
const ORDER: Pattern[] = ['wave', 'stripes', 'radar', 'blocks'];

export default defineEffect({
  id: 'dot-matrix',
  code: 'H02',
  nameZh: '點矩陣',
  nameEn: 'Dot Matrix',
  category: 'halftone',
  sourceType: 'partial-reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '規律的 LED 點陣以區塊為單位亮起、熄滅，依序拼出擴散波、斜紋、雷達掃描與隨機區塊。',
  tags: ['點矩陣', 'LED', 'dot matrix', '區塊', '圖樣'],
  suitable: ['看板／告示風格', '音樂視覺', '科技介面背景'],
  principle:
    'Canvas 2D：每個網點是實際繪製的圓，網格再分成 zone×zone 的區塊。每區塊在每幀由圖樣函數 f(區塊中心, t) 求值（波 = sin(距離·k − ωt)、斜紋 = sin(投影·k − ωt)、雷達 = 角度扣掉旋轉、區塊 = hash 每 0.45 s 換一次），smoothstep 門檻後得到亮度 k；亮點半徑以 easeOutBack(k) 彈出、使用主色，暗點維持小點與次色。循環模式每 3.2 s 換圖樣，並於 0.5 s 內交叉混合 f 使切換以邊界推進而非整片閃爍。',
  defaultText: '',
  palette: 'MONO',
  colors: { background: C.black, primary: C.yellow, secondary: '#3A3A3A' },
  controls: ['intensity', 'secondary', 'seed'],
  params: [
    { key: 'pitch', label: '點距', type: 'range', min: 8, max: 30, step: 1, default: 14, unit: 'px' },
    { key: 'zone', label: '區塊大小（點）', type: 'range', min: 1, max: 8, step: 1, default: 3 },
    {
      key: 'pattern',
      label: '圖樣',
      type: 'select',
      default: 'cycle',
      options: [
        { value: 'cycle', label: '輪播全部' },
        { value: 'wave', label: '擴散波' },
        { value: 'stripes', label: '斜紋' },
        { value: 'radar', label: '雷達掃描' },
        { value: 'blocks', label: '隨機區塊' },
      ],
    },
  ],
  recipe: {
    enter: '暗色小點陣列已在畫面上。',
    motion: '區塊依圖樣函數亮起（半徑 easeOutBack 彈出、改主色）再熄滅，形成移動的波、斜紋、旋轉扇形或跳動區塊。',
    hold: '每種圖樣持續約 3.2 秒。',
    exit: '圖樣以 0.5 秒交叉混合推進到下一種。',
    loop: '四種圖樣輪播，無限循環。',
  },
  accept: [
    '網點全為實際圓點，亮點明顯較大且為主色，暗點保留可見小點。',
    '亮起單位是方形區塊；區塊大小設為 1 時變成逐點。',
    '輪播模式下可依序看到擴散波、斜紋、雷達與隨機區塊。',
    '沒有整個畫面同時閃爍的情況。',
  ],
  transparent: true,
  posterTime: 1.2,
  cycle: 12.8,
  create(ctx) {
    const pitch = capSpacing(ctx, num(ctx, 'pitch', 14) * (ctx.mode === 'card' ? 1.25 : 1), 5000 * ctx.q);
    const zone = Math.max(1, Math.round(num(ctx, 'zone', 3)));
    const mode = str(ctx, 'pattern', 'cycle');
    const grid = dotGrid(ctx.width, ctx.height, pitch);
    const zc = Math.ceil(grid.cols / zone);
    const zr = Math.ceil(grid.rows / zone);
    const nz = zc * zr;
    const zx = new Float32Array(nz);
    const zy = new Float32Array(nz);
    const ms = minSide(ctx);
    const ox = grid.x[0];
    const oy = grid.y[0];
    for (let j = 0; j < zr; j++)
      for (let i = 0; i < zc; i++) {
        // zone centre, normalised by the short side, relative to the stage centre
        zx[j * zc + i] = (ox + (i * zone + (zone - 1) / 2) * pitch - ctx.width / 2) / ms;
        zy[j * zc + i] = (oy + (j * zone + (zone - 1) / 2) * pitch - ctx.height / 2) / ms;
      }
    const zoneOf = new Int32Array(grid.n);
    for (let k = 0; k < grid.n; k++) zoneOf[k] = Math.floor(grid.ri[k] / zone) * zc + Math.floor(grid.ci[k] / zone);
    const lit = new Float32Array(nz);
    const sp = 0.5 + 0.5 * ctx.s.intensity;
    const seed = ctx.seed;
    const rOn = pitch * 0.44;
    const rOff = pitch * 0.16;

    const field = (p: Pattern, x: number, y: number, z: number, t: number) => {
      switch (p) {
        case 'wave': {
          const d = Math.hypot(x, y);
          return 0.5 + 0.5 * Math.sin(d * 14 - t * 4.2 * sp);
        }
        case 'stripes': {
          const a = 0.6 + t * 0.25 * sp;
          return 0.5 + 0.5 * Math.sin((x * Math.cos(a) + y * Math.sin(a)) * 11 - t * 3.6 * sp);
        }
        case 'radar': {
          const ang = mod(Math.atan2(y, x) - t * 1.7 * sp, TAU) / TAU;
          return 1 - ang * 1.6 + (Math.hypot(x, y) < 0.06 ? 1 : 0);
        }
        default: {
          const step = 0.45 / sp;
          const m = Math.floor(t / step);
          const fr = (t - m * step) / step;
          const prev = hash2(z, m - 1, seed) > 0.62 ? 1 : 0;
          const cur = hash2(z, m, seed) > 0.62 ? 1 : 0;
          return prev + (cur - prev) * smoothstep(0, 0.35, fr);
        }
      }
    };

    return canvasRuntime(ctx, (g, t) => {
      let pa: Pattern;
      let pb: Pattern | null = null;
      let mixAB = 0;
      if (mode === 'cycle') {
        const seg = 3.2;
        const idx = Math.floor(t / seg);
        const fr = t - idx * seg;
        pa = ORDER[mod(idx, ORDER.length)];
        if (fr > seg - 0.5) {
          pb = ORDER[mod(idx + 1, ORDER.length)];
          mixAB = smoothstep(seg - 0.5, seg, fr);
        }
      } else pa = (ORDER.includes(mode as Pattern) ? mode : 'wave') as Pattern;
      for (let z = 0; z < nz; z++) {
        let f = field(pa, zx[z], zy[z], z, t);
        if (pb) {
          // the next pattern sweeps in from left to right instead of switching everywhere at once
          const local = smoothstep(0, 1, mixAB * 1.6 - (zx[z] + 0.9) * 0.35);
          f = f + (field(pb, zx[z], zy[z], z, t) - f) * local;
        }
        lit[z] = smoothstep(0.42, 0.58, f);
      }
      const on = new DotBatch(g);
      const off = new DotBatch(g);
      off.begin();
      for (let k = 0; k < grid.n; k++) {
        const v = lit[zoneOf[k]];
        if (v < 0.5) off.dot(grid.x[k], grid.y[k], rOff + (rOn - rOff) * easeOutBack(v, 2.2));
      }
      off.fill(ctx.s.secondary);
      on.begin();
      for (let k = 0; k < grid.n; k++) {
        const v = lit[zoneOf[k]];
        if (v >= 0.5) on.dot(grid.x[k], grid.y[k], rOff + (rOn - rOff) * easeOutBack(v, 2.2));
      }
      on.fill(ctx.s.primary);
    });
  },
});
