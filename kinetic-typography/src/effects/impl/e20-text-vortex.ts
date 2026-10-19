import { drawLayout, rgba, stageCanvas } from '../../engine/canvas';
import { clamp, ease, mod, num, PALETTE, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fontString, graphemes, isSpace, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Fragments travel on log spirals r = r0·(rEnd/r0)^p, θ = θ0 + Θ·p with an
// accelerating p (faster and smaller toward the centre). Θ and the release
// turn are whole turns, so at the end of the release every fragment is back at
// (r0, θ0): the cycle gather → word → release is seamless.
const impl: EffectImpl = {
  id: 'text-vortex',
  defaults: { ...PALETTE.darkPink },
  loopable: true,
  posterTime: 3.6,
  maxChars: 24,
  params: [
    { key: 'count', label: '碎片數量', type: 'range', min: 60, max: 600, step: 10, default: 260 },
    { key: 'turns', label: '旋轉圈數', type: 'range', min: 1, max: 4, step: 1, default: 2 },
    { key: 'cycle', label: '循環秒數', type: 'range', min: 4, max: 12, step: 0.5, default: 7, unit: 's' },
  ],
  create(ctx): EffectRuntime {
    const sc = stageCanvas(ctx);
    const g = sc.g;
    const W = ctx.width;
    const H = ctx.height;
    const cx = W / 2;
    const cy = H / 2;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const T = num(ctx, 'cycle', 7);
    const turns = Math.round(num(ctx, 'turns', 2));
    const THETA = turns * TAU;
    const M = Math.round(num(ctx, 'count', 260) * ctx.q);
    const R = Math.hypot(W, H) * 0.5;
    const rEnd = Math.min(W, H) * 0.02;
    const k = clamp(ctx.s.intensity, 0.2, 2);
    const chars = graphemes(ctx.text).filter((c) => !isSpace(c) && c !== '／' && c !== '/');
    const base = Math.min(W, H) * 0.075;
    const font = fontString(base, ctx.font.sans, 900);
    const dprv = sc.dpr;

    // timeline (fractions of the cycle)
    const ARRIVE = 0.5; // last fragments reach the centre
    const WORD_IN = 0.44;
    const REL = 0.8; // release starts
    const settle = T * 0.66;

    const parts = Array.from({ length: M }, (_, i) => {
      const h1 = hash2(i, 1, ctx.seed);
      return {
        r0: R * (0.18 + 0.95 * Math.sqrt(hash2(i, 2, ctx.seed))),
        th0: hash2(i, 3, ctx.seed) * TAU,
        arrive: T * (ARRIVE - 0.16 * hash2(i, 4, ctx.seed)),
        relDelay: T * 0.05 * hash2(i, 5, ctx.seed),
        size: 0.6 + 1.1 * h1 * h1,
        ch: chars[i % chars.length] ?? '・',
        accent: hash2(i, 6, ctx.seed) < 0.24,
      };
    });
    type Part = (typeof parts)[number];
    const inEase = (u: number) => u * u * (0.4 + 0.6 * u); // gentle start, strong acceleration
    const outEase = ease('expo.out');

    const pos = (p: Part, tc: number) => {
      let q: number; // 0 = outer start, 1 = centre
      let th: number;
      let visible = 1;
      if (tc < p.arrive) {
        const u = inEase(clamp(tc / p.arrive, 0, 1));
        q = u;
        th = p.th0 + THETA * u;
        visible = 1 - clamp((u - 0.9) / 0.1, 0, 1);
      } else if (tc < T * REL + p.relDelay) {
        return null; // absorbed into the word
      } else {
        const s = clamp((tc - T * REL - p.relDelay) / (T * (1 - REL) - p.relDelay), 0, 1);
        const o = outEase(s);
        q = 1 - o;
        th = p.th0 + THETA + TAU * o;
        visible = clamp(s / 0.08, 0, 1);
      }
      const r = p.r0 * Math.pow(rEnd / p.r0, q);
      return { x: cx + Math.cos(th) * r, y: cy + Math.sin(th) * r * 0.82, r, th, visible };
    };

    const L = layoutText(ctx, ctx.text, { maxWidth: W * 0.72, maxHeight: H * 0.42 });
    const wordIn = ease('expo.out');

    return {
      canvas: sc.canvas,
      settle,
      render(t) {
        const tc = mod(t, T);
        sc.clear(bg);
        // spiral arms, slowly rotating (guide of the flow)
        g.save();
        g.translate(cx, cy);
        g.strokeStyle = rgba(acc, 0.1);
        g.lineWidth = 1;
        const armRot = -t * 0.35;
        for (let a = 0; a < 3; a++) {
          g.beginPath();
          for (let s = 0; s <= 80; s++) {
            const ph = (s / 80) * TAU * 1.6;
            const rr = R * 1.1 * Math.exp(-0.42 * ph);
            const an = ph + armRot + (a * TAU) / 3;
            const x = Math.cos(an) * rr;
            const y = Math.sin(an) * rr * 0.82;
            if (s) g.lineTo(x, y);
            else g.moveTo(x, y);
          }
          g.stroke();
        }
        g.restore();

        // gathering glow
        const gather = clamp((tc / T - 0.3) / (ARRIVE - 0.3), 0, 1);
        const glowA = tc / T < REL ? gather * 0.55 : 0.55 * (1 - clamp((tc / T - REL) / 0.08, 0, 1));
        if (glowA > 0.01) {
          const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.45);
          gr.addColorStop(0, rgba(acc, glowA * 0.6));
          gr.addColorStop(1, rgba(acc, 0));
          g.fillStyle = gr;
          g.fillRect(0, 0, W, H);
        }

        // fragments + motion streaks
        g.font = font;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineCap = 'round';
        for (const p of parts) {
          const a = pos(p, tc);
          if (!a || a.visible <= 0.01) continue;
          const b = pos(p, tc - 0.05);
          const sz = p.size * (0.22 + 0.78 * Math.pow(a.r / R, 0.6)) * (0.7 + 0.3 * k);
          const col = p.accent ? acc : fg;
          if (b) {
            g.setTransform(dprv, 0, 0, dprv, 0, 0);
            g.strokeStyle = rgba(col, 0.22 * a.visible);
            g.lineWidth = Math.max(0.6, base * sz * 0.12);
            g.beginPath();
            g.moveTo(b.x, b.y);
            g.lineTo(a.x, a.y);
            g.stroke();
          }
          const rot = a.th + Math.PI / 2;
          const s = sz * dprv;
          const c = Math.cos(rot) * s;
          const si = Math.sin(rot) * s;
          g.setTransform(c, si, -si, c, a.x * dprv, a.y * dprv);
          g.globalAlpha = a.visible * (0.45 + 0.55 * Math.min(1, a.r / (R * 0.4)));
          g.fillStyle = col;
          g.fillText(p.ch, 0, 0);
        }
        g.globalAlpha = 1;
        g.setTransform(dprv, 0, 0, dprv, 0, 0);

        // shockwave when the last fragments arrive
        const sw = (tc / T - ARRIVE) / 0.12;
        if (sw > 0 && sw < 1) {
          g.strokeStyle = rgba(acc, 0.7 * (1 - sw));
          g.lineWidth = Math.max(1, base * 0.12 * (1 - sw));
          g.beginPath();
          g.ellipse(cx, cy, Math.min(W, H) * 0.6 * outEase(sw), Math.min(W, H) * 0.6 * outEase(sw) * 0.82, 0, 0, TAU);
          g.stroke();
        }

        // the word emerges at the centre, then dissolves into the release
        const inU = clamp((tc / T - WORD_IN) / 0.14, 0, 1);
        const outU = clamp((tc / T - REL) / 0.07, 0, 1);
        const alpha = clamp(inU * 1.4, 0, 1) * (1 - outU);
        if (alpha > 0.001) {
          const e = wordIn(inU);
          const scale = (0.35 + 0.65 * e) * (1 + 0.25 * outU);
          const spin = (1 - e) * -0.6;
          g.save();
          g.globalAlpha = alpha;
          g.translate(cx, cy);
          g.rotate(spin);
          g.scale(scale, scale);
          g.translate(-cx, -cy);
          g.shadowColor = rgba(acc, 0.6);
          g.shadowBlur = base * 0.8 * (1 - e * 0.6);
          drawLayout(g, L, { fill: fg });
          g.restore();
        }
      },
    };
  },
};
export default impl;
