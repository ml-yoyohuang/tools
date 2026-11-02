// Start screen, camera, the shooting sequence and pausing when the page hides.
import { selectButtons, setStage } from "./app.js";
import { STAMP_DIR } from "./data/stamps.js";
import { EXTRA_POSES, THEMES } from "./data/themes.js";
import { updateClock } from "./editor.js";
import { drawProcessed, processPhoto, processedWith } from "./photo.js";
import { showReview } from "./review.js";
import { EDIT_SECONDS, REVIEW_SECONDS, state, video } from "./state.js";
import { $, cropDraw, icon, makeCanvas, sleep, status } from "./util.js";

export function pickPoseHint(used, shot) {
  const themed = THEMES[state.theme].poses.filter((line, index) => (index < 3 || shot === 3) && !used.has(line));
  const extra = EXTRA_POSES.filter((line) => !used.has(line) && !themed.includes(line));
  const pool = Math.random() < 0.5 && themed.length ? themed : extra.length ? extra : themed;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  used.add(choice);
  return choice;
}

export function cameraError(e) {
  if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) return "相機需要 HTTPS 或 localhost。也可以匯入照片。";
  return (
    {
      NotAllowedError: "請允許使用相機，或匯入照片。",
      NotFoundError: "找不到相機，改用你喜歡的照片也可以。",
      NotReadableError: "相機被其他程式使用中，關閉後再試一次。",
    }[e.name] || "相機暫時無法啟動，請再試一次或匯入照片。"
  );
}

export function stopCamera() {
  state.cameraToken++;
  state.stream?.getTracks().forEach((t) => t.stop());
  state.stream = null;
  video.srcObject = null;
  state.cameraReady = false;
  state.cameraBusy = false;
  updateCameraUI();
}

export function updateCameraUI() {
  if (!state.cameraReady) $("startSection").dataset.cameraReady = "false";
  $("enableCamera").disabled = state.cameraBusy;
  $("enableCamera").textContent = state.cameraBusy ? "正在開啟鏡頭…" : "開啟相機";
  $("flipBtn").disabled = state.cameraBusy;
  $("permission").hidden = state.cameraReady;
}

export async function startCamera() {
  if (state.cameraBusy || !["start", "shoot", "review"].includes(state.stage)) return false;
  stopCamera();
  const token = state.cameraToken;
  state.cameraBusy = true;
  updateCameraUI();
  let acquired;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Error("unsupported");
    acquired = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: state.facing }, width: { ideal: 1280 }, height: { ideal: 960 } },
    });
    if (token !== state.cameraToken) {
      acquired.getTracks().forEach((t) => t.stop());
      return false;
    }
    state.stream = acquired;
    video.srcObject = state.stream;
    await video.play();
    const until = performance.now() + 8000;
    while (video.readyState < 2 || !video.videoWidth) {
      if (token !== state.cameraToken) return false;
      if (performance.now() > until) throw Error("Video timeout");
      await sleep(80);
    }
    if (token !== state.cameraToken) return false;
    state.mirror = (state.stream.getVideoTracks()[0]?.getSettings().facingMode || state.facing) !== "environment";
    state.cameraReady = true;
    state.stream.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (state.stream === acquired) interruptCapture("鏡頭中斷了，重新開啟就能繼續。");
    });
    status("鏡頭已連線。選好質感，準備開始！");
    return true;
  } catch (e) {
    acquired?.getTracks().forEach((t) => t.stop());
    if (token === state.cameraToken) {
      stopCamera();
      $("cameraMessage").textContent = cameraError(e);
      status(cameraError(e));
    }
    return false;
  } finally {
    if (token === state.cameraToken) {
      state.cameraBusy = false;
      updateCameraUI();
    }
  }
}

export function rawFromCamera() {
  if (!state.cameraReady || video.readyState < 2 || !video.videoWidth) throw Error("camera not ready");
  const raw = makeCanvas(state.PW, state.PH),
    c = raw.getContext("2d");
  if (state.mirror) {
    c.translate(state.PW, 0);
    c.scale(-1, 1);
  }
  cropDraw(c, video, 0, 0, state.PW, state.PH);
  return raw;
}

export function previewLoop(now) {
  if (
    state.cameraReady &&
    state.stream &&
    video.readyState >= 2 &&
    !document.hidden &&
    ["start", "shoot"].includes(state.stage) &&
    now - state.lastPreview > 120
  ) {
    state.lastPreview = now;
    try {
      const raw = rawFromCamera();
      if (state.stage === "start") {
        for (const mode of ["old", "soft"]) {
          const c = $(mode + "Preview");
          drawProcessed(c.getContext("2d"), processedWith(raw, mode, true), 0, 0, c.width, c.height, mode);
        }
        $("startSection").dataset.cameraReady = "true";
      } else {
        drawProcessed($("cameraCanvas").getContext("2d"), processPhoto(raw, true), 0, 0, state.PW, state.PH);
      }
    } catch (e) {
      interruptCapture("鏡頭暫時沒有畫面，請重新開啟。");
    }
  }
  requestAnimationFrame(previewLoop);
}

export function interruptCapture(message) {
  state.sequenceToken++;
  state.running = false;
  stopCamera();
  if (state.stage === "shoot") {
    $("shootSection").dataset.paused = "true";
    $("countOverlay").hidden = true;
    $("resumeBtn").hidden = false;
    $("shootNote").hidden = false;
    $("shootNote").textContent = message;
  } else if (state.stage === "start") {
    $("cameraMessage").textContent = message;
  }
  status(message);
}

export async function sequenceWait(ms, token) {
  await sleep(ms);
  return (
    token === state.sequenceToken &&
    state.stage === "shoot" &&
    !document.hidden &&
    state.cameraReady &&
    video.readyState >= 2
  );
}

// Booths with countdown artwork show it for READY and 5–1; the rest use the theme symbol and plain digits.
export const COUNTDOWN_ART = {
  gal: "assets/countdown/web/109-style-",
  hara: "assets/countdown/web/harajuku-mix-",
  cyber: "assets/countdown/web/cyber-angel-",
};

export function preloadCountdown() {
  new Image().src = SHOT_DONE_ART[state.theme];
  const base = COUNTDOWN_ART[state.theme];
  if (base) for (const step of ["ready", 5, 4, 3, 2, 1]) new Image().src = base + step + ".webp";
}

// After each shot one of the booth's stamps pops up next to the GET! label.
export const SHOT_DONE_ART = {
  gal: STAMP_DIR + "109-style/109-01-heart.webp",
  hara: STAMP_DIR + "harajuku-mix/13-three-stars.webp",
  cyber: STAMP_DIR + "cyber-angel/07-ice-bow.webp",
};

export function showShotDone() {
  const img = new Image();
  img.className = "count-art shot-done";
  img.src = SHOT_DONE_ART[state.theme];
  img.alt = "";
  $("countNumber").replaceChildren(img);
}

export function showCount(step) {
  const el = $("countNumber"),
    base = COUNTDOWN_ART[state.theme];
  if (base) {
    const img = new Image();
    img.className = step === "ready" ? "count-art" : "count-art digit";
    img.src = base + step + ".webp";
    img.alt = step === "ready" ? "READY" : String(step);
    el.replaceChildren(img);
  } else if (step === "ready") el.innerHTML = icon(THEMES[state.theme].symbol);
  else el.textContent = step;
}

export async function captureSequence(slots, isRetake = false) {
  if (state.running || !slots.length) return;
  if (isRetake && state.retakes[slots[0]] >= 1) return;
  state.pendingSlots = [...slots];
  state.retakeSlot = isRetake ? slots[0] : null;
  setStage("shoot");
  $("shootSection").dataset.paused = "false";
  $("resumeBtn").hidden = true;
  $("shootNote").hidden = true;
  $("countOverlay").hidden = false;
  $("countLabel").hidden = false;
  if (!state.cameraReady) {
    $("countNumber").innerHTML = icon(THEMES[state.theme].symbol);
    $("countLabel").textContent = "正在連接鏡頭…";
    if (!(await startCamera())) {
      $("shootSection").dataset.paused = "true";
      $("countOverlay").hidden = true;
      $("resumeBtn").hidden = false;
      $("shootNote").hidden = false;
      $("shootNote").textContent = "請允許鏡頭後繼續；已拍攝的照片會保留。";
      return;
    }
  }
  state.running = true;
  const token = ++state.sequenceToken,
    usedPoseHints = new Set();
  const wait = async (ms) => {
    const ok = await sequenceWait(ms, token);
    if (!ok && token === state.sequenceToken) interruptCapture("拍攝已暫停，回來後繼續就好。");
    return ok;
  };
  for (let n = 0; n < slots.length; n++) {
    const i = slots[n],
      poseHint = pickPoseHint(usedPoseHints, i);
    $("shotNumber").textContent = String(i + 1).padStart(2, "0") + " / 04";
    $("poseHint").textContent = poseHint;
    showCount("ready");
    $("countLabel").hidden = false;
    $("countLabel").textContent = n === 0 ? "準備好你的姿勢！" : "換個姿勢，下一張來囉！";
    if (!(await wait(n === 0 ? 2200 : 3000))) return;
    $("countLabel").hidden = true;
    for (let count = 5; count >= 1; count--) {
      showCount(count);
      if (!(await wait(1000))) return;
    }
    try {
      const raw = rawFromCamera();
      const image = processPhoto(raw);
      state.photos[i] = raw;
      state.processed[i] = image;
      if (isRetake) state.retakes[i] = 1;
      state.pendingSlots = state.pendingSlots.filter((s) => s !== i);
    } catch (e) {
      interruptCapture("這張還沒拍到，請重新連接相機再試一次。");
      return;
    }
    $("cameraStage").classList.remove("flash");
    void $("cameraStage").offsetWidth;
    $("cameraStage").classList.add("flash");
    showShotDone();
    $("countLabel").hidden = false;
    $("countLabel").textContent = "GET! 第 " + (i + 1) + " 張好可愛";
    if (!(await wait(950))) return;
  }
  state.running = false;
  state.pendingSlots = [];
  state.retakeSlot = null;
  showReview();
}

export function initCamera() {
  document.querySelectorAll("[data-look]").forEach(
    (b) =>
      (b.onclick = () => {
        if (state.stage !== "start" || state.running) return;
        state.look = b.dataset.look;
        selectButtons("[data-look]", "look", state.look);
        if (state.cameraBusy) return;
        if (!state.cameraReady) {
          startCamera();
          return;
        }
        state.photos = Array(4).fill(null);
        state.processed = Array(4).fill(null);
        state.retakes = [0, 0, 0, 0];
        state.reviewDeadline = 0;
        state.reviewLocked = false;
        captureSequence([0, 1, 2, 3]);
      }),
  );
  $("timeToggle").onclick = () => {
    state.timed = !state.timed;
    $("timeToggle").innerHTML = icon(state.timed ? "timer" : "infinity");
    $("timeToggle").setAttribute(
      "aria-label",
      !state.timed
        ? "不限時模式，點擊切換限時"
        : "限時模式：檢查照片 " + REVIEW_SECONDS + " 秒、裝飾 " + EDIT_SECONDS + " 秒，點擊切換不限時",
    );
  };
  $("enableCamera").onclick = startCamera;
  $("flipBtn").onclick = () => {
    state.facing = state.facing === "user" ? "environment" : "user";
    startCamera();
  };
  $("backLobby").onclick = () => setStage("lobby");
  $("resumeBtn").onclick = async () => {
    if (state.cameraBusy || state.running) return;
    $("resumeBtn").disabled = true;
    try {
      if (await startCamera()) {
        if (!state.pendingSlots.length && state.photos.every(Boolean)) {
          state.retakeSlot = null;
          showReview();
        } else await captureSequence([...state.pendingSlots], state.retakeSlot !== null);
      }
    } finally {
      $("resumeBtn").disabled = false;
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && ["start", "shoot", "review"].includes(state.stage))
      interruptCapture("相機已暫停，回來後重新開啟就能繼續。");
    if (state.stage === "edit") updateClock();
  });
  window.addEventListener("pagehide", () => {
    state.sequenceToken++;
    state.running = false;
    stopCamera();
  });
}
