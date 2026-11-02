// Stages, orientation, booth theme and starting over.
import { stopCamera } from "./camera.js";
import { STAMP_SETS } from "./data/stamps.js";
import { THEMES } from "./data/themes.js";
import { GLOW_COLORS, doodleLayer, maskLayer, wallpapers } from "./decorations.js";
import { buildStampButtons, buildSwatches, syncBrushUI } from "./editor.js";
import { clearExport, resetTilt, setMotion } from "./print.js";
import { PAPER_ART, paperImage } from "./sheet.js";
import { EDIT_SECONDS, REVIEW_SECONDS, editCanvas, state } from "./state.js";
import { $, drawShape, icon, status } from "./util.js";

export function setHurry(on) {
  document.body.dataset.hurry = String(on);
}

export function setStage(next) {
  state.stage = next;
  setHurry(false);
  document.body.dataset.stage = next;
  $("lobbySection").hidden = next !== "lobby";
  $("workspace").hidden = next === "lobby";
  for (const name of ["start", "shoot", "review", "import", "edit", "layout", "result"])
    $(name + "Section").hidden = name !== next;
  document
    .querySelectorAll("[data-step]")
    .forEach((el) =>
      el.classList.toggle("current", el.dataset.step === (["review", "import"].includes(next) ? "shoot" : next)),
    );
  if (!["start", "shoot", "review"].includes(next)) stopCamera();
  window.scrollTo({ top: 0, behavior: "instant" });
}

// Holding the phone upright gives portrait photos; the choice holds until the player is back in the lobby.
export function setOrientation(next) {
  state.orient = next;
  [state.PW, state.PH] = next === "portrait" ? [600, 800] : [800, 600];
  document.body.dataset.orient = next;
  for (const c of [editCanvas, $("cameraCanvas"), maskLayer, doodleLayer]) {
    c.width = state.PW;
    c.height = state.PH;
  }
  for (const id of ["oldPreview", "softPreview"]) {
    const c = $(id);
    c.width = state.PW * 0.6;
    c.height = state.PH * 0.6;
  }
  wallpapers.clear();
}

export function syncTheme() {
  document.body.dataset.theme = state.theme;
  for (const src of Object.values(PAPER_ART[state.theme] || {})) paperImage(src);
  document
    .querySelectorAll(".machine-name")
    .forEach((el) => (el.textContent = THEMES[state.theme].name + " / PURI CLUB 2000"));
  state.drawColor = THEMES[state.theme].accent;
  if (!STAMP_SETS[state.theme].some(([key]) => key === state.stampKey)) state.stampKey = STAMP_SETS[state.theme][0][0];
  buildSwatches();
  buildStampButtons();
}

export function selectButtons(selector, key, value) {
  document.querySelectorAll(selector).forEach((b) => {
    const active = b.dataset[key] === value;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
}

export function placeholder(canvas, label) {
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  c.fillStyle = THEMES[state.theme].ink;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#ffffff1a";
  for (let x = 0; x < w; x += 25)
    for (let y = 0; y < h; y += 25) {
      c.beginPath();
      c.arc(x, y, 1, 0, 7);
      c.fill();
    }
  c.textAlign = "center";
  c.textBaseline = "middle";
  drawShape(c, THEMES[state.theme].symbol, w / 2, h * 0.39, w * 0.13, THEMES[state.theme].secondary);
  if (label) {
    c.fillStyle = "#fff";
    c.font = "bold " + w * 0.028 + "px monospace";
    c.fillText(label, w / 2, h * 0.65);
  }
}

export function initApp() {
  $("restartYes").onclick = () => {
    $("restartDialog").close();
    state.sequenceToken++;
    state.running = false;
    clearExport();
    state.photos = Array(4).fill(null);
    state.processed = Array(4).fill(null);
    state.finalPhotos = null;
    state.decorations = Array.from({ length: 4 }, () => []);
    state.histories = Array.from({ length: 4 }, () => []);
    state.retakes = [0, 0, 0, 0];
    state.gesture = null;
    state.editLocked = false;
    state.reviewDeadline = 0;
    state.reviewLocked = false;
    state.tool = "stamp";
    state.stampKey = STAMP_SETS[state.theme][0][0];
    state.brushCategory = "solid";
    state.brushMode = "solid";
    state.patternPreset = "dots";
    state.drawColor = "#f73692";
    state.brushSize = 7;
    $("brushSize").value = 7;
    state.glowColor = GLOW_COLORS[0];
    syncBrushUI();
    state.film = "none";
    state.layout = "split";
    state.timed = true;
    setMotion(false);
    $("timeToggle").innerHTML = icon("timer");
    $("timeToggle").setAttribute(
      "aria-label",
      "限時模式：檢查照片 " + REVIEW_SECONDS + " 秒、裝飾 " + EDIT_SECONDS + " 秒，點擊切換不限時",
    );
    selectButtons("button[data-film]", "film", state.film);
    selectButtons("[data-layout]", "layout", state.layout);
    resetTilt();
    setStage("lobby");
    status("再選一台，製造新的回憶");
  };
}
