import { svgEl } from '../../engine/dom';
import { clamp, mod, num, PALETTE, str, TAU } from '../../engine/helpers';
import { asLines, fontString, glyphWidth100, graphemes } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// The track is an analytic closed curve (lemniscate or a looping coaster), sampled
// into an arc-length table. Speed follows energy conservation (v ∝ √(c + drop)),
// so a time table ∫ds/v maps t → arc length of the lead car. Chars ride as a train
// at fixed arc spacing; each is rotated to the local tangent and sits on the rail.
const M = 1400;

const impl: EffectImpl = {
  id: 'roller-path',
  defaults: { ...PALETTE.darkTeal },
  posterTime: 1.2,
  maxChars: 30,
  params: [
    {
      key: 'track',
      label: '軌道',
      type: 'select',
      default: 'infinity',
      options: [
        { value: 'infinity', label: '∞ 形' },
        { value: 'coaster', label: '雲霄飛車（迴圈）' },
      ],
    },
    { key: 'accel', label: '下坡加速', type: 'range', min: 0, max: 1, step: 0.05, default: 0.75 },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const kind = str(ctx, 'track', 'infinity');
    const acc = num(ctx, 'accel', 0.75);
    const portrait = H > W * 1.15;
    const curve = (u: number): [number, number] => {
      if (kind === 'coaster') {
        // bottom run (u ∈ [0, π]) carries a loop-the-loop; the return run on top has hills
        let x = -Math.cos(u);
        let y = 0.42 * Math.sin(u);
        if (u <= Math.PI) {
          const w = 0.55;
          const v = clamp((u - (Math.PI / 2 - w)) / (2 * w), 0, 1);
          const th = TAU * v * v * (3 - 2 * v);
          const r = 0.32;
          x += r * Math.sin(th);
          y -= r * (1 - Math.cos(th));
        } else y += 0.2 * Math.sin(4 * u) * Math.sin(u) ** 2;
        return portrait ? [-y, x] : [x, y];
      }
      const d = 1 + Math.sin(u) ** 2;
      const x = Math.cos(u) / d;
      const y = (Math.sin(u) * Math.cos(u)) / d;
      return portrait ? [y, x] : [x, y];
    };
    // sample + fit to stage
    const raw: [number, number][] = [];
    for (let i = 0; i <= M; i++) raw.push(curve((i / M) * TAU));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of raw) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const sc = Math.min((W * 0.84) / (x1 - x0), (H * 0.7) / (y1 - y0));
    const ox = W / 2 - ((x0 + x1) / 2) * sc;
    const oy = H / 2 - ((y0 + y1) / 2) * sc + H * 0.03;
    const px = raw.map((p) => ox + p[0] * sc);
    const py = raw.map((p) => oy + p[1] * sc);
    const yTop = oy + y0 * sc;
    const yBot = oy + y1 * sc;
    const S = new Float64Array(M + 1);
    const T = new Float64Array(M + 1);
    const vOf = (y: number) => {
      const h = clamp((y - yTop) / Math.max(1, yBot - yTop), 0, 1);
      return 1 - acc + acc * (Math.sqrt(0.12 + h) / Math.sqrt(0.62));
    };
    for (let i = 1; i <= M; i++) {
      const ds = Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]);
      S[i] = S[i - 1] + ds;
      T[i] = T[i - 1] + ds / vOf((py[i] + py[i - 1]) / 2);
    }
    const total = S[M];
    const period = 8 / (0.35 + 0.65 * clamp(ctx.s.intensity, 0.1, 2));
    const tScale = T[M] / period;
    const search = (arr: Float64Array, v: number) => {
      let lo = 0, hi = M;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] <= v) lo = mid;
        else hi = mid;
      }
      return lo;
    };
    const at = (s: number) => {
      const ss = mod(s, total);
      const i = Math.min(M - 1, search(S, ss));
      const f = (ss - S[i]) / Math.max(1e-6, S[i + 1] - S[i]);
      const x = px[i] + (px[i + 1] - px[i]) * f;
      const y = py[i] + (py[i + 1] - py[i]) * f;
      const a = Math.atan2(py[i + 1] - py[i], px[i + 1] - px[i]);
      return { x, y, a };
    };

    // chars
    const chars = graphemes(asLines(ctx.text).replace(/\n/g, ' '));
    const fam = ctx.font.sans;
    const em = chars.map((c) => glyphWidth100(c, fam, 900) / 100 + ctx.s.tracking + 0.1);
    const emLen = em.reduce((a, b) => a + b, 0);
    const fs = clamp(Math.min(Math.min(W, H) * 0.12, (total * 0.42) / emLen) * ctx.s.fontScale, 6, Math.min(W, H) * 0.2);
    const offs: number[] = [];
    let accu = 0;
    em.forEach((e) => {
      offs.push(accu + (e * fs) / 2);
      accu += e * fs;
    });
    const trainLen = accu;

    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    ctx.root.appendChild(svg);
    let d = `M ${px[0].toFixed(1)} ${py[0].toFixed(1)}`;
    for (let i = 2; i <= M; i += 2) d += ` L ${px[i].toFixed(1)} ${py[i].toFixed(1)}`;
    d += ' Z';
    const lw = Math.max(1.2, fs * 0.05);
    svgEl('path', { d, fill: 'none', stroke: ctx.s.primary, 'stroke-width': fs * 0.32, 'stroke-dasharray': `${Math.max(1, lw)} ${fs * 0.42}`, opacity: 0.13, pathLength: total }, svg);
    svgEl('path', { d, fill: 'none', stroke: ctx.s.primary, 'stroke-width': lw, opacity: 0.28, 'stroke-linejoin': 'round' }, svg);
    const glow = svgEl('path', { d, fill: 'none', stroke: ctx.s.secondary, 'stroke-width': lw * 2.2, 'stroke-linecap': 'round', pathLength: total, 'stroke-dasharray': `${trainLen} ${total - trainLen}`, opacity: 0.9 }, svg);
    const nodes = chars.map((c, i) => {
      const t = svgEl('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: i === 0 ? ctx.s.secondary : ctx.s.primary }, svg);
      t.style.font = fontString(fs, fam, 900);
      t.textContent = c;
      return t;
    });
    const lift = fs * 0.54;

    return {
      render(time) {
        const tt = mod(time, period) * tScale;
        const i = Math.min(M - 1, search(T, tt));
        const f = (tt - T[i]) / Math.max(1e-9, T[i + 1] - T[i]);
        const s0 = S[i] + (S[i + 1] - S[i]) * f + trainLen;
        glow.setAttribute('stroke-dashoffset', String(-(mod(s0 - trainLen, total)).toFixed(2)));
        nodes.forEach((n, k) => {
          if (chars[k] === ' ') return;
          const p = at(s0 - trainLen + offs[k]);
          const x = p.x + Math.sin(p.a) * lift;
          const y = p.y - Math.cos(p.a) * lift;
          n.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${((p.a * 180) / Math.PI).toFixed(2)})`);
        });
      },
    };
  },
};
export default impl;
