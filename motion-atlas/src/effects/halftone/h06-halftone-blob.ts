import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, minSide, num, smoothstep, TAU } from '../../engine/helpers';

export default defineEffect({
  id: 'halftone-blob',
  code: 'H06',
  nameZh: '半色調液團',
  nameEn: 'Halftone Blob',
  category: 'halftone',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '流動的軟性液團被轉成點陣：液團內圓點放大成實色，外圍只剩細小網點。',
  tags: ['半色調', 'metaball', '液態', '點陣', 'blob'],
  suitable: ['音樂視覺', '品牌背景', '海報動態'],
  principle:
    'Canvas 2D：數個沿 seeded Lissajous 路徑移動的圓心組成 metaball 場 f = Σ r²/d²；在固定網格上取樣，每個網點半徑 = smoothstep(門檻) × 最大半徑，場內外使用不同顏色。',
  defaultText: '',
  palette: 'POP',
  colors: { background: '#FFFFFF', primary: '#3450FF', secondary: '#ED589A' },
  controls: ['intensity', 'scale', 'secondary', 'seed'],
  params: [
    { key: 'spacing', label: '網點間距', type: 'range', min: 8, max: 32, step: 1, default: 14, unit: 'px' },
    { key: 'blobs', label: '液團數量', type: 'range', min: 2, max: 7, step: 1, default: 4 },
    { key: 'soft', label: '邊緣柔和度', type: 'range', min: 0.05, max: 0.8, step: 0.05, default: 0.35 },
    { key: 'outer', label: '外圍網點大小', type: 'range', min: 0, max: 0.4, step: 0.02, default: 0.12 },
  ],
  recipe: {
    enter: '畫面一開始即為點陣，液團已在畫面內。',
    motion: '液團沿各自的平滑軌跡漂移、互相融合與分離；點陣不動，只有每點的大小與顏色隨場值改變。',
    hold: '連續流動，無停頓。',
    exit: '無離場。',
    loop: '軌跡為週期函數，長時間播放保持流暢。',
  },
  accept: [
    '液團區域的網點明顯較大且為主色，背景網點小且為次色。',
    '兩個液團靠近時邊界融合成一體。',
    '調整網點間距時網格變疏或變密，液團形狀維持。',
    '同一 seed 重新整理後液團路徑相同。',
  ],
  transparent: true,
  cycle: 10,
  create(ctx) {
    const spacing = num(ctx, 'spacing', 14) / (ctx.mode === 'card' ? 1.25 : 1);
    const nb = Math.round(num(ctx, 'blobs', 4));
    const soft = num(ctx, 'soft', 0.35);
    const outer = num(ctx, 'outer', 0.12);
    const m = minSide(ctx);
    const blobs = Array.from({ length: nb }, () => ({
      r: m * (0.13 + ctx.rand() * 0.1) * ctx.s.scale,
      fx: 0.05 + ctx.rand() * 0.08,
      fy: 0.05 + ctx.rand() * 0.08,
      px: ctx.rand() * TAU,
      py: ctx.rand() * TAU,
    }));
    const cols = Math.ceil(ctx.width / spacing) + 1;
    const rows = Math.ceil(ctx.height / spacing) + 1;
    const ox = (ctx.width - (cols - 1) * spacing) / 2;
    const oy = (ctx.height - (rows - 1) * spacing) / 2;
    const amp = 0.32 + 0.1 * ctx.s.intensity;
    return canvasRuntime(ctx, (g, t) => {
      const pos = blobs.map((b) => ({
        x: ctx.width * (0.5 + amp * Math.sin(t * TAU * b.fx * ctx.s.intensity + b.px)),
        y: ctx.height * (0.5 + amp * Math.sin(t * TAU * b.fy * ctx.s.intensity + b.py)),
        r2: b.r * b.r,
      }));
      const maxR = spacing * 0.56;
      for (let j = 0; j < rows; j++) {
        const y = oy + j * spacing;
        for (let i = 0; i < cols; i++) {
          const x = ox + i * spacing;
          let f = 0;
          for (const p of pos) {
            const dx = x - p.x;
            const dy = y - p.y;
            f += p.r2 / (dx * dx + dy * dy + 1);
          }
          const k = smoothstep(1 - soft, 1 + soft * 0.4, f);
          const r = clamp(outer + (1 - outer) * k, 0, 1) * maxR;
          if (r < 0.3) continue;
          g.fillStyle = k > 0.5 ? ctx.s.primary : ctx.s.secondary;
          g.beginPath();
          g.arc(x, y, r, 0, TAU);
          g.fill();
        }
      }
    });
  },
});
