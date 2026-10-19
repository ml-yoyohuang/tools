import { el, glyphSpans } from '../../engine/dom';
import { clamp, num, PALETTE, timelineRuntime } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl } from '../../engine/types';

// Glyphs drop one per beat from above the stage (power3.in = gravity), stretch while
// falling, squash on the baseline (transform-origin at the glyph's foot) and recover
// with an elastic wobble. Each landing kicks up two dust dashes and extends the
// baseline rule underneath, like a metronome writing the line.
const impl: EffectImpl = {
  id: 'letter-sequence',
  defaults: { ...PALETTE.lime },
  loopable: true,
  posterTime: 2.2,
  maxChars: 30,
  textHint: '用「／」換行，每個字會依序敲進畫面。',
  params: [
    { key: 'beat', label: '節拍間隔', type: 'range', min: 0.06, max: 0.4, step: 0.01, default: 0.16, unit: 's' },
    { key: 'squash', label: '壓扁程度', type: 'range', min: 0, max: 0.6, step: 0.02, default: 0.38 },
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.5, max: 4, step: 0.1, default: 1.5, unit: 's' },
  ],
  create(ctx) {
    const k = clamp(ctx.s.intensity, 0, 2);
    const squash = num(ctx, 'squash', 0.38) * Math.min(1.4, k);
    const hold = num(ctx, 'hold', 1.5);
    const L = layoutText(ctx, ctx.text, { maxWidth: ctx.width * 0.84, maxHeight: ctx.height * 0.52, lineHeight: 1.35 });
    const fs = L.fontSize;
    const n = L.chars.length;
    const beat = Math.min(num(ctx, 'beat', 0.16), 3.2 / Math.max(1, n));
    const fall = 0.42;

    return timelineRuntime(ctx, (tl) => {
      const layer = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);
      // baseline rule per line, grows as glyphs land
      const thick = Math.max(2, fs * 0.05);
      const rules = L.lines.map((line) => {
        const vis = line.glyphs.filter((g) => !g.space);
        const x0 = vis.length ? vis[0].x : L.x;
        const x1 = vis.length ? vis[vis.length - 1].x + vis[vis.length - 1].w : L.x + L.width;
        const r = el('div', {
          style: { position: 'absolute', left: x0 - fs * 0.1, top: line.cy + fs * 0.56, width: x1 - x0 + fs * 0.2, height: thick, background: ctx.s.secondary, borderRadius: thick, transformOrigin: '0% 50%' },
        }, layer);
        return { r, x0: x0 - fs * 0.1, w: x1 - x0 + fs * 0.2 };
      });
      tl.set(rules.map((r) => r.r), { scaleX: 0 }, 0);

      const spans = glyphSpans(layer, L, { color: ctx.s.primary, style: { transformOrigin: '50% 92%' } });
      spans.forEach(({ el: s, g }, i) => {
        const land = 0.12 + i * beat + fall;
        const dustY = g.cy + fs * 0.46;
        const dust = [-1, 1].map((side) =>
          el('div', {
            style: { position: 'absolute', left: g.cx + side * g.w * 0.42, top: dustY, width: fs * 0.16, height: Math.max(1.5, fs * 0.035), borderRadius: fs, background: ctx.s.secondary, opacity: 0 },
          }, layer),
        );
        tl.set(s, { y: -(g.cy + fs * 1.2), scaleX: 0.86, scaleY: 1.22, opacity: 1 }, 0);
        tl.to(s, { y: 0, duration: fall, ease: 'power3.in' }, land - fall);
        tl.to(s, { scaleY: 1 - squash, scaleX: 1 + squash * 0.75, duration: 0.07, ease: 'power2.out' }, land);
        tl.to(s, { scaleX: 1, scaleY: 1, duration: 0.85, ease: 'elastic.out(1.15,0.32)' }, land + 0.07);
        dust.forEach((d, si) => {
          const side = si ? 1 : -1;
          tl.set(d, { x: 0, y: 0, opacity: 0, scaleX: 0.3, xPercent: -50 }, 0);
          tl.set(d, { opacity: 0.95 }, land);
          tl.to(d, { x: side * fs * 0.38, y: -fs * 0.1, scaleX: 1, opacity: 0, duration: 0.42, ease: 'power2.out' }, land + 0.001);
        });
        const rule = rules[g.line];
        tl.to(rule.r, { scaleX: clamp((g.x + g.w + fs * 0.1 - rule.x0) / rule.w, 0, 1), duration: 0.22, ease: 'power3.out' }, land);
      });

      const lastLand = 0.12 + (n - 1) * beat + fall;
      const settle = lastLand + 0.9;
      const exit = lastLand + 0.9 + hold;
      // exit: glyphs fall through the floor in the same order, rules retract
      spans.forEach(({ el: s, g }, i) => {
        tl.to(s, { y: ctx.height - g.cy + fs, scaleY: 1.15, scaleX: 0.9, duration: 0.4, ease: 'power2.in' }, exit + i * Math.min(0.05, 0.9 / n));
      });
      tl.to(rules.map((r) => r.r), { scaleX: 0, transformOrigin: '100% 50%', duration: 0.35, ease: 'power3.in' }, exit + 0.1);
      tl.set(rules.map((r) => r.r), { transformOrigin: '0% 50%' }, '>');
      tl.to({}, { duration: 0.2 }, '>');
      return { settle };
    });
  },
};
export default impl;
