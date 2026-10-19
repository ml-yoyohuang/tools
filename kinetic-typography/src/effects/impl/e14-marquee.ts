import { el } from '../../engine/dom';
import { mod, num, PALETTE } from '../../engine/helpers';
import { asLines, fontString } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Rows of a repeated unit. Offset = (t·v) mod unitWidth, where unitWidth is the
// measured width of one unit, so the loop point is pixel-identical (no jump).
const impl: EffectImpl = {
  id: 'marquee',
  defaults: { ...PALETTE.lime },
  posterTime: 1,
  maxChars: 30,
  params: [
    { key: 'rows', label: '列數', type: 'range', min: 1, max: 7, step: 1, default: 4 },
    { key: 'tilt', label: '傾斜角度', type: 'range', min: -15, max: 15, step: 1, default: -4, unit: '°' },
  ],
  create(ctx): EffectRuntime {
    const rows = Math.round(num(ctx, 'rows', 4));
    const tilt = num(ctx, 'tilt', -4);
    const unitText = asLines(ctx.text).replace(/\n/g, '・') + '・';
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const diag = Math.hypot(ctx.width, ctx.height);
    const rowH = (ctx.height * 1.05) / rows;
    const size = rowH * 0.62 * ctx.s.fontScale;
    const group = el(
      'div',
      { style: { position: 'absolute', left: '50%', top: '50%', width: `${diag * 1.2}px`, transform: `translate(-50%,-50%) rotate(${tilt}deg)` } },
      ctx.root,
    );
    const tracks: { track: HTMLDivElement; unitW: number; v: number }[] = [];
    for (let r = 0; r < rows; r++) {
      const style = r % 3; // 0 solid, 1 outline, 2 band
      const row = el(
        'div',
        {
          style: {
            position: 'relative',
            height: `${rowH}px`,
            overflow: 'hidden',
            background: style === 2 ? fg : 'transparent',
            borderTop: style === 2 ? 'none' : `1px solid ${fg}33`,
          },
        },
        group,
      );
      const track = el('div', { style: { position: 'absolute', left: '0', top: '50%', display: 'flex', whiteSpace: 'pre', willChange: 'transform' } }, row);
      const unit = el(
        'span',
        {
          text: unitText,
          style: {
            font: fontString(size, ctx.font.sans, r % 2 ? 900 : 700),
            letterSpacing: `${ctx.s.tracking}em`,
            lineHeight: '1',
            paddingRight: `${size * 0.4}px`,
            color: style === 0 ? fg : style === 1 ? 'transparent' : bg,
            WebkitTextStroke: style === 1 ? `${Math.max(1, size * 0.03)}px ${acc === bg ? fg : r % 2 ? fg : acc}` : '',
          },
        },
        track,
      );
      const unitW = Math.max(1, unit.getBoundingClientRect().width);
      const copies = Math.ceil((diag * 1.2) / unitW) + 2;
      for (let i = 1; i < copies; i++) track.appendChild(unit.cloneNode(true));
      track.style.transform = 'translateY(-50%)';
      const speed = (60 + 40 * (r % 3)) * (ctx.width / 640) * ctx.s.intensity;
      tracks.push({ track, unitW, v: (r % 2 ? 1 : -1) * speed });
    }
    return {
      render(t) {
        for (const tr of tracks) {
          const x = -mod(t * Math.abs(tr.v), tr.unitW);
          const off = tr.v > 0 ? -tr.unitW - x : x; // rightward rows move the other way
          tr.track.style.transform = `translate3d(${off}px,-50%,0)`;
        }
      },
    };
  },
};
export default impl;
