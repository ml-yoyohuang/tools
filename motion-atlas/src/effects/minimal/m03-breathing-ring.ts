import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, lerp, minSide, num, phase, rgba, TAU } from '../../engine/helpers';
import { easeQuadInOut, easeSineInOut, hair } from './_util';

export default defineEffect({
  id: 'breathing-ring',
  code: 'M03',
  nameZh: '呼吸圓環',
  nameEn: 'Breathing Ring',
  category: 'minimal',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '一個圓環以吸氣、停、吐氣、停的節奏緩慢擴張與收縮，收縮時線條略粗、擴張時略細。',
  tags: ['極簡', '呼吸', '圓環', '冥想', 'breathing'],
  suitable: ['冥想／放鬆 App', '等待畫面', '品牌背景'],
  principle:
    'Canvas 2D：呼吸值 b(t) ∈ [0,1] 由四段組成：吸氣（sine.inOut，40%）、頂端停留（8%）、吐氣（quad.inOut，44%）、底端停留（8%）。半徑 r = R·(1 − depth + depth·b)；線寬 = base·(1.3 − 0.55·b)，與半徑反向，好像圓環被拉薄。選用的導引環固定在最小半徑，透明度很低。',
  defaultText: '',
  palette: 'MONO',
  controls: ['scale', 'secondary'],
  params: [
    { key: 'breath', label: '一次呼吸', type: 'range', min: 3, max: 12, step: 0.5, default: 7, unit: 's' },
    { key: 'depth', label: '呼吸深度', type: 'range', min: 0.1, max: 0.6, step: 0.05, default: 0.35 },
    { key: 'line', label: '線寬', type: 'range', min: 0.004, max: 0.03, step: 0.001, default: 0.012 },
    { key: 'guide', label: '最小半徑導引環', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '圓環從最小半徑開始。',
    motion: '吸氣以 sine.inOut 擴張（約 2.8 秒），吐氣以 quad.inOut 收縮（約 3.1 秒），線寬隨之略變。',
    hold: '頂端與底端各停約 0.5 秒。',
    exit: '吐氣結束回到最小半徑。',
    loop: '呼吸週期無縫循環。',
  },
  accept: [
    '圓環半徑緩慢地大小變化，頂端與底端有短暫停頓。',
    '圓環擴張時線條較細，收縮時較粗。',
    '吐氣比吸氣稍慢。',
    '呼吸深度調大時大小差距明顯變大。',
  ],
  transparent: true,
  cycle: 7,
  posterTime: 3.2,
  create(ctx) {
    const m = minSide(ctx);
    const breath = num(ctx, 'breath', 7);
    const depth = num(ctx, 'depth', 0.35);
    const line = num(ctx, 'line', 0.012);
    const guide = bool(ctx, 'guide', true);
    const R = m * 0.36 * ctx.s.scale;
    const base = hair(m, line, 1.5);
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;
    const durs = [0.4, 0.08, 0.44, 0.08].map((f) => f * breath);
    const bAt = (t: number) => {
      const ph = phase(t, durs);
      if (ph.i === 0) return easeSineInOut(ph.p);
      if (ph.i === 1) return 1;
      if (ph.i === 2) return 1 - easeQuadInOut(ph.p);
      return 0;
    };
    return canvasRuntime(ctx, (g, t) => {
      const b = bAt(t);
      const rMin = R * (1 - depth);
      if (guide) {
        g.strokeStyle = rgba(ctx.s.secondary, 0.35);
        g.lineWidth = Math.max(1, base * 0.25);
        g.beginPath();
        g.arc(cx, cy, rMin, 0, TAU);
        g.stroke();
      }
      g.strokeStyle = rgba(ctx.s.primary, lerp(0.82, 1, b));
      g.lineWidth = base * (1.3 - 0.55 * b);
      g.beginPath();
      g.arc(cx, cy, lerp(rMin, R, b), 0, TAU);
      g.stroke();
    });
  },
});
