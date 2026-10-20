import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeOut3, minSide, num, rgba, str } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fitGrid } from './_util';

export default defineEffect({
  id: 'grid-fill',
  code: 'G03',
  nameZh: '網格填滿',
  nameEn: 'Grid Fill',
  category: 'grid',
  sourceType: 'reference',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '色塊依掃描、對角或波浪順序一格一格填滿網格，填滿後換下一種顏色再覆蓋一次。',
  tags: ['網格', '填色', '掃描', '對角', 'fill'],
  suitable: ['載入／進度畫面', '轉場底圖', '社群動態背景'],
  principle:
    'Canvas 2D：每格依填入順序算出整數名次 rank（掃描 = 蛇行列序；對角 = i + j；波浪 = 沿方向的位置 + 正弦偏移後分層），第 rank 格在 t = rank × 間隔 開始，以 ease-out 從所選邊緣長成完整方塊。三種顏色層（主色 → 次色 → 背景）依同一順序輪流覆蓋，seed 決定約 15% 格子使用強調色。',
  defaultText: '',
  palette: 'POP',
  controls: ['scale', 'direction', 'secondary', 'accent', 'seed'],
  directions: ['right', 'left', 'down', 'up'],
  params: [
    {
      key: 'order',
      label: '填入順序',
      type: 'select',
      default: 'diagonal',
      options: [
        { value: 'scan', label: '掃描（蛇行）' },
        { value: 'diagonal', label: '對角' },
        { value: 'wave', label: '波浪' },
      ],
    },
    { key: 'interval', label: '填入間隔', type: 'range', min: 0.01, max: 0.2, step: 0.005, default: 0.06, unit: 's' },
    { key: 'cell', label: '格子大小', type: 'range', min: 0.05, max: 0.2, step: 0.005, default: 0.1, hint: '相對舞台短邊' },
    { key: 'gap', label: '格距', type: 'range', min: 0, max: 0.3, step: 0.02, default: 0.1 },
  ],
  recipe: {
    enter: '空白格線，第一個色塊從起點長出。',
    motion: '色塊依名次逐格 / 逐層出現，每格 0.35 s ease-out 從前進方向的邊緣長成方塊，形成可辨認的掃描、對角或波浪前緣。',
    hold: '整面填滿後停留 0.8 s。',
    exit: '下一種顏色以同順序覆蓋；第三層回到背景色，等於清空。',
    loop: '主色 → 次色 → 清空 三層一循環。',
  },
  accept: [
    '「掃描」逐格蛇行、「對角」以斜線前緣推進、「波浪」前緣呈正弦曲線。',
    '改變方向（右 / 左 / 下 / 上）時起點與推進方向跟著改變。',
    '加大間隔時填入明顯變慢，整個循環變長。',
    '填滿時所有格子對齊、沒有殘缺。',
  ],
  transparent: true,
  posterTime: 2.6,
  cycle: 9,
  create(ctx) {
    const order = str(ctx, 'order', 'diagonal');
    const interval = num(ctx, 'interval', 0.06);
    const gapK = num(ctx, 'gap', 0.1);
    const target = num(ctx, 'cell', 0.1) * minSide(ctx) * ctx.s.scale;
    const { cols, rows, cell, ox, oy } = fitGrid(ctx.width, ctx.height, target, 3, 3);
    const dir = ctx.dir;
    const horiz = dir === 'left' || dir === 'right';
    const n = cols * rows;
    const rank = new Float32Array(n);
    // map (i,j) to (a = along direction, b = across) coordinates
    const A = horiz ? cols : rows;
    const Bn = horiz ? rows : cols;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        let a = horiz ? i : j;
        const b = horiz ? j : i;
        if (dir === 'left' || dir === 'up') a = A - 1 - a;
        let r: number;
        if (order === 'scan') r = b * A + (b % 2 ? A - 1 - a : a);
        else if (order === 'diagonal') r = a + b;
        else {
          const ph = hash2(1, 2, ctx.seed) * 6.283;
          r = Math.round(a + 2.2 * Math.sin((b / Math.max(1, Bn - 1)) * Math.PI * 2 + ph) + 2.2);
        }
        rank[j * cols + i] = r;
      }
    let maxRank = 0;
    for (let k = 0; k < n; k++) maxRank = Math.max(maxRank, rank[k]);
    const grow = 0.35;
    const hold = 0.8;
    const layerT = maxRank * interval + grow + hold;
    const accentPick = new Uint8Array(n * 3);
    for (let k = 0; k < n * 3; k++) accentPick[k] = hash2(k, 7, ctx.seed) < 0.15 ? 1 : 0;
    const gap = cell * gapK;
    const lineCol = rgba(ctx.s.primary, 0.22);

    const layerColor = (L: number, k: number) => {
      const l = ((L % 3) + 3) % 3;
      if (l === 2) return null; // background → clears
      if (accentPick[(l * n + k) % (n * 3)]) return ctx.s.accent;
      return l === 0 ? ctx.s.primary : ctx.s.secondary;
    };

    return canvasRuntime(ctx, (g, t) => {
      // grid lines
      g.strokeStyle = lineCol;
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i <= cols; i++) {
        g.moveTo(ox + i * cell, oy);
        g.lineTo(ox + i * cell, oy + rows * cell);
      }
      for (let j = 0; j <= rows; j++) {
        g.moveTo(ox, oy + j * cell);
        g.lineTo(ox + cols * cell, oy + j * cell);
      }
      g.stroke();
      const L = Math.floor(t / layerT);
      const lt = t - L * layerT;
      const size = cell - gap;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          const p = easeOut3(clamp((lt - rank[k] * interval) / grow, 0, 1));
          const x = ox + i * cell + gap / 2;
          const y = oy + j * cell + gap / 2;
          const under = L > 0 ? layerColor(L - 1, k) : null;
          const top = layerColor(L, k);
          if (under && p < 1 && (top || p <= 0)) {
            g.fillStyle = under;
            g.fillRect(x, y, size, size);
          }
          if (p <= 0) continue;
          // new layer grows from the trailing edge in the fill direction
          const sz = size * p;
          let rx = x;
          let ry = y;
          let rw = size;
          let rh = size;
          if (dir === 'right') rw = sz;
          else if (dir === 'left') {
            rx = x + size - sz;
            rw = sz;
          } else if (dir === 'down') rh = sz;
          else {
            ry = y + size - sz;
            rh = sz;
          }
          if (top) {
            g.fillStyle = top;
            g.fillRect(rx, ry, rw, rh);
          } else if (under && p < 1) {
            // clearing layer: the background "eats" the previous colour
            g.fillStyle = under;
            if (dir === 'right') g.fillRect(x + sz, y, size - sz, size);
            else if (dir === 'left') g.fillRect(x, y, size - sz, size);
            else if (dir === 'down') g.fillRect(x, y + sz, size, size - sz);
            else g.fillRect(x, y, size, size - sz);
          }
        }
    });
  },
});
