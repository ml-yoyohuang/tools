import { rgba } from '../../engine/canvas';
import { el } from '../../engine/dom';
import { bool, clamp, ease, mod, num, PALETTE } from '../../engine/helpers';
import { fontString, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Variable-font specimen. Layout is measured at wght 900 and every glyph is centred
// in its own fixed cell, so changing the weight never shifts the line. Each glyph's
// weight follows a staggered loop: thin (100) → black (900) one by one, hold, then
// back to thin one by one, hold. The per-glyph wght value is printed under it.
const MIN = 100;
const MAX = 900;

const impl: EffectImpl = {
  id: 'weight-grow',
  defaults: { ...PALETTE.paperViolet },
  posterTime: 1.9,
  maxChars: 30,
  hide: ['intensity'],
  params: [
    { key: 'stagger', label: '逐字間隔', type: 'range', min: 0.03, max: 0.4, step: 0.01, default: 0.14, unit: 's' },
    { key: 'grow', label: '生長時間', type: 'range', min: 0.3, max: 2, step: 0.05, default: 0.9, unit: 's' },
    { key: 'labels', label: '顯示字重數值', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const stagger = num(ctx, 'stagger', 0.14);
    const grow = num(ctx, 'grow', 0.9);
    const showLabels = bool(ctx, 'labels', true);
    const { primary: fg, secondary: acc } = ctx.s;
    const fam = ctx.font.sans;
    const L = layoutText(ctx, ctx.text, { family: fam, weight: MAX, maxHeight: ctx.height * 0.5, maxWidth: ctx.width * 0.84, lineHeight: 1.45, cy: ctx.height * 0.48 });
    const fs = L.fontSize;
    const N = L.chars.length;
    const labelFs = fs * 0.13;
    const labels = showLabels && labelFs >= 7;

    const wrap = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);
    // specimen guides: baseline + x-height-ish lines per text line
    for (const ln of L.lines) {
      for (const k of [-0.42, 0.42]) {
        el('div', {
          style: { position: 'absolute', left: `${L.x - fs * 0.2}px`, width: `${L.width + fs * 0.4}px`, top: `${ln.cy + fs * k}px`, height: '1px', background: rgba(acc, 0.35) },
        }, wrap);
      }
    }
    const items = L.chars.map((g) => {
      const span = el('span', {
        text: g.ch,
        style: {
          position: 'absolute',
          left: `${g.cx}px`,
          top: `${g.cy}px`,
          transform: 'translate(-50%,-50%)',
          fontFamily: fam,
          fontSize: `${fs}px`,
          fontWeight: String(MIN),
          fontVariationSettings: `'wght' ${MIN}`,
          lineHeight: '1',
          whiteSpace: 'pre',
          color: fg,
        },
      }, wrap);
      // a label only where the glyph is wide enough for a 3-digit number
      const label = labels && g.w >= labelFs * 2
        ? el('span', {
            style: {
              position: 'absolute',
              left: `${g.cx}px`,
              top: `${g.cy + fs * 0.62}px`,
              transform: 'translateX(-50%)',
              font: fontString(labelFs, ctx.font.mono, 500),
              color: acc,
              whiteSpace: 'pre',
            },
          }, wrap)
        : null;
      return { span, label, last: -1 };
    });

    // bottom axis: wght scale with a marker at the average weight
    const axW = Math.min(ctx.width * 0.5, Math.max(160, L.width * 0.7));
    const axY = Math.min(ctx.height - fs * 0.35 - 14, L.y + L.height + fs * 0.35);
    const axFs = Math.max(8, Math.min(13, fs * 0.12));
    const axis = el('div', { style: { position: 'absolute', left: `${(ctx.width - axW) / 2}px`, top: `${axY}px`, width: `${axW}px`, height: '1px', background: rgba(fg, 0.5) } }, wrap);
    for (const [v, side] of [[MIN, 'left'], [MAX, 'right']] as const)
      el('div', { text: `wght ${v}`, style: { position: 'absolute', [side]: '0', top: `${axFs * 0.5}px`, font: fontString(axFs, ctx.font.mono, 500), color: rgba(fg, 0.6), whiteSpace: 'pre' } }, axis);
    const marker = el('div', { style: { position: 'absolute', top: `${-axFs * 0.35}px`, width: `${axFs * 0.7}px`, height: `${axFs * 0.7}px`, marginLeft: `${-axFs * 0.35}px`, borderRadius: '50%', background: acc } }, axis);

    const span = (N - 1) * stagger + grow;
    const HOLD_HI = 1.0;
    const HOLD_LO = 0.7;
    const cycle = span * 2 + HOLD_HI + HOLD_LO;
    const upE = ease('power3.inOut');
    const dnE = ease('sine.inOut');

    return {
      render(time) {
        const t = mod(time, cycle);
        let sum = 0;
        items.forEach((it, i) => {
          const upT = i * stagger;
          const dnT = span + HOLD_HI + i * stagger;
          let k: number;
          if (t < dnT) k = upE(clamp((t - upT) / grow, 0, 1));
          else k = 1 - dnE(clamp((t - dnT) / grow, 0, 1));
          const w = Math.round(MIN + (MAX - MIN) * k);
          sum += w;
          if (w !== it.last) {
            it.span.style.fontWeight = String(w);
            it.span.style.fontVariationSettings = `'wght' ${w}`;
            if (it.label) it.label.textContent = String(w);
            it.last = w;
          }
        });
        const avg = sum / Math.max(1, N);
        marker.style.left = `${((avg - MIN) / (MAX - MIN)) * 100}%`;
      },
    };
  },
};
export default impl;
