import { PW } from '../../engine/geometry.js';
import { textureField } from '../../engine/texture.js';
import { MEDIA_LIST } from '../../state.js';
import { samplePrint } from './sample.js';
import { showCanvas } from '../../ui/display.js';

// 選媒材：左邊是選取媒材的試印，右邊是媒材卡片。
const THUMB = 112;

export function mountMedia(root, { plates, inks, selected = 'paper', onPick, onBack }) {
  const stage = document.createElement('section');
  stage.className = 'stage';
  stage.innerHTML = `<div class="sheet"><canvas class="paper" width="${PW}" height="${PW}"></canvas></div>`;
  root.appendChild(stage);
  const sheet = stage.querySelector('.sheet'), paper = stage.querySelector('.paper');
  // 全尺寸畫在 full 上，再依顯示大小縮好畫到畫面（細織紋才不會出現疊紋）
  const full = document.createElement('canvas');
  full.width = full.height = PW;
  const pctx = full.getContext('2d');

  const panel = document.createElement('aside');
  panel.className = 'panel';
  panel.innerHTML = `
    <h1>選媒材</h1>
    <div class="media-list" role="radiogroup" aria-label="媒材"></div>
    <button class="primary" type="button">使用這個媒材</button>
    <div class="foot"><button class="text back" type="button" hidden>換墨水</button></div>`;
  root.appendChild(panel);
  if (onBack) {
    const back = panel.querySelector('.back');
    back.hidden = false;
    back.addEventListener('click', onBack);
  }
  const list = panel.querySelector('.media-list');

  const cards = MEDIA_LIST.map(m => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'medium-card';
    b.setAttribute('role', 'radio');
    b.innerHTML = `<canvas class="thumb" width="${THUMB}" height="${THUMB}"></canvas>
      <span class="m-text"><span class="m-name"></span><span class="m-note"></span></span>`;
    b.querySelector('.m-name').textContent = m.name;
    b.querySelector('.m-note').textContent = m.note;
    drawThumb(b.querySelector('.thumb'), m);
    b.addEventListener('click', () => select(m.id));
    list.appendChild(b);
    return { m, el: b };
  });

  // 試印結果依媒材快取；先畫目前選的，其餘在閒置時慢慢算
  const prints = new Map();
  const printOf = m => {
    if (!prints.has(m.id)) prints.set(m.id, samplePrint(plates, inks, m));
    return prints.get(m.id);
  };

  let current = null;
  function select(id) {
    current = MEDIA_LIST.find(m => m.id === id) || MEDIA_LIST[0];
    for (const c of cards) c.el.setAttribute('aria-checked', String(c.m === current));
    sheet.style.background = `rgb(${current.paper.join(',')})`;
    const img = pctx.createImageData(PW, PW);
    img.data.set(printOf(current));
    pctx.putImageData(img, 0, 0);
    showCanvas(full, paper);
  }

  panel.querySelector('.primary').addEventListener('click', () => onPick(current));

  select(selected);
  let idle = 0;
  const warm = MEDIA_LIST.filter(m => !prints.has(m.id));
  const next = () => {
    const m = warm.shift();
    if (!m) return;
    printOf(m);
    idle = setTimeout(next, 60);
  };
  idle = setTimeout(next, 300);

  return {
    destroy() {
      clearTimeout(idle);
      root.innerHTML = '';
    }
  };
}

// 縮圖：材質近看，織紋對比加強，讓小尺寸也看得出差別
function drawThumb(canvas, m) {
  const x = canvas.getContext('2d'), img = x.createImageData(THUMB, THUMB), d = img.data;
  const tex = textureField(m.id, m.texture);
  const amp = m.texture ? Math.min(0.3, m.texture.ground * 3) : 0;
  for (let y = 0; y < THUMB; y++) for (let xx = 0; xx < THUMB; xx++) {
    const t = tex ? tex[(y + 200) * PW + (xx + 200)] : 1, shade = 1 - amp * (1 - t), j = (y * THUMB + xx) * 4;
    d[j] = m.paper[0] * shade; d[j + 1] = m.paper[1] * shade; d[j + 2] = m.paper[2] * shade; d[j + 3] = 255;
  }
  x.putImageData(img, 0, 0);
}
