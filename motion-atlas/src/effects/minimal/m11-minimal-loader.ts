import { defineEffect } from '../../engine/define';
import { canvasRuntime, lerp, minSide, mod, num, rgba, str, TAU } from '../../engine/helpers';

export default defineEffect({
  id: 'minimal-loader',
  code: 'M11',
  nameZh: '極簡載入',
  nameEn: 'Minimal Loader',
  category: 'minimal',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '三個點（或三條短線）以相位差輪流起伏，透明度只在柔和範圍內變化，不會突兀閃爍。',
  tags: ['極簡', '載入', '三點', '相位差', 'loader'],
  suitable: ['載入指示', '聊天「輸入中」', '按鈕等待狀態'],
  principle:
    'Canvas 2D：每個元素的活動值 v_i = bump(mod(t/P − i·Δ, 1))，bump(x) = sin²(πx/0.62)（x < 0.62，其餘為 0），所以每輪之間有安靜的空檔。波浪：y 位移 = −v·振幅；脈動：半徑 0.6→1；短線：長度 0.45→1。透明度 = 0.45 + 0.55·v，以 sin² 平滑過渡，最低不歸零，避免閃爍。',
  defaultText: '',
  palette: 'PASTEL',
  colors: { background: '#F2E8D5', primary: '#3450FF', secondary: '#9A86DE', accent: '#141414' },
  controls: ['scale', 'intensity'],
  params: [
    {
      key: 'style',
      label: '樣式',
      type: 'select',
      options: [
        { value: 'wave', label: '波浪點' },
        { value: 'pulse', label: '脈動點' },
        { value: 'bars', label: '三條短線' },
      ],
      default: 'wave',
    },
    { key: 'period', label: '週期', type: 'range', min: 0.6, max: 3, step: 0.1, default: 1.4, unit: 's' },
    { key: 'offset', label: '相位差', type: 'range', min: 0.06, max: 0.33, step: 0.01, default: 0.15 },
  ],
  recipe: {
    enter: '三個元素靜止排成一列。',
    motion: '由左到右依相位差輪流起伏（sin² 包絡），強度控制起伏幅度。',
    hold: '每輪之後約 0.4 個週期全部靜止。',
    exit: '無離場。',
    loop: '週期函數，無縫循環。',
  },
  accept: [
    '三個元素依序起伏，不是同時。',
    '每輪之間有短暫的整體靜止。',
    '透明度變化柔和，元素從不完全消失。',
    '切換樣式可看到點波浪、點脈動或短線伸縮。',
  ],
  transparent: true,
  cycle: 1.4,
  posterTime: 0.35,
  create(ctx) {
    const m = minSide(ctx);
    const style = str(ctx, 'style', 'wave');
    const P = num(ctx, 'period', 1.4);
    const off = num(ctx, 'offset', 0.15);
    const amp = Math.min(2, ctx.s.intensity);
    const r = Math.max(3, m * 0.024 * ctx.s.scale);
    const gap = style === 'bars' ? r * 2.6 : r * 3.4;
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;
    const bump = (x: number) => (x < 0.62 ? Math.sin((Math.PI * x) / 0.62) ** 2 : 0);
    return canvasRuntime(ctx, (g, t) => {
      for (let i = 0; i < 3; i++) {
        const v = bump(mod(t / P - i * off, 1));
        const x = cx + (i - 1) * gap;
        const alpha = 0.45 + 0.55 * v;
        if (style === 'bars') {
          const full = r * 4.2;
          const len = full * lerp(1, lerp(0.45, 1, v), Math.min(1, amp));
          g.strokeStyle = rgba(ctx.s.primary, alpha);
          g.lineWidth = r * 0.7;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(x, cy - len / 2);
          g.lineTo(x, cy + len / 2);
          g.stroke();
        } else if (style === 'pulse') {
          g.fillStyle = rgba(ctx.s.primary, alpha);
          g.beginPath();
          g.arc(x, cy, r * lerp(1, 0.6 + 0.4 * v, Math.min(1, amp)) * (1 + 0.15 * Math.max(0, amp - 1) * v), 0, TAU);
          g.fill();
        } else {
          g.fillStyle = rgba(ctx.s.primary, alpha);
          g.beginPath();
          g.arc(x, cy - v * r * 1.6 * amp, r, 0, TAU);
          g.fill();
        }
      }
    });
  },
});
