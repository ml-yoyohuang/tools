import { prepare, computeLayers, defaultModes, suggestInks } from '../../engine/separate.js';
import { flatComposite } from '../../engine/flat.js';
import { PALETTE, paletteByHue } from '../../inks.js';
import { MEDIA_LIST } from '../../state.js';
import { LIBRARY, libraryImage } from '../../plates/library.js';
import { W } from '../../engine/geometry.js';
import { DESIGN, DESIGN_PX } from '../../plates/registration.js';
import { wallItems } from '../../works.js';

// 入口：一面墨水卡片牆、一面作品牆。
//   works        這次瀏覽的作品
//   onStart      開始製作
//   onOpenWork(work)    點自己的作品 → 完成站
//   onPickImage(id)     點圖庫作品 → 帶著這張圖進提供圖片
const css = rgb => `rgb(${rgb.join(',')})`;
const two = n => String(n).padStart(2, '0');
const PAPER = [245, 240, 230];
const TINTS = [1, 0.6, 0.3];
const THUMB = 360;

export function mountEntrance(root, { works, onStart, onOpenWork, onPickImage }) {
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
  page.querySelectorAll('.count')[0].textContent = inks.length;
  const inkWall = page.querySelector('.ink-wall');
  inks.forEach((ink, i) => {
    const card = document.createElement('figure');
    card.className = 'ink-card';
    const tints = TINTS.map(t => css(PAPER.map((p, k) => Math.round(p * (1 - t + t * ink.rgb[k] / 255)))));
    card.innerHTML = `
      <div class="block"></div>
      <div class="tints">${tints.map(c => `<span style="background:${c}"></span>`).join('')}</div>
      <figcaption><span class="no">No. ${two(i + 1)}</span><span class="nm"></span></figcaption>`;
    card.querySelector('.block').style.background = css(ink.rgb);
    card.querySelector('.nm').textContent = ink.name;
    inkWall.appendChild(card);
  });

  /* ───────── 作品牆 ───────── */
  const items = wallItems(works, LIBRARY);
  page.querySelectorAll('.count')[1].textContent = items.length;
  const workWall = page.querySelector('.work-wall');
  const pending = [];
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wall-item';
    if (it.kind === 'work') {
      const w = it.work;
      b.innerHTML = `<div class="frame"><img alt=""></div><span class="cap"><span class="no"></span><span class="nm"></span></span>`;
      b.querySelector('img').src = w.url;
      b.querySelector('.frame').style.background = css(w.mediumPaper);
      b.querySelector('.no').textContent = w.label.no;
      b.querySelector('.nm').textContent = w.label.title;
      b.setAttribute('aria-label', `${w.label.no} ${w.label.title}`);
      b.addEventListener('click', () => onOpenWork(w));
    } else {
      const medium = MEDIA_LIST[Math.floor(Math.random() * MEDIA_LIST.length)];
      b.innerHTML = `<div class="frame"><canvas width="${THUMB}" height="${THUMB}"></canvas></div><span class="cap"><span class="nm"></span></span>`;
      b.querySelector('.frame').style.background = css(medium.paper);
      b.querySelector('.nm').textContent = it.item.name;
      b.setAttribute('aria-label', it.item.name);
      b.addEventListener('click', () => onPickImage(it.item.id));
      pending.push({ item: it.item, medium, canvas: b.querySelector('canvas') });
    }
    workWall.appendChild(b);
  }

  // 圖庫作品的「印好的樣子」：分色後以建議墨色平塊疊印，在背景一張一張算
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = DESIGN_PX;
  const tctx = tmp.getContext('2d'), timg = tctx.createImageData(DESIGN_PX, DESIGN_PX);
  let timer = 0;
  const next = () => {
    const job = pending.shift();
    if (!job) return;
    const img = libraryImage(job.item.id), prep = prepare(img, job.item.colors);
    const masks = computeLayers(prep, { cov: prep.centers.map(() => 0.5), modes: defaultModes(prep), dot: 'medium' });
    flatComposite(masks, suggestInks(prep, PALETTE).map(i => i.rgb), job.medium.paper, timg.data);
    tctx.putImageData(timg, 0, 0);
    // 和真正印出來的作品一樣：圖案放在紙上的圖案區，四周留白
    const x = job.canvas.getContext('2d'), k = THUMB / W;
    x.fillStyle = css(job.medium.paper);
    x.fillRect(0, 0, THUMB, THUMB);
    x.drawImage(tmp, DESIGN.x * k, DESIGN.y * k, DESIGN.size * k, DESIGN.size * k);
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
