import { el, listen } from '../../engine/dom';
import { clamp, ease, lerp, mod, PALETTE, smoothstep } from '../../engine/helpers';
import { fontString, graphemes, isSpace, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Progress p ∈ [0,1] drives a segmented story: each segment rises into the centre
// at a large "focus" scale, holds, then shrinks into its slot in the final layout
// (earlier segments dim while a new one is in focus; everything lights up at the end).
// In detail mode p comes from a native scroll container in ctx.ui
// (scrollTop / (scrollHeight − clientHeight)); no wheel events are intercepted.
// When the user hasn't scrolled recently (and always in cards) p is simulated from t
// with an eased ping-pong, and the scroll position follows it so the scrollbar agrees.

function segmentsOf(text: string): { segs: string[]; byChar: boolean } {
  const parts = text
    .split(/[／/\n]+/)
    .flatMap((p) => p.split(/(?<=[，,、；;。！？!?])/))
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length > 1) return { segs: parts, byChar: false };
  // latin-style sentences: one word per segment
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.length <= 8) return { segs: words, byChar: false };
  return { segs: graphemes(text.trim()).filter((g) => !isSpace(g)), byChar: true };
}

const impl: EffectImpl = {
  id: 'scroll-story',
  defaults: { ...PALETTE.teal },
  interactive: true,
  posterTime: 3.4,
  maxChars: 30,
  textHint: '用「，」或「／」分段；沒有分隔時會逐字推進。',
  params: [{ key: 'focus', label: '聚焦放大', type: 'range', min: 1, max: 3, step: 0.1, default: 2, unit: '×' }],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc } = ctx.s;
    const { segs, byChar } = segmentsOf(ctx.text);
    const n = segs.length;
    const L = byChar
      ? layoutText(ctx, ctx.text, { maxHeight: H * 0.5, maxWidth: W * 0.82 })
      : layoutText(ctx, segs.join('\n'), { maxHeight: H * 0.56, maxWidth: W * 0.82 });
    const fs = L.fontSize;
    const focusMax = typeof ctx.s.params.focus === 'number' ? ctx.s.params.focus : 2;

    // assign layout glyphs to segments
    const owner: number[] = [];
    if (byChar) L.chars.forEach((_, i) => (owner[i] = i));
    else {
      let si = 0;
      let left = graphemes(segs[0]).filter((g) => !isSpace(g)).length;
      L.chars.forEach((_, i) => {
        while (left <= 0 && si < n - 1) left = graphemes(segs[++si]).filter((g) => !isSpace(g)).length;
        owner[i] = si;
        left--;
      });
    }
    const stage = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);
    const groups = segs.map((_, si) => {
      const mine = L.chars.filter((_, i) => owner[i] === si);
      const x0 = Math.min(...mine.map((c) => c.x));
      const x1 = Math.max(...mine.map((c) => c.x + c.w));
      const y0 = Math.min(...mine.map((c) => c.y));
      const y1 = Math.max(...mine.map((c) => c.y + L.lineHeight));
      const fcx = (x0 + x1) / 2;
      const fcy = (y0 + y1) / 2;
      const wrap = el('div', { style: { position: 'absolute', inset: '0', transformOrigin: `${fcx}px ${fcy}px`, willChange: 'transform, opacity', opacity: 0 } }, stage);
      for (const c of mine)
        el('span', { text: c.ch, style: { position: 'absolute', left: c.cx, top: c.cy, font: L.font, lineHeight: '1', whiteSpace: 'pre', color: fg, transform: 'translate(-50%,-50%)' } }, wrap);
      const S = clamp(Math.min((W * 0.84) / Math.max(1, x1 - x0), (H * 0.42) / fs), 1, focusMax);
      return { wrap, fcx, fcy, S, last: '' };
    });

    // chrome: counter, progress rail, scroll hint
    const small = Math.max(10, Math.min(14, H * 0.032));
    const counter = el('div', { style: { position: 'absolute', left: `${W * 0.05}px`, top: `${H * 0.05}px`, font: fontString(small, ctx.font.mono, 600), color: fg, opacity: 0.75, letterSpacing: '0.08em' } }, ctx.root);
    const railH = H * 0.5;
    const rail = el('div', { style: { position: 'absolute', right: `${W * 0.04}px`, top: `${(H - railH) / 2}px`, width: '2px', height: `${railH}px`, background: 'rgba(0,0,0,.14)', borderRadius: '2px' } }, ctx.root);
    const fill = el('div', { style: { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', background: acc, transformOrigin: '50% 0', transform: 'scaleY(0)' } }, rail);
    for (let i = 0; i <= n; i++)
      el('div', { style: { position: 'absolute', left: '-3px', top: `${(i / n) * 86}%`, width: '8px', height: '1px', background: fg, opacity: 0.35 } }, rail);
    const hint = el('div', { text: '↓ 捲動', style: { position: 'absolute', left: '50%', bottom: `${H * 0.07}px`, font: fontString(small * 1.1, ctx.font.sans, 700), color: fg, letterSpacing: '0.12em', whiteSpace: 'nowrap' } }, ctx.root);

    // simulated progress: eased ping-pong with holds at both ends
    const up = 5.8;
    const top = 1.8;
    const down = 2.2;
    const bottom = 0.9;
    const period = up + top + down + bottom;
    const upE = ease('sine.inOut');
    const downE = ease('power2.inOut');
    const simP = (t: number) => {
      const u = mod(t, period);
      if (u < up) return upE(u / up);
      if (u < up + top) return 1;
      if (u < up + top + down) return 1 - downE((u - up - top) / down);
      return 0;
    };

    // --- native scroll area (detail only) ---------------------------------------
    let scroller: HTMLDivElement | null = null;
    let userAt = 0;
    let lastSet = -1;
    const offs: (() => void)[] = [];
    if (ctx.mode === 'detail') {
      scroller = el(
        'div',
        {
          attrs: { tabindex: '0', role: 'region', 'aria-label': `捲動以推進故事：${ctx.text}` },
          style: { position: 'absolute', inset: '0', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', scrollbarWidth: 'thin', scrollbarColor: `${acc} transparent`, outlineOffset: '-3px' },
        },
        ctx.ui,
      );
      el('div', { style: { height: `${Math.round(H * (2 + n * 0.55))}px`, width: '1px' } }, scroller);
      // the scroll position must also update the picture while the player is paused
      const mark = () => {
        userAt = performance.now();
        draw(lastT, 0);
      };
      offs.push(
        listen(scroller, 'scroll', () => {
          if (Math.abs(scroller!.scrollTop - lastSet) > 1.5) mark();
        }, { passive: true }),
        listen(scroller, 'wheel', mark, { passive: true }),
        listen(scroller, 'touchstart', mark, { passive: true }),
        listen(scroller, 'keydown', mark),
      );
    }

    let shown = 0;
    let lastT = 0;
    const enterE = ease('expo.out');
    const settleE = ease('power3.inOut');

    function draw(t: number, dt: number) {
        lastT = t;
        let target: number;
        const userActive = scroller && userAt > 0 && performance.now() - userAt < 4000;
        if (scroller && userActive) {
          const max = scroller.scrollHeight - scroller.clientHeight;
          target = max > 0 ? clamp(scroller.scrollTop / max, 0, 1) : 0;
        } else {
          target = simP(t);
          if (scroller) {
            const max = scroller.scrollHeight - scroller.clientHeight;
            const want = Math.round(target * max);
            if (Math.abs(scroller.scrollTop - want) >= 1) {
              scroller.scrollTop = want;
              lastSet = scroller.scrollTop;
            }
          }
        }
        shown = dt > 0 && userActive ? lerp(shown, target, 1 - Math.exp(-dt * 10)) : target;
        const p = shown;
        const P = clamp(p / 0.86, 0, 1);
        const lit = smoothstep(0.88, 1, p);
        let cur = 0;
        groups.forEach((gr, i) => {
          const u = P * n - i;
          let x = W / 2;
          let y = H / 2;
          let s = gr.S;
          let o = 0;
          if (u <= 0) {
            y += H * 0.28;
            s *= 0.86;
          } else if (u < 0.45) {
            const e = enterE(u / 0.45);
            y += H * 0.28 * (1 - e);
            s *= 0.86 + 0.14 * e;
            o = e;
            cur = i;
          } else if (u < 0.6) {
            o = 1;
            cur = i;
          } else if (u < 1) {
            const e = settleE((u - 0.6) / 0.4);
            x = lerp(W / 2, gr.fcx, e);
            y = lerp(H / 2, gr.fcy, e);
            s = lerp(gr.S, 1, e);
            o = 1 - 0.84 * e * (1 - lit);
            cur = i;
          } else {
            x = gr.fcx;
            y = gr.fcy;
            s = 1;
            o = 0.16 + 0.84 * lit;
            cur = Math.max(cur, i);
          }
          const key = `${x.toFixed(1)}|${y.toFixed(1)}|${s.toFixed(3)}|${o.toFixed(3)}`;
          if (key === gr.last) return;
          gr.last = key;
          gr.wrap.style.transform = `translate(${(x - gr.fcx).toFixed(2)}px, ${(y - gr.fcy).toFixed(2)}px) scale(${s.toFixed(4)})`;
          gr.wrap.style.opacity = o.toFixed(3);
        });
        counter.textContent = `${String(Math.min(n, cur + (P > 0 ? 1 : 0))).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
        fill.style.transform = `scaleY(${p.toFixed(4)})`;
        const hv = 1 - smoothstep(0.02, 0.1, p);
        hint.style.opacity = hv.toFixed(3);
        hint.style.transform = `translate(-50%, ${(Math.sin(t * 4) * 4).toFixed(2)}px)`;
    }

    return {
      render: draw,
      dispose() {
        offs.forEach((f) => f());
      },
    };
  },
};
export default impl;
