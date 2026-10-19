import { el, svgEl } from '../../engine/dom';
import { bool, clamp, ease, num, PALETTE, TAU } from '../../engine/helpers';
import { mulberry32 } from '../../engine/random';
import { layoutText, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// One phrase per beat. Each number drops from 3× scale with power4.in, lands with a
// squash (back.out recovery), a short damped local shake of its own wrapper, radial
// impact lines and seeded cracks (stroke-dash reveal) in the ground around it.
// The previous number sinks away while the next one is falling; the last one holds.
const impl: EffectImpl = {
  id: 'number-slam',
  defaults: { ...PALETTE.lime },
  loopable: true,
  posterTime: 0.5,
  maxChars: 24,
  textHint: '用「／」分隔每一拍，例如「3／2／1／GO」。',
  params: [
    { key: 'beat', label: '每拍秒數', type: 'range', min: 0.5, max: 2, step: 0.05, default: 0.9, unit: 's' },
    { key: 'cracks', label: '裂紋', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc } = ctx.s;
    const k = ctx.s.intensity;
    const list = phrases(ctx.text);
    const B = num(ctx, 'beat', 0.9);
    const withCracks = bool(ctx, 'cracks', true);
    const F = 0.26; // fall time
    const lead = 0.15;

    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;overflow:visible' });
    ctx.root.appendChild(svg);
    const items = list.map((p, idx) => {
      const L = layoutText(ctx, p, { maxHeight: H * 0.68, maxWidth: W * 0.76, lineHeight: 1.05, fill: 0.92 });
      const fs = L.fontSize;
      const cx = L.x + L.width / 2;
      const cy = L.y + L.height / 2;
      const wrap = el('div', { style: { position: 'absolute', inset: '0', visibility: 'hidden', willChange: 'transform' } }, ctx.root);
      const txt = el(
        'div',
        {
          text: L.lines.map((l) => l.text).join('\n'),
          style: {
            position: 'absolute',
            left: `${L.x}px`,
            top: `${L.y}px`,
            width: `${L.width + 2}px`,
            font: L.font,
            lineHeight: `${L.lineHeight}px`,
            letterSpacing: `${L.tracking}em`,
            textAlign: 'center',
            whiteSpace: 'pre',
            color: fg,
            transformOrigin: `50% ${L.height * 0.85}px`,
            willChange: 'transform, opacity',
          },
        },
        wrap,
      );
      // cracks in the "ground", radiating from the number's outline
      const rx = L.width / 2 + fs * 0.08;
      const ry = L.height / 2 + fs * 0.02;
      const crackG = svgEl('g', { fill: 'none', stroke: fg, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, svg);
      const cracks: { path: SVGPathElement; len: number }[] = [];
      if (withCracks) {
        const r = mulberry32(ctx.seed * 13 + idx * 977 + 1);
        const M = Math.round(clamp(7 * ctx.q * k, 3, 9));
        const mk = (x: number, y: number, ang: number, segs: number, seg: number, width: number) => {
          let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
          let len = 0;
          const pts: [number, number][] = [];
          for (let s = 0; s < segs; s++) {
            ang += (r() - 0.5) * 0.9;
            const l = seg * (0.6 + r() * 0.8);
            x += Math.cos(ang) * l;
            y += Math.sin(ang) * l;
            len += l;
            d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
            pts.push([x, y]);
          }
          const path = svgEl('path', { d, 'stroke-width': width, 'stroke-dasharray': `${len} ${len}`, 'stroke-dashoffset': len }, crackG);
          cracks.push({ path, len });
          return { pts, ang };
        };
        for (let m = 0; m < M; m++) {
          const ang = -0.25 * Math.PI + (m / Math.max(1, M - 1)) * 1.5 * Math.PI + (r() - 0.5) * 0.4;
          const x = cx + Math.cos(ang) * rx * 0.92;
          const y = cy + Math.sin(ang) * ry * 0.92;
          const main = mk(x, y, ang, 5 + Math.floor(r() * 4), fs * 0.1, Math.max(1.2, fs * 0.022));
          if (r() < 0.6) {
            const p = main.pts[1 + Math.floor(r() * (main.pts.length - 2))];
            mk(p[0], p[1], main.ang + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.5), 3 + Math.floor(r() * 2), fs * 0.09, Math.max(0.8, fs * 0.012));
          }
        }
      }
      return { wrap, txt, crackG, cracks, cx, cy, rx, ry, fs };
    });

    // impact lines + dust ring, shared
    const nLines = Math.round(clamp(16 * ctx.q, 8, 18));
    const lineG = svgEl('g', { stroke: acc, 'stroke-linecap': 'round' }, svg);
    const lines = Array.from({ length: nLines }, () => svgEl('line', {}, lineG));
    const dust = svgEl('ellipse', { fill: 'none', stroke: fg, opacity: 0 }, svg);

    const n = items.length;
    const lastHold = Math.max(B * 1.8, 1.4);
    const C = lead + (n - 1) * B + F + lastHold + 0.35;
    const eFall = ease('power4.in');
    const eRec = ease('back.out(3)');
    let vis = -999;

    return {
      settle: lead + (n - 1) * B + F + 0.7,
      render(time) {
        const u = time % C;
        const rel = u - lead;
        let cur = clamp(Math.floor(rel / B), 0, n - 1);
        if (rel < 0) cur = 0;
        const a = rel - cur * B; // time since this phrase started falling
        const prev = cur > 0 && a < F ? cur - 1 : -1;
        const showSet = new Set([cur, prev]);
        if (vis !== cur * 100 + prev) {
          items.forEach((it, i) => (it.wrap.style.visibility = showSet.has(i) ? 'visible' : 'hidden'));
          items.forEach((it, i) => (it.crackG.style.display = showSet.has(i) ? '' : 'none'));
          vis = cur * 100 + prev;
        }
        const it = items[cur];
        const endFade = clamp((u - (C - 0.35)) / 0.3, 0, 1);

        // falling / landed number
        let sx = 1;
        let sy = 1;
        let y = 0;
        let op = 1;
        if (a < 0) {
          op = 0;
        } else if (a < F) {
          const p = eFall(a / F);
          const s = 3.2 - 2.2 * p;
          sx = sy = s;
          y = -H * 0.1 * (1 - p);
          op = clamp(a / (F * 0.35), 0, 1);
        } else {
          const b = a - F;
          const r = eRec(clamp(b / 0.22, 0, 1));
          sy = 0.86 + 0.14 * r;
          sx = 1.08 - 0.08 * r;
        }
        it.txt.style.transform = `translate3d(0,${y.toFixed(2)}px,0) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
        it.txt.style.opacity = String(op * (1 - endFade));
        // local damped shake of the landed number's wrapper
        const b = a - F;
        if (b > 0) {
          const amp = it.fs * 0.06 * k * Math.exp(-b / 0.09);
          it.wrap.style.transform = `translate3d(${(amp * Math.sin(b * 95)).toFixed(2)}px,${(amp * 0.7 * Math.sin(b * 120 + 1)).toFixed(2)}px,0) rotate(${(amp * 0.04 * Math.sin(b * 70)).toFixed(3)}deg)`;
        } else it.wrap.style.transform = 'none';
        // previous number sinks away while the next one falls
        if (prev >= 0) {
          const q = a / F;
          items[prev].txt.style.transform = `scale(${(1 - 0.18 * q).toFixed(4)})`;
          items[prev].txt.style.opacity = String(1 - q);
          items[prev].crackG.setAttribute('opacity', String(0.55 * (1 - q)));
        }
        // cracks
        if (b > 0) {
          const q = clamp(b / 0.14, 0, 1);
          for (const c of it.cracks) c.path.setAttribute('stroke-dashoffset', String(c.len * (1 - q)));
          it.crackG.setAttribute('opacity', String(0.55 * (1 - endFade)));
        } else it.crackG.setAttribute('opacity', '0');

        // impact lines + dust ring
        const q = b > 0 ? b / 0.38 : 1;
        if (q < 1) {
          const e = 1 - (1 - q) ** 3;
          const len = it.fs * 0.55 * clamp(k, 0.3, 1.6);
          lines.forEach((ln, i) => {
            const ang = (i / nLines) * TAU + 0.2;
            const r0 = 1.05 + e * 0.35;
            const x = it.cx + Math.cos(ang) * it.rx;
            const yy = it.cy + Math.sin(ang) * it.ry;
            const ux = Math.cos(ang);
            const uy = Math.sin(ang);
            const s0 = (r0 - 1) * it.fs + e * len * 0.5;
            const s1 = (r0 - 1) * it.fs + e * len;
            ln.setAttribute('x1', (x + ux * s0).toFixed(1));
            ln.setAttribute('y1', (yy + uy * s0).toFixed(1));
            ln.setAttribute('x2', (x + ux * s1).toFixed(1));
            ln.setAttribute('y2', (yy + uy * s1).toFixed(1));
            ln.setAttribute('stroke-width', String(Math.max(1.5, it.fs * 0.05 * (1 - q))));
            ln.setAttribute('opacity', String(1 - q));
          });
          dust.setAttribute('cx', String(it.cx));
          dust.setAttribute('cy', String(it.cy + it.ry * 0.95));
          dust.setAttribute('rx', String(it.rx * (0.8 + e * 0.9)));
          dust.setAttribute('ry', String(it.fs * (0.05 + e * 0.12)));
          dust.setAttribute('stroke-width', String(Math.max(1, it.fs * 0.03 * (1 - q))));
          dust.setAttribute('opacity', String(0.5 * (1 - q)));
        } else {
          lines.forEach((ln) => ln.setAttribute('opacity', '0'));
          dust.setAttribute('opacity', '0');
        }
      },
    };
  },
};
export default impl;
