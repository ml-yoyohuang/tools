import { el } from '../../engine/dom';
import { clamp, ease, num, PALETTE } from '../../engine/helpers';
import { fontString, graphemes, isSpace, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Whole-card flips (not split halves): every card has a front and a back face
// (backface-visibility: hidden) and turns 180° about Y, lifting toward the
// viewer mid-turn. Flip k shows state k on the leaving face and state k+1 on
// the arriving one, so any number of words cycles. Cards start in a diagonal
// wave. With a single phrase, the back face switches typeface + colourway.
/**
 * Word-aware card layout: indices that are blank in every state are word gaps;
 * words are wrapped greedily (a too-long word is split) for each candidate row
 * width, and the arrangement with the largest card wins. Rows hold card indices
 * with -1 for a gap cell.
 */
function layoutCards(empty: boolean[], W: number, H: number, aspect: number, gap: number) {
  const n = empty.length;
  const words: number[][] = [];
  let cur: number[] = [];
  for (let i = 0; i < n; i++) {
    if (empty[i]) {
      if (cur.length) words.push(cur);
      cur = [];
    } else cur.push(i);
  }
  if (cur.length) words.push(cur);
  if (!words.length) words.push([0]);
  let best = { rows: [[0]] as number[][], cols: 1, cw: 0, score: 0 };
  for (let c = 1; c <= n; c++) {
    const rows: number[][] = [];
    let row: number[] = [];
    let split = false;
    for (const w0 of words) {
      if (w0.length > c) split = true;
      const chunks: number[][] = [];
      for (let i = 0; i < w0.length; i += c) chunks.push(w0.slice(i, i + c));
      for (const w of chunks) {
        if (row.length && row.length + 1 + w.length > c) {
          rows.push(row);
          row = [];
        }
        if (row.length) row.push(-1);
        row.push(...w);
      }
    }
    if (row.length) rows.push(row);
    if (rows.length > 6) continue;
    const cols = Math.max(...rows.map((r) => r.length));
    const cw = Math.min((W * 0.88) / (cols + (cols - 1) * gap), (H * 0.74) / (rows.length * aspect + (rows.length - 1) * gap));
    const score = cw * (split ? 0.6 : 1); // prefer keeping words whole
    if (score > best.score * 1.02) best = { rows, cols, cw, score };
  }
  return best;
}

const impl: EffectImpl = {
  id: 'flip-cards',
  defaults: { ...PALETTE.paperPink },
  posterTime: 0.6,
  maxChars: 36,
  textHint: '用「／」分隔多組詞，卡片翻到背面時換成下一組；只有一組時背面換字體與配色。',
  params: [
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.4, max: 4, step: 0.1, default: 1.4, unit: 's' },
    { key: 'stagger', label: '波動間隔', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0.09, unit: 's' },
    { key: 'lift', label: '翻起高度', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const hold = num(ctx, 'hold', 1.4);
    const stagger = num(ctx, 'stagger', 0.09);
    const lift = num(ctx, 'lift', 0.5) * clamp(ctx.s.intensity, 0, 2);
    const flipDur = 0.75;
    const beat = hold + flipDur;
    let states = phrases(ctx.text).map((p) => graphemes(p));
    const single = states.length === 1;
    if (single) states = [states[0], states[0]];
    const n = Math.max(...states.map((s) => s.length));
    states = states.map((s) => [...s, ...Array(n - s.length).fill(' ')]);
    const S = states.length;

    const aspect = 1.3;
    const gapF = 0.12;
    const emptyAt = Array.from({ length: n }, (_, i) => states.every((s) => isSpace(s[i])));
    const G = layoutCards(emptyAt, W, H, aspect, gapF);
    const cw = G.cw;
    const chh = cw * aspect;
    const gap = cw * gapF;
    const boardH = G.rows.length * chh + (G.rows.length - 1) * gap;
    const y0 = (H - boardH) / 2;
    const place = new Map<number, { x: number; y: number; col: number; row: number }>();
    G.rows.forEach((r, ri) => {
      const rw = r.length * cw + (r.length - 1) * gap;
      r.forEach((idx, si) => {
        if (idx >= 0) place.set(idx, { x: (W - rw) / 2 + si * (cw + gap), y: y0 + ri * (chh + gap), col: si, row: ri });
      });
    });
    const fs = cw * 0.64 * clamp(ctx.s.fontScale, 0.5, 1.3);
    const radius = cw * 0.08;
    // face styles: A = ink card / paper sans, B = accent card / ink serif
    const styles = [
      { bg: fg, color: bg, font: fontString(fs, ctx.font.sans, 900) },
      { bg: acc, color: fg, font: fontString(fs * 0.98, single ? ctx.font.serif : ctx.font.sans, 900) },
    ];

    const cards = Array.from({ length: n }, (_, i) => {
      const pl = place.get(i);
      const empty = !pl;
      const { x, y, col, row } = pl ?? { x: -9999, y: -9999, col: 0, row: 0 };
      const shadow = el('div', { style: { position: 'absolute', left: `${x + cw * 0.06}px`, top: `${y + chh * 0.92}px`, width: `${cw * 0.88}px`, height: `${chh * 0.16}px`, borderRadius: '50%', background: 'rgba(0,0,0,.28)', filter: `blur(${cw * 0.06}px)`, visibility: empty ? 'hidden' : 'visible' } }, ctx.root);
      const card = el(
        'div',
        { style: { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${cw}px`, height: `${chh}px`, transformStyle: 'preserve-3d', visibility: empty ? 'hidden' : 'visible', willChange: 'transform' } },
        ctx.root,
      );
      const faces = styles.map((st, fi) => {
        const f = el(
          'div',
          {
            style: {
              position: 'absolute',
              inset: '0',
              borderRadius: `${radius}px`,
              background: st.bg,
              backfaceVisibility: 'hidden',
              transform: fi ? 'rotateY(180deg)' : 'none',
              overflow: 'hidden',
              boxShadow: `inset 0 ${-chh * 0.04}px 0 rgba(0,0,0,.12)`,
            },
          },
          card,
        );
        const glyph = el('div', { style: { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', font: st.font, lineHeight: '1', color: st.color, whiteSpace: 'pre' } }, f);
        // small index pip
        el('div', { style: { position: 'absolute', right: `${cw * 0.09}px`, top: `${cw * 0.09}px`, width: `${cw * 0.07}px`, height: `${cw * 0.07}px`, borderRadius: '50%', background: st.color, opacity: 0.5 } }, f);
        const shade = el('div', { style: { position: 'absolute', inset: '0', background: '#000', opacity: 0 } }, f);
        return { glyph, shade };
      });
      return { card, shadow, faces, delay: (col + row * 1.5) * stagger, i, empty };
    });

    const flipE = ease('power3.inOut');
    const set = (node: HTMLElement, ch: string) => {
      if (node.textContent !== ch) node.textContent = ch;
    };
    const P = chh * 4.5;

    return {
      render(t) {
        for (const c of cards) {
          if (c.empty) continue;
          const local = t - c.delay;
          let kk = 0;
          let u = 0;
          if (local > 0) {
            kk = Math.floor(local / beat);
            u = clamp((local - kk * beat - hold) / flipDur, 0, 1);
          }
          const e = flipE(u);
          const ang = 180 * (kk + e);
          const arc = Math.sin(Math.PI * u);
          const z = arc * cw * 0.6 * lift;
          c.card.style.transform = `perspective(${P}px) translateZ(${z}px) rotateY(${ang}deg) rotateX(${arc * 6 * lift}deg)`;
          c.shadow.style.transform = `translateY(${arc * chh * 0.06 * lift}px) scale(${1 - arc * 0.25 * lift})`;
          c.shadow.style.opacity = String(1 - arc * 0.5);
          // leaving face shows state kk, arriving face shows state kk+1
          const leave = kk % 2;
          set(c.faces[leave].glyph, states[kk % S][c.i]);
          set(c.faces[1 - leave].glyph, states[(kk + 1) % S][c.i]);
          // edge-on darkening, sharper for the face turning away
          const edge = Math.abs(Math.cos((ang * Math.PI) / 180));
          for (const f of c.faces) f.shade.style.opacity = String((1 - edge) * 0.45);
        }
      },
    };
  },
};
export default impl;
