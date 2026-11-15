import { makeSeal, cnDate } from './poster.js';
import { cnNum } from './ledger.js';

/*
 * 百願經卷: one rite's wishes set as a dense vertical text block, right to left.
 * From afar a woven texture; up close, every line someone once wrote.
 * Every wish appears exactly once, in burn order, truncated with … when space is short.
 */

export const SCROLL_W = 1600;
export const SCROLL_H = 2000;
const SERIF = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';
const INK = '#28211b';
const VERMILION = '#a8301c';
const PAPER = '#efe7d6';
export const MAX_CHARS = 16;
const MIN_CHARS = 2;
const MIN_SIZE = 10;

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh-Hant', { granularity: 'grapheme' }) : null;
/** Split into user-perceived characters, so truncation never breaks a combined glyph. */
export const graphemes = (s) => (segmenter ? [...segmenter.segment(s)].map((x) => x.segment) : Array.from(s));

/** Up to `max` graphemes; longer wishes keep max-1 and end in …  */
export function clip(wish, max) {
  const g = graphemes(wish.trim());
  return g.length <= max ? g : [...g.slice(0, max - 1), '…'];
}

/** Density by how many wishes there are: fewer wishes breathe, more weave tighter. */
function tier(n) {
  if (n <= 100) return { maxSize: 30, colGap: 1.85 };
  if (n <= 300) return { maxSize: 22, colGap: 1.5 };
  if (n <= 500) return { maxSize: 18, colGap: 1.32 };
  return { maxSize: 16, colGap: 1.26 };
}

/**
 * Fit the wishes into a w×h box. Pure, for testing.
 * Returns { size, colGap, rowGap, cols, rows, maxChars, cells, shown, omitted } where cells are
 * { col, row, kind: 'ch' | 'sep' | 'blank', ch? } in reading order (col 0 = rightmost).
 */
export function layoutScroll(wishes, w, h) {
  const n = wishes.length;
  const { maxSize, colGap } = tier(n);
  const rowGap = 1.06;
  const lens = wishes.map((x) => (x == null ? 1 : graphemes(x.trim()).length || 1));
  const need = (max) => lens.reduce((s, l) => s + Math.min(l, max) + 1, 0) - 1;
  const grid = (size) => ({ cols: Math.floor(w / (size * colGap)), rows: Math.floor(h / (size * rowGap)) });

  let size = MIN_SIZE;
  let maxChars = MIN_CHARS;
  let found = false;
  for (let s = maxSize; s >= MIN_SIZE; s -= 0.5) {
    const { cols, rows } = grid(s);
    if (cols * rows >= need(MAX_CHARS)) {
      size = s;
      maxChars = MAX_CHARS;
      found = true;
      break;
    }
  }
  if (!found) {
    const { cols, rows } = grid(MIN_SIZE);
    for (let m = MAX_CHARS - 1; m >= MIN_CHARS; m--) {
      if (cols * rows >= need(m)) {
        maxChars = m;
        found = true;
        break;
      }
    }
  }
  const { cols, rows } = grid(size);
  const capacity = cols * rows;

  // Flow wish after wish down the columns, a small vermilion dot between them
  const cells = [];
  let k = 0;
  let shown = 0;
  const reserve = found ? 0 : rows; // keep the last column free for the overflow note
  for (let i = 0; i < n; i++) {
    const glyphs = wishes[i] == null ? null : clip(wishes[i], maxChars);
    const len = glyphs ? glyphs.length : 1;
    if (k + len > capacity - reserve) break;
    if (glyphs) glyphs.forEach((ch) => cells.push({ col: Math.floor(k / rows), row: k++ % rows, kind: 'ch', ch }));
    else cells.push({ col: Math.floor(k / rows), row: k++ % rows, kind: 'blank' });
    shown++;
    if (i < n - 1 && k < capacity) cells.push({ col: Math.floor(k / rows), row: k++ % rows, kind: 'sep' });
  }
  return { size, colGap, rowGap, cols, rows, maxChars, cells, shown, omitted: n - shown };
}

/* ---------- Drawing ---------- */

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const isoDate = (t) => {
  const d = new Date(t);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Is this grapheme set sideways in vertical text (Latin, digits, …)? */
const sideways = (ch) => {
  const c = ch.codePointAt(0);
  return c < 0x2e80 && !(c >= 0x3000 && c <= 0x303f);
};

function paper(g, r) {
  g.fillStyle = PAPER;
  g.fillRect(0, 0, SCROLL_W, SCROLL_H);
  // slow mottling
  for (let i = 0; i < 140; i++) {
    const x = r() * SCROLL_W;
    const y = r() * SCROLL_H;
    const rad = 80 + r() * 260;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() > 0.5;
    gr.addColorStop(0, dark ? 'rgba(170,140,95,0.07)' : 'rgba(255,252,240,0.09)');
    gr.addColorStop(1, dark ? 'rgba(170,140,95,0)' : 'rgba(255,252,240,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // fibres
  g.lineCap = 'round';
  for (let i = 0; i < 7000; i++) {
    const x = r() * SCROLL_W;
    const y = r() * SCROLL_H;
    const a = r() * Math.PI;
    const l = 3 + r() * 16;
    g.strokeStyle = r() > 0.5 ? `rgba(255,255,250,${0.12 + r() * 0.2})` : `rgba(120,95,60,${0.04 + r() * 0.07})`;
    g.lineWidth = 0.5 + r() * 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // edges age a little
  const v = g.createRadialGradient(SCROLL_W / 2, SCROLL_H / 2, SCROLL_H * 0.35, SCROLL_W / 2, SCROLL_H / 2, SCROLL_H * 0.75);
  v.addColorStop(0, 'rgba(150,115,70,0)');
  v.addColorStop(1, 'rgba(150,115,70,0.16)');
  g.fillStyle = v;
  g.fillRect(0, 0, SCROLL_W, SCROLL_H);
}

/** Vertical text, one glyph per step, upright CJK and sideways Latin. */
function vertical(g, text, x, y, size, step) {
  let yy = y;
  for (const ch of graphemes(text)) {
    glyph(g, ch, x, yy + size / 2, size);
    yy += size * step;
  }
  return yy;
}

function glyph(g, ch, x, cy, size) {
  if (sideways(ch)) {
    g.save();
    g.translate(x, cy);
    g.rotate(Math.PI / 2);
    g.fillText(ch, 0, 0);
    g.restore();
  } else if ('，。、．'.includes(ch)) {
    g.fillText(ch, x + size * 0.28, cy - size * 0.28);
  } else g.fillText(ch, x, cy);
}

/**
 * Draw the scroll for a rite record { at, rounds, count, wishes }.
 * Returns the 1600×2000 canvas.
 */
export function drawScroll(record) {
  const c = document.createElement('canvas');
  c.width = SCROLL_W;
  c.height = SCROLL_H;
  const g = c.getContext('2d');
  const r = rand(record.at % 2147483647 || 7);
  paper(g, r);

  const M = 96;
  // double rule frame
  g.strokeStyle = 'rgba(40,33,27,0.78)';
  g.lineWidth = 2.2;
  g.strokeRect(M, M, SCROLL_W - M * 2, SCROLL_H - M * 2);
  g.lineWidth = 0.8;
  g.strokeRect(M + 12, M + 12, SCROLL_W - M * 2 - 24, SCROLL_H - M * 2 - 24);

  // Header column on the right: title, rounds, count
  const headX = SCROLL_W - M - 78;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK;
  g.font = `600 78px ${SERIF}`;
  let y = vertical(g, '十方迴向', headX, M + 70, 78, 1.12);
  g.fillStyle = VERMILION;
  g.beginPath();
  g.arc(headX, y + 34, 6, 0, Math.PI * 2);
  g.fill();
  g.font = `600 36px ${SERIF}`;
  y = vertical(g, `${cnNum(record.rounds)}輪圓滿`, headX, y + 74, 36, 1.18);
  g.fillStyle = INK;
  g.font = `400 30px ${SERIF}`;
  vertical(g, `${cnNum(record.count)}則心願`, headX, y + 26, 30, 1.2);
  g.strokeStyle = 'rgba(40,33,27,0.5)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(SCROLL_W - M - 156, M + 40);
  g.lineTo(SCROLL_W - M - 156, SCROLL_H - M - 40);
  g.stroke();

  // Left column: date above the seal
  const leftX = M + 74;
  const seal = makeSeal(240, '迴向圓滿');
  const sealSize = 118;
  const sealY = SCROLL_H - M - 40 - sealSize;
  g.globalAlpha = 0.92;
  g.drawImage(seal, leftX - sealSize / 2, sealY, sealSize, sealSize);
  g.globalAlpha = 1;
  g.fillStyle = INK;
  g.font = `400 26px ${SERIF}`;
  const date = cnDate(isoDate(record.at));
  const dateLen = graphemes(date).length;
  vertical(g, date, leftX, sealY - 40 - dateLen * 26 * 1.22, 26, 1.22);
  g.beginPath();
  g.moveTo(M + 156, M + 40);
  g.lineTo(M + 156, SCROLL_H - M - 40);
  g.stroke();

  // Body
  const bx0 = M + 196;
  const bx1 = SCROLL_W - M - 196;
  const by0 = M + 56;
  const by1 = SCROLL_H - M - 56;
  const L = layoutScroll(record.wishes, bx1 - bx0, by1 - by0);

  // a faint ring behind it all, echoing the rite
  const cx = (bx0 + bx1) / 2;
  const cy = (by0 + by1) / 2;
  g.strokeStyle = 'rgba(168,48,28,0.13)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(cx, cy, 470, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(cx, cy, 452, 0, Math.PI * 2);
  g.stroke();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 452, cy + Math.sin(a) * 452);
    g.lineTo(cx + Math.cos(a) * 492, cy + Math.sin(a) * 492);
    g.stroke();
  }

  const pitch = L.size * L.colGap;
  const lineH = L.size * L.rowGap;
  // centre the used rows vertically, columns start at the right edge
  const top = by0 + ((by1 - by0) - L.rows * lineH) / 2;
  const at = (cell) => [bx1 - pitch * (cell.col + 0.5), top + lineH * (cell.row + 0.5)];
  g.font = `400 ${L.size}px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  // misregistered ghost first, then the ink
  for (const pass of [0, 1]) {
    for (const cell of L.cells) {
      const [x, yy] = at(cell);
      if (cell.kind === 'sep') {
        if (!pass) continue;
        g.fillStyle = VERMILION;
        g.globalAlpha = 0.85;
        g.beginPath();
        g.arc(x, yy, Math.max(1.4, L.size * 0.11), 0, Math.PI * 2);
        g.fill();
      } else if (cell.kind === 'blank') {
        // a turtle burned before wishes were kept: an empty ring in its place
        g.strokeStyle = pass ? INK : VERMILION;
        g.globalAlpha = pass ? 0.7 : 0.08;
        g.lineWidth = Math.max(0.8, L.size * 0.06);
        g.beginPath();
        g.arc(x + (pass ? 0 : 1.2), yy + (pass ? 0 : 0.9), L.size * 0.3, 0, Math.PI * 2);
        g.stroke();
      } else if (pass) {
        g.fillStyle = INK;
        g.globalAlpha = 0.8 + r() * 0.2;
        glyph(g, cell.ch, x, yy, L.size);
      } else {
        g.fillStyle = VERMILION;
        g.globalAlpha = 0.07;
        glyph(g, cell.ch, x + 1.3, yy + 0.9, L.size);
      }
    }
  }
  g.globalAlpha = 1;

  if (L.omitted) {
    // Space ran out even at the smallest legible size: say so, in the last column
    g.fillStyle = VERMILION;
    g.font = `400 ${Math.max(14, L.size)}px ${SERIF}`;
    vertical(g, `另${cnNum(L.omitted)}則心願收存於紀錄`, bx0 + pitch / 2, by0, Math.max(14, L.size), 1.15);
  }
  return c;
}

/** Load the glyphs this scroll needs, then render it to a PNG blob. */
export async function scrollBlob(record) {
  const text = '十方迴向輪圓滿則心願年月日另收存於紀錄零〇一二三四五六七八九十百千萬…' + record.wishes.filter(Boolean).join('');
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`400 20px ${SERIF}`, text), document.fonts.load(`600 20px ${SERIF}`, '十方迴向輪圓滿零一二三四五六七八九十百千萬')]),
      new Promise((res) => setTimeout(res, 6000)),
    ]);
  } catch {
    /* draw with whatever font is available */
  }
  // let the browser breathe before the heavy draw
  await new Promise((res) => setTimeout(res, 30));
  const canvas = drawScroll(record);
  const blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
  return blob;
}
