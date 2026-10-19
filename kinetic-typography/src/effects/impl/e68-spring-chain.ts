import { el, glyphSpans, svgEl } from '../../engine/dom';
import { clamp, num, PALETTE, pointerOrAuto, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Mass–spring chain, fixed-step semi-implicit Euler (4 substeps per 1/60 s).
// The first char is pulled by a stiff, critically damped spring toward the target
// (pointer in detail mode, otherwise a looping throw that returns home and rests);
// every link is a damped spring with its layout distance as rest length, and each
// char has a weak spring to home, so disturbances travel down the chain with delay,
// lose energy, and the whole thing settles back into the readable line.
const impl: EffectImpl = {
  id: 'spring-chain',
  defaults: { ...PALETTE.darkCoral },
  interactive: true,
  posterTime: 1.6,
  maxChars: 30,
  params: [
    { key: 'stiff', label: '彈簧強度', type: 'range', min: 30, max: 400, step: 10, default: 150 },
    { key: 'damp', label: '阻尼', type: 'range', min: 0.5, max: 8, step: 0.1, default: 2.4 },
    { key: 'home', label: '回原位力', type: 'range', min: 0, max: 20, step: 0.5, default: 3.5 },
  ],
  create(ctx): EffectRuntime {
    const L = layoutText(ctx, ctx.text, { maxHeight: ctx.height * 0.42, maxWidth: ctx.width * 0.8, tracking: ctx.s.tracking + 0.45, lineHeight: 1.6 });
    const fs = L.fontSize;
    const W = ctx.width;
    const H = ctx.height;
    const K = num(ctx, 'stiff', 150);
    const DAMP = num(ctx, 'damp', 2.4);
    const KH = num(ctx, 'home', 3.5);
    const k = clamp(ctx.s.intensity, 0, 2);

    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    Object.assign(svg.style, { position: 'absolute', inset: '0', overflow: 'visible' });
    ctx.root.appendChild(svg);
    const spans = glyphSpans(ctx.root, L, { color: ctx.s.primary });
    const n = spans.length;
    const home = spans.map((s) => ({ x: s.g.cx, y: s.g.cy }));
    const rest = home.slice(1).map((h, i) => Math.hypot(h.x - home[i].x, h.y - home[i].y));
    // links that jump to the next line are drawn as a faint straight tether instead of a coil
    const wraps = rest.map((_, i) => spans[i + 1].g.line !== spans[i].g.line);
    const links = rest.map((_, i) =>
      svgEl(
        'polyline',
        wraps[i]
          ? { fill: 'none', stroke: ctx.s.secondary, 'stroke-width': Math.max(1, fs * 0.02), 'stroke-dasharray': `${fs * 0.06} ${fs * 0.12}`, opacity: 0.35 }
          : { fill: 'none', stroke: ctx.s.secondary, 'stroke-width': Math.max(1.2, fs * 0.035), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' },
        svg,
      ),
    );
    const ringR = fs * 0.62;
    const ring = el('div', { style: { position: 'absolute', left: '0', top: '0', width: `${ringR * 2}px`, height: `${ringR * 2}px`, borderRadius: '50%', border: `${Math.max(1.5, fs * 0.04)}px solid ${ctx.s.secondary}`, pointerEvents: 'none' } }, ctx.root);
    const dot = el('div', { style: { position: 'absolute', left: '0', top: '0', width: '8px', height: '8px', borderRadius: '50%', background: ctx.s.secondary, pointerEvents: 'none' } }, ctx.root);

    const px = new Float64Array(n);
    const py = new Float64Array(n);
    const vx = new Float64Array(n);
    const vy = new Float64Array(n);
    const reset = () => {
      for (let i = 0; i < n; i++) {
        px[i] = home[i].x;
        py[i] = home[i].y;
        vx[i] = vy[i] = 0;
      }
    };
    reset();

    // auto: throw the head around a loop and bring it home, then rest
    const P = 7;
    const active = 3.4;
    const Ax = Math.min(W * 0.26, Math.max(W * 0.14, L.width * 0.3)) * (0.4 + 0.6 * k);
    const Ay = H * 0.26 * (0.4 + 0.6 * k);
    const auto = (t: number) => {
      const u = (((t % P) + P) % P) / active;
      if (u >= 1) return { x: home[0].x, y: home[0].y };
      const env = Math.sin(Math.PI * u);
      return { x: home[0].x + Ax * Math.sin(TAU * u) * (0.6 + 0.4 * env) - Ax * 0.5 * env, y: home[0].y - Ay * Math.sin(Math.PI * u) * (1 - 0.5 * Math.cos(TAU * u)) };
    };
    let tgt = { x: home[0].x, y: home[0].y, real: false };
    const SUB = 4;
    const K0 = 220;
    const D0 = 2 * Math.sqrt(K0);
    const ax = new Float64Array(n);
    const ay = new Float64Array(n);

    return {
      reset,
      step(t, dt) {
        const raw = pointerOrAuto(ctx, t, auto);
        const m = fs * 0.7;
        tgt = { x: clamp(raw.x, m, W - m), y: clamp(raw.y, m, H - m), real: raw.real };
        const h = dt / SUB;
        for (let s = 0; s < SUB; s++) {
          for (let i = 0; i < n; i++) {
            ax[i] = KH * (home[i].x - px[i]) - DAMP * 0.35 * vx[i];
            ay[i] = KH * (home[i].y - py[i]) - DAMP * 0.35 * vy[i];
          }
          ax[0] += K0 * (tgt.x - px[0]) - D0 * vx[0];
          ay[0] += K0 * (tgt.y - py[0]) - D0 * vy[0];
          for (let i = 0; i < n - 1; i++) {
            const dx = px[i + 1] - px[i];
            const dy = py[i + 1] - py[i];
            const d = Math.hypot(dx, dy) || 1e-3;
            const ux = dx / d;
            const uy = dy / d;
            const rv = (vx[i + 1] - vx[i]) * ux + (vy[i + 1] - vy[i]) * uy;
            const f = K * (d - rest[i]) + DAMP * rv;
            ax[i] += f * ux;
            ay[i] += f * uy;
            ax[i + 1] -= f * ux;
            ay[i + 1] -= f * uy;
          }
          for (let i = 0; i < n; i++) {
            vx[i] += ax[i] * h;
            vy[i] += ay[i] * h;
            px[i] += vx[i] * h;
            py[i] += vy[i] * h;
          }
        }
      },
      render() {
        for (let i = 0; i < n; i++) {
          const a = i > 0 ? i - 1 : i;
          const b = i < n - 1 ? i + 1 : i;
          let rot = 0;
          if (a !== b) {
            const cur = Math.atan2(py[b] - py[a], px[b] - px[a]);
            const hom = Math.atan2(home[b].y - home[a].y, home[b].x - home[a].x);
            let dd = cur - hom;
            while (dd > Math.PI) dd -= TAU;
            while (dd < -Math.PI) dd += TAU;
            rot = clamp((dd * 180) / Math.PI, -70, 70) * 0.8;
          }
          spans[i].el.style.transform = `translate(-50%,-50%) translate3d(${(px[i] - home[i].x).toFixed(2)}px,${(py[i] - home[i].y).toFixed(2)}px,0) rotate(${rot.toFixed(2)}deg)`;
        }
        // coils between char edges
        const gapR = fs * 0.4;
        for (let i = 0; i < n - 1; i++) {
          const dx = px[i + 1] - px[i];
          const dy = py[i + 1] - py[i];
          const d = Math.hypot(dx, dy) || 1e-3;
          const ux = dx / d;
          const uy = dy / d;
          const len = d - gapR * 2;
          if (len <= 1) {
            links[i].setAttribute('points', '');
            continue;
          }
          const sx = px[i] + ux * gapR;
          const sy = py[i] + uy * gapR;
          if (wraps[i]) {
            links[i].setAttribute('points', `${sx.toFixed(1)},${sy.toFixed(1)} ${(sx + ux * len).toFixed(1)},${(sy + uy * len).toFixed(1)}`);
            continue;
          }
          const coils = Math.max(2, Math.round(rest[i] / (fs * 0.2)));
          const amp = fs * 0.11 * clamp(Math.sqrt(Math.max(1, rest[i] - gapR * 2) / len), 0.25, 1.6);
          let pts = `${sx.toFixed(1)},${sy.toFixed(1)}`;
          for (let c = 1; c < coils * 2; c++) {
            const f = c / (coils * 2);
            const side = c % 2 ? 1 : -1;
            pts += ` ${(sx + ux * len * f - uy * amp * side).toFixed(1)},${(sy + uy * len * f + ux * amp * side).toFixed(1)}`;
          }
          pts += ` ${(sx + ux * len).toFixed(1)},${(sy + uy * len).toFixed(1)}`;
          links[i].setAttribute('points', pts);
          const stretch = d / Math.max(1, rest[i]);
          links[i].setAttribute('opacity', clamp(1.25 - Math.abs(stretch - 1) * 0.6, 0.45, 1).toFixed(2));
        }
        ring.style.transform = `translate3d(${(px[0] - ringR).toFixed(1)}px, ${(py[0] - ringR).toFixed(1)}px, 0)`;
        dot.style.transform = `translate3d(${(tgt.x - 4).toFixed(1)}px, ${(tgt.y - 4).toFixed(1)}px, 0)`;
        dot.style.opacity = tgt.real ? '1' : '0.5';
      },
    };
  },
};
export default impl;
