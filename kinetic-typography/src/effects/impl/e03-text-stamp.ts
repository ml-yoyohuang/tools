import { mixHex } from '../../engine/canvas';
import { el } from '../../engine/dom';
import { bool, num, PALETTE, timelineRuntime } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fontString, layoutText, phrases, type TextLayout } from '../../engine/text';
import type { EffectContext, EffectImpl } from '../../engine/types';

// Every phrase is a double-framed rubber stamp. It drops from scale 2.4 with expo.in,
// lands with a squish, a short decaying stage shake and a burst of ink speckles; the
// ink starts dark/wet and dries to a lighter, slightly translucent tone. Missing-ink
// pits (background-coloured dots) give the impression texture. Angles/positions are
// seeded so every replay is identical.
interface Cell {
  L: TextLayout;
  cx: number;
  cy: number;
}

function arrange(ctx: EffectContext, list: string[], serial: boolean): Cell[] {
  const n = list.length;
  const W = ctx.width * 0.92;
  const H = ctx.height * 0.86;
  const extraH = serial ? 0.62 : 0; // serial line height in em
  let best: { cols: number; fs: number } = { cols: 1, fs: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = W / cols;
    const ch = H / rows;
    let fs = Infinity;
    for (const p of list) {
      const L = layoutText(ctx, p, { maxWidth: cw * 0.66, maxHeight: (ch * 0.66) / (1 + extraH * 0.6), fill: 1, noScale: true, lineHeight: 1.1 });
      fs = Math.min(fs, L.fontSize);
    }
    if (fs > best.fs * 1.02) best = { cols, fs };
  }
  const cols = best.cols;
  const rows = Math.ceil(n / cols);
  const cw = W / cols;
  const ch = H / rows;
  return list.map((p, i) => {
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const c = i - r * cols;
    const rowW = inRow * cw;
    const cx = (ctx.width - rowW) / 2 + cw * (c + 0.5) + (hash2(i, 21, ctx.seed) - 0.5) * cw * 0.1;
    const cy = (ctx.height - H) / 2 + ch * (r + 0.5) + (hash2(i, 22, ctx.seed) - 0.5) * ch * 0.1;
    const L = layoutText(ctx, p, { maxWidth: cw * 0.66, maxHeight: (ch * 0.66) / (1 + extraH * 0.6), maxSize: best.fs, lineHeight: 1.1, fill: 1 });
    return { L, cx, cy };
  });
}

const ANGLES = [-11, 7, -4, 13, -8, 4, -14, 9];

const impl: EffectImpl = {
  id: 'text-stamp',
  defaults: { ...PALETTE.paperInk },
  loopable: true,
  posterTime: 2.6,
  maxChars: 30,
  textHint: '用「／」分隔，每個詞是一枚印章，依序蓋下。',
  params: [
    { key: 'gap', label: '蓋章間隔', type: 'range', min: 0.25, max: 1.5, step: 0.05, default: 0.6, unit: 's' },
    { key: 'speckle', label: '墨點數量', type: 'range', min: 0, max: 30, step: 1, default: 14 },
    { key: 'serial', label: '顯示編號', type: 'toggle', default: true },
  ],
  create(ctx) {
    const list = phrases(ctx.text).slice(0, 8);
    const gap = num(ctx, 'gap', 0.6);
    const nSpeck = Math.round(num(ctx, 'speckle', 14) * ctx.q);
    const serial = bool(ctx, 'serial', true);
    const k = ctx.s.intensity;
    const ink = ctx.s.secondary;
    const wet = mixHex(ink, ctx.s.primary, 0.5);
    const dry = mixHex(ink, ctx.s.background, 0.12);
    const cells = arrange(ctx, list, serial);

    return timelineRuntime(ctx, (tl) => {
      const shake = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);
      let settle = 0;
      const stamps = cells.map((c, i) => {
        const fs = c.L.fontSize;
        const bw = Math.max(2, fs * 0.09);
        const pad = fs * 0.32;
        const rot = ANGLES[i % ANGLES.length] * Math.min(1.5, k) + (hash2(i, 3, ctx.seed) - 0.5) * 4;
        const stamp = el('div', {
          style: {
            position: 'absolute', left: c.cx, top: c.cy, color: dry, border: `${bw}px solid currentColor`, borderRadius: fs * 0.14,
            padding: `${pad * 0.85}px ${pad * 1.3}px ${pad * (serial ? 0.55 : 0.85)}px`, textAlign: 'center', whiteSpace: 'pre', opacity: 0,
            willChange: 'transform',
          },
        }, shake);
        // inner thin frame
        el('div', {
          style: { position: 'absolute', inset: `${bw * 0.9}px`, border: `${Math.max(1, bw * 0.4)}px solid currentColor`, borderRadius: fs * 0.08, pointerEvents: 'none' },
        }, stamp);
        el('div', {
          text: c.L.lines.map((l) => l.text).join('\n'),
          style: { font: c.L.font, lineHeight: `${fs * 1.1}px`, letterSpacing: `${c.L.tracking + 0.04}em`, marginRight: `${-(c.L.tracking + 0.04)}em` },
        }, stamp);
        if (serial) {
          el('div', {
            text: `— No.${String(i + 1).padStart(3, '0')} · ${String(list.length).padStart(2, '0')} —`,
            style: { font: fontString(Math.max(7, fs * 0.2), ctx.font.mono, 700), letterSpacing: '0.12em', marginTop: `${fs * 0.08}px`, whiteSpace: 'nowrap' },
          }, stamp);
        }
        // missing-ink pits
        const nPits = Math.round(18 * ctx.q);
        for (let p = 0; p < nPits; p++) {
          const s = Math.max(1.5, fs * (0.02 + hash2(i * 50 + p, 31, ctx.seed) * 0.05));
          el('div', {
            style: {
              position: 'absolute', left: `${hash2(i * 50 + p, 32, ctx.seed) * 100}%`, top: `${hash2(i * 50 + p, 33, ctx.seed) * 100}%`,
              width: s, height: s * (0.6 + hash2(p, i, ctx.seed)), borderRadius: '50%', background: ctx.s.background, opacity: 0.9,
            },
          }, stamp);
        }
        // ink speckles splashed around the frame
        const specks = Array.from({ length: nSpeck }, (_, p) => {
          const a = hash2(i * 70 + p, 41, ctx.seed) * Math.PI * 2;
          const r = 0.52 + hash2(i * 70 + p, 42, ctx.seed) * 0.28;
          const s = Math.max(2, fs * (0.03 + hash2(i * 70 + p, 43, ctx.seed) ** 2 * 0.12));
          return el('div', {
            style: {
              position: 'absolute', left: `${50 + Math.cos(a) * r * 100}%`, top: `${50 + Math.sin(a) * r * 115}%`, width: s, height: s,
              borderRadius: '50%', background: 'currentColor', opacity: 0,
            },
          }, stamp);
        });
        return { stamp, specks, rot, fs };
      });

      stamps.forEach((st, i) => {
        const t0 = 0.2 + i * gap;
        const hit = t0 + 0.3;
        tl.set(st.stamp, { xPercent: -50, yPercent: -50, scale: 2.4, rotation: st.rot - 10, opacity: 0, color: wet }, 0);
        tl.set(st.specks, { scale: 0, opacity: 0 }, 0);
        tl.to(st.stamp, { scale: 1, rotation: st.rot, opacity: 1, duration: 0.3, ease: 'expo.in' }, t0);
        // squish on contact
        tl.to(st.stamp, { scaleX: 1.04, scaleY: 0.95, duration: 0.05, ease: 'power2.out' }, hit);
        tl.to(st.stamp, { scaleX: 1, scaleY: 1, duration: 0.25, ease: 'power3.out' }, hit + 0.05);
        // ink dries: dark → faded
        tl.to(st.stamp, { color: dry, opacity: 0.9, duration: 1.1, ease: 'power2.out' }, hit + 0.05);
        tl.to(st.specks, { scale: 1, opacity: 0.85, duration: 0.14, ease: 'back.out(3)', stagger: 0.006 }, hit);
        tl.to(st.specks, { opacity: 0.55, duration: 0.8 }, hit + 0.3);
        // decaying shake of the whole sheet
        const j = Math.max(1.5, st.fs * 0.06) * k;
        [1, -0.7, 0.45, -0.2, 0].forEach((m, q) => {
          tl.to(shake, { x: j * m, y: -j * m * 0.6, rotation: m * 0.4 * k, duration: 0.04, ease: 'none' }, hit + q * 0.04);
        });
        settle = hit + 1.1;
      });
      const end = settle + 1.4;
      tl.to(stamps.map((s) => s.stamp), { opacity: 0, scale: 0.94, duration: 0.45, ease: 'power2.in', stagger: 0.05 }, end);
      tl.to({}, { duration: 0.25 }, '>');
      return { settle };
    });
  },
};
export default impl;
