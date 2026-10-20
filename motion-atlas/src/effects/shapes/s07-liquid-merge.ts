import { defineEffect } from '../../engine/define';
import { C } from '../../engine/palette';
import { bool, canvasRuntime, clamp, lerp, minSide, num, smoothstep, TAU } from '../../engine/helpers';

const CYCLE = 10;

interface Blob {
  r: number;
  a0: number;
  f: number;
  ph: number;
  near: number;
  far: number;
  wob: number;
}

export default defineEffect({
  id: 'liquid-merge',
  code: 'S07',
  nameZh: '液態融合',
  nameEn: 'Liquid Merge',
  category: 'shapes',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '幾顆軟性圓團靠近主體時融成一體，拉開時拖出逐漸變細的液橋後斷開，黏稠度可調。',
  tags: ['metaball', '液態', 'gooey', '融合', 'marching squares'],
  suitable: ['飲品／美妝品牌', '音樂視覺', '載入動畫'],
  principle:
    'Canvas 2D：在低解析網格（約 6 px／格，依品質係數放大）上計算 metaball 場 f = Σ (rᵢ/dᵢ)^p，以 marching squares 在門檻 f = 1 處做線性插值取出等值輪廓，整片內部格子以列為單位合併成矩形，所有片段放進同一條 path 一次填色，因此邊緣平滑、沒有模糊或接縫。p 由「黏稠度」控制：p 小時遠距離的場互相疊加，液橋更長更粗；p 大時接近一般圓形相交。',
  defaultText: '',
  palette: 'STREET',
  colors: { primary: C.red, secondary: C.cream },
  controls: ['scale', 'direction', 'secondary', 'seed'],
  directions: ['cw', 'ccw'],
  params: [
    { key: 'goo', label: '黏稠度（gooey）', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'count', label: '小圓團數量', type: 'range', min: 1, max: 6, step: 1, default: 4 },
    { key: 'core', label: '顯示內層等值線', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '主圓團與周圍小圓團已在畫面中。',
    motion: '小圓團沿放射方向往返：靠近時先鼓起一座橋再併入主體；拉開時液橋變細、斷開，邊緣回到圓形。整體同時緩慢公轉。',
    hold: '連續流動，無停頓。',
    exit: '無離場。',
    loop: '所有頻率為 1/10 Hz 的整數倍，10 秒無縫循環。',
  },
  accept: [
    '小圓團與主體距離拉開時，兩者之間出現逐漸變細的液橋後斷開。',
    '黏稠度調高時液橋更長、更早接合；調到 0 時幾乎只是圓形重疊。',
    '輪廓為實色填滿、邊緣清楚，沒有模糊或網格縫隙。',
    '改變 seed 後小圓團的大小與節奏改變。',
  ],
  transparent: true,
  cycle: CYCLE,
  posterTime: 2.6,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const goo = num(ctx, 'goo', 0.55);
    const ns = Math.round(num(ctx, 'count', 4));
    const core = bool(ctx, 'core', true);
    const p = lerp(6, 1.25, goo);
    const half = p / 2;
    const cs = clamp(Math.round(5.5 / Math.max(0.4, ctx.q)), 5, 14);
    const cols = Math.ceil(w / cs);
    const rows = Math.ceil(h / cs);
    const stride = cols + 1;
    const field = new Float32Array(stride * (rows + 1));
    const cx = w / 2;
    const cy = h / 2;
    const R = m * 0.17 * ctx.s.scale;
    const ax = clamp(w / h, 1, 1.65);
    const blobs: Blob[] = [];
    for (let k = 0; k < ns; k++) {
      blobs.push({
        r: R * (0.36 + ctx.rand() * 0.2),
        a0: (k / ns) * TAU + (ctx.rand() - 0.5) * 0.6,
        f: 1 + (k % 2),
        ph: ctx.rand() * TAU,
        near: 0.35 + ctx.rand() * 0.15,
        far: 1.75 + ctx.rand() * 0.35,
        wob: (ctx.rand() - 0.5) * 0.5,
      });
    }
    const bx = new Float32Array(ns + 1);
    const by = new Float32Array(ns + 1);
    const br2 = new Float32Array(ns + 1);

    /** Fill the iso-contour f = level as one path (marching squares + row runs). */
    const contour = (g: CanvasRenderingContext2D, level: number, fill: string) => {
      g.beginPath();
      for (let j = 0; j < rows; j++) {
        const y0 = j * cs;
        const y1 = y0 + cs;
        let run = -1;
        for (let i = 0; i < cols; i++) {
          const k = j * stride + i;
          const va = field[k] - level;
          const vb = field[k + 1] - level;
          const vc = field[k + stride + 1] - level;
          const vd = field[k + stride] - level;
          const full = va > 0 && vb > 0 && vc > 0 && vd > 0;
          if (full) {
            if (run < 0) run = i;
            continue;
          }
          if (run >= 0) {
            g.rect(run * cs, y0, (i - run) * cs, cs);
            run = -1;
          }
          if (va <= 0 && vb <= 0 && vc <= 0 && vd <= 0) continue;
          const x0 = i * cs;
          const x1 = x0 + cs;
          let first = true;
          const add = (x: number, y: number) => {
            if (first) {
              g.moveTo(x, y);
              first = false;
            } else g.lineTo(x, y);
          };
          // walk TL → TR → BR → BL, emitting inside corners and edge crossings
          if (va > 0) add(x0, y0);
          if (va > 0 !== vb > 0) add(x0 + (cs * va) / (va - vb), y0);
          if (vb > 0) add(x1, y0);
          if (vb > 0 !== vc > 0) add(x1, y0 + (cs * vb) / (vb - vc));
          if (vc > 0) add(x1, y1);
          if (vc > 0 !== vd > 0) add(x1 - (cs * vc) / (vc - vd), y1);
          if (vd > 0) add(x0, y1);
          if (vd > 0 !== va > 0) add(x0, y1 - (cs * vd) / (vd - va));
          g.closePath();
        }
        if (run >= 0) g.rect(run * cs, y0, (cols - run) * cs, cs);
      }
      g.fillStyle = fill;
      g.fill();
    };

    return canvasRuntime(ctx, (g, t) => {
      const u = (TAU * t) / CYCLE;
      // main blob (index 0) bobs gently; satellites travel in and out along rotating spokes
      bx[0] = cx + Math.sin(u) * R * 0.12;
      by[0] = cy + Math.sin(u * 2) * R * 0.08;
      br2[0] = R * R;
      blobs.forEach((b, k) => {
        const s = smoothstep(0, 1, 0.5 - 0.5 * Math.cos(b.f * u + b.ph));
        const rho = R * lerp(b.near, b.far, s);
        const a = b.a0 + ctx.dirSign * u + b.wob * Math.sin(u * 2 + b.ph);
        bx[k + 1] = bx[0] + Math.cos(a) * rho * ax;
        by[k + 1] = by[0] + Math.sin(a) * rho;
        br2[k + 1] = b.r * b.r;
      });
      const nb = ns + 1;
      // field at grid nodes
      for (let j = 0; j <= rows; j++) {
        const y = j * cs;
        for (let i = 0; i <= cols; i++) {
          const x = i * cs;
          let f = 0;
          for (let q = 0; q < nb; q++) {
            const dx = x - bx[q];
            const dy = y - by[q];
            const ratio = br2[q] / (dx * dx + dy * dy + 1e-3);
            f += half === 1 ? ratio : Math.pow(ratio, half);
          }
          field[j * stride + i] = f;
        }
      }
      contour(g, 1, ctx.s.primary);
      if (core) contour(g, 2.4, ctx.s.secondary);
    });
  },
});
