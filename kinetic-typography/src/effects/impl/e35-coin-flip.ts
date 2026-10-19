import { mixHex } from '../../engine/canvas';
import { el } from '../../engine/dom';
import { clamp, num, PALETTE } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fontString, graphemes, isLatin, isSpace, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Each character is a CSS-3D coin: two faces + a stack of rim discs for real
// thickness. It jumps on a parabola while spinning a seeded odd number of half
// turns around Y, lands on the other face, bounces once and wobbles (damped).
// The ground shadow shrinks and fades with height. Front = phrase 1, back = phrase 2.
const impl: EffectImpl = {
  id: 'coin-flip',
  defaults: { ...PALETTE.teal },
  posterTime: 0.75,
  maxChars: 24,
  textHint: '用「／」分隔正面與反面文字，例如「正／反」。',
  hide: ['tracking'],
  params: [
    { key: 'spins', label: '翻轉圈數', type: 'range', min: 1, max: 4, step: 1, default: 2 },
    { key: 'stagger', label: '依序間隔', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0.09, unit: 's' },
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1.1, unit: 's' },
  ],
  create(ctx): EffectRuntime {
    const list = phrases(ctx.text);
    const front = graphemes(list[0]);
    const back = list.length > 1 ? graphemes(list[1]) : front;
    const n = Math.max(front.length, back.length);
    // a missing face shows the other phrase's character (colour-swapped) instead of a blank coin
    const slots = Array.from({ length: n }, (_, i) => {
      const f = front[i] ?? '';
      const b = back[i] ?? '';
      return { f: f || b, b: b || f };
    });
    const W = ctx.width;
    const H = ctx.height;
    const spinsMax = Math.round(num(ctx, 'spins', 2));
    const stagger = num(ctx, 'stagger', 0.09);
    const hold = num(ctx, 'hold', 1.1);
    const k = ctx.s.intensity;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;

    // rows break at word boundaries (blank slots); pick the wrap width that maximises coin size
    const blank = (i: number) => (!slots[i].f || isSpace(slots[i].f)) && (!slots[i].b || isSpace(slots[i].b));
    const words: number[][] = [];
    let curW: number[] = [];
    slots.forEach((_, i) => {
      if (blank(i)) {
        if (curW.length) words.push(curW);
        curW = [];
      } else curW.push(i);
    });
    if (curW.length) words.push(curW);
    if (!words.length) words.push([0]);
    const wrapRows = (maxCols: number) => {
      const rows: number[][] = [];
      let row: number[] = [];
      for (const w of words) {
        // long words are split on their own
        for (let o = 0; o < w.length; o += maxCols) {
          const part = w.slice(o, o + maxCols);
          const need = row.length ? row.length + 1 + part.length : part.length;
          if (row.length && need > maxCols) {
            rows.push(row);
            row = [];
          }
          if (row.length) row.push(-1); // gap
          row.push(...part);
        }
      }
      if (row.length) rows.push(row);
      return rows;
    };
    let best = { rows: [[0]] as number[][], cols: 1, D: 0 };
    for (let mc = 1; mc <= n; mc++) {
      const rows = wrapRows(mc);
      if (rows.length > 4) continue;
      const c = Math.max(...rows.map((r) => r.length));
      const D = Math.min((W * 0.86) / (c * 1.16), (H * 0.66) / (rows.length * 1.55));
      if (D > best.D + 0.01) best = { rows, cols: c, D };
    }
    const pos = new Map<number, { row: number; col: number; inRow: number }>();
    best.rows.forEach((r, ri) => r.forEach((idx, ci) => idx >= 0 && pos.set(idx, { row: ri, col: ci, inRow: r.length })));
    const D = Math.min(best.D * ctx.s.fontScale, H * 0.42, (W * 0.9) / (best.cols * 1.05));
    const T = D * 0.09; // thickness
    const Hmax = Math.min(D * (best.rows.length > 1 ? 0.8 : 1.25), H * 0.3) * clamp(k, 0.2, 2);
    const pitch = D * 1.16;
    const rowH = D * 1.55;
    const top0 = H / 2 - (best.rows.length * rowH) / 2 + rowH * 0.62;

    const board = el('div', { style: { position: 'absolute', inset: '0', perspective: `${D * 9}px`, perspectiveOrigin: '50% 30%' } }, ctx.root);
    const rimCol = mixHex(acc, fg, 0.45);
    const rimDark = mixHex(acc, fg, 0.65);
    const layers = Math.round(4 + 6 * ctx.q);
    const face = (parent: HTMLElement, ch: string, isFront: boolean) => {
      const f = el(
        'div',
        {
          text: ch,
          style: {
            position: 'absolute',
            left: '0',
            top: '0',
            width: `${D}px`,
            height: `${D}px`,
            borderRadius: '50%',
            background: isFront ? acc : fg,
            color: isFront ? fg : acc,
            boxShadow: `inset 0 0 0 ${D * 0.045}px ${isFront ? rimCol : rimDark}, inset 0 0 0 ${D * 0.075}px ${isFront ? acc : fg}, inset 0 0 0 ${D * 0.085}px ${isFront ? rimCol : mixHex(fg, acc, 0.3)}`,
            font: fontString(D * (ch && isLatin(ch) && ch.length === 1 ? 0.6 : 0.5), ctx.font.sans, 900),
            lineHeight: `${D}px`,
            textAlign: 'center',
            whiteSpace: 'pre',
            backfaceVisibility: 'hidden',
            transform: isFront ? `translateZ(${T / 2}px)` : `rotateY(180deg) translateZ(${T / 2}px)`,
          },
        },
        parent,
      );
      return f;
    };

    const coins: { coin: HTMLDivElement; shadow: HTMLDivElement; spinsA: number; spinsB: number; i: number }[] = [];
    slots.forEach((s, i) => {
      const ps = pos.get(i);
      if (!ps) return;
      const { row, col, inRow } = ps;
      const cx = W / 2 + (col - (inRow - 1) / 2) * pitch;
      const cy = top0 + row * rowH;
      const shadow = el(
        'div',
        { style: { position: 'absolute', left: `${cx - D * 0.45}px`, top: `${cy + D * 0.56}px`, width: `${D * 0.9}px`, height: `${D * 0.16}px`, borderRadius: '50%', background: fg, filter: `blur(${Math.max(1, D * 0.03)}px)` } },
        board,
      );
      const coin = el('div', { style: { position: 'absolute', left: `${cx - D / 2}px`, top: `${cy - D / 2}px`, width: `${D}px`, height: `${D}px`, transformStyle: 'preserve-3d', willChange: 'transform' } }, board);
      for (let l = 0; l < layers; l++) {
        const z = -T / 2 + (T * (l + 0.5)) / layers;
        el('div', { style: { position: 'absolute', inset: '0', borderRadius: '50%', background: l % 2 ? rimCol : rimDark, transform: `translateZ(${z}px)` } }, coin);
      }
      face(coin, isSpace(s.f) ? '' : s.f, true);
      face(coin, isSpace(s.b) ? '' : s.b, false);
      const sp = (j: number) => 1 + Math.floor(hash2(i, j, ctx.seed) * spinsMax);
      coins.push({ coin, shadow, spinsA: sp(1), spinsB: sp(2), i });
    });

    const J = 0.82; // air time
    const lead = 0.3;
    const settleT = 0.45;
    const half = lead + (n - 1) * stagger + J + settleT + hold;
    const C = half * 2;

    // returns height (0..1), extra rotation and wobble for a flip that started `a` seconds ago
    const flight = (a: number, halfTurns: number) => {
      if (a < 0) return { h: 0, rot: 0, wob: 0, done: false };
      if (a < J) {
        const p = a / J;
        return { h: 4 * p * (1 - p), rot: 180 * halfTurns * p, wob: -16 * Math.sin(Math.PI * p), done: false };
      }
      const b = a - J;
      const bounce = b < 0.22 ? 0.14 * 4 * (b / 0.22) * (1 - b / 0.22) : 0;
      return { h: bounce, rot: 180 * halfTurns, wob: 13 * Math.exp(-b * 5) * Math.sin(b * 30), done: true };
    };

    return {
      render(time) {
        const u = time % C;
        for (const c of coins) {
          const d = lead + c.i * stagger;
          const inB = u >= half;
          const a = inB ? u - half - d : u - d;
          const turns = 2 * (inB ? c.spinsB : c.spinsA) - 1;
          const f = flight(a, turns);
          const base = inB ? 180 : 0;
          const rotY = (base + f.rot) % 360;
          const y = -f.h * Hmax;
          c.coin.style.transform = `translate3d(0,${y.toFixed(2)}px,0) rotateX(${(18 + f.wob).toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
          const hh = f.h;
          c.shadow.style.transform = `scale(${1 - 0.5 * hh})`;
          c.shadow.style.opacity = String(0.32 * (1 - 0.65 * hh));
        }
        void bg;
      },
    };
  },
};
export default impl;
