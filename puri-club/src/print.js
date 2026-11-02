// Layout picker, the print-out screen and the result page: films, tilt, saving and sharing.
import { selectButtons, setStage } from "./app.js";
import { decoratedPhoto, finishGesture, updateClock } from "./editor.js";
import { buildLayoutIcons, renderSheet } from "./sheet.js";
import { state } from "./state.js";
import { $, clamp, makeCanvas, sleep, status } from "./util.js";

export function finishEdit() {
  if (state.stage !== "edit") return;
  updateClock();
  finishGesture();
  state.editLocked = true;
  state.finalPhotos = Array.from({ length: 4 }, (_, i) => decoratedPhoto(i));
  setStage("layout");
  buildLayoutIcons();
  renderSheet($("layoutCanvas"));
  status("裝飾完成。選擇喜歡的版面，就能印刷。");
}

export function clearExport() {
  state.exportToken++;
  state.exportBlob = null;
  state.exportFile = null;
  for (const id of ["saveBtn", "shareBtn"]) $(id).disabled = true;
}

export async function prepareExport() {
  clearExport();
  const token = state.exportToken;
  $("exportStatus").hidden = true;
  $("exportStatus").textContent = "";
  await sleep(20);
  if (token !== state.exportToken || state.stage !== "result") return;
  try {
    const c = makeCanvas(1, 1);
    renderSheet(c, 3, true);
    const blob = await new Promise((resolve, reject) =>
      c.toBlob((b) => (b ? resolve(b) : reject(Error("encode"))), "image/png"),
    );
    if (token !== state.exportToken || state.stage !== "result") return;
    state.exportBlob = blob;
    state.exportFile = new File([blob], "puri-club-" + state.theme + "-" + Date.now() + ".png", { type: "image/png" });
    for (const id of ["saveBtn", "shareBtn"]) $(id).disabled = false;
  } catch (e) {
    $("exportStatus").textContent = "印刷未完成，請重新選擇膜款再試一次。";
    $("exportStatus").hidden = false;
  }
}

export function showResult() {
  setStage("result");
  renderSheet($("resultCanvas"));
  $("foilCard").dataset.film = state.film;
  $("motionBtn").hidden = typeof DeviceOrientationEvent === "undefined";
  resetTilt();
  prepareExport();
  status("拍貼印好了！幫它上膜，或直接存圖帶回家。");
}

export function openImage() {
  if (!state.exportBlob) return;
  if (state.imageURL) URL.revokeObjectURL(state.imageURL);
  state.imageURL = URL.createObjectURL(state.exportBlob);
  $("saveImage").src = state.imageURL;
  $("imageDialog").showModal();
}

// iPhone, iPad and in-app browsers don't save downloads where people look for photos, so there 存圖 opens the image for a long-press save.
export const longPressSave =
  /iP(hone|ad|od)|Line\/|Instagram|FBAN|FBAV|MicroMessenger/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function savePNG() {
  if (!state.exportBlob) return;
  if (longPressSave) {
    openImage();
    status("長按圖片就能存到相簿。");
    return;
  }
  const url = URL.createObjectURL(state.exportBlob),
    a = document.createElement("a");
  a.href = url;
  a.download = state.exportFile.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  status("已送出圖片下載。");
}

export async function share() {
  if (!state.exportFile) return;
  if (!navigator.canShare?.({ files: [state.exportFile] }) || !navigator.share) {
    openImage();
    status("此瀏覽器沒有圖片分享功能，可長按儲存後分享。");
    return;
  }
  try {
    await navigator.share({ files: [state.exportFile] });
  } catch (e) {
    if (e.name !== "AbortError") status("分享未完成，可以改用存圖。");
  }
}

export function tilt(x, y) {
  if (state.stage !== "result" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const card = $("foilCard");
  card.style.transform = "rotateX(" + -y * 20 + "deg) rotateY(" + x * 24 + "deg)";
  card.style.setProperty("--shine-x", 50 + x * 70 + "%");
  card.style.setProperty("--shine-y", 50 + y * 70 + "%");
  card.style.setProperty("--tilt-x", x);
  card.style.setProperty("--tilt-y", y);
}

export function resetTilt() {
  const card = $("foilCard");
  card.style.transform = "";
  for (const [name, value] of [
    ["--shine-x", "50%"],
    ["--shine-y", "50%"],
    ["--tilt-x", 0],
    ["--tilt-y", 0],
  ])
    card.style.setProperty(name, value);
}

// Without the gyro, the photo tilts by dragging it; release springs it back.
export let tiltDrag = null;

export function setMotion(on) {
  state.motionEnabled = on;
  $("motionBtn").setAttribute("aria-label", on ? "關閉手機感應" : "跟著手機轉動");
  $("motionBtn").setAttribute("aria-pressed", String(on));
  if (!on) resetTilt();
}

// 印這張 plays a short print-out: the finished sheet feeds out of the booth slot before the film step shows.
// The result page renders and starts exporting underneath, and a tap anywhere skips the wait.
export let printTimers = [];

export function endPrinting() {
  printTimers.forEach(clearTimeout);
  printTimers = [];
  $("printing").hidden = true;
}

export function printSheet() {
  showResult();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = $("printingSheet");
  renderSheet(c, 2);
  c.style.animation = "none";
  void c.offsetWidth;
  c.style.animation = "";
  $("printingTitle").textContent = "列印中…";
  $("printingSub").textContent = "プリント中　しばらくお待ちください";
  $("printing").hidden = false;
  printTimers = [
    setTimeout(() => {
      $("printingTitle").textContent = "印好了！從取出口拿取吧";
      $("printingSub").textContent = "取り出し口からお取りください";
    }, 2500),
    setTimeout(endPrinting, 3700),
  ];
}

export function initPrint() {
  $("tiltArea").addEventListener("pointerdown", (e) => {
    if (state.motionEnabled || e.button > 0 || e.target.closest("#motionBtn")) return;
    e.preventDefault();
    tiltDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    $("tiltArea").setPointerCapture(e.pointerId);
    $("tiltArea").classList.add("dragging");
  });
  $("tiltArea").addEventListener("pointermove", (e) => {
    if (state.motionEnabled) return;
    const r = $("tiltArea").getBoundingClientRect();
    if (tiltDrag?.id === e.pointerId) {
      const reach = Math.max(80, Math.min(r.width, r.height) * 0.42);
      tilt(clamp((e.clientX - tiltDrag.x) / reach, -1, 1), clamp((e.clientY - tiltDrag.y) / reach, -1, 1));
    } else if (!tiltDrag && e.pointerType === "mouse")
      tilt(
        clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1),
        clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1),
      );
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    $("tiltArea").addEventListener(name, (e) => {
      if (tiltDrag?.id !== e.pointerId) return;
      tiltDrag = null;
      $("tiltArea").classList.remove("dragging");
      resetTilt();
    });
  $("tiltArea").addEventListener("pointerleave", () => {
    if (!tiltDrag && !state.motionEnabled) resetTilt();
  });
  window.addEventListener("deviceorientation", (e) => {
    if (state.motionEnabled && e.gamma !== null && e.beta !== null)
      tilt(clamp(e.gamma / 16, -1, 1), clamp((e.beta - 45) / 18, -1, 1));
  });
  $("motionBtn").onclick = async () => {
    try {
      if (
        !state.motionEnabled &&
        typeof DeviceOrientationEvent.requestPermission === "function" &&
        (await DeviceOrientationEvent.requestPermission()) !== "granted"
      ) {
        status("感應器未開啟，仍然可以用手指拖曳相片。");
        return;
      }
      setMotion(!state.motionEnabled);
    } catch (e) {
      status("此裝置無法使用方向感應，試著用手指拖曳相片。");
    }
  };
  $("editDone").onclick = finishEdit;
  document.querySelectorAll("[data-layout]").forEach(
    (b) =>
      (b.onclick = () => {
        state.layout = b.dataset.layout;
        selectButtons("[data-layout]", "layout", state.layout);
        renderSheet($("layoutCanvas"));
      }),
  );
  $("printing").onclick = endPrinting;
  $("printBtn").onclick = printSheet;
  document.querySelectorAll("button[data-film]").forEach(
    (b) =>
      (b.onclick = () => {
        state.film = b.dataset.film;
        selectButtons("button[data-film]", "film", state.film);
        $("foilCard").dataset.film = state.film;
        resetTilt();
        prepareExport();
      }),
  );
  $("saveBtn").onclick = savePNG;
  $("shareBtn").onclick = share;
  $("closeImage").onclick = () => $("imageDialog").close();
  $("imageDialog").addEventListener("close", () => {
    if (state.imageURL) URL.revokeObjectURL(state.imageURL);
    state.imageURL = null;
    $("saveImage").removeAttribute("src");
  });
  $("backLayout").onclick = () => {
    clearExport();
    setStage("layout");
    buildLayoutIcons();
    renderSheet($("layoutCanvas"));
  };
  $("restartBtn").onclick = () => $("restartDialog").showModal();
  $("restartNo").onclick = () => $("restartDialog").close();
}
