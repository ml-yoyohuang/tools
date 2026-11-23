// Slider and segmented control. Pointer Events → one code path for mouse, pen and touch.

const h = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

function onDoubleTap(el, fn) {
  let last = 0;
  el.addEventListener('pointerup', (e) => {
    const now = e.timeStamp;
    if (now - last < 320) { fn(); last = 0; } else last = now;
  });
}

const fmt = (v, min) => (min < 0 && v > 0 ? `+${v}` : `${v}`);

export function slider({ label, min, max, step = 1, value, def = 0, suffix = '', onInput }) {
  const root = h('div', 'ctl');
  const head = h('div', 'ctl-head');
  const name = h('span', 'ctl-name', label);
  const val = h('span', 'ctl-val');
  head.append(name, val);
  const track = h('div', 'track');
  track.tabIndex = 0;
  track.setAttribute('role', 'slider');
  track.setAttribute('aria-label', label);
  track.setAttribute('aria-valuemin', min);
  track.setAttribute('aria-valuemax', max);
  const fill = h('span', 'fill');
  const thumb = h('span', 'thumb');
  if (min < 0 && max > 0) track.append(h('span', 'zero'));
  track.append(fill, thumb);
  root.append(head, track);

  let v = value;
  const pos = (x) => (x - min) / (max - min);
  const origin = min < 0 && max > 0 ? pos(0) : 0;
  function paint() {
    const t = pos(v);
    thumb.style.left = `${t * 100}%`;
    const a = Math.min(t, origin), b = Math.max(t, origin);
    fill.style.left = `${a * 100}%`;
    fill.style.width = `${(b - a) * 100}%`;
    val.textContent = fmt(v, min) + suffix;
    root.classList.toggle('changed', v !== def);
    track.setAttribute('aria-valuenow', v);
  }
  function set(nv, emit) {
    nv = Math.min(max, Math.max(min, Math.round(nv / step) * step));
    if (nv === v) return;
    v = nv;
    paint();
    if (emit) onInput(v);
  }
  function fromX(clientX) {
    const r = track.getBoundingClientRect();
    set(min + ((clientX - r.left) / r.width) * (max - min), true);
  }

  let dragging = false, startX = 0, startY = 0, decided = false;
  track.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    dragging = true; decided = e.pointerType !== 'touch';
    startX = e.clientX; startY = e.clientY;
    track.setPointerCapture(e.pointerId);
    if (decided) { track.classList.add('active'); fromX(e.clientX); }
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    if (!decided) {
      const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
      if (dx < 4 && dy < 4) return;
      if (dy > dx) { dragging = false; track.releasePointerCapture(e.pointerId); return; }
      decided = true;
      track.classList.add('active');
    }
    fromX(e.clientX);
  });
  const end = (e) => {
    if (dragging && !decided && e.type === 'pointerup') fromX(e.clientX); // touch tap = jump
    dragging = false;
    track.classList.remove('active');
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('keydown', (e) => {
    const d = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[e.key];
    if (d) { e.preventDefault(); set(v + d * (e.shiftKey ? 5 : 1), true); }
    if (e.key === 'Home') set(min, true);
    if (e.key === 'End') set(max, true);
  });
  const reset = () => set(def, true);
  head.addEventListener('dblclick', reset);
  onDoubleTap(head, reset);

  paint();
  return { el: root, set: (nv) => set(nv, false), get: () => v };
}

export function segment({ label, options, value, def, onChange }) {
  const root = h('div', 'ctl');
  const head = h('div', 'ctl-head');
  head.append(h('span', 'ctl-name', label));
  const group = h('div', 'seg');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', label);
  const btns = options.map((o, i) => {
    const b = h('button', '', o);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => { set(i); onChange(i); });
    group.append(b);
    return b;
  });
  root.append(head, group);
  function set(i) {
    btns.forEach((b, j) => b.setAttribute('aria-checked', String(i === j)));
    root.classList.toggle('changed', def !== undefined && i !== def);
  }
  set(value);
  return { el: root, set };
}
