import { el, glyphSpans } from '../../engine/dom';
import { ease, mod, num, PALETTE } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Only the gaps breathe. The layout is fitted at the fully-inhaled spacing (base +
// depth) so nothing ever overflows; at breath b each glyph sits at its rest
// position plus (col − centre)·depth·b·fontSize, so spacing grows from the centre
// outward while glyph size never changes. Inhale and exhale use sine.inOut with a
// 4 s / 6 s rhythm; opacity rises slightly with each breath.
const impl: EffectImpl = {
  id: 'breathing-tracking',
  defaults: { ...PALETTE.paperTeal },
  posterTime: 4,
  maxChars: 30,
  hide: ['intensity'],
  textHint: '字距控制項是「靜止時」的基礎字距。',
  params: [
    { key: 'depth', label: '呼吸幅度', type: 'range', min: 0.1, max: 1.2, step: 0.05, default: 0.55, unit: 'em' },
    { key: 'inhale', label: '吸氣秒數', type: 'range', min: 2, max: 8, step: 0.5, default: 4, unit: 's' },
    { key: 'exhale', label: '吐氣秒數', type: 'range', min: 2, max: 10, step: 0.5, default: 6, unit: 's' },
  ],
  create(ctx): EffectRuntime {
    const depth = num(ctx, 'depth', 0.55);
    const tin = num(ctx, 'inhale', 4);
    const tex = num(ctx, 'exhale', 6);
    const cycle = tin + tex;
    const L = layoutText(ctx, ctx.text, {
      family: ctx.font.serif,
      weight: 600,
      tracking: ctx.s.tracking + depth,
      maxHeight: ctx.height * 0.5,
      maxWidth: ctx.width * 0.86,
      lineHeight: 1.5,
    });
    const fs = L.fontSize;
    const spans = glyphSpans(ctx.root, L, { color: ctx.s.primary, includeSpaces: true });
    // offset factor (col − centre) per glyph, relative to its line
    const items = spans.map(({ el: e, g }) => {
      const n = L.lines[g.line].glyphs.length;
      const f = g.col - (n - 1) / 2;
      return { e, f };
    });
    const widest = L.lines.reduce((a, l) => (l.width > a.width ? l : a), L.lines[0]);
    const nW = widest.glyphs.length;
    const restW = widest.width - (nW - 1) * depth * fs;
    const lineY = L.y + L.height + fs * 0.25;
    const hair = el('div', { style: { position: 'absolute', left: `${ctx.width / 2}px`, top: `${lineY}px`, width: '1px', height: `${Math.max(1, fs * 0.025)}px`, background: ctx.s.secondary, transformOrigin: '0 50%' } }, ctx.root);
    const tick = () =>
      el('div', { style: { position: 'absolute', left: `${ctx.width / 2}px`, top: `${lineY - fs * 0.08}px`, width: `${Math.max(1, fs * 0.03)}px`, height: `${fs * 0.16 + Math.max(1, fs * 0.025)}px`, background: ctx.s.secondary } }, ctx.root);
    const tl = tick();
    const tr = tick();
    const sio = ease('sine.inOut');

    return {
      render(time) {
        const t = mod(time, cycle);
        const b = t < tin ? sio(t / tin) : 1 - sio((t - tin) / tex);
        const shift = -depth * fs * (1 - b); // relative to the fully-inhaled layout
        const op = (0.62 + 0.38 * b).toFixed(3);
        for (const it of items) {
          it.e.style.transform = `translate(-50%,-50%) translate3d(${(it.f * shift).toFixed(2)}px,0,0)`;
          it.e.style.opacity = op;
        }
        const w = restW + (nW - 1) * depth * fs * b;
        hair.style.transform = `translateX(${(-w / 2).toFixed(2)}px) scaleX(${w.toFixed(2)})`;
        tl.style.transform = `translateX(${(-w / 2).toFixed(2)}px)`;
        tr.style.transform = `translateX(${(w / 2).toFixed(2)}px)`;
      },
    };
  },
};
export default impl;
