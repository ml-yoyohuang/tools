import { el, svgEl } from '../../engine/dom';
import { bool, clamp, num, PALETTE } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fontString, graphemes, isLatin, isSpace, phrases } from '../../engine/text';
import type { EffectContext, EffectImpl, EffectRuntime } from '../../engine/types';

// Each cell is a masked window over a vertical reel [target, r_k … r_1, start].
// The reel position (in cells) is y(p) = (k+1)·(1 − (1−p)^4) plus a small
// late overshoot that returns to exactly k+1 (power4-like stop with a bounce).
// Later cells spin longer, so they land in sequence. Velocity drives a
// vertical-only SVG blur. Everything is a function of t; every cycle starts
// from the previous result, so the loop is seamless.
const POOL_CJK = '福祿壽喜財吉利大發旺金星運樂安康順好富貴春滿';
const POOL_LAT = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';

let uid = 0;

async function loadGlyphs(font: string, chars: string, ms = 2500) {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await Promise.race([document.fonts.load(font, chars), new Promise((r) => setTimeout(r, ms))]);
  } catch {
    /* fall back silently */
  }
}

function layoutCells(empty: boolean[], W: number, H: number, aspect: number, gap: number) {
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
  let best = { rows: [[0]] as number[][], cw: 0, score: 0 };
  for (let c = 1; c <= n; c++) {
    const rows: number[][] = [];
    let row: number[] = [];
    let split = false;
    for (const w0 of words) {
      if (w0.length > c) split = true;
      for (let i = 0; i < w0.length; i += c) {
        const w = w0.slice(i, i + c);
        if (row.length && row.length + 1 + w.length > c) {
          rows.push(row);
          row = [];
        }
        if (row.length) row.push(-1);
        row.push(...w);
      }
    }
    if (row.length) rows.push(row);
    if (rows.length > 5) continue;
    const cols = Math.max(...rows.map((r) => r.length));
    const cw = Math.min((W * 0.84) / (cols + (cols - 1) * gap), (H * 0.62) / (rows.length * aspect + (rows.length - 1) * gap * 2.2));
    const score = cw * (split ? 0.6 : 1);
    if (score > best.score * 1.02) best = { rows, cw, score };
  }
  return best;
}

async function create(ctx: EffectContext): Promise<EffectRuntime> {
  const W = ctx.width;
  const H = ctx.height;
  const { primary: ink, secondary: paper } = ctx.s;
  const spin = num(ctx, 'spin', 1.6);
  const blurOn = bool(ctx, 'blur', true);
  const k = clamp(ctx.s.intensity, 0.2, 2);
  const states = phrases(ctx.text).map((p) => graphemes(p));
  const n = Math.max(...states.map((s) => s.length));
  const S = states.length;
  const at = (s: number, i: number) => states[((s % S) + S) % S][i] ?? ' ';
  const empty = Array.from({ length: n }, (_, i) => states.every((s) => isSpace(s[i] ?? ' ')));
  const latinCell = Array.from({ length: n }, (_, i) => states.some((s) => isLatin(s[i] ?? '')));

  const aspect = 1.28;
  const G = layoutCells(empty, W, H, aspect, 0.14);
  const cw = G.cw * clamp(ctx.s.fontScale, 0.6, 1.2);
  const ch = cw * aspect;
  const gap = cw * 0.14;
  const fs = cw * 0.66;
  const font = fontString(fs, ctx.font.sans, 900);
  await loadGlyphs(font, POOL_CJK + POOL_LAT + ctx.text);

  const stagger = Math.min(num(ctx, 'stagger', 0.28), n > 1 ? 2.4 / (n - 1) : 1);
  const hold = 1.8;
  const lead = 0.35;
  const rate = 16 * k; // reel cells per second at full speed (average-ish)

  // cabinet
  const rowsN = G.rows.length;
  const maxCols = Math.max(...G.rows.map((r) => r.length));
  const cabW = maxCols * cw + (maxCols - 1) * gap + cw * 0.5;
  const rowGap = gap * 2.2;
  const cabH = rowsN * ch + (rowsN - 1) * rowGap + cw * 0.62;
  el(
    'div',
    {
      style: {
        position: 'absolute',
        left: `${(W - cabW) / 2}px`,
        top: `${(H - cabH) / 2}px`,
        width: `${cabW}px`,
        height: `${cabH}px`,
        borderRadius: `${cw * 0.18}px`,
        background: ink,
        boxShadow: `0 ${cw * 0.12}px ${cw * 0.35}px rgba(0,0,0,.3), inset 0 ${cw * 0.03}px 0 rgba(255,255,255,.12)`,
      },
    },
    ctx.root,
  );
  const svg = svgEl('svg', { width: 0, height: 0 });
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
  ctx.root.appendChild(svg);
  const defs = svgEl('defs', {}, svg);

  const top0 = (H - (rowsN * ch + (rowsN - 1) * rowGap)) / 2 + cw * 0.08;
  interface Cell {
    i: number;
    win: HTMLDivElement;
    reel: HTMLDivElement;
    items: HTMLDivElement[];
    blur: SVGFEGaussianBlurElement;
    filterId: string;
    lamp: HTMLDivElement;
    steps: number;
    dur: number;
    delay: number;
    cycle: number;
    lastBlur: number;
  }
  const cells: Cell[] = [];
  const maxSteps = Math.round((spin + (n - 1) * stagger) * rate * 0.7) + 2;
  G.rows.forEach((row, ri) => {
    const rw = row.length * cw + (row.length - 1) * gap;
    row.forEach((idx, si) => {
      if (idx < 0) return;
      const x = (W - rw) / 2 + si * (cw + gap);
      const y = top0 + ri * (ch + rowGap);
      const order = cells.length;
      const dur = spin + order * stagger;
      const steps = Math.max(4, Math.round(dur * rate * 0.7)); // power4 covers ~ 4× its average speed early on
      const lamp = el('div', { style: { position: 'absolute', left: `${x + cw / 2 - cw * 0.05}px`, top: `${y - cw * 0.2}px`, width: `${cw * 0.1}px`, height: `${cw * 0.1}px`, borderRadius: '50%', background: paper, opacity: 0.18 } }, ctx.root);
      const win = el(
        'div',
        {
          style: {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            width: `${cw}px`,
            height: `${ch}px`,
            overflow: 'hidden',
            borderRadius: `${cw * 0.1}px`,
            background: paper,
            willChange: 'transform',
          },
        },
        ctx.root,
      );
      const filterId = `kt-slot-${++uid}-${idx}`;
      const filter = svgEl('filter', { id: filterId, x: '-10%', y: '-50%', width: '120%', height: '200%' }, defs);
      const blur = svgEl('feGaussianBlur', { stdDeviation: '0 0' }, filter);
      const reel = el('div', { style: { position: 'absolute', left: '0', top: '0', width: '100%', willChange: 'transform' } }, win);
      const items = Array.from({ length: maxSteps + 2 }, () =>
        el('div', { style: { height: `${ch}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', font, lineHeight: '1', color: ink, whiteSpace: 'pre' } }, reel),
      );
      // drum shading + glass
      el('div', { style: { position: 'absolute', inset: '0', pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,.38) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 74%, rgba(0,0,0,.38) 100%)' } }, win);
      el('div', { style: { position: 'absolute', left: '6%', right: '6%', top: '7%', height: '16%', borderRadius: `${cw * 0.08}px`, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0))' } }, win);
      cells.push({ i: idx, win, reel, items, blur, filterId, lamp, steps, dur, delay: order * 0, cycle: -1, lastBlur: -1 });
    });
  });

  const cycleDur = lead + spin + Math.max(0, cells.length - 1) * stagger + hold;
  const settle = lead + spin + Math.max(0, cells.length - 1) * stagger + 0.6;
  const pick = (i: number, r: number, c: number) => {
    const pool = latinCell[i] ? POOL_LAT : POOL_CJK;
    return pool[Math.floor(hash2(i * 53 + r, c * 17 + 5, ctx.seed) * pool.length)];
  };
  // reel position in cells for progress p ∈ [0,1]
  const reelPos = (steps: number, p: number) => (steps + 1) * (1 - Math.pow(1 - p, 4)) + 0.2 * Math.sin(Math.PI * clamp((p - 0.7) / 0.3, 0, 1));

  return {
    settle,
    render(t) {
      const c = Math.floor(t / cycleDur);
      const local = t - c * cycleDur;
      for (const cell of cells) {
        const total = cell.steps + 2;
        if (cell.cycle !== c) {
          // reel top→bottom: target, r_k … r_1, start (we scroll downward)
          const start = c === 0 ? pick(cell.i, 999, 0) : at(c - 1, cell.i);
          for (let j = 0; j < cell.items.length; j++) {
            let chv = '';
            if (j === 0) chv = at(c, cell.i);
            else if (j === total - 1) chv = start;
            else if (j < total - 1) chv = pick(cell.i, j, c);
            if (cell.items[j].textContent !== chv) cell.items[j].textContent = chv;
          }
          cell.cycle = c;
        }
        let y: number;
        let v = 0;
        const p = (local - lead) / cell.dur;
        if (local < lead) {
          y = -0.14 * Math.sin((Math.PI * local) / lead) * k; // anticipation: nudge up first
        } else {
          const pc = clamp(p, 0, 1);
          y = reelPos(cell.steps, pc);
          if (pc < 1) v = (reelPos(cell.steps, clamp(pc + 0.004, 0, 1)) - y) / (0.004 * cell.dur);
        }
        const idx = total - 1 - y; // index of the item at the window
        cell.reel.style.transform = `translate3d(0,${-idx * ch}px,0)`;
        // vertical motion blur
        const b = blurOn ? Math.round(clamp(Math.abs(v) * ch * 0.006, 0, ch * 0.16) * 2) / 2 : 0;
        if (b !== cell.lastBlur) {
          cell.blur.setAttribute('stdDeviation', `0 ${b}`);
          cell.reel.style.filter = b > 0 ? `url(#${cell.filterId})` : 'none';
          cell.lastBlur = b;
        }
        // landing pop + lamp
        const since = local - lead - cell.dur;
        const pop = since > 0 ? Math.exp(-since * 7) * Math.sin(since * 22) * 0.05 : 0;
        cell.win.style.transform = `scale(${1 + pop})`;
        cell.lamp.style.opacity = since > 0 ? String(0.95) : String(0.18);
        cell.lamp.style.boxShadow = since > 0 ? `0 0 ${cw * 0.12}px ${paper}` : 'none';
      }
    },
  };
}

const impl: EffectImpl = {
  id: 'slot-text',
  defaults: { ...PALETTE.coral },
  loopable: true,
  posterTime: 4.2,
  maxChars: 24,
  textHint: '用「／」分隔多組字，每次拉霸停在下一組。',
  hide: ['tracking'],
  params: [
    { key: 'spin', label: '轉動秒數', type: 'range', min: 0.8, max: 4, step: 0.1, default: 1.6, unit: 's' },
    { key: 'stagger', label: '依序停止間隔', type: 'range', min: 0, max: 0.8, step: 0.02, default: 0.28, unit: 's' },
    { key: 'blur', label: '動態模糊', type: 'toggle', default: true },
  ],
  create,
};
export default impl;
