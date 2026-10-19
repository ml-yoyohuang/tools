import { svgEl } from '../../engine/dom';
import { clamp, ease, mod, num, PALETTE } from '../../engine/helpers';
import { fitSize, graphemes, phrases, textWidth } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// An SVG dial: phrases set on a circular textPath plus major/minor ticks. Every
// `hold` seconds the dial steps one node (back.inOut) so the next phrase sits
// under the pointer; halfway through the step the centre word swaps with a
// clipped vertical slide (old exits up, new rises from below).
let uid = 0;

/** Split one long phrase into short readable chunks (by words for latin, evenly otherwise). */
function chunks(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  if (words.length > 1) {
    let cur = '';
    for (const w of words) {
      if (cur && graphemes(cur + ' ' + w).length > max) {
        out.push(cur);
        cur = w;
      } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) out.push(cur);
    return out;
  }
  const g = graphemes(text);
  const parts = Math.ceil(g.length / max);
  const size = Math.ceil(g.length / parts);
  for (let i = 0; i < g.length; i += size) out.push(g.slice(i, i + size).join(''));
  return out;
}

const impl: EffectImpl = {
  id: 'rotating-words',
  defaults: { ...PALETTE.paperViolet },
  posterTime: 0.5,
  maxChars: 40,
  textHint: '用「／」分隔圓盤上的詞（建議 3～8 個）。',
  params: [
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.6, max: 4, step: 0.1, default: 1.5, unit: 's' },
    { key: 'turn', label: '旋轉秒數', type: 'range', min: 0.4, max: 2, step: 0.05, default: 0.95, unit: 's' },
  ],
  create(ctx): EffectRuntime {
    let words = phrases(ctx.text);
    if (words.length === 1) {
      const sp = words[0].split(/\s+/).filter(Boolean);
      const g = graphemes(words[0]).filter((c) => c.trim());
      words =
        sp.length >= 2 && sp.length <= 8 ? sp : g.length >= 2 && g.length <= 8 ? g : g.length > 8 ? chunks(words[0], Math.max(3, Math.ceil(g.length / 6))) : [words[0], words[0], words[0], words[0]];
      if (words.length === 1) words = [words[0], words[0], words[0], words[0]];
    }
    const n = words.length;
    const hold = num(ctx, 'hold', 1.5);
    const turn = num(ctx, 'turn', 0.95);
    const segT = hold + turn;
    const cycle = n * segT;
    const k = clamp(ctx.s.intensity, 0, 2);
    const eStep = ease(`back.inOut(${(0.6 + 1.2 * k).toFixed(2)})`);
    const id = `rw${++uid}`;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const fam = ctx.font.sans;

    const W = ctx.width;
    const H = ctx.height;
    const R = Math.min(W, H) * 0.43;
    const cx = W / 2;
    const cy = H / 2 + R * 0.04;
    const Rt = R * 0.84; // text radius (baseline-ish)
    const arc = (2 * Math.PI * Rt) / n;
    const longest = Math.max(...words.map((w) => textWidth(w, 100, fam, 700, ctx.s.tracking)));
    const fRing = clamp(Math.min(R * 0.13, ((arc * 0.72) / longest) * 100), 6, 90);
    const ri = R * 0.66;

    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    ctx.root.appendChild(svg);
    const defs = svgEl('defs', {}, svg);
    // circle path starting at the bottom, going twice around clockwise, so every label sits well inside it
    const pd = `M ${cx} ${cy + Rt} A ${Rt} ${Rt} 0 1 1 ${cx} ${cy - Rt} A ${Rt} ${Rt} 0 1 1 ${cx} ${cy + Rt} A ${Rt} ${Rt} 0 1 1 ${cx} ${cy - Rt} A ${Rt} ${Rt} 0 1 1 ${cx} ${cy + Rt}`;
    svgEl('path', { id: `${id}-p`, d: pd }, defs);
    const clip = svgEl('clipPath', { id: `${id}-c` }, defs);

    // static frame
    svgEl('circle', { cx, cy, r: R, fill: 'none', stroke: fg, 'stroke-width': Math.max(1, R * 0.008) }, svg);
    svgEl('circle', { cx, cy, r: ri, fill: fg, opacity: 0.05 }, svg);
    svgEl('circle', { cx, cy, r: ri, fill: 'none', stroke: fg, 'stroke-width': Math.max(1, R * 0.006), opacity: 0.5 }, svg);

    const dial = svgEl('g', {}, svg);
    // ticks
    const minor = n * 8;
    for (let i = 0; i < minor; i++) {
      const a = (i / minor) * Math.PI * 2;
      const major = i % 8 === 0;
      const r0 = R * (major ? 0.67 : 0.69);
      const r1 = R * (major ? 0.75 : 0.72);
      svgEl(
        'line',
        {
          x1: cx + Math.sin(a) * r0,
          y1: cy - Math.cos(a) * r0,
          x2: cx + Math.sin(a) * r1,
          y2: cy - Math.cos(a) * r1,
          stroke: major ? acc : fg,
          'stroke-width': major ? Math.max(1.5, R * 0.014) : Math.max(1, R * 0.005),
          'stroke-linecap': 'round',
          opacity: major ? 1 : 0.45,
        },
        dial,
      );
    }
    const C = 2 * Math.PI * Rt;
    const labels = words.map((w, i) => {
      const a = (i / n) * 360;
      // the path starts at the bottom and runs clockwise twice; keep every label away from both ends
      let pos = (a + 180) % 360;
      if (pos < 180) pos += 360;
      const off = pos / 360;
      const t = svgEl('text', { 'font-size': fRing, fill: fg, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, dial);
      t.style.fontFamily = fam;
      t.style.fontWeight = '700';
      t.style.letterSpacing = `${ctx.s.tracking}em`;
      const tp = svgEl('textPath', { href: `#${id}-p`, startOffset: (off * C).toFixed(2) }, t);
      tp.textContent = w;
      return t;
    });

    // pointer
    const pw = R * 0.07;
    svgEl('path', { d: `M ${cx - pw} ${cy - R - pw * 1.5} L ${cx + pw} ${cy - R - pw * 1.5} L ${cx} ${cy - R + pw * 0.3} Z`, fill: acc, stroke: bg, 'stroke-width': Math.max(1, pw * 0.15), 'stroke-linejoin': 'round' }, svg);

    // centre words
    const fC = Math.min(...words.map((w) => fitSize(w, ri * 1.6, ri * 0.78, fam, 900, ctx.s.tracking))) * ctx.s.fontScale;
    const fCc = Math.min(fC, ri * 0.85);
    const boxH = fCc * 1.35;
    svgEl('rect', { x: cx - ri, y: cy - boxH / 2, width: ri * 2, height: boxH }, clip);
    const cg = svgEl('g', { 'clip-path': `url(#${id}-c)` }, svg);
    const centre = words.map((w) => {
      const t = svgEl('text', { x: cx, y: cy, 'font-size': fCc, fill: fg, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, cg);
      t.style.fontFamily = fam;
      t.style.fontWeight = '900';
      t.style.letterSpacing = `${ctx.s.tracking}em`;
      t.textContent = w;
      t.setAttribute('visibility', 'hidden');
      return t;
    });
    // index readout
    const fI = Math.max(7, R * 0.055);
    const idx = svgEl('text', { x: cx, y: cy + ri * 0.62, 'font-size': fI, fill: fg, 'text-anchor': 'middle', 'dominant-baseline': 'central', opacity: 0.6 }, svg);
    idx.style.fontFamily = ctx.font.mono;

    const outE = ease('power3.in');
    const inE = ease('expo.out');
    let lastCur = -1;
    return {
      render(time) {
        const t = mod(time, cycle);
        const seg = Math.floor(t / segT);
        const u = t - seg * segT;
        const p = u < hold ? 0 : clamp((u - hold) / turn, 0, 1);
        const rot = -(seg + eStep(p)) * (360 / n);
        dial.setAttribute('transform', `rotate(${rot.toFixed(3)} ${cx} ${cy})`);
        const cur = seg % n;
        const nxt = (seg + 1) % n;
        const active = p < 0.5 ? cur : nxt;
        if (active !== lastCur) {
          labels.forEach((l, i) => {
            l.setAttribute('fill', i === active ? acc : fg);
            l.setAttribute('opacity', i === active ? '1' : '0.55');
          });
          idx.textContent = `${String(active + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
          lastCur = active;
        }
        centre.forEach((c, i) => {
          let y: number | null = null;
          if (p === 0) y = i === cur ? 0 : null;
          else if (i === cur && p < 0.55) y = -outE(clamp(p / 0.5, 0, 1)) * boxH;
          else if (i === nxt && p > 0.4) y = (1 - inE(clamp((p - 0.4) / 0.6, 0, 1))) * boxH;
          if (y === null) c.setAttribute('visibility', 'hidden');
          else {
            c.setAttribute('visibility', 'visible');
            c.setAttribute('transform', `translate(0 ${y.toFixed(2)})`);
          }
        });
      },
    };
  },
};
export default impl;
