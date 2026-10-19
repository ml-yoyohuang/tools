import { rgba } from '../../engine/canvas';
import { svgEl } from '../../engine/dom';
import { mod, num, PALETTE, TAU } from '../../engine/helpers';
import { asLines, textWidth } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// SVG textPath. Every frame each ribbon's wave path `d` is recomputed (two travelling
// sines with a slowly breathing amplitude) and converted to a smooth cubic Bézier
// (Catmull-Rom). The ribbon body is the same path stroked thick; the text sits on it
// and flows along via startOffset = −(t·v mod unit). A second, hollow ribbon runs
// behind in the opposite direction for depth.
let uid = 0;

function catmull(pts: [number, number][]): string {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

const impl: EffectImpl = {
  id: 'text-ribbon',
  defaults: { ...PALETTE.paperTeal },
  posterTime: 1.5,
  maxChars: 30,
  params: [
    { key: 'ribbons', label: '緞帶數', type: 'range', min: 1, max: 3, step: 1, default: 2 },
    { key: 'amp', label: '起伏幅度', type: 'range', min: 0, max: 0.4, step: 0.01, default: 0.18, hint: '相對於舞台高度' },
    { key: 'flow', label: '文字流速', type: 'range', min: 0, max: 3, step: 0.1, default: 1 },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const k = Math.max(0.05, ctx.s.intensity);
    const nR = Math.round(num(ctx, 'ribbons', 2));
    const flow = num(ctx, 'flow', 1);
    const word = asLines(ctx.text).replace(/\n/g, ' ');
    const portrait = H > W;
    const fs = Math.min(H * 0.105, W * (portrait ? 0.12 : 0.085)) * ctx.s.fontScale;
    // wavelength never gets so short that the text crumples around the bends
    const lambda = Math.max(W * (portrait ? 1.1 : 0.95), fs * 13);
    const amp0 = Math.min(Math.min(H, W * 1.2) * num(ctx, 'amp', 0.18) * Math.min(1.5, k), lambda * 0.16);
    const sep = '  ✦  ';
    const unitText = word + sep;
    const unitW = Math.max(fs, textWidth(unitText, fs, ctx.font.sans, 800, ctx.s.tracking) + fs * 0.1);

    // exact advance of one repeat unit, measured on a probe <text> with the same styling
    const measure = (styled: SVGTextElement, fallback: number) => {
      const probe = styled.cloneNode(false) as SVGTextElement;
      probe.textContent = unitText.repeat(4);
      probe.setAttribute('visibility', 'hidden');
      svg.appendChild(probe);
      let w = fallback;
      try {
        const m = probe.getComputedTextLength() / 4;
        if (m > 1) w = m;
      } catch {
        /* keep fallback */
      }
      probe.remove();
      return w;
    };
    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;overflow:visible' });
    ctx.root.appendChild(svg);
    const defs = svgEl('defs', {}, svg);
    const SEG = Math.max(16, Math.round(36 * ctx.q));
    const x0 = -W * 0.15;
    const x1 = W * 1.15;
    // ribbons are drawn back → front; index 0 is the front ribbon
    const ribbons = Array.from({ length: nR }, (_, i) => {
      const front = i === 0;
      const id = `kt-ribbon-${++uid}`;
      const path = svgEl('path', { id, fill: 'none' }, defs);
      const spread = portrait ? H * 0.26 : H * 0.24;
      const cy = H / 2 + (i === 0 ? 0 : (i % 2 ? 1 : -1) * spread * Math.ceil(i / 2) * (nR === 2 && !portrait ? 0.6 : 1));
      const width = fs * (front ? 1.75 : 1.45);
      const g = svgEl('g', {});
      svg.insertBefore(g, svg.firstChild === defs ? defs.nextSibling : svg.firstChild);
      // body: edge stroke + band
      const edge = svgEl('use', { href: `#${id}`, fill: 'none', stroke: front ? ctx.s.primary : rgba(ctx.s.primary, 0.35), 'stroke-width': width + Math.max(2, fs * 0.08), 'stroke-linejoin': 'round' }, g);
      const band = svgEl('use', { href: `#${id}`, fill: 'none', stroke: front ? ctx.s.secondary : ctx.s.background, 'stroke-width': width, 'stroke-linejoin': 'round' }, g);
      void edge;
      void band;
      const text = svgEl('text', {
        'font-family': ctx.font.sans, 'font-size': fs * (front ? 1 : 0.82), 'font-weight': front ? 800 : 700, 'letter-spacing': `${ctx.s.tracking}em`,
        'dominant-baseline': 'central', fill: front ? ctx.s.primary : ctx.s.primary, 'fill-opacity': front ? 1 : 0.55,
      }, g);
      const tp = svgEl('textPath', { href: `#${id}` }, text);
      // enough repeats to cover the longest possible path + one unit
      const approxLen = (x1 - x0) * Math.sqrt(1 + (amp0 * 1.35 * TAU / lambda) ** 2) * 1.5;
      const reps = Math.ceil(approxLen / (unitW * (front ? 1 : 0.82))) + 2;
      tp.textContent = unitText.repeat(reps);
      return {
        path, tp, cy, front,
        unit: measure(text, unitW * (front ? 1 : 0.82)),
        dir: front ? -1 : 1,
        phase: i * 1.7,
        kx: (TAU / lambda) * (1 + i * 0.18),
      };
    });

    const pts: [number, number][] = Array.from({ length: SEG + 1 }, () => [0, 0]);
    return {
      render(t) {
        for (const r of ribbons) {
          const A = amp0 * (0.8 + 0.2 * Math.sin(t * 0.7 + r.phase)) * (r.front ? 1 : 0.8);
          const w = t * 1.3 * k * (r.front ? 1 : -0.8);
          for (let i = 0; i <= SEG; i++) {
            const x = x0 + ((x1 - x0) * i) / SEG;
            const y = r.cy + A * Math.sin(x * r.kx - w + r.phase) + A * 0.35 * Math.sin(x * r.kx * 2.1 + w * 0.6 + r.phase * 2);
            pts[i][0] = x;
            pts[i][1] = y;
          }
          r.path.setAttribute('d', catmull(pts));
          const speed = fs * 2.2 * flow * k;
          const off = mod(t * speed, r.unit);
          // front flows forward (text moves right→left along the path), back flows the other way
          r.tp.setAttribute('startOffset', String(r.dir < 0 ? -off : off - r.unit));
        }
      },
    };
  },
};
export default impl;
