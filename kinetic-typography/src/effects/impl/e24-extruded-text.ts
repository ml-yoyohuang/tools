import { mixHex } from '../../engine/canvas';
import { el, textBlock } from '../../engine/dom';
import { clamp, num, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Layered extrusion: the same text block is stacked along −Z (translateZ per
// layer) inside one preserve-3d group. The front layer is the brightest face;
// side layers are tinted from the side colour toward shadow by depth, and the
// whole side brightens / darkens with the current yaw (light from the upper
// left). Rotating the group reveals the real thickness — not a flat shadow.
const impl: EffectImpl = {
  id: 'extruded-text',
  defaults: { background: '#101114', primary: '#F4F1E8', secondary: '#FF7153' },
  posterTime: 1.8,
  maxChars: 24,
  params: [
    { key: 'depth', label: '厚度', type: 'range', min: 0.1, max: 0.8, step: 0.02, default: 0.36, hint: '相對字級的擠出深度。' },
    { key: 'layers', label: '層數', type: 'range', min: 8, max: 60, step: 1, default: 36, hint: '層數越多側面越平滑（卡片預覽會自動減少）。' },
    { key: 'angle', label: '擺動角度', type: 'range', min: 0, max: 50, step: 1, default: 35, unit: '°' },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: front, secondary: side, background: bg } = ctx.s;
    const L = layoutText(ctx, ctx.text, { maxWidth: W * 0.7, maxHeight: H * 0.5, lineHeight: 1.08 });
    const depth = L.fontSize * num(ctx, 'depth', 0.36);
    const N = Math.max(6, Math.round(num(ctx, 'layers', 36) * ctx.q));
    const amp = num(ctx, 'angle', 35) * clamp(ctx.s.intensity, 0, 2);
    const dz = depth / N;
    const shadowCol = mixHex(side, '#000000', 0.78);

    // floor shadow
    const shadow = el(
      'div',
      {
        style: {
          position: 'absolute',
          left: `${W / 2 - L.width * 0.55}px`,
          top: `${L.y + L.height + L.fontSize * 0.12}px`,
          width: `${L.width * 1.1}px`,
          height: `${L.fontSize * 0.3}px`,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${mixHex(bg, '#000000', 0.6)}cc, ${bg}00 70%)`,
          willChange: 'transform',
        },
      },
      ctx.root,
    );
    const viewport = el('div', { style: { position: 'absolute', inset: '0', perspective: `${Math.max(W, H) * 1.6}px`, perspectiveOrigin: '50% 45%' } }, ctx.root);
    const group = el(
      'div',
      { style: { position: 'absolute', inset: '0', transformStyle: 'preserve-3d', transformOrigin: `${W / 2}px ${L.y + L.height / 2}px ${-depth / 2}px`, willChange: 'transform' } },
      viewport,
    );
    const layers: { block: HTMLDivElement; f: number }[] = [];
    // back to front so the DOM order also matches depth
    for (let i = N; i >= 0; i--) {
      const f = i / N; // 0 = front face … 1 = back face
      const { block } = textBlock(group, L, { color: i === 0 ? front : side });
      block.style.transform = `translateZ(${-i * dz}px)`;
      if (i === 0 && !/\p{Extended_Pictographic}/u.test(ctx.text)) {
        // front face: subtle top-lit gradient on the glyphs + a crisp rim
        block.style.backgroundImage = `linear-gradient(180deg, ${front} 0%, ${front} 55%, ${mixHex(front, side, 0.18)} 100%)`;
        block.style.webkitBackgroundClip = 'text';
        block.style.backgroundClip = 'text';
        block.style.color = 'transparent';
      }
      layers.push({ block, f });
    }
    const sides = layers.filter((l) => l.f > 0);

    let lastKey = '';
    return {
      render(t) {
        const ph = (t * TAU) / 7;
        const yaw = Math.sin(ph) * amp;
        const pitch = -6 + Math.sin(ph * 0.5 + 0.8) * 5 * Math.min(1, ctx.s.intensity);
        group.style.transform = `rotateX(${pitch}deg) rotateY(${yaw}deg)`;
        shadow.style.transform = `translateX(${-yaw * L.fontSize * 0.012}px) scaleX(${1 - Math.abs(yaw) / 260})`;
        // light from the upper-left: the side we see is lit when we look from the left
        const lit = clamp(0.5 - yaw / (amp * 2 + 1e-3) * 0.6, 0, 1);
        const key = lit.toFixed(2);
        if (key === lastKey) return;
        lastKey = key;
        for (const l of sides) {
          // lit tone near the front edge, falling to shadow deeper in
          const shade = clamp(0.12 + l.f * 0.55 + (1 - lit) * 0.35, 0, 0.95);
          l.block.style.color = mixHex(side, shadowCol, shade);
        }
      },
    };
  },
};
export default impl;
