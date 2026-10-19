import { el, svgEl } from '../../engine/dom';
import { bool, lerp, num, PALETTE, TAU } from '../../engine/helpers';
import { fontString, glyphWidth100, graphemes, isSpace, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Glyphs ride a tilted ellipse around a shaded sphere. depth = sin(θ):
// front half (lower arc) is large, sharp, bright and stacked above the planet;
// back half is small, blurred, dim and stacked below it, so the planet occludes
// it. The orbit path is drawn twice (back half under, front half over the planet).
/** Arc-length parametrisation of an ellipse: θ for a given distance along it. */
function arcTable(rx: number, ry: number, n = 360) {
  const cum = new Float64Array(n + 1);
  let px = rx;
  let py = 0;
  for (let i = 1; i <= n; i++) {
    const th = (i / n) * TAU;
    const x = Math.cos(th) * rx;
    const y = Math.sin(th) * ry;
    cum[i] = cum[i - 1] + Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  const per = cum[n];
  return {
    per,
    theta(s: number) {
      const u = ((s % per) + per) % per;
      let lo = 0;
      let hi = n;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (cum[m] <= u) lo = m;
        else hi = m;
      }
      const f = (u - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
      return ((lo + f) / n) * TAU;
    },
  };
}

const impl: EffectImpl = {
  id: 'text-orbit',
  defaults: { ...PALETTE.paperViolet },
  posterTime: 1.2,
  maxChars: 24,
  params: [
    { key: 'tilt', label: '軌道傾角', type: 'range', min: 0.15, max: 0.6, step: 0.01, default: 0.32, hint: '橢圓的扁平程度（短軸 / 長軸）。' },
    { key: 'period', label: '公轉秒數', type: 'range', min: 4, max: 20, step: 0.5, default: 9, unit: 's' },
    { key: 'moon', label: '第二軌道', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const flat = num(ctx, 'tilt', 0.32);
    const period = num(ctx, 'period', 9) / Math.max(0.1, ctx.s.intensity);
    const moon = bool(ctx, 'moon', true);
    const word = phrases(ctx.text).join(' ');
    const gs = graphemes(word);
    const cx = W / 2;
    const cy = H / 2;
    const a = Math.min(W * 0.44, H * 0.86);
    const b = a * flat;
    const rot = -12; // ellipse roll (deg)
    const rotR = (rot * Math.PI) / 180;
    const planetR = Math.min(a * 0.4, H * 0.24);
    const family = ctx.font.sans;
    const tr = ctx.s.tracking;

    // perimeter (Ramanujan) and glyph sizing: the word, repeated, fills the orbit
    const arc = arcTable(a, b);
    const per = arc.per;
    const sep = 1.6; // em gap between repeats
    const w100 = gs.map((c) => glyphWidth100(c, family, 900) + tr * 100);
    const unit100 = w100.reduce((x, y) => x + y, 0) + sep * 100;
    let fs = Math.min(a * 0.2, H * 0.14) * ctx.s.fontScale;
    if ((unit100 / 100) * fs * 1.15 > per) fs = (per * 100) / (unit100 * 1.15);
    const unitW = (unit100 / 100) * fs;
    const reps = Math.max(1, Math.min(4, Math.floor(per / (unitW * 1.25))));
    // arc-length positions → approx angle spacing (uniform in θ is fine for a train)
    const slots: { ch: string; th: number }[] = [];
    const total = reps * unitW;
    for (let r = 0; r < reps; r++) {
      let x = r * unitW;
      gs.forEach((c, i) => {
        const w = (w100[i] / 100) * fs;
        if (!isSpace(c)) slots.push({ ch: c, th: -((x + w / 2) / total) * per });
        x += w;
      });
    }

    const stage = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);
    // starfield of tiny dots for depth
    for (let i = 0; i < Math.round(40 * ctx.q); i++) {
      const s = 1 + ctx.rand() * 2;
      el('div', { style: { position: 'absolute', left: `${ctx.rand() * W}px`, top: `${ctx.rand() * H}px`, width: `${s}px`, height: `${s}px`, borderRadius: '50%', background: fg, opacity: 0.12 + ctx.rand() * 0.2 } }, stage);
    }

    const pathEl = (z: number, front: boolean, rx: number, ry: number, rr: number, dash: string, op: number) => {
      const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
      Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', zIndex: String(z), overflow: 'visible' });
      stage.appendChild(svg);
      // half ellipse: front = lower arc (θ 0…π), back = upper arc (π…2π)
      const p0 = front ? 0 : Math.PI;
      const pts: string[] = [];
      for (let i = 0; i <= 64; i++) {
        const th = p0 + (i / 64) * Math.PI;
        const x = Math.cos(th) * rx;
        const y = Math.sin(th) * ry;
        pts.push(`${(cx + x * Math.cos(rr) - y * Math.sin(rr)).toFixed(2)},${(cy + x * Math.sin(rr) + y * Math.cos(rr)).toFixed(2)}`);
      }
      svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: fg, 'stroke-width': Math.max(1, fs * 0.025), 'stroke-dasharray': dash, opacity: op }, svg);
    };
    pathEl(1, false, a, b, rotR, `${fs * 0.05} ${fs * 0.18}`, 0.35);
    pathEl(3000, true, a, b, rotR, `${fs * 0.05} ${fs * 0.18}`, 0.55);

    // planet: shaded sphere + terminator + a soft cast shadow
    el(
      'div',
      {
        style: {
          position: 'absolute',
          left: `${cx - planetR}px`,
          top: `${cy - planetR}px`,
          width: `${planetR * 2}px`,
          height: `${planetR * 2}px`,
          borderRadius: '50%',
          zIndex: '1000',
          background: `radial-gradient(circle at 34% 30%, #ffffffcc 0%, ${acc} 22%, ${acc} 48%, #1a1530 100%)`,
          boxShadow: `0 ${planetR * 0.15}px ${planetR * 0.6}px ${bg === '#101114' ? '#000a' : '#0003'}`,
        },
      },
      stage,
    );

    interface G {
      el: HTMLSpanElement;
      /** arc-length position on its orbit */
      th: number;
      arc: ReturnType<typeof arcTable>;
      rx: number;
      ry: number;
      speed: number;
      size: number;
    }
    const glyphs: G[] = slots.map((s) => ({
      el: el('span', { text: s.ch, style: { position: 'absolute', left: '0', top: '0', font: fontString(fs, family, 900), lineHeight: '1', whiteSpace: 'pre', color: fg, willChange: 'transform, filter, opacity' } }, stage),
      th: s.th,
      arc,
      rx: a,
      ry: b,
      speed: 1,
      size: 1,
    }));
    if (moon) {
      // inner counter-orbit in fine mono, steeper tilt
      const a2 = planetR * 1.45;
      const b2 = a2 * Math.min(0.85, flat * 2.2);
      const n2 = Math.max(6, Math.min(28, Math.floor((TAU * a2 * 0.8) / (fs * 0.42))));
      const arc2 = arcTable(a2, b2);
      const mg = gs.filter((c) => !isSpace(c));
      for (let i = 0; i < n2; i++) {
        glyphs.push({
          el: el('span', { text: mg[i % mg.length], style: { position: 'absolute', left: '0', top: '0', font: fontString(fs * 0.3, ctx.font.mono, 700), lineHeight: '1', color: acc, willChange: 'transform, opacity' } }, stage),
          th: -(i / n2) * arc2.per,
          arc: arc2,
          rx: a2,
          ry: b2,
          speed: -1.6,
          size: 0.3,
        });
      }
    }
    const rr2 = (22 * Math.PI) / 180;

    return {
      render(t) {
        const base = t / period;
        for (const g of glyphs) {
          const th = g.arc.theta(g.th + base * g.speed * g.arc.per);
          const x = Math.cos(th) * g.rx;
          const y = Math.sin(th) * g.ry;
          const r = g.speed < 0 ? rr2 : rotR;
          const px = cx + x * Math.cos(r) - y * Math.sin(r);
          const py = cy + x * Math.sin(r) + y * Math.cos(r);
          const d = Math.sin(th); // +1 front, −1 back
          const n = (d + 1) / 2;
          const sc = lerp(0.5, 1.25, n);
          // slight lean on the far side, as if wrapping around the planet
          const lean = g.speed < 0 ? 0 : -Math.cos(th) * 8 * (1 - n);
          g.el.style.transform = `translate3d(${px}px,${py}px,0) translate(-50%,-50%) scale(${sc}) rotate(${lean}deg)`;
          g.el.style.zIndex = String(d > 0 ? 2000 + Math.round(n * 900) : Math.round(n * 900) + 2);
          g.el.style.opacity = String(lerp(0.28, 1, n * n));
          if (g.size === 1) g.el.style.filter = n < 0.85 ? `blur(${((0.85 - n) * fs * 0.045).toFixed(2)}px)` : 'none';
        }
      },
    };
  },
};
export default impl;
