import { defineEffect } from '../../engine/define';
import { C } from '../../engine/palette';
import { bool, canvasRuntime, clamp, damp, easeOut3, minSide, mod, num, rgba, str, TAU } from '../../engine/helpers';
import { angDiff, shapePath, type Kind } from './_util';

const KINDS: Kind[] = ['circle', 'square', 'triangle'];
const LEAD = 0.8;
const TRAVEL = 0.95;
const HOLD = 1.7;
const RELEASE = 1.0;
const TAIL = 0.9;

export default defineEffect({
  id: 'shape-magnet',
  code: 'S11',
  nameZh: '圖形磁吸',
  nameEn: 'Shape Magnet',
  category: 'shapes',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '散落漂浮的圖形依距離一波波被吸向指定插槽，越近越快、吸附瞬間輕震後轉正停住，排成整齊陣列，再被彈開回到原位。',
  tags: ['磁吸', 'snap', '對齊', '排列', 'magnet'],
  suitable: ['資料整理／分類說明', '功能列表進場', '品牌元素收束'],
  principle:
    'Canvas 2D 純時間函數（與 Grid Magnet 的節點變形不同：這裡是整個圖形被移動到插槽）：每個圖形有 seed 散落位置與週期漂移，目標插槽依圖形種類排序。吸附依距離排序錯開開始時間，行進使用 u^2.6 的加速曲線（模擬距離越近吸力越大），路徑帶側向弧度，角度同時對齊到 0；抵達後沿行進方向套用衰減震盪 e^(−9t)·cos 做吸附輕震，並在插槽放出擴散環。釋放時以 ease-out 推回散落位置。',
  defaultText: '',
  palette: 'MONO',
  colors: { background: C.cream, primary: C.black, secondary: C.red, accent: C.blue },
  controls: ['scale', 'secondary', 'seed'],
  params: [
    { key: 'count', label: '圖形數量', type: 'range', min: 6, max: 30, step: 1, default: 18 },
    {
      key: 'formation',
      label: '吸附陣列',
      type: 'select',
      default: 'grid',
      options: [
        { value: 'grid', label: '分類網格' },
        { value: 'line', label: '單列' },
        { value: 'ring', label: '圓環' },
      ],
    },
    { key: 'snap', label: '吸附輕震', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'lines', label: '顯示吸力線', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '圖形散落在舞台各處緩慢漂浮，插槽以小十字標示。',
    motion: '離插槽近的圖形先被吸走，由慢而快加速飛入並轉正；吸附瞬間輕震、插槽放出擴散環。',
    hold: '全部對齊後完全靜止約 1.7 秒。',
    exit: '圖形同時被彈開，以 ease-out 回到散落位置繼續漂浮。',
    loop: '漂移為週期函數，循環無縫。',
  },
  accept: [
    '圖形依序（不是同時）被吸入，越接近插槽速度越快。',
    '對齊後所有圖形角度一致並完全停住。',
    '同種類的圖形排在同一列（分類網格）。',
    '吸附輕震為 0 時抵達即停，沒有回彈。',
  ],
  transparent: true,
  loopable: true,
  cycle: 6.4,
  posterTime: 4.2,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const n = Math.max(6, Math.round(num(ctx, 'count', 18) * (ctx.q < 0.6 ? 0.7 : 1)));
    const formation = str(ctx, 'formation', 'grid');
    const snap = num(ctx, 'snap', 0.6);
    const lines = bool(ctx, 'lines', true);
    const cx = w / 2;
    const cy = h / 2;
    // group indices by kind so targets come out sorted
    const groups: number[][] = [[], [], []];
    for (let i = 0; i < n; i++) groups[i % 3].push(i);
    const targets: [number, number][] = new Array(n);
    let r: number;
    if (formation === 'line') {
      const sp = (w * 0.86) / n;
      r = Math.min(sp * 0.36, m * 0.06);
      const ordered = groups.flat();
      ordered.forEach((idx, k) => (targets[idx] = [cx + (k - (n - 1) / 2) * sp, cy]));
    } else if (formation === 'ring') {
      const R = m * 0.33;
      r = Math.min(((TAU * R) / n) * 0.34, m * 0.06);
      const ordered = groups.flat();
      ordered.forEach((idx, k) => {
        const a = -Math.PI / 2 + (k / n) * TAU;
        targets[idx] = [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
      });
    } else {
      const colsN = Math.ceil(n / 3);
      const sp = Math.min((w * 0.8) / colsN, (h * 0.56) / 3);
      r = Math.min(sp * 0.34, m * 0.07);
      groups.forEach((gr, row) =>
        gr.forEach((idx, col) => (targets[idx] = [cx + (col - (colsN - 1) / 2) * sp, cy + (row - 1) * sp])),
      );
    }
    r *= ctx.s.scale;
    const pad = r * 1.8;
    const items = Array.from({ length: n }, (_, i) => ({
      kind: KINDS[i % 3],
      sx: pad + ctx.rand() * Math.max(1, w - 2 * pad),
      sy: pad + ctx.rand() * Math.max(1, h - 2 * pad),
      rot: (ctx.rand() - 0.5) * TAU,
      dph: ctx.rand() * TAU,
      amp: m * (0.015 + ctx.rand() * 0.02),
      curve: (ctx.rand() - 0.5) * 0.6,
      start: 0,
    }));
    // pull order: nearest to its slot first
    const order = items
      .map((it, i) => ({ i, d: Math.hypot(it.sx - targets[i][0], it.sy - targets[i][1]) }))
      .sort((a, b) => a.d - b.d);
    const stagger = Math.min(0.09, 1.5 / n);
    order.forEach((o, k) => (items[o.i].start = LEAD + k * stagger));
    const allIn = LEAD + (n - 1) * stagger + TRAVEL;
    const releaseAt = allIn + HOLD;
    const total = releaseAt + RELEASE + TAIL;
    const drift = (it: (typeof items)[number], t: number): [number, number, number] => {
      const u = (TAU * t) / total;
      return [it.sx + Math.sin(u + it.dph) * it.amp, it.sy + Math.cos(u * 2 + it.dph) * it.amp * 0.7, it.rot + Math.sin(u + it.dph) * 0.35];
    };
    return canvasRuntime(ctx, (g, t) => {
      const lt = mod(t, total);
      const lw = Math.max(1, m * 0.003);
      // slots
      const cross = r * 0.35;
      g.lineWidth = lw;
      for (let i = 0; i < n; i++) {
        const [tx, ty] = targets[i];
        const filled = lt >= items[i].start + TRAVEL && lt < releaseAt;
        g.strokeStyle = rgba(ctx.s.secondary, filled ? 0 : 0.7);
        g.beginPath();
        g.moveTo(tx - cross, ty);
        g.lineTo(tx + cross, ty);
        g.moveTo(tx, ty - cross);
        g.lineTo(tx, ty + cross);
        g.stroke();
      }
      items.forEach((it, i) => {
        const [tx, ty] = targets[i];
        let x: number;
        let y: number;
        let a: number;
        const tArr = it.start + TRAVEL;
        if (lt < it.start) {
          [x, y, a] = drift(it, lt);
        } else if (lt < tArr) {
          const [x0, y0, a0] = drift(it, it.start);
          const u = (lt - it.start) / TRAVEL;
          const q = u ** 2.6;
          const dx = tx - x0;
          const dy = ty - y0;
          const bend = Math.sin(Math.PI * q) * it.curve;
          x = x0 + dx * q - dy * bend;
          y = y0 + dy * q + dx * bend;
          a = a0 + angDiff(a0, 0) * q;
          if (lines) {
            g.strokeStyle = rgba(ctx.s.secondary, 0.25 + 0.5 * q);
            g.lineWidth = lw;
            g.setLineDash([lw * 3, lw * 3]);
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(tx, ty);
            g.stroke();
            g.setLineDash([]);
          }
        } else if (lt < releaseAt) {
          // snap: damped shake along the arrival direction, then perfectly still
          const [x0, y0] = drift(it, it.start);
          const dl = Math.hypot(tx - x0, ty - y0) || 1;
          const s = lt - tArr;
          const k = s < 0.8 ? damp(s, 3.2, 9) * snap : 0;
          const amp = r * 0.35 * k;
          x = tx + ((tx - x0) / dl) * amp;
          y = ty + ((ty - y0) / dl) * amp;
          a = k * 0.25;
          if (s < 0.45) {
            const p = s / 0.45;
            g.strokeStyle = rgba(ctx.s.secondary, 1 - p);
            g.lineWidth = lw * 1.5;
            g.beginPath();
            g.arc(tx, ty, r * (1.05 + easeOut3(p) * 0.5), 0, TAU);
            g.stroke();
          }
        } else {
          const u = easeOut3(clamp((lt - releaseAt) / RELEASE, 0, 1));
          const [x1, y1, a1] = drift(it, lt);
          x = tx + (x1 - tx) * u;
          y = ty + (y1 - ty) * u;
          a = a1 * u;
        }
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.beginPath();
        shapePath(g, it.kind, r);
        g.fillStyle = ctx.s.primary;
        g.fill();
        g.restore();
      });
    }, { settle: allIn + 0.9 });
  },
});
