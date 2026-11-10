// Entry point: wires every part of the booth together, then starts the clocks and the camera preview loop.
import { initAdjust } from "./adjust.js";
import { initApp } from "./app.js";
import { initCamera, previewLoop } from "./camera.js";
import { STAMP_SETS } from "./data/stamps.js";
import { initEditor, syncBrushUI, updateClock } from "./editor.js";
import { initLobby } from "./lobby.js";
import { initMagic } from "./magic.js";
import { initPrint } from "./print.js";
import { initReview, updateReviewClock } from "./review.js";
import { state } from "./state.js";
import { initUtil } from "./util.js";

initUtil();
initLobby();
initCamera();
initApp();
initReview();
initEditor();
initAdjust();
initPrint();
initMagic();

// Stamp buttons (and their images) are built when a booth opens, so the lobby only loads lobby art.
state.stampKey = STAMP_SETS[state.theme][0][0];
syncBrushUI();
setInterval(() => {
  updateClock();
  updateReviewClock();
}, 150);
requestAnimationFrame(previewLoop);

// Dev-only console handle: every module's exports, including the shared state. The build drops it.
if (import.meta.env.DEV)
  window.__puri = Object.assign({}, ...Object.values(import.meta.glob(["./**/*.js", "!./main.js"], { eager: true })));
