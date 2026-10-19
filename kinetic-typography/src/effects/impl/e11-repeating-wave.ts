import { hexToRgb, stageCanvas } from '../../engine/canvas';
import { clamp, num, PALETTE, str, TAU } from '../../engine/helpers';
import { fontString, graphemes, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// The text is tiled into a brick grid that never moves or scales. Each glyph's colour
// is sampled from a 3-stop ramp (dim → primary → secondary) by a travelling wave:
//   v = sin(2π·d/λ − ωt),  d = projection on the wave direction (or radius for ripple)
// The wave is sharpened so a bright crest band sweeps diagonally over a dim field.
const impl: EffectImpl = {
  id: 'repeating-wave',
  defaults: { ...PALETTE.tealOnDark, secondary: '#D7FF00' },
  posterTime: 1.2,
  maxChars: 24,
  params: [
    { key: 'rows', label: '列數', type: 'range', min: 4, max: 18, step: 1, default: 9 },
    { key: 'angle', label: '波浪方向', type: 'range', min: 0, max: 180, step: 5, default: 35, unit: '°' },
    { key: 'wave', label: '波長', type: 'range', min: 0.15, max: 1.2, step: 0.05, default: 0.5, hint: '相對於畫面對角線' },
    { key: 'shape', label: '波形', type: 'select', default: 'linear', options: [{ value: 'linear', label: '斜向' }, { value: 'ripple', label: '漣漪' }] },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const sc = stageCanvas(ctx);
    const g = sc.g;
    const rows = Math.round(num(ctx, 'rows', 9));
    const ang = (num(ctx, 'angle', 35) * Math.PI) / 180;
    const diag = Math.hypot(W, H);
    const lambda = num(ctx, 'wave', 0.5) * diag;
    const ripple = str(ctx, 'shape', 'linear') === 'ripple';
    const omega = TAU * 0.45 * Math.max(0.1, ctx.s.intensity);
    const list = phrases(ctx.text);
    const rh = H / rows;
    const size = rh * 0.74 * ctx.s.fontScale;
    const tr = ctx.s.tracking * size;

    // colour ramp LUT
    const STEPS = 96;
    const bg = hexToRgb(ctx.s.background);
    const c1 = hexToRgb(ctx.s.primary);
    const c2 = hexToRgb(ctx.s.secondary);
    const dim = bg.map((v, i) => v + (c1[i] - v) * 0.16);
    const lut: string[] = [];
    for (let i = 0; i < STEPS; i++) {
      const v = i / (STEPS - 1);
      const [a, b, t] = v < 0.6 ? [dim, c1, v / 0.6] : [c1, c2, (v - 0.6) / 0.4];
      lut.push(`rgb(${a.map((x, j) => Math.round(x + (b[j] - x) * t)).join(',')})`);
    }

    // static tile positions
    interface Cell { ch: string; x: number; y: number; font: string }
    const cells: Cell[] = [];
    const fonts = [fontString(size, ctx.font.sans, 900), fontString(size, ctx.font.sans, 500)];
    for (let r = 0; r < rows; r++) {
      const phrase = list[r % list.length];
      const font = fonts[r % 2];
      g.font = font;
      const unit = [...graphemes(phrase), '・'];
      const widths = unit.map((ch) => g.measureText(ch).width + tr);
      const unitW = Math.max(1, widths.reduce((a, b) => a + b, 0));
      const y = rh * (r + 0.5);
      let x = -((r % 2) * unitW) / 2 - unitW * 0.25;
      while (x < W + size) {
        unit.forEach((ch, i) => {
          if (x + widths[i] > -size && x < W + size && ch.trim()) cells.push({ ch, x: x + widths[i] / 2, y, font });
          x += widths[i];
        });
      }
    }
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const cx = W / 2;
    const cy = H / 2;

    return {
      canvas: sc.canvas,
      render(t) {
        sc.clear(ctx.s.background);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        let font = '';
        for (const c of cells) {
          const d = ripple ? Math.hypot(c.x - cx, c.y - cy) : (c.x - cx) * ca + (c.y - cy) * sa;
          const ph = (TAU * d) / lambda - omega * t;
          // main wave sharpened into a crest band + a faint secondary harmonic
          let v = 0.5 + 0.5 * Math.sin(ph);
          v = Math.pow(v, 2.4) * 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(ph * 2 + 1.3));
          const idx = clamp(Math.round(v * (STEPS - 1)), 0, STEPS - 1);
          if (c.font !== font) {
            font = c.font;
            g.font = font;
          }
          g.fillStyle = lut[idx];
          g.fillText(c.ch, c.x, c.y);
        }
      },
    };
  },
};
export default impl;
