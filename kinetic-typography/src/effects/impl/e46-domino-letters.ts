import { rgba } from '../../engine/canvas';
import { el } from '../../engine/dom';
import { bool, clamp, ease, num, PALETTE } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Each glyph box pivots on its bottom-right corner. Glyph i accelerates (power2.in)
// until its top-right corner reaches glyph i+1 (θhit = asin(gap / h)), which starts
// i+1; afterwards i keeps rotating but never passes through i+1 (contact angle vs.
// i+1's angle is pre-solved geometrically into a lookup table, last glyph lies flat).
// Then the row stands back up in sequence (first glyph first, so each one clears the
// space the next one returns to). Pure function of time.
const DEG = 180 / Math.PI;
const LUT = 48;

interface Box {
  el: HTMLDivElement;
  w: number;
  h: number;
  px: number; // pivot (bottom-right) in stage px
  py: number;
  hit: number; // rad
  rest: number; // rad
  start: number; // fall start (s)
  dur: number; // time to reach hit angle
  lut: number[]; // contact angle vs. next glyph angle
}

/** Is point (x,y) inside box b rotated by a (about its pivot)? */
function inside(b: Box, a: number, x: number, y: number) {
  const dx = x - b.px;
  const dy = y - b.py;
  // inverse rotate (clockwise rotation by a in screen space)
  const c = Math.cos(-a);
  const s = Math.sin(-a);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return lx >= -b.w && lx <= 0.5 && ly >= -b.h && ly <= 0.5;
}

const impl: EffectImpl = {
  id: 'domino-letters',
  defaults: { ...PALETTE.paperInk },
  posterTime: 2.1,
  maxChars: 30,
  hide: ['tracking'],
  params: [
    { key: 'gap', label: '骨牌間距', type: 'range', min: 0.15, max: 0.9, step: 0.05, default: 0.42, unit: 'em' },
    { key: 'tiles', label: '骨牌底塊', type: 'toggle', default: false },
    { key: 'ball', label: '起始小球', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const gapEm = num(ctx, 'gap', 0.42);
    const tiles = bool(ctx, 'tiles', false);
    const useBall = bool(ctx, 'ball', true);
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const spd = clamp(ctx.s.intensity, 0.3, 2);
    // the last glyph of a line ends up lying flat to the right of its pivot (≈ 0.9 em),
    // so reserve that room and shift the block left accordingly
    const opts = { tracking: gapEm, maxHeight: ctx.height * 0.5, maxWidth: ctx.width * 0.8, lineHeight: 1.5, cy: ctx.height * 0.5 };
    let L = layoutText(ctx, ctx.text, opts);
    for (let k = 0; k < 3; k++) {
      const extra = L.fontSize * 0.95;
      if (L.width + extra <= ctx.width * 0.88) break;
      L = layoutText(ctx, ctx.text, { ...opts, maxWidth: Math.max(ctx.width * 0.3, ctx.width * 0.88 - extra) });
    }
    L = layoutText(ctx, ctx.text, { ...opts, maxWidth: Math.max(ctx.width * 0.3, Math.min(opts.maxWidth, ctx.width * 0.88 - L.fontSize * 0.95)), cx: ctx.width / 2 - L.fontSize * 0.4 });
    const fs = L.fontSize;
    const H = fs * 0.92;

    const wrap = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);
    const lines = L.lines.map((ln) => ln.glyphs.filter((g) => !g.space)).filter((l) => l.length);
    const chains: Box[][] = [];
    // ground lines
    for (const ln of lines) {
      const g0 = ln[0];
      const gl = ln[ln.length - 1];
      const baseY = g0.cy + H / 2;
      el('div', {
        style: { position: 'absolute', left: `${g0.x - fs * 0.5}px`, top: `${baseY}px`, width: `${gl.x + gl.w - g0.x + fs * 1.6}px`, height: `${Math.max(1.5, fs * 0.03)}px`, background: rgba(fg, 0.85), borderRadius: '2px' },
      }, wrap);
    }
    lines.forEach((ln) => {
      const chain: Box[] = ln.map((g) => {
        const w = Math.max(g.w * (tiles ? 1 : 0.92), fs * 0.3);
        const box = el('div', {
          style: {
            position: 'absolute',
            left: `${g.cx - w / 2}px`,
            top: `${g.cy - H / 2}px`,
            width: `${w}px`,
            height: `${H}px`,
            transformOrigin: '100% 100%',
            willChange: 'transform',
            borderRadius: tiles ? `${fs * 0.08}px` : '0',
            background: tiles ? fg : 'transparent',
          },
        }, wrap);
        el('span', {
          text: g.ch,
          style: {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%,-50%) scale(${tiles ? 0.72 : 1})`,
            font: L.font,
            lineHeight: '1',
            whiteSpace: 'pre',
            color: tiles ? bg : fg,
          },
        }, box);
        return { el: box, w, h: H, px: g.cx + w / 2, py: g.cy + H / 2, hit: 0, rest: Math.PI / 2, start: 0, dur: 0, lut: [] as number[] };
      });
      // contact angle of b against nx (at angle an): smallest a ≥ hit where a top corner of b touches nx
      const contact = (b: Box, nx: Box, an: number) => {
        let a = b.hit;
        for (; a < Math.PI / 2; a += 0.004) {
          const trx = b.px + b.h * Math.sin(a);
          const try_ = b.py - b.h * Math.cos(a);
          const tlx = b.px - b.w * Math.cos(a) + b.h * Math.sin(a);
          const tly = b.py - b.w * Math.sin(a) - b.h * Math.cos(a);
          if (inside(nx, an, trx, try_) || inside(nx, an, tlx, tly)) break;
        }
        return Math.max(b.hit, Math.min(Math.PI / 2, a));
      };
      // the last lies flat; each other glyph rests against the next one (solved backwards).
      // A lookup table maps the next glyph's angle to this glyph's contact angle.
      for (let i = chain.length - 1; i >= 0; i--) {
        const b = chain[i];
        const nx = chain[i + 1];
        const gap = nx ? nx.px - nx.w - b.px : Infinity;
        b.hit = nx ? Math.asin(clamp(gap / b.h, 0, 1)) : Math.PI / 2;
        if (!nx) continue;
        b.lut = Array.from({ length: LUT }, (_, k) => contact(b, nx, (nx.rest * k) / (LUT - 1)));
        b.rest = b.lut[LUT - 1];
      }
      chains.push(chain);
    });

    // timing
    const ballR = fs * 0.14;
    const T0 = useBall ? 1.05 : 0.7; // first contact
    let t = T0;
    for (const chain of chains) {
      chain.forEach((b, i) => {
        b.start = t;
        // first tip is slow, the wave accelerates and reaches a steady speed
        b.dur = (i === 0 ? 0.5 : 0.24 - Math.min(0.08, i * 0.015)) / spd;
        if (b.hit >= Math.PI / 2 - 1e-3) b.dur = 0.42 / spd; // last: falls all the way
        t = b.start + b.dur;
      });
    }
    const fallEnd = t + 0.35 / spd;
    const HOLD = 1.0;
    const upStart = fallEnd + HOLD;
    const all = chains.flat();
    const UP_STAG = 0.075 / spd;
    const UP_DUR = 0.55;
    const upEnd = upStart + (all.length - 1) * UP_STAG + UP_DUR;
    const cycle = upEnd + 1.25;

    const ball = useBall
      ? el('div', { style: { position: 'absolute', left: '0', top: '0', width: `${ballR * 2}px`, height: `${ballR * 2}px`, borderRadius: '50%', background: acc } }, wrap)
      : null;
    const first = chains[0][0];
    const ballX1 = first.px - first.w - ballR;
    const ballX0 = Math.min(-ballR * 2, ballX1 - ctx.width * 0.35);
    const ballY = first.py - ballR;

    const inE = ease('power2.in');
    const upE = ease('back.out(2.2)');
    const landE = ease('bounce.out');

    // angles of one chain at time tt, solved from the last glyph backwards (radians)
    const angles = (chain: Box[], tt: number, gi0: number, out: number[]) => {
      for (let j = chain.length - 1; j >= 0; j--) {
        const b = chain[j];
        const last = j === chain.length - 1;
        let a: number;
        if (tt < b.start) a = 0;
        else if (tt < b.start + b.dur) {
          const p = (tt - b.start) / b.dur;
          a = last ? b.rest * landE(p) : b.hit * inE(p);
        } else if (last) a = b.rest;
        else {
          // keeps falling (free rotation) but can't pass through the next glyph
          const s = tt - b.start - b.dur;
          const free = b.hit + ((2 * b.hit) / b.dur) * s + 14 * spd * spd * s * s;
          const an = out[j + 1];
          const nx = chain[j + 1];
          const k = clamp(an / Math.max(1e-6, nx.rest), 0, 1) * (LUT - 1);
          const i0 = Math.floor(k);
          const i1 = Math.min(LUT - 1, i0 + 1);
          const lim = b.lut[i0] + (b.lut[i1] - b.lut[i0]) * (k - i0);
          a = Math.min(free, lim, b.rest);
        }
        // stand back up in sequence, first glyph first (it clears the next one's space)
        const rS = upStart + (gi0 + j) * UP_STAG;
        if (tt >= rS) a = Math.min(a, b.rest) * (1 - upE(clamp((tt - rS) / UP_DUR, 0, 1)));
        out[j] = a;
      }
    };
    const buf: number[] = [];

    return {
      render(time) {
        const tt = time % cycle;
        let gi = 0;
        for (const chain of chains) {
          angles(chain, tt, gi, buf);
          for (let j = 0; j < chain.length; j++) chain[j].el.style.transform = `rotate(${buf[j] * DEG}deg)`;
          gi += chain.length;
        }
        if (ball) {
          // ball rolls in, taps the first glyph, bounces back a little and fades
          let x: number;
          let op = 1;
          if (tt < T0) x = ballX0 + (ballX1 - ballX0) * ease('power1.in')(clamp((tt - 0.15) / (T0 - 0.15), 0, 1));
          else {
            const p = clamp((tt - T0) / 0.6, 0, 1);
            x = ballX1 - fs * 0.35 * ease('power2.out')(p);
            op = tt > upEnd ? 0 : 1;
          }
          if (tt > upEnd - 0.3) op = clamp(1 - (tt - (upEnd - 0.3)) / 0.3, 0, 1);
          const rot = ((x - ballX0) / ballR) * DEG;
          ball.style.transform = `translate(${x - ballR}px, ${ballY - ballR}px) rotate(${rot}deg)`;
          ball.style.opacity = String(tt < 0.15 ? 0 : op);
        }
      },
    };
  },
};
export default impl;
