// 調參頁（開發用）：左邊是真正的工作桌，右邊用滑桿即時改 CONFIG。
// 大部分參數在下一次掀框時生效；標「重來」的參數會讓工作桌重新開始。
import { CONFIG } from '../config.js';
import { MEDIA, MEDIA_LIST } from '../state.js';
import { mountWorkbench } from '../stations/workbench/workbench.js';
import { makeItem } from '../gallery/library.js';
import { itemImage } from '../gallery/render.js';
import { plateFromDesignMask } from '../plates/registration.js';

const DEFAULTS = { ...CONFIG };
const STORE = 'retro-printer.tune';

// [鍵, 名稱, 最小, 最大, 間隔, 需要重來]
const GROUPS = [
  ['刮印速度', [
    ['speedSlow', '太慢的門檻 px/ms', 0.02, 0.4, 0.01, true],
    ['speedFastStart', '開始飛白 px/ms', 0.3, 2, 0.05, true],
    ['speedFastFull', '最嚴重飛白 px/ms', 1, 4, 0.1],
    ['bladeLength', '刮板長度', 200, 460, 10, true]
  ]],
  ['基礎質感', [
    ['jitter', '邊緣抖動 px', 0, 4, 0.1],
    ['speckle', '零星飛白比例', 0, 0.2, 0.005],
    ['scratchChance', '出現刮痕的機率', 0, 1, 0.05]
  ]],
  ['飛白與缺墨', [
    ['fastVoid', '刮太快的額外飛白', 0, 1, 0.02],
    ['fastInkMin', '最快時的出墨量', 0, 1, 0.05],
    ['inkMissing', '低於此完全缺墨', 0, 0.6, 0.01],
    ['inkFull', '高於此完整', 0.3, 1, 0.01]
  ]],
  ['溢墨', [
    ['slowExcess', '太慢累積的溢墨', 0, 3, 0.05],
    ['freePasses', '不溢墨的刮印次數', 0, 6, 1],
    ['repeatExcess', '多刮一次累積的溢墨', 0, 1.5, 0.05],
    ['dwellExcessPerSec', '停住時每秒溢墨', 0, 4, 0.1],
    ['excessFull', '溢墨達最大的累積量', 0.4, 4, 0.1],
    ['bleedPx', '最大外擴 px', 0, 12, 0.5]
  ]],
  ['未乾', [
    ['dryTime', '自然乾燥秒數', 2, 60, 1],
    ['dryerBoost', '吹風機倍速', 1, 12, 0.5],
    ['smear', '糊開距離 px', 0, 30, 1],
    ['stain', '沾染比例', 0, 1, 0.05],
    ['pickCarry', '刮板帶墨程度', 0.5, 0.99, 0.01],
    ['pickShow', '網上混色程度', 0, 1, 0.05]
  ]],
  ['塞網', [
    ['clogGrace', '閒置幾秒開始塞', 0, 60, 1],
    ['clogTime', '塞到最嚴重的秒數', 5, 120, 1],
    ['clogMax', '最嚴重時的缺墨比例', 0, 1, 0.05],
    ['clogThin', '細線更易塞的程度', 0, 0.5, 0.01]
  ]],
  ['畫面', [
    ['wetFrameAlpha', '網框不透明度', 0.2, 1, 0.05],
    ['maxOffset', '網框最大偏移 px', 10, 90, 1]
  ]]
];
const SPECS = GROUPS.flatMap(([, list]) => list);

try { Object.assign(CONFIG, pick(JSON.parse(localStorage.getItem(STORE) || '{}'))); } catch {}
function pick(obj) {
  const out = {};
  for (const [k] of SPECS) if (typeof obj[k] === 'number') out[k] = obj[k];
  return out;
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(changed())); } catch {} }
function changed() {
  const out = {};
  for (const [k] of SPECS) if (CONFIG[k] !== DEFAULTS[k]) out[k] = CONFIG[k];
  return out;
}

/* ───────── 工作桌 ───────── */
const app = document.getElementById('app');
let bench = null, image = null, medium = MEDIA.paper;
function newImage() {
  const item = makeItem(Math.random);
  image = { item, data: itemImage(item) };
}
function mount() {
  if (bench) bench.destroy();
  const plates = image.data.layers.map(plateFromDesignMask);
  bench = mountWorkbench(app, { plates, inks: image.item.inks, medium, onFinish: null });
}

/* ───────── 滑桿 ───────── */
const side = document.getElementById('tune');
const fmt = (v, step) => (step >= 1 ? String(v) : v.toFixed(String(step).split('.')[1].length));
function build() {
  side.innerHTML = `
    <header>
      <h1>調參</h1>
      <p>多數參數在下一次掀框時生效；標 · 的參數會讓工作桌重來。</p>
    </header>
    <div class="row-btns">
      <button class="text" data-act="image" type="button">換圖</button>
      <button class="text" data-act="restart" type="button">重來</button>
    </div>
    <div class="media">${MEDIA_LIST.map(m => `<button class="text${m === medium ? ' on' : ''}" data-medium="${m.id}" type="button">${m.name}</button>`).join('')}</div>
    ${GROUPS.map(([title, list]) => `
      <section><h2>${title}</h2>${list.map(([k, label, min, max, step, re]) => `
        <label class="${CONFIG[k] !== DEFAULTS[k] ? 'dirty' : ''}" data-key="${k}">
          <span class="name">${label}${re ? ' ·' : ''}</span>
          <output>${fmt(CONFIG[k], step)}</output>
          <input type="range" min="${min}" max="${max}" step="${step}" value="${CONFIG[k]}">
        </label>`).join('')}
      </section>`).join('')}
    <footer>
      <button class="primary" data-act="copy" type="button">複製改過的設定</button>
      <button class="text" data-act="reset" type="button">全部還原</button>
      <p class="note" data-ref="note"></p>
    </footer>`;
}
build();

side.addEventListener('input', e => {
  const label = e.target.closest('label[data-key]');
  if (!label) return;
  const k = label.dataset.key, spec = SPECS.find(s => s[0] === k);
  CONFIG[k] = Number(e.target.value);
  label.querySelector('output').textContent = fmt(CONFIG[k], spec[4]);
  label.classList.toggle('dirty', CONFIG[k] !== DEFAULTS[k]);
  save();
});
side.addEventListener('change', e => {
  const label = e.target.closest('label[data-key]');
  if (label && SPECS.find(s => s[0] === label.dataset.key)[5]) mount();
});
side.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.medium) { medium = MEDIA[b.dataset.medium]; build(); mount(); return; }
  const act = b.dataset.act;
  if (act === 'image') { newImage(); mount(); }
  else if (act === 'restart') mount();
  else if (act === 'reset') { Object.assign(CONFIG, DEFAULTS); save(); build(); mount(); }
  else if (act === 'copy') copy();
});

function copy() {
  const diff = changed(), keys = Object.keys(diff);
  const note = side.querySelector('[data-ref="note"]');
  if (!keys.length) { note.textContent = '還沒有改動。'; return; }
  const text = keys.map(k => `  ${k}: ${diff[k]},`).join('\n');
  navigator.clipboard?.writeText(text).then(
    () => { note.textContent = `已複製 ${keys.length} 項。`; },
    () => { note.textContent = text; }
  );
}

newImage();
mount();
