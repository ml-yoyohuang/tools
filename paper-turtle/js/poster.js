const SERIF = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';
const DIGITS = '〇一二三四五六七八九';

function cnNumber(n) {
  if (n <= 10) return n === 10 ? '十' : DIGITS[n];
  if (n < 20) return '十' + DIGITS[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return DIGITS[t] + '十' + (o ? DIGITS[o] : '');
}

/** 2026-11-05 → 二〇二六年十一月五日 */
export function cnDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(y).split('').map((c) => DIGITS[+c]).join('')}年${cnNumber(m)}月${cnNumber(d)}日`;
}

/** Carved vermilion seal reading 所願皆成, right column first. */
export function makeSeal(px = 240) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  const pad = px * 0.04;
  const r = px * 0.05;
  g.fillStyle = '#a8301c';
  g.beginPath();
  g.roundRect(pad, pad, px - pad * 2, px - pad * 2, r);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.strokeStyle = '#000';
  g.lineWidth = px * 0.028;
  g.beginPath();
  g.roundRect(pad + px * 0.06, pad + px * 0.06, px - pad * 2 - px * 0.12, px - pad * 2 - px * 0.12, r * 0.6);
  g.stroke();
  g.font = `600 ${px * 0.34}px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#000';
  const cell = (px - pad * 2 - px * 0.16) / 2;
  const x0 = pad + px * 0.08;
  [['所', 1, 0], ['願', 1, 1], ['皆', 0, 0], ['成', 0, 1]].forEach(([ch, col, row]) => {
    g.fillText(ch, x0 + cell * (col + 0.5), x0 + cell * (row + 0.53));
  });
  // worn ink
  for (let i = 0; i < px * 3; i++) {
    const x = Math.random() * px;
    const y = Math.random() * px;
    g.globalAlpha = Math.random() * 0.6;
    g.beginPath();
    g.arc(x, y, Math.random() * px * 0.008, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  return c;
}

function drawTracked(g, text, cx, y, tracking) {
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width);
  const total = widths.reduce((s, w) => s + w, 0) + tracking * (chars.length - 1);
  let x = cx - total / 2;
  g.textAlign = 'left';
  chars.forEach((ch, i) => {
    g.fillText(ch, x, y);
    x += widths[i] + tracking;
  });
}

function wrap(g, text, maxW, tracking) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    const next = line + ch;
    const w = [...next].reduce((s, c) => s + g.measureText(c).width, 0) + tracking * ([...next].length - 1);
    if (w > maxW && line) {
      lines.push(line);
      line = ch;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function goldGradient(g, x0, x1) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, '#8a6a32');
  gr.addColorStop(0.3, '#e8cf92');
  gr.addColorStop(0.5, '#fff1c8');
  gr.addColorStop(0.7, '#d6b06a');
  gr.addColorStop(1, '#8a6a32');
  return gr;
}

/** 1080×1350 keepsake: the gold turtle, the wish, place and date, sealed. */
export async function composePoster({ art, wish, place, date, seal }) {
  await document.fonts.load(`300 60px ${SERIF}`, wish + place + date);
  await document.fonts.load(`400 24px ${SERIF}`, '紙龜祈福' + place + date);
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  g.fillStyle = '#080706';
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 470, 0, W / 2, 470, 620);
  glow.addColorStop(0, 'rgba(150,98,38,0.28)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  g.globalCompositeOperation = 'screen';
  g.drawImage(art, 40, -10, 1000, 1000);
  g.globalCompositeOperation = 'source-over';
  // fade the art into the text field
  const fade = g.createLinearGradient(0, 760, 0, 960);
  fade.addColorStop(0, 'rgba(8,7,6,0)');
  fade.addColorStop(1, 'rgba(8,7,6,1)');
  g.fillStyle = fade;
  g.fillRect(0, 760, W, 240);

  // fine grain
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 7;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  // double gold rule
  g.strokeStyle = goldGradient(g, 0, W);
  g.globalAlpha = 0.55;
  g.lineWidth = 1.5;
  g.strokeRect(36, 36, W - 72, H - 72);
  g.globalAlpha = 0.3;
  g.lineWidth = 1;
  g.strokeRect(46, 46, W - 92, H - 92);
  g.globalAlpha = 1;

  g.textBaseline = 'alphabetic';
  g.font = `400 20px ${SERIF}`;
  g.fillStyle = 'rgba(214,180,112,0.7)';
  drawTracked(g, '紙龜祈福', W / 2, 112, 12);

  // wish
  g.font = `300 58px ${SERIF}`;
  const tracking = 8;
  const lines = wrap(g, wish, 800, tracking).slice(0, 3);
  const lh = 88;
  let y = 1010 - ((lines.length - 1) * lh) / 2;
  const wishGold = g.createLinearGradient(0, y - 60, 0, y + lh * lines.length);
  wishGold.addColorStop(0, '#f8eed8');
  wishGold.addColorStop(1, '#d9b877');
  g.fillStyle = wishGold;
  lines.forEach((l, i) => drawTracked(g, l, W / 2, y + i * lh, tracking));
  y += (lines.length - 1) * lh;

  // hairline
  g.fillStyle = goldGradient(g, W / 2 - 60, W / 2 + 60);
  g.fillRect(W / 2 - 60, y + 58, 120, 1);

  g.font = `400 22px ${SERIF}`;
  g.fillStyle = 'rgba(214,180,112,0.92)';
  drawTracked(g, `${place}　${date}`, W / 2, y + 118, 8);

  g.drawImage(seal, W - 46 - 30 - 92, H - 46 - 30 - 92, 92, 92);
  return c;
}
