import { PALETTE, paletteByHue } from '../../inks.js';
import { wallItems } from '../../works.js';
import { drawWallPrint } from '../../gallery/render.js';

// 入口：一面墨水卡片牆、一面作品牆。
//   works          這次瀏覽的作品
//   library        這次進入口隨機生成的圖庫作品（見 src/gallery/library.js）
//   onStart        開始製作
//   onOpenWork(work)   點自己的作品 → 完成站
//   onPickItem(item)   點圖庫作品 → 帶著這件作品進製版
const css = rgb => `rgb(${rgb.join(',')})`;
const two = n => String(n).padStart(2, '0');
const PAPER = [245, 240, 230];
const TINTS = [1, 0.6, 0.3];
const THUMB = 360;

export function mountEntrance(root, { works, library, onStart, onOpenWork, onPickItem }) {
  root.classList.add('wide');
  const page = document.createElement('div');
  page.className = 'entrance';
  page.innerHTML = `
    <header class="ent-head">
      <h1>絹印</h1>
      <button class="primary start" type="button">開始製作</button>
    </header>
    <section class="wall">
      <h2>墨水 <span class="count"></span></h2>
      <div class="ink-wall"></div>
    </section>
    <section class="wall">
      <h2>作品 <span class="count"></span></h2>
      <div class="work-wall"></div>
    </section>`;
  root.appendChild(page);
  page.querySelector('.start').addEventListener('click', onStart);

  /* ───────── 墨水牆 ───────── */
  const inks = paletteByHue(PALETTE);
  const inkNo = new Map(inks.map((ink, i) => [ink.id, `No. ${two(i + 1)}`]));
  page.querySelectorAll('.count')[0].textContent = inks.length;
  const inkWall = page.querySelector('.ink-wall');
  inks.forEach(ink => {
    const card = document.createElement('figure');
    card.className = 'ink-card';
    const tints = TINTS.map(t => css(PAPER.map((p, k) => Math.round(p * (1 - t + t * ink.rgb[k] / 255)))));
    card.innerHTML = `
      <div class="block"></div>
      <div class="tints">${tints.map(c => `<span style="background:${c}"></span>`).join('')}</div>
      <figcaption><span class="no">${inkNo.get(ink.id)}</span><span class="nm"></span></figcaption>`;
    card.querySelector('.block').style.background = css(ink.rgb);
    card.querySelector('.nm').textContent = ink.name;
    inkWall.appendChild(card);
  });

  /* ───────── 作品牆 ───────── */
  const items = wallItems(works, library);
  page.querySelectorAll('.count')[1].textContent = items.length;
  const workWall = page.querySelector('.work-wall');
  const pending = [];
  // 卡片隨機帶一點旋轉，像隨手釘在牆上
  const tilt = () => `${((Math.random() - 0.5) * 3).toFixed(2)}deg`;

  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wall-item';
    b.style.setProperty('--tilt', tilt());
    b.innerHTML = `
      <div class="frame"></div>
      <span class="cap"><span class="title"></span><span class="spec"></span></span>`;
    const frame = b.querySelector('.frame'), title = b.querySelector('.title'), spec = b.querySelector('.spec');
    const tag = text => {
      const t = document.createElement('span');
      t.className = 'tag';
      t.textContent = text;
      frame.appendChild(t);
    };
    if (it.kind === 'work') {
      const w = it.work;
      const img = document.createElement('img');
      img.src = w.url; img.alt = '';
      frame.appendChild(img);
      frame.style.background = css(w.mediumPaper);
      title.textContent = `${w.label.no}　${w.label.title}`;
      spec.textContent = w.label.line.replace(/^絹印・/, '');
      tag('你的作品');
      b.setAttribute('aria-label', `你的作品 ${w.label.no} ${w.label.title}`);
      b.addEventListener('click', () => onOpenWork(w));
    } else {
      const item = it.item;
      const cv = document.createElement('canvas');
      cv.width = cv.height = THUMB;
      frame.appendChild(cv);
      frame.style.background = css(item.medium.paper);
      title.textContent = item.name;
      // 像店裡的作品樣本：標註色號與媒材
      spec.textContent = `${item.inks.map(i => inkNo.get(i.id)).join('・')}　${item.medium.name}`;
      if (item.badge) tag(item.badge);
      b.setAttribute('aria-label', `${item.name}，${item.inks.map(i => i.name).join('、')}，${item.medium.name}`);
      b.addEventListener('click', () => onPickItem(item));
      pending.push({ item, canvas: cv });
    }
    workWall.appendChild(b);
  }

  // 圖庫作品在背景一張一張畫
  let timer = 0;
  const next = () => {
    const job = pending.shift();
    if (!job) return;
    drawWallPrint(job.item, job.canvas);
    job.canvas.classList.add('ready');
    timer = setTimeout(next, 16);
  };
  timer = setTimeout(next, 60);

  return {
    destroy() {
      clearTimeout(timer);
      root.classList.remove('wide');
      root.innerHTML = '';
    }
  };
}
