import { glyphSpans, svgEl } from '../../engine/dom';
import { bool, num, PALETTE, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// y = A·sin(ωt − k·x): phase comes from each glyph's x position (not its index), so the
// wave is spatially continuous across words, spaces and lines (each line is offset by
// a quarter wavelength). Glyphs tilt by atan(dy/dx) of the wave, crests swell slightly,
// and a secondary-colour wave line underneath rides the same function.
const impl: EffectImpl = {
  id: 'wave-letters',
  defaults: { ...PALETTE.paperTeal },
  posterTime: 0.6,
  maxChars: 40,
  hide: ['intensity'],
  params: [
    { key: 'amp', label: '振幅', type: 'range', min: 0.05, max: 0.6, step: 0.01, default: 0.28, hint: '相對於字級' },
    { key: 'wavelength', label: '波長', type: 'range', min: 2, max: 16, step: 0.5, default: 6, hint: '以字級為單位' },
    { key: 'period', label: '週期', type: 'range', min: 0.6, max: 4, step: 0.1, default: 1.8, unit: 's' },
    { key: 'line', label: '顯示波浪線', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const showLine = bool(ctx, 'line', true);
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.5, maxWidth: W * 0.84, lineHeight: 1.55 });
    const fs = L.fontSize;
    const A = num(ctx, 'amp', 0.28) * fs;
    const lambda = num(ctx, 'wavelength', 6) * fs;
    const kx = TAU / lambda;
    const w = TAU / num(ctx, 'period', 1.8);
    const { primary: fg, secondary: acc } = ctx.s;

    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;overflow:visible' });
    ctx.root.appendChild(svg);
    const waves = showLine
      ? L.lines.map(() => svgEl('path', { fill: 'none', stroke: acc, 'stroke-width': Math.max(2, fs * 0.07), 'stroke-linecap': 'round' }, svg))
      : [];
    const spans = glyphSpans(ctx.root, L, { color: fg });
    const lineOff = (li: number) => li * (Math.PI / 2);
    const phase = (x: number, li: number, t: number) => w * t - kx * x - lineOff(li);

    return {
      render(t) {
        for (const s of spans) {
          const ph = phase(s.g.cx, s.g.line, t);
          const y = A * Math.sin(ph);
          const slope = -A * kx * Math.cos(ph); // dy/dx along the wave
          const tilt = (Math.atan(slope) * 180) / Math.PI * 0.8;
          const sw = 1 + 0.07 * Math.sin(ph); // crest swell (y up = negative, so swell at troughs inverted below)
          s.el.style.transform = `translate(-50%,-50%) translate3d(0,${(-y).toFixed(2)}px,0) rotate(${(-tilt).toFixed(2)}deg) scale(${sw.toFixed(3)})`;
        }
        waves.forEach((p, li) => {
          const line = L.lines[li];
          if (!line) return;
          const x0 = Math.max(0, line.glyphs[0]?.x ?? L.x) - fs * 0.6;
          const x1 = Math.min(W, (line.glyphs[line.glyphs.length - 1]?.x ?? L.x) + (line.glyphs[line.glyphs.length - 1]?.w ?? 0)) + fs * 0.6;
          const base = line.cy + fs * 0.62;
          let d = '';
          const n = 48;
          for (let i = 0; i <= n; i++) {
            const x = x0 + ((x1 - x0) * i) / n;
            const y = base - A * Math.sin(phase(x, li, t));
            d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
          }
          p.setAttribute('d', d);
        });
      },
    };
  },
};
export default impl;
