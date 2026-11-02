// Pens, pattern wallpapers, the eraser and drawing a photo's stamps and strokes in order.
import { THEMES } from "./data/themes.js";
import { drawStamp } from "./stamps.js";
import { state } from "./state.js";
import { drawShape, makeCanvas } from "./util.js";

/* =========================
   印章與塗鴉筆刷
========================= */
export function paintStroke(c, points) {
  c.beginPath();
  if (points.length === 1) {
    c.arc(points[0].x, points[0].y, c.lineWidth / 2, 0, Math.PI * 2);
    c.fill();
  } else {
    points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
  }
}

// Pattern pens reveal a fixed wallpaper: the stroke is only the mask that shows it.
export const wallpapers = new Map(),
  maskLayer = makeCanvas(800, 600);

export function wallpaper(kind, color) {
  const key = kind + state.theme + color + state.PW;
  if (wallpapers.has(key)) return wallpapers.get(key);
  const w = makeCanvas(state.PW, state.PH),
    c = w.getContext("2d"),
    t = THEMES[state.theme],
    n = parseInt(color.slice(1), 16),
    light = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 200,
    base = light ? t.accent : paleTint(color, 0.8),
    ink = color;
  if (kind === "rainbow") {
    const g = c.createLinearGradient(0, 0, state.PW, state.PH);
    for (let i = 0; i <= 12; i++) g.addColorStop(i / 12, "hsl(" + ((i * 60) % 360) + " 95% 66%)");
    c.fillStyle = g;
    c.fillRect(0, 0, state.PW, state.PH);
  } else {
    c.fillStyle = base;
    c.fillRect(0, 0, state.PW, state.PH);
    const step = kind === "dots" ? 40 : 56;
    for (let row = 0, y = 0; y < state.PH + step; y += step / 2, row++)
      for (let x = row % 2 ? step / 2 : 0; x < state.PW + step; x += step) {
        if (kind === "dots") {
          c.fillStyle = ink;
          c.beginPath();
          c.arc(x, y, 7, 0, Math.PI * 2);
          c.fill();
        } else drawShape(c, "heart", x, y, 20, row % 4 < 2 ? ink : t.secondary);
      }
  }
  if (wallpapers.size > 24) wallpapers.clear();
  wallpapers.set(key, w);
  return w;
}

export function paintPattern(c, o) {
  const m = maskLayer.getContext("2d");
  m.globalCompositeOperation = "source-over";
  m.clearRect(0, 0, state.PW, state.PH);
  m.lineCap = "round";
  m.lineJoin = "round";
  m.lineWidth = o.width;
  m.strokeStyle = m.fillStyle = "#000";
  paintStroke(m, o.points);
  m.globalCompositeOperation = "source-in";
  m.drawImage(wallpaper(o.brush, o.color), 0, 0);
  c.drawImage(maskLayer, 0, 0);
}

export const GLOW_COLORS = ["#ff3d9a", "#c43dff", "#4d6bff", "#13b8e8", "#22c26a", "#ffab1a", "#ff4f4f"];

export function paleTint(hex, amount = 0.86) {
  const n = parseInt(hex.slice(1), 16),
    mix = (v) => Math.round(v + (255 - v) * amount);
  return "rgb(" + mix((n >> 16) & 255) + "," + mix((n >> 8) & 255) + "," + mix(n & 255) + ")";
}

export const doodleLayer = makeCanvas(800, 600);

// Stamps and pen strokes stack in the order they were made, so a new stamp can sit on an earlier doodle; the eraser only ever removes pen strokes.
export function eraseStroke(d, o) {
  d.save();
  d.globalCompositeOperation = "destination-out";
  d.lineCap = d.lineJoin = "round";
  d.lineWidth = o.width;
  d.strokeStyle = d.fillStyle = "#000";
  paintStroke(d, o.points);
  d.restore();
}

export function drawDecorations(c, list) {
  for (let i = 0; i < list.length;) {
    if (list[i].type === "stamp") {
      drawObject(c, list[i++]);
      continue;
    }
    // A run of strokes between stamps shares one layer. Every eraser stroke made later also applies to it, so the
    // eraser still reaches ink under a newer stamp without ever touching the stamp itself.
    const d = doodleLayer.getContext("2d");
    d.clearRect(0, 0, state.PW, state.PH);
    let j = i;
    for (; j < list.length && list[j].type !== "stamp"; j++)
      if (list[j].brush === "eraser") eraseStroke(d, list[j]);
      else drawObject(d, list[j]);
    for (let k = j; k < list.length; k++) if (list[k].brush === "eraser") eraseStroke(d, list[k]);
    c.drawImage(doodleLayer, 0, 0);
    i = j;
  }
}

export function drawObject(c, o) {
  if (o.type === "stamp") {
    drawStamp(c, o.key, o.x, o.y, o.size, o.rotation);
    return;
  }
  if (o.type !== "stroke" || !o.points.length) return;
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.lineWidth = o.width;
  if (o.brush === "glow") {
    // Neon-pen look: the halo carries the colour, the core stays almost white.
    if (o.color === "rainbow") {
      // Rainbow glow: white halo around a rainbow core.
      c.strokeStyle = c.fillStyle = c.shadowColor = "#fff";
      c.shadowBlur = Math.max(18, o.width * 2.4);
      c.globalAlpha = 0.9;
      c.lineWidth = o.width * 1.15;
      paintStroke(c, o.points);
      c.shadowBlur = Math.max(8, o.width * 0.9);
      c.globalAlpha = 1;
      c.lineWidth = o.width;
      paintStroke(c, o.points);
      c.shadowBlur = 0;
      paintPattern(c, { ...o, brush: "rainbow", width: o.width * 0.62 });
      c.restore();
      return;
    }
    const core = paleTint(o.color);
    c.strokeStyle = o.color;
    c.fillStyle = o.color;
    c.shadowColor = o.color;
    c.shadowBlur = Math.max(18, o.width * 2.4);
    c.globalAlpha = 0.85;
    c.lineWidth = o.width * 1.15;
    paintStroke(c, o.points);
    c.shadowBlur = Math.max(8, o.width * 0.9);
    c.globalAlpha = 1;
    c.lineWidth = o.width;
    paintStroke(c, o.points);
    c.shadowBlur = Math.max(3, o.width * 0.35);
    c.shadowColor = core;
    c.strokeStyle = core;
    c.fillStyle = core;
    c.lineWidth = o.width * 0.62;
    paintStroke(c, o.points);
  } else if (["rainbow", "dots", "hearts"].includes(o.brush)) paintPattern(c, o);
  else {
    c.strokeStyle = o.color;
    c.fillStyle = o.color;
    paintStroke(c, o.points);
  }
  c.restore();
}
