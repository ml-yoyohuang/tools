import { el } from '../../engine/dom';
import { clamp, num, PALETTE, timelineRuntime } from '../../engine/helpers';
import { fontString, graphemes, phrases, textWidth } from '../../engine/text';
import type { EffectImpl } from '../../engine/types';

// Phrases become a typographic stack. Each line has its own weight / size / colour /
// alignment (heavy-light contrast, alternating flush left/right) and enters through
// its own mask from a different direction (expo.out + skew). Shorter lines get a rule
// that fills the empty measure. After a hold the whole stack is pushed up and out.
function stackLines(text: string): string[] {
  const ps = phrases(text);
  if (ps.length > 1) return ps.slice(0, 7);
  const p = ps[0];
  if (/\s/.test(p)) {
    const words: string[] = [];
    // glue very short words (emoji, single letters) onto the previous one
    for (const w of p.split(/\s+/).filter(Boolean)) {
      if (words.length && graphemes(w).length <= 2) words[words.length - 1] += ' ' + w;
      else words.push(w);
    }
    if (words.length <= 4) return words;
    const per = Math.ceil(words.length / 4);
    const out: string[] = [];
    for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per).join(' '));
    return out;
  }
  const g = graphemes(p);
  if (g.length <= 4) return [p];
  const nLines = g.length <= 8 ? 2 : g.length <= 14 ? 3 : 4;
  const per = Math.ceil(g.length / nLines);
  const out: string[] = [];
  for (let i = 0; i < g.length; i += per) out.push(g.slice(i, i + per).join(''));
  return out;
}

const WEIGHTS = [900, 300, 900, 500, 800, 200, 900];
const FACTORS = [1, 0.66, 0.88, 0.58, 0.95, 0.7, 0.8];

const impl: EffectImpl = {
  id: 'kinetic-stack',
  defaults: { ...PALETTE.darkPink },
  loopable: true,
  posterTime: 2.4,
  maxChars: 36,
  textHint: '用「／」分隔，每個片語是一行，依序飛入堆疊。',
  params: [
    { key: 'stagger', label: '批次間隔', type: 'range', min: 0.15, max: 1, step: 0.05, default: 0.4, unit: 's' },
    { key: 'contrast', label: '大小對比', type: 'range', min: 0, max: 1, step: 0.05, default: 0.7 },
    { key: 'rules', label: '補白線條', type: 'toggle', default: true },
  ],
  create(ctx) {
    const lines = stackLines(ctx.text);
    const stagger = num(ctx, 'stagger', 0.4);
    const contrast = num(ctx, 'contrast', 0.7);
    const showRules = ctx.s.params.rules !== false;
    const k = ctx.s.intensity;
    const fam = ctx.font.sans;
    const tr = ctx.s.tracking;
    const blockW = ctx.width * (ctx.width < ctx.height ? 0.86 : 0.8);
    const lh = 1.08;

    const specs = lines.map((text, i) => {
      const weight = lines.length === 1 ? 900 : WEIGHTS[i % WEIGHTS.length];
      const f = lines.length === 1 ? 1 : 1 - (1 - FACTORS[i % FACTORS.length]) * contrast;
      const w1 = Math.max(0.2, textWidth(text, 1, fam, weight, tr));
      return { text, weight, size: (blockW * f) / Math.max(w1, 2.2), w1 };
    });
    // vertical fit
    // scale uniformly so the width ratios (the hierarchy) survive the fit
    const maxLine = ctx.height * (lines.length === 1 ? 0.5 : 0.42);
    const biggest = Math.max(...specs.map((s) => s.size));
    const total = specs.reduce((a, s) => a + s.size * lh, 0);
    const widest = Math.max(...specs.map((s) => s.size * s.w1));
    const fitK = Math.min(
      Math.min(1, maxLine / biggest, (ctx.height * 0.82) / total) * ctx.s.fontScale,
      (ctx.height * 0.94) / total,
      (ctx.width * 0.94) / widest,
    );
    let maxW = 0;
    for (const s of specs) {
      s.size *= fitK;
      maxW = Math.max(maxW, s.w1 * s.size);
    }
    const realBlockW = lines.length > 1 ? Math.min(ctx.width * 0.9, Math.max(maxW * 1.3, blockW * 0.5)) : maxW;
    const left = (ctx.width - realBlockW) / 2;
    const totalH = specs.reduce((a, s) => a + s.size * lh, 0);
    let y = (ctx.height - totalH) / 2;

    return timelineRuntime(ctx, (tl) => {
      const group = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);
      const items = specs.map((s, i) => {
        const w = s.w1 * s.size;
        const alignRight = lines.length > 1 && i % 2 === 1;
        const x = alignRight ? left + realBlockW - w : left;
        const h = s.size * lh;
        const mask = el('div', {
          style: { position: 'absolute', left: x - s.size * 0.05, top: y, width: w + s.size * 0.1, height: h, overflow: 'hidden' },
        }, group);
        const inner = el('div', {
          text: s.text,
          style: {
            position: 'absolute', left: s.size * 0.05, top: '0', font: fontString(s.size, fam, s.weight), lineHeight: `${h}px`, whiteSpace: 'pre',
            letterSpacing: `${tr}em`, color: i % 2 === 1 ? ctx.s.secondary : ctx.s.primary, willChange: 'transform',
          },
        }, mask);
        // rule filling the empty measure next to shorter lines
        const free = realBlockW - w;
        let rule: HTMLDivElement | null = null;
        if (showRules && free > realBlockW * 0.12) {
          const th = Math.max(2, s.size * 0.06);
          const gapX = s.size * 0.22;
          rule = el('div', {
            style: {
              position: 'absolute', top: y + h * 0.52 - th / 2, height: th, width: Math.max(0, free - gapX), background: i % 2 ? ctx.s.primary : ctx.s.secondary,
              left: alignRight ? left : x + w + gapX, transformOrigin: alignRight ? '100% 50%' : '0% 50%',
            },
          }, group);
        }
        y += h;
        return { inner, rule, i };
      });

      const dirs = [
        { xPercent: -105, yPercent: 0, skewX: 14 },
        { xPercent: 105, yPercent: 0, skewX: -14 },
        { xPercent: 0, yPercent: 105, skewX: 0 },
        { xPercent: 105, yPercent: 0, skewX: -10 },
        { xPercent: 0, yPercent: -105, skewX: 0 },
      ];
      items.forEach(({ inner, rule, i }) => {
        const d = dirs[i % dirs.length];
        const t0 = 0.15 + i * stagger;
        tl.set(inner, { xPercent: d.xPercent, yPercent: d.yPercent, skewX: d.skewX * clamp(k, 0, 2) }, 0);
        tl.to(inner, { xPercent: 0, yPercent: 0, skewX: 0, duration: 0.75, ease: 'expo.out' }, t0);
        if (rule) {
          tl.set(rule, { scaleX: 0 }, 0);
          tl.to(rule, { scaleX: 1, duration: 0.6, ease: 'power4.out' }, t0 + 0.25);
        }
      });
      const done = 0.15 + (items.length - 1) * stagger + 0.75;
      const settle = done + 0.3;
      const exit = done + 1.5;
      // whole stack is pushed up through the masks, top line first
      items.forEach(({ inner, rule, i }) => {
        tl.to(inner, { yPercent: -110, duration: 0.42, ease: 'power3.in' }, exit + i * 0.06);
        if (rule) tl.to(rule, { scaleX: 0, duration: 0.3, ease: 'power2.in' }, exit + i * 0.06);
      });
      tl.to({}, { duration: 0.2 }, '>');
      return { settle };
    });
  },
};
export default impl;
