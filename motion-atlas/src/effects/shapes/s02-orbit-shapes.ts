import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, minSide, mix, num, rgba, TAU } from '../../engine/helpers';
import { shapePath, type Kind } from './_util';

const CYCLE = 12;
const KINDS: Kind[] = ['square', 'triangle', 'circle', 'diamond', 'hexagon', 'star', 'pill', 'square'];

interface Orbit {
  a: number;
  /** view elevation (rad): vertical radius = a·sin(elev) */
  elev: number;
  roll: number;
  k: number;
  ph: number;
  kind: Kind;
  r: number;
  spin: number;
  col: string;
}

export default defineEffect({
  id: 'orbit-shapes',
  code: 'S02',
  nameZh: '軌道圖形',
  nameEn: 'Orbit Shapes',
  category: 'shapes',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '不同幾何圖形沿各自傾斜的橢圓軌道公轉，靠近時放大、繞到後方時縮小變暗並被中心球遮住。',
  tags: ['軌道', 'orbit', '景深', '公轉', '幾何'],
  suitable: ['科技品牌背景', '產品發表開場', '載入畫面'],
  principle:
    'Canvas 2D 偽 3D：每條軌道是 XZ 平面上的圓 (a·cosθ, a·sinθ)，依仰角投影成 y = Z·sin(仰角)、深度 = Z·cos(仰角)，再於畫面上旋轉 roll 角；透視縮放 s = F/(F − 深度)。每幀把所有圖形與中心球依深度排序（畫家演算法），軌道線分成後半與前半兩次繪製，因此繞到後方的圖形會被中心球遮住。角速度為 2π·k/12（k 為整數），12 秒無縫循環。',
  defaultText: '',
  palette: 'COOL',
  controls: ['scale', 'direction', 'secondary', 'accent', 'seed'],
  directions: ['ccw', 'cw'],
  params: [
    { key: 'count', label: '軌道數量', type: 'range', min: 2, max: 8, step: 1, default: 5 },
    { key: 'tilt', label: '軌道仰角', type: 'range', min: 5, max: 60, step: 1, default: 22, unit: '°' },
    { key: 'depth', label: '透視強度', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'lines', label: '顯示軌道線', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '所有圖形已在軌道上。',
    motion: '內圈快、外圈慢的等速公轉；圖形自轉；前方放大、後方縮小並混入背景色。',
    hold: '連續運動，無停頓。',
    exit: '無離場。',
    loop: '12 秒後所有軌道相位回到原點，無縫循環。',
  },
  accept: [
    '圖形繞到中心球後方時被遮住，繞到前方時蓋住中心球。',
    '前方圖形明顯較大且較亮，後方較小較暗。',
    '仰角調到最小時軌道接近水平線，調大時軌道更圓。',
    '透視強度為 0 時前後圖形同大小（只剩遮擋）。',
  ],
  transparent: true,
  cycle: CYCLE,
  posterTime: 1.6,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const n = Math.round(num(ctx, 'count', 5));
    const tilt = (num(ctx, 'tilt', 22) * Math.PI) / 180;
    const depthAmt = num(ctx, 'depth', 0.6);
    const lines = bool(ctx, 'lines', true);
    const sc = ctx.s.scale;
    const cx = w / 2;
    const cy = h / 2;
    const coreR = m * 0.11 * sc;
    const F = m * (1.3 + (1 - depthAmt) ** 2 * 14);
    const maxA = Math.min(w * 0.44, (h * 0.42) / Math.max(0.12, Math.sin(tilt + 0.35)), m * 0.9);
    const orbits: Orbit[] = [];
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 1 : i / (n - 1);
      const a = (coreR * 1.7 + (maxA - coreR * 1.7) * u) * Math.min(1, sc);
      orbits.push({
        a,
        elev: tilt * (0.75 + ctx.rand() * 0.5),
        roll: (ctx.rand() - 0.5) * 0.7,
        k: Math.max(1, Math.min(3, n - i > 3 ? 3 : n - i)) * ctx.dirSign,
        ph: ctx.rand() * TAU,
        kind: KINDS[i % KINDS.length],
        r: m * (0.032 + ctx.rand() * 0.02) * sc,
        spin: (1 + (i % 2)) * (i % 3 === 0 ? -1 : 1),
        col: i % 2 ? ctx.s.accent : ctx.s.primary,
      });
    }
    const proj = (o: Orbit, th: number) => {
      const X = o.a * Math.cos(th);
      const Z = o.a * Math.sin(th);
      const y = Z * Math.sin(o.elev);
      const d = Z * Math.cos(o.elev);
      const cr = Math.cos(o.roll);
      const sr = Math.sin(o.roll);
      const s = F / (F - d);
      return { x: cx + (X * cr - y * sr) * s, y: cy + (X * sr + y * cr) * s, d, s };
    };
    const SEG = 72;
    const drawOrbitHalf = (g: CanvasRenderingContext2D, o: Orbit, front: boolean) => {
      g.beginPath();
      let pen = false;
      for (let k = 0; k <= SEG; k++) {
        const th = (k / SEG) * TAU;
        const p = proj(o, th);
        const isFront = Math.sin(th) >= 0;
        if (isFront === front) {
          if (!pen) g.moveTo(p.x, p.y);
          else g.lineTo(p.x, p.y);
          pen = true;
        } else pen = false;
      }
      g.stroke();
    };
    return canvasRuntime(ctx, (g, t) => {
      const lw = Math.max(1, m * 0.0028);
      const items = orbits.map((o) => {
        const th = o.ph + (o.k * TAU * t) / CYCLE;
        return { o, th, ...proj(o, th) };
      });
      items.sort((p, q) => p.d - q.d);
      const drawItem = (it: (typeof items)[number]) => {
        const back = Math.max(0, -it.d / it.o.a);
        g.save();
        g.translate(it.x, it.y);
        g.rotate(it.th * it.o.spin);
        g.beginPath();
        shapePath(g, it.o.kind, it.o.r * it.s);
        g.fillStyle = mix(it.o.col, ctx.s.background, back * 0.45);
        g.fill();
        g.restore();
      };
      if (lines) {
        g.lineWidth = lw;
        g.strokeStyle = rgba(ctx.s.accent, 0.22);
        for (const o of orbits) drawOrbitHalf(g, o, false);
      }
      for (const it of items) if (it.d < 0) drawItem(it);
      // core sphere at depth 0
      g.beginPath();
      g.arc(cx, cy, coreR, 0, TAU);
      g.fillStyle = ctx.s.secondary;
      g.fill();
      g.beginPath();
      g.arc(cx - coreR * 0.32, cy - coreR * 0.32, coreR * 0.28, 0, TAU);
      g.fillStyle = rgba(ctx.s.primary, 0.22);
      g.fill();
      if (lines) {
        g.lineWidth = lw;
        g.strokeStyle = rgba(ctx.s.accent, 0.5);
        for (const o of orbits) drawOrbitHalf(g, o, true);
      }
      for (const it of items) if (it.d >= 0) drawItem(it);
    });
  },
});
