import { el } from '../../engine/dom';
import { hash2 } from '../../engine/random';
import { mod, num, PALETTE } from '../../engine/helpers';
import { fontString, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// writing-mode: vertical-rl columns. Each column repeats its phrase + a separator;
// the repeat unit's height is measured, offset = (t·v) mod unitH, so every column is
// seamless. Odd columns rise, even columns fall; weight and colour alternate, thin
// rules separate the columns and the top/bottom edges fade out.
const impl: EffectImpl = {
  id: 'vertical-typography',
  defaults: { ...PALETTE.paperViolet },
  posterTime: 1.5,
  maxChars: 30,
  textHint: '用「／」分隔，多個詞會分配到不同欄。',
  params: [
    { key: 'cols', label: '欄數', type: 'range', min: 0, max: 12, step: 1, default: 0, hint: '0 = 依畫面比例自動' },
    { key: 'rules', label: '欄線', type: 'toggle', default: true },
    { key: 'vary', label: '欄速差異', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const list = phrases(ctx.text);
    const auto = Math.round(num(ctx, 'cols', 0)) >= 2 ? Math.round(num(ctx, 'cols', 0)) : 0;
    const vary = num(ctx, 'vary', 0.35);
    let fs = Math.max(W, H) * 0.085 * ctx.s.fontScale;
    let cols = auto > 0 ? auto : Math.max(3, Math.floor(W / (fs * 1.55)));
    if (auto > 0) fs = Math.min(fs * 1.6, W / (cols * 1.45));
    cols = Math.max(2, cols);
    const colW = W / cols;
    const showRules = ctx.s.params.rules !== false;

    const field = el('div', {
      style: {
        position: 'absolute', inset: '0', overflow: 'hidden',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)',
      },
    }, ctx.root);

    const columns = Array.from({ length: cols }, (_, c) => {
      const phrase = list[c % list.length];
      const heavy = c % 2 === 0;
      const accent = c % 3 === 1;
      const size = fs * (heavy ? 1 : 0.78);
      // column index from the right, like vertical-rl reading order
      const x = W - colW * (c + 0.5);
      const track = el('div', {
        style: { position: 'absolute', left: `${x}px`, top: '0', willChange: 'transform' },
      }, field);
      const unit = el('div', {
        text: phrase + '　・　',
        style: {
          writingMode: 'vertical-rl', textOrientation: 'mixed', font: fontString(size, ctx.font.serif, heavy ? 900 : 400), lineHeight: '1',
          letterSpacing: `${0.08 + ctx.s.tracking}em`, color: accent ? ctx.s.secondary : ctx.s.primary, whiteSpace: 'nowrap',
        },
      }, track);
      const unitH = Math.max(1, unit.getBoundingClientRect().height);
      const unitW = unit.getBoundingClientRect().width;
      const n = Math.ceil(H / unitH) + 1;
      for (let i = 0; i < n; i++) track.appendChild(unit.cloneNode(true));
      const dir = c % 2 === 0 ? -1 : 1; // first (rightmost) column rises
      const v = fs * (1.1 + (hash2(c, 5, ctx.seed) - 0.5) * 2 * vary) * Math.max(0.1, ctx.s.intensity);
      const phase = hash2(c, 9, ctx.seed) * unitH;
      return { track, unitH, unitW, dir, v, phase };
    });

    if (showRules) {
      for (let c = 1; c < cols; c++) {
        el('div', { style: { position: 'absolute', top: '0', bottom: '0', left: `${W - colW * c}px`, width: '1px', background: ctx.s.primary, opacity: 0.18 } }, field);
      }
    }

    return {
      render(t) {
        for (const col of columns) {
          const off = mod(t * col.v + col.phase, col.unitH);
          const y = col.dir < 0 ? -off : off - col.unitH;
          col.track.style.transform = `translate3d(${-col.unitW / 2}px,${y}px,0)`;
        }
      },
    };
  },
};
export default impl;
