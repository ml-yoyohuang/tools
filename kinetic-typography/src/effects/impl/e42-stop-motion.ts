import { el, glyphSpans } from '../../engine/dom';
import { clamp, ease, num, PALETTE } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fontString, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Time is quantised to `fps` frames per second; nothing is interpolated between frames.
// Each frame every paper-cutout glyph gets a fresh seeded pose (position / angle
// jitter = "boil"), plus a choreography sampled on the frame grid: glyphs are carried
// in from scattered spots, hop one at a time during the hold, then get swept away to
// new spots (which are the next cycle's start). Paper colour occasionally swaps.
const impl: EffectImpl = {
  id: 'stop-motion',
  defaults: { ...PALETTE.violet },
  loopable: true,
  posterTime: 2.6,
  maxChars: 36,
  params: [
    { key: 'fps', label: '每秒格數', type: 'range', min: 6, max: 15, step: 1, default: 10, unit: 'fps' },
    { key: 'boil', label: '抖動量', type: 'range', min: 0, max: 2, step: 0.1, default: 1 },
    { key: 'counter', label: '顯示格數計數', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const fps = Math.round(clamp(num(ctx, 'fps', 10), 6, 15));
    const boil = num(ctx, 'boil', 1) * ctx.s.intensity;
    const showCounter = ctx.s.params.counter !== false;
    const { primary: fg, secondary: acc } = ctx.s;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.5, maxWidth: W * 0.78, lineHeight: 1.3 });
    const fs = L.fontSize;
    const edge = Math.max(2, fs * 0.07);
    // cut-out paper: a thick paper "border" behind the ink via stacked text-shadows
    const border = (c: string) => {
      const out: string[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        out.push(`${(Math.cos(a) * edge).toFixed(2)}px ${(Math.sin(a) * edge).toFixed(2)}px 0 ${c}`);
      }
      return out.join(',');
    };
    const paperA = border(acc);
    const paperB = border(fg);
    const spans = glyphSpans(ctx.root, L, { color: fg, style: { textShadow: paperA } });

    const counter = showCounter
      ? el('div', { style: { position: 'absolute', left: `${Math.max(10, W * 0.04)}px`, top: `${Math.max(8, H * 0.05)}px`, font: fontString(Math.max(10, Math.min(W, H) * 0.035), ctx.font.mono, 700), color: fg, letterSpacing: '0.08em', whiteSpace: 'pre' } }, ctx.root)
      : null;
    const rec = counter ? el('span', { text: '●', style: { color: acc, marginRight: '0.5em' } }, counter) : null;
    const cnt = counter ? el('span', {}, counter) : null;

    const n = spans.length;
    const IN = 1.6;
    const HOLD = 3.2;
    const OUT = 1.1;
    const C = IN + HOLD + OUT;
    const eIn = ease('power2.out');
    const eOut = ease('power2.in');
    // a scattered spot per glyph per cycle (cycle c's exit = cycle c+1's entrance)
    const spot = (i: number, c: number) => {
      const r = (j: number) => hash2(i * 7 + j, c, ctx.seed);
      const side = r(1) * 4;
      const x = side < 1 ? -0.15 : side < 2 ? 1.15 : r(2);
      const y = side < 2 ? r(3) : side < 3 ? -0.2 : 1.2;
      return { x: x * W, y: y * H, rot: (r(4) - 0.5) * 120 };
    };
    let lastF = -1;

    return {
      settle: IN + 0.9,
      render(time) {
        const f = Math.floor(time * fps); // frame index
        if (f === lastF) return; // holds exactly between frames
        lastF = f;
        const tq = f / fps; // quantised time
        const c = Math.floor(tq / C);
        const u = tq - c * C;
        const amp = fs * 0.035 * boil;
        spans.forEach((s, i) => {
          const g = s.g;
          let x = 0;
          let y = 0;
          let rot = 0;
          // entrance: carried in from this cycle's spot, staggered
          const stIn = clamp((u - (i / Math.max(1, n)) * IN * 0.45) / (IN * 0.55), 0, 1);
          const stOut = clamp((u - IN - HOLD - (i / Math.max(1, n)) * OUT * 0.35) / (OUT * 0.65), 0, 1);
          if (stIn < 1) {
            const sp = spot(i, c);
            const e = 1 - eIn(stIn);
            x = (sp.x - g.cx) * e;
            y = (sp.y - g.cy) * e - Math.sin(stIn * Math.PI) * fs * 0.6;
            rot = sp.rot * e;
          } else if (stOut > 0) {
            const sp = spot(i, c + 1);
            const e = eOut(stOut);
            x = (sp.x - g.cx) * e;
            y = (sp.y - g.cy) * e - Math.sin(stOut * Math.PI) * fs * 0.4;
            rot = sp.rot * e;
          } else {
            // hold: one glyph at a time hops (4 frames up, 3 down), the animator's hand
            const hopLen = 0.75;
            const h = u - IN;
            const who = Math.floor(h / hopLen) % Math.max(1, n);
            const hp = (h % hopLen) / hopLen;
            if (who === i && hp < 0.6) {
              const s2 = Math.sin((hp / 0.6) * Math.PI);
              y -= s2 * fs * 0.35;
              rot += (hash2(i, Math.floor(h / hopLen), ctx.seed) - 0.5) * 30 * s2;
            }
          }
          // boil: a new random pose every frame
          x += (hash2(i, f * 3, ctx.seed) - 0.5) * amp * 2;
          y += (hash2(i, f * 3 + 1, ctx.seed) - 0.5) * amp * 2;
          rot += (hash2(i, f * 3 + 2, ctx.seed) - 0.5) * 7 * boil;
          const sc = 1 + (hash2(i, f * 5 + 7, ctx.seed) - 0.5) * 0.04 * boil;
          s.el.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
          // drop shadow: light wobbles a little each frame, lifted glyphs cast longer shadows
          const lift = Math.max(0, -y) / fs;
          const sx = fs * (0.05 + lift * 0.08) + (hash2(i, f, ctx.seed + 9) - 0.5) * fs * 0.02;
          const sy = fs * (0.07 + lift * 0.12);
          s.el.style.filter = `drop-shadow(${sx.toFixed(1)}px ${sy.toFixed(1)}px 0 rgba(0,0,0,${(0.28 - lift * 0.06).toFixed(2)}))`;
          // occasional colour swap (whole seconds-ish, seeded per glyph)
          const swap = hash2(i, Math.floor(tq * 1.5), ctx.seed + 31) < 0.12;
          s.el.style.color = swap ? acc : fg;
          s.el.style.textShadow = swap ? paperB : paperA;
        });
        if (cnt) cnt.textContent = `REC ${String(f % 10000).padStart(4, '0')}  ${fps}FPS`;
        if (rec) rec.style.opacity = f % fps < fps / 2 ? '1' : '0.25';
      },
    };
  },
};
export default impl;
