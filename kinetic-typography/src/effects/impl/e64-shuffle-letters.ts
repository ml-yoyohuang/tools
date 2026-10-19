import { el, glyphSpans } from '../../engine/dom';
import { clamp, ease, lerp, num, PALETTE } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Slots are the laid-out glyph positions. A seeded sequence of permutations moves
// the (unchanged) characters between slots; rightward moves arc over the line and
// leftward moves dip under it, so swapping pairs never collide. Characters sitting
// in their own slot use the primary colour, displaced ones the accent — the final
// round puts everything home and the word "solves".
const impl: EffectImpl = {
  id: 'shuffle-letters',
  defaults: { ...PALETTE.pink },
  loopable: true,
  posterTime: 2.2,
  maxChars: 30,
  params: [
    { key: 'rounds', label: '洗牌輪數', type: 'range', min: 1, max: 8, step: 1, default: 4 },
    { key: 'tempo', label: '移動秒數', type: 'range', min: 0.3, max: 1.4, step: 0.05, default: 0.7, unit: 's' },
  ],
  create(ctx): EffectRuntime {
    const L = layoutText(ctx, ctx.text, { maxHeight: ctx.height * 0.46, maxWidth: ctx.width * 0.84, lineHeight: 1.7 });
    const fs = L.fontSize;
    const n = L.chars.length;
    const rounds = Math.round(num(ctx, 'rounds', 4));
    const D = num(ctx, 'tempo', 0.7);
    const k = clamp(ctx.s.intensity, 0, 2);
    const rand = ctx.rand;

    // slot underlines
    for (const g of L.chars)
      el('div', { style: { position: 'absolute', left: `${g.cx - g.w * 0.4}px`, top: `${g.cy + fs * 0.62}px`, width: `${g.w * 0.8}px`, height: `${Math.max(2, fs * 0.045)}px`, borderRadius: '2px', background: ctx.s.primary, opacity: 0.22 } }, ctx.root);
    const spans = glyphSpans(ctx.root, L, { color: ctx.s.primary });

    // permutations: perm[r][i] = slot of char i in arrangement r
    const id = Array.from({ length: n }, (_, i) => i);
    const perms: number[][] = [id];
    let prev = id;
    for (let r = 0; r < rounds; r++) {
      let best = prev;
      let bestFixed = Infinity;
      for (let tries = 0; tries < 12; tries++) {
        const a = prev.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        const fixed = a.filter((s, i) => s === prev[i]).length + a.filter((s, i) => s === i).length * 0.5;
        if (fixed < bestFixed) {
          bestFixed = fixed;
          best = a;
        }
        if (fixed === 0) break;
      }
      perms.push(best);
      prev = best;
    }
    perms.push(id);

    const hold0 = 0.9;
    const holdMid = 0.35;
    const spread = Math.min(0.3, 1.2 / Math.max(1, n));
    const stag = id.map((i) => hash2(i, 9, ctx.seed) * spread * n * 0.5);
    const maxStag = Math.max(0, ...stag);
    const moveT = D + maxStag;
    const starts: number[] = [];
    let t = hold0;
    for (let r = 0; r < perms.length - 1; r++) {
      starts.push(t);
      t += moveT + (r === perms.length - 2 ? 0 : holdMid);
    }
    const solved = t;
    const cycle = solved + 1.9;
    const eMove = ease('power2.inOut');
    const eFinal = ease('expo.inOut');

    const slotXY = (s: number) => ({ x: L.chars[s].cx, y: L.chars[s].cy });
    const last = spans.map(() => ({ col: '' }));

    return {
      settle: solved + 1.2,
      render(time) {
        const tt = time % cycle;
        let r = 0;
        while (r < starts.length - 1 && tt >= starts[r + 1]) r++;
        const final = r === starts.length - 1;
        spans.forEach((sp, i) => {
          const from = perms[r][i];
          const to = perms[r + 1][i];
          const local = clamp((tt - starts[r] - stag[i]) / D, 0, 1);
          const e = (final ? eFinal : eMove)(local);
          const a = slotXY(from);
          const b = slotXY(to);
          const dx = b.x - a.x;
          const dir = dx > 0.5 ? -1 : dx < -0.5 ? 1 : 0;
          const h = dir * (fs * 0.45 + Math.min(Math.abs(dx), ctx.width) * 0.22 + Math.abs(b.y - a.y) * 0.15) * k;
          const arc = Math.sin(Math.PI * e);
          const x = lerp(a.x, b.x, e) - sp.g.cx;
          const y = lerp(a.y, b.y, e) + h * arc - sp.g.cy;
          const rot = (dx > 0 ? 1 : -1) * arc * 14 * k * (dir === 0 ? 0 : 1);
          sp.el.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${rot.toFixed(2)}deg)`;
          const slot = e < 0.5 ? from : to;
          const col = slot === i ? ctx.s.primary : ctx.s.secondary;
          if (last[i].col !== col) {
            sp.el.style.color = col;
            last[i].col = col;
          }
        });
      },
    };
  },
};
export default impl;
