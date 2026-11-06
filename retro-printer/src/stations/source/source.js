import { S, PW } from '../../engine/geometry.js';
import { DESIGN, DESIGN_PX, drawRegistration } from '../../plates/registration.js';
import { LIBRARY, libraryImage, thumbOf, GROUND } from '../../plates/library.js';
import { fitRect, panBy, shuffle } from '../../plates/fit.js';

// 提供圖片：從圖庫挑，或上傳自己的圖（只在瀏覽器裡處理，不會送出）。
//   source：在各站之間保留的選擇 { kind: 'library' | 'upload', id, bitmap, mode, pan }
//   onNext(image)：交給製版站的圖 { id, name, colors, canvas, data, w, h }
const PAPER = [245, 240, 230];
const THUMB = 112;

export function mountSource(root, { source, onNext }) {
  const stage = document.createElement('section');
  stage.className = 'stage';
  stage.innerHTML = `<div class="sheet source-sheet"><canvas class="paper" width="${PW}" height="${PW}"></canvas></div>`;
  root.appendChild(stage);
  const sheet = stage.querySelector('.sheet'), cv = stage.querySelector('.paper'), ctx = cv.getContext('2d');

  const panel = document.createElement('aside');
  panel.className = 'panel source-panel';
  panel.innerHTML = `
    <h1>選圖片</h1>
    <div class="lib" role="radiogroup" aria-label="圖庫"></div>
    <div class="upload">
      <button class="ghost up" type="button">上傳圖片</button>
      <input type="file" accept="image/*" hidden>
      <p class="note" aria-live="polite"></p>
    </div>
    <div class="field fit" hidden>
      <span class="label">放置</span>
      <div class="seg" role="radiogroup" aria-label="放置"></div>
    </div>
    <button class="primary" type="button">製版</button>`;
  root.appendChild(panel);
  const lib = panel.querySelector('.lib'), note = panel.querySelector('.note');
  const fileInput = panel.querySelector('input[type=file]'), fitRow = panel.querySelector('.fit');

  let image = null;

  /* ───────── 上傳的圖 ───────── */
  // 同一張上傳圖、同樣的放置方式，回傳同一個物件，製版站才會記得這張圖的設定
  function uploadImage() {
    const { bitmap, mode, pan } = source;
    const key = mode + '|' + (mode === 'cover' ? pan.map(v => v.toFixed(3)).join(',') : '');
    if (source.made && source.made.bitmap === bitmap && source.made.key === key) return source.made.image;
    const image = makeUploadImage(bitmap, mode, pan);
    source.made = { bitmap, key, image };
    return image;
  }
  function makeUploadImage(bitmap, mode, pan) {
    const c = document.createElement('canvas');
    c.width = c.height = DESIGN_PX;
    const x = c.getContext('2d');
    x.fillStyle = GROUND;
    x.fillRect(0, 0, DESIGN_PX, DESIGN_PX);
    const r = fitRect(bitmap.width, bitmap.height, DESIGN_PX, mode, pan);
    x.imageSmoothingQuality = 'high';
    x.filter = 'blur(0.6px)';            // 輕微平滑，減少照片雜訊
    x.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    x.filter = 'none';
    const data = x.getImageData(0, 0, DESIGN_PX, DESIGN_PX).data;
    return { id: 'upload', name: '上傳的圖', colors: 3, canvas: c, data, w: DESIGN_PX, h: DESIGN_PX };
  }

  async function loadFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { note.textContent = '這個檔案不是圖片。'; return; }
    try {
      const bitmap = await createImageBitmap(file);
      Object.assign(source, { kind: 'upload', id: 'upload', bitmap, mode: 'contain', pan: [0, 0] });
      note.textContent = '';
      select();
    } catch {
      note.textContent = '這張圖讀不出來，換一張試試。';
    }
  }

  /* ───────── 選取與預覽 ───────── */
  function select() {
    image = source.kind === 'upload' && source.bitmap ? uploadImage() : libraryImage(source.id);
    paint();
    renderTiles();
    renderFit();
  }

  function paint() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgb(${PAPER.join(',')})`;
    ctx.fillRect(0, 0, PW, PW);
    ctx.drawImage(image.canvas, DESIGN.x * S, DESIGN.y * S);
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.strokeStyle = 'rgba(21, 21, 20, 0.28)';
    drawRegistration(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    sheet.classList.toggle('pannable', source.kind === 'upload' && source.mode === 'cover');
  }

  const order = shuffle(LIBRARY);   // 每次進來都重新排列
  const thumbs = new Map();
  function tile(id, label, canvas) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lib-tile';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', label);
    b.title = label;
    b.setAttribute('aria-checked', String(source.kind === (id === 'upload' ? 'upload' : 'library') && source.id === id));
    b.appendChild(canvas);
    b.addEventListener('click', () => {
      if (id === 'upload') source.kind = 'upload';
      else Object.assign(source, { kind: 'library', id });
      select();
    });
    return b;
  }
  function renderTiles() {
    lib.innerHTML = '';
    if (source.bitmap) {
      const t = document.createElement('canvas');
      t.width = t.height = THUMB;
      const r = fitRect(source.bitmap.width, source.bitmap.height, THUMB, 'cover', [0, 0]);
      t.getContext('2d').drawImage(source.bitmap, r.sx, r.sy, r.sw, r.sh, 0, 0, THUMB, THUMB);
      lib.appendChild(tile('upload', '上傳的圖', t));
    }
    for (const item of order) {
      if (!thumbs.has(item.id)) thumbs.set(item.id, thumbOf(item, THUMB));
      const t = document.createElement('canvas');
      t.width = t.height = THUMB;
      t.getContext('2d').drawImage(thumbs.get(item.id), 0, 0);
      lib.appendChild(tile(item.id, item.name, t));
    }
  }

  function renderFit() {
    const on = source.kind === 'upload' && !!source.bitmap;
    fitRow.hidden = !on;
    if (!on) return;
    const seg = fitRow.querySelector('.seg');
    seg.innerHTML = '';
    for (const [mode, label] of [['contain', '完整'], ['cover', '填滿']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(source.mode === mode));
      b.textContent = label;
      b.addEventListener('click', () => { source.mode = mode; select(); });
      seg.appendChild(b);
    }
  }

  /* ───────── 上傳：按鈕與拖放 ───────── */
  panel.querySelector('.up').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { loadFile(fileInput.files[0]); fileInput.value = ''; });
  sheet.addEventListener('dragover', e => { e.preventDefault(); sheet.classList.add('drop'); });
  sheet.addEventListener('dragleave', () => sheet.classList.remove('drop'));
  sheet.addEventListener('drop', e => {
    e.preventDefault();
    sheet.classList.remove('drop');
    loadFile(e.dataTransfer.files[0]);
  });

  /* ───────── 填滿時拖動取景 ───────── */
  let drag = null;
  cv.addEventListener('pointerdown', e => {
    if (!(source.kind === 'upload' && source.mode === 'cover')) return;
    drag = { x: e.clientX, y: e.clientY };
    try { cv.setPointerCapture(e.pointerId); } catch { /* 沒有可擷取的指標時，照樣可以拖 */ }
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const display = cv.getBoundingClientRect().width * DESIGN_PX / PW;
    source.pan = panBy(source.pan, e.clientX - drag.x, e.clientY - drag.y, source.bitmap.width, source.bitmap.height, display);
    drag = { x: e.clientX, y: e.clientY };
    image = uploadImage();
    paint();
  });
  const endDrag = () => { drag = null; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  panel.querySelector('.primary').addEventListener('click', () => onNext(image));

  select();
  return { destroy() { root.innerHTML = ''; } };
}
