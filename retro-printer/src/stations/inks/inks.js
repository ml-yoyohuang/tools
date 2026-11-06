import { CONFIG as C } from '../../config.js';
import { PW } from '../../engine/geometry.js';
import { makeMixedInk } from '../../engine/ink.js';
import { flatComposite } from '../../engine/flat.js';
import { PALETTE, inkById } from '../../inks.js';
import { createMixer } from './mixer.js';

// 選墨水：左邊是試配色（版直接以墨色相乘，不算瑕疵），右邊是各層的墨與色卡。
// 切到調墨台時，左邊換成調墨台，可以混出自己的墨。
const PREVIEW_PAPER = [245, 240, 230];
const SLAB = [226, 224, 219];   // 調墨台台面
const two = n => String(n).padStart(2, '0');
const css = rgb => `rgb(${rgb.join(',')})`;

export function mountInks(root, { plates, session, onNext, onBack }) {
  // session：在各站之間保留的選擇 { inks, customInks }
  const L = plates.length;
  let active = 0;
  let mode = 'pick';

  const stage = document.createElement('section');
  stage.className = 'stage';
  stage.innerHTML = `<div class="sheet">
      <canvas class="paper" width="${PW}" height="${PW}"></canvas>
      <canvas class="slab" width="96" height="96" hidden></canvas>
    </div>`;
  root.appendChild(stage);
  const preview = stage.querySelector('.paper'), slab = stage.querySelector('.slab');
  const pctx = preview.getContext('2d'), sctx = slab.getContext('2d');

  const panel = document.createElement('aside');
  panel.className = 'panel inks-panel';
  root.appendChild(panel);

  /* ───────── 試配色 ───────── */
  const masks = plates.map(p => p.m);
  const previewImg = pctx.createImageData(PW, PW);
  function drawPreview(inks) {
    flatComposite(masks, inks.map(i => i.rgb), PREVIEW_PAPER, previewImg.data);
    pctx.putImageData(previewImg, 0, 0);
  }
  const showSelection = () => drawPreview(session.inks);
  const showTrial = ink => drawPreview(session.inks.map((x, i) => (i === active ? ink : x)));

  /* ───────── 色卡 ───────── */
  function chip(ink, onPick, { hoverPreview = false, selected = false } = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (selected ? ' on' : '');
    b.title = ink.name;
    b.setAttribute('aria-label', ink.name);
    b.style.background = css(ink.rgb);
    // 沒攪勻的自調墨：色塊上露出 A、B 的色紋
    if (ink.mix && ink.mix.evenness < 0.9) {
      const k = Math.round((1 - ink.mix.evenness) * 100);
      b.style.background = `repeating-linear-gradient(100deg, ${css(ink.mix.a)} 0 3px, ${css(ink.rgb)} 3px ${6 + k / 10}px, ${css(ink.mix.b)} ${6 + k / 10}px ${9 + k / 8}px)`;
    }
    b.addEventListener('click', () => onPick(ink));
    if (hoverPreview) {
      b.addEventListener('mouseenter', () => showTrial(ink));
      b.addEventListener('mouseleave', showSelection);
    }
    return b;
  }

  function chipGrid(inks, onPick, opts) {
    const g = document.createElement('div');
    g.className = 'chips';
    for (const ink of inks) g.appendChild(chip(ink, onPick, opts(ink)));
    return g;
  }

  /* ───────── 一般模式 ───────── */
  function renderPick() {
    mode = 'pick';
    slab.hidden = true;
    preview.hidden = false;
    showSelection();
    panel.innerHTML = `
      <h1>選墨水</h1>
      <div class="layers" role="radiogroup" aria-label="各層的墨"></div>
      <div class="palette"></div>
      <div class="act">
        <button class="text mix-open" type="button">調墨台</button>
        <button class="primary" type="button">使用這組墨</button>
      </div>
      <div class="foot"><button class="text back" type="button" hidden>回到版子</button></div>`;
    if (onBack) {
      const back = panel.querySelector('.back');
      back.hidden = false;
      back.addEventListener('click', onBack);
    }
    const layersEl = panel.querySelector('.layers');
    session.inks.forEach((ink, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'layer-row';
      row.setAttribute('role', 'radio');
      row.setAttribute('aria-checked', String(i === active));
      row.innerHTML = `<span class="sw"></span><span class="nm"></span><span class="lv">第 ${i + 1} 層</span>`;
      row.querySelector('.sw').style.background = css(ink.rgb);
      row.querySelector('.nm').textContent = ink.name;
      row.addEventListener('click', () => { active = i; renderPick(); });
      layersEl.appendChild(row);
    });

    const pal = panel.querySelector('.palette');
    const pick = ink => {
      session.inks[active] = ink;
      active = Math.min(L - 1, active + 1);
      renderPick();
    };
    const sel = ink => ({ hoverPreview: true, selected: session.inks[active].id === ink.id });
    pal.appendChild(chipGrid(PALETTE, pick, sel));
    if (session.customInks.length) {
      const label = document.createElement('p');
      label.className = 'sub';
      label.textContent = '自調';
      pal.appendChild(label);
      pal.appendChild(chipGrid(session.customInks, pick, sel));
    }

    panel.querySelector('.mix-open').addEventListener('click', renderMix);
    panel.querySelector('.primary').addEventListener('click', () => onNext(session.inks.slice()));
  }

  /* ───────── 調墨台 ───────── */
  const mixer = createMixer({ diffuse: C.mixDiffuse, radius: C.mixRadius });
  const slabImg = sctx.createImageData(mixer.size, mixer.size);
  const mix = { a: inkById('lemon'), b: inkById('ultra'), ratio: 0.5, slot: 0 };
  let evenEl = null, evenFill = null;

  function drawSlab() {
    mixer.paint(slabImg, mix.a.rgb, mix.b.rgb, SLAB);
    sctx.putImageData(slabImg, 0, 0);
    const p = Math.round(mixer.evenness * 100);
    if (evenEl) { evenEl.textContent = p + '%'; evenFill.style.width = p + '%'; }
  }
  function repour() { mixer.pour(mix.ratio); drawSlab(); }

  function renderMix() {
    mode = 'mix';
    preview.hidden = true;
    slab.hidden = false;
    panel.innerHTML = `
      <h1>調墨台</h1>
      <div class="layers" role="radiogroup" aria-label="要混的兩支墨"></div>
      <div class="palette"></div>
      <div class="ratio">
        <div class="row"><span>比例</span><span class="rv"></span></div>
        <input type="range" min="10" max="90" step="5" aria-label="比例">
      </div>
      <div class="even">
        <div class="row"><span>均勻度</span><span class="ev">0%</span></div>
        <div class="bar"><span></span></div>
      </div>
      <p class="hint">在調墨台上按住拖動，攪拌兩支墨。</p>
      <div class="act">
        <button class="text mix-close" type="button">返回</button>
        <button class="primary" type="button">加入色票</button>
      </div>`;
    const slots = panel.querySelector('.layers');
    [['a', '墨 A'], ['b', '墨 B']].forEach(([key, label], i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'layer-row';
      row.setAttribute('role', 'radio');
      row.setAttribute('aria-checked', String(i === mix.slot));
      row.innerHTML = `<span class="sw"></span><span class="nm"></span><span class="lv"></span>`;
      row.querySelector('.sw').style.background = css(mix[key].rgb);
      row.querySelector('.nm').textContent = mix[key].name;
      row.querySelector('.lv').textContent = label;
      row.addEventListener('click', () => { mix.slot = i; renderMix(); });
      slots.appendChild(row);
    });
    const pickForMix = ink => {
      mix[mix.slot ? 'b' : 'a'] = ink;
      mix.slot = mix.slot ? 0 : 1;
      renderMix();
      repour();
    };
    panel.querySelector('.palette').appendChild(
      chipGrid(PALETTE, pickForMix, ink => ({ selected: mix[mix.slot ? 'b' : 'a'].id === ink.id })));

    const range = panel.querySelector('input[type=range]'), rv = panel.querySelector('.rv');
    const showRatio = () => { rv.textContent = `A ${Math.round((1 - mix.ratio) * 100)} : B ${Math.round(mix.ratio * 100)}`; };
    range.value = String(Math.round(mix.ratio * 100));
    showRatio();
    range.addEventListener('input', () => { mix.ratio = Number(range.value) / 100; showRatio(); repour(); });

    evenEl = panel.querySelector('.ev');
    evenFill = panel.querySelector('.even .bar span');
    drawSlab();

    panel.querySelector('.mix-close').addEventListener('click', () => { evenEl = null; renderPick(); });
    panel.querySelector('.primary').addEventListener('click', () => {
      const n = session.customInks.length + 1;
      const ink = makeMixedInk({
        id: 'mix-' + n, name: '自調 ' + n,
        a: mix.a, b: mix.b, ratio: mix.ratio, evenness: mixer.evenness
      });
      session.customInks.push(ink);
      session.inks[active] = ink;
      evenEl = null;
      renderPick();
      repour();
    });
  }

  // 攪拌
  let last = null;
  const toUnit = e => {
    const r = slab.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  slab.addEventListener('pointerdown', e => { last = toUnit(e); slab.setPointerCapture(e.pointerId); });
  slab.addEventListener('pointermove', e => {
    if (!last) return;
    const p = toUnit(e);
    mixer.stir(last[0], last[1], p[0], p[1]);
    last = p;
    drawSlab();
  });
  const up = () => { last = null; };
  slab.addEventListener('pointerup', up);
  slab.addEventListener('pointercancel', up);

  repour();
  renderPick();

  return {
    destroy() { root.innerHTML = ''; },
    get mode() { return mode; }
  };
}
