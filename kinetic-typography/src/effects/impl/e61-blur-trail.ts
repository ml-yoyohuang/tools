import { el, svgEl } from '../../engine/dom';
import { clamp, ease, mod, num, PALETTE } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Position is a pure function x(t) (expo.out arrival, hold, power4.in exit, the
// next pass comes back from the other side). Each afterimage samples x(t − kδ),
// so trails stretch out at speed and retract by themselves once the text stops.
// Directional blur = per-copy SVG feGaussianBlur with stdDeviation "σx 0", where
// σx and the scaleX stretch follow the instantaneous velocity of that sample.
let uid = 0;

const impl: EffectImpl = {
  id: 'blur-trail',
  defaults: { ...PALETTE.coral },
  posterTime: 0.33,
  maxChars: 30,
  textHint: '用「／」分隔多個詞，每次橫越換一個詞。',
  params: [
    { key: 'trails', label: '殘影數', type: 'range', min: 2, max: 12, step: 1, default: 7 },
    { key: 'lag', label: '殘影間隔', type: 'range', min: 0.015, max: 0.08, step: 0.005, default: 0.03, unit: 's' },
  ],
  create(ctx): EffectRuntime {
    const list = phrases(ctx.text);
    const P = list.length % 2 === 0 ? list.length : list.length * 2;
    const N = Math.max(1, Math.round(num(ctx, 'trails', 7) * (0.5 + 0.5 * ctx.q)));
    const lag = num(ctx, 'lag', 0.03);
    const k = clamp(ctx.s.intensity, 0, 2);
    const W = ctx.width;
    const id = `bt${++uid}`;
    const lays = list.map((p) => layoutText(ctx, p, { maxHeight: ctx.height * 0.46, maxWidth: W * 0.8 }));
    const fs = Math.max(...lays.map((l) => l.fontSize));
    const enter = 0.72;
    const holdT = 1.25;
    const exit = 0.42;
    const passT = enter + holdT + exit;
    const cycle = P * passT;
    const eIn = ease('expo.out');
    const eOut = ease('power4.in');
    const wout = (pi: number) => W / 2 + lays[pi % list.length].width / 2 + fs * 0.6;

    const xAt = (time: number) => {
      const t = mod(time, cycle);
      const p = Math.min(P - 1, Math.floor(t / passT));
      const tau = t - p * passT;
      const dir = p % 2 === 0 ? 1 : -1;
      const wo = wout(p);
      let x = 0;
      if (tau < enter) x = -dir * wo * (1 - eIn(tau / enter));
      else if (tau > enter + holdT) x = dir * wo * eOut((tau - enter - holdT) / exit);
      return { x, p };
    };
    const vAt = (time: number) => (xAt(time).x - xAt(time - 1 / 120).x) * 120;

    // filters
    const svg = svgEl('svg', { width: 0, height: 0 });
    Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
    ctx.root.appendChild(svg);
    const blurs: SVGFEGaussianBlurElement[] = [];
    for (let i = 0; i <= N; i++) {
      const f = svgEl('filter', { id: `${id}-${i}`, x: '-50%', y: '-10%', width: '200%', height: '120%', 'color-interpolation-filters': 'sRGB' }, svg);
      blurs.push(svgEl('feGaussianBlur', { stdDeviation: '0 0' }, f));
    }

    // speed lines
    const lines = Array.from({ length: Math.round(5 + 3 * ctx.q) }, (_, i) => {
      const h = Math.max(1.5, fs * (0.02 + 0.03 * hash2(i, 1, ctx.seed)));
      return {
        el: el('div', { style: { position: 'absolute', left: '0', top: '0', height: `${h}px`, width: '1px', borderRadius: `${h}px`, background: i % 3 === 0 ? ctx.s.primary : ctx.s.secondary, transformOrigin: '0 50%', opacity: 0 } }, ctx.root),
        y: (hash2(i, 2, ctx.seed) - 0.5) * 1.1,
        len: 0.5 + hash2(i, 3, ctx.seed),
      };
    });

    const mk = (color: string, z: number) =>
      el('div', { style: { position: 'absolute', left: '50%', top: '50%', whiteSpace: 'pre', textAlign: 'center', color, willChange: 'transform, filter', zIndex: String(z) } }, ctx.root);
    const copies = Array.from({ length: N }, (_, i) => ({ el: mk(ctx.s.secondary, N - i), pass: -1 }));
    const main = { el: mk(ctx.s.primary, N + 1), pass: -1 };
    const apply = (c: { el: HTMLDivElement; pass: number }, p: number) => {
      if (c.pass === p) return;
      c.pass = p;
      const L = lays[p % list.length];
      c.el.textContent = L.lines.map((l) => l.text).join('\n');
      c.el.style.font = L.font;
      c.el.style.lineHeight = `${L.lineHeight}px`;
      c.el.style.letterSpacing = `${L.tracking}em`;
    };
    const vRef = W * 2.2;
    const cy = ctx.height / 2;

    const draw = (c: { el: HTMLDivElement; pass: number }, i: number, time: number, opacity: number, blurMul: number) => {
      const { x, p } = xAt(time);
      apply(c, p);
      const v = vAt(time);
      const sp = clamp(Math.abs(v) / vRef, 0, 1.6);
      const sx = Math.min(fs * 0.7, Math.abs(v) * 0.01 * k * blurMul);
      blurs[i].setAttribute('stdDeviation', `${sx.toFixed(2)} 0`);
      c.el.style.filter = sx > 0.25 ? `url(#${id}-${i})` : 'none';
      const st = 1 + sp * 0.35 * k;
      const skew = clamp(-v / vRef, -1, 1) * 14 * k * blurMul;
      c.el.style.transformOrigin = v > 0 ? '100% 50%' : '0% 50%';
      c.el.style.transform = `translate(${x.toFixed(2)}px,0) translate(-50%,-50%) skewX(${skew.toFixed(2)}deg) scaleX(${st.toFixed(3)})`;
      c.el.style.opacity = String(opacity);
      return { x, v };
    };

    return {
      render(time) {
        const m = draw(main, N, time, 1, 0.35);
        copies.forEach((c, i) => {
          const tk = time - (i + 1) * lag;
          const xk = xAt(tk).x;
          const vis = clamp(Math.abs(xk - m.x) / (fs * 0.12), 0, 1);
          const base = 0.62 * (1 - i / (N + 0.5)) ** 1.3;
          draw(c, i, tk, base * vis, 1);
        });
        const sp = clamp(Math.abs(m.v) / vRef, 0, 1);
        const L = lays[xAt(time).p % list.length];
        const dir = m.v >= 0 ? 1 : -1;
        for (const ln of lines) {
          const len = sp * ln.len * W * 0.45 * k;
          const x0 = W / 2 + m.x - dir * (L.width * 0.35);
          const x = dir > 0 ? x0 - len : x0;
          ln.el.style.transform = `translate(${x.toFixed(1)}px, ${(cy + ln.y * L.height).toFixed(1)}px) scaleX(${Math.max(0.001, len).toFixed(1)})`;
          ln.el.style.opacity = String(clamp(sp * 1.6, 0, 0.85));
        }
      },
    };
  },
};
export default impl;
