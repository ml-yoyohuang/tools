// /test.html — procedurally generated chart rendered through every camera × filter.
import { Engine } from './engine/engine.js';
import { CAMERAS, filterById, resolveParams, controlsFor } from './data/cameras.js';

const W = 600, H = 400;

function makeChart() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // sky gradient
  const sky = g.createLinearGradient(0, 0, 0, 170);
  sky.addColorStop(0, '#3f78c4'); sky.addColorStop(1, '#a9cbe8');
  g.fillStyle = sky; g.fillRect(0, 0, W, 170);
  // foliage band
  const leaf = g.createLinearGradient(0, 170, W, 170);
  leaf.addColorStop(0, '#2f5a1f'); leaf.addColorStop(0.5, '#6c9a35'); leaf.addColorStop(1, '#c3c24a');
  g.fillStyle = leaf; g.fillRect(0, 170, W, 50);
  // grey ramp
  for (let i = 0; i < W; i++) { const v = Math.round((i / (W - 1)) * 255); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i, 220, 1, 40); }
  // stepped greys
  for (let i = 0; i < 11; i++) { const v = Math.round((i / 10) * 255); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect((i * W) / 11, 260, W / 11 + 1, 24); }
  // colour patches (chart-like sRGB values)
  const patches = ['#735244', '#c29682', '#627a9d', '#576c43', '#8580b1', '#67bdaa', '#d67e2c', '#505ba6', '#c15a63', '#5e3c6c', '#9dbc40', '#e0a32e', '#383d96', '#469449', '#af363c', '#e7c71f', '#bb5695', '#0885a1'];
  const pw = W / 9;
  patches.forEach((col, i) => { g.fillStyle = col; g.fillRect((i % 9) * pw, 284 + Math.floor(i / 9) * 38, pw + 1, 38); });
  // skin tones
  ['#f1c8b0', '#e0ac8a', '#c68863', '#9a6142', '#6b4029'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * (W / 5), 360, W / 5 + 1, 40); });
  // highlight light sources
  [[90, 70, 16], [300, 50, 10], [480, 95, 22]].forEach(([x, y, r]) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
    rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.35, '#fff6e0'); rg.addColorStop(1, 'rgba(255,246,224,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r * 2.4, 0, Math.PI * 2); g.fill();
  });
  // fine detail lines
  g.strokeStyle = '#111'; g.lineWidth = 1;
  for (let i = 0; i < 24; i++) { g.beginPath(); g.moveTo(520 + i * 3, 120); g.lineTo(520 + i * 3, 165); g.stroke(); }
  return c;
}

const root = document.getElementById('root');
const engine = new Engine(document.createElement('canvas'));
const chart = makeChart();
engine.setSmallSource(chart);

function tile(label, sub, data) {
  const fig = document.createElement('figure');
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  cv.getContext('2d').putImageData(data, 0, 0);
  const cap = document.createElement('figcaption');
  cap.innerHTML = `<b>${label}</b><span>${sub}</span>`;
  fig.append(cv, cap);
  return fig;
}

const og = document.createElement('div');
og.className = 'grid';
const ctx = document.createElement('canvas'); ctx.width = W; ctx.height = H;
const g2 = ctx.getContext('2d'); g2.drawImage(chart, 0, 0);
og.append(tile('Original', 'test chart', g2.getImageData(0, 0, W, H)));
root.append(og);

const EXPECTED = {
  'ricoh-gr-iv': 14, 'ricoh-gr-iv-hdf': 14, 'ricoh-gr-iiix': 12, 'ricoh-gr-iv-mono': 6,
  'fujifilm-x100vi': 20, 'fujifilm-gfx100rf': 20, 'leica-q3': 19, 'sony-rx1r-iii': 12, 'sony-zv-1-ii': 10,
  'sony-rx100-vii': 26, 'canon-g7x-iii': 15, 'panasonic-lumix-l10': 17, 'kodak-charmera': 8,
};
const summary = document.createElement('h2');
root.append(summary);
let total = 0, ok = 0;
for (const cam of CAMERAS) {
  const n = cam.filters.length;
  const pass = EXPECTED[cam.id] === n;
  if (pass) ok++;
  const h2 = document.createElement('h2');
  h2.textContent = `${cam.name.toUpperCase()} · ${n}${pass ? '' : ` (expected ${EXPECTED[cam.id]})`}`;
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const id of cam.filters) {
    const f = filterById(id);
    grid.append(tile(f.name, id, engine.renderSmall(resolveParams(cam, id, 1, {}))));
    total++;
    // variant pickers: render every option too
    for (const c of controlsFor(cam, id)) {
      if (!f.extra || !f.extra.includes(c.id) || c.type !== 'segment') continue;
      c.options.forEach((label, i) => {
        if (i === 0) return;
        grid.append(tile(`${f.name} · ${label}`, `${id} #${i}`, engine.renderSmall(resolveParams(cam, id, 1, { [c.id]: i, crossSeed: 0.37 }))));
      });
    }
  }
  root.append(h2, grid);
}
summary.textContent = `${total} FILTERS · ${ok}/${CAMERAS.length} CAMERAS MATCH SPEC`;
document.title = `SOOC LAB · Test (${total})`;
