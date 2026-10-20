import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, easeInOut, minSide, num, phase, rgba, str, TAU } from '../../engine/helpers';
import { regularPoly, starPts, type Pt } from '../../engine/shapes';

type ShapeKind = 'circle' | 'triangle' | 'square' | 'star' | 'hexagon' | 'spiral' | 'wave' | 'infinity';
const KINDS: ShapeKind[] = ['circle', 'triangle', 'star', 'square', 'spiral', 'hexagon', 'infinity', 'wave'];

function shapePts(kind: ShapeKind, cx: number, cy: number, r: number, rot: number): Pt[] {
  const close = (p: Pt[]) => p.concat([p[0]]);
  switch (kind) {
    case 'circle':
      return Array.from({ length: 97 }, (_, i) => {
        const a = rot + (i / 96) * TAU;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt;
      });
    case 'triangle':
      return close(regularPoly(cx, cy + r * 0.12, r * 1.05, 3, rot - Math.PI / 2));
    case 'square':
      return close(regularPoly(cx, cy, r * 1.1, 4, rot - Math.PI / 4));
    case 'hexagon':
      return close(regularPoly(cx, cy, r, 6, rot));
    case 'star':
      return close(starPts(cx, cy, r * 1.08, 0.45, 5, rot - Math.PI / 2));
    case 'spiral':
      return Array.from({ length: 160 }, (_, i) => {
        const u = i / 159;
        const a = rot + u * TAU * 3;
        const rr = r * (0.08 + 0.92 * u);
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as Pt;
      });
    case 'infinity':
      return Array.from({ length: 121 }, (_, i) => {
        const a = (i / 120) * TAU;
        const d = 1 + Math.sin(a) ** 2;
        return [cx + (r * 1.15 * Math.cos(a)) / d, cy + (r * 1.15 * Math.sin(a) * Math.cos(a)) / d] as Pt;
      });
    case 'wave':
      return Array.from({ length: 121 }, (_, i) => {
        const u = i / 120;
        return [cx - r + u * 2 * r, cy + Math.sin(u * TAU * 2) * r * 0.45 * (1 - Math.abs(u - 0.5))] as Pt;
      });
  }
}

interface Path {
  pts: Pt[];
  cum: number[];
  len: number;
}

function measure(pts: Pt[]): Path {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}

/** point at arc length s (binary search on cumulative lengths) */
function pointAt(p: Path, s: number): { i: number; x: number; y: number } {
  const v = clamp(s, 0, p.len);
  let lo = 0;
  let hi = p.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p.cum[mid] <= v) lo = mid;
    else hi = mid;
  }
  const seg = p.cum[hi] - p.cum[lo] || 1;
  const u = (v - p.cum[lo]) / seg;
  return { i: lo, x: p.pts[lo][0] + (p.pts[hi][0] - p.pts[lo][0]) * u, y: p.pts[lo][1] + (p.pts[hi][1] - p.pts[lo][1]) * u };
}

/** stroke the sub-path between arc lengths a..b */
function strokeRange(g: CanvasRenderingContext2D, p: Path, a: number, b: number) {
  if (b - a < 0.5) return;
  const A = pointAt(p, a);
  const B = pointAt(p, b);
  g.beginPath();
  g.moveTo(A.x, A.y);
  for (let i = A.i + 1; i <= B.i; i++) g.lineTo(p.pts[i][0], p.pts[i][1]);
  g.lineTo(B.x, B.y);
  g.stroke();
}

export default defineEffect({
  id: 'line-draw',
  code: 'L10',
  nameZh: '線條繪圖',
  nameEn: 'Line Draw',
  category: 'lines',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '圓、三角、星形、螺旋等幾何圖形沿 stroke 路徑一段段畫出，停留後由起點追著擦除。',
  tags: ['描線', 'line draw', 'stroke', '路徑動畫', '幾何'],
  suitable: ['圖示動畫', '教學示意', '品牌線稿開場'],
  principle:
    'Canvas 2D：每個圖形先轉成折線並計算累積弧長 cum[i] 與總長 L（等同 SVG getTotalLength）。繪製時只描出弧長區間 [s₀, s₁]：s₁ = L·ease(p)、擦除時 s₀ = L·ease(q)，以二分搜尋找到端點所在線段再內插，等同 stroke-dasharray = L、dashoffset 由 L→0。「等速」模式下所有圖形用同一 px/s，短路徑先完成；「同時完成」模式依各自長度正規化。',
  defaultText: '',
  palette: 'STREET',
  controls: ['scale', 'secondary', 'seed'],
  params: [
    {
      key: 'timing',
      label: '長度處理',
      type: 'select',
      options: [
        { value: 'speed', label: '等速（短的先完成）' },
        { value: 'time', label: '同時完成' },
        { value: 'sequence', label: '依序接力' },
      ],
      default: 'speed',
    },
    { key: 'count', label: '圖形數量', type: 'range', min: 1, max: 6, step: 1, default: 4 },
    { key: 'draw', label: '繪製時間', type: 'range', min: 1, max: 6, step: 0.25, default: 2.6, unit: 's' },
    { key: 'hold', label: '停留', type: 'range', min: 0.2, max: 3, step: 0.1, default: 0.9, unit: 's' },
    { key: 'lineWidth', label: '線寬', type: 'range', min: 1, max: 10, step: 0.5, default: 4, unit: 'px' },
    { key: 'guide', label: '顯示淡色導引', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '空白畫面（可選淡色導引線）上，筆頭出現在每個圖形起點。',
    motion: '筆頭沿路徑以 ease-in-out 畫出線條；等速模式下短圖形先畫完等待長圖形。',
    hold: '全部完成後停留約 0.9 秒。',
    exit: '線條由起點往終點被追著擦除（ease-in）。',
    loop: '擦除完成後短暫空白，再重新繪製。',
  },
  accept: [
    '每個圖形都是沿路徑逐段畫出，不是整個淡入。',
    '等速模式下圓形比螺旋先完成；同時完成模式下全部同時畫完。',
    '擦除從起點開始追向終點，完成後畫面清空。',
    '筆頭圓點始終位於線條末端。',
  ],
  transparent: true,
  loopable: true,
  cycle: 6,
  posterTime: 3,
  create(ctx) {
    const timing = str(ctx, 'timing', 'speed');
    const count = Math.round(num(ctx, 'count', 4));
    const drawT = num(ctx, 'draw', 2.6);
    const holdT = num(ctx, 'hold', 0.9);
    const lw = num(ctx, 'lineWidth', 4);
    const guide = bool(ctx, 'guide', true);
    const W = ctx.width;
    const H = ctx.height;
    // grid that gives the largest cells for this aspect
    let best = { c: 1, r: count, s: 0 };
    for (let c = 1; c <= count; c++) {
      const r = Math.ceil(count / c);
      const s = Math.min((W * 0.9) / c, (H * 0.86) / r);
      if (s > best.s) best = { c, r, s };
    }
    const cell = best.s;
    const R = cell * 0.36 * clamp(ctx.s.scale, 0.5, 1.4);
    const order = KINDS.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(ctx.rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const paths: Path[] = [];
    for (let k = 0; k < count; k++) {
      const row = Math.floor(k / best.c);
      const inRow = Math.min(best.c, count - row * best.c);
      const col = k - row * best.c;
      const cx = W / 2 + (col - (inRow - 1) / 2) * cell;
      const cy = H / 2 + (row - (best.r - 1) / 2) * cell;
      paths.push(measure(shapePts(order[k], cx, cy, R, (ctx.rand() - 0.5) * 0.6)));
    }
    const maxLen = Math.max(...paths.map((p) => p.len));
    const total = paths.reduce((a, p) => a + p.len, 0);
    const starts: number[] = [];
    paths.reduce((acc, p) => (starts.push(acc), acc + p.len), 0);
    const eraseT = Math.max(0.6, drawT * 0.45);

    /** drawn length of path k at global progress e (0..1) */
    const reach = (k: number, e: number) => {
      const p = paths[k];
      if (timing === 'time') return p.len * e;
      if (timing === 'sequence') return clamp(e * total - starts[k], 0, p.len);
      return Math.min(p.len, e * maxLen);
    };
    const m = minSide(ctx);
    const dot = clamp(lw * 1.4, 3, 9) * (m < 300 ? 0.8 : 1);

    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, [drawT, holdT, eraseT, 0.4]);
      const drawE = ph.i === 0 ? easeInOut(ph.p) : 1;
      const eraseE = ph.i < 2 ? 0 : ph.i === 2 ? ph.p * ph.p * (3 - 2 * ph.p) : 1;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      if (guide) {
        g.strokeStyle = rgba(ctx.s.primary, 0.12);
        g.lineWidth = 1;
        g.setLineDash([3, 5]);
        for (const p of paths) strokeRange(g, p, 0, p.len);
        g.setLineDash([]);
      }
      g.strokeStyle = ctx.s.primary;
      g.lineWidth = lw;
      for (let k = 0; k < paths.length; k++) {
        const p = paths[k];
        const s1 = reach(k, drawE);
        const s0 = reach(k, eraseE);
        strokeRange(g, p, s0, s1);
        // pen head while drawing, eraser head while erasing
        const active = (ph.i === 0 && s1 > 0 && s1 < p.len) || (ph.i === 2 && s0 > 0 && s0 < p.len);
        if (active) {
          const pt = pointAt(p, ph.i === 0 ? s1 : s0);
          g.fillStyle = ctx.s.secondary;
          g.beginPath();
          g.arc(pt.x, pt.y, dot, 0, TAU);
          g.fill();
        }
      }
    }, { settle: drawT + holdT * 0.5 });
  },
});
