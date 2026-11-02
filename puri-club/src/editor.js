// The decorating booth: photo tabs, stamping, pens, undo and keyboard shortcuts.
import {
  adjustDown,
  adjustMove,
  adjustPointers,
  adjustUp,
  deleteSelectedStamp,
  drawSelection,
  selectedStamp,
} from "./adjust.js";
import { selectButtons, setHurry, setStage } from "./app.js";
import { SHARED_PICTURES, SHARED_WORDS, STAMP_DIR, STAMP_SETS } from "./data/stamps.js";
import { THEMES } from "./data/themes.js";
import { GLOW_COLORS, drawDecorations } from "./decorations.js";
import { drawProcessed } from "./photo.js";
import { stampImage } from "./stamps.js";
import { EDIT_SECONDS, editCanvas, state } from "./state.js";
import { $, clamp, icon, makeCanvas, rand, status } from "./util.js";

export function objects() {
  return state.decorations[state.activePhoto];
}

export function remember() {
  state.histories[state.activePhoto].push(structuredClone(objects()));
  if (state.histories[state.activePhoto].length > 35) state.histories[state.activePhoto].shift();
  syncEditControls();
}

export function canEdit() {
  if (state.stage !== "edit" || state.editLocked) return false;
  if (state.timed && performance.now() >= state.deadline) {
    lockEditing();
    return false;
  }
  return true;
}

export function finishGesture() {
  adjustPointers.clear();
  if (state.gesture) {
    state.gesture = null;
    renderEditor();
  }
}

export function lockEditing() {
  if (state.editLocked) return;
  state.editLocked = true;
  finishGesture();
  $("clock").innerHTML = "<small>" + icon("timer") + "</small><b>0</b>";
  $("clock").setAttribute("aria-label", "裝飾時間已結束");
  $("clock").classList.remove("urgent", "final");
  setHurry(false);
  $("clock").classList.add("time-up");
  $("editCaption").textContent = "作品已保留，按「完成裝飾」繼續。";
  syncEditControls();
  renderEditor();
  status("作品已保留，按「完成裝飾」繼續。");
}

export function updateClock() {
  if (state.stage !== "edit" || state.editLocked) return;
  const seconds = !state.timed ? Infinity : Math.max(0, Math.ceil((state.deadline - performance.now()) / 1000));
  if (seconds === 0) {
    lockEditing();
    return;
  }
  $("clock").innerHTML =
    "<small>" + icon("timer") + "</small><b>" + (seconds === Infinity ? icon("infinity") : seconds) + "</b>";
  $("clock").setAttribute("aria-label", seconds === Infinity ? "不限時編輯" : "編輯剩餘 " + seconds + " 秒");
  $("clock").classList.toggle("urgent", seconds <= 15);
  $("clock").classList.toggle("final", seconds <= 10);
  setHurry(seconds <= 10);
}

export function beginEdit() {
  if (!state.photos.every(Boolean) || state.importBusy || state.running) return;
  state.finalPhotos = null;
  state.activePhoto = 0;
  state.magicTurns = [0, 0, 0, 0];
  state.editLocked = false;
  state.deadline = performance.now() + EDIT_SECONDS * 1000;
  setStage("edit");
  $("clock").classList.remove("time-up");
  $("editCaption").textContent = "DECORATE YOUR PHOTOS · STAMP & DRAW";
  buildPhotoTabs();
  setTool("stamp");
  updateClock();
  renderEditor();
  syncEditControls();
  status(!state.timed ? "慢慢裝飾，今天不限時" : "5 分鐘裝飾開始！四張各自裝飾，點縮圖切換。");
}

export function decoratedPhoto(i) {
  const c = makeCanvas(state.PW, state.PH),
    ctx = c.getContext("2d");
  drawProcessed(ctx, state.processed[i], 0, 0, state.PW, state.PH);
  drawDecorations(ctx, state.decorations[i]);
  return c;
}

export function buildPhotoTabs() {
  const tabs = $("photoTabs");
  tabs.replaceChildren();
  for (let i = 0; i < 4; i++) {
    const b = document.createElement("button"),
      c = makeCanvas(state.PW / 5, state.PH / 5),
      small = document.createElement("small");
    small.textContent = "PHOTO 0" + (i + 1);
    c.getContext("2d").drawImage(decoratedPhoto(i), 0, 0, c.width, c.height);
    b.append(c, small);
    b.setAttribute("aria-label", "裝飾第 " + (i + 1) + " 張");
    b.onclick = () => {
      finishGesture();
      state.activePhoto = i;
      state.selectedId = null;
      renderEditor();
    };
    tabs.append(b);
  }
}

export function renderEditor() {
  if (state.stage !== "edit") return;
  const c = editCanvas.getContext("2d");
  c.clearRect(0, 0, state.PW, state.PH);
  drawProcessed(c, state.processed[state.activePhoto], 0, 0, state.PW, state.PH);
  drawDecorations(c, objects());
  [...$("photoTabs").children].forEach((b, i) => {
    b.classList.toggle("active", i === state.activePhoto);
    b.setAttribute("aria-pressed", String(i === state.activePhoto));
  });
  $("photoTabs")
    .children[state.activePhoto]?.querySelector("canvas")
    .getContext("2d")
    .drawImage(editCanvas, 0, 0, state.PW / 5, state.PH / 5);
  drawSelection(c);
  syncEditControls();
}

export let editorRenderQueued = false;

export function queueEditorRender() {
  if (editorRenderQueued) return;
  editorRenderQueued = true;
  requestAnimationFrame(() => {
    editorRenderQueued = false;
    renderEditor();
  });
}

export function syncEditControls() {
  document.querySelectorAll("#toolbox button,#toolbox input").forEach((b) => (b.disabled = state.editLocked));
  $("undoBtn").disabled = state.editLocked || !state.histories[state.activePhoto].length;
}

export function setTool(next) {
  finishGesture();
  state.tool = next;
  selectButtons("[data-tool]", "tool", state.tool);
  $("stampTools").hidden = state.tool !== "stamp";
  $("drawTools").hidden = state.tool !== "draw";
  $("adjustTools").hidden = state.tool !== "adjust";
  if (state.tool !== "adjust") state.selectedId = null;
  editCanvas.dataset.tool = state.tool;
  editCanvas.style.cursor = "";
  syncEditControls();
  if (state.stage === "edit") renderEditor();
}

export function selectStamp(key) {
  if (!canEdit()) return;
  state.stampKey = key;
  document.querySelectorAll("#stampButtons button").forEach((b) => {
    const active = b.dataset.stamp === key;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  setTool("stamp");
}

export const STAMP_HOLD_MS = 260,
  STAMP_MAX = 460;

export function placeStamp(p, pointerId) {
  if (!canEdit() || objects().length >= 200) return;
  remember();
  const o = {
    id: state.nextId++,
    type: "stamp",
    key: state.stampKey,
    x: p.x,
    y: p.y,
    size: Math.round(rand(72, 170)),
    rotation: rand(-0.85, 0.85),
  };
  objects().push(o);
  if (pointerId !== undefined) {
    editCanvas.setPointerCapture(pointerId);
    state.gesture = { id: pointerId, object: o, stamp: true, start: performance.now(), base: o.size };
    requestAnimationFrame(growStamp);
  }
  renderEditor();
}

// Holding a stamp keeps it under the finger and slowly blows it up.
export function growStamp(now) {
  if (!state.gesture?.stamp) return;
  const held = now - state.gesture.start;
  if (held > STAMP_HOLD_MS) {
    state.gesture.object.size = Math.round(
      Math.min(STAMP_MAX, state.gesture.base * (1 + (held - STAMP_HOLD_MS) / 850)),
    );
    queueEditorRender();
  }
  requestAnimationFrame(growStamp);
}

export function undo() {
  if (!canEdit() || !state.histories[state.activePhoto].length) return;
  finishGesture();
  state.decorations[state.activePhoto] = state.histories[state.activePhoto].pop();
  renderEditor();
}

export function buildStampButtons() {
  $("stampButtons").replaceChildren();
  for (const [title, set] of [
    [THEMES[state.theme].name + " 限定", STAMP_SETS[state.theme]],
    ["共用圖案", SHARED_PICTURES],
    ["共用文字", SHARED_WORDS],
  ]) {
    const heading = document.createElement("p");
    heading.className = "stamp-group";
    heading.textContent = title;
    $("stampButtons").append(heading);
    for (const [key, name] of set) {
      const b = document.createElement("button"),
        img = document.createElement("img"),
        small = document.createElement("small");
      b.className = "stamp-button" + (key === state.stampKey ? " active" : "");
      b.dataset.stamp = key;
      b.setAttribute("aria-label", "選擇" + name + "印章");
      b.setAttribute("aria-pressed", String(key === state.stampKey));
      img.src = STAMP_DIR + key + ".webp";
      img.alt = "";
      img.loading = "lazy";
      small.textContent = name;
      b.append(img, small);
      b.onclick = () => selectStamp(key);
      $("stampButtons").append(b);
      stampImage(key);
    }
  }
}

export function buildSwatches() {
  const glow = state.brushMode === "glow",
    current = glow ? state.glowColor : state.drawColor;
  $("drawColors").replaceChildren();
  const colors = glow
    ? [...GLOW_COLORS]
    : [THEMES[state.theme].accent, "#7547a2", "#302532", "#ffffff", "#7cbbea", "#b0d756", "#ffcb4d"];
  if (state.brushMode !== "dots" && state.brushMode !== "hearts") colors.push("rainbow");
  else if (current === "rainbow") state.drawColor = colors[0];
  for (const color of colors) {
    const rainbow = color === "rainbow",
      b = document.createElement("button");
    b.className =
      "swatch" +
      (glow ? " glow" : "") +
      (rainbow ? " rainbow" : "") +
      (color === (glow ? state.glowColor : state.drawColor) ? " active" : "");
    if (!rainbow) b.style.background = glow ? "radial-gradient(circle,#fffdf8 0 30%," + color + " 72%)" : color;
    b.setAttribute("aria-label", rainbow ? (glow ? "彩虹強光" : "彩虹") : (glow ? "光暈顏色 " : "畫筆顏色 ") + color);
    b.onclick = () => {
      if (!canEdit()) return;
      if (glow) state.glowColor = color;
      else state.drawColor = color;
      [...$("drawColors").children].forEach((el) => el.classList.toggle("active", el === b));
    };
    $("drawColors").append(b);
  }
}

export function syncBrushUI() {
  buildSwatches();
  syncEditControls();
  selectButtons("[data-brush-category]", "brushCategory", state.brushCategory);
  selectButtons("[data-brush-preset]", "brushPreset", state.patternPreset);
  $("patternPresets").hidden = state.brushCategory !== "pattern";
  $("drawColors").hidden = state.brushMode === "eraser";
  $("brushSizeValue").value = state.brushSize;
}

export function point(e) {
  const r = editCanvas.getBoundingClientRect();
  return {
    x: clamp(((e.clientX - r.left) / r.width) * state.PW, 0, state.PW),
    y: clamp(((e.clientY - r.top) / r.height) * state.PH, 0, state.PH),
  };
}

export function initEditor() {
  editCanvas.addEventListener("pointerdown", (e) => {
    if (!canEdit() || e.button > 0) return;
    if (state.tool === "adjust") {
      adjustDown(e);
      return;
    }
    if (state.gesture) return;
    e.preventDefault();
    const p = point(e);
    if (state.tool === "stamp") {
      placeStamp(p, e.pointerId);
      return;
    }
    if (objects().length >= 200) return;
    editCanvas.setPointerCapture(e.pointerId);
    remember();
    const color = state.brushMode === "glow" ? state.glowColor : state.drawColor,
      o = {
        id: state.nextId++,
        type: "stroke",
        points: [p],
        width: state.brushSize,
        color,
        brush: state.brushMode === "solid" && color === "rainbow" ? "rainbow" : state.brushMode,
      };
    objects().push(o);
    state.gesture = { id: e.pointerId, object: o };
    renderEditor();
  });
  editCanvas.addEventListener("pointermove", (e) => {
    if (state.tool === "adjust") {
      adjustMove(e);
      return;
    }
    if (!canEdit() || state.gesture?.id !== e.pointerId) return;
    const p = point(e),
      o = state.gesture.object;
    if (state.gesture.stamp) {
      o.x = p.x;
      o.y = p.y;
      queueEditorRender();
      return;
    }
    const last = o.points[o.points.length - 1];
    if (o.points.length >= 2500 || Math.hypot(p.x - last.x, p.y - last.y) < Math.max(1, o.width * 0.15)) return;
    o.points.push(p);
    queueEditorRender();
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    editCanvas.addEventListener(name, (e) => {
      if (state.tool === "adjust") {
        adjustUp(e);
        return;
      }
      if (state.gesture?.id === e.pointerId) finishGesture();
    });
  document.querySelectorAll("[data-tool]").forEach(
    (b) =>
      (b.onclick = () => {
        if (canEdit()) setTool(b.dataset.tool);
      }),
  );
  document.querySelectorAll("[data-brush-category]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!canEdit()) return;
        state.brushCategory = b.dataset.brushCategory;
        state.brushMode = state.brushCategory === "pattern" ? state.patternPreset : state.brushCategory;
        syncBrushUI();
      }),
  );
  document.querySelectorAll("[data-brush-preset]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!canEdit()) return;
        state.patternPreset = b.dataset.brushPreset;
        state.brushCategory = "pattern";
        state.brushMode = state.patternPreset;
        syncBrushUI();
      }),
  );
  $("brushSize").oninput = (e) => {
    if (!canEdit()) return;
    state.brushSize = Number(e.target.value);
    syncBrushUI();
  };
  $("undoBtn").onclick = undo;
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (state.stage === "edit" && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    } else if (
      state.stage === "edit" &&
      state.tool === "adjust" &&
      (e.key === "Delete" || e.key === "Backspace") &&
      selectedStamp()
    ) {
      e.preventDefault();
      deleteSelectedStamp();
    }
  });
}
