import { rgba } from '../../engine/canvas';
import { el, textBlock } from '../../engine/dom';
import { clamp, ease, num, PALETTE } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Pure-function squash & stretch with volume preservation (scaleX = 1/scaleY):
// anticipation squash → stretched take-off → parabolic hops of decaying height
// (each landing squashes proportionally to impact speed) → damped wobble → rest.
// The shadow shrinks with height; landings kick out small dust strokes.
interface Seg {
  t0: number;
  t1: number;
  kind: 'rest' | 'crouch' | 'hop' | 'land' | 'settle';
  h?: number;
  amp?: number;
}

const impl: EffectImpl = {
  id: 'text-squeeze',
  defaults: { ...PALETTE.violet },
  posterTime: 0.62,
  maxChars: 30,
  params: [
    { key: 'squash', label: '壓扁程度', type: 'range', min: 0.1, max: 0.5, step: 0.02, default: 0.32 },
    { key: 'height', label: '彈跳高度', type: 'range', min: 0.1, max: 0.45, step: 0.01, default: 0.3, hint: '相對於舞台高度' },
    { key: 'bounces', label: '回彈次數', type: 'range', min: 1, max: 4, step: 1, default: 3 },
  ],
  create(ctx): EffectRuntime {
    const k = clamp(ctx.s.intensity, 0, 2);
    const SQ = num(ctx, 'squash', 0.32) * Math.min(1.3, k);
    const bounces = Math.round(num(ctx, 'bounces', 3));
    const sxMax = 1 / (1 - SQ);
    const L = layoutText(ctx, ctx.text, { maxWidth: (ctx.width * 0.84) / sxMax, maxHeight: ctx.height * 0.36, cy: ctx.height * 0.6, lineHeight: 1.1 });
    const fs = L.fontSize;
    const groundY = L.y + L.height - (L.lineHeight - fs) / 2 - fs * 0.04;
    const H0 = Math.min(ctx.height * num(ctx, 'height', 0.3) * k, L.y - ctx.height * 0.04);

    // shadow + dust (behind text)
    const shadow = el('div', {
      style: { position: 'absolute', left: L.x + L.width / 2, top: groundY + fs * 0.06, width: L.width * 0.95, height: Math.max(6, fs * 0.16), borderRadius: '50%', background: rgba(ctx.s.primary, 0.28), transform: 'translate(-50%,-50%)' },
    }, ctx.root);
    const dust = [-1, 1].flatMap((side) =>
      [0, 1, 2].map((j) => {
        const d = el('div', { style: { position: 'absolute', left: L.x + L.width / 2 + side * L.width * 0.52, top: groundY - fs * (0.05 + j * 0.16), width: fs * 0.28, height: Math.max(2, fs * 0.05), borderRadius: fs, background: ctx.s.secondary, opacity: 0, transformOrigin: side > 0 ? '0 50%' : '100% 50%' } }, ctx.root);
        return { d, side, j };
      }),
    );
    const { block } = textBlock(ctx.root, L, { color: ctx.s.primary });
    block.style.transformOrigin = `50% ${groundY - L.y}px`;
    block.style.willChange = 'transform';

    // build the schedule
    const segs: Seg[] = [];
    let t = 0;
    const push = (kind: Seg['kind'], dur: number, extra: Partial<Seg> = {}) => {
      segs.push({ t0: t, t1: t + dur, kind, ...extra });
      t += dur;
    };
    push('rest', 0.3);
    push('crouch', 0.42);
    const Thop0 = 0.78;
    for (let b = 0; b < bounces; b++) {
      const h = H0 * Math.pow(0.34, b);
      push('hop', Thop0 * Math.sqrt(h / Math.max(1, H0)) + (b === 0 ? 0 : 0.02), { h });
      if (b < bounces - 1) push('land', 0.13, { amp: SQ * Math.pow(0.62, b) });
    }
    push('settle', 0.95, { amp: SQ * Math.pow(0.62, bounces - 1) * 0.9 });
    push('rest', 0.55);
    const cycle = t;
    const crouchE = ease('power2.out');
    const firstLand = segs.find((s) => s.kind === 'land' || s.kind === 'settle')!.t0;

    return {
      render(time) {
        const u = ((time % cycle) + cycle) % cycle;
        const s = segs.find((x) => u < x.t1) ?? segs[segs.length - 1];
        const p = clamp((u - s.t0) / (s.t1 - s.t0), 0, 1);
        let y = 0;
        let sy = 1;
        let rot = 0;
        switch (s.kind) {
          case 'crouch':
            // slow squeeze, tiny tremble at the bottom
            sy = 1 - SQ * crouchE(p) + (p > 0.8 ? Math.sin(p * 90) * 0.008 : 0);
            break;
          case 'hop': {
            const h = s.h ?? 0;
            y = 4 * h * p * (1 - p);
            const v = Math.abs(1 - 2 * p); // normalised vertical speed
            const st = SQ * 1.1 * (h / Math.max(1, H0)) ** 0.6;
            sy = 1 + st * v ** 1.6;
            // first take-off: still unwinding from the crouch
            if (s === segs[2] && p < 0.12) sy = 1 - SQ + (1 + st - (1 - SQ)) * ease('expo.out')(p / 0.12);
            rot = (h === H0 ? 4 : 1.5) * k * Math.sin(p * Math.PI * 2);
            break;
          }
          case 'land':
            sy = 1 - (s.amp ?? 0) * Math.sin(Math.PI * p);
            break;
          case 'settle': {
            const a = s.amp ?? 0;
            const tt = p * (s.t1 - s.t0);
            sy = 1 - a * Math.exp(-5.5 * tt) * Math.sin(tt * 17 + 0.0);
            break;
          }
          default:
            sy = 1;
        }
        const sx = 1 / Math.max(0.2, sy);
        block.style.transform = `translate3d(0,${-y}px,0) rotate(${rot}deg) scale(${sx},${sy})`;
        const hn = H0 > 0 ? y / H0 : 0;
        shadow.style.transform = `translate(-50%,-50%) scale(${(1 - 0.55 * hn) * Math.min(1.5, sx)},1)`;
        shadow.style.opacity = String(1 - 0.6 * hn);
        // dust after each landing
        let since = Infinity;
        let power = 0;
        for (const x of segs) {
          if ((x.kind === 'land' || x.kind === 'settle') && u >= x.t0) {
            since = u - x.t0;
            power = (x.amp ?? 0) / Math.max(0.01, SQ);
          }
        }
        if (u < firstLand) since = Infinity;
        const dp = clamp(since / 0.45, 0, 1);
        for (const { d, side, j } of dust) {
          const vis = since < 0.45 ? (1 - dp) * power : 0;
          d.style.opacity = String(vis);
          d.style.transform = `translate(${side * fs * (0.1 + 0.5 * ease('power2.out')(dp)) * (1 - j * 0.2)}px,0) scaleX(${0.3 + dp})`;
        }
      },
    };
  },
};
export default impl;
