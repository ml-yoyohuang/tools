import { el } from '../../engine/dom';
import { clamp, num, PALETTE, timelineRuntime } from '../../engine/helpers';
import { fontString, graphemes, phrases, textWidth } from '../../engine/text';
import type { EffectImpl } from '../../engine/types';

// Every blade is one copy of the word set in a vertical column that reads from the
// tip toward a shared pivot (vertical-rl keeps CJK upright and rotates latin). The
// blades start stacked on the left edge, open with a staggered back.out drag to
// equal angles, flutter a little, then fold back in reverse order.
const DEG = Math.PI / 180;

/** Split one long phrase into short readable chunks (by words for latin, evenly otherwise). */
function chunks(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  if (words.length > 1) {
    let cur = '';
    for (const w of words) {
      if (cur && graphemes(cur + ' ' + w).length > max) {
        out.push(cur);
        cur = w;
      } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) out.push(cur);
    return out;
  }
  const g = graphemes(text);
  const parts = Math.ceil(g.length / max);
  const size = Math.ceil(g.length / parts);
  for (let i = 0; i < g.length; i += size) out.push(g.slice(i, i + size).join(''));
  return out;
}

/** Bounding box (unit radius) of a sector spanning [a0, a1] (radians, screen coords) incl. its apex. */
function sectorBox(a0: number, a1: number) {
  const pts: [number, number][] = [[0, 0], [Math.cos(a0), Math.sin(a0)], [Math.cos(a1), Math.sin(a1)]];
  for (let k = -4; k <= 4; k++) {
    const a = (k * Math.PI) / 2;
    if (a > a0 && a < a1) pts.push([Math.cos(a), Math.sin(a)]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  // margin for the blade width at the outer edges
  return { x0: Math.min(...xs) - 0.08, x1: Math.max(...xs) + 0.08, y0: Math.min(...ys) - 0.08, y1: Math.max(...ys) + 0.08 };
}

const impl: EffectImpl = {
  id: 'text-fan',
  defaults: { ...PALETTE.paperInk },
  loopable: true,
  posterTime: 2.6,
  maxChars: 30,
  textHint: '用「／」分隔多個詞，扇骨會輪流使用。',
  params: [
    { key: 'blades', label: '扇骨數', type: 'range', min: 3, max: 16, step: 1, default: 9 },
    { key: 'spread', label: '展開角度', type: 'range', min: 90, max: 300, step: 5, default: 180, unit: '°' },
  ],
  create(ctx) {
    let words = phrases(ctx.text);
    if (words.length === 1 && graphemes(words[0]).length > 10) words = chunks(words[0], 6);
    const N = Math.max(3, Math.round(num(ctx, 'blades', 9) * (ctx.mode === 'card' ? 0.85 : 1) * (0.6 + 0.4 * ctx.q)));
    const S = clamp(num(ctx, 'spread', 180), 60, 330) * DEG;
    const k = ctx.s.intensity;
    // open upward on wide stages, sideways (to the right) when that gives a larger fan (portrait)
    const fit = (dir: number) => {
      const b = sectorBox(dir - S / 2, dir + S / 2);
      return { dir, box: b, R: Math.min((ctx.width * 0.9) / (b.x1 - b.x0), (ctx.height * 0.86) / (b.y1 - b.y0)) };
    };
    const up = fit(-Math.PI / 2);
    const side = fit(0);
    const { dir, box, R } = side.R > up.R * 1.12 ? side : up;
    const a0 = dir - S / 2;
    const px = ctx.width / 2 - ((box.x0 + box.x1) / 2) * R;
    const py = ctx.height / 2 - ((box.y0 + box.y1) / 2) * R;
    const step = S / (N - 1);
    const family = ctx.font.sans;
    // font size: the longest word column + inner radius must fit inside R, and the
    // column width must fit the angular gap at the inner radius.
    const lenEm = Math.max(...words.map((w) => textWidth(w, 100, family, 900, ctx.s.tracking) / 100), 0.6);
    const sp = Math.max(0.12, Math.min(step, 0.7));
    const fBase = R / (lenEm + 0.92 / sp + 0.08);
    const fs = clamp(fBase * ctx.s.fontScale, 6, R * 0.32);
    const inner = Math.max(R * 0.2, Math.min(R - lenEm * fs - fs * 0.1, (fs * 0.92) / sp));

    const fan = el('div', { style: { position: 'absolute', left: `${px}px`, top: `${py}px`, width: '0', height: '0', willChange: 'transform' } }, ctx.root);
    const blades: HTMLDivElement[] = [];
    const tipW = Math.min(R * sp * 0.98, fs * 2.2);
    for (let i = 0; i < N; i++) {
      const alt = i % 2 === 1;
      const blade = el('div', { style: { position: 'absolute', left: '0', top: '0', width: '0', height: '0', transformOrigin: '0 0', opacity: 0 } }, fan);
      // paper strip, tapering toward the pivot
      el(
        'div',
        {
          style: {
            position: 'absolute',
            left: `${-tipW / 2}px`,
            top: `${-R}px`,
            width: `${tipW}px`,
            height: `${R - inner * 0.72}px`,
            background: alt ? ctx.s.secondary : ctx.s.primary,
            opacity: alt ? 0.16 : 0.06,
            clipPath: `polygon(0 0, 100% 0, ${50 + 24}% 100%, ${50 - 24}% 100%)`,
          },
        },
        blade,
      );
      // rib from the pivot
      el('div', { style: { position: 'absolute', left: '-0.75px', top: `${-inner * 0.95}px`, width: '1.5px', height: `${inner * 0.95}px`, background: ctx.s.primary, opacity: 0.55 } }, blade);
      el(
        'div',
        {
          text: words[i % words.length],
          style: {
            position: 'absolute',
            left: '0',
            top: `${-R + fs * 0.08}px`,
            height: `${R - inner}px`,
            transform: 'translateX(-50%)',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            font: fontString(fs, family, 900),
            lineHeight: '1',
            letterSpacing: `${ctx.s.tracking}em`,
            whiteSpace: 'nowrap',
            color: alt ? ctx.s.secondary : ctx.s.primary,
          },
        },
        blade,
      );
      blades.push(blade);
    }
    // pivot rivet
    const rv = Math.max(4, fs * 0.22);
    el('div', { style: { position: 'absolute', left: `${-rv}px`, top: `${-rv}px`, width: `${rv * 2}px`, height: `${rv * 2}px`, borderRadius: '50%', background: ctx.s.secondary, boxShadow: `0 0 0 ${rv * 0.45}px ${ctx.s.background}, 0 0 0 ${rv * 0.75}px ${ctx.s.primary}` } }, fan);

    const ang = (a: number) => (a + Math.PI / 2) / DEG; // blade div points "up" at rotation 0
    return timelineRuntime(ctx, (tl) => {
      tl.set(blades, { rotation: ang(a0) }, 0);
      tl.set(fan, { rotation: -6 * k, scale: 0.94 }, 0);
      tl.to(blades, { opacity: 1, duration: 0.25, ease: 'power1.out' }, 0.05);
      // open: blades drag one another, last one travels furthest
      const open = 0.35;
      blades.forEach((b, i) => {
        tl.to(b, { rotation: ang(a0 + i * step), duration: 1.15, ease: `back.out(${1 + 0.8 * k})` }, open + i * 0.055);
      });
      tl.to(fan, { rotation: 0, scale: 1, duration: 1.4, ease: 'expo.out' }, open);
      const opened = open + (N - 1) * 0.055 + 1.15;
      // gentle flutter while open
      tl.to(fan, { rotation: 2.5 * k, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: 1 }, opened);
      const fold = opened + 1.9;
      blades.forEach((b, i) => {
        tl.to(b, { rotation: ang(a0), duration: 0.85, ease: 'power3.inOut' }, fold + (N - 1 - i) * 0.035);
      });
      tl.to(fan, { rotation: -6 * k, scale: 0.94, duration: 0.9, ease: 'power2.in' }, fold + 0.1);
      const end = fold + (N - 1) * 0.035 + 0.85;
      tl.to(blades, { opacity: 0, duration: 0.3, ease: 'power1.in' }, end - 0.05);
      tl.to({}, { duration: 0.2 }, end + 0.25);
      return { settle: opened + 0.9 };
    });
  },
};
export default impl;
