import { drawLayout, mix, rgba, stageCanvas } from '../../engine/canvas';
import { bool, clamp, num, PALETTE } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fontString, graphemes, isSpace, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Three depth layers of falling glyphs. Every drop is a pure function of time:
// it has a fixed period (fall + splash + idle); the period index re-seeds its
// column and glyph, and the swap always happens off-screen, so the rain never jumps.
interface Layer {
  size: number; // font px
  speed: number; // px / s
  alpha: number;
  ground: number; // y where drops of this layer land
  color: string;
  trail: number; // ghost copies
  count: number;
  splash: number; // splash scale
}

const impl: EffectImpl = {
  id: 'letter-rain',
  defaults: { ...PALETTE.darkTeal },
  posterTime: 2.4,
  maxChars: 40,
  params: [
    { key: 'density', label: '雨量', type: 'range', min: 0.3, max: 2, step: 0.1, default: 1 },
    { key: 'wind', label: '風向', type: 'range', min: -0.4, max: 0.4, step: 0.05, default: 0.12, hint: '雨滴的水平偏移' },
    { key: 'word', label: '顯示完整文字', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const sc = stageCanvas(ctx);
    const g = sc.g;
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const density = num(ctx, 'density', 1);
    const wind = num(ctx, 'wind', 0.12);
    const showWord = bool(ctx, 'word', true);
    const pool = graphemes(ctx.text.replace(/[／/\n]/g, '')).filter((c) => !isSpace(c));
    if (!pool.length) pool.push('雨');
    const unit = Math.min(W, H);
    const sp = Math.max(0.2, ctx.s.intensity);
    const area = (W * H) / (640 * 360);
    const n = (base: number) => Math.max(3, Math.round(base * ctx.q * density * Math.sqrt(area)));
    const layers: Layer[] = [
      { size: unit * 0.045, speed: H * 0.32, alpha: 0.28, ground: H * 0.8, color: mix(fg, bg, 0.62), trail: 0, count: n(34), splash: 0.5 },
      { size: unit * 0.075, speed: H * 0.55, alpha: 0.55, ground: H * 0.86, color: mix(fg, acc, 0.35), trail: 2, count: n(20), splash: 0.75 },
      { size: unit * 0.12, speed: H * 0.95, alpha: 1, ground: H * 0.93, color: fg, trail: 4, count: n(11), splash: 1 },
    ];
    const SPLASH = 0.55;
    const word = layoutText(ctx, ctx.text, { maxHeight: H * 0.34, maxWidth: W * 0.8, cy: H * 0.46, lineHeight: 1.15 });

    // pre-computed per-drop constants (period, phase, idle)
    const drops = layers.map((L, li) =>
      Array.from({ length: L.count }, (_, i) => {
        const vJit = 0.8 + hash2(i, li * 13 + 1, ctx.seed) * 0.45;
        const v = L.speed * vJit * sp;
        const fall = (L.ground + L.size) / v;
        const idle = 0.2 + hash2(i, li * 13 + 2, ctx.seed) * fall * 0.9;
        const period = fall + SPLASH + idle;
        return { v, fall, period, off: hash2(i, li * 13 + 3, ctx.seed) * period, i };
      }),
    );

    const drawSplash = (x: number, y: number, p: number, L: Layer, k: number, seed: number) => {
      const s = L.size * L.splash;
      const a = (1 - p) * L.alpha;
      // ring
      g.strokeStyle = rgba(acc, a * 0.9);
      g.lineWidth = Math.max(1, s * 0.06);
      g.beginPath();
      g.ellipse(x, y, s * (0.25 + p * 1.1), s * (0.06 + p * 0.22), 0, 0, Math.PI * 2);
      g.stroke();
      // droplets on parabolas
      g.fillStyle = rgba(acc, a);
      for (let d = 0; d < 4; d++) {
        const dir = (hash2(k * 7 + d, seed, ctx.seed) - 0.5) * 2;
        const vx = dir * s * 1.6;
        const vy = s * (2.2 + hash2(d, k * 3 + seed, ctx.seed) * 1.6);
        const tt = p * 0.5;
        const px = x + vx * tt * 2;
        const py = y - (vy * tt * 2 - 9.8 * s * tt * tt * 1.9);
        if (py <= y + 1) {
          g.beginPath();
          g.arc(px, py, Math.max(0.8, s * 0.07 * (1 - p * 0.6)), 0, Math.PI * 2);
          g.fill();
        }
      }
    };

    const drawLayer = (li: number, t: number) => {
      const L = layers[li];
      g.font = fontString(L.size, ctx.font.sans, li === 2 ? 900 : 700);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const d of drops[li]) {
        const tt = t + d.off;
        const k = Math.floor(tt / d.period);
        const local = tt - k * d.period;
        const x0 = (0.04 + 0.92 * hash2(d.i, k * 5 + li, ctx.seed)) * W;
        const ch = pool[Math.floor(hash2(d.i + 97, k * 3 + li, ctx.seed) * pool.length)];
        if (local < d.fall) {
          const y = -L.size + local * d.v;
          const x = x0 + (y - L.ground) * wind;
          const accent = li === 2 && hash2(d.i, k, ctx.seed + 7) < 0.18;
          // streak behind the glyph
          if (li > 0) {
            const len = L.size * (1.4 + li);
            const grd = g.createLinearGradient(x, y - len, x, y - L.size * 0.5);
            grd.addColorStop(0, rgba(accent ? acc : fg, 0));
            grd.addColorStop(1, rgba(accent ? acc : fg, L.alpha * 0.35));
            g.strokeStyle = grd;
            g.lineWidth = Math.max(1, L.size * 0.05);
            g.beginPath();
            g.moveTo(x - len * wind, y - len);
            g.lineTo(x - L.size * 0.5 * wind, y - L.size * 0.5);
            g.stroke();
          }
          for (let j = L.trail; j >= 1; j--) {
            const dy = j * L.size * 0.32;
            g.globalAlpha = L.alpha * 0.16 * (1 - j / (L.trail + 1));
            g.fillStyle = accent ? acc : L.color;
            g.fillText(ch, x - dy * wind, y - dy);
          }
          g.globalAlpha = L.alpha;
          g.fillStyle = accent ? acc : L.color;
          g.fillText(ch, x, y);
          g.globalAlpha = 1;
        } else if (local < d.fall + SPLASH) {
          drawSplash(x0, L.ground, (local - d.fall) / SPLASH, L, d.i, li + k * 11);
        }
      }
    };

    return {
      canvas: sc.canvas,
      render(t) {
        sc.clear(bg);
        // faint sky gradient & ground haze
        const sky = g.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, rgba(acc, 0.05));
        sky.addColorStop(0.75, rgba(bg, 0));
        sky.addColorStop(1, rgba(acc, 0.1));
        g.fillStyle = sky;
        g.fillRect(0, 0, W, H);
        // ground lines per depth
        layers.forEach((L, i) => {
          g.fillStyle = rgba(fg, 0.05 + i * 0.04);
          g.fillRect(0, L.ground + L.size * 0.1, W, Math.max(1, i * 0.6 + 0.5));
        });
        drawLayer(0, t);
        drawLayer(1, t);
        if (showWord) {
          // the full phrase sits between the middle and near layers
          drawLayout(g, word, { fill: rgba(bg, 0.55), stroke: rgba(bg, 0.55), lineWidth: word.fontSize * 0.18 });
          const shimmer = clamp(0.88 + 0.12 * Math.sin(t * 1.3), 0, 1);
          g.globalAlpha = shimmer;
          drawLayout(g, word, { fill: fg });
          g.globalAlpha = 1;
        }
        drawLayer(2, t);
      },
    };
  },
};
export default impl;
