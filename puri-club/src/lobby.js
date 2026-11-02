// The lobby: booth posters, ornaments, the marquee and entering a booth.
import { setOrientation, setStage, syncTheme } from "./app.js";
import { preloadCountdown, startCamera } from "./camera.js";
import { THEMES } from "./data/themes.js";
import { state } from "./state.js";
import { $, icon, sleep } from "./util.js";

export const machineCards = [...document.querySelectorAll(".machine")];

export const openingDurationMs = 620,
  openingStaggerMs = openingDurationMs;

// Each poster cycles its ornament through three spots, each with its own size and pace.
export const ORNAMENT_SLOTS = {
  gal: [
    { top: "53%", right: "6%", scale: 1, dur: 5.8, angle: "9deg" },
    { top: "13%", left: "7%", scale: 0.72, dur: 4.4, angle: "-14deg" },
    { top: "57%", left: "5%", scale: 1.22, dur: 6.9, angle: "-6deg" },
  ],
  hara: [
    { left: "70%", from: "17%", to: "57%", scale: 1, dur: 8, spin: "1080deg" },
    { left: "10%", from: "64%", to: "12%", scale: 0.7, dur: 6.1, spin: "-900deg" },
    { left: "74%", from: "28%", to: "76%", scale: 1.3, dur: 9.6, spin: "720deg" },
  ],
  cyber: [
    { top: "19%", left: "6%", scale: 1, dur: 6.6 },
    { top: "52%", right: "6%", scale: 1.18, dur: 7.8 },
    { top: "12%", right: "9%", scale: 0.7, dur: 5.2 },
  ],
};

export const ORNAMENT_ANIMATION = { gal: "ornamentTurn", hara: "wanderingStar", cyber: "angelBloom" };

export function placeOrnament(img, slot) {
  img.style.top = slot.top || "";
  img.style.left = slot.left || "auto";
  img.style.right = slot.right || "auto";
  for (const [name, value] of [
    ["--ornament-scale", slot.scale],
    ["--ornament-angle", slot.angle],
    ["--star-from", slot.from],
    ["--star-to", slot.to],
    ["--star-spin", slot.spin],
  ])
    value === undefined ? img.style.removeProperty(name) : img.style.setProperty(name, value);
}

export let lobbyOpening = true;

export let visibleMachine = 0;

export function showMachine(index) {
  visibleMachine = (index + machineCards.length) % machineCards.length;
  machineCards.forEach((card, i) => card.classList.toggle("is-active", i === visibleMachine));
  $("lobbyMachines").setAttribute(
    "aria-label",
    "目前顯示 " + THEMES[machineCards[visibleMachine].querySelector("[data-machine]").dataset.machine].name,
  );
  $("machineIndex").textContent = visibleMachine + 1 + "/" + machineCards.length;
}

export let enteringMachine = false;

export async function enterMachine(nextTheme) {
  if (state.stage !== "lobby" || lobbyOpening || enteringMachine) return;
  enteringMachine = true;
  state.theme = nextTheme;
  setOrientation(matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape");
  syncTheme();
  preloadCountdown();
  $("startSection").dataset.cameraReady = "false";
  for (const id of ["oldPreview", "softPreview"]) {
    const c = $(id);
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
  }
  $("cameraMessage").textContent = "開啟相機後，選一邊開始拍攝。";
  const flash = $("entryFlash"),
    reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const selectedIndex = machineCards.findIndex((card) => card.querySelector(".choose").dataset.machine === nextTheme);
  try {
    if (!reduceMotion) {
      machineCards[selectedIndex].append(flash);
      flash.dataset.machine = nextTheme;
      flash.hidden = false;
      flash.classList.remove("playing");
      void $("lobbyMachines").offsetWidth;
      machineCards.forEach((card, i) => card.classList.toggle("is-dimming", i !== selectedIndex));
      flash.classList.add("playing");
      await sleep(760);
    }
    setStage("start");
    startCamera();
  } finally {
    flash.classList.remove("playing");
    flash.hidden = true;
    machineCards.forEach((card) => card.classList.remove("is-dimming"));
    enteringMachine = false;
  }
}

export function initLobby() {
  document.querySelectorAll(".selector-marquee-track").forEach((track) => {
    const unit = document.createElement("span");
    unit.className = "selector-marquee-unit";
    unit.innerHTML = icon("spark") + "選一台喜歡的機台，開始拍貼吧" + icon("spark");
    for (let i = 0; i < 12; i++) track.append(unit.cloneNode(true));
  });
  machineCards.forEach((card, index) => {
    for (const className of ["exit-shade", "opening-shade"]) {
      const shade = document.createElement("span");
      shade.className = className;
      shade.setAttribute("aria-hidden", "true");
      if (className === "opening-shade") shade.style.transitionDelay = index * openingStaggerMs + "ms";
      card.append(shade);
    }
  });
  machineCards.forEach((card) => {
    const key = card.querySelector(".choose").dataset.machine,
      imgs = [...card.querySelectorAll(".machine-ornament")],
      slots = ORNAMENT_SLOTS[key];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      imgs.forEach((img, i) => placeOrnament(img, slots[i % slots.length]));
      return;
    }
    let turn = 0;
    const play = () => {
      const slot = slots[turn % slots.length],
        img = imgs[turn % imgs.length];
      turn++;
      placeOrnament(img, slot);
      img.style.animationName = "none";
      void img.offsetWidth;
      img.style.animationDuration = slot.dur + "s";
      img.style.animationName = ORNAMENT_ANIMATION[key];
      img.addEventListener("animationend", play, { once: true });
    };
    play();
  });
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    machineCards.forEach((card) => card.querySelector(".opening-shade").remove());
    lobbyOpening = false;
  } else {
    const openLobby = () =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          machineCards.forEach((card) => card.classList.add("has-opened"));
          setTimeout(
            () => {
              machineCards.forEach((card) => card.querySelector(".opening-shade")?.remove());
              lobbyOpening = false;
            },
            openingDurationMs + openingStaggerMs * (machineCards.length - 1) + 60,
          );
        }),
      );
    if (document.readyState === "complete") openLobby();
    else window.addEventListener("load", openLobby, { once: true });
  }
  showMachine(0);
  $("prevMachine").onclick = () => showMachine(visibleMachine - 1);
  $("nextMachine").onclick = () => showMachine(visibleMachine + 1);
  document.querySelectorAll("[data-machine]").forEach((b) => (b.onclick = () => enterMachine(b.dataset.machine)));
  machineCards.forEach((card) =>
    card.addEventListener("click", (e) => {
      if (state.stage !== "lobby" || !matchMedia("(min-width:761px)").matches || e.target.closest(".choose")) return;
      card.querySelector(".choose").click();
    }),
  );
}
