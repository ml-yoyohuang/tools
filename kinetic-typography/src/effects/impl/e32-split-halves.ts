import { el } from '../../engine/dom';
import { clamp, ease, num, PALETTE } from '../../engine/helpers';
import { layoutText, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime, EffectContext } from '../../engine/types';

// Every line of a word is two clipped copies: top half / bottom half (clip-path inset
// at the glyph mid-line). On a switch the current halves shear apart in opposite
// directions (expo.inOut); the next word opens out of the split line in between,
// itself still parted by a gap, and then snaps shut (back.out). Odd words sit on an
// inverted band so a single word alternates with its own colour-swapped version.
interface Word {
  wrap: HTMLDivElement;
  top: HTMLDivElement;
  bot: HTMLDivElement;
  /** y of the cut (mid-line of the middle line, so glyphs are always halved) */
  cut: number;
  up: number;
  down: number;
  flash: HTMLDivElement;
}

function buildWord(ctx: EffectContext, text: string, inverted: boolean): Word {
  const { primary: fg, secondary: acc, background: bg } = ctx.s;
  const L = layoutText(ctx, text, { maxWidth: ctx.width * 0.8, maxHeight: ctx.height * 0.5, lineHeight: 1.18 });
  const wrap = el('div', { style: { position: 'absolute', inset: '0', visibility: 'hidden' } }, ctx.root);
  const lh = L.lineHeight;
  const padX = L.fontSize * 0.35;
  const mid = L.lines[Math.floor((L.lines.length - 1) / 2)];
  const cut = L.lines.length % 2 ? mid.cy : L.lines[L.lines.length / 2].cy;
  const mk = () => {
    const piece = el('div', { style: { position: 'absolute', left: '0', top: '0', width: `${ctx.width}px`, height: `${ctx.height}px`, willChange: 'transform, clip-path' } }, wrap);
    for (const line of L.lines) {
      if (inverted)
        el('div', { style: { position: 'absolute', left: `${ctx.width / 2 - line.width / 2 - padX}px`, width: `${line.width + padX * 2}px`, top: `${line.y}px`, height: `${lh + 1}px`, background: acc } }, piece);
      el(
        'div',
        {
          text: line.text,
          style: {
            position: 'absolute',
            left: '0',
            width: `${ctx.width}px`,
            top: `${line.y}px`,
            height: `${lh}px`,
            font: L.font,
            lineHeight: `${lh}px`,
            letterSpacing: `${L.tracking}em`,
            textIndent: `${L.tracking}em`,
            textAlign: 'center',
            whiteSpace: 'pre',
            color: inverted ? bg : fg,
          },
        },
        piece,
      );
    }
    return piece;
  };
  const top = mk();
  const bot = mk();
  // a hairline that flashes along the split line when it opens
  const flash = el('div', { style: { position: 'absolute', left: '0', width: `${ctx.width}px`, top: `${cut - 1}px`, height: '2px', background: acc, opacity: 0 } }, wrap);
  return { wrap, top, bot, cut, up: cut - L.y + 2, down: L.y + L.height - cut + 2, flash };
}

const impl: EffectImpl = {
  id: 'split-halves',
  defaults: { ...PALETTE.darkPink },
  loopable: true,
  posterTime: 1.2,
  maxChars: 30,
  textHint: '用「／」分隔多個詞，會依序裂開換字；只有一個詞時會與反色版本交替。',
  params: [
    { key: 'gap', label: '裂開距離', type: 'range', min: 0.2, max: 1.2, step: 0.05, default: 0.6, hint: '相對於舞台高度' },
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.5, max: 3, step: 0.1, default: 1.3, unit: 's' },
  ],
  create(ctx): EffectRuntime {
    const list = phrases(ctx.text);
    const seq = list.length > 1 ? list.map((p, i) => ({ p, inv: i % 2 === 1 })) : [{ p: list[0], inv: false }, { p: list[0], inv: true }];
    // odd count + alternate styles would put two inverted words next to each other at the wrap: fine, but keep it alternating
    const words = seq.map((s) => buildWord(ctx, s.p, s.inv));
    const n = words.length;
    const k = ctx.s.intensity;
    const dist = ctx.height * num(ctx, 'gap', 0.6) * Math.max(0.2, k);
    const hold = num(ctx, 'hold', 1.3);
    const T = 1.25; // transition length
    const slot = hold + T;
    const lead = 0.35;
    const eApart = ease('power4.inOut');
    const eOpen = ease('power3.out');
    const eClose = ease('back.out(3)');
    const closeGap = ctx.height * 0.05 * Math.max(0.3, k);

    const H = ctx.height;
    const clipTop = (w: Word, v: number) => `inset(${w.cut - w.up * v}px 0 ${H - w.cut}px 0)`;
    const clipBot = (w: Word, v: number) => `inset(${w.cut}px 0 ${H - w.cut - w.down * v}px 0)`;
    const apart = (p: number) => eApart(clamp(p / 0.7, 0, 1));
    const show = (w: Word, on: boolean) => {
      w.wrap.style.visibility = on ? 'visible' : 'hidden';
    };
    // whole word at rest
    const rest = (w: Word) => {
      w.top.style.transform = w.bot.style.transform = 'none';
      w.top.style.clipPath = clipTop(w, 1);
      w.bot.style.clipPath = clipBot(w, 1);
      w.top.style.opacity = w.bot.style.opacity = '1';
      w.flash.style.opacity = '0';
    };
    // outgoing: halves leave in opposite, slightly diagonal directions
    const leave = (w: Word, p: number) => {
      const e = apart(p);
      const d = Math.max(dist, (w.up + w.down) * 0.75);
      const dx = e * ctx.width * 0.12;
      w.top.style.transform = `translate3d(${-dx}px,${-e * d}px,0) rotate(${-e * 4}deg)`;
      w.bot.style.transform = `translate3d(${dx}px,${e * d}px,0) rotate(${e * 4}deg)`;
      w.top.style.opacity = w.bot.style.opacity = String(1 - clamp((p - 0.4) / 0.3, 0, 1));
      w.top.style.clipPath = clipTop(w, 1);
      w.bot.style.clipPath = clipBot(w, 1);
      const f = clamp(p / 0.18, 0, 1);
      w.flash.style.opacity = String(f < 1 ? f : Math.max(0, 1 - (p - 0.18) / 0.15));
      w.flash.style.transform = `scaleX(${eOpen(f)})`;
    };
    // incoming: opens out of the split line exactly as wide as the gap, still parted, then snaps shut
    const arrive = (w: Word, p: number, from: Word) => {
      w.flash.style.opacity = '0';
      const sep = apart(p) * Math.max(dist, (from.up + from.down) * 0.75);
      const late = eOpen(clamp((p - 0.5) / 0.2, 0, 1));
      const vt = Math.max(clamp((sep - closeGap) / w.up, 0, 1), late);
      const vb = Math.max(clamp((sep - closeGap) / w.down, 0, 1), late);
      const c = eClose(clamp((p - 0.55) / 0.4, 0, 1));
      const g = closeGap * (1 - c) * Math.min(vt, vb);
      w.top.style.clipPath = clipTop(w, vt);
      w.bot.style.clipPath = clipBot(w, vb);
      w.top.style.transform = `translate3d(0,${-g}px,0)`;
      w.bot.style.transform = `translate3d(0,${g}px,0)`;
      w.top.style.opacity = w.bot.style.opacity = '1';
    };

    let lastA = -1;
    let lastB = -1;
    return {
      settle: lead + hold * 0.6,
      render(time) {
        let a: number; // outgoing (or resting) word
        let b = -1; // incoming
        let p = 0;
        if (time < lead) {
          a = 0;
        } else {
          const tt = (time - lead) % (slot * n);
          const s = Math.floor(tt / slot);
          const local = tt - s * slot;
          a = s;
          if (local > hold) {
            b = (s + 1) % n;
            p = (local - hold) / T;
          }
        }
        if (a !== lastA || b !== lastB) {
          words.forEach((w, i) => show(w, i === a || i === b));
          lastA = a;
          lastB = b;
        }
        if (b < 0) rest(words[a]);
        else {
          // incoming is beneath the outgoing halves
          words[b].wrap.style.zIndex = '1';
          words[a].wrap.style.zIndex = '2';
          arrive(words[b], p, words[a]);
          leave(words[a], p);
        }
      },
    };
  },
};
export default impl;
