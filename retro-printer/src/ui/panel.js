// 側欄：層數、步驟、提示、工具（速度條 / 等乾）、主要按鈕、重來與下載。
// 只負責畫面，不含流程邏輯。
export function createPanel(root, { title }) {
  const el = document.createElement('aside');
  el.className = 'panel';
  el.innerHTML = `
    <h1></h1>
    <div class="layer">
      <div class="layer-num"><span data-ref="num"></span><small data-ref="total"></small></div>
      <div class="ink-tag"><span class="swatch" data-ref="swatch"></span><span data-ref="inkName"></span></div>
    </div>
    <ol class="steps" data-ref="steps"></ol>
    <div class="act">
      <p class="hint" data-ref="hint"></p>
      <div class="tool">
        <div class="meter" data-ref="meter" hidden>
          <div class="track"><span class="zone" data-ref="zone"></span><span class="mark" data-ref="mark"></span></div>
          <div class="scale"><span>慢</span><span>快</span></div>
        </div>
        <div class="dry" data-ref="dry" hidden>
          <div class="row"><span>墨乾</span><span data-ref="dryPct">0%</span></div>
          <div class="bar"><span data-ref="dryFill"></span></div>
          <button class="ghost" data-ref="dryer" type="button">按住吹風機</button>
        </div>
      </div>
      <button class="primary" data-ref="primary" type="button"></button>
    </div>
    <div class="foot">
      <button class="text" data-ref="reset" type="button">重來</button>
      <button class="text" data-ref="download" type="button">下載 PNG</button>
    </div>`;
  el.querySelector('h1').textContent = title;
  root.appendChild(el);

  const $ = name => el.querySelector(`[data-ref="${name}"]`);
  const r = {};
  for (const n of ['num', 'total', 'swatch', 'inkName', 'steps', 'hint', 'meter', 'zone', 'mark',
    'dry', 'dryPct', 'dryFill', 'dryer', 'primary', 'reset', 'download']) r[n] = $(n);

  // 吹風機：按住才有作用
  let onDryer = () => {};
  const dryOn = e => {
    onDryer(true);
    r.dryer.classList.add('on');
    if (e.pointerId !== undefined) r.dryer.setPointerCapture(e.pointerId);
  };
  const dryOff = () => { onDryer(false); r.dryer.classList.remove('on'); };
  r.dryer.addEventListener('pointerdown', dryOn);
  r.dryer.addEventListener('pointerup', dryOff);
  r.dryer.addEventListener('pointercancel', dryOff);
  r.dryer.addEventListener('lostpointercapture', dryOff);
  r.dryer.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); dryOn(e); } });
  r.dryer.addEventListener('keyup', dryOff);
  r.dryer.addEventListener('blur', dryOff);

  const pct = v => (v * 100) + '%';
  const two = n => String(n).padStart(2, '0');

  return {
    el,
    setLayer(index, total, ink) {
      r.num.textContent = two(index + 1);
      r.total.textContent = '/ ' + two(total);
      r.inkName.textContent = ink.name;
      r.swatch.style.background = `rgb(${ink.rgb.join(',')})`;
    },
    // names：步驟名稱；current：目前步驟索引（之前的標為完成）
    setSteps(names, current) {
      r.steps.innerHTML = names.map((name, i) => {
        const cls = i < current ? 'done' : i === current ? 'now' : '';
        return `<li class="${cls}"><span class="n">${two(i + 1)}</span><span>${name}</span></li>`;
      }).join('');
    },
    setHint(text) { r.hint.textContent = text; },
    setPrimary({ label, enabled, visible }) {
      r.primary.textContent = label;
      r.primary.disabled = !enabled;
      r.primary.style.visibility = visible ? 'visible' : 'hidden';
    },
    setMeterZone(from01, to01) {
      r.zone.style.left = pct(from01);
      r.zone.style.width = pct(to01 - from01);
    },
    showMeter(on) { r.meter.hidden = !on; },
    setMeter(v01) { r.mark.style.left = pct(v01); },
    showDry(on) { r.dry.hidden = !on; },
    isDryShown() { return !r.dry.hidden; },
    setDry(dry01) {
      const p = Math.round(dry01 * 100);
      r.dryPct.textContent = p + '%';
      r.dryFill.style.width = p + '%';
    },
    setDownload(enabled) { r.download.disabled = !enabled; },
    onPrimary(fn) { r.primary.addEventListener('click', fn); },
    onReset(fn) { r.reset.addEventListener('click', fn); },
    onDownload(fn) { r.download.addEventListener('click', fn); },
    onDryer(fn) { onDryer = fn; }
  };
}
