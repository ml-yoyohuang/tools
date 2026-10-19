import { el } from '../../engine/dom';
import { clamp, ease, mod, num, PALETTE, str } from '../../engine/helpers';
import { fontString, graphemes, phrases, textWidth } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// A full-bleed grid of two-faced cards. Card (r,c) flips 180° about X twice per
// cycle at phase = waveIndex·stagger + parity·cycle/4, so even and odd squares of
// the checkerboard flip in alternating diagonal waves. Front and back swap the
// card/ink colours; a shade overlay sells the rotation. Pure function of t.
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
  id: 'checker-words',
  defaults: { ...PALETTE.teal },
  posterTime: 1.6,
  maxChars: 24,
  textHint: '用「／」分隔，正反面會顯示不同的詞。',
  params: [
    { key: 'density', label: '格子密度', type: 'range', min: 0.5, max: 1.8, step: 0.1, default: 1 },
    { key: 'stagger', label: '波速間隔', type: 'range', min: 0.04, max: 0.3, step: 0.01, default: 0.11, unit: 's' },
    {
      key: 'wave',
      label: '波的方向',
      type: 'select',
      default: 'diag',
      options: [
        { value: 'diag', label: '斜向 ↘' },
        { value: 'anti', label: '斜向 ↙' },
        { value: 'radial', label: '由中心' },
      ],
    },
  ],
  create(ctx): EffectRuntime {
    let words = phrases(ctx.text);
    if (words.length === 1 && graphemes(words[0]).length > 10) words = chunks(words[0], 5);
    const W = ctx.width;
    const H = ctx.height;
    const fam = ctx.font.sans;
    const wEm = Math.max(...words.map((w) => textWidth(w, 100, fam, 800, ctx.s.tracking) / 100), 0.8);
    const A = 0.46 * wEm + 0.5;
    const dens = num(ctx, 'density', 1);
    const rows = clamp(Math.round(Math.sqrt((30 * ctx.q * dens * dens * H * A) / W)), 2, 12);
    const hc = H / rows;
    const cols = Math.max(2, Math.floor(W / (hc * A)));
    const wc = W / cols;
    const gap = Math.max(2, hc * 0.07);
    const fs = Math.max(5, Math.min(hc * 0.46 * ctx.s.fontScale, (wc - gap - hc * 0.25) / wEm));
    const font = fontString(fs, fam, 800);
    const stagger = num(ctx, 'stagger', 0.11);
    const wave = str(ctx, 'wave', 'diag');
    const C = 4.2;
    const F = 0.8;
    const fe = ease(`back.out(${(1 + 0.9 * clamp(ctx.s.intensity, 0, 2)).toFixed(2)})`);
    const persp = hc * 4;
    const rad = Math.max(2, hc * 0.12);
    const { primary: fg, secondary: acc, background: bg } = ctx.s;

    const face = (parent: HTMLElement, front: boolean, text: string) => {
      const f = el(
        'div',
        {
          style: {
            position: 'absolute',
            inset: '0',
            borderRadius: `${rad}px`,
            background: front ? fg : acc,
            color: front ? bg : fg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font,
            letterSpacing: `${ctx.s.tracking}em`,
            whiteSpace: 'pre',
            backfaceVisibility: 'hidden',
            overflow: 'hidden',
            willChange: 'transform',
          },
        },
        parent,
      );
      el('span', { text }, f);
      const shade = el('div', { style: { position: 'absolute', inset: '0', background: '#000', opacity: 0 } }, f);
      return { f, shade };
    };

    const cells: { a: ReturnType<typeof face>; b: ReturnType<typeof face>; phase: number; base: number; last: number }[] = [];
    const maxD = wave === 'radial' ? Math.hypot(rows / 2, cols / 2) : rows + cols - 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const box = el('div', { style: { position: 'absolute', left: `${c * wc + gap / 2}px`, top: `${r * hc + gap / 2}px`, width: `${wc - gap}px`, height: `${hc - gap}px` } }, ctx.root);
        const wi = (r * cols + c) % words.length;
        const a = face(box, true, words[wi]);
        const b = face(box, false, words[(wi + 1) % words.length]);
        const parity = (r + c) % 2;
        const d = wave === 'diag' ? r + c : wave === 'anti' ? r + (cols - 1 - c) : Math.hypot(r + 0.5 - rows / 2, c + 0.5 - cols / 2);
        const phase = (d / Math.max(1, maxD)) * Math.min(stagger * maxD, C * 0.42) + parity * (C / 4);
        cells.push({ a, b, phase, base: parity * 180, last: NaN });
      }
    }

    return {
      render(t) {
        for (const cell of cells) {
          const u = mod(t - cell.phase, C);
          let ang: number;
          if (u < F) ang = 180 * fe(u / F);
          else if (u < C / 2) ang = 180;
          else if (u < C / 2 + F) ang = 180 + 180 * fe((u - C / 2) / F);
          else ang = 360;
          ang = mod(ang + cell.base, 360);
          if (ang === cell.last) continue;
          cell.last = ang;
          cell.a.f.style.transform = `perspective(${persp}px) rotateX(${ang.toFixed(2)}deg)`;
          cell.b.f.style.transform = `perspective(${persp}px) rotateX(${(ang + 180).toFixed(2)}deg)`;
          const sh = (0.45 * Math.abs(Math.sin((ang * Math.PI) / 180))).toFixed(3);
          cell.a.shade.style.opacity = sh;
          cell.b.shade.style.opacity = sh;
        }
      },
    };
  },
};
export default impl;
