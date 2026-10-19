import { rgba } from '../../engine/canvas';
import { el } from '../../engine/dom';
import { clamp, mod, num, PALETTE, smoothstep, str } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fontString, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Fixed-step physics. Gravity flips direction every HALF seconds, with a small per-glyph
// delay so the flip travels across the word. Each glyph falls toward its rest slot on
// the ceiling / floor, bounces with restitution e and comes to rest (air drag + a rest
// threshold, so it always stops). Rotation is tied to the height (one full turn from
// floor to ceiling), so a glyph is upright whenever it rests.
const impl: EffectImpl = {
  id: 'gravity-flip',
  defaults: { ...PALETTE.darkPink },
  posterTime: 2.2,
  maxChars: 30,
  params: [
    { key: 'bounce', label: '回彈係數', type: 'range', min: 0.1, max: 0.8, step: 0.05, default: 0.5 },
    { key: 'gravity', label: '重力', type: 'range', min: 0.4, max: 2, step: 0.05, default: 1, unit: '×' },
    { key: 'spin', label: '空中翻轉', type: 'select', default: 'turn', options: [{ value: 'turn', label: '翻一圈' }, { value: 'none', label: '不翻轉' }] },
  ],
  create(ctx): EffectRuntime {
    const e = num(ctx, 'bounce', 0.5);
    const gMul = num(ctx, 'gravity', 1) * Math.max(0.2, ctx.s.intensity);
    const spinMode = str(ctx, 'spin', 'turn');
    const { primary: fg, secondary: acc } = ctx.s;
    const W = ctx.width;
    const H = ctx.height;
    const margin = H * 0.1;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.26, maxWidth: W * 0.86, lineHeight: 1.12, cy: H / 2 });
    const fs = L.fontSize;
    const nLines = L.lines.length;
    const half = fs * 0.5;
    const floorY = H - margin; // floor line
    const ceilY = margin;
    const G = H * 4.2 * gMul; // px / s²
    const HALF = 3.0;
    const LEAD = 0.7;
    const DELAY = Math.min(0.06, 1.2 / Math.max(1, L.chars.length));

    const wrap = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);
    // floor & ceiling
    const mkRail = (y: number) =>
      el('div', { style: { position: 'absolute', left: `${W * 0.06}px`, right: `${W * 0.06}px`, top: `${y}px`, height: `${Math.max(1.5, fs * 0.03)}px`, background: rgba(fg, 0.3) } }, wrap);
    const floor = mkRail(floorY);
    const ceil = mkRail(ceilY - Math.max(1.5, fs * 0.03));
    // gravity indicator
    const ind = el('div', {
      style: { position: 'absolute', right: `${W * 0.06}px`, top: '50%', font: fontString(clamp(fs * 0.22, 10, 22), ctx.font.mono, 700), color: acc, letterSpacing: '0.1em', transform: 'translateY(-50%)', whiteSpace: 'pre' },
    }, wrap);

    const bodies = L.chars.map((g, i) => {
      const lineFromBottom = nLines - 1 - g.line;
      const restDown = floorY - half - lineFromBottom * L.lineHeight * 0.92;
      const restUp = ceilY + half + g.line * L.lineHeight * 0.92;
      const span = el('span', {
        text: g.ch,
        style: { position: 'absolute', left: `${g.cx}px`, top: '0', font: L.font, lineHeight: '1', whiteSpace: 'pre', color: fg, willChange: 'transform' },
      }, wrap);
      const dir = hash2(i, 2, ctx.seed) < 0.5 ? -1 : 1;
      return { g, span, restDown, restUp, y: restDown, v: 0, squash: 0, dir, delay: (g.x - L.x) / Math.max(1, L.width) * DELAY * L.chars.length * 0.6 + hash2(i, 1, ctx.seed) * 0.12, resting: true };
    });

    const gravityAt = (t: number, delay: number) => {
      const u = t - LEAD - delay;
      if (u < 0) return 1;
      return Math.floor(u / HALF) % 2 === 0 ? -1 : 1; // -1 = up
    };

    let simT = 0;
    return {
      reset() {
        simT = 0;
        for (const b of bodies) {
          b.y = b.restDown;
          b.v = 0;
          b.squash = 0;
          b.resting = true;
        }
      },
      step(t, dt) {
        simT = t;
        for (const b of bodies) {
          const gd = gravityAt(t, b.delay);
          const lo = b.restUp; // top-most allowed y
          const hi = b.restDown; // bottom-most allowed y
          if (b.resting) {
            const atFloor = Math.abs(b.y - hi) < 0.5;
            if ((gd > 0 && atFloor) || (gd < 0 && Math.abs(b.y - lo) < 0.5)) {
              b.squash *= Math.exp(-dt * 14);
              continue;
            }
            b.resting = false;
            // tiny seeded kick so glyphs don't move in lockstep
            b.v = gd * G * 0.02 * (0.5 + hash2(b.g.i, Math.floor(t / HALF), ctx.seed));
          }
          b.v += gd * G * dt;
          b.v *= Math.exp(-dt * 0.6); // air drag
          b.y += b.v * dt;
          if (b.y > hi) {
            b.y = hi;
            const imp = Math.abs(b.v);
            b.v = -b.v * e;
            b.squash = Math.max(b.squash, clamp(imp / (G * 0.6), 0, 1));
            if (Math.abs(b.v) < G * 0.04) {
              b.v = 0;
              b.resting = gd > 0;
            }
          } else if (b.y < lo) {
            b.y = lo;
            const imp = Math.abs(b.v);
            b.v = -b.v * e;
            b.squash = Math.max(b.squash, clamp(imp / (G * 0.6), 0, 1));
            if (Math.abs(b.v) < G * 0.04) {
              b.v = 0;
              b.resting = gd < 0;
            }
          }
          b.squash *= Math.exp(-dt * 14);
        }
      },
      render() {
        const gNow = gravityAt(simT, 0);
        ind.textContent = gNow < 0 ? '▲ G' : '▼ G';
        floor.style.background = rgba(gNow > 0 ? acc : fg, gNow > 0 ? 0.9 : 0.3);
        ceil.style.background = rgba(gNow < 0 ? acc : fg, gNow < 0 ? 0.9 : 0.3);
        for (const b of bodies) {
          const p = clamp((b.restDown - b.y) / Math.max(1, b.restDown - b.restUp), 0, 1); // 0 floor → 1 ceiling
          const rot = spinMode === 'turn' ? b.dir * 360 * smoothstep(0.12, 0.88, p) : 0;
          const sq = b.squash * 0.35;
          // squash along the travel axis (vertical)
          const speed = Math.min(1, Math.abs(b.v) / (G * 0.5));
          const sy = (1 - sq) * (1 + speed * 0.12);
          const sx = (1 + sq * 0.8) / (1 + speed * 0.06);
          b.span.style.transform = `translate(-50%,-50%) translate3d(0,${b.y}px,0) rotate(${mod(rot, 360)}deg) scale(${sx},${sy})`;
          b.span.style.color = b.resting ? fg : acc;
        }
      },
    };
  },
};
export default impl;
