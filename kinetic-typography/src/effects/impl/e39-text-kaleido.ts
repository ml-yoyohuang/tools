import { rgba, stageCanvas } from '../../engine/canvas';
import { bool, C, clamp, mod, num, pointerOrAuto, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { asLines, fontString, graphemes, isSpace } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// True kaleidoscope: the "object cell" is one wedge of angle α = 2π/N in which text
// moves (a big drifting word, an outlined copy, and glyphs streaming outward).
// The wedge is clipped and re-drawn N times; every odd copy is mirrored
// (rotate(α)·scale(1,−1)) so neighbouring wedges meet at mirror seams.
// The pointer (or an automatic path) pushes the object cell around.
const impl: EffectImpl = {
  id: 'text-kaleido',
  defaults: { background: C.ink, primary: C.lime, secondary: C.violet },
  interactive: true,
  posterTime: 3,
  maxChars: 24,
  hide: ['tracking'],
  params: [
    { key: 'segments', label: '鏡面數', type: 'range', min: 6, max: 16, step: 2, default: 10 },
    { key: 'spin', label: '旋轉速度', type: 'range', min: -1, max: 1, step: 0.05, default: 0.25 },
    { key: 'center', label: '中央顯示原文', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const N = Math.round(clamp(num(ctx, 'segments', 10), 6, 16) / 2) * 2;
    const alpha = TAU / N;
    const spin = num(ctx, 'spin', 0.25);
    const showCenter = bool(ctx, 'center', true);
    const k = ctx.s.intensity;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.hypot(W, H) / 2 + 4;
    const Rv = Math.min(W, H) / 2; // radius of the inscribed circle (sizes relate to it)
    const word = asLines(ctx.text).replace(/\n/g, ' ');
    const glyphs = graphemes(word).filter((g) => !isSpace(g));
    const sc = stageCanvas(ctx);
    const g = sc.g;

    // big word sized relative to the wedge
    g.font = fontString(100, ctx.font.sans, 900);
    const w100 = Math.max(1, g.measureText(word).width);
    const bigFs = clamp((Rv * 1.3 * 100) / w100, Rv * 0.09, Rv * 0.45) * ctx.s.fontScale;
    const smallFs = Rv * 0.13 * ctx.s.fontScale;
    const nStream = Math.round(clamp(8 * ctx.q, 4, 10));
    const stream = Array.from({ length: nStream }, (_, i) => ({
      ch: glyphs[i % Math.max(1, glyphs.length)] ?? '•',
      r0: hash2(i, 1, ctx.seed),
      a: 0.15 + hash2(i, 2, ctx.seed) * 0.7, // fraction of the wedge angle
      v: 0.07 + hash2(i, 3, ctx.seed) * 0.06, // radial speed (fraction of R per s)
      sz: 0.6 + hash2(i, 4, ctx.seed) * 0.9,
      rot: (hash2(i, 5, ctx.seed) - 0.5) * 4,
      col: i % 3 === 0 ? acc : fg,
    }));
    const auto = (t: number) => ({ x: cx + Rv * 0.35 * Math.sin(t * 0.37), y: cy + Rv * 0.3 * Math.sin(t * 0.23 + 1) });
    let off = { x: 0, y: 0 };

    const source = (t: number) => {
      // colour field: a translucent band sweeping through the cell
      g.save();
      g.rotate(alpha * 0.5 + 0.6 * Math.sin(t * 0.21));
      g.fillStyle = rgba(acc, 0.22);
      g.fillRect(Rv * (0.2 + 0.25 * Math.sin(t * 0.31)), -Rv * 0.08, R, Rv * 0.16);
      g.restore();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      // big drifting word
      const r1 = Rv * (0.55 + 0.25 * Math.sin(t * 0.29)) * k;
      const a1 = alpha * (0.5 + 0.35 * Math.sin(t * 0.43));
      g.save();
      g.translate(Math.cos(a1) * r1 + off.x, Math.sin(a1) * r1 + off.y);
      g.rotate(t * 0.35 + 0.4 * Math.sin(t * 0.17));
      g.font = fontString(bigFs, ctx.font.sans, 900);
      g.fillStyle = fg;
      g.fillText(word, 0, 0);
      g.restore();
      // outlined echo, larger, counter-rotating
      const r2 = Rv * (0.95 + 0.3 * Math.sin(t * 0.19 + 2)) * k;
      g.save();
      g.translate(Math.cos(alpha * 0.3) * r2 - off.x * 0.6, Math.sin(alpha * 0.3) * r2 - off.y * 0.6);
      g.rotate(-t * 0.22);
      g.font = fontString(bigFs * 1.5, ctx.font.sans, 900);
      g.lineWidth = Math.max(1.2, bigFs * 0.03);
      g.strokeStyle = acc;
      g.strokeText(word, 0, 0);
      g.restore();
      // glyphs streaming outward from the centre
      for (const s of stream) {
        const r = mod(s.r0 + t * s.v * k, 1) * R;
        const a = alpha * s.a;
        const grow = clamp(r / (Rv * 0.25), 0, 1);
        g.save();
        g.translate(Math.cos(a) * r + off.x * 0.4, Math.sin(a) * r + off.y * 0.4);
        g.rotate(t * s.rot);
        g.font = fontString(smallFs * s.sz * (0.3 + 0.7 * grow) * (0.7 + r / R), ctx.font.sans, 900);
        g.fillStyle = s.col;
        g.fillText(s.ch, 0, 0);
        g.restore();
      }
    };

    return {
      canvas: sc.canvas,
      render(t) {
        const p = pointerOrAuto(ctx, t, auto);
        // ease the object-cell offset toward the pointer
        const tx = (p.x - cx) * 0.6;
        const ty = (p.y - cy) * 0.6;
        off = { x: off.x + (tx - off.x) * 0.15, y: off.y + (ty - off.y) * 0.15 };
        if (!p.real) off = { x: tx, y: ty };
        sc.clear(bg);
        const rot = t * spin * 0.6;
        for (let i = 0; i < N; i++) {
          g.save();
          g.translate(cx, cy);
          g.rotate(rot + i * alpha);
          if (i % 2) {
            g.rotate(alpha);
            g.scale(1, -1);
          }
          g.beginPath();
          g.moveTo(0, 0);
          g.arc(0, 0, R, -0.003, alpha + 0.003);
          g.closePath();
          g.clip();
          source(t);
          g.restore();
        }
        // mirror seams hint + rim rings
        g.save();
        g.translate(cx, cy);
        g.strokeStyle = rgba(fg, 0.12);
        g.lineWidth = 1;
        for (const rr of [0.42, 0.78]) {
          g.beginPath();
          g.arc(0, 0, Rv * rr * 1.25, 0, TAU);
          g.stroke();
        }
        if (showCenter) {
          const mr = Rv * 0.24;
          g.fillStyle = bg;
          g.beginPath();
          g.arc(0, 0, mr, 0, TAU);
          g.fill();
          g.lineWidth = Math.max(1.5, mr * 0.05);
          g.strokeStyle = acc;
          g.stroke();
          g.font = fontString(100, ctx.font.sans, 900);
          const ww = Math.max(1, g.measureText(word).width);
          const f = Math.min((mr * 1.5 * 100) / ww, mr * 0.95);
          g.font = fontString(f, ctx.font.sans, 900);
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = fg;
          g.fillText(word, 0, f * 0.04);
        }
        g.restore();
      },
    };
  },
};
export default impl;
