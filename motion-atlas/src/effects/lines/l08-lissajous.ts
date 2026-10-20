import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, minSide, num, rgba, TAU } from '../../engine/helpers';
import { C } from '../../engine/palette';

export default defineEffect({
  id: 'lissajous',
  code: 'L08',
  nameZh: '李沙育曲線',
  nameEn: 'Lissajous',
  category: 'lines',
  sourceType: 'reference',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '光點依 X／Y 兩個正弦頻率描出李沙育軌跡，相位持續推移讓圖形像在空間中翻轉，後方留下漸隱殘影。',
  tags: ['李沙育', 'lissajous', '示波器', '正弦', '殘影'],
  suitable: ['音樂／科技視覺', '載入動畫', '數學教育'],
  principle:
    'Canvas 2D：x = A·sin(a·u + δ)，y = B·sin(b·u)，u = 2π·f·t 為光點參數，δ = δ₀ + ω·t 持續變化。殘影 = 光點過去 T 秒的真實軌跡（每點用各自時刻的 δ），依年齡分段降低透明度與線寬；背景另以目前 δ 畫出完整閉合曲線作為淡色參考。',
  defaultText: '',
  palette: 'POP',
  colors: { background: C.black, primary: C.yellow, secondary: C.pink, accent: C.white },
  controls: ['scale', 'secondary', 'accent', 'direction'],
  directions: ['cw', 'ccw'],
  params: [
    { key: 'fx', label: 'X 頻率 a', type: 'range', min: 1, max: 9, step: 1, default: 3 },
    { key: 'fy', label: 'Y 頻率 b', type: 'range', min: 1, max: 9, step: 1, default: 2 },
    { key: 'phase', label: '相位變化速度', type: 'range', min: 0, max: 1, step: 0.02, default: 0.18, unit: 'rad/s' },
    { key: 'pen', label: '光點速度', type: 'range', min: 0.05, max: 0.6, step: 0.01, default: 0.22, unit: '圈/s' },
    { key: 'trail', label: '殘影長度', type: 'range', min: 0.2, max: 6, step: 0.1, default: 2.6, unit: 's' },
    { key: 'ghost', label: '顯示完整曲線', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '光點出現並開始拉出殘影。',
    motion: '光點沿正弦軌跡等參數速度移動（在曲線端點自然減速）；相位 δ 線性推移，整個圖形看起來像緩慢翻轉的 3D 線圈。',
    hold: '連續運動，無停頓。',
    exit: '殘影尾端持續淡出。',
    loop: '相位與光點皆為週期運動，長時間播放保持流暢。',
  },
  accept: [
    'a:b = 3:2 時可數出 3 個左右波峰、2 個上下波峰。',
    '完整曲線形狀隨相位持續改變。',
    '殘影從光點往後逐漸變細變淡，不會遮住整個圖形。',
    '方向切換後相位推移方向相反。',
  ],
  transparent: true,
  cycle: 12,
  posterTime: 3,
  create(ctx) {
    const a = Math.round(num(ctx, 'fx', 3));
    const b = Math.round(num(ctx, 'fy', 2));
    const w = num(ctx, 'phase', 0.18) * ctx.dirSign;
    const pen = num(ctx, 'pen', 0.22);
    const trail = num(ctx, 'trail', 2.6);
    const ghost = bool(ctx, 'ghost', true);
    const m = minSide(ctx);
    const A = Math.min(ctx.width * 0.44, m * 0.42 * ctx.s.scale);
    const B = Math.min(ctx.height * 0.44, m * 0.42 * ctx.s.scale);
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;
    const d0 = Math.PI / 2;
    const at = (tt: number, delta: number): [number, number] => {
      const u = TAU * pen * tt;
      return [cx + A * Math.sin(a * u + delta), cy + B * Math.sin(b * u)];
    };
    const ghostN = Math.round(clamp(160 * Math.max(a, b), 300, 1400));
    const trailN = Math.round(clamp(trail * 120 * ctx.q, 60, 700));
    const BUCKETS = 10;
    return canvasRuntime(ctx, (g, t) => {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const delta = d0 + w * t;
      if (ghost) {
        g.strokeStyle = rgba(ctx.s.accent, 0.14);
        g.lineWidth = 1;
        g.beginPath();
        for (let i = 0; i <= ghostN; i++) {
          const u = (i / ghostN) * TAU;
          const x = cx + A * Math.sin(a * u + delta);
          const y = cy + B * Math.sin(b * u);
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
      }
      // trail: real past trajectory, oldest bucket first
      const t0 = t - trail;
      const span = t - t0;
      if (span > 0) {
        const n = Math.max(2, Math.round((trailN * span) / trail));
        const pts: [number, number][] = [];
        for (let i = 0; i <= n; i++) {
          const tt = t0 + (span * i) / n;
          pts.push(at(tt, d0 + w * tt));
        }
        for (let k = 0; k < BUCKETS; k++) {
          const i0 = Math.floor((k / BUCKETS) * n);
          const i1 = Math.min(n, Math.floor(((k + 1) / BUCKETS) * n) + 1);
          if (i1 - i0 < 2) continue;
          const f = (k + 1) / BUCKETS;
          g.strokeStyle = rgba(ctx.s.primary, f * f);
          g.lineWidth = 0.8 + f * f * clamp(m * 0.008, 2, 5);
          g.beginPath();
          g.moveTo(pts[i0][0], pts[i0][1]);
          for (let i = i0 + 1; i < i1; i++) g.lineTo(pts[i][0], pts[i][1]);
          g.stroke();
        }
      }
      const [hx, hy] = at(t, delta);
      const r = clamp(m * 0.014, 4, 10);
      g.fillStyle = rgba(ctx.s.secondary, 0.25);
      g.beginPath();
      g.arc(hx, hy, r * 2.2, 0, TAU);
      g.fill();
      g.fillStyle = ctx.s.secondary;
      g.beginPath();
      g.arc(hx, hy, r, 0, TAU);
      g.fill();
    });
  },
});
