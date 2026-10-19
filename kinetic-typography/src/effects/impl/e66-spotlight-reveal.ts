import { rgba } from '../../engine/canvas';
import { el, layer, textBlock } from '../../engine/dom';
import { clamp, lerp, num, PALETTE, pointerOrAuto, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Three layers of the same layout: a barely-there outline copy, a soft light pool
// on the "floor", and a bright copy whose mask-image is a radial gradient centred on
// the light. The light follows the pointer (smoothed) in detail mode; otherwise it
// sweeps a figure-eight across the text, pausing slightly at the turns.
const impl: EffectImpl = {
  id: 'spotlight-reveal',
  defaults: { ...PALETTE.darkLime },
  interactive: true,
  posterTime: 1.1,
  maxChars: 40,
  params: [
    { key: 'radius', label: '光圈半徑', type: 'range', min: 0.1, max: 0.5, step: 0.01, default: 0.28, hint: '相對於舞台短邊' },
    { key: 'soft', label: '邊緣柔和', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'dim', label: '暗處亮度', type: 'range', min: 0, max: 0.4, step: 0.01, default: 0.07 },
  ],
  create(ctx): EffectRuntime {
    const L = layoutText(ctx, ctx.text, { maxHeight: ctx.height * 0.56, maxWidth: ctx.width * 0.86 });
    const fs = L.fontSize;
    const R = Math.min(ctx.width, ctx.height) * num(ctx, 'radius', 0.28);
    const soft = num(ctx, 'soft', 0.6);
    const dim = num(ctx, 'dim', 0.07);
    const { primary: fg, secondary: acc } = ctx.s;
    const k = clamp(ctx.s.intensity, 0, 2);

    // dim copy
    textBlock(ctx.root, L, { color: rgba(fg, dim), style: { WebkitTextStroke: `${Math.max(0.6, fs * 0.012)}px ${rgba(fg, 0.12 + dim)}` } });
    // light pool
    const pool = layer(ctx.root, { pointerEvents: 'none' });
    // bright copy
    const lit = layer(ctx.root, { pointerEvents: 'none' });
    textBlock(lit, L, { color: fg, style: { textShadow: `0 0 ${fs * 0.18}px ${rgba(acc, 0.55)}, 0 0 ${fs * 0.5}px ${rgba(acc, 0.25)}` } });
    // rim of the light (thin ring)
    const ring = el('div', { style: { position: 'absolute', left: '0', top: '0', width: `${R * 2}px`, height: `${R * 2}px`, borderRadius: '50%', border: `1px solid ${rgba(acc, 0.22)}`, pointerEvents: 'none' } }, ctx.root);

    const cx = L.x + L.width / 2;
    const cy = L.y + L.height / 2;
    const ax = Math.max(L.width * 0.5, R * 0.6) * (0.6 + 0.4 * Math.min(1.5, k));
    const ay = Math.max(L.height * 0.42, R * 0.3);
    const P = 6.4;
    const auto = (t: number) => {
      // figure-eight; sin(φ + 0.25·sin 2φ) lingers a bit at the turns
      const ph = (t / P) * TAU;
      const s = ph + 0.25 * Math.sin(2 * ph);
      return { x: cx + ax * Math.sin(s), y: cy + ay * Math.sin(2 * s) };
    };
    const inner = (1 - soft) * 92;
    let lx = auto(0).x;
    let ly = auto(0).y;
    const place = (x: number, y: number) => {
      const m = `radial-gradient(circle ${R.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, #000 ${inner.toFixed(1)}%, rgba(0,0,0,.5) ${(inner + (100 - inner) * 0.45).toFixed(1)}%, transparent 100%)`;
      lit.style.maskImage = m;
      lit.style.webkitMaskImage = m;
      pool.style.background = `radial-gradient(circle ${(R * 1.5).toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, ${rgba(acc, 0.14)}, ${rgba(acc, 0.04)} 55%, transparent 100%)`;
      ring.style.transform = `translate3d(${(x - R).toFixed(1)}px, ${(y - R).toFixed(1)}px, 0)`;
    };
    return {
      reset() {
        const a = auto(0);
        lx = a.x;
        ly = a.y;
      },
      render(t, dt) {
        const p = pointerOrAuto(ctx, t, auto);
        if (dt === 0 || !p.real) {
          lx = p.x;
          ly = p.y;
        } else {
          const f = 1 - Math.exp(-dt * 10);
          lx = lerp(lx, p.x, f);
          ly = lerp(ly, p.y, f);
        }
        place(lx, ly);
        ring.style.opacity = p.real ? '1' : '0.6';
      },
    };
  },
};
export default impl;
