// DOM helpers, canvas helpers and the shared SVG icon set.

// Photos are 800 × 600 or 600 × 800 (PW × PH), locked from the screen orientation when a booth is entered.
export const $ = (id) => document.getElementById(id),
  clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  rand = (a, b) => a + Math.random() * (b - a),
  pick = (list) => list[Math.floor(Math.random() * list.length)];

// One 24 × 24 icon set: filled shapes double as canvas paths, the rest are strokes.
export const SHAPES = {
  heart:
    "M12 20.5C6 16.6 2.5 13.2 2.5 9 2.5 6.2 4.6 4 7.3 4c2 0 3.6 1.1 4.7 2.8C13.1 5.1 14.7 4 16.7 4c2.7 0 4.8 2.2 4.8 5 0 4.2-3.5 7.6-9.5 11.5z",
  star: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z",
  spark: "M12 1Q13 11 23 12Q13 13 12 23Q11 13 1 12Q11 11 12 1Z",
};

export const ICONS = {
  heart: `<path fill="currentColor" d="${SHAPES.heart}"/>`,
  star: `<path fill="currentColor" d="${SHAPES.star}"/>`,
  spark: `<path fill="currentColor" d="${SHAPES.spark}"/>`,
  "chevron-left": '<path d="M15 5l-7 7 7 7"/>',
  "chevron-right": '<path d="M9 5l7 7-7 7"/>',
  flip: '<path d="M19.5 9A8 8 0 0 0 5.2 7.2M4.5 15a8 8 0 0 0 14.3 1.8"/><path d="M19.5 3.5V9H14M4.5 20.5V15H10"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10M9.5 2.5h5M18 6.5l1.6-1.6"/>',
  infinity:
    '<path d="M12 12c-2-2.6-3.6-3.9-5.5-3.9a3.9 3.9 0 0 0 0 7.8c1.9 0 3.5-1.3 5.5-3.9 2 2.6 3.6 3.9 5.5 3.9a3.9 3.9 0 0 0 0-7.8c-1.9 0-3.5 1.3-5.5 3.9z"/>',
  wave: '<path d="M2.5 15c2.4-6 4.6-6 6.3-.5s4 5.5 6.4 0 4.4-5.5 6.3.5"/>',
  rainbow: '<path d="M2.5 18a9.5 9.5 0 0 1 19 0M6.5 18a5.5 5.5 0 0 1 11 0M10.2 18a1.8 1.8 0 0 1 3.6 0"/>',
  rotate: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 3.8v4.4h-4.4"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2l.9-12.2M10.2 10.5v5.5M13.8 10.5v5.5"/>',
  cursor: '<path fill="currentColor" stroke-width="1.4" d="M5.5 3.5l13 7.6-5.6 1.2 3.3 6.1-2.5 1.3-3.3-6.1-4.4 3.9z"/>',
  tilt: '<rect x="7.6" y="3.6" width="8.8" height="16.8" rx="2" transform="rotate(-14 12 12)"/><path d="M2.8 9a9.5 9.5 0 0 0 0 6M21.2 9a9.5 9.5 0 0 1 0 6"/>',
  eraser:
    '<path d="M8.5 20h11M4.4 14.4l9.2-9.2a2 2 0 0 1 2.8 0l3.4 3.4a2 2 0 0 1 0 2.8L12 19.2a2.6 2.6 0 0 1-1.8.8H8.4a2.6 2.6 0 0 1-1.8-.8l-2.2-2.2a1.8 1.8 0 0 1 0-2.6z"/><path d="M9.4 9.4l5.2 5.2"/>',
  dots: '<g fill="currentColor" stroke="none"><circle cx="7" cy="7" r="2.6"/><circle cx="17" cy="9" r="2"/><circle cx="9" cy="17" r="2"/><circle cx="17.5" cy="17.5" r="2.8"/></g>',
};

export const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export function drawShape(c, name, x, y, size, color) {
  c.save();
  c.translate(x, y);
  c.scale(size / 24, size / 24);
  c.translate(-12, -12);
  c.fillStyle = color;
  c.fill(new Path2D(SHAPES[name]));
  c.restore();
}

export const status = (t) => ($("status").textContent = t);

export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

export function cropDraw(c, img, x, y, w, h) {
  const sw = img.videoWidth || img.naturalWidth || img.width,
    sh = img.videoHeight || img.naturalHeight || img.height;
  if (!sw || !sh) return;
  let cw = sw,
    ch = sh;
  if (sw / sh > w / h) cw = (sh * w) / h;
  else ch = (sw * h) / w;
  c.drawImage(img, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, w, h);
}

export function initUtil() {
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(ICONS)
      .map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`)
      .join("")}</svg>`,
  );
}
