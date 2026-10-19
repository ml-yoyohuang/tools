import { mix, rgba } from '../../engine/canvas';
import { el } from '../../engine/dom';
import { clamp, ease, num, PALETTE, str } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fontString, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Every glyph has a seeded lock time. Before it, the glyph is drawn from a pool that
// matches its script, re-rolled at a fixed rate: pool[hash(i, floor(t·rate))], so a
// given time always shows the same frame. The lock flashes an inverted block.
const P_CJK = '訊號解鎖密碼資料傳輸網路系統錯誤終端節點核心模組協定封包加權演算隨機量子電流頻率光纖晶片'.split('');
const P_UP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const P_LO = 'abcdefghijklmnopqrstuvwxyz'.split('');
const P_DIG = '0123456789'.split('');
const P_SYM = '#$%&*+=<>/\\|{}[]?!@^~:;'.split('');
const P_KANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ'.split('');

function poolFor(ch: string): string[] {
  if (/\p{Script=Han}/u.test(ch)) return P_CJK;
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch)) return P_KANA;
  if (/[A-Z]/.test(ch)) return P_UP;
  if (/[a-z]/.test(ch)) return P_LO;
  if (/\d/.test(ch)) return P_DIG;
  return P_SYM;
}

const impl: EffectImpl = {
  id: 'scramble-decode',
  defaults: { ...PALETTE.darkLime },
  loopable: true,
  hide: ['intensity'],
  posterTime: 1.6,
  maxChars: 40,
  params: [
    { key: 'rate', label: '亂碼頻率', type: 'range', min: 6, max: 30, step: 1, default: 16, unit: 'Hz' },
    { key: 'stagger', label: '鎖定間隔', type: 'range', min: 0.04, max: 0.4, step: 0.01, default: 0.14, unit: 's' },
    { key: 'order', label: '鎖定順序', type: 'select', default: 'ltr', options: [{ value: 'ltr', label: '由左至右' }, { value: 'random', label: '隨機' }] },
  ],
  create(ctx): EffectRuntime {
    const rate = num(ctx, 'rate', 16);
    const stagger = num(ctx, 'stagger', 0.14);
    const order = str(ctx, 'order', 'ltr');
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const L = layoutText(ctx, ctx.text, { maxHeight: ctx.height * 0.46, maxWidth: ctx.width * 0.84, cy: ctx.height * 0.47, lineHeight: 1.3 });
    const N = L.chars.length;
    const fs = L.fontSize;

    // lock order
    const rank = L.chars.map((_, i) => i);
    if (order === 'random') rank.sort((a, b) => hash2(a, 5, ctx.seed) - hash2(b, 5, ctx.seed));
    const pos = new Array<number>(N);
    rank.forEach((ci, r) => (pos[ci] = r));

    const APPEAR = 0.45; // scrambled glyphs wipe in
    const START = 0.75;
    const lockAt = L.chars.map((_, i) => START + pos[i] * stagger + hash2(i, 9, ctx.seed) * stagger * 0.8);
    const lastLock = Math.max(...lockAt);
    const HOLD = 2.2;
    const outStart = lastLock + 0.45 + HOLD;
    const OUT = 0.6;
    const cycle = outStart + OUT + 0.35;

    const wrap = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);
    const cells = L.chars.map((g, i) => {
      const block = el('div', {
        style: {
          position: 'absolute',
          left: `${g.cx - Math.max(g.w, fs * 0.5) / 2 - fs * 0.04}px`,
          top: `${g.cy - fs * 0.6}px`,
          width: `${Math.max(g.w, fs * 0.5) + fs * 0.08}px`,
          height: `${fs * 1.2}px`,
          background: acc,
          opacity: 0,
        },
      }, wrap);
      const under = el('div', {
        style: { position: 'absolute', left: `${g.x}px`, top: `${g.cy + fs * 0.66}px`, width: `${g.w}px`, height: `${Math.max(1.5, fs * 0.035)}px`, background: rgba(fg, 0.25) },
      }, wrap);
      const span = el('span', {
        text: g.ch,
        style: { position: 'absolute', left: `${g.cx}px`, top: `${g.cy}px`, font: L.font, lineHeight: '1', whiteSpace: 'pre', willChange: 'transform' },
      }, wrap);
      return { g, block, under, span, pool: poolFor(g.ch), last: '', i };
    });

    // status line (mono)
    const sfs = clamp(fs * 0.16, 9, 18);
    const status = el('div', {
      style: {
        position: 'absolute',
        left: '0',
        right: '0',
        top: `${Math.min(ctx.height - sfs * 2.2, L.y + L.height + fs * 0.45)}px`,
        textAlign: 'center',
        font: fontString(sfs, ctx.font.mono, 500),
        letterSpacing: '0.12em',
        whiteSpace: 'pre',
      },
    }, wrap);
    const scrambleFont = fontString(fs, ctx.font.mono, 700);
    const popEase = ease('expo.out');
    const dim = mix(fg, bg, 0.45);

    return {
      settle: lastLock + 0.9,
      render(time) {
        const t = time % cycle;
        let locked = 0;
        for (const c of cells) {
          const { i } = c;
          const appear = 0.1 + (c.g.x - L.x) / Math.max(1, L.width) * (APPEAR - 0.1) + c.g.line * 0.05;
          const outAt = outStart + pos[i] / Math.max(1, N) * OUT * 0.6;
          const isLocked = t >= lockAt[i] && t < outAt;
          let ch: string;
          let visible = t >= appear;
          if (isLocked) {
            ch = c.g.ch;
            locked++;
          } else {
            const step = Math.floor(t * rate);
            ch = c.pool[Math.floor(hash2(i * 131 + 7, step, ctx.seed) * c.pool.length)];
            if (t >= outAt) visible = t < outAt + 0.25 + hash2(i, 3, ctx.seed) * 0.2;
          }
          if (ch !== c.last) {
            c.span.textContent = ch;
            c.span.style.font = isLocked || c.pool === P_CJK || c.pool === P_KANA ? L.font : scrambleFont;
            c.last = ch;
          }
          // lock flash: inverted block that shrinks away, glyph pops
          const since = t - lockAt[i];
          const flash = isLocked ? clamp(1 - since / 0.32, 0, 1) : 0;
          c.block.style.opacity = String(flash);
          c.block.style.transform = `scaleY(${0.35 + 0.65 * flash})`;
          const pop = isLocked ? 1 + 0.22 * (1 - popEase(clamp(since / 0.5, 0, 1))) : 1;
          const jitter = !isLocked && visible ? (hash2(i, Math.floor(t * rate), ctx.seed + 1) - 0.5) * fs * 0.04 : 0;
          c.span.style.transform = `translate(-50%,-50%) translate(${jitter}px,0) scale(${pop})`;
          c.span.style.visibility = visible ? 'visible' : 'hidden';
          c.span.style.color = isLocked ? (flash > 0.4 ? bg : since < 0.9 ? acc : fg) : dim;
          c.under.style.background = isLocked ? acc : rgba(fg, 0.22);
          c.under.style.opacity = visible ? '1' : '0.3';
        }
        const pct = Math.round((locked / Math.max(1, N)) * 100);
        const bars = 12;
        const filled = Math.round((locked / Math.max(1, N)) * bars);
        const bar = '█'.repeat(filled) + '░'.repeat(bars - filled);
        const done = locked === N;
        status.textContent = done ? `● SIGNAL UNLOCKED  ${bar}  100%` : `○ DECODING  ${bar}  ${String(pct).padStart(3, '0')}%`;
        status.style.color = done ? acc : dim;
      },
    };
  },
};
export default impl;
