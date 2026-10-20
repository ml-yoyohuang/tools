import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, easeInOut, minSide, num, rgba, tri } from '../../engine/helpers';

export default defineEffect({
  id: 'grid-breathing',
  code: 'G09',
  nameZh: '網格呼吸',
  nameEn: 'Grid Breathing',
  category: 'grid',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '以中心為錨點，網格的每一道格距依序展開再收回，像一圈圈向外傳的呼吸。',
  tags: ['呼吸', '網格', '節奏', '冥想', 'breathing'],
  suitable: ['冥想／健康 App', '等待畫面', '沉靜背景'],
  principle:
    'Canvas 2D：中心線固定（錨點），第 k 道格距 gap_k(t) = base · (1 + 深度 · b(t − k · 延遲))，b 為 ease-in-out 化的三角波（吸 → 停 → 吐）。第 k 條線的位置 = 中心 ± Σ_{1..k} gap，因此每條線各自移動、外圈比內圈晚一點跟上；不是對整個舞台做 scale。交點圓點大小與該格面積成正比。',
  defaultText: '',
  palette: 'MONO',
  colors: { secondary: '#ED589A' },
  controls: ['scale', 'secondary', 'accent'],
  params: [
    { key: 'spacing', label: '基準格距', type: 'range', min: 0.04, max: 0.16, step: 0.005, default: 0.075, hint: '相對舞台短邊' },
    { key: 'depth', label: '呼吸深度', type: 'range', min: 0.1, max: 0.7, step: 0.05, default: 0.45 },
    { key: 'lag', label: '外圈延遲', type: 'range', min: 0, max: 0.8, step: 0.02, default: 0.32, unit: 's/圈' },
    { key: 'period', label: '呼吸週期', type: 'range', min: 3, max: 12, step: 0.5, default: 6, unit: 's' },
    { key: 'nodes', label: '交點圓點', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '靜止的方格，中心十字以強調色標示。',
    motion: '吸氣時格距由中心向外依序撐開（ease-in-out），吐氣時再依序收回；外圈比內圈晚 0.32 s/圈，畫面上同時看得到「內圈已展開、外圈仍收緊」，形成向外傳遞的波。',
    hold: '吸飽與吐盡時各有短暫停留（三角波經 ease-in-out 後在兩端放慢）。',
    exit: '無離場。',
    loop: '一個呼吸週期為一個循環，無縫重複。',
  },
  accept: [
    '中心十字永遠不動，其餘格線相對中心移動。',
    '外圈格線的運動比內圈晚，可看到向外傳播。',
    '交點圓點在格距展開時變大、收回時變小。',
    '舞台外框與線寬不變（不是整體縮放）。',
  ],
  transparent: true,
  posterTime: 2.6,
  cycle: 6,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const base = Math.max(8, num(ctx, 'spacing', 0.075) * minSide(ctx) * ctx.s.scale * (ctx.mode === 'card' ? 1.3 : 1));
    const depth = num(ctx, 'depth', 0.45);
    const lag = num(ctx, 'lag', 0.32);
    const period = num(ctx, 'period', 6);
    const nodes = bool(ctx, 'nodes', true);
    const cx = w / 2;
    const cy = h / 2;
    const maxK = Math.ceil(Math.max(w, h) / 2 / (base * (1 - depth))) + 2;
    const xs = new Float32Array(maxK + 1);
    const ys = new Float32Array(maxK + 1);
    const gx = new Float32Array(maxK + 1);
    const breath = (t: number) => easeInOut(tri(t / period)) * 2 - 1;

    return canvasRuntime(ctx, (g, t) => {
      // cumulative offsets per ring (line k = centre ± Σ gap)
      let ax = 0;
      let nx = 0;
      for (let k = 1; k <= maxK; k++) {
        const gap = base * (1 + depth * breath(t - k * lag));
        gx[k] = gap;
        ax += gap;
        xs[k] = ax;
        ys[k] = ax;
        if (ax < Math.max(w, h) / 2 + gap) nx = k;
      }
      g.strokeStyle = rgba(ctx.s.primary, 0.7);
      g.lineWidth = 1.25;
      g.beginPath();
      for (let k = 1; k <= nx; k++) {
        for (const sx of [-1, 1]) {
          const x = cx + sx * xs[k];
          g.moveTo(x, 0);
          g.lineTo(x, h);
          const y = cy + sx * ys[k];
          g.moveTo(0, y);
          g.lineTo(w, y);
        }
      }
      g.stroke();
      // anchor cross
      g.strokeStyle = ctx.s.accent;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, 0);
      g.lineTo(cx, h);
      g.moveTo(0, cy);
      g.lineTo(w, cy);
      g.stroke();
      if (nodes) {
        g.fillStyle = ctx.s.secondary;
        for (let i = -nx; i <= nx; i++) {
          const x = cx + Math.sign(i) * xs[Math.abs(i)];
          if (x < -10 || x > w + 10) continue;
          const gi = gx[Math.max(1, Math.abs(i))];
          for (let j = -nx; j <= nx; j++) {
            const y = cy + Math.sign(j) * ys[Math.abs(j)];
            if (y < -10 || y > h + 10) continue;
            const gj = gx[Math.max(1, Math.abs(j))];
            const r = clamp(Math.sqrt(gi * gj) * 0.09, 0.8, base * 0.2);
            g.beginPath();
            g.arc(x, y, r, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    });
  },
});
