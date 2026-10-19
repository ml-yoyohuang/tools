import { el, textBlock } from '../../engine/dom';
import { autoPath, lerp, num, PALETTE, pointerOrAuto } from '../../engine/helpers';
import { asLines, fontString, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// The lens contains a full copy of the text layer, translated + scaled so the
// stage point under the lens centre maps to the lens centre: real local magnification.
const impl: EffectImpl = {
  id: 'magnifier-lens',
  defaults: { ...PALETTE.paperInk, secondary: '#27D3C2' },
  interactive: true,
  posterTime: 1.4,
  maxChars: 30,
  params: [
    { key: 'zoom', label: '放大倍率', type: 'range', min: 1.5, max: 4, step: 0.1, default: 2.4, unit: '×' },
    { key: 'size', label: '鏡片尺寸', type: 'range', min: 0.2, max: 0.6, step: 0.02, default: 0.36, hint: '相對於舞台高度' },
    { key: 'fine', label: '顯示細節小字', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const zoom = num(ctx, 'zoom', 2.4);
    const R = (ctx.height * num(ctx, 'size', 0.36)) / 2;
    const fine = ctx.s.params.fine !== false;
    const L = layoutText(ctx, ctx.text, { maxHeight: ctx.height * (fine ? 0.38 : 0.5), maxWidth: ctx.width * 0.84, cy: ctx.height * (fine ? 0.42 : 0.5) });

    const build = (parent: HTMLElement) => {
      const content = el('div', { style: { position: 'absolute', left: '0', top: '0', width: `${ctx.width}px`, height: `${ctx.height}px`, background: ctx.s.background } }, parent);
      textBlock(content, L, { color: ctx.s.primary });
      if (fine) {
        // micro copy: tiny lines that are only readable through the lens
        const micro = asLines(ctx.text).replace(/\n/g, ' ');
        const fs = Math.max(5, ctx.height * 0.022);
        for (let i = 0; i < 3; i++) {
          el(
            'div',
            {
              text: `${String(i + 1).padStart(2, '0')} — ${micro} · ${micro} · DETAIL ${(i + 1) * 0.25}mm`,
              style: {
                position: 'absolute',
                left: '8%',
                right: '8%',
                top: `${ctx.height * 0.7 + i * fs * 1.9}px`,
                font: fontString(fs, i === 2 ? ctx.font.mono : ctx.font.sans, i === 0 ? 700 : 400),
                color: ctx.s.primary,
                opacity: 0.8,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textAlign: 'center',
              },
            },
            content,
          );
        }
        // ruler ticks
        const ruler = el('div', { style: { position: 'absolute', left: '8%', right: '8%', top: `${ctx.height * 0.66}px`, height: `${fs}px`, borderTop: `1px solid ${ctx.s.primary}`, backgroundImage: `repeating-linear-gradient(90deg, ${ctx.s.primary} 0 1px, transparent 1px ${fs * 0.6}px)`, backgroundSize: `100% ${fs * 0.5}px`, backgroundRepeat: 'no-repeat', opacity: 0.6 } }, content);
        void ruler;
      }
      return content;
    };
    build(ctx.root);

    const lens = el(
      'div',
      {
        style: {
          position: 'absolute',
          left: '0',
          top: '0',
          width: `${R * 2}px`,
          height: `${R * 2}px`,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: `0 0 0 ${Math.max(3, R * 0.06)}px ${ctx.s.secondary}, 0 ${R * 0.12}px ${R * 0.35}px rgba(0,0,0,.35)`,
          willChange: 'transform',
        },
      },
      ctx.root,
    );
    const inner = build(lens);
    inner.style.transformOrigin = '0 0';
    // glass highlight
    el('div', { style: { position: 'absolute', inset: '0', borderRadius: '50%', background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.45), rgba(255,255,255,0) 38%), radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 70%, rgba(0,0,0,.18))', pointerEvents: 'none' } }, lens);
    const handle = el('div', { style: { position: 'absolute', left: '0', top: '0', width: `${R * 0.95}px`, height: `${Math.max(6, R * 0.2)}px`, borderRadius: '999px', background: ctx.s.secondary, transformOrigin: '0 50%' } }, ctx.root);

    let px = ctx.width / 2;
    let py = ctx.height / 2;
    const place = (x: number, y: number) => {
      lens.style.transform = `translate3d(${x - R}px, ${y - R}px, 0)`;
      inner.style.transform = `translate(${R - x * zoom}px, ${R - y * zoom}px) scale(${zoom})`;
      handle.style.transform = `translate3d(${x + R * 0.7}px, ${y + R * 0.7}px, 0) rotate(45deg)`;
    };
    const path = (t: number) => autoPath(ctx, t * 0.8, 0.34 * Math.min(1.4, ctx.s.intensity + 0.2), 0.18, 0.13, 0.21);
    return {
      reset() {
        const p = path(0);
        px = p.x;
        py = p.y;
      },
      render(t, dt) {
        const target = pointerOrAuto(ctx, t, path);
        if (dt === 0 || !target.real) {
          px = target.x;
          py = target.y;
        } else {
          const k = 1 - Math.exp(-dt * 14);
          px = lerp(px, target.x, k);
          py = lerp(py, target.y, k);
        }
        place(px, py);
      },
    };
  },
};
export default impl;
