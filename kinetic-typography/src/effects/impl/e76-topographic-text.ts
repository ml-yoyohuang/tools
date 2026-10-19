import { rgba, stageCanvas } from '../../engine/canvas';
import { bool, clamp, mod, num, PALETTE } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Offset contours of the real glyph shape. For each ring (outermost first):
//   strokeText(lineWidth = 2d + w) in the line colour, then
//   strokeText(lineWidth = 2d − w) in the background colour,
// which leaves a band of width w at distance d from the glyph outline (round
// joins make it a true parallel offset, not a circle). d = k·spacing + phase,
// phase = (t·v) mod spacing, so rings flow outward and the loop is seamless.
// Every 4th ring (counted on the moving ring identity) is a heavier index contour.

const impl: EffectImpl = {
  id: 'topographic-text',
  defaults: { ...PALETTE.paperTeal, secondary: '#1E9C90' },
  posterTime: 2,
  maxChars: 30,
  params: [
    { key: 'spacing', label: '等高線間距', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1, unit: '×' },
    { key: 'rings', label: '層數', type: 'range', min: 4, max: 22, step: 1, default: 12 },
    { key: 'speed', label: '擴張速度', type: 'range', min: 0, max: 2, step: 0.05, default: 1, unit: '×' },
    { key: 'frame', label: '地圖框線', type: 'toggle', default: true },
  ],
  hide: ['intensity'],
  create(ctx): EffectRuntime {
    const sc = stageCanvas(ctx);
    const { g } = sc;
    const W = ctx.width;
    const H = ctx.height;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.42, maxWidth: W * 0.7 });
    const fs = L.fontSize;
    const { primary: fg, secondary: line, background: bg } = ctx.s;
    const spacing = Math.max(4, fs * 0.075 * num(ctx, 'spacing', 1));
    // keep strokeText calls bounded for long text
    const ringsWanted = Math.round(num(ctx, 'rings', 12) * (0.6 + 0.4 * ctx.q));
    const rings = Math.max(3, Math.min(ringsWanted, Math.floor(700 / Math.max(1, L.chars.length * 2))));
    const v = spacing * 0.55 * num(ctx, 'speed', 1); // px / s
    const lw = Math.max(1, Math.min(2.2, spacing * 0.16));
    const frame = bool(ctx, 'frame', true);
    const dmax = rings * spacing;

    const strokeAll = (width: number, color: string) => {
      g.lineWidth = width;
      g.strokeStyle = color;
      for (const c of L.chars) g.strokeText(c.ch, c.cx, c.cy);
    };

    return {
      canvas: sc.canvas,
      render(t) {
        sc.clear(bg);
        const travel = t * v;
        const phase = mod(travel, spacing);
        const shift = Math.floor(travel / spacing);
        g.save();
        g.font = L.font;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineCap = 'round';
        for (let k = rings; k >= 0; k--) {
          const d = k * spacing + phase;
          if (d < lw * 0.6) continue;
          const id = k - shift; // stable identity of this ring as it moves outward
          const index = mod(id, 4) === 0;
          // fade out toward the outermost ring, fade in as a ring is born at the glyph edge
          const a = Math.pow(1 - clamp(d / dmax, 0, 1), 1.15) * clamp(d / (spacing * 0.8), 0, 1);
          if (a <= 0.01) continue;
          const w = index ? lw * 1.9 : lw;
          strokeAll(2 * d + w, rgba(line, (index ? 0.95 : 0.7) * a));
          strokeAll(Math.max(0.01, 2 * d - w), bg);
        }
        // the summit: the solid glyph
        g.fillStyle = fg;
        for (const c of L.chars) g.fillText(c.ch, c.cx, c.cy);
        g.restore();

        if (frame) {
          const m = Math.min(W, H) * 0.05;
          g.save();
          g.strokeStyle = rgba(fg, 0.35);
          g.lineWidth = 1;
          g.strokeRect(m, m, W - 2 * m, H - 2 * m);
          const ticks = 12;
          g.beginPath();
          for (let i = 1; i < ticks; i++) {
            const x = m + ((W - 2 * m) * i) / ticks;
            const y = m + ((H - 2 * m) * i) / ticks;
            const len = i % 3 === 0 ? m * 0.4 : m * 0.2;
            g.moveTo(x, m);
            g.lineTo(x, m + len);
            g.moveTo(x, H - m);
            g.lineTo(x, H - m - len);
            g.moveTo(m, y);
            g.lineTo(m + len, y);
            g.moveTo(W - m, y);
            g.lineTo(W - m - len, y);
          }
          g.stroke();
          // north arrow
          const ax = W - m * 2.2;
          const ay = m * 2.4;
          const s = m * 0.55;
          g.fillStyle = line;
          g.beginPath();
          g.moveTo(ax, ay - s);
          g.lineTo(ax + s * 0.45, ay + s * 0.6);
          g.lineTo(ax, ay + s * 0.25);
          g.closePath();
          g.fill();
          g.strokeStyle = line;
          g.beginPath();
          g.moveTo(ax, ay - s);
          g.lineTo(ax - s * 0.45, ay + s * 0.6);
          g.lineTo(ax, ay + s * 0.25);
          g.closePath();
          g.stroke();
          g.restore();
        }
      },
    };
  },
};
export default impl;
