import { el, textBlock } from '../../engine/dom';
import { clamp, ease, num, PALETTE } from '../../engine/helpers';
import { layoutText, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// N horizontal slices, each a CSS-3D square prism (depth = slice height).
// Front face: current phrase, bottom face: next phrase — both are full copies
// of the phrase layout offset by −sliceTop inside an overflow-hidden face, so the
// slices line up exactly. rotateX 0 → 90° (staggered) brings the bottom faces
// forward. Once all slices are at 90° the prisms snap back to 0° with the next
// phrase on the front, which is visually identical, so the cycle is seamless.
// With a single phrase it alternates between the normal and an inverted panel.

const impl: EffectImpl = {
  id: 'text-blinds',
  defaults: { ...PALETTE.lime },
  posterTime: 2.75,
  maxChars: 40,
  textHint: '用「／」分隔多個詞會依序翻面；只有一個詞時會在正常與反白之間切換。',
  params: [
    { key: 'slices', label: '切片數', type: 'range', min: 3, max: 18, step: 1, default: 8 },
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.5, max: 4, step: 0.1, default: 1.6, unit: 's' },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    let list = phrases(ctx.text);
    const single = list.length === 1;
    if (single) list = [list[0], list[0]];
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const styles = list.map((_, j) => (j % 2 === 0 ? { bg, fg } : single ? { bg: fg, fg: bg } : { bg: acc, fg }));
    const layouts = list.map((p) => layoutText(ctx, p, { maxHeight: H * 0.5, maxWidth: W * 0.76 }));
    const fs = Math.max(...layouts.map((l) => l.fontSize));
    const pad = fs * 0.32;
    const x0 = Math.max(4, Math.min(...layouts.map((l) => l.x)) - pad * 1.4);
    const x1 = Math.min(W - 4, Math.max(...layouts.map((l) => l.x + l.width)) + pad * 1.4);
    const y0 = Math.max(4, Math.min(...layouts.map((l) => l.y)) - pad);
    const y1 = Math.min(H - 4, Math.max(...layouts.map((l) => l.y + l.height)) + pad);
    const pw = x1 - x0;
    const ph = y1 - y0;
    const n = Math.max(3, Math.round(num(ctx, 'slices', 8) * (ctx.mode === 'card' ? 0.75 : 1)));
    const h = ph / n;
    const gap = -0.5; // faces overlap by half a pixel: no seams through the glyphs at rest
    const hold = num(ctx, 'hold', 1.6);
    const k = clamp(ctx.s.intensity, 0.2, 2);

    const board = el(
      'div',
      { style: { position: 'absolute', left: x0, top: y0, width: pw, height: ph, perspective: `${Math.max(W, H) * 1.6}px`, perspectiveOrigin: '50% 50%' } },
      ctx.root,
    );
    interface Face {
      face: HTMLDivElement;
      contents: HTMLDivElement[];
      shade: HTMLDivElement;
      shown: number;
    }
    const mkFace = (prism: HTMLElement, i: number, transform: string): Face => {
      const face = el(
        'div',
        { style: { position: 'absolute', left: '0', top: '0', width: pw, height: h - gap, overflow: 'hidden', backfaceVisibility: 'hidden', transform } },
        prism,
      );
      const contents = layouts.map((L, j) => {
        const c = el('div', { style: { position: 'absolute', left: -x0, top: -y0 - i * h, width: W, height: H, display: 'none' } }, face);
        textBlock(c, L, { color: styles[j].fg });
        return c;
      });
      const shade = el('div', { style: { position: 'absolute', inset: '0', background: '#000', opacity: 0 } }, face);
      return { face, contents, shade, shown: -1 };
    };
    const show = (f: Face, j: number) => {
      if (f.shown === j) return;
      if (f.shown >= 0) f.contents[f.shown].style.display = 'none';
      f.contents[j].style.display = 'block';
      f.face.style.background = styles[j].bg;
      f.shown = j;
    };
    const prisms = Array.from({ length: n }, (_, i) => {
      const prism = el(
        'div',
        { style: { position: 'absolute', left: '0', top: i * h, width: pw, height: h - gap, transformStyle: 'preserve-3d', transformOrigin: '50% 50% 0' } },
        board,
      );
      const d = (h - gap) / 2;
      const back = mkFace(prism, i, `rotateX(-90deg) translateZ(${d}px)`);
      const front = mkFace(prism, i, `translateZ(${d}px)`);
      return { prism, front, back, d, last: NaN };
    });

    const stagger = Math.min(0.08, 0.7 / n);
    const flipD = 0.62 / Math.sqrt(k);
    const flipAll = (n - 1) * stagger + flipD;
    const seg = flipAll + hold;
    const cycle = seg * list.length;
    const flipE = ease('back.out(1.5)');

    return {
      render(time) {
        const tt = (time + hold * 0.4) % cycle; // open on phrase 0, first flip after 0.6·hold
        const si = Math.floor(tt / seg);
        const lt = tt - si * seg - hold; // flip happens at the end of each segment
        const cur = si % list.length;
        const next = (si + 1) % list.length;
        prisms.forEach((p, i) => {
          const a = lt < 0 ? 0 : flipE(clamp((lt - i * stagger) / flipD, 0, 1));
          show(p.front, cur);
          show(p.back, next);
          const ang = 90 * a;
          if (ang !== p.last) {
            p.last = ang;
            p.prism.style.transform = `translateZ(${-p.d}px) rotateX(${ang.toFixed(2)}deg)`;
            // edge-on faces can peek through perspective at rest: hide them
            p.back.face.style.visibility = ang < 0.5 ? 'hidden' : 'visible';
            p.front.face.style.visibility = ang > 89.5 && ang < 90.5 ? 'hidden' : 'visible';
            const r = (ang * Math.PI) / 180;
            p.front.shade.style.opacity = (0.55 * clamp(Math.sin(r), 0, 1)).toFixed(3);
            p.back.shade.style.opacity = (0.55 * clamp(Math.cos(r), 0, 1)).toFixed(3);
          }
        });
      },
    };
  },
};
export default impl;
