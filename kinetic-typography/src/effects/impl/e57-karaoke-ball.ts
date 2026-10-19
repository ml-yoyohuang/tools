import { el, glyphSpans } from '../../engine/dom';
import { clamp, lerp, num, PALETTE, str } from '../../engine/helpers';
import { isLatin, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Pure function of t. Each char gets a landing time from a beat grid (latin letters
// are half-beat "syllables"); the ball travels between landings on a physical
// parabola (linear x, quadratic y), squashes on impact, and each landing starts that
// char's linear left-to-right fill (clip-path inset on a coloured copy).
const impl: EffectImpl = {
  id: 'karaoke-ball',
  defaults: { ...PALETTE.darkPink },
  posterTime: 2.1,
  maxChars: 40,
  textHint: '換行或「／」會變成下一行歌詞，球會跳到下一行。',
  params: [
    { key: 'bpm', label: '速度', type: 'range', min: 60, max: 200, step: 2, default: 126, unit: 'BPM' },
    {
      key: 'rhythm',
      label: '節奏型',
      type: 'select',
      default: 'swing',
      options: [
        { value: 'even', label: '平均' },
        { value: 'swing', label: '搖擺（長短）' },
      ],
    },
  ],
  create(ctx): EffectRuntime {
    const beat = 60 / clamp(num(ctx, 'bpm', 126), 30, 300);
    const swing = str(ctx, 'rhythm', 'swing') === 'swing';
    const L = layoutText(ctx, ctx.text, { maxHeight: ctx.height * 0.52, maxWidth: ctx.width * 0.84, lineHeight: 1.85, cy: ctx.height * 0.55 });
    const fs = L.fontSize;
    const base = glyphSpans(ctx.root, L, { color: ctx.s.primary, style: { opacity: 0.32 } });
    const fill = glyphSpans(ctx.root, L, { color: ctx.s.secondary, style: { clipPath: 'inset(-10% 100% -10% -2%)' } });
    const n = base.length;

    // schedule
    const lands: number[] = [];
    const durs: number[] = [];
    let t = 0.2 + beat; // first hop enters from the left
    base.forEach(({ g }, i) => {
      const latin = isLatin(g.ch);
      let d = latin ? beat * 0.5 : beat;
      if (swing && !latin) d *= i % 2 === 0 ? 1.34 : 0.66;
      const next = base[i + 1]?.g;
      if (next && next.line !== g.line) d += beat; // breath between lines
      else if (next && next.i > g.i + 1) d += beat * 0.25; // word gap
      lands.push(t);
      durs.push(d);
      t += d;
    });
    const singEnd = t;
    const exitStart = singEnd + beat * 2.5;
    const exitDur = beat * 1.2;
    const cycle = exitStart + exitDur + 0.5;

    const r = Math.max(3, fs * 0.13);
    const ball = el(
      'div',
      {
        style: {
          position: 'absolute',
          left: '0',
          top: '0',
          width: `${r * 2}px`,
          height: `${r * 2}px`,
          borderRadius: '50%',
          background: ctx.s.secondary,
          boxShadow: `0 0 ${r * 1.6}px ${ctx.s.secondary}88, inset ${-r * 0.35}px ${-r * 0.35}px 0 rgba(0,0,0,.18)`,
          willChange: 'transform',
        },
      },
      ctx.root,
    );
    const restY = (i: number) => base[i].g.cy - fs * 0.56 - r;
    const startX = L.x - fs * 1.2;
    const startY = restY(0) - fs * 0.25;
    const lastX = L.x + L.width + fs * 1.2;

    const hop = (x0: number, y0: number, x1: number, y1: number, u: number) => {
      const H = (fs * 0.45 + Math.abs(x1 - x0) * 0.22) * (0.35 + 0.65 * clamp(ctx.s.intensity, 0, 2)) + Math.max(0, y0 - y1) * 0.3;
      return { x: lerp(x0, x1, u), y: lerp(y0, y1, u) - H * 4 * u * (1 - u) };
    };

    return {
      render(time) {
        const tt = time % cycle;
        // ball position
        let x: number;
        let y: number;
        let squash = 0;
        if (tt < lands[0]) {
          const u = clamp((tt - (lands[0] - beat)) / beat, 0, 1);
          ({ x, y } = hop(startX, startY, base[0].g.cx, restY(0), u));
          ball.style.opacity = String(clamp(u * 4, 0, 1));
        } else if (tt < exitStart) {
          let i = 0;
          while (i < n - 1 && tt >= lands[i + 1]) i++;
          if (i < n - 1) {
            const u = (tt - lands[i]) / (lands[i + 1] - lands[i]);
            ({ x, y } = hop(base[i].g.cx, restY(i), base[i + 1].g.cx, restY(i + 1), u));
          } else {
            // resting on the last char with small dribbles
            const s = tt - lands[n - 1];
            const bounce = Math.abs(Math.sin((s / beat) * Math.PI)) * fs * 0.18 * Math.exp(-s * 1.4);
            x = base[n - 1].g.cx;
            y = restY(n - 1) - bounce;
          }
          ball.style.opacity = '1';
        } else {
          const u = clamp((tt - exitStart) / exitDur, 0, 1);
          ({ x, y } = hop(base[n - 1].g.cx, restY(n - 1), lastX, restY(n - 1) - fs * 0.6, u));
          ball.style.opacity = String(1 - clamp((u - 0.6) / 0.4, 0, 1));
        }
        for (let i = 0; i < n; i++) {
          const d = tt - lands[i];
          if (Math.abs(d) < 0.09) squash = Math.max(squash, 1 - Math.abs(d) / 0.09);
        }
        const sx = 1 + 0.35 * squash;
        const sy = 1 - 0.32 * squash;
        ball.style.transform = `translate3d(${x - r}px, ${y - r + r * (1 - sy)}px, 0) scale(${sx}, ${sy})`;

        // fills
        const fade = tt > exitStart ? clamp(1 - (tt - exitStart) / (exitDur + 0.3), 0, 1) : 1;
        for (let i = 0; i < n; i++) {
          const d = tt - lands[i];
          const p = clamp(d / (Math.min(durs[i], beat * 1.4) * 0.92), 0, 1);
          const sp = fill[i].el;
          sp.style.clipPath = `inset(-10% ${(100 - p * 102).toFixed(2)}% -10% -2%)`;
          sp.style.opacity = String(fade);
          const dip = d > 0 && d < 0.32 ? Math.sin((Math.PI * d) / 0.32) * (1 - d / 0.32) * fs * 0.08 : 0;
          const tr = `translate(-50%,-50%) translateY(${dip.toFixed(2)}px)`;
          sp.style.transform = tr;
          base[i].el.style.transform = tr;
        }
      },
    };
  },
};
export default impl;
