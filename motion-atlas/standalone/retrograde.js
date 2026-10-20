// Standalone diagram code lives outside the atlas registry.
import effect from './retrograde-effect';
import { PRESETS } from '../src/engine/palette';

const $ = id => document.getElementById(id);
const stage = $('stage');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const colors = ['background', 'primary', 'secondary', 'accent'];
const defaults = { ...effect.colors };
const presets = PRESETS.filter(preset => ['POP', 'COOL', 'PASTEL', 'MONO', 'STREET'].includes(preset.id));
let time = motion.matches ? 5 : 0;
let playing = !motion.matches;
let manual = false;
let runtime;
let last = 0;
let animation;
let lastWidth = 0;
let lastHeight = 0;

function syncTransport() {
  $('play').textContent = playing && !manual ? '暫停' : '播放';
  $('manual').checked = manual;
}

function syncPalette() {
  const active = presets.find(preset => colors.every(key => $(key).value.toLowerCase() === preset[key].toLowerCase()));
  $('palette-value').textContent = active?.id ?? '自訂';
  for (const button of $('presets').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.preset === active?.id));
  }
}

for (const preset of presets) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.preset = preset.id;
  button.className = 'preset';
  button.title = preset.note;
  button.setAttribute('aria-label', `${preset.id} 預設配色`);
  const swatches = document.createElement('span');
  swatches.className = 'preset-swatches';
  swatches.setAttribute('aria-hidden', 'true');
  for (const key of colors) {
    const swatch = document.createElement('i');
    swatch.style.background = preset[key];
    swatches.append(swatch);
  }
  const name = document.createElement('span');
  name.textContent = preset.id;
  button.append(swatches, name);
  button.addEventListener('click', () => {
    for (const key of colors) $(key).value = preset[key];
    syncPalette();
    rebuild();
  });
  $('presets').append(button);
}

function rebuild() {
  const box = stage.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return;
  lastWidth = box.width;
  lastHeight = box.height;
  runtime?.dispose();
  stage.replaceChildren();
  const settings = Object.fromEntries(colors.map(key => [key, $(key).value]));
  stage.style.background = settings.background;
  runtime = effect.create({
    root: stage,
    width: box.width,
    height: box.height,
    dpr: Math.min(devicePixelRatio || 1, 2),
    capture: { transparent: false },
    font: { sans: '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", system-ui, sans-serif' },
    s: {
      ...settings,
      params: {
        manual,
        progress: Number($('progress').value),
        inclination: Number($('inclination').value),
        sightline: $('sightline').checked,
        guide: $('guide').checked,
      },
    },
  });
  draw();
}

function draw() {
  runtime?.render(time, 0);
  if (!manual) $('progress').value = ((time % 10) / 10 * 100).toFixed(1);
  const p = Number($('progress').value);
  const day = Math.round((p / 100 - 0.5) * 260);
  $('progress-value').textContent = `${p.toFixed(1)}% · ${day === 0 ? '衝' : day < 0 ? `衝前 ${-day} 日` : `衝後 ${day} 日`}`;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 15) : 0;
  last = now;
  if (playing && !manual && !document.hidden) {
    time = (time + dt * Number($('speed').value)) % 10;
    draw();
  }
  animation = requestAnimationFrame(tick);
}

$('play').addEventListener('click', () => {
  if (manual) {
    time = Number($('progress').value) / 100 * 10;
    manual = false;
    playing = true;
    rebuild();
  } else playing = !playing;
  last = 0;
  syncTransport();
});
$('restart').addEventListener('click', () => {
  time = 0;
  manual = false;
  playing = true;
  last = 0;
  syncTransport();
  rebuild();
});
$('manual').addEventListener('change', () => {
  manual = $('manual').checked;
  if (!manual) time = Number($('progress').value) / 100 * 10;
  syncTransport();
  rebuild();
});
$('progress').addEventListener('input', () => {
  manual = true;
  playing = false;
  syncTransport();
  rebuild();
});
$('inclination').addEventListener('input', () => {
  $('inclination-value').textContent = `${Number($('inclination').value).toFixed(2)}°`;
  rebuild();
});
$('speed').addEventListener('input', () => {
  $('speed-value').textContent = `${Number($('speed').value).toFixed(2)}×`;
});
for (const key of colors) $(key).addEventListener('input', () => { syncPalette(); rebuild(); });
for (const key of ['sightline', 'guide']) $(key).addEventListener('input', rebuild);
$('ratio').addEventListener('change', () => {
  stage.dataset.ratio = $('ratio').value;
  requestAnimationFrame(rebuild);
});
$('reset').addEventListener('click', () => {
  for (const key of colors) $(key).value = defaults[key];
  syncPalette();
  $('inclination').value = '1.85';
  $('inclination-value').textContent = '1.85°';
  $('speed').value = '1';
  $('speed-value').textContent = '1.00×';
  $('sightline').checked = $('guide').checked = true;
  $('ratio').value = 'auto';
  stage.dataset.ratio = 'auto';
  manual = false;
  playing = !motion.matches;
  time = motion.matches ? 5 : 0;
  last = 0;
  syncTransport();
  requestAnimationFrame(rebuild);
});
$('png').addEventListener('click', () => {
  runtime?.canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'planet-retrograde.png';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    $('message').textContent = '已匯出目前畫面的 PNG。';
  }, 'image/png');
});
document.addEventListener('visibilitychange', () => { last = 0; });
motion.addEventListener('change', event => {
  if (event.matches) {
    playing = false;
    syncTransport();
  }
});
const observer = new ResizeObserver(() => {
  const box = stage.getBoundingClientRect();
  if (Math.abs(box.width - lastWidth) > 0.5 || Math.abs(box.height - lastHeight) > 0.5) rebuild();
});
observer.observe(stage);
window.addEventListener('pagehide', () => cancelAnimationFrame(animation));
window.addEventListener('pageshow', event => {
  if (event.persisted) { last = 0; animation = requestAnimationFrame(tick); }
});

$('principle').textContent = effect.principle;
for (const limit of effect.limits) {
  const item = document.createElement('li');
  item.textContent = limit;
  $('limits').append(item);
}
for (const key of colors) $(key).value = defaults[key];
syncPalette();
syncTransport();
rebuild();
animation = requestAnimationFrame(tick);
