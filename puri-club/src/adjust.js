// The 調整 tool: select, move, scale and rotate placed stamps.
import { THEMES } from "./data/themes.js";
import { canEdit, objects, point, queueEditorRender, remember, renderEditor } from "./editor.js";
import { stampDims, stampImage } from "./stamps.js";
import { editCanvas, state } from "./state.js";
import { $, clamp, makeCanvas, roundRect } from "./util.js";

/* =========================
   調整 tool: select, move, scale and rotate placed stamps
========================= */
export const ADJUST_MIN = 36,
  ADJUST_MAX = 620,
  QUARTER = Math.PI / 2,
  SNAP_RANGE = (6 * Math.PI) / 180;

export const adjustPointers = new Map(),
  stampMasks = new Map();

export const normAngle = (r) => r - 2 * Math.PI * Math.round(r / (2 * Math.PI));

export function canvasScale() {
  return state.PW / (editCanvas.getBoundingClientRect().width || state.PW);
}

export function selectedStamp() {
  return state.selectedId === null
    ? null
    : objects().find((o) => o.id === state.selectedId && o.type === "stamp") || null;
}

export function toLocal(o, p) {
  const dx = p.x - o.x,
    dy = p.y - o.y,
    cos = Math.cos(o.rotation),
    sin = Math.sin(o.rotation);
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

export function toCanvas(o, x, y) {
  const cos = Math.cos(o.rotation),
    sin = Math.sin(o.rotation);
  return { x: o.x + x * cos - y * sin, y: o.y + x * sin + y * cos };
}

// A 64 px alpha copy of each stamp lets taps on transparent corners fall through to the stamp underneath.
export function stampMask(key) {
  if (stampMasks.has(key)) return stampMasks.get(key);
  const img = stampImage(key);
  if (!img.naturalWidth) return null;
  const k = 64 / Math.max(img.naturalWidth, img.naturalHeight),
    w = Math.max(1, Math.round(img.naturalWidth * k)),
    h = Math.max(1, Math.round(img.naturalHeight * k)),
    c = makeCanvas(w, h).getContext("2d", { willReadFrequently: true });
  c.drawImage(img, 0, 0, w, h);
  const mask = { w, h, a: c.getImageData(0, 0, w, h).data };
  stampMasks.set(key, mask);
  return mask;
}

export function hitStamp(p) {
  const stamps = objects().filter((o) => o.type === "stamp");
  let fallback = null;
  for (let i = stamps.length - 1; i >= 0; i--) {
    const o = stamps[i],
      { w, h } = stampDims(o.key, o.size),
      l = toLocal(o, p);
    if (Math.abs(l.x) > w / 2 || Math.abs(l.y) > h / 2) continue;
    fallback ??= o;
    const m = stampMask(o.key);
    if (!m) return o;
    const mx = Math.floor((l.x / w + 0.5) * m.w),
      my = Math.floor((l.y / h + 0.5) * m.h);
    for (let y = my - 2; y <= my + 2; y++)
      for (let x = mx - 2; x <= mx + 2; x++)
        if (x >= 0 && y >= 0 && x < m.w && y < m.h && m.a[(y * m.w + x) * 4 + 3] > 40) return o;
  }
  return fallback;
}

export function selectionPad() {
  return 7 * canvasScale();
}

export function handlePoint(o) {
  const { w, h } = stampDims(o.key, o.size),
    pad = selectionPad();
  return toCanvas(o, w / 2 + pad, h / 2 + pad);
}

export function nearHandle(o, p) {
  const hp = handlePoint(o);
  return Math.hypot(p.x - hp.x, p.y - hp.y) < 24 * canvasScale();
}

// Rotation snaps to the nearest quarter turn within 6°; Shift keeps any angle.
export function applyRotation(g, r, free) {
  const near = Math.round(r / QUARTER) * QUARTER,
    snapped = !free && Math.abs(r - near) < SNAP_RANGE;
  g.o.rotation = normAngle(snapped ? near : r);
  if (snapped && !g.snapped) navigator.vibrate?.(8);
  g.snapped = snapped;
}

export function touchGesture(g) {
  if (!g.changed) {
    remember();
    g.changed = true;
    delete g.o.magic;
  }
}

export function adjustDown(e) {
  e.preventDefault();
  const p = point(e);
  try {
    editCanvas.setPointerCapture(e.pointerId);
  } catch (err) {}
  adjustPointers.set(e.pointerId, p);
  const o = selectedStamp();
  if (adjustPointers.size === 2) {
    if (!o) return;
    const [a, b] = [...adjustPointers.values()];
    state.gesture = {
      adjust: true,
      mode: "pinch",
      o,
      start: { x: o.x, y: o.y, size: o.size, rotation: o.rotation },
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      changed: state.gesture?.changed || false,
      snapped: false,
    };
    queueEditorRender();
    return;
  }
  if (adjustPointers.size > 2) return;
  if (o && nearHandle(o, p)) {
    state.gesture = {
      adjust: true,
      mode: "handle",
      id: e.pointerId,
      o,
      start: { size: o.size, rotation: o.rotation },
      d0: Math.hypot(p.x - o.x, p.y - o.y) || 1,
      a0: Math.atan2(p.y - o.y, p.x - o.x),
      changed: false,
      snapped: false,
    };
    queueEditorRender();
    return;
  }
  const hit = hitStamp(p);
  state.selectedId = hit ? hit.id : null;
  state.gesture = hit
    ? {
        adjust: true,
        mode: "move",
        id: e.pointerId,
        o: hit,
        offset: { x: p.x - hit.x, y: p.y - hit.y },
        changed: false,
      }
    : null;
  renderEditor();
}

export function adjustMove(e) {
  if (!canEdit()) return;
  const p = point(e),
    g = state.gesture?.adjust ? state.gesture : null;
  if (!g) {
    if (e.pointerType === "mouse" && !adjustPointers.size) {
      const o = selectedStamp();
      editCanvas.style.cursor = o && nearHandle(o, p) ? "nwse-resize" : hitStamp(p) ? "move" : "";
    }
    return;
  }
  if (!adjustPointers.has(e.pointerId)) return;
  adjustPointers.set(e.pointerId, p);
  const o = g.o;
  if (g.mode === "move" && e.pointerId === g.id) {
    touchGesture(g);
    o.x = clamp(p.x - g.offset.x, 0, state.PW);
    o.y = clamp(p.y - g.offset.y, 0, state.PH);
  } else if (g.mode === "handle" && e.pointerId === g.id) {
    touchGesture(g);
    o.size = Math.round(clamp((g.start.size * Math.hypot(p.x - o.x, p.y - o.y)) / g.d0, ADJUST_MIN, ADJUST_MAX));
    applyRotation(g, g.start.rotation + Math.atan2(p.y - o.y, p.x - o.x) - g.a0, e.shiftKey);
  } else if (g.mode === "pinch") {
    const [a, b] = [...adjustPointers.values()];
    if (!b) return;
    touchGesture(g);
    o.x = clamp(g.start.x + (a.x + b.x) / 2 - g.mid.x, 0, state.PW);
    o.y = clamp(g.start.y + (a.y + b.y) / 2 - g.mid.y, 0, state.PH);
    o.size = Math.round(clamp((g.start.size * Math.hypot(b.x - a.x, b.y - a.y)) / g.dist, ADJUST_MIN, ADJUST_MAX));
    applyRotation(g, g.start.rotation + Math.atan2(b.y - a.y, b.x - a.x) - g.angle, false);
  } else return;
  queueEditorRender();
}

export function adjustUp(e) {
  if (!adjustPointers.delete(e.pointerId)) return;
  if (state.gesture?.adjust && (state.gesture.mode === "pinch" || state.gesture.id === e.pointerId)) {
    state.gesture = null;
    renderEditor();
  }
}

// Outline, corner handle and angle badge are drawn on the editor only, never into the printed photo.
export function drawSelection(c) {
  const o = state.tool === "adjust" && !state.editLocked ? selectedStamp() : null;
  placeStampActions(o);
  if (!o) return;
  const { w, h } = stampDims(o.key, o.size),
    s = canvasScale(),
    pad = selectionPad(),
    snapped = state.gesture?.adjust && state.gesture.snapped,
    accent = THEMES[state.theme].accent;
  c.save();
  c.translate(o.x, o.y);
  c.rotate(o.rotation);
  c.lineWidth = 3.5 * s;
  c.strokeStyle = "#2a1530";
  c.strokeRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
  c.lineWidth = 2 * s;
  c.setLineDash([8 * s, 6 * s]);
  c.strokeStyle = snapped ? accent : "#fff";
  c.strokeRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
  c.restore();
  const hp = handlePoint(o);
  c.save();
  c.beginPath();
  c.arc(hp.x, hp.y, 12 * s, 0, Math.PI * 2);
  c.fillStyle = "#fff";
  c.fill();
  c.lineWidth = 3 * s;
  c.strokeStyle = "#2a1530";
  c.stroke();
  c.beginPath();
  c.arc(hp.x, hp.y, 5 * s, 0, Math.PI * 2);
  c.fillStyle = accent;
  c.fill();
  c.restore();
  if (state.gesture?.adjust && state.gesture.mode !== "move") {
    const deg = Math.round(((((o.rotation * 180) / Math.PI) % 360) + 360) % 360) % 360,
      label = deg + "°";
    c.save();
    c.font = "900 " + Math.round(15 * s) + "px monospace";
    const tw = c.measureText(label).width,
      bx = clamp(o.x, tw / 2 + 14 * s, state.PW - tw / 2 - 14 * s),
      by = clamp(o.y - h / 2 - pad - 24 * s, 18 * s, state.PH - 18 * s);
    roundRect(c, bx - tw / 2 - 10 * s, by - 13 * s, tw + 20 * s, 26 * s, 13 * s);
    c.fillStyle = snapped ? accent : "#2a1530e6";
    c.fill();
    c.fillStyle = "#fff";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(label, bx, by + 1 * s);
    c.restore();
  }
}

export function placeStampActions(o) {
  const bar = $("stampActions");
  if (!o || state.gesture?.adjust || state.editLocked) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const { w, h } = stampDims(o.key, o.size),
    pad = selectionPad(),
    ys = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sy]) => toCanvas(o, sx * (w / 2 + pad), sy * (h / 2 + pad)).y),
    cr = editCanvas.getBoundingClientRect(),
    wr = bar.parentElement.getBoundingClientRect(),
    k = cr.width / state.PW,
    bw = bar.offsetWidth,
    bh = bar.offsetHeight,
    top = cr.top - wr.top + Math.min(...ys) * k - 8,
    below = top - bh < 4;
  bar.classList.toggle("below", below);
  bar.style.left = clamp(cr.left - wr.left + o.x * k, bw / 2 + 4, wr.width - bw / 2 - 4) + "px";
  bar.style.top = (below ? Math.min(cr.top - wr.top + Math.max(...ys) * k + 8, wr.height - bh - 4) : top) + "px";
}

export function deleteSelectedStamp() {
  const o = selectedStamp();
  if (!canEdit() || !o) return;
  remember();
  state.decorations[state.activePhoto] = objects().filter((x) => x !== o);
  state.selectedId = null;
  renderEditor();
}

export function initAdjust() {
  $("rotate90").onclick = () => {
    const o = selectedStamp();
    if (!canEdit() || !o) return;
    remember();
    delete o.magic;
    o.rotation = normAngle(Math.round(o.rotation / QUARTER) * QUARTER + QUARTER);
    renderEditor();
  };
  $("deleteStamp").onclick = deleteSelectedStamp;
}
