import { PALETTE, paletteByHue, START_COLORS, inkById } from '../../inks.js';
import { wallItems } from '../../works.js';
import { drawWallPrint } from '../../gallery/render.js';

// 入口：滿版的一面牆，左半邊是作品、右半邊是色票；標準字與「開始製作」浮在正中間。
// 畫面不捲動；卡片不夠填滿時重複排列，邊緣的卡片直接被切掉，像一整面牆。
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
  root.classList.add('full');
  const page = document.createElement('div');
  page.className = 'entrance';
  page.innerHTML = `
    <div class="ent-wall">
      <section class="half ent-works" aria-label="作品"><div class="work-wall"></div></section>
      <section class="half ent-inks" aria-label="墨水"><div class="ink-wall"></div></section>
    </div>
    <div class="ent-center">
      <h1 class="ent-logo" aria-label="INK INK｜印印">
        <img class="paper" src="assets/logo-paper.png" alt="">
        <img class="ink" src="assets/logo-gold.png" alt="">
        <img class="ink" src="assets/logo-pink.png" alt="">
        <img class="ink" src="assets/logo-ultra.png" alt="">
      </h1>
      <button class="primary start" type="button">開始製作</button>
    </div>`;
  root.appendChild(page);
  const start = page.querySelector('.start');
  start.addEventListener('click', onStart);
  // 滑過時的配色：每次進入口從色票組成的模板裡隨機抽一組
  const [bg, fg] = START_COLORS[Math.floor(Math.random() * START_COLORS.length)];
  start.style.setProperty('--hover-bg', css(inkById(bg).rgb));
  start.style.setProperty('--hover-fg', css(inkById(fg).rgb));

  /* ───────── 墨水牆 ───────── */
  const inks = paletteByHue(PALETTE);
  const inkNo = new Map(inks.map((ink, i) => [ink.id, `No. ${two(i + 1)}`]));
  const inkWall = page.querySelector('.ink-wall');
  const inkCard = (ink, copy) => {
    const card = document.createElement('figure');
    card.className = 'ink-card';
    if (copy) card.setAttribute('aria-hidden', 'true');
    const tints = TINTS.map(t => css(PAPER.map((p, k) => Math.round(p * (1 - t + t * ink.rgb[k] / 255)))));
    card.innerHTML = `
      <div class="block"></div>
      <div class="tints">${tints.map(c => `<span style="background:${c}"></span>`).join('')}</div>
      <figcaption><span class="no">${inkNo.get(ink.id)}</span><span class="nm"></span></figcaption>`;
    card.querySelector('.block').style.background = css(ink.rgb);
    card.querySelector('.nm').textContent = ink.name;
    return card;
  };

  /* ───────── 作品牆 ───────── */
  const items = wallItems(works, library);
  const workWall = page.querySelector('.work-wall');
  const pending = [];
  const copies = new Map();   // 圖庫作品 → 重複出現的畫布，畫好後直接複製
  const drawn = new Map();    // 圖庫作品 → 已經畫好的畫布
  // 卡片隨機帶一點旋轉，像隨手釘在牆上
  const tilt = () => `${((Math.random() - 0.5) * 3).toFixed(2)}deg`;

  const workCard = (it, copy) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wall-item';
    b.style.setProperty('--tilt', tilt());
    // 重複的卡片只是用來填滿畫面，鍵盤與螢幕閱讀器略過
    if (copy) { b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); }
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
      if (!copy) {
        b.dataset.own = '1';
        // 剛完成、第一次回到入口的作品：等標準字印完後，像剛印好的紙一樣落到牆上
        if (!w.onWall) b.classList.add('fresh');
        w.onWall = true;
      }
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
      if (copy) {
        const list = copies.get(item) || [];
        list.push(cv);
        copies.set(item, list);
        if (drawn.has(item)) copyInto(drawn.get(item), cv);
      } else pending.push({ item, canvas: cv });
    }
    return b;
  };
  const copyInto = (src, cv) => { cv.getContext('2d').drawImage(src, 0, 0); cv.classList.add('ready'); };

  /* ───────── 填滿畫面 ───────── */
  // 依目前的格線欄數與列高，算出需要幾張卡片才能鋪滿，不夠就從頭重複
  // 作品牆重複時只用圖庫作品，自己的作品只出現一次
  const libOnly = items.filter(it => it.kind === 'library');
  const fills = [
    { wall: page.querySelector('.work-wall'), list: items, repeat: libOnly.length ? libOnly : items, make: workCard, n: 0 },
    { wall: inkWall, list: inks, repeat: inks, make: inkCard, n: 0 }
  ];
  function fill() {
    for (const F of fills) {
      if (!F.n) { F.list.forEach(x => F.wall.appendChild(F.make(x, false))); F.n = F.list.length; }
      const cols = getComputedStyle(F.wall).gridTemplateColumns.split(' ').length;
      const first = F.wall.firstElementChild;
      if (!first) continue;
      const gap = parseFloat(getComputedStyle(F.wall).rowGap) || 0;
      const rowH = first.getBoundingClientRect().height + gap;
      const need = cols * (Math.ceil(F.wall.parentElement.clientHeight / rowH) + 1);
      while (F.n < need) { F.wall.appendChild(F.make(F.repeat[(F.n - F.list.length) % F.repeat.length], true)); F.n++; }
    }
  }
  fill();
  let resizeT = 0;
  const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(fill, 120); };
  window.addEventListener('resize', onResize);

  /* ───────── 視差 ───────── */
  // 桌機上滑鼠移動時，整面牆往反方向微微滑動，露出藏在螢幕外的那一圈卡片；標準字與按鈕不動。
  const DEPTH = 24;                       // 最大位移 px，需小於 --bleed
  const wall = page.querySelector('.ent-wall');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const place = () => {
    wall.style.transform = cx || cy ? `translate3d(${(-cx * DEPTH).toFixed(2)}px, ${(-cy * DEPTH).toFixed(2)}px, 0)` : '';
  };
  const tick = () => {
    cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
    if (Math.abs(tx - cx) < 0.002 && Math.abs(ty - cy) < 0.002) { cx = tx; cy = ty; raf = 0; }
    else raf = requestAnimationFrame(tick);
    place();
  };
  const follow = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const onMove = e => {
    if (!fine.matches || still.matches || e.pointerType !== 'mouse') return;
    tx = e.clientX / innerWidth * 2 - 1;
    ty = e.clientY / innerHeight * 2 - 1;
    follow();
  };
  const onOut = e => { if (!e.relatedTarget) { tx = ty = 0; follow(); } };   // 滑鼠離開視窗：慢慢回到中間
  window.addEventListener('pointermove', onMove);
  window.addEventListener('mouseout', onOut);

  /* ───────── 自己的作品放在看得到的地方 ───────── */
  // 牆是斜的、又會跟著滑鼠移動，固定第幾格常會被切到。這裡找出完整落在畫面內
  // （預留視差的位移）、又不會被標準字與按鈕擋到的位置，最新的作品放在離畫面中心最近的那一格。
  function placeOwn() {
    const workWall = fills[0].wall, own = [...workWall.querySelectorAll('[data-own]')];
    if (!own.length) return;
    const vw = innerWidth, vh = innerHeight, M = fine.matches ? DEPTH + 12 : 8, pad = 24;
    const c = page.querySelector('.ent-center').getBoundingClientRect();
    const arr = [...workWall.children];
    // 看得到的比例：卡片落在「畫面內縮 M」範圍裡的面積比例
    // 手機上作品牆只佔上半部、會裁掉超出的部分，可見範圍要再跟它取交集
    const half = workWall.parentElement;
    const clip = getComputedStyle(half).overflow === 'hidden' ? half.getBoundingClientRect() : { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };
    const L = Math.max(M, clip.left), T = Math.max(M, clip.top), R = Math.min(vw - M, clip.right), B = Math.min(vh - M, clip.bottom);
    const shown = r => {
      const w = Math.max(0, Math.min(r.right, R) - Math.max(r.left, L));
      const h = Math.max(0, Math.min(r.bottom, B) - Math.max(r.top, T));
      return (w * h) / ((r.right - r.left) * (r.bottom - r.top));
    };
    // 完整看得到的位置優先，依離畫面中心的距離排；不夠時再用看得到最多的位置
    const slots = arr.map((el, i) => ({ i, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.right < c.left - pad || r.left > c.right + pad || r.bottom < c.top - pad || r.top > c.bottom + pad)
      .map(s => ({ ...s, v: shown(s.r), d: Math.hypot((s.r.left + s.r.right) / 2 - vw / 2, (s.r.top + s.r.bottom) / 2 - vh / 2) }))
      .filter(s => s.v > 0.5)
      .sort((a, b) => (b.v > 0.99) - (a.v > 0.99) || (a.v > 0.99 ? a.d - b.d : b.v - a.v || a.d - b.d));
    own.forEach((el, k) => {
      const s = slots[k];
      if (!s) return;
      const from = arr.indexOf(el);
      [arr[s.i], arr[from]] = [arr[from], arr[s.i]];
    });
    arr.forEach(el => workWall.appendChild(el));
  }
  placeOwn();

  // 圖庫作品在背景一張一張畫；重複的卡片直接複製畫好的那張
  let timer = 0;
  const next = () => {
    const job = pending.shift();
    if (!job) return;
    drawWallPrint(job.item, job.canvas);
    job.canvas.classList.add('ready');
    drawn.set(job.item, job.canvas);
    for (const cv of copies.get(job.item) || []) copyInto(job.canvas, cv);
    timer = setTimeout(next, 16);
  };
  timer = setTimeout(next, 60);

  return {
    destroy() {
      clearTimeout(timer);
      clearTimeout(resizeT);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('mouseout', onOut);
      cancelAnimationFrame(raf);
      root.classList.remove('full');
      root.innerHTML = '';
    }
  };
}
