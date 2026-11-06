import { S, PW } from '../../engine/geometry.js';
import { prepare, computeLayers, defaultModes, suggestInks } from '../../engine/separate.js';
import { flatComposite } from '../../engine/flat.js';
import { PALETTE } from '../../inks.js';
import { designToSheet, sheetMaskWithMarks, plateFromDesignMask } from '../../plates/registration.js';
import { screenCanvas, maskCanvas, drawScreen, MESH } from './screen.js';

// 製版：選色數、自動分色、調各層門檻；然後曬版、沖水。
//   image：提供圖片站傳來的圖 { id, name, colors, canvas, data, w, h }
//   state：這張圖的製版設定，在各站之間保留 { n, cov, modes, dot, view, active }
//     modes 各層「實色 / 網點」；dot 網點大小；cov 實色時為門檻，網點時為濃淡
//   onDone({ plates, inks })：做好的版與建議墨色
//   onBack：回到提供圖片
const PAPER = [245, 240, 230];
const FILM = [26, 26, 26];
const EXPOSE_MS = 1000, WASH_MS = 1500;
const two = n => String(n).padStart(2, '0');
const css = rgb => `rgb(${rgb.join(',')})`;

export function mountPlates(root, { image, state, onDone, onBack }) {
  const stage = document.createElement('section');
  stage.className = 'stage';
  stage.innerHTML = `<div class="sheet"><canvas class="paper" width="${PW}" height="${PW}"></canvas></div>`;
  root.appendChild(stage);
  const sheet = stage.querySelector('.sheet'), cv = stage.querySelector('.paper'), ctx = cv.getContext('2d');
  const panel = document.createElement('aside');
  panel.className = 'panel plates-panel';
  root.appendChild(panel);
  const img = ctx.createImageData(PW, PW);

  /* ───────── 分色 ───────── */
  const preps = new Map();
  let prep, masks, inks, raf = 0, alive = true;

  // 圖庫作品本來就是一層一層畫的：直接用它的各層與墨，不用分色
  const fixed = !!image.layers;

  function analyse() {
    if (fixed) {
      masks = image.layers;
      inks = image.inks;
      state.active = Math.min(state.active || 0, masks.length - 1);
      paint();
      return;
    }
    if (!preps.has(state.n)) preps.set(state.n, prepare(image, state.n));
    prep = preps.get(state.n);
    const k = prep.centers.length;
    if (!state.cov || state.cov.length !== k) state.cov = new Array(k).fill(0.5);
    if (!state.modes || state.modes.length !== k) state.modes = defaultModes(prep);   // 有漸層的層預設用網點
    state.dot = state.dot || 'medium';
    state.active = Math.min(state.active || 0, k - 1);
    inks = suggestInks(prep, PALETTE);
    separateNow();
  }
  function separateNow() {
    if (!fixed) masks = computeLayers(prep, state);
    paint();
  }
  function paint() {
    if (state.view === 'single') {
      const m = sheetMaskWithMarks(masks[state.active]);
      flatComposite([m], [FILM], [250, 249, 246], img.data);
    } else {
      flatComposite(masks.map(designToSheet), inks.map(i => i.rgb), PAPER, img.data);
    }
    ctx.putImageData(img, 0, 0);
  }
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; if (alive) separateNow(); });
  };

  function renderSeparate() {
    sheet.style.background = '';
    sheet.classList.remove('bare');
    panel.innerHTML = `
      <h1>製版</h1>
      <div class="field count-field">
        <span class="label">色數</span>
        <div class="seg" role="radiogroup" aria-label="色數"></div>
      </div>
      <div class="field">
        <span class="label">檢視</span>
        <div class="seg view" role="radiogroup" aria-label="檢視"></div>
      </div>
      <div class="field dots-field" hidden>
        <span class="label">網點</span>
        <div class="seg dots" role="radiogroup" aria-label="網點大小"></div>
      </div>
      <div class="sep-layers"></div>
      <button class="primary" type="button">曬版</button>
      <div class="foot"><button class="text back" type="button" hidden>換圖片</button></div>`;
    if (onBack) {
      const back = panel.querySelector('.back');
      back.hidden = false;
      back.addEventListener('click', onBack);
    }

    const seg = (el, items, current, onPick) => {
      for (const [value, label] of items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(value === current));
        b.textContent = label;
        b.addEventListener('click', () => onPick(value));
        el.appendChild(b);
      }
    };
    seg(panel.querySelector('.seg:not(.view):not(.dots)'), [[1, '1'], [2, '2'], [3, '3'], [4, '4']], state.n, v => {
      if (v === state.n) return;
      state.n = v; state.cov = null; state.modes = null; state.active = 0;
      analyse(); renderSeparate();
    });
    seg(panel.querySelector('.seg.view'), [['stack', '疊色'], ['single', '單版']], state.view, v => {
      state.view = v; paint(); renderSeparate();
    });
    // 圖庫作品：層數與印法已經決定好，只保留檢視切換
    panel.querySelector('.count-field').hidden = fixed;
    panel.querySelector('.dots-field').hidden = fixed || !state.modes.includes('dots');
    seg(panel.querySelector('.seg.dots'), [['coarse', '粗'], ['medium', '中'], ['fine', '細']], state.dot, v => {
      state.dot = v; separateNow(); renderSeparate();
    });

    const layersEl = panel.querySelector('.sep-layers');
    inks.forEach((ink, i) => {
      const row = document.createElement('div');
      const dots = !fixed && state.modes[i] === 'dots';
      row.className = 'sep-row' + (i === state.active ? ' on' : '');
      row.innerHTML = `
        <div class="sep-top">
          <button class="sep-head" type="button">
            <span class="sw"></span><span class="nm">第 ${i + 1} 層</span><span class="ink"></span>
          </button>
          <div class="seg mini" role="radiogroup" aria-label="第 ${i + 1} 層印法"></div>
        </div>
        <input type="range" min="0" max="100" step="1" aria-label="第 ${i + 1} 層${dots ? '濃淡' : '門檻'}">
        <div class="scale"><span>${dots ? '淺' : '少'}</span><span>${dots ? '深' : '多'}</span></div>`;
      row.querySelector('.sw').style.background = css(ink.rgb);
      row.querySelector('.ink').textContent = ink.name;
      if (fixed) {
        row.querySelector('.seg.mini').remove();
        row.querySelector('input').remove();
        row.querySelector('.scale').remove();
        row.querySelector('.sep-head').addEventListener('click', () => {
          state.active = i;
          if (state.view === 'single') paint();
          renderSeparate();
        });
        layersEl.appendChild(row);
        return;
      }
      seg(row.querySelector('.seg.mini'), [['solid', '實色'], ['dots', '網點']], state.modes[i], v => {
        if (state.modes[i] === v) return;
        state.modes[i] = v; state.active = i;
        separateNow(); renderSeparate();
      });
      row.querySelector('.sep-head').addEventListener('click', () => {
        state.active = i;
        if (state.view === 'single') paint();
        renderSeparate();
      });
      const range = row.querySelector('input');
      range.value = String(Math.round(state.cov[i] * 100));
      range.addEventListener('input', () => {
        state.cov[i] = Number(range.value) / 100;
        if (state.active !== i) {
          state.active = i;
          for (const r of layersEl.children) r.classList.toggle('on', r === row);
        }
        schedule();
      });
      layersEl.appendChild(row);
    });

    panel.querySelector('.primary').addEventListener('click', startBurn);
  }

  /* ───────── 曬版、沖水 ───────── */
  let burn = null;

  function startBurn() {
    const plates = masks.map(plateFromDesignMask);
    const sheetMasks = plates.map(p => p.m);
    burn = {
      plates, i: 0, step: 'expose', anim: null,
      raw: sheetMasks.map(m => screenCanvas(m, false)),
      washed: sheetMasks.map(m => screenCanvas(m, true)),
      film: sheetMasks.map(m => maskCanvas(m, FILM, 0.92)),
      latent: sheetMasks.map(m => maskCanvas(m, [20, 40, 44], 0.18))
    };
    sheet.style.background = 'var(--bg)';
    sheet.classList.add('bare');
    renderBurn();
    drawBurn(0);
  }

  function renderBurn() {
    const n = burn.plates.length, cur = burn.step === 'expose' ? 0 : 1;
    panel.innerHTML = `
      <h1>曬版</h1>
      <div class="layer">
        <div class="layer-num"><span>${two(burn.i + 1)}</span><small>/ ${two(n)}</small></div>
      </div>
      <ol class="steps">
        <li class="${cur === 0 ? 'now' : 'done'}"><span class="n">01</span><span>曝光</span></li>
        <li class="${cur === 1 ? 'now' : ''}"><span class="n">02</span><span>沖水</span></li>
      </ol>
      <div class="act">
        <p class="hint"></p>
        <button class="primary" type="button"></button>
      </div>`;
    const hint = panel.querySelector('.hint'), pb = panel.querySelector('.primary');
    hint.textContent = burn.step === 'expose' ? '底片蓋在塗好感光乳劑的網框上。' : '光照不到的地方還沒硬化，用水沖掉。';
    pb.textContent = burn.step === 'expose' ? '曝光' : '沖水';
    pb.disabled = !!burn.anim;
    pb.addEventListener('click', () => {
      if (burn.anim) return;
      burn.anim = { step: burn.step, t0: performance.now() };
      pb.disabled = true;
      tick();
    });
  }

  function tick() {
    if (!alive || !burn || !burn.anim) return;
    const { step, t0 } = burn.anim;
    const p = Math.min(1, (performance.now() - t0) / (step === 'expose' ? EXPOSE_MS : WASH_MS));
    drawBurn(p);
    if (p < 1) { requestAnimationFrame(tick); return; }
    burn.anim = null;
    if (step === 'expose') { burn.step = 'wash'; drawBurn(0); renderBurn(); return; }
    if (burn.i < burn.plates.length - 1) {
      burn.i++; burn.step = 'expose';
      setTimeout(() => { if (!alive) return; drawBurn(0); renderBurn(); }, 450);
      return;
    }
    setTimeout(() => { if (alive) onDone({ plates: burn.plates, inks: inks.slice() }); }, 650);
  }

  // 畫目前這一版的曬版狀態；p 為動畫進度
  function drawBurn(p) {
    const i = burn.i;
    ctx.clearRect(0, 0, PW, PW);
    const mx = MESH.x * S, my = MESH.y * S, mw = MESH.w * S, mh = MESH.h * S;
    if (burn.step === 'expose') {
      drawScreen(ctx, burn.raw[i]);
      ctx.drawImage(burn.film[i], 0, 0);
      if (burn.anim) {
        // 一道光由左向右掃過
        const x = mx - 260 + (mw + 520) * p;
        const g = ctx.createLinearGradient(x - 260, 0, x + 260, 0);
        g.addColorStop(0, 'rgba(255,255,250,0)');
        g.addColorStop(0.5, 'rgba(255,255,250,0.55)');
        g.addColorStop(1, 'rgba(255,255,250,0)');
        ctx.fillStyle = g;
        ctx.fillRect(mx, my, mw, mh);
      }
    } else {
      // 底片已拿開，隱約看得到潛影；水線往下，沖過的地方露出網布
      drawScreen(ctx, burn.raw[i]);
      ctx.drawImage(burn.latent[i], 0, 0);
      const wy = my + mh * p;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, PW, wy); ctx.clip();
      drawScreen(ctx, burn.washed[i]);
      ctx.restore();
      if (burn.anim && p < 1) {
        const g = ctx.createLinearGradient(0, wy - 70, 0, wy + 10);
        g.addColorStop(0, 'rgba(170, 214, 236, 0)');
        g.addColorStop(0.85, 'rgba(170, 214, 236, 0.55)');
        g.addColorStop(1, 'rgba(170, 214, 236, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(mx, wy - 70, mw, 80);
      }
    }
  }

  analyse();
  renderSeparate();

  return {
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      root.innerHTML = '';
    }
  };
}
