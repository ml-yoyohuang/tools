import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, minSide, mix, mod, num, str, TAU } from '../../engine/helpers';
import { DotBatch } from './_util';

export default defineEffect({
  id: 'halftone-rings',
  code: 'H05',
  nameZh: '半色調圓環',
  nameEn: 'Halftone Rings',
  category: 'halftone',
  sourceType: 'reference',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '同心的點陣圓環一圈接一圈依序脈動：偶數圈點放大、奇數圈點變亮，交錯傳遞。',
  tags: ['同心圓', '脈動', 'rings', '半色調', 'pulse'],
  suitable: ['音樂節拍視覺', '雷達／訊號意象', '載入畫面'],
  principle:
    'Canvas 2D：第 k 圈半徑 = R·(k+1)/K，點數 = round(2π·半徑 / 點距) 使各圈點距一致。脈衝相位 φ_k = mod(t/P − k·stagger/P, 1)，包絡 e = sin²(π·φ/0.35)（φ < 0.35 時）。偶數圈以 e 放大點半徑（主色）；奇數圈以 e 把顏色從次色混到強調色、尺寸只微幅變化，兩種變化交錯傳遞。各圈以交替方向緩慢自轉，避免整體像靜態圖。',
  defaultText: '',
  palette: 'COOL',
  controls: ['intensity', 'scale', 'secondary', 'accent'],
  params: [
    { key: 'rings', label: '圓環數', type: 'range', min: 3, max: 18, step: 1, default: 10 },
    { key: 'period', label: '脈衝週期', type: 'range', min: 0.8, max: 4, step: 0.1, default: 2.2, unit: 's' },
    { key: 'stagger', label: '圈間延遲', type: 'range', min: 0.03, max: 0.4, step: 0.01, default: 0.11, unit: 's' },
    {
      key: 'flow',
      label: '傳遞方向',
      type: 'select',
      default: 'out',
      options: [
        { value: 'out', label: '由內向外' },
        { value: 'in', label: '由外向內' },
      ],
    },
  ],
  recipe: {
    enter: '同心點陣圓環靜置於畫面中央。',
    motion: '脈衝從中心（或外圈）依序傳到每一圈：經過時偶數圈點脹大、奇數圈點變亮，sin² 包絡起落。',
    hold: '脈衝之間保留短暫的靜止圓環。',
    exit: '脈衝傳出最外圈後消退。',
    loop: '每個週期送出一個新脈衝，無限循環。',
  },
  accept: [
    '可清楚看到同心圓環由等距圓點組成，並非螺旋。',
    '脈動一圈接一圈依序傳遞，而非全部同時。',
    '相鄰兩圈的變化不同：一圈是尺寸、一圈是亮度。',
    '「傳遞方向」切換後脈衝改為由外向內。',
  ],
  transparent: true,
  posterTime: 0.7,
  cycle: 4.4,
  create(ctx) {
    const K = Math.round(clamp(num(ctx, 'rings', 10), 3, 18));
    const period = num(ctx, 'period', 2.2);
    const stagger = num(ctx, 'stagger', 0.11);
    const inward = str(ctx, 'flow', 'out') === 'in';
    const R = minSide(ctx) * 0.46 * ctx.s.scale;
    const ringGap = R / K;
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;
    const amp = 0.4 + 0.6 * ctx.s.intensity;
    const base = ringGap * 0.2;
    const rings = Array.from({ length: K }, (_, k) => {
      const rad = ringGap * (k + 1);
      const n = Math.max(6, Math.round((TAU * rad) / (ringGap * 0.92)));
      return { rad, n, spin: (k % 2 ? -1 : 1) * (0.05 + 0.25 / (k + 1)) };
    });
    // quantised colour steps for odd (brightness) rings
    const STEPS = 6;
    const shades = Array.from({ length: STEPS }, (_, i) => mix(ctx.s.secondary, ctx.s.accent, i / (STEPS - 1)));
    const env = (k: number, t: number) => {
      const order = inward ? K - 1 - k : k;
      const ph = mod(t / period - (order * stagger) / period, 1);
      return ph < 0.35 ? Math.sin((Math.PI * ph) / 0.35) ** 2 : 0;
    };
    return canvasRuntime(ctx, (g, t) => {
      const b = new DotBatch(g);
      // centre dot follows ring 0's rhythm
      const e0 = env(0, t + stagger);
      b.begin();
      b.dot(cx, cy, base * (1.2 + 1.4 * e0 * amp));
      // even rings: size pulse, primary
      for (let k = 0; k < K; k += 2) {
        const e = env(k, t);
        const ring = rings[k];
        const r = base * (1 + 1.5 * e * amp);
        const rot = ring.spin * t;
        for (let i = 0; i < ring.n; i++) {
          const th = (i / ring.n) * TAU + rot;
          b.dot(cx + Math.cos(th) * ring.rad, cy + Math.sin(th) * ring.rad, r);
        }
      }
      b.fill(ctx.s.primary);
      // odd rings: brightness pulse (secondary → accent), small size change
      for (let k = 1; k < K; k += 2) {
        const e = env(k, t);
        const ring = rings[k];
        const r = base * (1.05 + 0.35 * e * amp);
        const rot = ring.spin * t;
        b.begin();
        for (let i = 0; i < ring.n; i++) {
          const th = (i / ring.n) * TAU + rot;
          b.dot(cx + Math.cos(th) * ring.rad, cy + Math.sin(th) * ring.rad, r);
        }
        b.fill(shades[Math.round(clamp(e * Math.min(1, amp), 0, 1) * (STEPS - 1))]);
      }
    });
  },
});
