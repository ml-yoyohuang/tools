import { el } from '../../engine/dom';
import { clamp, num } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fontString, graphemes, isLatin, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Each cell = 4 leaves: static top (next char), static bottom (current char),
// a top flap (current char) rotating down 0→-90° about the hinge, then a bottom
// flap (next char) rotating 90→0°. Each cell passes through k seeded random
// characters before landing; state is a pure function of time.
const POOL_CJK = '準時東西南北上下中大小月日火水木金土天地人山川一二三四五六七八九十'.split('');
const POOL_LAT = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

const impl: EffectImpl = {
  id: 'split-flap',
  defaults: { background: '#101114', primary: '#F4F1E8', secondary: '#FF7153' },
  loopable: true,
  posterTime: 3,
  maxChars: 16,
  textHint: '用「／」分隔多組字，會依序翻到下一組。',
  params: [
    { key: 'flip', label: '翻牌間隔', type: 'range', min: 0.04, max: 0.3, step: 0.01, default: 0.09, unit: 's' },
    { key: 'spins', label: '經過張數', type: 'range', min: 1, max: 14, step: 1, default: 6 },
  ],
  create(ctx): EffectRuntime {
    const flip = num(ctx, 'flip', 0.09);
    const spins = Math.round(num(ctx, 'spins', 6) * clamp(ctx.s.intensity, 0.3, 2));
    let list = phrases(ctx.text).map((p) => graphemes(p));
    const n = Math.max(...list.map((l) => l.length));
    if (list.length === 1) list = [list[0], Array(n).fill(' ')];
    list = list.map((l) => [...l, ...Array(n - l.length).fill(' ')]);
    const latin = list.flat().every((c) => c === ' ' || isLatin(c));
    const pool = latin ? POOL_LAT : POOL_CJK;

    // cell geometry
    const gap = ctx.width * 0.012;
    const fitW = (ctx.width * 0.86 - gap * (n - 1)) / n;
    const fitH = (ctx.height * 0.62) / 1.32;
    const maxW = Math.min((ctx.width * 0.96 - gap * (n - 1)) / n, (ctx.height * 0.9) / 1.32);
    const cellW = Math.min(Math.min(fitW, fitH) * ctx.s.fontScale, maxW);
    const cellH = cellW * 1.32;
    const fs = cellW * 0.78;
    const font = fontString(fs, latin ? ctx.font.mono : ctx.font.sans, 900);
    const board = el(
      'div',
      { style: { position: 'absolute', left: '50%', top: '50%', display: 'flex', gap: `${gap}px`, transform: 'translate(-50%,-50%)', perspective: `${cellH * 5}px` } },
      ctx.root,
    );
    const r = cellW * 0.08;
    const tile = '#1E2026';
    const mkHalf = (cell: HTMLElement, top: boolean, z: number) => {
      const half = el(
        'div',
        {
          style: {
            position: 'absolute',
            left: '0',
            width: `${cellW}px`,
            height: `${cellH / 2}px`,
            top: top ? '0' : `${cellH / 2}px`,
            overflow: 'hidden',
            background: top ? tile : '#191B20',
            borderRadius: top ? `${r}px ${r}px 0 0` : `0 0 ${r}px ${r}px`,
            transformOrigin: top ? '50% 100%' : '50% 0%',
            backfaceVisibility: 'hidden',
            zIndex: String(z),
          },
        },
        cell,
      );
      const glyph = el(
        'div',
        {
          style: {
            position: 'absolute',
            left: '0',
            width: `${cellW}px`,
            height: `${cellH}px`,
            top: top ? '0' : `${-cellH / 2}px`,
            font,
            lineHeight: `${cellH}px`,
            textAlign: 'center',
            color: ctx.s.primary,
          },
        },
        half,
      );
      const shade = el('div', { style: { position: 'absolute', inset: '0', background: '#000', opacity: 0 } }, half);
      return { half, glyph, shade };
    };

    const cells = Array.from({ length: n }, () => {
      const cell = el('div', { style: { position: 'relative', width: `${cellW}px`, height: `${cellH}px`, transformStyle: 'preserve-3d', boxShadow: `0 ${cellH * 0.04}px ${cellH * 0.08}px rgba(0,0,0,.45)`, borderRadius: `${r}px` } }, board);
      const top = mkHalf(cell, true, 1);
      const bottom = mkHalf(cell, false, 1);
      const flapTop = mkHalf(cell, true, 3);
      const flapBot = mkHalf(cell, false, 3);
      // hinge line + side pins
      el('div', { style: { position: 'absolute', left: '0', right: '0', top: `${cellH / 2 - 1}px`, height: '2px', background: '#0A0B0D', zIndex: '5' } }, cell);
      for (const side of ['left', 'right'])
        el('div', { style: { position: 'absolute', [side]: `${-cellW * 0.03}px`, top: `${cellH / 2 - cellH * 0.05}px`, width: `${cellW * 0.06}px`, height: `${cellH * 0.1}px`, background: ctx.s.secondary, borderRadius: '2px', zIndex: '6' } }, cell);
      return { top, bottom, flapTop, flapBot, last: '' };
    });

    // Per transition: each cell shows a sequence [current, r1..rk, target]
    const segs = list.map((target, ti) => {
      const prev = list[(ti - 1 + list.length) % list.length];
      return target.map((ch, ci) => {
        const k = spins + Math.floor(hash2(ci, ti, ctx.seed) * 4) + ci;
        const seq = [prev[ci]];
        for (let i = 0; i < k; i++) seq.push(pool[Math.floor(hash2(ci * 31 + i, ti * 7 + 3, ctx.seed) * pool.length)]);
        seq.push(ch);
        return seq;
      });
    });
    const segDur = segs.map((s) => Math.max(...s.map((q) => q.length - 1)) * flip + 2.2);
    const cycle = segDur.reduce((a, b) => a + b, 0);
    const lead = 0.3;

    const set = (part: { glyph: HTMLElement }, ch: string) => {
      if (part.glyph.textContent !== ch) part.glyph.textContent = ch;
    };

    return {
      settle: lead + (segs[0][0].length + n) * flip + 0.6,
      render(time) {
        let t = (time % (cycle + lead)) - lead;
        let si = 0;
        if (t < 0) {
          // before the first flip everything shows the previous (blank/last) state
          si = 0;
          t = -1;
        } else {
          while (si < segs.length - 1 && t >= segDur[si]) t -= segDur[si++];
        }
        segs[si].forEach((seq, ci) => {
          const c = cells[ci];
          const steps = seq.length - 1;
          const p = t < 0 ? 0 : clamp(t / flip, 0, steps);
          const i = Math.min(Math.floor(p), steps);
          const f = i >= steps ? 0 : p - i; // phase of the current flip
          const cur = seq[i];
          const next = seq[Math.min(i + 1, steps)];
          set(c.top, f > 0 ? next : cur);
          set(c.bottom, cur);
          set(c.flapTop, cur);
          set(c.flapBot, next);
          if (f <= 0) {
            c.flapTop.half.style.visibility = 'hidden';
            c.flapBot.half.style.visibility = 'hidden';
            c.top.shade.style.opacity = '0';
            c.bottom.shade.style.opacity = '0';
            return;
          }
          if (f < 0.5) {
            const a = f / 0.5; // top flap falls 0 → -90
            c.flapTop.half.style.visibility = 'visible';
            c.flapTop.half.style.transform = `rotateX(${-90 * a * a}deg)`;
            c.flapTop.shade.style.opacity = String(0.5 * a);
            c.flapBot.half.style.visibility = 'hidden';
            c.top.shade.style.opacity = String(0.35 * (1 - a));
            c.bottom.shade.style.opacity = '0';
          } else {
            const a = (f - 0.5) / 0.5; // bottom flap 90 → 0, slight bounce
            const ang = 90 * (1 - a) * (1 - a);
            c.flapTop.half.style.visibility = 'hidden';
            c.flapBot.half.style.visibility = 'visible';
            c.flapBot.half.style.transform = `rotateX(${ang}deg)`;
            c.flapBot.shade.style.opacity = String(0.45 * (1 - a));
            c.bottom.shade.style.opacity = String(0.3 * (1 - a));
            c.top.shade.style.opacity = '0';
          }
        });
      },
    };
  },
};
export default impl;
