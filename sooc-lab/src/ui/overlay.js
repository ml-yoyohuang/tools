// Charmera print finishing: four original film-style frames and a seven-segment date imprint.
// Everything is drawn in units of the short edge so preview and full-size export match.

export const FRAMES = ['無', '白邊', '片框', '底片', '幻燈片'];

function rand(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// Each frame draws itself and returns the open window inset {l, t, r, b} in px.
const DRAW = [
  () => ({ l: 0, t: 0, r: 0, b: 0 }),

  // 1 白邊 — matte paper border, deeper at the bottom
  (g, W, H, u) => {
    const s = 34 * u, b = 120 * u;
    g.fillStyle = '#f3f0e8';
    g.beginPath();
    g.rect(0, 0, W, H);
    g.rect(s, s, W - s * 2, H - s - b);
    g.fill('evenodd');
    g.strokeStyle = 'rgba(0,0,0,.14)';
    g.lineWidth = Math.max(1, u * 1.2);
    g.strokeRect(s, s, W - s * 2, H - s - b);
    return { l: s, t: s, r: s, b };
  },

  // 2 片框 — filed-out negative carrier: black edge with a rough inner border
  (g, W, H, u) => {
    const s = 30 * u, j = 7 * u, r = rand(97);
    g.fillStyle = '#0b0a09';
    g.beginPath();
    g.rect(0, 0, W, H);
    const step = 9 * u;
    const pts = [];
    for (let x = s; x <= W - s; x += step) pts.push([x, s + r() * j]);
    for (let y = s; y <= H - s; y += step) pts.push([W - s - r() * j, y]);
    for (let x = W - s; x >= s; x -= step) pts.push([x, H - s - r() * j]);
    for (let y = H - s; y >= s; y -= step) pts.push([s + r() * j, y]);
    g.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.closePath();
    g.fill('evenodd');
    return { l: s + j, t: s + j, r: s + j, b: s + j };
  },

  // 3 底片 — 35mm strip along the long edge, sprocket holes and edge numbers
  (g, W, H, u) => {
    const portrait = H > W;
    g.save();
    let w = W, h = H;
    if (portrait) { g.translate(W, 0); g.rotate(Math.PI / 2); w = H; h = W; }
    const band = h * 0.105;
    g.fillStyle = '#2b1d12';
    g.fillRect(0, 0, w, band);
    g.fillRect(0, h - band, w, band);
    g.fillStyle = 'rgba(255,170,90,.06)';
    g.fillRect(0, band - 2 * u, w, 2 * u);
    g.fillRect(0, h - band, w, 2 * u);
    const hw = band * 0.34, hh = band * 0.46, gap = hw * 1.95, rr = hw * 0.22;
    g.fillStyle = '#efeae0';
    for (let x = gap * 0.5; x < w; x += gap) {
      for (const y of [(band - hh) / 2 - band * 0.06, h - band + (band - hh) / 2 + band * 0.06]) {
        g.beginPath();
        g.roundRect(x, y, hw, hh, rr);
        g.fill();
      }
    }
    g.fillStyle = 'rgba(232,140,60,.8)';
    g.font = `600 ${band * 0.2}px "Helvetica Neue", Arial, sans-serif`;
    g.textBaseline = 'middle';
    const ny = h - band * 0.11;
    g.fillText('17', w * 0.1, ny);
    g.fillText('▸ 17A', w * 0.55, ny);
    g.restore();
    return portrait ? { l: band, t: 0, r: band, b: 0 } : { l: 0, t: band, r: 0, b: band };
  },

  // 4 幻燈片 — cream slide mount with a rounded window
  (g, W, H, u) => {
    const s = 80 * u, rad = 26 * u;
    g.fillStyle = '#e8e0cc';
    g.beginPath();
    g.rect(0, 0, W, H);
    g.roundRect(s, s, W - s * 2, H - s * 2, rad);
    g.fill('evenodd');
    g.save();
    g.beginPath();
    g.roundRect(s, s, W - s * 2, H - s * 2, rad);
    g.clip();
    g.shadowColor = 'rgba(0,0,0,.45)';
    g.shadowBlur = 14 * u;
    g.strokeStyle = 'rgba(0,0,0,.5)';
    g.lineWidth = 6 * u;
    g.beginPath();
    g.roundRect(s - 3 * u, s - 3 * u, W - s * 2 + 6 * u, H - s * 2 + 6 * u, rad);
    g.stroke();
    g.restore();
    return { l: s, t: s, r: s, b: s };
  },
];

// seven-segment glyphs: a b c d e f g
const SEG = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

function segPath(g, x, y, w, h, t, s) {
  const H2 = (x0, x1, yy) => {
    g.moveTo(x0 + t * 0.5, yy); g.lineTo(x0 + t, yy - t / 2); g.lineTo(x1 - t, yy - t / 2);
    g.lineTo(x1 - t * 0.5, yy); g.lineTo(x1 - t, yy + t / 2); g.lineTo(x0 + t, yy + t / 2); g.closePath();
  };
  const V = (xx, y0, y1) => {
    g.moveTo(xx, y0 + t * 0.5); g.lineTo(xx + t / 2, y0 + t); g.lineTo(xx + t / 2, y1 - t);
    g.lineTo(xx, y1 - t * 0.5); g.lineTo(xx - t / 2, y1 - t); g.lineTo(xx - t / 2, y0 + t); g.closePath();
  };
  const m = y + h / 2;
  if (s.includes('a')) H2(x, x + w, y);
  if (s.includes('b')) V(x + w, y, m);
  if (s.includes('c')) V(x + w, m, y + h);
  if (s.includes('d')) H2(x, x + w, y + h);
  if (s.includes('e')) V(x, m, y + h);
  if (s.includes('f')) V(x, y, m);
  if (s.includes('g')) H2(x, x + w, m);
}

function drawDate(g, text, right, bottom, u) {
  const h = 44 * u, w = h * 0.52, t = h * 0.13, adv = w + h * 0.3, space = w * 0.55;
  let width = 0;
  for (const ch of text) width += ch === ' ' ? space : ch === "'" ? w * 0.5 : adv;
  let x = right - width, y = bottom - h;
  g.save();
  g.transform(1, 0, -0.1, 1, h * 0.1, 0);
  g.beginPath();
  for (const ch of text) {
    if (ch === ' ') { x += space; continue; }
    if (ch === "'") {
      g.moveTo(x + t, y); g.lineTo(x + t * 1.8, y); g.lineTo(x + t * 1.1, y + h * 0.28); g.lineTo(x + t * 0.5, y + h * 0.28); g.closePath();
      x += w * 0.5;
      continue;
    }
    segPath(g, x, y, w, h, t, SEG[ch] || '');
    x += adv;
  }
  g.globalCompositeOperation = 'screen';
  g.shadowColor = 'rgba(255,92,24,.9)';
  g.shadowBlur = t * 2.2;
  g.fillStyle = 'rgba(255,112,36,.92)';
  g.fill();
  g.shadowBlur = t * 0.6;
  g.fillStyle = 'rgba(255,170,96,.55)';
  g.fill();
  g.restore();
}

export function dateText(d) {
  const p = (n) => String(n).padStart(2, ' ');
  return `'${String(d.getFullYear()).slice(2)} ${p(d.getMonth() + 1)} ${p(d.getDate())}`.replace(/ {2}/g, '  ');
}

// opts: { frame: index into FRAMES, date: Date | null }
export function drawOverlay(g, W, H, opts) {
  const u = Math.min(W, H) / 1000;
  const inset = DRAW[opts.frame || 0](g, W, H, u);
  if (opts.date) drawDate(g, dateText(opts.date), W - inset.r - 46 * u, H - inset.b - 40 * u, u);
}

export const hasOverlay = (opts) => !!(opts && (opts.frame || opts.date));
