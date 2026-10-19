import { el, glyphSpans } from '../../engine/dom';
import { clamp, num, PALETTE, timelineRuntime } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText } from '../../engine/text';
import type { EffectImpl } from '../../engine/types';

// A short burst entrance: glyphs start collapsed at the centre, blast outward past
// their slots with an overshooting scale (expo.out), then snap back home (back.out).
// A ring + radial rays (scaleX from the inside, then retracting outward) sell the
// pop. Unlike "explode-out" (36) the glyphs always return to their layout slots.
const impl: EffectImpl = {
  id: 'word-burst',
  defaults: { ...PALETTE.darkLime },
  loopable: true,
  posterTime: 0.42,
  maxChars: 30,
  textHint: '可用「／」換行；整段文字一起爆開後回收。',
  params: [
    { key: 'spread', label: '外擴距離', type: 'range', min: 0, max: 1.5, step: 0.05, default: 0.6, hint: '字元向外錯開的幅度（相對字級）' },
    { key: 'rays', label: '放射線數', type: 'range', min: 0, max: 36, step: 2, default: 20 },
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1.4, unit: 's' },
  ],
  create(ctx) {
    const k = ctx.s.intensity;
    const spread = num(ctx, 'spread', 0.6) * k;
    const nRays = Math.round(num(ctx, 'rays', 20) * (0.4 + 0.6 * ctx.q));
    const hold = num(ctx, 'hold', 1.4);
    const L = layoutText(ctx, ctx.text, { maxWidth: ctx.width * 0.74, maxHeight: ctx.height * 0.5 });
    const bx = L.x + L.width / 2;
    const by = L.y + L.height / 2;
    const fs = L.fontSize;
    const radius = Math.max(L.width, L.height) / 2;
    const reach = Math.hypot(ctx.width, ctx.height) / 2;

    return timelineRuntime(ctx, (tl) => {
      const stage = el('div', { style: { position: 'absolute', inset: '0', willChange: 'transform' } }, ctx.root);
      const fx = el('div', { style: { position: 'absolute', inset: '0' } }, stage);
      const textLayer = el('div', { style: { position: 'absolute', inset: '0' } }, stage);

      // flash disc + ring behind the text
      const disc = el('div', {
        style: { position: 'absolute', left: bx, top: by, width: radius * 1.5, height: radius * 1.5, borderRadius: '50%', background: ctx.s.secondary, opacity: 0 },
      }, fx);
      const ring = el('div', {
        style: { position: 'absolute', left: bx, top: by, width: radius * 2, height: radius * 2, borderRadius: '50%', border: `${Math.max(2, fs * 0.05)}px solid ${ctx.s.secondary}`, opacity: 0 },
      }, fx);
      tl.set([disc, ring], { xPercent: -50, yPercent: -50, scale: 0.2 }, 0);

      // radial rays: an outer rotated holder + an inner bar animated along its own axis
      const rays = Array.from({ length: nRays }, (_, i) => {
        const a = (i / nRays) * 360 + (hash2(i, 1, ctx.seed) - 0.5) * (300 / Math.max(1, nRays));
        const len = reach * (0.18 + hash2(i, 2, ctx.seed) * 0.22);
        const thick = Math.max(2, fs * (0.03 + hash2(i, 3, ctx.seed) * 0.05));
        const holder = el('div', { style: { position: 'absolute', left: bx, top: by, width: '0', height: '0', transform: `rotate(${a}deg)` } }, fx);
        const bar = el('div', {
          style: { position: 'absolute', left: '0', top: -thick / 2, width: len, height: thick, borderRadius: thick, background: i % 3 === 0 ? ctx.s.primary : ctx.s.secondary },
        }, holder);
        // start just outside the text ellipse in that direction
        const rad = (a * Math.PI) / 180;
        const r0 = Math.hypot((Math.cos(rad) * L.width) / 2, (Math.sin(rad) * L.height) / 2) + fs * 0.25;
        return { bar, len, r0, i };
      });

      const spans = glyphSpans(textLayer, L, { color: ctx.s.primary });
      const n = spans.length;
      let maxOff = 1;
      for (const { g } of spans) maxOff = Math.max(maxOff, Math.hypot(g.cx - bx, g.cy - by));

      const t0 = 0.12;
      const hit = t0 + 0.2; // moment of maximum spread

      spans.forEach(({ el: s, g }, i) => {
        let dx = g.cx - bx;
        let dy = g.cy - by;
        const d = Math.hypot(dx, dy);
        if (d < 1) {
          const a = hash2(i, 7, ctx.seed) * Math.PI * 2;
          dx = Math.cos(a);
          dy = Math.sin(a);
        } else {
          dx /= d;
          dy /= d;
        }
        // single-line text gets some vertical scatter so the burst reads as radial
        dy += (hash2(i, 9, ctx.seed) - 0.5) * 0.9;
        const m = spread * fs * (0.35 + 0.65 * clamp(d / maxOff, 0, 1));
        const rot = (hash2(i, 11, ctx.seed) - 0.5) * 24 * k;
        tl.set(s, { x: (bx - g.cx) * 0.92, y: (by - g.cy) * 0.92, scale: 0.15, opacity: 0, rotation: -rot }, 0);
        const st = t0 + i * Math.min(0.012, 0.15 / n);
        tl.to(s, { x: dx * m, y: dy * m, scale: 1 + 0.32 * k, rotation: rot, opacity: 1, duration: 0.2, ease: 'expo.out' }, st);
        tl.to(s, { x: 0, y: 0, scale: 1, rotation: 0, duration: 0.62, ease: 'back.out(2.8)' }, st + 0.2);
      });

      // flash
      tl.to(disc, { scale: 1.15, opacity: 0.9, duration: 0.1, ease: 'power4.out' }, t0);
      tl.to(disc, { scale: 1.5, opacity: 0, duration: 0.35, ease: 'power2.out' }, t0 + 0.1);
      tl.to(ring, { opacity: 1, scale: 0.9, duration: 0.12, ease: 'power3.out' }, t0 + 0.04);
      tl.to(ring, { scale: 2.6, opacity: 0, duration: 0.6, ease: 'expo.out' }, t0 + 0.16);

      // rays shoot out from the edge, then retract outward and vanish
      for (const r of rays) {
        const st = t0 + 0.03 + hash2(r.i, 5, ctx.seed) * 0.06;
        tl.set(r.bar, { x: r.r0, scaleX: 0, transformOrigin: '0% 50%', opacity: 1 }, 0);
        tl.to(r.bar, { scaleX: 1, duration: 0.16, ease: 'expo.out' }, st);
        tl.set(r.bar, { transformOrigin: '100% 50%' }, st + 0.16);
        tl.to(r.bar, { x: r.r0 + r.len * 0.9, scaleX: 0, duration: 0.34, ease: 'power2.in' }, st + 0.16);
      }

      // impact jolt of the whole stage
      const j = Math.max(2, fs * 0.04) * k;
      tl.to(stage, { x: j, y: -j * 0.6, duration: 0.035, ease: 'none' }, hit);
      tl.to(stage, { x: -j * 0.7, y: j * 0.5, duration: 0.035, ease: 'none' }, '>');
      tl.to(stage, { x: j * 0.3, y: -j * 0.2, duration: 0.035, ease: 'none' }, '>');
      tl.to(stage, { x: 0, y: 0, duration: 0.05, ease: 'none' }, '>');

      // exit: quick implosion to the centre
      const settle = hit + 0.62 + 0.25;
      const exit = hit + 0.62 + hold;
      spans.forEach(({ el: s, g }, i) => {
        tl.to(s, { x: (bx - g.cx) * 0.6, y: (by - g.cy) * 0.6, scale: 0, opacity: 0, duration: 0.26, ease: 'power3.in' }, exit + i * Math.min(0.015, 0.12 / n));
      });
      tl.to({}, { duration: 0.35 }, '>');
      return { settle };
    });
  },
};
export default impl;
