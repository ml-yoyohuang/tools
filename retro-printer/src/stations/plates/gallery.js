import { PW } from '../../engine/geometry.js';
import { screenCanvas, drawScreen } from './screen.js';

// 欣賞版子：完成的版單獨放大展示，可逐一切換。
const two = n => String(n).padStart(2, '0');
const css = rgb => `rgb(${rgb.join(',')})`;
const THUMB = 128;

export function mountGallery(root, { plates, inks, onNext, onBack }) {
  const stage = document.createElement('section');
  stage.className = 'stage';
  stage.innerHTML = `<div class="sheet"><canvas class="paper" width="${PW}" height="${PW}"></canvas></div>`;
  root.appendChild(stage);
  const sheet = stage.querySelector('.sheet'), ctx = stage.querySelector('.paper').getContext('2d');
  sheet.style.background = 'var(--bg)';
  sheet.classList.add('bare');

  const screens = plates.map(p => screenCanvas(p.m, true));
  let current = 0;

  const panel = document.createElement('aside');
  panel.className = 'panel gallery-panel';
  panel.innerHTML = `
    <h1>版子</h1>
    <div class="layer">
      <div class="layer-num"><span class="num"></span><small>/ ${two(plates.length)}</small></div>
      <div class="ink-tag"><span class="swatch"></span><span class="ink-name"></span></div>
    </div>
    <div class="screens" role="radiogroup" aria-label="版"></div>
    <div class="act">
      <button class="primary" type="button">選墨水</button>
    </div>
    <div class="foot"><button class="text back" type="button">重新製版</button></div>`;
  root.appendChild(panel);

  const list = panel.querySelector('.screens');
  const thumbs = screens.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'screen-thumb';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', `第 ${i + 1} 版`);
    const t = document.createElement('canvas');
    t.width = t.height = THUMB;
    t.getContext('2d').drawImage(s, 0, 0, THUMB, THUMB);
    b.appendChild(t);
    b.addEventListener('click', () => show(i));
    list.appendChild(b);
    return b;
  });

  function show(i) {
    current = i;
    ctx.clearRect(0, 0, PW, PW);
    drawScreen(ctx, screens[i]);
    panel.querySelector('.num').textContent = two(i + 1);
    panel.querySelector('.swatch').style.background = css(inks[i].rgb);
    panel.querySelector('.ink-name').textContent = '建議 ' + inks[i].name;
    thumbs.forEach((t, k) => t.setAttribute('aria-checked', String(k === i)));
  }

  const onKey = e => {
    if (e.key === 'ArrowRight') show((current + 1) % screens.length);
    else if (e.key === 'ArrowLeft') show((current - 1 + screens.length) % screens.length);
  };
  window.addEventListener('keydown', onKey);
  panel.querySelector('.primary').addEventListener('click', onNext);
  panel.querySelector('.back').addEventListener('click', onBack);

  show(0);
  return {
    destroy() {
      window.removeEventListener('keydown', onKey);
      root.innerHTML = '';
    }
  };
}
