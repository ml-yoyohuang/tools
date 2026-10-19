import { rgba } from '../../engine/canvas';
import { svgEl } from '../../engine/dom';
import { bool, num, PALETTE } from '../../engine/helpers';
import { asLines, layoutText, textWidth } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Concentric circular paths, each carrying a textPath. The unit "TEXT · " is repeated
// k = floor(circumference / unitWidth) times and stretched to exactly the circumference
// with textLength, so the seam is invisible. Alternate rings rotate in opposite
// directions; speeds follow the radius so the linear speed of the glyphs is similar.
let uid = 0;

const impl: EffectImpl = {
  id: 'circle-text',
  defaults: { ...PALETTE.lime },
  posterTime: 1.5,
  maxChars: 30,
  params: [
    { key: 'rings', label: '圈數', type: 'range', min: 2, max: 7, step: 1, default: 4 },
    { key: 'spin', label: '旋轉速度', type: 'range', min: 2, max: 40, step: 1, default: 12, unit: '°/s' },
    { key: 'core', label: '中心標誌', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const id = `ct${++uid}`;
    const nRings = Math.round(num(ctx, 'rings', 4));
    const spin = num(ctx, 'spin', 12) * Math.max(0.1, ctx.s.intensity);
    const core = bool(ctx, 'core', true);
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const W = ctx.width;
    const H = ctx.height;
    const cx = W / 2;
    const cy = H / 2;
    const Rmax = Math.min(W, H) * 0.46;
    const Rmin = Rmax * (core ? 0.36 : 0.22);
    const band = (Rmax - Rmin) / nRings;
    const word = asLines(ctx.text).replace(/\n/g, ' ');
    const unit = `${word}  ·  `;
    const fam = ctx.font.sans;

    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    Object.assign(svg.style, { position: 'absolute', inset: '0', overflow: 'visible' });
    ctx.root.appendChild(svg);
    const defs = svgEl('defs', {}, svg);

    const rings: { g: SVGGElement; dir: number; speed: number }[] = [];
    for (let i = 0; i < nRings; i++) {
      // ring 0 = outermost
      const r = Rmax - band * (i + 0.5);
      const style = i % 3; // 0 solid fg, 1 inverted band, 2 accent
      const weight = i % 2 ? 500 : 900;
      let fs = band * 0.62 * ctx.s.fontScale;
      const circ = 2 * Math.PI * r;
      const uw = textWidth(unit, fs, fam, weight, ctx.s.tracking);
      if (uw > circ * 0.98) fs *= (circ * 0.98) / uw; // at least one repetition
      const uw2 = textWidth(unit, fs, fam, weight, ctx.s.tracking);
      const k = Math.max(1, Math.floor(circ / uw2));
      const pid = `${id}-p${i}`;
      // circle path starting at the top, clockwise
      svgEl('path', { id: pid, d: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`, fill: 'none' }, defs);
      const g = svgEl('g', {}, svg);
      g.style.transformOrigin = `${cx}px ${cy}px`;
      // ring guide lines
      svgEl('circle', { cx, cy, r: r + band / 2, fill: 'none', stroke: rgba(fg, 0.22), 'stroke-width': Math.max(0.75, band * 0.015) }, svg);
      if (style === 1) svgEl('circle', { cx, cy, r: r, fill: 'none', stroke: fg, 'stroke-width': band * 0.92 }, g);
      const text = svgEl('text', {
        'font-family': fam,
        'font-weight': weight,
        'font-size': fs,
        'letter-spacing': `${ctx.s.tracking}em`,
        'dominant-baseline': 'central',
        fill: style === 0 ? fg : style === 1 ? bg : acc,
      }, g);
      const tp = svgEl('textPath', { href: `#${pid}`, startOffset: 0, textLength: circ - 0.5, lengthAdjust: 'spacing' }, text);
      tp.textContent = unit.repeat(k);
      rings.push({ g, dir: i % 2 ? -1 : 1, speed: spin * (Rmax / r) ** 0.5 });
    }
    svgEl('circle', { cx, cy, r: Rmin, fill: 'none', stroke: rgba(fg, 0.22), 'stroke-width': Math.max(0.75, band * 0.015) }, svg);

    let coreG: SVGGElement | null = null;
    if (core) {
      coreG = svgEl('g', {}, svg);
      coreG.style.transformOrigin = `${cx}px ${cy}px`;
      svgEl('circle', { cx, cy, r: Rmin * 0.86, fill: acc }, coreG);
      // the full phrase, fitted into the disc
      const L = layoutText({ ...ctx, width: W, height: H }, ctx.text, { maxWidth: Rmin * 1.25, maxHeight: Rmin * 1.0, noScale: true, lineHeight: 1.1 });
      for (const ln of L.lines) {
        const t = svgEl('text', {
          x: cx,
          y: ln.cy,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          'font-family': fam,
          'font-weight': 900,
          'font-size': L.fontSize,
          'letter-spacing': `${ctx.s.tracking}em`,
          fill: fg,
        }, svg);
        t.textContent = ln.text;
      }
    }

    return {
      render(t) {
        for (const r of rings) r.g.style.transform = `rotate(${(r.dir * r.speed * t) % 360}deg)`;
        if (coreG) coreG.style.transform = `scale(${1 + 0.03 * Math.sin(t * 2.1)})`;
      },
    };
  },
};
export default impl;
