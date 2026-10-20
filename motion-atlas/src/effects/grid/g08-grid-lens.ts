import { defineEffect } from '../../engine/define';
import { autoPath, canvasRuntime, minSide, num, pointerOrAuto, rgba, str, TAU } from '../../engine/helpers';
import { fitGrid } from './_util';

export default defineEffect({
  id: 'grid-lens',
  code: 'G08',
  nameZh: '網格透鏡',
  nameEn: 'Grid Lens',
  category: 'grid',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '圓形透鏡滑過規則網格，鏡內格線被放大彎曲（或向內收縮），鏡外格線保持筆直。',
  tags: ['透鏡', '放大鏡', 'fisheye', '網格', '扭曲'],
  suitable: ['互動背景', '數據檢視意象', '游標特效'],
  principle:
    'Canvas 2D：格線以折線取樣；對鏡內每個取樣點，距離 r = |p − c|、x = r / R，新距離 r′ = r · (1 + m · (1 − x²)²)。x = 1 時位移為 0 且斜率連續，所以透鏡邊緣沒有折角；m < 1.25（放大）或 m > −1（收縮）時映射單調，格線不會交叉。r ≥ R 的點完全不動。同一條 Path2D 先以主色畫一次，再 clip 到鏡面以次色加粗重畫。',
  defaultText: '',
  palette: 'POP',
  controls: ['intensity', 'scale', 'secondary', 'seed'],
  interactive: true,
  params: [
    { key: 'radius', label: '透鏡半徑', type: 'range', min: 0.12, max: 0.45, step: 0.01, default: 0.26, hint: '相對舞台短邊' },
    { key: 'mode', label: '透鏡類型', type: 'select', default: 'magnify', options: [{ value: 'magnify', label: '放大（凸透鏡）' }, { value: 'pinch', label: '收縮（凹透鏡）' }] },
    { key: 'cell', label: '格距', type: 'range', min: 0.03, max: 0.12, step: 0.005, default: 0.06, hint: '相對舞台短邊' },
    { key: 'lenses', label: '透鏡數量', type: 'range', min: 1, max: 3, step: 1, default: 1 },
  ],
  recipe: {
    enter: '規則網格，透鏡已在畫面內。',
    motion: '透鏡沿平滑的 Lissajous 軌跡移動（詳情頁跟隨滑鼠），經過處格線即時向外鼓起或向內收縮，離開後立即恢復筆直。',
    hold: '透鏡持續移動，無停頓。',
    exit: '無離場。',
    loop: '自動軌跡為週期函數。',
  },
  accept: [
    '透鏡圓外的格線完全筆直、位置不變。',
    '放大模式中心格子變大、靠邊緣被壓縮；收縮模式相反。',
    '透鏡邊緣格線連續無折角。',
    '詳情頁移動滑鼠時透鏡跟隨指標。',
  ],
  transparent: true,
  posterTime: 1.3,
  cycle: 14,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const ms = minSide(ctx);
    const R = num(ctx, 'radius', 0.26) * ms * ctx.s.scale;
    const pinch = str(ctx, 'mode', 'magnify') === 'pinch';
    const m = pinch ? -0.75 * Math.min(1.2, ctx.s.intensity) : 1.15 * Math.min(1, ctx.s.intensity);
    const nL = Math.round(num(ctx, 'lenses', 1));
    const target = num(ctx, 'cell', 0.06) * ms * (ctx.mode === 'card' ? 1.25 : 1);
    const { cols, rows, cell } = fitGrid(w, h, target, 4, 4);
    // let the grid run to the edges: offsets so lines are centred
    const ox = (w - cols * cell) / 2;
    const oy = (h - rows * cell) / 2;
    const phases = Array.from({ length: 3 }, () => ctx.rand() * 20);
    const step = Math.max(2.5, R / 40);
    const R2 = R * R;

    const lensesAt = (t: number) => {
      const out: { x: number; y: number }[] = [];
      out.push(pointerOrAuto(ctx, t, (tt) => autoPath(ctx, tt + phases[0], 0.3, 0.26, 0.09, 0.14)));
      if (nL > 1) out.push(autoPath(ctx, t + phases[1], 0.34, 0.3, 0.07, 0.11));
      if (nL > 2) out.push(autoPath(ctx, t + phases[2], 0.28, 0.2, 0.12, 0.08));
      return out;
    };
    const warp = (lens: { x: number; y: number }[], x: number, y: number): [number, number] => {
      for (const c of lens) {
        const dx = x - c.x;
        const dy = y - c.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R2) continue;
        const u = 1 - d2 / R2;
        const k = 1 + m * u * u;
        x = c.x + dx * k;
        y = c.y + dy * k;
      }
      return [x, y];
    };

    return canvasRuntime(ctx, (g, t) => {
      const lens = lensesAt(t);
      const path = new Path2D();
      const line = (horizontal: boolean, v: number) => {
        const hit = lens.some((c) => Math.abs((horizontal ? c.y : c.x) - v) < R);
        const len = horizontal ? w : h;
        if (!hit) {
          if (horizontal) {
            path.moveTo(0, v);
            path.lineTo(w, v);
          } else {
            path.moveTo(v, 0);
            path.lineTo(v, h);
          }
          return;
        }
        const n = Math.ceil(len / step);
        for (let k = 0; k <= n; k++) {
          const s = (k / n) * len;
          const [x, y] = horizontal ? warp(lens, s, v) : warp(lens, v, s);
          if (k === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        }
      };
      for (let j = 0; j <= rows; j++) line(true, oy + j * cell);
      for (let i = 0; i <= cols; i++) line(false, ox + i * cell);
      g.lineJoin = 'round';
      g.strokeStyle = ctx.s.primary;
      g.lineWidth = 1.25;
      g.stroke(path);
      // inside the lens: same geometry, highlighted
      g.save();
      g.beginPath();
      for (const c of lens) {
        g.moveTo(c.x + R, c.y);
        g.arc(c.x, c.y, R, 0, TAU);
      }
      g.clip();
      g.fillStyle = rgba(ctx.s.secondary, 0.1);
      g.fillRect(0, 0, w, h);
      g.strokeStyle = ctx.s.secondary;
      g.lineWidth = 2;
      g.stroke(path);
      g.restore();
      g.strokeStyle = rgba(ctx.s.secondary, 0.9);
      g.lineWidth = 1.5;
      for (const c of lens) {
        g.beginPath();
        g.arc(c.x, c.y, R, 0, TAU);
        g.stroke();
      }
    });
  },
});
