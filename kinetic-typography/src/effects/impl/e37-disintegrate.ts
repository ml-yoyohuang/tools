import { drawLayout, rgba, sampleLayout, stageCanvas } from '../../engine/canvas';
import { clamp, ease, num, PALETTE } from '../../engine/helpers';
import { hash2, noise1, noise2 } from '../../engine/random';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Glyph pixels are sampled into particles. A jagged dissolve front sweeps left → right:
// ahead of it the text is drawn crisp, a thin ember line rides the front, behind it
// every particle is released at the exact moment the front passes its home point,
// then drifts with value-noise turbulence and wind, rises (upward acceleration),
// shrinks and fades from hot accent to text colour. The gather plays the same
// function of "dissolve time" backwards, so the loop is seamless.
const impl: EffectImpl = {
  id: 'disintegrate',
  defaults: { ...PALETTE.darkCoral },
  loopable: true,
  posterTime: 2.3,
  maxChars: 30,
  params: [
    { key: 'count', label: '粒子數量', type: 'range', min: 600, max: 8000, step: 100, default: 3500, hint: '會依裝置效能自動調低。' },
    { key: 'wind', label: '風向', type: 'range', min: -1, max: 1, step: 0.1, default: 0.4 },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const k = ctx.s.intensity;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.48, maxWidth: W * 0.82 });
    const fs = L.fontSize;
    const target = Math.round(clamp(num(ctx, 'count', 3500) * ctx.q, 600, 8000));
    const probe = sampleLayout(ctx, L, 2, 1e9).length || 1;
    const step = Math.max(1, 2 * Math.sqrt(probe / target));
    const pts = sampleLayout(ctx, L, step, target);
    const wind = num(ctx, 'wind', 0.4);

    const SWEEP = 1.9;
    const pad = fs * 0.3;
    const x0 = L.x - pad;
    const speed = (L.width + pad * 2) / SWEEP;
    const jag = (y: number) => noise1(y / (fs * 0.22), ctx.seed) * fs * 0.22 + noise1(y / (fs * 0.05), ctx.seed + 5) * fs * 0.05;
    const frontX = (T: number, y: number) => x0 + speed * T + jag(y);

    const n = pts.length;
    const hx = new Float32Array(n);
    const hy = new Float32Array(n);
    const rel = new Float32Array(n);
    const life = new Float32Array(n);
    const vx = new Float32Array(n);
    const v0 = new Float32Array(n);
    const sz = new Float32Array(n);
    let maxEnd = 0;
    pts.forEach((p, i) => {
      hx[i] = p.x;
      hy[i] = p.y;
      rel[i] = Math.max(0, (p.x - x0 - jag(p.y)) / speed);
      life[i] = 1.1 + hash2(i, 1, ctx.seed) * 0.9;
      vx[i] = fs * (wind * (0.5 + hash2(i, 2, ctx.seed) * 0.9) + (hash2(i, 3, ctx.seed) - 0.5) * 0.5) * k;
      v0[i] = fs * (0.05 + hash2(i, 4, ctx.seed) * 0.35) * k;
      sz[i] = step * (0.55 + hash2(i, 5, ctx.seed) * 0.6);
      maxEnd = Math.max(maxEnd, rel[i] + life[i]);
    });
    const DT = maxEnd + 0.05; // total dissolve time
    const lift = fs * 0.75 * k;
    const turb = fs * 0.9 * k;

    const sc = stageCanvas(ctx);
    const g = sc.g;
    const BUCKETS = 6;
    const hotCols = Array.from({ length: BUCKETS }, (_, b) => rgba(acc, (b + 1) / BUCKETS));
    const coolCols = Array.from({ length: BUCKETS }, (_, b) => rgba(fg, (b + 1) / BUCKETS));

    const HOLD0 = 0.9;
    const DIS = DT; // dissolve plays in real time
    const GAP = 0.35;
    const GATHER = Math.max(1.4, DT * 0.55);
    const HOLD1 = 0.7;
    const C = HOLD0 + DIS + GAP + GATHER + HOLD1;
    const eG = ease('power2.inOut');

    const dissolveTime = (u: number) => {
      if (u < HOLD0) return 0;
      if (u < HOLD0 + DIS) return u - HOLD0;
      if (u < HOLD0 + DIS + GAP) return DT;
      if (u < HOLD0 + DIS + GAP + GATHER) return DT * (1 - eG((u - HOLD0 - DIS - GAP) / GATHER));
      return 0;
    };

    const clipAhead = (T: number, extra: number) => {
      g.beginPath();
      const y0 = L.y - fs * 0.3;
      const y1 = L.y + L.height + fs * 0.3;
      const stepY = Math.max(2, fs * 0.04);
      g.moveTo(W + 10, y0);
      for (let y = y0; y <= y1; y += stepY) g.lineTo(frontX(T, y) + extra, y);
      g.lineTo(W + 10, y1);
      g.closePath();
      g.clip();
    };

    return {
      canvas: sc.canvas,
      settle: HOLD0 * 0.6,
      render(time) {
        const u = time % C;
        const T = dissolveTime(u);
        sc.clear(bg);
        // crisp text ahead of the front
        g.save();
        clipAhead(T, 0);
        drawLayout(g, L, { fill: fg });
        g.restore();
        // ember line riding the front
        if (T > 0 && T < SWEEP + 0.2) {
          g.save();
          g.beginPath();
          const y0 = L.y - fs * 0.3;
          const y1 = L.y + L.height + fs * 0.3;
          const stepY = Math.max(2, fs * 0.04);
          const band = Math.max(2, fs * 0.06);
          g.moveTo(frontX(T, y0), y0);
          for (let y = y0; y <= y1; y += stepY) g.lineTo(frontX(T, y), y);
          for (let y = y1; y >= y0; y -= stepY) g.lineTo(frontX(T, y) + band, y);
          g.closePath();
          g.clip();
          drawLayout(g, L, { fill: acc });
          g.restore();
        }
        if (T <= 0) return;
        // particles
        const hot: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
        const cool: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
        for (let i = 0; i < n; i++) {
          const a = T - rel[i];
          if (a <= 0) continue;
          const lf = life[i];
          if (a >= lf) continue;
          const p = a / lf;
          const nx = noise2(hx[i] * 0.02, a * 1.3 + i * 0.001, ctx.seed);
          const ny = noise2(hy[i] * 0.02 + 40, a * 1.1, ctx.seed + 3);
          const x = hx[i] + vx[i] * a + nx * turb * p;
          const y = hy[i] - v0[i] * a - 0.5 * lift * a * a + ny * turb * 0.6 * p;
          const alpha = (1 - p) ** 1.4;
          const b = Math.min(BUCKETS - 1, Math.floor(alpha * BUCKETS));
          const s = sz[i] * (1 - p * 0.6);
          (a < 0.28 ? hot : cool)[b].rect(x - s / 2, y - s / 2, s, s);
        }
        for (let b = 0; b < BUCKETS; b++) {
          g.fillStyle = coolCols[b];
          g.fill(cool[b]);
          g.fillStyle = hotCols[b];
          g.fill(hot[b]);
        }
      },
    };
  },
};
export default impl;
