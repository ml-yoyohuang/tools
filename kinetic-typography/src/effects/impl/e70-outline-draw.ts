import { offscreen } from '../../engine/canvas';
import { svgEl } from '../../engine/dom';
import { bool, clamp, ease, num, PALETTE } from '../../engine/helpers';
import { fontString, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Every glyph is an SVG <text> with a transparent fill and a dashed stroke. The
// browser dashes along the real glyph outline (each contour restarts the dash
// pattern), so growing the dash length (with a huge gap) draws the actual contours.
// D ≈ longest contour of the glyph, estimated from a rasterised mask by tracing
// boundary pixels; at the end the dash is removed so every contour is closed.
// Then the fill fades in, holds, and the outline is erased in the same direction.

/** Longest outline contour of a glyph, in px at `size`, from boundary-pixel components. */
const GAP = 100000;
const contourCache = new Map<string, number>();
function longestContour(ch: string, family: string, weight: number | string, size: number): number {
  const key = `${family}|${weight}|${ch}`;
  let unit = contourCache.get(key);
  if (unit === undefined) {
    const S = 72;
    const N = Math.ceil(S * 2.2);
    const o = offscreen(N, N);
    o.g.font = fontString(S, family, weight);
    o.g.textAlign = 'center';
    o.g.textBaseline = 'middle';
    o.g.fillStyle = '#000';
    o.g.fillText(ch, N / 2, N / 2);
    const { data } = o.g.getImageData(0, 0, N, N);
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && data[(y * N + x) * 4 + 3] > 110;
    const edge = new Uint8Array(N * N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (on(x, y) && (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1))) edge[y * N + x] = 1;
    let best = 0;
    const stack: number[] = [];
    for (let i = 0; i < edge.length; i++) {
      if (edge[i] !== 1) continue;
      let count = 0;
      edge[i] = 2;
      stack.push(i);
      while (stack.length) {
        const j = stack.pop()!;
        count++;
        const x = j % N;
        const y = (j / N) | 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
            const m = yy * N + xx;
            if (edge[m] === 1) {
              edge[m] = 2;
              stack.push(m);
            }
          }
      }
      best = Math.max(best, count);
    }
    unit = best > 0 ? best / S : 3.2;
    if (contourCache.size > 500) contourCache.clear();
    contourCache.set(key, unit);
  }
  // Overlapping stroke contours merge in pixel space, so the traced component
  // over-estimates the longest real contour; 0.7 keeps the pace even.
  return unit * size * 0.7 + 6;
}

const impl: EffectImpl = {
  id: 'outline-draw',
  defaults: { ...PALETTE.paperViolet },
  loopable: true,
  posterTime: 1.3,
  maxChars: 32,
  params: [
    { key: 'draw', label: '描線秒數', type: 'range', min: 0.6, max: 4, step: 0.1, default: 1.9, unit: 's' },
    { key: 'width', label: '線寬', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1, unit: '×' },
    { key: 'guides', label: '顯示參考線', type: 'toggle', default: true },
  ],
  hide: ['intensity'],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const weight = 800;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.56, maxWidth: W * 0.82, weight });
    const fs = L.fontSize;
    const drawD = num(ctx, 'draw', 1.9);
    const sw = Math.max(1, fs * 0.014) * num(ctx, 'width', 1);
    const guides = bool(ctx, 'guides', true);
    const { primary: fg, secondary: acc } = ctx.s;

    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, ctx.root);
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.overflow = 'visible';

    // construction guides: per line, em-box top / bottom + centre line
    const guideEls: { el: SVGLineElement; len: number; i: number }[] = [];
    if (guides) {
      const gGroup = svgEl('g', { stroke: acc, 'stroke-width': 1, fill: 'none' }, svg);
      L.lines.forEach((ln, li) => {
        if (!ln.glyphs.length) return;
        const x0 = ln.glyphs[0].x - fs * 0.35;
        const x1 = ln.glyphs[ln.glyphs.length - 1].x + ln.glyphs[ln.glyphs.length - 1].w + fs * 0.35;
        [-0.44, 0, 0.44].forEach((dy, j) => {
          const y = ln.cy + dy * fs;
          const el = svgEl('line', { x1: x0, y1: y, x2: x1, y2: y, 'stroke-dasharray': j === 1 ? '3 5' : 'none', opacity: j === 1 ? 0.6 : 1 }, gGroup);
          guideEls.push({ el, len: x1 - x0, i: li * 3 + j });
        });
      });
    }

    const n = L.chars.length;
    const stagger = Math.min(0.12, 1.1 / Math.max(1, n));
    const glyphs = L.chars.map((c) => {
      const D = longestContour(c.ch, L.family, weight, fs);
      const el = svgEl(
        'text',
        {
          x: c.cx,
          y: c.cy,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          fill: fg,
          'fill-opacity': 0,
          stroke: acc,
          'stroke-width': sw,
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
          'stroke-dasharray': `0 ${GAP}`,
        },
        svg,
      );
      el.style.font = L.font;
      el.textContent = c.ch;
      return { el, D, last: '' };
    });

    const lead = 0.35;
    const drawEnd = lead + (n - 1) * stagger + drawD;
    const fillStart = drawEnd - drawD * 0.12;
    const fillD = 0.7;
    const solid = fillStart + fillD;
    const hold = 1.8;
    const unfill = solid + hold;
    const eraseStart = unfill + 0.45;
    const eraseD = drawD * 0.65;
    const cycle = eraseStart + (n - 1) * stagger * 0.6 + eraseD + 0.35;
    const drawEase = ease('power2.inOut');
    const fillEase = ease('power2.out');
    const eraseEase = ease('power3.in');

    return {
      settle: solid + 0.6,
      render(time) {
        const t = time % cycle;
        const fillIn = fillEase(clamp((t - fillStart) / fillD, 0, 1));
        const fillOut = clamp((t - unfill) / 0.45, 0, 1);
        const fill = fillIn * (1 - fillOut);
        glyphs.forEach((gl, i) => {
          // dash = drawn length from each contour's start; erase = growing leading gap
          let dash: string;
          if (t < eraseStart) {
            const p = clamp((t - lead - i * stagger) / drawD, 0, 1);
            dash = p >= 1 ? 'none' : `${(gl.D * drawEase(p)).toFixed(2)} ${GAP}`;
          } else {
            const p = clamp((t - eraseStart - i * stagger * 0.6) / eraseD, 0, 1);
            dash = p <= 0 ? 'none' : `0 ${(gl.D * eraseEase(p)).toFixed(2)} ${GAP} 0`;
          }
          // the stroke recedes while the fill arrives, and returns before the erase
          const strokeOp = 1 - 0.85 * fill;
          const key = `${dash}|${fill.toFixed(3)}`;
          if (key === gl.last) return;
          gl.last = key;
          gl.el.setAttribute('stroke-dasharray', dash);
          gl.el.setAttribute('fill-opacity', fill.toFixed(3));
          gl.el.setAttribute('stroke-opacity', strokeOp.toFixed(3));
        });
        for (const gd of guideEls) {
          const p = ease('expo.out')(clamp((t - 0.05 - gd.i * 0.06) / 0.9, 0, 1));
          const fade = 1 - clamp((t - fillStart) / 0.6, 0, 1);
          gd.el.setAttribute('stroke-dasharray', gd.i % 3 === 1 ? '3 5' : `${gd.len * p} ${gd.len}`);
          gd.el.setAttribute('stroke-opacity', String(0.45 * fade * (gd.i % 3 === 1 ? p : 1)));
        }
      },
    };
  },
};
export default impl;
