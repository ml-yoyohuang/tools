import { rgba } from '../../engine/canvas';
import { el } from '../../engine/dom';
import { clamp, mod, num, PALETTE } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Per glyph, a looping schedule in local time u = (t − i·stagger) mod period:
// crouch → parabolic jump → landing squash → two decaying rebounds → rest.
// Airborne height is a real parabola 4h·p(1−p); squash/stretch follows the
// vertical speed. The shadow shrinks and fades with height.
interface Seg {
  kind: 'air' | 'squash';
  dur: number;
  h: number; // jump height (air) or squash amount (squash)
}

const impl: EffectImpl = {
  id: 'letter-bounce',
  defaults: { ...PALETTE.pink },
  posterTime: 0.95,
  maxChars: 40,
  params: [
    { key: 'height', label: '跳躍高度', type: 'range', min: 0.3, max: 2, step: 0.05, default: 1, unit: '×' },
    { key: 'stagger', label: '錯開時間', type: 'range', min: 0.03, max: 0.3, step: 0.01, default: 0.09, unit: 's' },
    { key: 'rest', label: '休息時間', type: 'range', min: 0, max: 2, step: 0.1, default: 0.7, unit: 's' },
  ],
  create(ctx): EffectRuntime {
    const k = clamp(ctx.s.intensity, 0, 2);
    const hMul = num(ctx, 'height', 1) * k;
    const stagger = num(ctx, 'stagger', 0.09);
    const rest = num(ctx, 'rest', 0.7);
    const { primary: fg, secondary: acc } = ctx.s;
    const lines0 = ctx.text.split(/[／/\n]/).length;
    // leave head-room above each line for the jump
    const L = layoutText(ctx, ctx.text, { maxHeight: ctx.height * (lines0 > 1 ? 0.5 : 0.42), maxWidth: ctx.width * 0.84, lineHeight: 1.9, cy: ctx.height * 0.56 });
    const fs = L.fontSize;
    const H = fs * 0.85 * hMul;

    const segs: Seg[] = [
      { kind: 'squash', dur: 0.14, h: 0.22 }, // crouch (anticipation)
      { kind: 'air', dur: 0.56, h: 1 },
      { kind: 'squash', dur: 0.12, h: 0.32 },
      { kind: 'air', dur: 0.26, h: 0.2 },
      { kind: 'squash', dur: 0.08, h: 0.14 },
      { kind: 'air', dur: 0.13, h: 0.05 },
      { kind: 'squash', dur: 0.06, h: 0.05 },
    ];
    const active = segs.reduce((a, s) => a + s.dur, 0);
    const period = active + rest + 0.25;

    const items = L.chars.map((g, i) => {
      const shadow = el('div', {
        style: {
          position: 'absolute',
          left: `${g.cx - fs * 0.38}px`,
          top: `${g.cy + fs * 0.47}px`,
          width: `${fs * 0.76}px`,
          height: `${fs * 0.12}px`,
          borderRadius: '50%',
          background: rgba(fg, 0.28),
          willChange: 'transform, opacity',
        },
      }, ctx.root);
      const span = el('span', {
        text: g.ch,
        style: {
          position: 'absolute',
          left: `${g.cx}px`,
          top: `${g.cy}px`,
          font: L.font,
          lineHeight: '1',
          whiteSpace: 'pre',
          color: fg,
          transformOrigin: '50% 92%',
          willChange: 'transform',
        },
      }, ctx.root);
      const tilt = (hash2(i, 1, ctx.seed) - 0.5) * 16;
      return { span, shadow, i, tilt };
    });

    // y (px, up positive), scaleX, scaleY, airborne progress for a local time u
    const pose = (u: number) => {
      let acc0 = 0;
      for (const s of segs) {
        if (u < acc0 + s.dur) {
          const p = (u - acc0) / s.dur;
          if (s.kind === 'air') {
            const y = 4 * s.h * H * p * (1 - p);
            const v = Math.abs(1 - 2 * p) * Math.sqrt(s.h); // normalised vertical speed
            const st = 1 + 0.16 * v * k;
            return { y, sx: 1 / Math.sqrt(st), sy: st, air: s.h * (1 - Math.abs(1 - 2 * p)) };
          }
          const q = Math.sin(p * Math.PI) * s.h * Math.max(0.2, k);
          return { y: 0, sx: 1 + q * 0.6, sy: 1 - q, air: 0 };
        }
        acc0 += s.dur;
      }
      return { y: 0, sx: 1, sy: 1, air: 0 };
    };

    return {
      render(t) {
        for (const it of items) {
          const u = mod(t - it.i * stagger, period);
          const p = pose(u);
          const tilt = it.tilt * p.air;
          it.span.style.transform = `translate(-50%,-50%) translateY(${-p.y}px) rotate(${tilt}deg) scale(${p.sx},${p.sy})`;
          it.span.style.color = p.air > 0.55 ? acc : fg;
          const hn = clamp(p.y / Math.max(1, H), 0, 1);
          it.shadow.style.transform = `scale(${(1 - 0.55 * hn) * p.sx}, ${1 - 0.4 * hn})`;
          it.shadow.style.opacity = String(1 - 0.7 * hn);
        }
      },
    };
  },
};
export default impl;
