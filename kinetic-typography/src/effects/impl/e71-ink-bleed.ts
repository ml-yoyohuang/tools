import { hexToRgb, mixHex } from '../../engine/canvas';
import { svgEl } from '../../engine/dom';
import { bool, clamp, ease, num, PALETTE } from '../../engine/helpers';
import { graphemes, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Three copies of the same glyphs on a grainy paper:
//   feather – wide, fibrous wick (dilate → high-freq displacement), very light
//   bleed   – the wet halo (dilate → turbulence displacement → blur), medium
//   core    – the clean glyph with only a hair of edge roughness, always legible
// Every filter attribute is a pure function of t, so seeking is exact.
let uid = 0;
// noise with alpha forced to 1, so displacement is unbiased (no premultiplied drift)
const INVERT = '-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 0 1';
const OPAQUE = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1';

const impl: EffectImpl = {
  id: 'ink-bleed',
  defaults: { ...PALETTE.paperInk, primary: '#16171B', secondary: '#C8402F' },
  loopable: true,
  posterTime: 3.4,
  maxChars: 24,
  params: [
    { key: 'spread', label: '暈染範圍', type: 'range', min: 0.3, max: 2, step: 0.05, default: 1, unit: '×' },
    { key: 'soak', label: '滲透秒數', type: 'range', min: 1.2, max: 6, step: 0.1, default: 3, unit: 's' },
    { key: 'seal', label: '落款印章', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const id = `kt-ink-${++uid}`;
    const L = layoutText(ctx, ctx.text, { family: ctx.font.serif, weight: 800, maxHeight: H * 0.56, maxWidth: W * 0.78 });
    const fs = L.fontSize;
    const spread = num(ctx, 'spread', 1) * clamp(ctx.s.intensity, 0.2, 2);
    const soak = num(ctx, 'soak', 3);
    const seal = bool(ctx, 'seal', true);
    const { primary: ink, secondary: red, background: paper } = ctx.s;

    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, ctx.root);
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    const defs = svgEl('defs', {}, svg);
    const region = { filterUnits: 'userSpaceOnUse', x: -W * 0.1, y: -H * 0.1, width: W * 1.2, height: H * 1.2, 'color-interpolation-filters': 'sRGB' };

    // paper grain (static)
    const [r, g, b] = hexToRgb(ink);
    const paperF = svgEl('filter', { id: `${id}-paper`, ...region }, defs);
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9 0.6', numOctaves: 2, seed: 7, result: 'n' }, paperF);
    svgEl('feColorMatrix', { in: 'n', type: 'matrix', values: `0 0 0 0 ${r / 255}  0 0 0 0 ${g / 255}  0 0 0 0 ${b / 255}  0 0 0 0.09 -0.02` }, paperF);
    const fiberF = svgEl('filter', { id: `${id}-fiber`, ...region }, defs);
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.006 0.045', numOctaves: 4, seed: 3, result: 'n' }, fiberF);
    svgEl('feColorMatrix', { in: 'n', type: 'matrix', values: `0 0 0 0 ${r / 255}  0 0 0 0 ${g / 255}  0 0 0 0 ${b / 255}  0 0 0 0.07 -0.025` }, fiberF);
    svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: paper, filter: `url(#${id}-fiber)` }, svg);
    svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'none', filter: `url(#${id}-paper)` }, svg);

    // --- filters ----------------------------------------------------------
    const mkBleed = (name: string, freq: number, octaves: number, seed: number) => {
      const f = svgEl('filter', { id: `${id}-${name}`, ...region }, defs);
      const morph = svgEl('feMorphology', { in: 'SourceGraphic', operator: 'dilate', radius: 0, result: 'd' }, f);
      svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: freq, numOctaves: octaves, seed, result: 'n0' }, f);
      svgEl('feColorMatrix', { in: 'n0', type: 'matrix', values: OPAQUE, result: 'n' }, f);
      svgEl('feColorMatrix', { in: 'n', type: 'matrix', values: INVERT, result: 'ni' }, f);
      // displace by the noise and by its inverse and merge: the union is unbiased
      const disp = svgEl('feDisplacementMap', { in: 'd', in2: 'n', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G', result: 'm1' }, f);
      const disp2 = svgEl('feDisplacementMap', { in: 'd', in2: 'ni', scale: 0, xChannelSelector: 'G', yChannelSelector: 'R', result: 'm2' }, f);
      const merge = svgEl('feMerge', { result: 'm' }, f);
      svgEl('feMergeNode', { in: 'm1' }, merge);
      svgEl('feMergeNode', { in: 'm2' }, merge);
      const blur = svgEl('feGaussianBlur', { in: 'm', stdDeviation: 0 }, f);
      return { morph, disp, disp2, blur };
    };
    const feather = mkBleed('feather', 2.4 / fs * 8, 3, 11);
    const bleed = mkBleed('bleed', 1.6 / fs, 3, 5);
    const coreF = svgEl('filter', { id: `${id}-core`, ...region }, defs);
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: 6 / fs, numOctaves: 2, seed: 9, result: 'n0' }, coreF);
    svgEl('feColorMatrix', { in: 'n0', type: 'matrix', values: OPAQUE, result: 'n' }, coreF);
    const coreDisp = svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G' }, coreF);

    const glyphGroup = (parent: Element, attrs: Record<string, string | number>) => {
      const grp = svgEl('g', attrs, parent);
      for (const c of L.chars) {
        const tx = svgEl('text', { x: c.cx, y: c.cy, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, grp);
        tx.style.font = L.font;
        tx.textContent = c.ch;
      }
      return grp;
    };
    const halo = mixHex(ink, paper, 0.12);
    const featherG = glyphGroup(svg, { fill: halo, filter: `url(#${id}-feather)`, opacity: 0 });
    const bleedG = glyphGroup(svg, { fill: halo, filter: `url(#${id}-bleed)`, opacity: 0 });
    const coreG = glyphGroup(svg, { fill: ink, filter: `url(#${id}-core)`, opacity: 0 });

    // seal: red square, first grapheme of the text in paper colour
    let sealG: SVGGElement | null = null;
    let sealS = 0;
    let sealBase = '';
    if (seal) {
      const s = Math.max(14, Math.min(fs * 0.36, H * 0.12));
      const last = L.chars[L.chars.length - 1];
      const sx = Math.min(W - s * 1.3, last.x + last.w + fs * 0.12);
      const sy = Math.min(H - s * 1.3, last.cy + fs * 0.18);
      sealS = s;
      sealBase = `translate(${sx.toFixed(2)} ${sy.toFixed(2)})`;
      sealG = svgEl('g', { transform: sealBase, opacity: 0 }, svg);
      svgEl('rect', { x: 0, y: 0, width: s, height: s, rx: s * 0.08, fill: red }, sealG);
      svgEl('rect', { x: s * 0.09, y: s * 0.09, width: s * 0.82, height: s * 0.82, rx: s * 0.04, fill: 'none', stroke: paper, 'stroke-width': Math.max(0.8, s * 0.04) }, sealG);
      const ch = graphemes(ctx.text.replace(/\s|[／/]/g, ''))[0] ?? '';
      const st = svgEl('text', { x: s / 2, y: s / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: paper }, sealG);
      st.style.font = `700 ${s * 0.56}px ${ctx.font.serif}`;
      st.textContent = ch;
    }

    const lead = 0.25;
    const appearD = 0.6;
    const soakStart = lead + 0.35;
    const soakEnd = soakStart + soak;
    const sealAt = soakStart + soak * 0.55;
    const hold = 1.6;
    const fadeStart = soakEnd + hold;
    const fadeD = 1;
    const cycle = fadeStart + fadeD + 0.45;
    const appear = ease('power2.out');
    const soakE = ease('sine.out');
    const sealE = ease('back.out(2.2)');

    return {
      settle: soakEnd + 0.2,
      render(time) {
        const t = time % cycle;
        const a = appear(clamp((t - lead) / appearD, 0, 1));
        const u = soakE(clamp((t - soakStart) / soak, 0, 1));
        const fade = 1 - ease('power1.in')(clamp((t - fadeStart) / fadeD, 0, 1));
        const after = clamp((t - fadeStart) / fadeD, 0, 1); // keeps spreading a little while drying out
        const w = u + after * 0.25;
        // core: crisp at first, only a whisper of roughness later
        coreG.setAttribute('opacity', (a * fade).toFixed(3));
        coreDisp.setAttribute('scale', (fs * (0.006 + 0.014 * w) * spread).toFixed(2));
        // bleed halo
        bleed.morph.setAttribute('radius', (fs * 0.016 * w * spread).toFixed(2));
        bleed.disp.setAttribute('scale', (fs * 0.11 * w * spread).toFixed(2));
        bleed.disp2.setAttribute('scale', (fs * 0.11 * w * spread).toFixed(2));
        bleed.blur.setAttribute('stdDeviation', (fs * (0.003 + 0.011 * w) * spread).toFixed(2));
        bleedG.setAttribute('opacity', (0.5 * Math.min(1, u * 1.6) * fade).toFixed(3));
        // fibrous feather
        feather.morph.setAttribute('radius', (fs * 0.03 * w * spread).toFixed(2));
        feather.disp.setAttribute('scale', (fs * 0.24 * w * spread).toFixed(2));
        feather.disp2.setAttribute('scale', (fs * 0.24 * w * spread).toFixed(2));
        feather.blur.setAttribute('stdDeviation', (fs * 0.006 * spread).toFixed(2));
        featherG.setAttribute('opacity', (0.34 * u * fade).toFixed(3));
        if (sealG) {
          const sp = clamp((t - sealAt) / 0.45, 0, 1);
          const sc = 1.6 - 0.6 * sealE(sp);
          const s = sealS;
          sealG.setAttribute('opacity', (Math.min(1, sp * 3) * fade * 0.92).toFixed(3));
          sealG.setAttribute('transform', `${sealBase} translate(${s / 2} ${s / 2}) scale(${sc.toFixed(3)}) rotate(-4) translate(${-s / 2} ${-s / 2})`);
        }
      },
    };
  },
};
export default impl;
