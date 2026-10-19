import { el } from '../../engine/dom';
import { mod, num, PALETTE } from '../../engine/helpers';
import { asLines, fontString } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// A rotated stack of bands with gaps between them. Bands alternate between solid
// colour blocks (text knocked out in the background colour) and hollow outlined text
// on the bare background; every third solid band uses the accent colour. Adjacent
// bands run in opposite directions; each offset = (t·v) mod measured unit width, so
// all of them loop seamlessly. Arrows inside the unit point along the band's motion.
const HEIGHTS = [1, 0.62, 1.25, 0.7, 0.9, 0.55, 1.1];

const impl: EffectImpl = {
  id: 'diagonal-bands',
  defaults: { ...PALETTE.pink },
  posterTime: 1,
  maxChars: 30,
  params: [
    { key: 'bands', label: '色帶數', type: 'range', min: 2, max: 9, step: 1, default: 5 },
    { key: 'angle', label: '傾斜角度', type: 'range', min: -45, max: 45, step: 1, default: -22, unit: '°' },
    { key: 'gap', label: '色帶間距', type: 'range', min: 0, max: 0.6, step: 0.05, default: 0.18 },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const nb = Math.round(num(ctx, 'bands', 5));
    const angle = num(ctx, 'angle', -22);
    const gapK = num(ctx, 'gap', 0.18);
    const word = asLines(ctx.text).replace(/\n/g, '  ');
    const diag = Math.hypot(W, H);
    const rad = (Math.abs(angle) * Math.PI) / 180;
    // height of the rotated group needed to cover the stage
    const cover = W * Math.sin(rad) + H * Math.cos(rad);
    const hs = Array.from({ length: nb }, (_, i) => HEIGHTS[i % HEIGHTS.length]);
    const unitSum = hs.reduce((a, b) => a + b, 0) + gapK * nb;
    const u = (cover * 1.04) / unitSum;
    const groupW = diag * 1.25;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;

    const group = el('div', {
      style: { position: 'absolute', left: '50%', top: '50%', width: `${groupW}px`, transform: `translate(-50%,-50%) rotate(${angle}deg)`, display: 'flex', flexDirection: 'column', gap: `${u * gapK}px` },
    }, ctx.root);

    const bands = hs.map((h, i) => {
      const bh = u * h;
      const solid = i % 2 === 0;
      const fill = solid ? (i % 4 === 2 ? acc : fg) : 'transparent';
      const dir = i % 2 === 0 ? -1 : 1;
      const row = el('div', { style: { position: 'relative', height: `${bh}px`, overflow: 'hidden', background: fill, flex: '0 0 auto' } }, group);
      const track = el('div', { style: { position: 'absolute', left: '0', top: '50%', display: 'flex', whiteSpace: 'pre', willChange: 'transform' } }, row);
      const size = bh * (solid ? 0.68 : 0.78) * ctx.s.fontScale;
      const arrow = dir < 0 ? '←' : '→';
      const unit = el('span', {
        text: `${word}  ${arrow}  `,
        style: {
          font: fontString(size, ctx.font.sans, solid ? 900 : 800), letterSpacing: `${ctx.s.tracking}em`, lineHeight: '1',
          color: solid ? bg : 'transparent', WebkitTextStroke: solid ? '' : `${Math.max(1.2, size * 0.028)}px ${fg}`,
          fontStyle: i % 3 === 1 ? 'italic' : 'normal',
        },
      }, track);
      const unitW = Math.max(1, unit.getBoundingClientRect().width);
      const copies = Math.ceil(groupW / unitW) + 1;
      for (let c = 0; c < copies; c++) track.appendChild(unit.cloneNode(true));
      const v = (W * 0.11 + size * 0.6) * (1 + (i % 3) * 0.25) * Math.max(0.1, ctx.s.intensity);
      return { track, unitW, v, dir, phase: (i * 0.37 % 1) * unitW };
    });

    return {
      render(t) {
        for (const b of bands) {
          const off = mod(t * b.v + b.phase, b.unitW);
          const x = b.dir < 0 ? -off : off - b.unitW;
          b.track.style.transform = `translate3d(${x}px,-50%,0)`;
        }
      },
    };
  },
};
export default impl;
