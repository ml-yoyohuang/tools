import { svgEl } from '../../engine/dom';
import { bool, clamp, num, PALETTE } from '../../engine/helpers';
import { hash2, mulberry32 } from '../../engine/random';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// One strike per ≥3 s cycle. The bolt is a seeded midpoint-displacement polyline
// (new shape every cycle): a stepped leader crawls down, the return stroke lights
// the bolt (two quick local pulses, never a full-screen flash), glyphs appear
// outward from the impact point with jitter and short crackling arcs, then settle.
// Low-stimulus mode: no glow, no brightness flicker, arcs change slowly.
type P = [number, number];

function displace(a: P, b: P, depth: number, rough: number, rnd: () => number): P[] {
  let pts: P[] = [a, b];
  let amp = Math.hypot(b[0] - a[0], b[1] - a[1]) * rough;
  for (let d = 0; d < depth; d++) {
    const next: P[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1];
      const q = pts[i];
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const len = Math.hypot(dx, dy) || 1;
      const off = (rnd() * 2 - 1) * amp;
      const t = 0.4 + rnd() * 0.2;
      next.push([p[0] + dx * t + (-dy / len) * off, p[1] + dy * t + (dx / len) * off]);
      next.push(q);
    }
    pts = next;
    amp *= 0.52;
  }
  return pts;
}
const toD = (pts: P[], n = pts.length) => {
  let d = '';
  for (let i = 0; i < Math.min(n, pts.length); i++) d += `${i ? 'L' : 'M'}${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  return d || 'M0 0';
};

const impl: EffectImpl = {
  id: 'lightning-strike',
  defaults: { ...PALETTE.darkViolet },
  loopable: true,
  posterTime: 1.7,
  maxChars: 30,
  params: [
    { key: 'lowStim', label: '低刺激模式', type: 'toggle', default: false, hint: '移除光暈與亮度閃爍，只保留電光描線（系統偏好減少動態時自動開啟）。' },
    { key: 'branches', label: '分岔數', type: 'range', min: 0, max: 6, step: 1, default: 3 },
    { key: 'arcs', label: '電弧數', type: 'range', min: 0, max: 16, step: 1, default: 8 },
  ],
  create(ctx): EffectRuntime {
    const low = bool(ctx, 'lowStim', false) || ctx.reducedMotion;
    const nBranch = Math.round(num(ctx, 'branches', 3));
    const nArcs = Math.round(num(ctx, 'arcs', 8) * Math.max(0.4, ctx.q) * clamp(ctx.s.intensity, 0.3, 1.5));
    const k = ctx.s.intensity;
    const { primary: fg, secondary: acc } = ctx.s;
    const W = ctx.width;
    const H = ctx.height;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.42, maxWidth: W * 0.82, cy: H * 0.58 });
    const fs = L.fontSize;
    const uid = `ls${Math.floor(ctx.rand() * 1e9)}`;

    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;overflow:visible' });
    ctx.root.appendChild(svg);
    const defs = svgEl('defs', {}, svg);
    const glow = svgEl('filter', { id: `${uid}g`, x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    svgEl('feGaussianBlur', { stdDeviation: Math.max(2, fs * 0.05) }, glow);
    const rg = svgEl('radialGradient', { id: `${uid}r` }, defs);
    svgEl('stop', { offset: '0', 'stop-color': acc, 'stop-opacity': 0.55 }, rg);
    svgEl('stop', { offset: '1', 'stop-color': acc, 'stop-opacity': 0 }, rg);
    const sky = svgEl('linearGradient', { id: `${uid}s`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svgEl('stop', { offset: '0', 'stop-color': acc, 'stop-opacity': 0.14 }, sky);
    svgEl('stop', { offset: '0.45', 'stop-color': acc, 'stop-opacity': 0 }, sky);
    svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#${uid}s)` }, svg);

    const impact = svgEl('ellipse', { rx: fs * 1.6, ry: fs * 1.1, fill: `url(#${uid}r)`, opacity: 0 }, svg);
    const boltG = svgEl('g', { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    const boltGlow = svgEl('path', { stroke: acc, 'stroke-width': Math.max(4, fs * 0.09), filter: `url(#${uid}g)`, opacity: 0 }, boltG);
    const boltOuter = svgEl('path', { stroke: acc, 'stroke-width': Math.max(2.5, fs * 0.06) }, boltG);
    const boltCore = svgEl('path', { stroke: fg, 'stroke-width': Math.max(1.2, fs * 0.025) }, boltG);
    const branches = Array.from({ length: nBranch }, () => svgEl('path', { stroke: acc, 'stroke-width': Math.max(1, fs * 0.022) }, boltG));

    const textGlow = svgEl('g', { filter: `url(#${uid}g)`, opacity: 0 }, svg);
    const textG = svgEl('g', {}, svg);
    const mkText = (parent: SVGGElement, fill: string, stroke?: string) =>
      L.chars.map((c) => {
        const t = svgEl('text', { x: c.cx, y: c.cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill, style: `font:${L.font}` }, parent);
        if (stroke) {
          t.setAttribute('stroke', stroke);
          t.setAttribute('stroke-width', String(fs * 0.06));
        }
        t.textContent = c.ch;
        return t;
      });
    const glowChars = low ? [] : mkText(textGlow, acc, acc);
    const chars = mkText(textG, fg);
    const arcsG = svgEl('g', { fill: 'none', stroke: acc, 'stroke-width': Math.max(1.2, fs * 0.016), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const arcCore = svgEl('g', { fill: 'none', stroke: fg, 'stroke-width': Math.max(0.6, fs * 0.006) }, svg);
    const arcs = Array.from({ length: nArcs }, () => ({ o: svgEl('path', {}, arcsG), c: svgEl('path', {}, arcCore) }));

    const C = 3.4; // cycle — one strike, one local glow pulse per cycle
    const STRIKE = 0.32;
    // per-cycle bolt geometry, cached
    let cycleBuilt = -1;
    let main: P[] = [];
    let branchPts: P[][] = [];
    let target = L.chars[0] ?? { cx: W / 2, cy: H / 2, y: H / 2 };
    const build = (cy: number) => {
      const rnd = mulberry32(ctx.seed * 7 + cy * 9973 + 11);
      target = L.chars[Math.floor(rnd() * L.chars.length)] ?? target;
      const end: P = [target.cx, target.y + L.lineHeight * 0.12];
      const start: P = [clamp(end[0] + (rnd() - 0.5) * W * 0.5, W * 0.1, W * 0.9), -fs * 0.3];
      main = displace(start, end, 7, 0.16 * Math.max(0.4, k), rnd);
      branchPts = branches.map(() => {
        const i0 = Math.floor((0.15 + rnd() * 0.55) * main.length);
        const a = main[i0];
        const side = rnd() < 0.5 ? -1 : 1;
        const len = Math.hypot(end[0] - start[0], end[1] - start[1]) * (0.15 + rnd() * 0.2);
        const ang = Math.PI / 2 + side * (0.4 + rnd() * 0.6);
        return displace(a, [a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len], 5, 0.22, rnd);
      });
      boltOuter.setAttribute('d', toD(main));
      boltCore.setAttribute('d', toD(main));
      boltGlow.setAttribute('d', toD(main));
      branches.forEach((b, i) => b.setAttribute('d', toD(branchPts[i])));
      impact.setAttribute('cx', String(end[0]));
      impact.setAttribute('cy', String(end[1]));
      cycleBuilt = cy;
    };
    const maxD = Math.max(1, ...L.chars.map((c) => Math.hypot(c.cx - L.chars[0].cx, c.cy - L.chars[0].cy)), L.width);

    return {
      settle: STRIKE + 1.4,
      render(time) {
        const cy = Math.floor(time / C);
        const u = time - cy * C;
        if (cy !== cycleBuilt) build(cy);

        // ---- bolt ----
        let bright = 0;
        let leader = 0;
        if (u < STRIKE) {
          leader = Math.floor((u / STRIKE) * 9) / 9; // stepped leader
        } else if (low) {
          bright = clamp(1 - (u - STRIKE) / 0.7, 0, 1);
        } else {
          const a = u - STRIKE;
          bright = a < 0.07 ? 1 : a < 0.11 ? 0.3 : a < 0.19 ? 1 : Math.exp(-(a - 0.19) / 0.12);
        }
        if (leader > 0) {
          const n = Math.max(2, Math.floor(main.length * leader));
          boltOuter.setAttribute('d', toD(main, n));
          boltCore.setAttribute('d', toD(main, n));
          boltOuter.setAttribute('opacity', '0.45');
          boltCore.setAttribute('opacity', '0.3');
          boltGlow.setAttribute('opacity', '0');
          branches.forEach((b) => b.setAttribute('opacity', '0'));
          boltG.dataset.full = '';
        } else {
          if (!boltG.dataset.full) {
            boltOuter.setAttribute('d', toD(main));
            boltCore.setAttribute('d', toD(main));
            boltG.dataset.full = '1';
          }
          boltOuter.setAttribute('opacity', String(bright));
          boltCore.setAttribute('opacity', String(bright));
          boltGlow.setAttribute('opacity', low ? '0' : String(bright * 0.9));
          branches.forEach((b, i) => b.setAttribute('opacity', String(bright * (0.55 + 0.1 * i))));
        }
        // single local glow pulse at the impact point (never full screen)
        impact.setAttribute('opacity', low || u < STRIKE ? '0' : String(Math.exp(-(u - STRIKE) / 0.28)));

        // ---- glyphs ----
        const fadeOut = clamp((u - (C - 0.5)) / 0.4, 0, 1);
        const q30 = Math.floor(time * 30);
        L.chars.forEach((c, i) => {
          const delay = (Math.hypot(c.cx - target.cx, c.cy - target.cy) / maxD) * 0.3;
          const age = u - STRIKE - delay;
          let o = 0;
          let jx = 0;
          let jy = 0;
          if (age > 0) {
            if (low) o = clamp(age / 0.25, 0, 1);
            else o = age < 0.22 ? (hash2(i, q30, ctx.seed) < 0.3 + age * 3 ? 1 : 0.15) : 1;
            const amp = fs * 0.08 * k * Math.exp(-age / 0.18) * (low ? 0.4 : 1);
            jx = (hash2(i * 3, q30, ctx.seed) - 0.5) * amp;
            jy = (hash2(i * 3 + 1, q30, ctx.seed) - 0.5) * amp;
          }
          o *= 1 - fadeOut;
          const tr = `translate(${jx.toFixed(2)} ${(jy - fadeOut * fs * 0.15).toFixed(2)})`;
          chars[i].setAttribute('opacity', String(o));
          chars[i].setAttribute('transform', tr);
          if (glowChars[i]) {
            glowChars[i].setAttribute('opacity', String(age > 0 ? Math.exp(-age / 0.35) : 0));
            glowChars[i].setAttribute('transform', tr);
          }
        });
        textGlow.setAttribute('opacity', low ? '0' : '0.9');

        // ---- crackling arcs between / around glyphs ----
        const hz = low ? 5 : 20;
        const step = Math.floor(time * hz);
        arcs.forEach((a, j) => {
          const age = u - STRIKE - 0.04 * j;
          // dense right after the strike, then a few residual crackles during the hold
          const p = age < 0 ? 0 : age < 0.9 ? 0.85 - age * 0.6 : u > 1.9 && u < 2.15 && j < 2 ? 0.8 : 0;
          const r = mulberry32(ctx.seed + j * 131 + step * 7919);
          if (L.chars.length === 0 || r() > p || fadeOut > 0) {
            a.o.setAttribute('d', 'M0 0');
            a.c.setAttribute('d', 'M0 0');
            return;
          }
          const g1 = L.chars[Math.floor(r() * L.chars.length)];
          const g2 = L.chars[Math.floor(r() * L.chars.length)];
          const ang = r() * Math.PI * 2;
          const p1: P = [g1.cx + Math.cos(ang) * fs * 0.45, g1.cy + Math.sin(ang) * fs * 0.45];
          const p2: P =
            g1 === g2 || r() < 0.4
              ? [g1.cx + Math.cos(ang + 1.6 + r()) * fs * 0.55, g1.cy + Math.sin(ang + 1.6 + r()) * fs * 0.55]
              : [g2.cx + (r() - 0.5) * fs * 0.6, g2.cy + (r() - 0.5) * fs * 0.6];
          const d = toD(displace(p1, p2, 4, 0.28, r));
          a.o.setAttribute('d', d);
          a.c.setAttribute('d', d);
        });
        arcsG.setAttribute('opacity', low ? '0.8' : '1');
      },
    };
  },
};
export default impl;
