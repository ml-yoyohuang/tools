import { mixHex } from '../../engine/canvas';
import { svgEl } from '../../engine/dom';
import { clamp, mod, num, PALETTE, smoothstep, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Layers (back → front):
//   solid text, masked to everything OUTSIDE the disc
//   sky dimmer (opacity ∝ how much of the text the disc covers)
//   corona: radial-gradient ring around the disc, made wispy with turbulence, screen-blended
//   disc body with limb darkening and a thin bright rim
//   outline text (stroke only, glow), masked to INSIDE the disc → rim-lit occluded part
// The disc travels along the long axis of the text block, slowing near the middle,
// and fades at both ends so the loop point is invisible.
let uid = 0;

const impl: EffectImpl = {
  id: 'eclipse-text',
  defaults: { ...PALETTE.darkCoral, secondary: '#FFB35C' },
  posterTime: 3.6,
  maxChars: 32,
  params: [
    { key: 'period', label: '掠過秒數', type: 'range', min: 3, max: 14, step: 0.5, default: 7.5, unit: 's' },
    { key: 'size', label: '圓盤大小', type: 'range', min: 0.6, max: 1.6, step: 0.05, default: 1, unit: '×' },
    { key: 'corona', label: '日冕強度', type: 'range', min: 0, max: 2, step: 0.05, default: 1, unit: '×' },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const id = `kt-ecl-${++uid}`;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.52, maxWidth: W * 0.84 });
    const fs = L.fontSize;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const period = num(ctx, 'period', 7.5);
    const corona = num(ctx, 'corona', 1) * clamp(ctx.s.intensity, 0, 2);
    const vertical = L.height > L.width * 1.1;
    const r = clamp(
      (vertical ? Math.max(L.width * 0.62, fs * 0.8) : Math.max(L.height * 0.62, fs * 0.8)) * num(ctx, 'size', 1),
      fs * 0.5,
      Math.min(W, H) * 0.44,
    );
    const Rc = r * 2.1;

    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, ctx.root);
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    const defs = svgEl('defs', {}, svg);
    const textG = svgEl('g', { id: `${id}-txt` }, defs);
    for (const c of L.chars) {
      const tx = svgEl('text', { x: c.cx, y: c.cy, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, textG);
      tx.style.font = L.font;
      tx.textContent = c.ch;
    }
    const mOut = svgEl('mask', { id: `${id}-out`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
    svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }, mOut);
    const holeOut = svgEl('circle', { r, cx: -9999, cy: -9999, fill: '#000' }, mOut);
    const mIn = svgEl('mask', { id: `${id}-in`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
    const holeIn = svgEl('circle', { r: r - 0.5, cx: -9999, cy: -9999, fill: '#fff' }, mIn);
    // corona gradient (objectBoundingBox on a circle of radius Rc)
    const grad = svgEl('radialGradient', { id: `${id}-cg` }, defs);
    const e = r / Rc;
    (
      [
        // filled interior (hidden by the disc) so displaced wisps never open dark gaps
        [0, 0.95],
        [e, 0.95],
        [e + 0.05, 0.6],
        [e + 0.18, 0.22],
        [e + 0.35, 0.06],
        [1, 0],
      ] as const
    ).forEach(([o, a]) => svgEl('stop', { offset: Math.min(1, o), 'stop-color': acc, 'stop-opacity': clamp(a * corona, 0, 1) }, grad));
    const wisp = svgEl('filter', { id: `${id}-wisp`, filterUnits: 'userSpaceOnUse', x: -Rc * 1.2, y: -Rc * 1.2, width: Rc * 2.4, height: Rc * 2.4 }, defs);
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: (3 / Rc).toFixed(4), numOctaves: 3, seed: 4, result: 'n' }, wisp);
    svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: r * 0.35, xChannelSelector: 'R', yChannelSelector: 'G' }, wisp);
    const glow = svgEl('filter', { id: `${id}-glow`, filterUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
    svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: Math.max(1.2, fs * 0.025), result: 'b' }, glow);
    const gm = svgEl('feMerge', {}, glow);
    svgEl('feMergeNode', { in: 'b' }, gm);
    svgEl('feMergeNode', { in: 'b' }, gm);
    svgEl('feMergeNode', { in: 'SourceGraphic' }, gm);
    const discG = svgEl('radialGradient', { id: `${id}-disc`, cx: '0.42', cy: '0.4', r: '0.62' }, defs);
    svgEl('stop', { offset: 0, 'stop-color': mixHex(bg, '#000000', 0.15) }, discG);
    svgEl('stop', { offset: 0.85, 'stop-color': mixHex(bg, '#000000', 0.55) }, discG);
    svgEl('stop', { offset: 1, 'stop-color': mixHex(bg, acc, 0.25) }, discG);

    // --- layers ------------------------------------------------------------
    const use = (attrs: Record<string, string | number>) => {
      const u = svgEl('use', attrs, svg);
      u.setAttribute('href', `#${id}-txt`);
      return u;
    };
    use({ fill: fg, mask: `url(#${id}-out)` });
    const dim = svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#000', opacity: 0 }, svg);
    const all = svgEl('g', {}, svg);
    const coronaG = svgEl('g', {}, all);
    coronaG.style.mixBlendMode = 'screen';
    const coronaInner = svgEl('g', { filter: `url(#${id}-wisp)` }, coronaG);
    svgEl('circle', { cx: 0, cy: 0, r: Rc, fill: `url(#${id}-cg)` }, coronaInner);
    const disc = svgEl('circle', { r, cx: 0, cy: 0, fill: `url(#${id}-disc)`, stroke: mixHex(acc, '#ffffff', 0.45), 'stroke-width': Math.max(1, r * 0.012), 'stroke-opacity': 0.9 }, all);
    use({ fill: 'none', stroke: mixHex(acc, '#ffffff', 0.35), 'stroke-width': Math.max(0.8, fs * 0.012), 'stroke-linejoin': 'round', mask: `url(#${id}-in)`, filter: `url(#${id}-glow)` });
    const outline = svg.lastElementChild as SVGUseElement;

    // path along the long axis of the block
    const cx0 = L.x + L.width / 2;
    const cy0 = L.y + L.height / 2;
    const half = (vertical ? L.height : L.width) / 2 + r * 1.25;
    const tilt = r * 0.18;

    return {
      render(time) {
        const u = mod(time / period, 1);
        const w = u + 0.055 * Math.sin(u * TAU); // slower around the middle (totality)
        const along = -half + 2 * half * w;
        const x = vertical ? cx0 - tilt * (w * 2 - 1) : cx0 + along;
        const y = vertical ? cy0 + along : cy0 + tilt * (w * 2 - 1);
        const vis = smoothstep(0, 0.07, u) * (1 - smoothstep(0.93, 1, u));
        for (const c of [holeOut, holeIn]) {
          c.setAttribute('cx', x.toFixed(2));
          c.setAttribute('cy', y.toFixed(2));
        }
        // the hole only exists while the disc is visible
        holeOut.setAttribute('r', (r * vis).toFixed(2));
        holeIn.setAttribute('r', Math.max(0, r * vis - 0.5).toFixed(2));
        disc.setAttribute('cx', x.toFixed(2));
        disc.setAttribute('cy', y.toFixed(2));
        disc.setAttribute('r', (r * vis).toFixed(2));
        all.setAttribute('opacity', vis.toFixed(3));
        outline.setAttribute('opacity', vis.toFixed(3));
        coronaG.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
        coronaInner.setAttribute('transform', `rotate(${((time * 9) % 360).toFixed(2)}) scale(${(1 + 0.03 * Math.sin(time * 1.7)).toFixed(4)})`);
        // how much of the text block the disc covers → the sky darkens
        const span = vertical ? L.height : L.width;
        const lo = Math.max(along - r, -span / 2);
        const hi = Math.min(along + r, span / 2);
        const cover = clamp((hi - lo) / Math.min(2 * r, span), 0, 1) * vis;
        dim.setAttribute('opacity', (0.3 * cover * cover).toFixed(3));
      },
    };
  },
};
export default impl;
