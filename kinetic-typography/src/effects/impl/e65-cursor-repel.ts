import { el, glyphSpans } from '../../engine/dom';
import { num, PALETTE, pointerOrAuto, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Each glyph is a damped spring anchored at its layout position. Within radius R
// the pointer pushes it away with force ∝ (1 − d/R)². Fixed-step simulation, so
// seek / replay is deterministic and oscillation always decays.
const impl: EffectImpl = {
  id: 'cursor-repel',
  defaults: { ...PALETTE.darkTeal, primary: '#F4F1E8', secondary: '#27D3C2' },
  interactive: true,
  posterTime: 2.3,
  maxChars: 40,
  params: [
    { key: 'radius', label: '影響半徑', type: 'range', min: 0.1, max: 0.6, step: 0.02, default: 0.3, hint: '相對於舞台高度' },
    { key: 'stiff', label: '彈簧強度', type: 'range', min: 20, max: 300, step: 5, default: 110 },
    { key: 'damp', label: '阻尼', type: 'range', min: 4, max: 30, step: 1, default: 11 },
  ],
  create(ctx): EffectRuntime {
    const L = layoutText(ctx, ctx.text, { maxHeight: ctx.height * 0.5 });
    const spans = glyphSpans(ctx.root, L, { color: ctx.s.primary });
    const R = ctx.height * num(ctx, 'radius', 0.3);
    const K = num(ctx, 'stiff', 110);
    const D = num(ctx, 'damp', 11);
    const push = K * R * 0.9 * ctx.s.intensity; // ≈0.9R displacement at the centre
    const ring = el('div', { style: { position: 'absolute', left: '0', top: '0', width: `${R * 2}px`, height: `${R * 2}px`, borderRadius: '50%', border: `1.5px dashed ${ctx.s.secondary}`, opacity: 0.5, pointerEvents: 'none' } }, ctx.root);
    const dot = el('div', { style: { position: 'absolute', left: '0', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: ctx.s.secondary } }, ctx.root);
    const st = spans.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
    let cur = { x: -9999, y: -9999, real: false };
    // automatic sweep: a circle travelling left-right through the text, then pausing outside
    const auto = (t: number) => {
      const c = (t % 6) / 6;
      const sweep = c < 0.7 ? c / 0.7 : 1;
      return {
        x: ctx.width * (-0.15 + 1.3 * sweep),
        y: L.y + L.height * (0.5 + 0.35 * Math.sin(sweep * TAU * 1.5)),
      };
    };
    return {
      reset() {
        for (const s of st) s.x = s.y = s.vx = s.vy = 0;
      },
      step(t, dt) {
        cur = pointerOrAuto(ctx, t, auto);
        for (let i = 0; i < st.length; i++) {
          const s = st[i];
          const g = spans[i].g;
          const dx = g.cx + s.x - cur.x;
          const dy = g.cy + s.y - cur.y;
          const d = Math.hypot(dx, dy) || 0.001;
          let fx = -K * s.x - D * s.vx;
          let fy = -K * s.y - D * s.vy;
          if (d < R) {
            const f = push * (1 - d / R) ** 2;
            fx += (dx / d) * f;
            fy += (dy / d) * f;
          }
          s.vx += fx * dt;
          s.vy += fy * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
        }
      },
      render() {
        for (let i = 0; i < st.length; i++) {
          const s = st[i];
          const rot = Math.max(-35, Math.min(35, s.vx * 0.05));
          spans[i].el.style.transform = `translate(-50%,-50%) translate3d(${s.x}px,${s.y}px,0) rotate(${rot}deg)`;
        }
        ring.style.transform = `translate3d(${cur.x - R}px, ${cur.y - R}px, 0)`;
        dot.style.transform = `translate3d(${cur.x - 5}px, ${cur.y - 5}px, 0)`;
        ring.style.opacity = cur.real ? '0.65' : '0.4';
      },
    };
  },
};
export default impl;
