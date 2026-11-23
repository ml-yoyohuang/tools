import { Engine } from './engine/engine.js';
import { CAMERAS, cameraById, filterById, controlsFor, filterDefaults, resolveParams, cropFor } from './data/cameras.js';
import { decodeFile, resample, squareCrop } from './ui/image.js';
import { slider, segment } from './ui/controls.js';
import { icon } from './ui/icons.js';
import { drawOverlay, hasOverlay } from './ui/overlay.js';
import { parseCube } from './engine/cube.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const narrow = matchMedia('(max-width: 860px)');
const coarse = matchMedia('(pointer: coarse)');

const stage = $('stage'), frame = $('frame'), view = $('view'), divider = $('divider');
const drop = $('drop'), tools = $('tools'), fileInput = $('file'), panel = $('panel'), overlay = $('overlay');
const lutInput = $('lutFile');

const state = {
  cameraId: CAMERAS[0].id,
  filterId: CAMERAS[0].filters[0],
  strength: 100,
  adjust: {},
  compare: false,
  splitPos: 0.5,
  photo: null, // { img, url, W, H, crop, name, date }
  lut: null,   // { name, amount } — custom .cube applied as pipeline step 3.5
  busy: false,
};

// ---------- engine ----------
let engine;
try {
  engine = new Engine(view);
} catch {
  drop.querySelector('.drop-title').textContent = '此瀏覽器不支援 WebGL2';
  drop.querySelector('.drop-sub').textContent = '請改用最新版 Chrome、Safari、Edge 或 Firefox';
  drop.disabled = true;
}

const camera = () => cameraById(state.cameraId);
function withLut(p) {
  if (state.lut) { p.lut = 'custom'; p.lutAmount = state.lut.amount / 100; }
  return p;
}
const params = () => withLut(resolveParams(camera(), state.filterId, state.strength / 100, state.adjust));

// Print finishing (Charmera frames / date imprint), drawn over the processed image.
function overlayOpts() {
  const ids = controlsFor(camera(), state.filterId).filter((c) => c.overlay).map((c) => c.id);
  if (!ids.length || !state.photo) return null;
  return { frame: state.adjust.chFrame || 0, date: state.adjust.chDate ? state.photo.date : null };
}
function redrawOverlay() {
  const o = overlayOpts();
  const g = overlay.getContext('2d');
  if (overlay.width !== view.width || overlay.height !== view.height) { overlay.width = view.width; overlay.height = view.height; }
  g.clearRect(0, 0, overlay.width, overlay.height);
  overlay.hidden = !hasOverlay(o);
  if (!overlay.hidden) drawOverlay(g, overlay.width, overlay.height, o);
}

let raf = 0;
function scheduleRender() {
  if (!state.photo || raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    engine.render(params());
    engine.present(splitValue());
  });
}

// ---------- toast / progress ----------
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 3200);
}
function progress(v) {
  const p = $('progress');
  p.classList.toggle('on', v != null);
  p.firstElementChild.style.transform = `scaleX(${v ?? 0})`;
}

// ---------- loading ----------
async function load(file) {
  if (!file || !engine || state.busy) return;
  state.busy = true;
  progress(0.15);
  try {
    const { img, url, W, H } = await decodeFile(file);
    if (state.photo) URL.revokeObjectURL(state.photo.url);
    state.photo = { img, url, W, H, crop: null, name: (file.name || 'photo').replace(/\.[^.]+$/, ''), date: new Date(file.lastModified || Date.now()) };
    applySource();
    redrawOverlay();
    frame.hidden = false;
    tools.hidden = false;
    drop.hidden = true;
    fit();
    engine.render(params());
    engine.present(splitValue());
    renderThumbs();
  } catch (e) {
    toast(e.message === 'HEIC' ? '此瀏覽器無法讀取 HEIC，請先轉成 JPG 再上傳' : '無法讀取這個檔案');
  } finally {
    state.busy = false;
    progress(null);
    updateDownload();
  }
}

// Preview + thumbnail sources for the current crop (aspect ratio is a camera setting on GFX).
function applySource() {
  const ph = state.photo;
  if (!ph) return;
  const crop = cropFor(camera(), state.filterId, state.adjust, ph.W, ph.H);
  const key = crop.join(',');
  if (ph.crop && ph.crop.join(',') === key) return false;
  ph.crop = crop;
  const maxLong = Math.min(coarse.matches ? 1600 : 2048, engine.maxTex);
  const s = Math.min(1, maxLong / Math.max(crop[2], crop[3]));
  const pw = Math.max(1, Math.round(crop[2] * s)), phh = Math.max(1, Math.round(crop[3] * s));
  const preview = resample(ph.img, ph.W, ph.H, pw, phh, crop[0], crop[1], crop[2], crop[3]);
  engine.setSource(preview);
  engine.setSmallSource(squareCrop(preview, pw, phh, 192));
  return true;
}
function refreshSource() {
  if (applySource()) { fit(); renderThumbs(); }
  redrawOverlay();
}

fileInput.addEventListener('change', () => { load(fileInput.files[0]); fileInput.value = ''; });
drop.addEventListener('click', () => fileInput.click());
drop.querySelector('.drop-ico').innerHTML = icon('open', 22);

let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; stage.classList.add('dragover'); });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; stage.classList.remove('dragover'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  stage.classList.remove('dragover');
  const files = [...(e.dataTransfer?.files || [])];
  const cube = files.find((x) => /\.cube$/i.test(x.name));
  if (cube) loadLut(cube);
  const f = files.find((x) => /^image\//.test(x.type) || /\.(heic|heif)$/i.test(x.name));
  if (f) load(f);
});
window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) load(item.getAsFile());
});

// ---------- stage fit ----------
function fit() {
  if (!state.photo) return;
  const r = stage.getBoundingClientRect();
  const pad = narrow.matches ? { t: 48, r: 16, b: 18, l: 16 } : { t: 64, r: 64, b: 78, l: 64 };
  const aw = Math.max(40, r.width - pad.l - pad.r), ah = Math.max(40, r.height - pad.t - pad.b);
  const ar = view.width / view.height;
  let w = aw, hh = aw / ar;
  if (hh > ah) { hh = ah; w = ah * ar; }
  w = Math.round(w); hh = Math.round(hh);
  Object.assign(frame.style, {
    width: `${w}px`, height: `${hh}px`,
    left: `${Math.round(pad.l + (aw - w) / 2)}px`, top: `${Math.round(pad.t + (ah - hh) / 2)}px`,
  });
  placeDivider();
}
new ResizeObserver(fit).observe(stage);

// ---------- compare ----------
let holding = false;
const splitValue = () => (holding ? 1 : state.compare ? state.splitPos : 0);
function placeDivider() {
  divider.hidden = !state.compare || holding;
  divider.style.left = `${state.splitPos * 100}%`;
  overlay.style.clipPath = `inset(0 0 0 ${splitValue() * 100}%)`;
}
function setCompare(on) {
  state.compare = on;
  frame.classList.toggle('comparing', on);
  compareBtn.setAttribute('aria-pressed', String(on));
  placeDivider();
  engine.present(splitValue());
}
function setHold(on) {
  if (holding === on) return;
  holding = on;
  $('origTag').hidden = !on;
  frame.classList.toggle('holding', on);
  placeDivider();
  engine.present(splitValue());
}

let press = null;
frame.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  const r = frame.getBoundingClientRect();
  if (state.compare) {
    frame.setPointerCapture(e.pointerId);
    press = { id: e.pointerId, mode: 'split' };
    state.splitPos = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    placeDivider();
    engine.present(splitValue());
    return;
  }
  press = { id: e.pointerId, mode: 'hold', x: e.clientX, y: e.clientY, timer: setTimeout(() => setHold(true), e.pointerType === 'mouse' ? 160 : 260) };
});
frame.addEventListener('pointermove', (e) => {
  if (!press || press.id !== e.pointerId) return;
  if (press.mode === 'split') {
    const r = frame.getBoundingClientRect();
    state.splitPos = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    placeDivider();
    engine.present(splitValue());
  } else if (!holding && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) {
    clearTimeout(press.timer);
    press = null;
  }
});
const release = () => {
  if (!press) return;
  clearTimeout(press.timer);
  press = null;
  setHold(false);
};
frame.addEventListener('pointerup', release);
frame.addEventListener('pointercancel', release);
frame.addEventListener('contextmenu', (e) => e.preventDefault());
divider.querySelector('.grip').innerHTML = icon('grip', 16);

// ---------- stage tools ----------
function toolBtn(name, label, onClick, extra = '') {
  const b = h('button', `tool ${extra}`.trim(), icon(name));
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  tools.append(b);
  return b;
}
toolBtn('open', '更換照片', () => fileInput.click());
const compareBtn = toolBtn('compare', '前後對比', () => setCompare(!state.compare));
compareBtn.setAttribute('aria-pressed', 'false');
const mobileDl = toolBtn('download', '下載', () => download(), 'mobile-only');

// ---------- panel ----------
const scroll = h('div', 'panel-scroll');
const foot = h('div', 'panel-foot');
panel.append(scroll, foot);

const secCamera = h('section', 'section');
const camBtn = h('button', 'cam-btn');
camBtn.type = 'button';
camBtn.setAttribute('aria-haspopup', 'dialog');
secCamera.append(h('div', 'label', '<span>相機</span>'), camBtn);

const secLooks = h('section', 'section');
const looks = h('div', 'looks-wrap');
secLooks.append(h('div', 'label', '<span>風格</span>'), looks);

const secAdjust = h('section', 'section');
const adjustLabel = h('div', 'label', '<span>調整</span>');
const resetBtn = h('button', 'icon-btn', icon('reset', 16));
resetBtn.type = 'button';
resetBtn.title = '全部重設';
resetBtn.setAttribute('aria-label', '全部重設');
adjustLabel.append(resetBtn);
const adjustBody = h('div');
secAdjust.append(adjustLabel, adjustBody);

scroll.append(secCamera, secLooks, secAdjust);

const dlBtn = h('button', 'btn-primary', `${icon('download', 18)}<span class="dl-label">下載</span>`);
dlBtn.type = 'button';
dlBtn.addEventListener('click', () => download());
const legal = h('p', 'legal', '本站為非官方趣味致敬作品，與各相機品牌無關，濾鏡效果為模擬詮釋。');
foot.append(dlBtn);
// desktop: under the download button; phone: at the end of the page so the sticky bar stays slim
function placeLegal() { (narrow.matches ? scroll : foot).append(legal); }
narrow.addEventListener('change', placeLegal);
placeLegal();
const dlLabel = dlBtn.querySelector('.dl-label');

function updateDownload() {
  const off = !state.photo || state.busy;
  dlBtn.disabled = off;
  mobileDl.disabled = off;
  dlBtn.classList.toggle('working', state.busy && !!state.photo);
  if (!state.busy) dlLabel.textContent = '下載';
}

function renderCamera() {
  const c = camera();
  camBtn.innerHTML = `<span class="cam-name">${c.name}</span><span class="cam-meta">${c.focal ? `<span>${c.focal}</span>` : ''}${icon('chevron', 16)}</span>`;
  camBtn.setAttribute('aria-label', `相機：${c.name}，點選更換`);
}

const thumbCanvases = new Map();
function renderLooks() {
  looks.innerHTML = '';
  thumbCanvases.clear();
  const c = camera();
  const groups = c.groups || [[null, c.filters.length]];
  let i = 0;
  for (const [title, n] of groups) {
    if (title) looks.append(h('div', 'looks-group', title));
    const grid = h('div', 'looks');
    for (const id of c.filters.slice(i, i + n)) {
      const f = filterById(id);
      const b = h('button', 'look');
      b.type = 'button';
      b.dataset.id = id;
      b.title = f.name;
      b.setAttribute('aria-pressed', String(id === state.filterId));
      const t = h('div', 'look-thumb');
      const cv = document.createElement('canvas');
      cv.width = cv.height = 192;
      t.append(cv);
      b.append(t, h('span', 'look-name', f.name));
      b.addEventListener('click', () => selectFilter(id));
      grid.append(b);
      thumbCanvases.set(id, cv);
    }
    looks.append(grid);
    i += n;
  }
  renderThumbs();
}

function renderThumbs() {
  if (!state.photo) return;
  const c = camera();
  for (const [id, cv] of thumbCanvases) {
    const data = engine.renderSmall(withLut(resolveParams(c, id, 1, {})));
    cv.getContext('2d').putImageData(data, 0, 0);
    cv.classList.add('ready');
  }
}

let ctlRefs = [];
function renderAdjust() {
  adjustBody.innerHTML = '';
  ctlRefs = [];
  const strength = slider({
    label: '濾鏡強度', min: 0, max: 100, step: 1, value: state.strength, def: 100, suffix: '%',
    onInput: (v) => { state.strength = v; updateReset(); scheduleRender(); },
  });
  adjustBody.append(strength.el);
  const defaults = filterDefaults(camera(), state.filterId);
  for (const c of controlsFor(camera(), state.filterId)) {
    if (c.type === 'slider') {
      const s = slider({
        label: c.label, min: c.min, max: c.max, step: c.step, value: state.adjust[c.id] ?? 0, def: 0,
        onInput: (v) => { if (v === 0) delete state.adjust[c.id]; else state.adjust[c.id] = v; updateReset(); scheduleRender(); },
      });
      adjustBody.append(s.el);
    } else {
      const def = c.from(defaults);
      const s = segment({
        label: c.label, options: c.options, value: state.adjust[c.id] ?? def, def,
        onChange: (i) => {
          if (c.reroll === i) { state.adjust.crossSeed = Math.random(); state.adjust[c.id] = i; }
          else if (i === def) delete state.adjust[c.id];
          else state.adjust[c.id] = i;
          if (c.geometry) refreshSource();
          if (c.overlay) redrawOverlay();
          updateReset(); scheduleRender();
        },
      });
      adjustBody.append(s.el);
    }
  }
  adjustBody.append(lutBlock(camera().id === 'panasonic-lumix-l10' ? 'REAL TIME LUT' : 'LUT'));
  updateReset();
}

function lutBlock(title) {
  const box = h('div', 'ctl lut');
  const head = h('div', 'ctl-head');
  head.append(h('span', 'ctl-name', title));
  box.append(head);
  if (!state.lut) {
    const b = h('button', 'btn-ghost', `${icon('open', 16)}<span>載入 .cube</span>`);
    b.type = 'button';
    b.addEventListener('click', () => lutInput.click());
    box.append(b);
    return box;
  }
  const row = h('div', 'lut-file');
  row.append(h('span', 'lut-name', state.lut.name));
  const swap = h('button', 'icon-btn', icon('open', 16));
  swap.type = 'button';
  swap.title = '更換 LUT';
  swap.setAttribute('aria-label', '更換 LUT');
  swap.addEventListener('click', () => lutInput.click());
  const rm = h('button', 'icon-btn', icon('close', 16));
  rm.type = 'button';
  rm.title = '移除 LUT';
  rm.setAttribute('aria-label', '移除 LUT');
  rm.addEventListener('click', () => { state.lut = null; renderAdjust(); renderThumbs(); scheduleRender(); });
  row.append(swap, rm);
  box.append(row);
  const amt = slider({
    label: 'LUT 強度', min: 0, max: 100, step: 1, value: state.lut.amount, def: 100, suffix: '%',
    onInput: (v) => { state.lut.amount = v; scheduleRender(); },
  });
  box.append(amt.el);
  return box;
}

async function loadLut(file) {
  if (!file || !engine) return;
  try {
    const parsed = parseCube(await file.text());
    engine.registerLut('custom', parsed);
    state.lut = { name: (file.name || 'LUT').replace(/\.cube$/i, ''), amount: state.lut ? state.lut.amount : 100 };
    renderAdjust();
    renderThumbs();
    scheduleRender();
  } catch {
    toast('無法讀取這個 .cube 檔（僅支援 3D LUT）');
  }
}
lutInput.addEventListener('change', () => { loadLut(lutInput.files[0]); lutInput.value = ''; });

function updateReset() {
  resetBtn.disabled = state.strength === 100 && Object.keys(state.adjust).length === 0;
}
resetBtn.addEventListener('click', () => {
  state.strength = 100;
  state.adjust = {};
  refreshSource();
  renderAdjust();
  redrawOverlay();
  scheduleRender();
});

function selectFilter(id) {
  if (id === state.filterId) return;
  state.filterId = id;
  // keep only adjustments this filter still offers
  const allowed = new Set(controlsFor(camera(), id).map((c) => c.id));
  for (const k of Object.keys(state.adjust)) if (!allowed.has(k)) delete state.adjust[k];
  for (const b of looks.querySelectorAll('.look')) {
    const on = b.dataset.id === id;
    b.setAttribute('aria-pressed', String(on));
    if (on && narrow.matches) b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
  renderAdjust();
  redrawOverlay();
  scheduleRender();
}

function selectCamera(id) {
  closeSheet();
  if (id === state.cameraId) return;
  state.cameraId = id;
  state.filterId = camera().filters[0];
  state.adjust = {};
  state.strength = 100;
  applySource();
  fit();
  renderCamera();
  renderLooks();
  renderAdjust();
  redrawOverlay();
  scheduleRender();
}

// camera sheet
let sheet = null, scrim = null;
function openSheet() {
  if (sheet) return;
  scrim = h('div', 'scrim');
  scrim.addEventListener('click', closeSheet);
  sheet = h('div', 'sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', '選擇相機');
  const head = h('div', 'sheet-head', '<span>選擇相機</span>');
  const close = h('button', 'icon-btn', icon('close', 18));
  close.type = 'button';
  close.setAttribute('aria-label', '關閉');
  close.addEventListener('click', closeSheet);
  head.append(close);
  const list = h('div', 'sheet-list');
  for (const c of CAMERAS) {
    const b = h('button', 'cam');
    b.type = 'button';
    b.setAttribute('aria-current', String(c.id === state.cameraId));
    b.innerHTML = `<span class="cam-row-name">${c.name}</span><span class="cam-row-focal">${c.focal}</span><span class="cam-row-desc">${c.desc}</span>`;
    b.addEventListener('click', () => selectCamera(c.id));
    list.append(b);
  }
  sheet.append(head, list);
  document.body.append(scrim);
  (narrow.matches ? document.body : panel).append(sheet);
  list.querySelector('[aria-current="true"]')?.focus({ preventScroll: true });
}
function closeSheet() {
  if (!sheet) return;
  const s = sheet, sc = scrim;
  sheet = scrim = null;
  s.classList.add('closing');
  sc.classList.add('closing');
  const done = () => { s.remove(); sc.remove(); };
  s.addEventListener('animationend', done, { once: true });
  setTimeout(done, 400);
  camBtn.focus({ preventScroll: true });
}
camBtn.addEventListener('click', openSheet);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

// ---------- download ----------
function fileName() {
  const slug = (s) => s.replace(/&/g, '').replace(/[^\w一-鿿-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${state.photo.name}_${camera().short}_${slug(filterById(state.filterId).name)}.jpg`;
}

async function download() {
  if (!state.photo || state.busy) return;
  state.busy = true;
  updateDownload();
  progress(0.02);
  const { img, W, H } = state.photo;
  try {
    const [cx, cy, cw, chh] = state.photo.crop || [0, 0, W, H];
    const step = (v) => { progress(0.04 + v * 0.86); dlLabel.textContent = `輸出中 ${Math.round(v * 100)}%`; };
    step(0);
    const out = await engine.exportFull(params(), img, cw, chh, step, [cx, cy]);
    const o = overlayOpts();
    if (hasOverlay(o)) drawOverlay(out.getContext('2d'), cw, chh, o);
    dlLabel.textContent = '編碼中';
    engine.present(splitValue());
    const blob = await new Promise((res) => out.toBlob(res, 'image/jpeg', 0.92));
    out.width = out.height = 0;
    if (!blob) throw new Error('ENCODE');
    progress(1);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) {
    console.error(e);
    toast('輸出失敗：裝置記憶體不足或圖片過大');
  } finally {
    state.busy = false;
    updateDownload();
    setTimeout(() => progress(null), 250);
  }
}

// ---------- init ----------
if (import.meta.env.DEV) window.__sooc = { engine, state, params };
renderCamera();
renderLooks();
renderAdjust();
updateDownload();
