import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, easeInOut, easeOutBack, mixHex, mod, num, rgba, str } from '../../engine/helpers';
import { rng } from '../../engine/random';
import { poly } from './_util';

const COS30 = Math.cos(Math.PI / 6);

interface Mover {
  path: [number, number][];
  offset: number;
}
interface Riser {
  x: number;
  y: number;
  stack: number;
  offset: number;
  period: number;
}

export default defineEffect({
  id: 'isometric-grid',
  code: 'G01',
  nameZh: '等角網格',
  nameEn: 'Isometric Grid',
  category: 'grid',
  sourceType: 'reference',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '等角三向線網上，立方體沿格線一格一格移動，另有立方體從地面浮起再落回。',
  tags: ['等角', 'isometric', '立方體', '網格', '3D'],
  suitable: ['科技產品介紹', '資料／物流視覺', '載入畫面'],
  principle:
    'Canvas 2D 等角投影：screen = (cx + (x−y)·cos30°·s, cy + (x+y)·sin30°·s − z·s)。背景線網由 x、y 兩組世界格線與通過格點的垂直線組成三向等角網；立方體以 8 個頂點投影，只畫可見的頂面、右面（x+1）與左面（y+1），三面使用固定明暗。繪製順序依 (x+y) 深度、再依 z 由後往前（畫家演算法）。移動立方體沿 seeded 矩形迴圈逐格 ease 滑動（或拋物線跳格），浮起立方體以 back-out 升起、落地有阻尼回彈，地面投影隨高度縮小。',
  defaultText: '',
  palette: 'COOL',
  controls: ['intensity', 'scale', 'secondary', 'accent', 'seed'],
  params: [
    { key: 'size', label: '網格大小', type: 'select', default: '8', options: [{ value: '6', label: '6 × 6' }, { value: '8', label: '8 × 8' }, { value: '10', label: '10 × 10' }] },
    { key: 'stepTime', label: '每格移動時間', type: 'range', min: 0.25, max: 1.5, step: 0.05, default: 0.6, unit: 's' },
    { key: 'motion', label: '移動方式', type: 'select', default: 'slide', options: [{ value: 'slide', label: '滑動' }, { value: 'hop', label: '跳格' }] },
    { key: 'risers', label: '浮起立方體數', type: 'range', min: 0, max: 8, step: 1, default: 4 },
    { key: 'lattice', label: '全畫面線網', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '線網與立方體一開始即在畫面中，靜止的地面格以較深線條標示。',
    motion: '移動立方體沿矩形迴圈逐格前進，每格 ease-in-out 滑動後短暫停頓；浮起立方體以 back-out 升起一到兩格高，停留後落下並有小回彈。',
    hold: '每一步之間約 30% 時間停在格點上。',
    exit: '無離場，持續循環。',
    loop: '迴圈路徑與浮起週期都是時間的週期函數，可無限播放。',
  },
  accept: [
    '所有立方體三面的明暗方向一致，邊與線網的 30° 斜線平行。',
    '立方體只沿格線移動，停頓時剛好落在格子上。',
    '前方立方體正確遮住後方立方體（無穿插錯序）。',
    '浮起時地面投影縮小，落地後回彈並停住。',
    '關閉「全畫面線網」後只剩地面區域格線。',
  ],
  transparent: true,
  cycle: 12,
  posterTime: 1.3,
  create(ctx) {
    const N = parseInt(str(ctx, 'size', '8'), 10) || 8;
    const stepT = num(ctx, 'stepTime', 0.6);
    const hop = str(ctx, 'motion', 'slide') === 'hop';
    const nRisers = Math.round(num(ctx, 'risers', 4));
    const lattice = bool(ctx, 'lattice', true);
    const amp = ctx.s.intensity;
    const R = rng(ctx.rand);
    const { width: w, height: h } = ctx;

    const s = Math.min((0.86 * w) / (2 * N * COS30), (0.8 * h) / (N + 2.2)) * ctx.s.scale;
    const cx = w / 2;
    const cy0 = h / 2 - (N * s) / 2 + 0.9 * s;
    const X = (x: number, y: number) => cx + (x - y) * COS30 * s;
    const Y = (x: number, y: number, z: number) => cy0 + (x + y) * 0.5 * s - z * s;

    // --- movers: one rectangular loop per quadrant block (blocks are disjoint → no collisions)
    const B = Math.floor(N / 2);
    const used = new Set<number>();
    const movers: Mover[] = [];
    for (let by = 0; by < 2; by++)
      for (let bx = 0; bx < 2; bx++) {
        const rw = R.int(2, B);
        const rh = R.int(2, B);
        const x0 = bx * B + R.int(0, B - rw);
        const y0 = by * B + R.int(0, B - rh);
        const path: [number, number][] = [];
        for (let i = 0; i < rw; i++) path.push([x0 + i, y0]);
        for (let j = 1; j < rh; j++) path.push([x0 + rw - 1, y0 + j]);
        for (let i = rw - 2; i >= 0; i--) path.push([x0 + i, y0 + rh - 1]);
        for (let j = rh - 2; j >= 1; j--) path.push([x0, y0 + j]);
        if (R.sign() < 0) path.reverse();
        for (const [px, py] of path) used.add(py * N + px);
        movers.push({ path, offset: R.int(0, path.length - 1) });
      }
    // --- risers on free cells
    const free: number[] = [];
    for (let k = 0; k < N * N; k++) if (!used.has(k)) free.push(k);
    const risers: Riser[] = R.shuffle(free)
      .slice(0, nRisers)
      .map((k) => ({ x: k % N, y: Math.floor(k / N), stack: R.int(1, 2), offset: ctx.rand() * 5, period: 4 + ctx.rand() * 2.5 }));

    const topA = ctx.s.primary;
    const cubeCols = (top: string) => ({
      top,
      left: ctx.s.secondary,
      right: mixHex(ctx.s.secondary, ctx.s.background, 0.45),
    });
    const moverCol = cubeCols(topA);
    const riserCol = cubeCols(ctx.s.accent);
    const edge = rgba(ctx.s.background, 0.35);

    const drawCube = (g: CanvasRenderingContext2D, x: number, y: number, z: number, col: { top: string; left: string; right: string }) => {
      const x1 = x + 1;
      const y1 = y + 1;
      const z1 = z + 1;
      g.lineWidth = 1;
      g.lineJoin = 'round';
      g.strokeStyle = edge;
      // left face (y+1 plane)
      g.fillStyle = col.left;
      poly(g, [X(x, y1), Y(x, y1, z1), X(x1, y1), Y(x1, y1, z1), X(x1, y1), Y(x1, y1, z), X(x, y1), Y(x, y1, z)]);
      g.fill();
      g.stroke();
      // right face (x+1 plane)
      g.fillStyle = col.right;
      poly(g, [X(x1, y), Y(x1, y, z1), X(x1, y1), Y(x1, y1, z1), X(x1, y1), Y(x1, y1, z), X(x1, y), Y(x1, y, z)]);
      g.fill();
      g.stroke();
      // top
      g.fillStyle = col.top;
      poly(g, [X(x, y), Y(x, y, z1), X(x1, y), Y(x1, y, z1), X(x1, y1), Y(x1, y1, z1), X(x, y1), Y(x, y1, z1)]);
      g.fill();
      g.stroke();
    };
    const shadow = (g: CanvasRenderingContext2D, x: number, y: number, z: number) => {
      if (z <= 0.02) return;
      const k = clamp(1 - z / 3.5, 0.35, 1);
      const m = (1 - k) / 2;
      g.fillStyle = rgba(ctx.s.secondary, 0.35 * k);
      poly(g, [X(x + m, y + m), Y(x + m, y + m, 0), X(x + 1 - m, y + m), Y(x + 1 - m, y + m, 0), X(x + 1 - m, y + 1 - m), Y(x + 1 - m, y + 1 - m, 0), X(x + m, y + 1 - m), Y(x + m, y + 1 - m, 0)]);
      g.fill();
    };

    const M = Math.ceil(Math.max(w, h) / s) + 2;
    const latticeCol = rgba(ctx.s.primary, 0.13);
    const floorCol = rgba(ctx.s.accent, 0.42);

    return canvasRuntime(ctx, (g, t) => {
      // --- lattice: x-lines, y-lines, verticals through every lattice vertex
      if (lattice) {
        g.strokeStyle = latticeCol;
        g.lineWidth = 1;
        g.beginPath();
        for (let k = -M; k <= N + M; k++) {
          g.moveTo(X(-M, k), Y(-M, k, 0));
          g.lineTo(X(N + M, k), Y(N + M, k, 0));
          g.moveTo(X(k, -M), Y(k, -M, 0));
          g.lineTo(X(k, N + M), Y(k, N + M, 0));
        }
        const step = COS30 * s;
        const first = cx - Math.ceil(cx / step) * step;
        for (let sx = first; sx <= w; sx += step) {
          g.moveTo(sx, 0);
          g.lineTo(sx, h);
        }
        g.stroke();
      }
      // --- floor grid
      g.strokeStyle = floorCol;
      g.lineWidth = 1.25;
      g.beginPath();
      for (let k = 0; k <= N; k++) {
        g.moveTo(X(0, k), Y(0, k, 0));
        g.lineTo(X(N, k), Y(N, k, 0));
        g.moveTo(X(k, 0), Y(k, 0, 0));
        g.lineTo(X(k, N), Y(k, N, 0));
      }
      g.stroke();

      // --- gather cubes
      const items: { x: number; y: number; z: number; col: typeof moverCol; base: boolean }[] = [];
      for (const m of movers) {
        const L = m.path.length;
        const u = t / stepT + m.offset;
        const k = Math.floor(u);
        const f = clamp((u - k) / 0.7, 0, 1);
        const e = easeInOut(f);
        const a = m.path[mod(k, L)];
        const b = m.path[mod(k + 1, L)];
        const x = a[0] + (b[0] - a[0]) * e;
        const y = a[1] + (b[1] - a[1]) * e;
        const z = hop ? Math.sin(Math.PI * f) * 0.7 * amp : 0;
        items.push({ x, y, z, col: moverCol, base: true });
      }
      for (const r of risers) {
        const p = mod(t + r.offset, r.period) / r.period;
        let z = 0;
        const top = (0.8 + 0.6 * r.stack) * amp;
        if (p < 0.25) z = top * easeOutBack(p / 0.25, 1.4);
        else if (p < 0.55) z = top;
        else if (p < 0.72) z = top * (1 - ((p - 0.55) / 0.17) ** 2);
        else {
          // landing bounce: starts and ends at 0, decays
          const tt = (p - 0.72) * r.period;
          z = 0.3 * amp * Math.exp(-4 * tt) * Math.abs(Math.sin(tt * 9));
        }
        for (let i = 0; i < r.stack; i++) items.push({ x: r.x, y: r.y, z: z + i, col: riserCol, base: i === 0 });
      }
      // shadows first (floor level)
      for (const it of items) if (it.base) shadow(g, it.x, it.y, it.z);
      // painter's order: depth (x+y) then height
      items.sort((A, Bi) => A.x + A.y - (Bi.x + Bi.y) || A.z - Bi.z);
      for (const it of items) drawCube(g, it.x, it.y, it.z, it.col);
    });
  },
});
