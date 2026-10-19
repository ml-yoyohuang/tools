import { el } from '../../engine/dom';
import { num, PALETTE, timelineRuntime } from '../../engine/helpers';
import { layoutText, phrases } from '../../engine/text';
import type { EffectImpl } from '../../engine/types';

// Each phrase rushes from far away (expo.in), overshoots, settles with back.out
// and leaves directional ghost copies that only exist during the impact.
const impl: EffectImpl = {
  id: 'punch-zoom',
  defaults: { ...PALETTE.coral },
  loopable: true,
  posterTime: 1.1,
  maxChars: 24,
  textHint: '可用「／」分隔多個詞，每個詞輪流衝擊。',
  params: [
    { key: 'ghosts', label: '殘影數', type: 'range', min: 0, max: 6, step: 1, default: 4 },
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1.3, unit: 's' },
  ],
  create(ctx) {
    const list = phrases(ctx.text);
    const ghosts = Math.round(num(ctx, 'ghosts', 4) * (ctx.mode === 'card' ? 0.75 : 1));
    const hold = num(ctx, 'hold', 1.3);
    const k = ctx.s.intensity;
    return timelineRuntime(ctx, (tl) => {
        let settle = 0;
        list.forEach((p, idx) => {
          const L = layoutText(ctx, p, { maxHeight: ctx.height * 0.55, maxWidth: ctx.width * 0.82 });
          const wrap = el('div', { style: { position: 'absolute', inset: '0', opacity: 0 } }, ctx.root);
          const make = (color: string, opacity: number) =>
            el(
              'div',
              {
                text: L.lines.map((l) => l.text).join('\n'),
                style: {
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  font: L.font,
                  lineHeight: `${L.lineHeight}px`,
                  letterSpacing: `${L.tracking}em`,
                  textAlign: 'center',
                  whiteSpace: 'pre',
                  color,
                  opacity,
                  willChange: 'transform',
                },
              },
              wrap,
            );
          const gs = Array.from({ length: ghosts }, (_, i) => make(ctx.s.secondary, 0.5 - i * 0.06));
          const main = make(ctx.s.primary, 1);
          const all = [...gs, main];
          tl.set(all, { xPercent: -50, yPercent: -50, scale: 0.04 }, idx === 0 ? 0 : '>');
          tl.set(wrap, { opacity: 1 }, '<');
          const start = tl.duration();
          const dir = idx % 2 ? -1 : 1;
          // rush in
          tl.to(main, { scale: 1 + 0.18 * k, duration: 0.32, ease: 'expo.in' }, start);
          tl.to(main, { scale: 1, duration: 0.5, ease: 'back.out(3)' }, start + 0.32);
          // impact jolt
          tl.fromTo(wrap, { x: 0 }, { x: 10 * k * dir, duration: 0.05, yoyo: true, repeat: 3, ease: 'none' }, start + 0.32);
          // ghosts trail behind and dissolve
          gs.forEach((g, i) => {
            const lag = 0.035 * (i + 1);
            tl.to(g, { scale: 1 + 0.18 * k, x: -dir * (i + 1) * 0.03 * L.fontSize * k, duration: 0.32, ease: 'expo.in' }, start + lag);
            tl.to(g, { scale: 1.25 + i * 0.12 * k, opacity: 0, duration: 0.42, ease: 'power2.out' }, start + 0.32 + lag);
          });
          // exit
          const exit = start + 0.82 + hold;
          settle = start + 0.82 + hold * 0.6;
          tl.to(main, { scale: 2.4, opacity: 0, filter: 'blur(6px)', duration: 0.26, ease: 'power3.in' }, exit);
          tl.set(wrap, { opacity: 0 }, exit + 0.26);
          tl.to({}, { duration: 0.12 }, exit + 0.26);
        });
        return { settle };
    });
  },
};
export default impl;
