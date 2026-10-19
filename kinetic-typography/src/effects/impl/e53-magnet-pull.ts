import { rgba } from '../../engine/canvas';
import { el } from '../../engine/dom';
import { clamp, lerp, num, PALETTE, pointerOrAuto, smoothstep, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Fixed-step simulation in cycles of CYCLE seconds:
//   scatter (still) → attraction F ∝ 1/d toward the magnet (with damping and a little
//   swirl) → per-glyph springs pull glyphs into the word layout (centred on the magnet
//   when a real pointer drives it) → hold → release springs back to the scatter points.
// Dust dots follow the same field and settle on an orbit ring around the word.
const CYCLE = 7.5;
const T_PULL = 0.5;
const T_SNAP = 1.7;
const T_RELEASE = 6.0;

const impl: EffectImpl = {
  id: 'magnet-pull',
  defaults: { ...PALETTE.darkCoral },
  interactive: true,
  posterTime: 3.6,
  maxChars: 30,
  params: [
    { key: 'force', label: '磁力強度', type: 'range', min: 0.3, max: 2.5, step: 0.05, default: 1 },
    { key: 'dots', label: '碎點數量', type: 'range', min: 0, max: 160, step: 10, default: 70 },
    { key: 'damp', label: '阻尼', type: 'range', min: 2, max: 20, step: 0.5, default: 7.5 },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const force = num(ctx, 'force', 1) * Math.max(0.2, ctx.s.intensity);
    const D = num(ctx, 'damp', 7.5);
    const nDots = Math.round(num(ctx, 'dots', 70) * ctx.q);
    const { primary: fg, secondary: acc } = ctx.s;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.42, maxWidth: W * 0.78 });
    const fs = L.fontSize;
    const cx = W / 2;
    const cy = H / 2;
    const unit = Math.min(W, H);

    const wrap = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);
    const field = el('div', {
      style: { position: 'absolute', left: '0', top: '0', width: `${unit * 0.5}px`, height: `${unit * 0.5}px`, borderRadius: '50%', border: `1.5px solid ${acc}`, opacity: 0, pointerEvents: 'none' },
    }, wrap);
    const field2 = field.cloneNode() as HTMLDivElement;
    wrap.appendChild(field2);
    const core = el('div', {
      style: { position: 'absolute', left: '0', top: '0', width: `${unit * 0.035}px`, height: `${unit * 0.035}px`, borderRadius: '50%', background: acc, boxShadow: `0 0 ${unit * 0.04}px ${rgba(acc, 0.7)}` },
    }, wrap);

    // scatter positions: seeded, spread over the stage (kept within the safe area)
    const scatter = (i: number, salt: number, m = 0.06) => ({
      x: W * (m + (1 - 2 * m) * hash2(i, salt, ctx.seed)),
      y: H * (m + 0.02 + (1 - 2 * m - 0.04) * hash2(i, salt + 1, ctx.seed)),
      r: (hash2(i, salt + 2, ctx.seed) - 0.5) * 220,
    });

    const glyphs = L.chars.map((g, i) => {
      const s = scatter(i, 11, 0.2);
      const span = el('span', {
        text: g.ch,
        style: { position: 'absolute', left: '0', top: '0', font: L.font, lineHeight: '1', whiteSpace: 'pre', color: fg, willChange: 'transform' },
      }, wrap);
      return { span, tx: g.cx - cx, ty: g.cy - cy, sx: s.x, sy: s.y, sr: s.r, x: s.x, y: s.y, vx: 0, vy: 0, r: s.r, vr: 0, delay: hash2(i, 3, ctx.seed) * 0.5 };
    });
    // orbit ring for the dust (ellipse around the word)
    const rx = L.width / 2 + fs * 0.55;
    const ry = L.height / 2 + fs * 0.4;
    const dots = Array.from({ length: nDots }, (_, i) => {
      const s = scatter(i, 51);
      const size = Math.max(2, unit * (0.006 + 0.008 * hash2(i, 5, ctx.seed)));
      const d = el('div', {
        style: { position: 'absolute', left: '0', top: '0', width: `${size}px`, height: `${size}px`, marginLeft: `${-size / 2}px`, marginTop: `${-size / 2}px`, borderRadius: '50%', background: i % 4 === 0 ? fg : acc, willChange: 'transform' },
      }, wrap);
      const a = (i / Math.max(1, nDots)) * TAU;
      return { d, ax: Math.cos(a) * rx, ay: Math.sin(a) * ry, sx: s.x, sy: s.y, x: s.x, y: s.y, vx: 0, vy: 0, delay: hash2(i, 6, ctx.seed) * 0.6 };
    });

    const auto = (t: number) => ({ x: cx + Math.sin(t * 0.9) * W * 0.04, y: cy + Math.cos(t * 0.7) * H * 0.04 });
    let mag = { x: cx, y: cy, real: false };
    // word anchor follows the magnet when the pointer drives it (clamped to keep the word on stage)
    let ax = cx;
    let ay = cy;
    let phase = 0;
    let lastCycle = 0;

    const G = unit * unit * 3 * force; // 1/d attraction constant (px²/s²)
    const K = 60; // spring
    const KR = 50;

    const resetAll = () => {
      for (const p of glyphs) {
        p.x = p.sx;
        p.y = p.sy;
        p.vx = p.vy = 0;
        p.r = p.sr;
        p.vr = 0;
      }
      for (const p of dots) {
        p.x = p.sx;
        p.y = p.sy;
        p.vx = p.vy = 0;
      }
      ax = cx;
      ay = cy;
    };

    const attract = (p: { x: number; y: number; vx: number; vy: number }, w: number, swirl: number, dt: number) => {
      const dx = mag.x - p.x;
      const dy = mag.y - p.y;
      const d = Math.max(unit * 0.06, Math.hypot(dx, dy));
      const f = (G / d) * w;
      // radial pull + tangential swirl
      p.vx += ((dx / d) * f - (dy / d) * f * swirl) * dt;
      p.vy += ((dy / d) * f + (dx / d) * f * swirl) * dt;
    };

    return {
      reset() {
        resetAll();
        lastCycle = 0;
        phase = 0;
      },
      step(t, dt) {
        const c = Math.floor(t / CYCLE);
        if (c !== lastCycle) {
          lastCycle = c;
          resetAll();
        }
        phase = t - c * CYCLE;
        mag = pointerOrAuto(ctx, t, auto);
        const tx = mag.real ? clamp(mag.x, L.width / 2 + fs * 0.3, W - L.width / 2 - fs * 0.3) : cx;
        const ty = mag.real ? clamp(mag.y, L.height / 2 + fs * 0.3, H - L.height / 2 - fs * 0.3) : cy;
        const k = 1 - Math.exp(-dt * 6);
        ax = lerp(ax, tx, k);
        ay = lerp(ay, ty, k);
        const releasing = phase >= T_RELEASE;
        const damp = Math.exp(-dt * D);

        const update = (
          p: { x: number; y: number; vx: number; vy: number; sx: number; sy: number; delay: number },
          gx: number,
          gy: number,
          isDot: boolean,
        ) => {
          if (phase < T_PULL) return;
          if (releasing) {
            // springs back to the scatter points (soft, slightly underdamped)
            const kr = 18;
            p.vx += (kr * (p.sx - p.x)) * dt;
            p.vy += (kr * (p.sy - p.y)) * dt;
            p.vx *= Math.exp(-dt * 4.5);
            p.vy *= Math.exp(-dt * 4.5);
          } else {
            const snapW = smoothstep(T_SNAP + p.delay, T_SNAP + p.delay + 0.7, phase);
            if (snapW < 1) attract(p, 1 - snapW, isDot ? 0.55 : 0.3, dt);
            if (snapW > 0) {
              p.vx += K * snapW * (gx - p.x) * dt;
              p.vy += K * snapW * (gy - p.y) * dt;
            }
            p.vx *= damp;
            p.vy *= damp;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        };
        for (const p of glyphs) {
          update(p, ax + p.tx, ay + p.ty, false);
          if (phase >= T_PULL) {
            const target = releasing ? p.sr : 0;
            const wR = releasing ? 8 : KR * smoothstep(T_SNAP + p.delay - 0.4, T_SNAP + p.delay + 0.4, phase);
            p.vr += (wR * (target - p.r) - p.vx * 0.02) * dt;
            p.vr *= Math.exp(-dt * 6);
            p.r += p.vr * dt;
          }
        }
        for (const p of dots) update(p, ax + p.ax, ay + p.ay, true);
      },
      render() {
        for (const p of glyphs) {
          // scattered glyphs are smaller; they grow as they lock into the word
          const grow = smoothstep(T_SNAP + p.delay - 0.2, T_SNAP + p.delay + 0.6, phase) * (1 - smoothstep(T_RELEASE, T_RELEASE + 0.9, phase));
          const s = 0.58 + 0.42 * grow;
          p.span.style.transform = `translate(-50%,-50%) translate3d(${p.x}px,${p.y}px,0) rotate(${p.r}deg) scale(${s})`;
          p.span.style.color = grow > 0.02 ? fg : rgba(fg, 0.75);
        }
        for (const p of dots) p.d.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
        // magnet visuals: pulsing field rings while attracting
        const pulling = phase >= T_PULL && phase < T_RELEASE;
        const strength = pulling ? 1 - smoothstep(T_SNAP + 0.3, T_SNAP + 1.3, phase) : 0;
        const mx = mag.real ? mag.x : ax;
        const my = mag.real ? mag.y : ay;
        [field, field2].forEach((f, i) => {
          const ph = ((phase * 1.6 + i * 0.5) % 1);
          const s = 1 - ph * 0.85;
          f.style.transform = `translate3d(${mx - unit * 0.25}px,${my - unit * 0.25}px,0) scale(${s})`;
          f.style.opacity = String(strength * ph * 0.8 + (mag.real ? 0.15 * (1 - ph) : 0));
        });
        const cs = 0.4 + 0.6 * Math.max(strength, mag.real ? 0.7 : 0);
        core.style.transform = `translate3d(${mx - unit * 0.0175}px,${my - unit * 0.0175}px,0) scale(${cs})`;
        core.style.opacity = String(Math.max(strength, mag.real ? 0.9 : 0.25));
      },
    };
  },
};
export default impl;
