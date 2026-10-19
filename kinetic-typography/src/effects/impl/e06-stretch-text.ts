import { mix } from '../../engine/canvas';
import { el, glyphSpans } from '../../engine/dom';
import { bool, clamp, ease, num, PALETTE, smoothstep, str } from '../../engine/helpers';
import { fontString, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Pure function of time. One glyph (or all of them) is pulled wide with scaleX
// (power3.inOut), trembles under tension, then snaps back with elastic.out — which
// overshoots into a brief compression. Every frame the line is re-flowed from the
// stretched widths, so neighbours are pushed aside and pulled back in. An optional
// dimension guide shows the current stretch ratio.
const impl: EffectImpl = {
  id: 'stretch-text',
  defaults: { ...PALETTE.teal },
  loopable: false,
  posterTime: 1.2,
  maxChars: 30,
  params: [
    {
      key: 'target', label: '拉長對象', type: 'select', default: 'one',
      options: [{ value: 'one', label: '指定字' }, { value: 'cycle', label: '輪流每個字' }, { value: 'all', label: '整個詞' }],
    },
    { key: 'index', label: '指定第幾個字', type: 'range', min: 1, max: 30, step: 1, default: 2, hint: '「指定字」模式使用，超過字數時取最後一個字。' },
    { key: 'stretch', label: '拉長倍率', type: 'range', min: 1.4, max: 4, step: 0.1, default: 2.6, unit: '×' },
    { key: 'guide', label: '尺寸標示', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const mode = str(ctx, 'target', 'one');
    const k = clamp(ctx.s.intensity, 0, 2);
    const S = mode === 'all' ? 1 + (Math.min(num(ctx, 'stretch', 2.6), 2.4) - 1) * 0.6 * k : 1 + (num(ctx, 'stretch', 2.6) - 1) * k;
    const showGuide = bool(ctx, 'guide', true);

    // fit so the fully stretched line still fits the stage
    let L = layoutText(ctx, ctx.text, { maxWidth: ctx.width * 0.84, maxHeight: ctx.height * 0.5, lineHeight: 1.4 });
    const worst = (lay: typeof L) => {
      let w = 0;
      for (const line of lay.lines) {
        let maxG = 0;
        for (const g of line.glyphs) if (!g.space) maxG = Math.max(maxG, g.w);
        const grown = mode === 'all' ? line.width * S : line.width + maxG * (S - 1);
        w = Math.max(w, grown);
      }
      return w / (ctx.width * 0.94);
    };
    const over = worst(L);
    if (over > 1) L = layoutText(ctx, ctx.text, { maxWidth: (ctx.width * 0.84) / over, maxHeight: ctx.height * 0.5, lineHeight: 1.4 });
    const fs = L.fontSize;
    const tr = L.tracking * fs;
    const n = L.chars.length;
    const idx = clamp(Math.round(num(ctx, 'index', 2)) - 1, 0, n - 1);

    const spans = glyphSpans(ctx.root, L, { color: ctx.s.primary });
    const byGlyph = new Map(spans.map((s) => [s.g, s.el]));

    // dimension guide
    const gColor = ctx.s.secondary;
    const guide = el('div', { style: { position: 'absolute', left: '0', top: '0', height: Math.max(8, fs * 0.16), borderLeft: `2px solid ${gColor}`, borderRight: `2px solid ${gColor}`, opacity: 0, display: showGuide ? 'block' : 'none' } }, ctx.root);
    el('div', { style: { position: 'absolute', left: '0', right: '0', top: '50%', height: '2px', marginTop: '-1px', background: gColor } }, guide);
    const label = el('div', {
      text: '100%',
      style: { position: 'absolute', left: '50%', bottom: '120%', transform: 'translateX(-50%)', font: fontString(Math.max(9, fs * 0.17), ctx.font.mono, 700), color: gColor, whiteSpace: 'nowrap', padding: '0 4px', background: ctx.s.background },
    }, guide);

    const PERIOD = 2.9;
    const inOut = ease('power3.inOut');
    const snap = ease('elastic.out(1,0.28)');
    // stretch factor 1..S as a function of cycle time u
    const amount = (u: number) => {
      if (u < 0.35) return 0;
      if (u < 0.95) return inOut((u - 0.35) / 0.6);
      if (u < 1.3) return 1 + 0.025 * Math.sin((u - 0.95) * 70) * k;
      if (u < 2.7) return 1 - snap((u - 1.3) / 1.4);
      return 0;
    };

    return {
      render(t) {
        const cyc = Math.floor(t / PERIOD);
        const u = t - cyc * PERIOD;
        const a = amount(u);
        const target = mode === 'cycle' ? cyc % n : idx;
        const sOf = (vi: number) => (mode === 'all' || vi === target ? 1 + (S - 1) * a : 1);
        let guideBox: { x: number; w: number; y: number } | null = null;
        for (const line of L.lines) {
          const gs = line.glyphs;
          let total = 0;
          for (const g of gs) total += g.w * (g.space ? 1 : sOf(g.vi));
          total += Math.max(0, gs.length - 1) * tr;
          const cx = L.x + L.width / 2;
          let x = cx - total / 2;
          const x0 = x;
          for (const g of gs) {
            const s = g.space ? 1 : sOf(g.vi);
            const w = g.w * s;
            const span = byGlyph.get(g);
            if (span) {
              const sy = 1 / Math.pow(Math.max(0.3, s), 0.12);
              span.style.transform = `translate(-50%,-50%) translate(${x + w / 2 - g.cx}px,0) scale(${s},${sy})`;
              const c = clamp((s - 1) / Math.max(0.01, S - 1), 0, 1);
              span.style.color = c > 0.01 ? mix(ctx.s.primary, ctx.s.secondary, c) : ctx.s.primary;
              if (mode !== 'all' && g.vi === target) guideBox = { x, w, y: g.cy };
            }
            x += w + tr;
          }
          if (mode === 'all' && line === L.lines[0]) guideBox = { x: x0, w: total, y: line.cy };
        }
        if (showGuide && guideBox) {
          const s = 1 + (S - 1) * a;
          guide.style.transform = `translate(${guideBox.x}px, ${guideBox.y - fs * 0.62 - Math.max(8, fs * 0.16)}px)`;
          guide.style.width = `${guideBox.w}px`;
          guide.style.opacity = String(smoothstep(1.03, 1.25, s));
          label.textContent = `${Math.round(s * 100)}%`;
        }
      },
    };
  },
};
export default impl;
