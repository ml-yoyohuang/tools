import { mixHex } from '../../engine/canvas';
import { el, textBlock } from '../../engine/dom';
import { clamp, ease, num, PALETTE, str, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Geometry: u = unit vector from the peeling corner C into the sheet, s(P) = (P−C)·u.
// Fold line: s = d. The flat sheet is the stage clipped to s ≥ d (clip-path polygon);
// the folded flap is the part s < d mirrored across the fold line, shaded with a
// gradient that runs along u from the crease (s = d) to the flap tip (s = 2d).
// The text underneath never moves. d(t): small corner lift → full peel → hold → re-cover.
type P = [number, number];

function clipHalf(poly: P[], u: P, c: P, d: number, keepAbove: boolean): P[] {
  const s = (p: P) => ((p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1] - d) * (keepAbove ? 1 : -1);
  const out: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = s(a);
    const sb = s(b);
    if (sa >= 0) out.push(a);
    if (sa >= 0 !== sb >= 0) {
      const k = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
  }
  return out;
}
const polyCss = (pts: P[]) => (pts.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${pts.map((p) => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`).join(',')})`);

const CORNERS = ['br', 'bl', 'tr', 'tl'] as const;

const impl: EffectImpl = {
  id: 'paper-peel',
  defaults: { ...PALETTE.violet },
  loopable: true,
  posterTime: 2.05,
  maxChars: 40,
  params: [
    {
      key: 'corner',
      label: '掀起的角',
      type: 'select',
      default: 'cycle',
      options: [
        { value: 'cycle', label: '輪流' },
        { value: 'br', label: '右下' },
        { value: 'bl', label: '左下' },
        { value: 'tr', label: '右上' },
        { value: 'tl', label: '左上' },
      ],
    },
    { key: 'hold', label: '揭露停留', type: 'range', min: 0.6, max: 4, step: 0.1, default: 2, unit: 's' },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.56, maxWidth: W * 0.82 });
    const { primary: fg, secondary: sheetC, background: bg } = ctx.s;
    const k = clamp(ctx.s.intensity, 0.2, 2);
    const cornerMode = str(ctx, 'corner', 'cycle');
    const hold = num(ctx, 'hold', 2);
    void bg;

    textBlock(ctx.root, L, { color: fg });
    const edgeShadow = el('div', { style: { position: 'absolute', inset: '0', pointerEvents: 'none' } }, ctx.root);
    const texture = `repeating-linear-gradient(0deg, rgba(0,0,0,.028) 0 1px, transparent 1px ${Math.max(6, H * 0.03)}px)`;
    const sheet = el('div', { style: { position: 'absolute', inset: '0', background: sheetC } }, ctx.root);
    const flapWrap = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);
    const flap = el('div', { style: { position: 'absolute', inset: '0' } }, flapWrap);
    const rect: P[] = [
      [0, 0],
      [W, 0],
      [W, H],
      [0, H],
    ];
    const back = mixHex(sheetC, '#ffffff', 0.35);
    const crease = mixHex(sheetC, '#000000', 0.28);
    const tipShade = mixHex(sheetC, '#000000', 0.08);

    const lead = 0.3;
    const liftEnd = lead + 0.55;
    const peelStart = liftEnd + 0.25;
    const peelD = 1.5 / Math.sqrt(k);
    const peelEnd = peelStart + peelD;
    const coverStart = peelEnd + hold;
    const coverD = 0.95;
    const cycle = coverStart + coverD + 0.45;
    const liftE = ease('back.out(2.4)');
    const peelE = ease('power2.inOut');
    const coverE = ease('power3.inOut');
    const lift = Math.min(W, H) * 0.13;

    // gradient along u expressed as css linear-gradient with px stops
    const along = (u: P, c: P, stops: [number, string][]) => {
      const th = Math.atan2(u[0], -u[1]);
      const len = Math.abs(W * Math.sin(th)) + Math.abs(H * Math.cos(th));
      const off = (c[0] - W / 2) * u[0] + (c[1] - H / 2) * u[1] + len / 2;
      return `linear-gradient(${((th * 180) / Math.PI).toFixed(2)}deg, ${stops.map(([s, col]) => `${col} ${(s + off).toFixed(1)}px`).join(', ')})`;
    };

    return {
      settle: peelEnd + 0.5,
      render(time) {
        const ci = Math.floor(time / cycle);
        const t = time - ci * cycle;
        const corner = cornerMode === 'cycle' ? CORNERS[ci % 4] : (cornerMode as (typeof CORNERS)[number]);
        const c: P = [corner.includes('r') ? W : 0, corner.includes('b') ? H : 0];
        const sx = corner.includes('r') ? -1 : 1;
        const sy = corner.includes('b') ? -1 : 1;
        // fold direction: ~40° from horizontal, swinging slightly while peeling
        const smax0 = Math.hypot(W, H);
        let d = 0;
        if (t < liftEnd) d = lift * liftE(clamp((t - lead) / (liftEnd - lead), 0, 1));
        else if (t < peelStart) d = lift * (1 + 0.04 * Math.sin(((t - liftEnd) / 0.25) * TAU));
        else if (t < coverStart) d = lift + (smax0 * 1.02 - lift) * peelE(clamp((t - peelStart) / peelD, 0, 1));
        else d = smax0 * 1.02 * (1 - coverE(clamp((t - coverStart) / coverD, 0, 1)));
        const prog = clamp(d / smax0, 0, 1);
        const ang = (0.7 + 0.12 * Math.sin(prog * Math.PI)) * (H > W ? 1.15 : 1);
        const u: P = [sx * Math.cos(ang), sy * Math.sin(ang)];

        if (d <= 0.5) {
          sheet.style.clipPath = 'none';
          sheet.style.background = `${texture}, ${sheetC}`;
          flapWrap.style.visibility = 'hidden';
          edgeShadow.style.visibility = 'hidden';
          return;
        }
        const remain = clipHalf(rect, u, c, d, true);
        const peeled = clipHalf(rect, u, c, d, false);
        const mirrored = peeled.map<P>((p) => {
          const s = (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1];
          const m = 2 * (d - s);
          return [p[0] + u[0] * m, p[1] + u[1] * m];
        });
        sheet.style.clipPath = polyCss(remain);
        // the flat sheet darkens a little near the crease where it starts to bend
        sheet.style.background = `${along(u, c, [[d, 'rgba(0,0,0,.16)'], [d + Math.min(60, d * 0.5 + 6), 'rgba(0,0,0,0)']])}, ${texture}, ${sheetC}`;
        // cast shadow of the lifted edge onto the text
        edgeShadow.style.visibility = 'visible';
        const sh = Math.min(40, 6 + d * 0.12);
        edgeShadow.style.background = along(u, c, [[d - sh, 'rgba(0,0,0,0)'], [d, 'rgba(0,0,0,.28)'], [d + 1, 'rgba(0,0,0,0)']]);
        // flap: crease shadow → bright curl highlight → back side → slightly shaded tip
        flapWrap.style.visibility = 'visible';
        flap.style.clipPath = polyCss(mirrored);
        const span = Math.max(1, d);
        flap.style.background = along(u, c, [
          [d, crease],
          [d + span * 0.12, back],
          [d + span * 0.22, mixHex(back, '#ffffff', 0.25)],
          [d + span * 0.6, back],
          [d + span, tipShade],
        ]);
        const so = Math.min(14, 3 + d * 0.04);
        flapWrap.style.filter = `drop-shadow(${(u[0] * so).toFixed(1)}px ${(u[1] * so).toFixed(1)}px ${(so * 1.4).toFixed(1)}px rgba(0,0,0,.32))`;
      },
    };
  },
};
export default impl;
