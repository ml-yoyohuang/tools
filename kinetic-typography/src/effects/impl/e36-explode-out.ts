import { el, glyphSpans } from '../../engine/dom';
import { clamp, num, PALETTE, TAU, timelineRuntime } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText } from '../../engine/text';
import type { EffectImpl } from '../../engine/types';

// Assemble (power4.out) → read → tremble → BOOM: every glyph leaves the stage on a
// seeded heading (radial from the text centre + noise) with its own spin and depth
// (some rush toward the camera and grow, some recede and shrink), expo.out, fading.
// A shock ring and debris chips sell the blast. The exploded pose is also the start
// pose of the next assembly, so the loop is seamless.
const impl: EffectImpl = {
  id: 'explode-out',
  defaults: { ...PALETTE.coral },
  loopable: true,
  posterTime: 1.6,
  maxChars: 40,
  params: [
    { key: 'spread', label: '飛散距離', type: 'range', min: 0.4, max: 1.6, step: 0.05, default: 1, hint: '相對於舞台對角線' },
    { key: 'spin', label: '旋轉量', type: 'range', min: 0, max: 2, step: 0.1, default: 1 },
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1.3, unit: 's' },
  ],
  create(ctx) {
    const W = ctx.width;
    const H = ctx.height;
    const k = ctx.s.intensity;
    const spread = num(ctx, 'spread', 1) * Math.hypot(W, H) * clamp(0.4 + 0.6 * k, 0.3, 1.8);
    const spin = num(ctx, 'spin', 1);
    const hold = num(ctx, 'hold', 1.3);
    const { primary: fg, secondary: acc } = ctx.s;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.5, maxWidth: W * 0.82 });
    const fs = L.fontSize;
    const cx = L.x + L.width / 2;
    const cy = L.y + L.height / 2;

    return timelineRuntime(ctx, (tl) => {
      const spans = glyphSpans(ctx.root, L, { color: fg });
      // seeded blast pose per glyph
      const poses = spans.map(({ g }, i) => {
        const r = (j: number) => hash2(i, j, ctx.seed);
        const dx = g.cx - cx;
        const dy = g.cy - cy;
        const base = Math.hypot(dx, dy) < fs * 0.3 ? r(1) * TAU : Math.atan2(dy, dx);
        const ang = base + (r(2) - 0.5) * 1.3;
        const dist = spread * (0.65 + r(3) * 0.55);
        const toward = r(4) < 0.45;
        return {
          x: Math.cos(ang) * dist,
          y: Math.sin(ang) * dist - spread * 0.08,
          rotation: (r(5) < 0.5 ? -1 : 1) * (140 + r(6) * 420) * spin,
          rotationX: (r(7) - 0.5) * 160 * spin,
          scale: toward ? 1.8 + r(8) * 1.6 : 0.25 + r(8) * 0.35,
          opacity: 0,
          delay: r(9) * 0.07,
        };
      });
      spans.forEach((s) => (s.el.style.transformStyle = 'preserve-3d'));
      ctx.root.style.perspective = `${fs * 12}px`;

      // shock ring + debris
      const ringSize = Math.max(L.width, L.height) * 0.6;
      const ring = el('div', { style: { position: 'absolute', left: `${cx - ringSize / 2}px`, top: `${cy - ringSize / 2}px`, width: `${ringSize}px`, height: `${ringSize}px`, borderRadius: '50%', border: `${Math.max(2, fs * 0.06)}px solid ${acc}`, opacity: 0 } }, ctx.root);
      const nDebris = Math.round(36 * ctx.q * clamp(k, 0.3, 1.5));
      const debris = Array.from({ length: nDebris }, (_, i) => {
        const s = fs * (0.05 + hash2(i, 21, ctx.seed) * 0.12);
        const d = el('div', { style: { position: 'absolute', left: `${cx}px`, top: `${cy}px`, width: `${s}px`, height: `${s * (0.4 + hash2(i, 22, ctx.seed))}px`, background: i % 3 ? acc : fg, opacity: 0 } }, ctx.root);
        const a = hash2(i, 23, ctx.seed) * TAU;
        const r = spread * (0.25 + hash2(i, 24, ctx.seed) * 0.5);
        return { d, x: Math.cos(a) * r * (W / Math.hypot(W, H)) * 1.4, y: Math.sin(a) * r, rot: (hash2(i, 25, ctx.seed) - 0.5) * 1080 };
      });

      // 1) assemble from the blast pose (reverse direction, different ease)
      spans.forEach((s, i) => {
        const p = poses[i];
        tl.fromTo(
          s.el,
          { x: p.x * 0.8, y: p.y * 0.8, rotation: -p.rotation * 0.5, rotationX: p.rotationX, scale: p.scale, opacity: 0 },
          { x: 0, y: 0, rotation: 0, rotationX: 0, scale: 1, opacity: 1, duration: 0.95, ease: 'power4.out' },
          0.05 + hash2(i, 30, ctx.seed) * 0.3,
        );
      });
      const assembled = 1.3;
      // 2) tremble before the blast
      const blast = assembled + hold;
      const shakeAt = blast - Math.min(0.5, hold * 0.6);
      spans.forEach((s, i) => {
        tl.to(s.el, { x: () => (hash2(i, 40, ctx.seed) - 0.5) * fs * 0.06 * k, y: (hash2(i, 41, ctx.seed) - 0.5) * fs * 0.05 * k, scale: 1.06, duration: 0.045, ease: 'none', yoyo: true, repeat: 2 * Math.max(1, Math.floor((blast - shakeAt) / 0.09)) - 1 }, shakeAt);
      });
      // 3) blast
      spans.forEach((s, i) => {
        const p = poses[i];
        tl.to(s.el, { x: p.x, y: p.y, rotation: p.rotation, rotationX: p.rotationX, scale: p.scale, duration: 1.35, ease: 'expo.out' }, blast + p.delay);
        tl.to(s.el, { opacity: 0, duration: 0.9, ease: 'power2.in' }, blast + p.delay + 0.15);
      });
      tl.fromTo(ring, { scale: 0.2, opacity: 0.95, borderWidth: Math.max(2, fs * 0.12) }, { immediateRender: false, scale: 3.2, opacity: 0, borderWidth: 1, duration: 0.75, ease: 'power3.out' }, blast);
      debris.forEach((b) => {
        tl.fromTo(b.d, { x: 0, y: 0, rotation: 0, opacity: 1 }, { immediateRender: false, x: b.x, y: b.y, rotation: b.rot, opacity: 0, duration: 1.1, ease: 'expo.out' }, blast);
      });
      tl.to({}, { duration: 0.35 }, blast + 1.5);
      return { settle: assembled + Math.min(0.6, hold * 0.4) };
    });
  },
};
export default impl;
