import { el } from '../../engine/dom';
import { clamp, num, PALETTE, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Each char hangs on a string from a nail on a rail. Every `period` seconds a gust
// kicks all of them (staggered left→right, alternating direction). The response to
// one kick is θ0·e^(−λτ)·sin(ωτ) — i.e. cos(ωτ+φ) with φ = −π/2, starting from rest —
// and the last few kicks are superposed so the motion is continuous and always decays.
const DEG = 180 / Math.PI;

const impl: EffectImpl = {
  id: 'swing-letters',
  defaults: { ...PALETTE.lime },
  posterTime: 1.3,
  maxChars: 30,
  params: [
    { key: 'damping', label: '衰減速度', type: 'range', min: 0.2, max: 2.5, step: 0.05, default: 0.6, hint: 'λ：越大越快停下' },
    { key: 'period', label: '推動間隔', type: 'range', min: 2.5, max: 9, step: 0.5, default: 5, unit: 's' },
  ],
  create(ctx): EffectRuntime {
    const lambda = num(ctx, 'damping', 0.6);
    const P = num(ctx, 'period', 5);
    const amp = (30 / DEG) * clamp(ctx.s.intensity, 0, 2);
    const L = layoutText(ctx, ctx.text, { maxHeight: ctx.height * 0.7, maxWidth: ctx.width * 0.84, lineHeight: 2.05, cy: ctx.height * 0.5 });
    const fs = L.fontSize;
    const strW = Math.max(1, fs * 0.022);
    const Ls = fs * 0.5;
    const pivotDy = -fs * 0.78;

    // rails
    for (const line of L.lines) {
      const gs = line.glyphs.filter((g) => !g.space);
      if (!gs.length) continue;
      const x0 = gs[0].cx - fs * 0.55;
      const x1 = gs[gs.length - 1].cx + fs * 0.55;
      const h = Math.max(2, fs * 0.06);
      el('div', { style: { position: 'absolute', left: `${x0}px`, top: `${line.cy + pivotDy - h / 2}px`, width: `${x1 - x0}px`, height: `${h}px`, borderRadius: `${h}px`, background: ctx.s.primary } }, ctx.root);
    }
    const items = L.chars.map((g, i) => {
      const px = g.cx;
      const py = g.cy + pivotDy;
      const arm = el('div', { style: { position: 'absolute', left: `${px}px`, top: `${py}px`, width: '0', height: '0', transformOrigin: '0 0', willChange: 'transform' } }, ctx.root);
      el('div', { style: { position: 'absolute', left: `${-strW / 2}px`, top: '0', width: `${strW}px`, height: `${Ls + fs * 0.08}px`, background: ctx.s.primary, opacity: 0.7 } }, arm);
      const ch = el(
        'span',
        {
          text: g.ch,
          style: { position: 'absolute', left: '0', top: `${Ls + fs * 0.5}px`, font: L.font, lineHeight: '1', whiteSpace: 'pre', color: ctx.s.primary, transformOrigin: '50% 0%', transform: 'translate(-50%,-50%)' },
        },
        arm,
      );
      // nail (static, above the arm)
      const nr = Math.max(2.5, fs * 0.075);
      el('div', { style: { position: 'absolute', left: `${px - nr}px`, top: `${py - nr}px`, width: `${nr * 2}px`, height: `${nr * 2}px`, borderRadius: '50%', background: ctx.s.secondary, boxShadow: `0 0 0 ${Math.max(1, nr * 0.35)}px ${ctx.s.primary}` } }, ctx.root);
      const w = (TAU / 1.3) * (1 + (hash2(i, 3, ctx.seed) - 0.5) * 0.18);
      return { arm, ch, w, delay: 0.25 + i * Math.min(0.09, 1.2 / L.chars.length) };
    });

    // θ for item at time t: superpose the last 3 kicks (alternating direction)
    const theta = (it: (typeof items)[number], t: number) => {
      const tl = t - it.delay;
      if (tl < 0) return 0;
      const k = Math.floor(tl / P);
      let a = 0;
      for (let j = Math.max(0, k - 2); j <= k; j++) {
        const tau = tl - j * P;
        a += (j % 2 ? -1 : 1) * amp * Math.exp(-lambda * tau) * Math.sin(it.w * tau);
      }
      return a;
    };

    return {
      render(t) {
        for (const it of items) {
          const a = theta(it, t);
          const lag = 0.5 * (theta(it, t - 0.1) - a);
          it.arm.style.transform = `rotate(${(a * DEG).toFixed(3)}deg)`;
          it.ch.style.transform = `translate(-50%,-50%) rotate(${(lag * DEG).toFixed(3)}deg)`;
        }
      },
    };
  },
};
export default impl;
