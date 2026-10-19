import { svgEl } from '../../engine/dom';
import { clamp, ease, mod, num, PALETTE } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Gooey filter: blur → alpha contrast (feColorMatrix) gives a thresholded "field",
// the crisp glyph is composited on top of it. During the liquid phase neighbouring
// glyphs (alternating pairs each cycle) slide toward each other, droplets swell in the
// gaps and the blur radius grows, so the field merges into liquid bridges; then
// everything separates and the filter is switched off: crisp, readable text for
// most of the cycle. A secondary-coloured copy below gives the liquid some depth.
let uid = 0;

const impl: EffectImpl = {
  id: 'metaball-type',
  defaults: { ...PALETTE.coral },
  posterTime: 2.9,
  maxChars: 30,
  params: [
    { key: 'goo', label: '黏稠度', type: 'range', min: 0.3, max: 2, step: 0.05, default: 1, unit: '×' },
    { key: 'liquid', label: '液態秒數', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1.1, unit: 's', hint: '完全融合的停留時間；其餘時間文字保持清晰' },
    { key: 'depth', label: '液面陰影', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const id = `kt-goo-${++uid}`;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.5, maxWidth: W * 0.8 });
    const fs = L.fontSize;
    const { primary: fg, secondary: acc } = ctx.s;
    const goo = num(ctx, 'goo', 1);
    const liquidHold = num(ctx, 'liquid', 1.1);
    const depth = ctx.s.params.depth !== false;
    const k = clamp(ctx.s.intensity, 0.1, 2);

    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, ctx.root);
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    const defs = svgEl('defs', {}, svg);
    const f = svgEl('filter', { id: `${id}-f`, filterUnits: 'userSpaceOnUse', x: -W * 0.1, y: -H * 0.1, width: W * 1.2, height: H * 1.2, 'color-interpolation-filters': 'sRGB' }, defs);
    const blur = svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 0, result: 'b' }, f);
    svgEl('feColorMatrix', { in: 'b', type: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9', result: 'goo' }, f);
    svgEl('feComposite', { in: 'SourceGraphic', in2: 'goo', operator: 'atop', result: 'crisp' }, f);
    const m = svgEl('feMerge', {}, f);
    svgEl('feMergeNode', { in: 'goo' }, m);
    svgEl('feMergeNode', { in: 'crisp' }, m);

    const mkLayer = (color: string, dx: number, dy: number) => {
      const outer = svgEl('g', { transform: `translate(${dx} ${dy})` }, svg);
      const grp = svgEl('g', { fill: color }, outer);
      const glyphs = L.chars.map((c) => {
        const tx = svgEl('text', { x: c.cx, y: c.cy, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, grp);
        tx.style.font = L.font;
        tx.textContent = c.ch;
        return tx;
      });
      return { grp, glyphs, drops: [] as SVGCircleElement[] };
    };
    const layers = [...(depth ? [mkLayer(acc, fs * 0.035, fs * 0.055)] : []), mkLayer(fg, 0, 0)];

    // gaps between neighbours on the same line get a droplet
    const gaps: { a: number; b: number; x: number; y: number }[] = [];
    L.chars.forEach((c, i) => {
      const nx = L.chars[i + 1];
      if (nx && nx.line === c.line && nx.i === c.i + 1) gaps.push({ a: i, b: i + 1, x: (c.cx + nx.cx) / 2, y: (c.cy + nx.cy) / 2 });
    });
    for (const ly of layers) ly.drops = gaps.map(() => svgEl('circle', { cx: 0, cy: 0, r: 0 }, ly.grp));

    // per cycle: readable → merge → liquid hold → separate → readable
    const read0 = 1.5;
    const mergeD = 0.85;
    const splitD = 1.05;
    const read1 = 1.1;
    const cycle = read0 + mergeD + liquidHold + splitD + read1;
    const mergeE = ease('sine.inOut');
    const splitE = ease('power3.out');
    const liqAt = (u: number) => {
      if (u < read0) return 0;
      if (u < read0 + mergeD) return mergeE((u - read0) / mergeD);
      if (u < read0 + mergeD + liquidHold) return 1;
      if (u < read0 + mergeD + liquidHold + splitD) return 1 - splitE((u - read0 - mergeD - liquidHold) / splitD);
      return 0;
    };
    const sigmaMax = fs * 0.034 * goo;
    let filterOn = false;

    return {
      render(time) {
        const ci = Math.floor(time / cycle);
        const u = mod(time, cycle);
        const liq = liqAt(u);
        const sigma = sigmaMax * liq;
        const on = sigma > 0.25;
        if (on !== filterOn) {
          filterOn = on;
          for (const ly of layers) {
            if (on) ly.grp.setAttribute('filter', `url(#${id}-f)`);
            else ly.grp.removeAttribute('filter');
          }
        }
        blur.setAttribute('stdDeviation', sigma.toFixed(2));
        // pairing alternates each cycle: (0,1)(2,3)… then (1,2)(3,4)…
        const parity = ci % 2;
        const offs = L.chars.map((c, i) => {
          const partner = (i - parity) % 2 === 0 ? i + 1 : i - 1;
          const p = L.chars[partner];
          let dx = 0;
          if (p && p.line === c.line && partner >= 0) {
            // close the gap between the two glyph boxes, plus a slight overlap
            const gap = Math.max(0, Math.abs(p.cx - c.cx) - (p.w + c.w) / 2);
            dx = Math.sign(p.cx - c.cx) * (gap * 0.5 + fs * 0.07) * k * liq;
          }
          const line = L.lines[c.line];
          const lc = line.glyphs.length ? (line.glyphs[0].x + line.glyphs[line.glyphs.length - 1].x + line.glyphs[line.glyphs.length - 1].w) / 2 : c.cx;
          dx += (lc - c.cx) * 0.03 * liq;
          const dy = Math.sin(time * 4.2 + i * 1.3) * fs * 0.05 * liq;
          return { dx, dy };
        });
        for (const ly of layers) {
          ly.glyphs.forEach((tx, i) => tx.setAttribute('transform', `translate(${offs[i].dx.toFixed(2)} ${offs[i].dy.toFixed(2)})`));
          gaps.forEach((gp, j) => {
            const r = fs * (0.07 + 0.06 * hash2(j, ci, ctx.seed)) * liq * Math.min(1.4, goo);
            const x = gp.x + (offs[gp.a].dx + offs[gp.b].dx) / 2;
            const y = gp.y + (offs[gp.a].dy + offs[gp.b].dy) / 2 + Math.sin(time * 3 + j * 2.1) * fs * 0.12 * liq;
            const d = ly.drops[j];
            d.setAttribute('cx', x.toFixed(2));
            d.setAttribute('cy', y.toFixed(2));
            d.setAttribute('r', r.toFixed(2));
          });
        }
      },
    };
  },
};
export default impl;
