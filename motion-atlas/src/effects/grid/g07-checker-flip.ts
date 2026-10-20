import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeInOut, minSide, mix, num, str } from '../../engine/helpers';
import { fitGrid, poly } from './_util';

export default defineEffect({
  id: 'checker-flip',
  code: 'G07',
  nameZh: '棋盤翻轉',
  nameEn: 'Checker Flip',
  category: 'grid',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '棋盤格像一張張卡片沿行或列依序翻面，奇數格與偶數格錯開相位，翻完整面顏色互換。',
  tags: ['棋盤', '翻轉', 'flip', '卡片', '序列'],
  suitable: ['轉場', '品牌色塊背景', '遊戲／活動頁'],
  principle:
    'Canvas 2D：每格是一張雙面卡，第 k 次翻轉的開始時間 = k × 週期 + 沿掃描方向的索引 × 錯開 + 奇偶 × 相位差；角度 θ = π · easeInOut(進度)，可見寬度 = |cos θ|，θ 過 90° 後換成背面顏色。近側邊略放大、遠側邊縮小形成簡易透視，並依 sin θ 加深顏色。每完成一次翻轉，整面棋盤顏色互換；掃描方向在列 / 行之間交替（或固定）。',
  defaultText: '',
  palette: 'MONO',
  colors: { background: '#F2E8D5', primary: '#141414', secondary: '#E63A2E' },
  controls: ['scale', 'intensity', 'secondary'],
  params: [
    {
      key: 'sweep',
      label: '翻轉順序',
      type: 'select',
      default: 'alternate',
      options: [
        { value: 'alternate', label: '列／行交替' },
        { value: 'cols', label: '逐行（左→右）' },
        { value: 'rows', label: '逐列（上→下）' },
      ],
    },
    { key: 'parity', label: '奇偶相位差', type: 'range', min: 0, max: 1.5, step: 0.05, default: 0.5, hint: '以單格翻轉時間為單位' },
    { key: 'flip', label: '單格翻轉時間', type: 'range', min: 0.25, max: 1.2, step: 0.05, default: 0.55, unit: 's' },
    { key: 'stagger', label: '行列間隔', type: 'range', min: 0.02, max: 0.25, step: 0.01, default: 0.08, unit: 's' },
    { key: 'cell', label: '格子大小', type: 'range', min: 0.08, max: 0.25, step: 0.01, default: 0.14, hint: '相對舞台短邊' },
  ],
  recipe: {
    enter: '完整的雙色棋盤。',
    motion: '翻轉波沿行（或列）推進，每格以 ease-in-out 翻面；偶數格先翻、奇數格晚半拍，形成兩段式波前。',
    hold: '整面翻完後停 0.7 秒，棋盤顏色已互換。',
    exit: '下一次翻轉換軸向（交替模式）。',
    loop: '翻兩次回到原始棋盤，無縫循環。',
  },
  accept: [
    '翻轉以行或列為單位依序前進，不是同時翻。',
    '同一行內奇偶格的翻轉明顯有時間差；相位差設 0 時同步翻。',
    '翻轉中卡片寬度（或高度）先縮到 0 再展開，並換成另一色。',
    '每次翻完整面棋盤顏色互換。',
  ],
  transparent: true,
  posterTime: 1.3,
  cycle: 8,
  create(ctx) {
    const sweep = str(ctx, 'sweep', 'alternate');
    const parity = num(ctx, 'parity', 0.5);
    const flipT = num(ctx, 'flip', 0.55);
    const stagger = num(ctx, 'stagger', 0.08);
    const target = num(ctx, 'cell', 0.14) * minSide(ctx) * ctx.s.scale;
    const { cols, rows, cell, ox, oy } = fitGrid(ctx.width, ctx.height, target, 3, 3);
    const persp = 0.22 * ctx.s.intensity;
    const gap = Math.max(1, cell * 0.06);
    const pause = 0.7;
    const passT = (Math.max(cols, rows) - 1) * stagger + parity * flipT + flipT + pause;
    const colA = ctx.s.primary;
    const colB = ctx.s.secondary;
    const dark = '#000000';

    const passAxis = (k: number) => (sweep === 'cols' ? 0 : sweep === 'rows' ? 1 : ((k % 2) + 2) % 2);

    return canvasRuntime(ctx, (g, t) => {
      const K = Math.floor(t / passT);
      const lt = t - K * passT;
      const axis = passAxis(K); // 0 = flip around vertical axis, sweep along columns
      const size = cell - gap;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const par = (i + j) % 2;
          const idx = axis === 0 ? i : j;
          const start = idx * stagger + par * parity * flipT;
          const p = easeInOut(clamp((lt - start) / flipT, 0, 1));
          const th = Math.PI * p;
          // colour after K completed passes (each pass swaps)
          const cur = (par + K) % 2 === 0 ? colA : colB;
          const nxt = cur === colA ? colB : colA;
          const front = th < Math.PI / 2;
          const c = Math.cos(th);
          const sn = Math.sin(th);
          const face = front ? cur : nxt;
          const x0 = ox + i * cell + gap / 2;
          const y0 = oy + j * cell + gap / 2;
          const cx = x0 + size / 2;
          const cy = y0 + size / 2;
          const hw = (size / 2) * Math.abs(c);
          if (hw < 0.3) continue;
          // odd cells rotate the opposite way → their near edge is on the other side
          const sgn = (par ? -1 : 1) * (front ? 1 : -1);
          const near = 1 + persp * sn;
          const far = 1 - persp * sn;
          const a = sgn > 0 ? near : far;
          const b = sgn > 0 ? far : near;
          g.fillStyle = sn > 0.01 ? mix(face, dark, 0.32 * sn) : face;
          if (axis === 0) {
            const hh = size / 2;
            poly(g, [cx - hw, cy - hh * a, cx + hw, cy - hh * b, cx + hw, cy + hh * b, cx - hw, cy + hh * a]);
          } else {
            const ww = size / 2;
            poly(g, [cx - ww * a, cy - hw, cx + ww * a, cy - hw, cx + ww * b, cy + hw, cx - ww * b, cy + hw]);
          }
          g.fill();
        }
    });
  },
});
