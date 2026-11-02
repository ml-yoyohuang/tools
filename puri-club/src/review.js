// Photo review with retakes, and importing photos instead of shooting.
import { placeholder, setHurry, setStage } from "./app.js";
import { captureSequence, updateCameraUI } from "./camera.js";
import { beginEdit } from "./editor.js";
import { drawProcessed, processPhoto } from "./photo.js";
import { REVIEW_SECONDS, state } from "./state.js";
import { $, cropDraw, makeCanvas, status } from "./util.js";

export function updateReviewClock() {
  if (state.stage !== "review" || !state.timed) return;
  const seconds = Math.max(0, Math.ceil((state.reviewDeadline - performance.now()) / 1000));
  $("reviewClock").querySelector("b").textContent = seconds;
  $("reviewClock").setAttribute("aria-label", seconds ? "檢查剩餘 " + seconds + " 秒" : "檢查時間已結束");
  $("reviewClock").classList.toggle("urgent", seconds > 0 && seconds <= 15);
  $("reviewClock").classList.toggle("final", seconds > 0 && seconds <= 10);
  setHurry(seconds > 0 && seconds <= 10);
  $("reviewClock").classList.toggle("time-up", seconds === 0);
  $("reviewSection").dataset.timeUp = String(seconds === 0);
  if (seconds === 0 && !state.reviewLocked) {
    state.reviewLocked = true;
    $("reviewGrid")
      .querySelectorAll("button")
      .forEach((b, i) => {
        b.disabled = true;
        if (!state.retakes[i]) {
          b.textContent = "時間到";
          b.setAttribute("aria-label", "檢查時間已結束，無法重拍第 " + (i + 1) + " 張");
        }
      });
    status("檢查時間到了，照片已保留。按「完成，開始裝飾」繼續。");
  }
}

export function showReview() {
  setStage("review");
  if (state.timed && !state.reviewDeadline) state.reviewDeadline = performance.now() + REVIEW_SECONDS * 1000;
  $("reviewClock").hidden = !state.timed;
  state.reviewLocked = state.timed && performance.now() >= state.reviewDeadline;
  $("reviewSection").dataset.timeUp = String(state.reviewLocked);
  $("reviewClock").classList.toggle("time-up", state.reviewLocked);
  const grid = $("reviewGrid");
  grid.replaceChildren();
  for (let i = 0; i < 4; i++) {
    const tile = document.createElement("div");
    tile.className = "photo-tile";
    const c = makeCanvas(state.PW * 0.4, state.PH * 0.4);
    drawProcessed(c.getContext("2d"), state.processed[i], 0, 0, c.width, c.height);
    const label = document.createElement("div");
    label.className = "tile-label";
    label.textContent = String(i + 1).padStart(2, "0") + " / 04";
    const b = document.createElement("button");
    b.className = "spark";
    b.textContent = state.retakes[i] ? "已重拍" : state.reviewLocked ? "時間到" : "重拍（剩1次）";
    b.setAttribute(
      "aria-label",
      state.retakes[i]
        ? "第 " + (i + 1) + " 張已重拍"
        : state.reviewLocked
          ? "檢查時間已結束，無法重拍第 " + (i + 1) + " 張"
          : "重拍第 " + (i + 1) + " 張，每張限一次",
    );
    b.disabled = state.reviewLocked || state.retakes[i] >= 1;
    b.onclick = () => {
      updateReviewClock();
      if (!state.reviewLocked) captureSequence([i], true);
    };
    tile.append(c, label, b);
    grid.append(tile);
  }
  updateReviewClock();
  status(
    state.reviewLocked
      ? "檢查時間到了，照片已保留。按「完成，開始裝飾」繼續。"
      : "四張都拍好了，可以選擇重拍或開始裝飾。",
  );
}

export function renderImport() {
  const grid = $("importGrid");
  grid.replaceChildren();
  for (let i = 0; i < 4; i++) {
    const b = document.createElement("button"),
      c = makeCanvas(state.PW / 2, state.PH / 2);
    if (state.processed[i]) drawProcessed(c.getContext("2d"), state.processed[i], 0, 0, c.width, c.height);
    else placeholder(c, "＋ SELECT PHOTO 0" + (i + 1));
    const label = document.createElement("span");
    label.textContent = state.photos[i] ? "第 " + (i + 1) + " 張 · 更換照片" : "第 " + (i + 1) + " 張 · 選擇照片";
    b.disabled = state.importBusy;
    b.append(c, label);
    b.onclick = () => {
      if (state.importBusy) return;
      state.importSlot = i;
      $("fileInput").click();
    };
    grid.append(b);
  }
  $("importDone").disabled = state.importBusy || !state.photos.every(Boolean);
  $("importBack").disabled = state.importBusy;
}

export async function importPhoto(file) {
  if (!file || state.stage !== "import" || state.importBusy) return;
  const slot = state.importSlot;
  state.importBusy = true;
  renderImport();
  const url = URL.createObjectURL(file);
  try {
    if (file.size > 35 * 1024 * 1024) throw Error("照片超過 35 MB，請先縮小。");
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.naturalWidth * img.naturalHeight > 40000000) throw Error("照片尺寸過大，請先縮小。");
    const raw = makeCanvas(state.PW, state.PH),
      c = raw.getContext("2d");
    c.fillStyle = "white";
    c.fillRect(0, 0, state.PW, state.PH);
    cropDraw(c, img, 0, 0, state.PW, state.PH);
    state.photos[slot] = raw;
    state.processed[slot] = processPhoto(raw);
    status(
      "第 " + (slot + 1) + " 張放好了。" + (state.photos.every(Boolean) ? "可以開始裝飾囉！" : "繼續選擇下一格。"),
    );
  } catch (e) {
    status("這張無法讀取：" + e.message);
  } finally {
    URL.revokeObjectURL(url);
    state.importBusy = false;
    renderImport();
  }
}

export function initReview() {
  $("reviewDone").onclick = beginEdit;
  $("importEntry").onclick = () => {
    state.photos = Array(4).fill(null);
    state.processed = Array(4).fill(null);
    setStage("import");
    renderImport();
    status("點選空相框，一次匯入一張照片。");
  };
  $("fileInput").onchange = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    importPhoto(file);
  };
  $("importDone").onclick = beginEdit;
  $("importBack").onclick = () => {
    setStage("start");
    updateCameraUI();
  };
}
