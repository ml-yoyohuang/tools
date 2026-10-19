import { el, svgEl, textBlock } from '../../engine/dom';
import { clamp, ease, num, PALETTE, smoothstep } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// The cut line runs through the text at an angle. The text is copied into N strips
// along the line × 2 sides; each copy is clipped (clip-path polygon) to its strip on
// one side of the line. Strips the beam head has passed open along the cut normal
// (a "zipper" that trails the head exactly), so beam position = split progress.
// After a hold the two halves weld back together (expo.inOut) with a hot seam.
const impl: EffectImpl = {
  id: 'laser-cut',
  defaults: { ...PALETTE.darkLime },
  posterTime: 2.4,
  maxChars: 30,
  params: [
    { key: 'angle', label: '切割角度', type: 'range', min: -40, max: 40, step: 1, default: -12, unit: '°' },
    { key: 'gap', label: '錯開距離', type: 'range', min: 0.02, max: 0.3, step: 0.01, default: 0.12, hint: '相對於字級' },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc } = ctx.s;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.5, maxWidth: W * 0.8 });
    const fs = L.fontSize;
    const k = ctx.s.intensity;
    const th = (num(ctx, 'angle', -12) * Math.PI) / 180;
    const ux = Math.cos(th);
    const uy = Math.sin(th);
    const nx = -uy;
    const ny = ux;
    const cx = W / 2;
    const cy = L.y + L.height / 2;
    const gap = Math.max(fs * num(ctx, 'gap', 0.12) * 2 * k, 2);
    const BIG = (W + H) * 2;
    // projection range of the text box on the cut direction
    const proj = [
      [L.x, L.y],
      [L.x + L.width, L.y],
      [L.x, L.y + L.height],
      [L.x + L.width, L.y + L.height],
    ].map(([x, y]) => (x - cx) * ux + (y - cy) * uy);
    const smin = Math.min(...proj) - fs * 0.2;
    const smax = Math.max(...proj) + fs * 0.2;
    const N = Math.round(clamp(22 * ctx.q, 8, 26));
    const bounds = Array.from({ length: N + 1 }, (_, i) => smin + ((smax - smin) * i) / N);
    const P = (s: number, o: number) => `${(cx + ux * s + nx * o).toFixed(1)}px ${(cy + uy * s + ny * o).toFixed(1)}px`;

    const strips: { a: HTMLDivElement; b: HTMLDivElement; mid: number }[] = [];
    for (let i = 0; i < N; i++) {
      const s0 = i === 0 ? -BIG : bounds[i];
      const s1 = i === N - 1 ? BIG : bounds[i + 1];
      // tiny overlap hides hairline seams between neighbouring strips
      const e0 = s0 - 0.6;
      const e1 = s1 + 0.6;
      const mk = (side: number) => {
        const piece = el('div', { style: { position: 'absolute', left: '0', top: '0', width: `${W}px`, height: `${H}px`, willChange: 'transform' } }, ctx.root);
        textBlock(piece, L, { color: fg });
        piece.style.clipPath = `polygon(${P(e0, 0)}, ${P(e1, 0)}, ${P(e1, side * BIG)}, ${P(e0, side * BIG)})`;
        return piece;
      };
      strips.push({ a: mk(-1), b: mk(1), mid: (bounds[i] + bounds[i + 1]) / 2 });
    }

    // overlay: aim line, beam, hot edges, sparks, head flare
    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;overflow:visible;pointer-events:none' });
    ctx.root.appendChild(svg);
    const uid = `lc${Math.floor(ctx.rand() * 1e9)}`;
    const defs = svgEl('defs', {}, svg);
    const blur = svgEl('filter', { id: `${uid}b`, x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
    svgEl('feGaussianBlur', { stdDeviation: Math.max(2, fs * 0.05) }, blur);
    const aim = svgEl('line', { stroke: acc, 'stroke-width': 1, 'stroke-dasharray': `${fs * 0.08} ${fs * 0.12}`, opacity: 0 }, svg);
    const edgeA = svgEl('polyline', { fill: 'none', stroke: acc, 'stroke-width': Math.max(1.5, fs * 0.025), 'stroke-linejoin': 'round' }, svg);
    const edgeB = svgEl('polyline', { fill: 'none', stroke: acc, 'stroke-width': Math.max(1.5, fs * 0.025), 'stroke-linejoin': 'round' }, svg);
    const beamGlow = svgEl('line', { stroke: acc, 'stroke-width': Math.max(5, fs * 0.12), filter: `url(#${uid}b)`, 'stroke-linecap': 'round' }, svg);
    const beam = svgEl('line', { stroke: acc, 'stroke-width': Math.max(2, fs * 0.035), 'stroke-linecap': 'round' }, svg);
    const beamCore = svgEl('line', { stroke: fg, 'stroke-width': Math.max(1, fs * 0.012), 'stroke-linecap': 'round' }, svg);
    const sparkG = svgEl('g', { stroke: acc, 'stroke-linecap': 'round', 'stroke-width': Math.max(1, fs * 0.014) }, svg);
    const nSpark = Math.round(48 * ctx.q * clamp(k, 0.3, 1.5));
    const sparks = Array.from({ length: nSpark }, () => svgEl('line', {}, sparkG));
    const flare = svgEl('circle', { r: fs * 0.22, fill: acc, filter: `url(#${uid}b)` }, svg);
    const flareCore = svgEl('circle', { r: Math.max(2, fs * 0.05), fill: fg }, svg);
    const setLine = (ln: SVGLineElement, s0: number, s1: number, o = 0) => {
      ln.setAttribute('x1', (cx + ux * s0 + nx * o).toFixed(1));
      ln.setAttribute('y1', (cy + uy * s0 + ny * o).toFixed(1));
      ln.setAttribute('x2', (cx + ux * s1 + nx * o).toFixed(1));
      ln.setAttribute('y2', (cy + uy * s1 + ny * o).toFixed(1));
    };
    // beam enters from beyond the stage edge
    const sEdge0 = -Math.hypot(W, H) * 0.6;
    const sEdge1 = Math.hypot(W, H) * 0.6;
    setLine(aim, sEdge0, sEdge1);

    const C = 4.8;
    const T0 = 0.5; // sweep start
    const TS = 1.5; // sweep duration
    const HOLD_END = 3.1;
    const FUSE = 0.75;
    const eSweep = ease('sine.inOut');
    const eFuse = ease('expo.inOut');
    const ramp = (smax - smin) * 0.3;
    const headStart = smin - fs * 0.6;
    const headEnd = smax + fs * 0.6;
    const headAt = (u: number) => headStart + (headEnd - headStart) * eSweep(clamp((u - T0) / TS, 0, 1));

    return {
      render(time) {
        const u = time % C;
        const head = headAt(u);
        const sweeping = u >= T0 && u <= T0 + TS;
        const fuse = eFuse(clamp((u - HOLD_END) / FUSE, 0, 1));
        const ptsA: string[] = [];
        const ptsB: string[] = [];
        strips.forEach((st, i) => {
          const behind = u < T0 ? -1 : head - st.mid;
          const open = smoothstep(0, ramp, behind) * (1 - fuse);
          const o = (gap / 2) * open;
          const slip = o * 0.35;
          st.a.style.transform = `translate3d(${(-nx * o - ux * slip).toFixed(2)}px,${(-ny * o - uy * slip).toFixed(2)}px,0)`;
          st.b.style.transform = `translate3d(${(nx * o + ux * slip).toFixed(2)}px,${(ny * o + uy * slip).toFixed(2)}px,0)`;
          if (behind > 0) {
            for (const [arr, sg] of [
              [ptsA, -1],
              [ptsB, 1],
            ] as const) {
              const sl = sg * slip;
              for (const s of [bounds[i], bounds[i + 1]]) {
                const ss = Math.min(s, head);
                arr.push(`${(cx + ux * (ss + sl) + nx * o * sg).toFixed(1)},${(cy + uy * (ss + sl) + ny * o * sg).toFixed(1)}`);
              }
            }
          }
        });
        // hot cut faces: bright while cutting, cool during the hold, re-heat while welding
        const heat = u < T0 ? 0 : u < T0 + TS + 0.2 ? 1 : u < HOLD_END ? Math.max(0.15, 1 - (u - T0 - TS - 0.2) / 0.8) : 0.25 + 0.75 * Math.sin(Math.PI * clamp((u - HOLD_END) / (FUSE + 0.4), 0, 1));
        const edgeOn = u > T0 && u < HOLD_END + FUSE + 0.4;
        edgeA.setAttribute('points', edgeOn ? ptsA.join(' ') : '');
        edgeB.setAttribute('points', edgeOn ? ptsB.join(' ') : '');
        edgeA.setAttribute('opacity', String(heat));
        edgeB.setAttribute('opacity', String(heat));

        // beam: from beyond the stage edge to the head; fades after the head exits
        const beamO = u < T0 ? 0 : u <= T0 + TS ? 1 : Math.max(0, 1 - (u - T0 - TS) / 0.3);
        const retract = clamp((u - T0 - TS) / 0.3, 0, 1);
        const b0 = sEdge0 + (headEnd - sEdge0) * (1 - (1 - retract) ** 3);
        for (const ln of [beamGlow, beam, beamCore]) {
          setLine(ln, b0, u < T0 ? sEdge0 : head);
          ln.setAttribute('opacity', String(beamO * (ln === beamGlow ? 0.8 : 1)));
        }
        aim.setAttribute('opacity', String(u < T0 ? 0.35 * clamp(u / 0.3, 0, 1) : sweeping ? 0.35 : Math.max(0, 0.35 - (u - T0 - TS) * 1.5)));
        const hx = cx + ux * head;
        const hy = cy + uy * head;
        flare.setAttribute('cx', String(hx));
        flare.setAttribute('cy', String(hy));
        flareCore.setAttribute('cx', String(hx));
        flareCore.setAttribute('cy', String(hy));
        const fo = sweeping ? 1 : 0;
        flare.setAttribute('opacity', String(fo * (0.75 + 0.25 * hash2(Math.floor(time * 40), 3, ctx.seed))));
        flareCore.setAttribute('opacity', String(fo));

        // sparks: spawned at the head while it cuts through the text, ballistic
        sparks.forEach((sp, j) => {
          const birth = T0 + ((j + 0.5) / nSpark) * TS;
          const age = u - birth;
          const sb = headAt(birth);
          if (age < 0 || age > 0.55 || sb < smin || sb > smax) {
            sp.setAttribute('opacity', '0');
            return;
          }
          const r1 = hash2(j, 1, ctx.seed);
          const r2 = hash2(j, 2, ctx.seed);
          const sp0 = fs * (2 + r1 * 4);
          const ang = th + Math.PI + (r2 - 0.5) * 2.4; // spray backwards from the cut
          const vx = Math.cos(ang) * sp0;
          const vy = Math.sin(ang) * sp0;
          const g = fs * 9;
          const x = cx + ux * sb + vx * age;
          const y = cy + uy * sb + vy * age + 0.5 * g * age * age;
          const tx = vx;
          const ty = vy + g * age;
          const tl = 0.03;
          sp.setAttribute('x1', x.toFixed(1));
          sp.setAttribute('y1', y.toFixed(1));
          sp.setAttribute('x2', (x - tx * tl).toFixed(1));
          sp.setAttribute('y2', (y - ty * tl).toFixed(1));
          sp.setAttribute('opacity', String(1 - age / 0.55));
        });
      },
    };
  },
};
export default impl;
