import { el, glyphSpans } from '../../engine/dom';
import { num, PALETTE } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Pure function of time: a schedule of (type → hold → delete → pause) per sentence.
// Layout is computed for the full sentence first so glyphs never shift while typing.
const PAUSE_AFTER = /[，。！？、；：,.!?;:…]/;

const impl: EffectImpl = {
  id: 'typewriter',
  defaults: { ...PALETTE.paperInk },
  loopable: true,
  posterTime: 2.2,
  maxChars: 60,
  textHint: '用「／」分隔多個句子，會依序輸入、刪除、再輸入下一句。',
  hide: ['intensity'],
  params: [
    { key: 'cps', label: '每秒字數', type: 'range', min: 3, max: 24, step: 1, default: 9 },
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.5, max: 4, step: 0.1, default: 1.6, unit: 's' },
    { key: 'cursor', label: '游標樣式', type: 'select', default: 'bar', options: [{ value: 'bar', label: '直線' }, { value: 'block', label: '方塊' }, { value: 'under', label: '底線' }] },
  ],
  create(ctx): EffectRuntime {
    const sentences = phrases(ctx.text);
    const cps = num(ctx, 'cps', 9);
    const hold = num(ctx, 'hold', 1.6);
    const cursorKind = String(ctx.s.params.cursor ?? 'bar');
    const stage = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);

    interface Seg {
      start: number;
      typeEnd: number;
      holdEnd: number;
      delEnd: number;
      end: number;
      times: number[]; // time each glyph appears (relative)
      spans: HTMLSpanElement[];
      layer: HTMLDivElement;
      L: ReturnType<typeof layoutText>;
    }
    const segs: Seg[] = [];
    let t0 = 0.35;
    sentences.forEach((s, si) => {
      const L = layoutText(ctx, s, { align: 'left', maxWidth: ctx.width * 0.8, maxHeight: ctx.height * 0.5, lineHeight: 1.3, fill: 0.8 });
      const layer = el('div', { style: { position: 'absolute', inset: '0', visibility: 'hidden' } }, stage);
      const spans = glyphSpans(layer, L, { color: ctx.s.primary, includeSpaces: true }).map((x) => x.el);
      const times: number[] = [];
      let acc = 0;
      L.glyphs.forEach((g, i) => {
        times.push(acc);
        // human-ish rhythm: seeded jitter, longer pause after punctuation
        acc += (1 / cps) * (0.6 + hash2(i, si, ctx.seed) * 0.8) + (PAUSE_AFTER.test(g.ch) ? 0.35 : 0);
      });
      const typeEnd = t0 + acc;
      const holdEnd = typeEnd + hold;
      const delEnd = holdEnd + L.glyphs.length * (0.45 / cps);
      segs.push({ start: t0, typeEnd, holdEnd, delEnd, end: delEnd + 0.45, times, spans, layer, L });
      t0 = delEnd + 0.45;
    });
    const cycle = t0;
    const first = segs[0];

    const cursor = el('div', { style: { position: 'absolute', background: ctx.s.secondary, borderRadius: '2px' } }, stage);
    let lastSeg = -1;
    let lastN = -1;

    return {
      settle: first.typeEnd + 0.6,
      render(time) {
        const t = time % cycle;
        let si = segs.findIndex((s) => t < s.end);
        if (si < 0) si = segs.length - 1;
        const seg = segs[si];
        const rel = t - seg.start;
        let n: number;
        let typing = false;
        if (t < seg.start) n = 0;
        else if (t < seg.typeEnd) {
          n = seg.times.filter((x) => x <= rel).length;
          typing = true;
        } else if (t < seg.holdEnd) n = seg.spans.length;
        else if (t < seg.delEnd) {
          n = Math.max(0, Math.ceil(seg.spans.length * (1 - (t - seg.holdEnd) / (seg.delEnd - seg.holdEnd))));
          typing = true;
        } else n = 0;

        if (si !== lastSeg) {
          segs.forEach((s, i) => (s.layer.style.visibility = i === si ? 'visible' : 'hidden'));
          lastSeg = si;
          lastN = -1;
        }
        if (n !== lastN) {
          seg.spans.forEach((sp, i) => (sp.style.visibility = i < n ? 'visible' : 'hidden'));
          lastN = n;
        }
        // cursor after the last visible glyph (or at the start of the first line)
        const L = seg.L;
        const g = n > 0 ? L.glyphs[n - 1] : null;
        const fs = L.fontSize;
        const x = g ? g.x + g.w + L.tracking * fs * 0.5 : L.lines[0].glyphs[0]?.x ?? L.x;
        const lineY = g ? g.y : L.lines[0].y;
        const cw = cursorKind === 'block' ? fs * 0.55 : cursorKind === 'under' ? fs * 0.6 : Math.max(2, fs * 0.07);
        const ch = cursorKind === 'under' ? Math.max(2, fs * 0.08) : fs * 0.95;
        const cy = cursorKind === 'under' ? lineY + L.lineHeight * 0.5 + fs * 0.45 : lineY + (L.lineHeight - ch) / 2;
        Object.assign(cursor.style, { left: `${x + fs * 0.04}px`, top: `${cy}px`, width: `${cw}px`, height: `${ch}px` });
        const blink = (time * 1.6) % 1 < 0.55;
        cursor.style.opacity = typing || blink ? (cursorKind === 'block' ? '0.75' : '1') : '0';
      },
    };
  },
};
export default impl;
