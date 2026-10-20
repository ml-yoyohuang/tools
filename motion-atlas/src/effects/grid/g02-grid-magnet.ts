import { defineEffect } from '../../engine/define';
import { autoPath, canvasRuntime, minSide, num, pointerOrAuto, str } from '../../engine/helpers';

export default defineEffect({
  id: 'grid-magnet',
  code: 'G02',
  nameZh: '磁力網格',
  nameEn: 'Grid Magnet',
  category: 'grid',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '網格節點被磁力點吸引或推開，相連的格線跟著彎曲，磁力離開後以彈簧回復。',
  tags: ['網格', '互動', '彈簧', '磁力', 'magnet'],
  suitable: ['互動背景', '科技感版面', '游標特效'],
  principle:
    'Canvas 2D + 固定步長模擬：每個節點受 exp(-(d/半徑)²) 的吸力（或斥力）與回到原位的彈簧力，帶阻尼積分；格線以節點連成折線繪製，因此鄰近線段一起變形。滑鼠在舞台上時磁力點跟隨指標，閒置時沿自動軌跡移動。',
  defaultText: '',
  palette: 'MONO',
  colors: { background: '#F2E8D5', primary: '#141414', secondary: '#3450FF' },
  controls: ['intensity', 'secondary', 'seed'],
  interactive: true,
  params: [
    { key: 'cells', label: '網格尺寸（列數）', type: 'range', min: 8, max: 40, step: 1, default: 20 },
    { key: 'radius', label: '影響半徑', type: 'range', min: 0.08, max: 0.6, step: 0.01, default: 0.24 },
    { key: 'lineWidth', label: '線寬', type: 'range', min: 0.5, max: 4, step: 0.25, default: 1.25, unit: 'px' },
    { key: 'mode', label: '磁力模式', type: 'select', default: 'attract', options: [{ value: 'attract', label: '吸引' }, { value: 'repel', label: '推開' }] },
  ],
  recipe: {
    enter: '靜止的規則網格。',
    motion: '磁力點移動時，周圍節點被吸近（或推開），格線呈放射狀彎曲；節點以彈簧與阻尼追隨，有輕微過衝。',
    hold: '磁力點停住時，節點在新平衡位置停住。',
    exit: '磁力離開後節點回到原位。',
    loop: '自動軌跡為週期路徑；使用者移動滑鼠時改為跟隨指標。',
  },
  accept: [
    '磁力點附近的節點明顯位移，遠處格線保持筆直。',
    '切換為「推開」後，節點方向相反。',
    '磁力離開後格線在約 1 秒內回復筆直。',
    '在詳情頁移動滑鼠，變形中心跟著指標。',
  ],
  transparent: true,
  cycle: 12,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const cols = Math.max(4, Math.round(num(ctx, 'cells', 20) * (ctx.mode === 'card' ? 0.7 : 1)));
    const cell = w / cols;
    const rows = Math.max(3, Math.round(h / cell));
    const cellY = h / rows;
    const radius = num(ctx, 'radius', 0.24) * minSide(ctx);
    const lw = num(ctx, 'lineWidth', 1.25);
    const sign = str(ctx, 'mode', 'attract') === 'repel' ? -1 : 1;
    const strength = 0.55 * ctx.s.intensity;
    const n = (cols + 1) * (rows + 1);
    const bx = new Float32Array(n);
    const by = new Float32Array(n);
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const vx = new Float32Array(n);
    const vy = new Float32Array(n);
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        const k = j * (cols + 1) + i;
        bx[k] = i * cell;
        by[k] = j * cellY;
      }
    const phase = ctx.rand() * 10;
    let mag = { x: w / 2, y: h / 2 };
    const reset = () => {
      x.set(bx);
      y.set(by);
      vx.fill(0);
      vy.fill(0);
    };
    reset();
    const rt = canvasRuntime(ctx, (g) => {
      g.lineWidth = lw;
      g.strokeStyle = ctx.s.primary;
      g.beginPath();
      for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
          const k = j * (cols + 1) + i;
          if (i === 0) g.moveTo(x[k], y[k]);
          else g.lineTo(x[k], y[k]);
        }
      }
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const k = j * (cols + 1) + i;
          if (j === 0) g.moveTo(x[k], y[k]);
          else g.lineTo(x[k], y[k]);
        }
      }
      g.stroke();
      // magnet marker
      g.fillStyle = ctx.s.secondary;
      g.beginPath();
      g.arc(mag.x, mag.y, Math.max(3, lw * 3), 0, Math.PI * 2);
      g.fill();
    });
    return {
      ...rt,
      reset,
      step(t, dt) {
        mag = pointerOrAuto(ctx, t, (tt) => autoPath(ctx, tt + phase, 0.36, 0.3, 0.11, 0.17));
        const r2 = radius * radius;
        for (let k = 0; k < n; k++) {
          const dx = mag.x - bx[k];
          const dy = mag.y - by[k];
          const f = Math.exp(-(dx * dx + dy * dy) / r2) * strength * sign;
          // target = base pulled toward magnet by f
          const tx = bx[k] + dx * f;
          const ty = by[k] + dy * f;
          vx[k] += ((tx - x[k]) * 90 - vx[k] * 12) * dt;
          vy[k] += ((ty - y[k]) * 90 - vy[k] * 12) * dt;
          x[k] += vx[k] * dt;
          y[k] += vy[k] * dt;
        }
      },
    };
  },
});
