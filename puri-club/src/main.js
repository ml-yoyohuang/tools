"use strict";
// Photos are 800 × 600 or 600 × 800 (PW × PH), locked from the screen orientation when a booth is entered.
const $ = (id) => document.getElementById(id),
  clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  rand = (a, b) => a + Math.random() * (b - a),
  pick = (list) => list[Math.floor(Math.random() * list.length)];
// One 24 × 24 icon set: filled shapes double as canvas paths, the rest are strokes.
const SHAPES = {
  heart:
    "M12 20.5C6 16.6 2.5 13.2 2.5 9 2.5 6.2 4.6 4 7.3 4c2 0 3.6 1.1 4.7 2.8C13.1 5.1 14.7 4 16.7 4c2.7 0 4.8 2.2 4.8 5 0 4.2-3.5 7.6-9.5 11.5z",
  star: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z",
  spark: "M12 1Q13 11 23 12Q13 13 12 23Q11 13 1 12Q11 11 12 1Z",
};
const ICONS = {
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
document.body.insertAdjacentHTML(
  "afterbegin",
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(ICONS)
    .map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`)
    .join("")}</svg>`,
);
const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
function drawShape(c, name, x, y, size, color) {
  c.save();
  c.translate(x, y);
  c.scale(size / 24, size / 24);
  c.translate(-12, -12);
  c.fillStyle = color;
  c.fill(new Path2D(SHAPES[name]));
  c.restore();
}
document.querySelectorAll(".selector-marquee-track").forEach((track) => {
  const unit = document.createElement("span");
  unit.className = "selector-marquee-unit";
  unit.innerHTML = icon("spark") + "選一台喜歡的機台，開始拍貼吧" + icon("spark");
  for (let i = 0; i < 12; i++) track.append(unit.cloneNode(true));
});
const status = (t) => ($("status").textContent = t);
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}
function cropDraw(c, img, x, y, w, h) {
  const sw = img.videoWidth || img.naturalWidth || img.width,
    sh = img.videoHeight || img.naturalHeight || img.height;
  if (!sw || !sh) return;
  let cw = sw,
    ch = sh;
  if (sw / sh > w / h) cw = (sh * w) / h;
  else ch = (sw * h) / w;
  c.drawImage(img, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, w, h);
}
const THEMES = {
  gal: {
    name: "109 STYLE",
    paper: "#fff0df",
    accent: "#f73692",
    ink: "#3d2036",
    secondary: "#ffe16c",
    border: "#392334",
    symbol: "heart",
    poses: ["看鏡頭，笑一個", "比個辣妹 peace！", "靠近一點點", "最後一張，最閃亮！"],
  },
  hara: {
    name: "HARAJUKU MIX",
    paper: "#fffce1",
    accent: "#ef59a5",
    ink: "#51316c",
    secondary: "#b9e858",
    border: "#69418c",
    symbol: "star",
    poses: ["準備你的招牌表情", "換一個超怪可愛 pose！", "跟朋友擠在一起！", "最後一張，放膽玩！"],
  },
  cyber: {
    name: "CYBER ANGEL",
    paper: "#edf5ff",
    accent: "#7c89d8",
    ink: "#414e7c",
    secondary: "#b2e8f5",
    border: "#8196bc",
    symbol: "spark",
    poses: ["天使準備連線", "輕輕歪個頭", "發送一個愛心！", "最後一張，閃耀吧！"],
  },
};
const EXTRA_POSES = [
  "發送一個愛心！",
  "來個只有你會的表情",
  "眼神對上鏡頭",
  "比個小小的心",
  "偷偷眨一下眼睛！",
  "這張就做鬼臉吧！",
  "換個角度，再可愛一點",
  "呀吼！",
  "看旁邊！",
];
function pickPoseHint(used, shot) {
  const themed = THEMES[theme].poses.filter((line, index) => (index < 3 || shot === 3) && !used.has(line));
  const extra = EXTRA_POSES.filter((line) => !used.has(line) && !themed.includes(line));
  const pool = Math.random() < 0.5 && themed.length ? themed : extra.length ? extra : themed;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  used.add(choice);
  return choice;
}
let stage = "lobby",
  theme = "gal",
  look = "old",
  layout = "split",
  film = "none",
  timed = true,
  orient = "landscape",
  PW = 800,
  PH = 600;
// Timed mode gives the photo check and the decorating booth their own limits; untimed mode drops both.
const REVIEW_SECONDS = 60,
  EDIT_SECONDS = 300;
let photos = Array(4).fill(null),
  processed = Array(4).fill(null),
  finalPhotos = null,
  decorations = Array.from({ length: 4 }, () => []),
  histories = Array.from({ length: 4 }, () => []),
  retakes = [0, 0, 0, 0];
let activePhoto = 0,
  nextId = 1,
  tool = "stamp",
  selectedId = null,
  stampKey = "",
  brushCategory = "solid",
  brushMode = "solid",
  patternPreset = "dots",
  drawColor = "#f73692",
  glowColor = "#ff3d9a",
  brushSize = 7,
  gesture = null,
  deadline = 0,
  editLocked = false,
  reviewDeadline = 0,
  reviewLocked = false;
let stream = null,
  cameraBusy = false,
  cameraToken = 0,
  cameraReady = false,
  facing = "user",
  mirror = true,
  sequenceToken = 0,
  running = false,
  pendingSlots = [],
  retakeSlot = null,
  lastPreview = 0;
let importSlot = 0,
  importBusy = false,
  exportBlob = null,
  exportFile = null,
  exportToken = 0,
  imageURL = null,
  motionEnabled = false;
const video = $("sourceVideo"),
  editCanvas = $("editCanvas");
// Reused original photo processing and vector sticker artwork.
function processPhoto(raw, preview = false) {
  const retro = look === "old";
  const low = retro ? 160 : 640;
  const long = preview ? Math.min(low, 320) : low;
  const w = PW > PH ? long : Math.round(long * 0.75);
  const h = PW > PH ? Math.round(long * 0.75) : long;
  const small = makeCanvas(w, h);
  const c = small.getContext("2d", { willReadFrequently: true });
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  cropDraw(c, raw, 0, 0, w, h);

  const data = c.getImageData(0, 0, w, h);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    let r = p[i],
      g = p[i + 1],
      b = p[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    const contrast = retro ? 1.18 : 0.82;
    const lift = retro ? 2 : 22;
    const saturation = retro ? 1.28 : 0.86;
    r = l + (r - l) * saturation;
    g = l + (g - l) * saturation;
    b = l + (b - l) * saturation;
    r = (r - 128) * contrast + 128 + lift;
    g = (g - 128) * contrast + 128 + lift;
    b = (b - 128) * contrast + 128 + lift;
    if (retro) {
      r += 15;
      g += 3;
      b -= 10;
    } else {
      r -= 6;
      g += 7;
      b += 20;
    }
    // 輕微主題色調，不把膚色染成強烈純色。
    if (theme === "gal") {
      r += 4;
      b += 2;
    }
    if (theme === "hara") {
      r += 2;
      g += 2;
    }
    if (theme === "cyber") {
      b += 5;
      r -= 1;
    }
    p[i] = clamp(r, 0, 255);
    p[i + 1] = clamp(g, 0, 255);
    p[i + 2] = clamp(b, 0, 255);
    p[i + 3] = 255;
  }
  c.putImageData(data, 0, 0);

  if (retro) {
    const vignette = c.createRadialGradient(w / 2, h / 2, w * 0.12, w / 2, h / 2, w * 0.72);
    vignette.addColorStop(0, "#0000");
    vignette.addColorStop(1, "#42102f52");
    c.fillStyle = vignette;
    c.fillRect(0, 0, w, h);
  } else {
    const softened = makeCanvas(w, h);
    const sc = softened.getContext("2d");
    sc.filter = `blur(${((w / 320) * 1.7).toFixed(1)}px)`;
    sc.drawImage(small, 0, 0);
    c.globalAlpha = 0.52;
    c.drawImage(softened, 0, 0);
    c.globalAlpha = 1;
    // 柔亮模式把亮部暈開，預覽與成品使用相同效果。
    const light = makeCanvas(w, h);
    const lc = light.getContext("2d");
    const highlights = c.getImageData(0, 0, w, h);
    for (let i = 0; i < highlights.data.length; i += 4) {
      const q = highlights.data;
      const l = 0.299 * q[i] + 0.587 * q[i + 1] + 0.114 * q[i + 2];
      q[i + 3] = Math.round(clamp((l - 155) / 90, 0, 1) * 150);
    }
    lc.putImageData(highlights, 0, 0);
    c.save();
    c.globalCompositeOperation = "screen";
    c.globalAlpha = 0.42;
    c.filter = `blur(${((w / 320) * 4).toFixed(1)}px)`;
    c.drawImage(light, 0, 0);
    c.restore();
  }
  return small;
}
function drawProcessed(ctx, img, x, y, w, h, mode = look) {
  ctx.save();
  ctx.imageSmoothingEnabled = mode !== "old";
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

// Stamps are illustrated WebP files: one set per booth plus a shared Heisei-pop set.
const STAMP_DIR = "assets/stamps/web/";
const STAMP_SETS = {
  gal: [
    ["109-style/109-01-heart", "桃紅愛心"],
    ["109-style/109-03-crown", "金皇冠"],
    ["109-style/109-04-butterfly", "豹紋蝴蝶"],
    ["109-style/109-07-bow", "豹紋蝴蝶結"],
    ["109-style/109-09-chain", "銀鎖鏈"],
    ["109-style/109-11-pearls", "珍珠"],
    ["109-style/109-13-kiss", "吻痕"],
    ["109-style/109-14-stars", "金色星光"],
    ["109-style/109-16-gems", "水鑽"],
    ["109-style/109-19-lace-corner", "蕾絲角"],
    ["109-style/109-20-tape", "豹紋膠帶"],
    ["109-style/109-21-ribbon", "緞帶"],
  ],
  hara: [
    ["harajuku-mix/01-bubble-star", "泡泡星"],
    ["harajuku-mix/02-checker-heart", "棋盤愛心"],
    ["harajuku-mix/03-six-flower", "彩色花朵"],
    ["harajuku-mix/07-checker-bow", "棋盤蝴蝶結"],
    ["harajuku-mix/09-bead-string", "彩珠串"],
    ["harajuku-mix/10-star-charm", "星星吊飾"],
    ["harajuku-mix/13-three-stars", "三顆星"],
    ["harajuku-mix/14-rays", "放射線"],
    ["harajuku-mix/18-paper-confetti", "紙片"],
    ["harajuku-mix/19-graph-paper", "方格紙"],
    ["harajuku-mix/20-stripe-tape", "條紋膠帶"],
    ["harajuku-mix/22-wave-underline", "波浪線"],
  ],
  cyber: [
    ["cyber-angel/01-ice-butterfly", "冰藍蝴蝶"],
    ["cyber-angel/03-chrome-heart", "鉻銀愛心"],
    ["cyber-angel/05-angel-wings", "天使翅膀"],
    ["cyber-angel/07-ice-bow", "冰藍蝴蝶結"],
    ["cyber-angel/09-teardrop-pendant", "水滴墜飾"],
    ["cyber-angel/12-halo", "光環"],
    ["cyber-angel/13-ice-stars", "冰藍星星"],
    ["cyber-angel/14-glass-bubbles", "玻璃泡泡"],
    ["cyber-angel/15-rhinestone-diamond", "水鑽菱形"],
    ["cyber-angel/20-gummy-label", "果凍標籤"],
    ["cyber-angel/21-rhinestone-corner", "水鑽角"],
    ["cyber-angel/23-prism-tape", "稜鏡膠帶"],
  ],
};
const SHARED_PICTURES = [
  ["shared/PB-01_hand-heart", "手繪愛心"],
  ["shared/PB-02_link-hearts", "連心"],
  ["shared/PB-03_flying-hearts", "飛愛心"],
  ["shared/PB_hearts-stars", "愛心星星"],
  ["shared/PB-04_yellow-star", "黃色星星"],
  ["shared/PB-05_sparkle-group", "閃亮組"],
  ["shared/PB-06_smile-badge", "笑臉"],
  ["shared/PB-07_daisy", "小雛菊"],
  ["shared/PB-08_cherries", "櫻桃"],
  ["shared/PB-09_strawberry", "草莓"],
  ["shared/PB-10_music-notes", "音符"],
  ["shared/PB-11_v-sign", "V 手勢"],
  ["shared/PB-12_gift-box", "禮物盒"],
  ["shared/PB-14_mini-camera", "迷你相機"],
];
const SHARED_WORDS = [
  ["shared/PW-01_zuttomo", "ズッ友"],
  ["shared/PW-02_zutto-issho", "ずっと一緒"],
  ["shared/PW-03_nakayoshi", "なかよし"],
  ["shared/PW-04_nakayoshi", "仲良し"],
  ["shared/PW-05_best-friends", "BEST FRIENDS"],
  ["shared/PW-06_itsumen", "いつメン"],
  ["shared/PW-07_saikyou-combi", "最強コンビ"],
  ["shared/PW-08_muteki", "無敵"],
  ["shared/PW-09_kyou-no-shuyaku", "今日の主役"],
  ["shared/PW-10_love", "LOVE"],
  ["shared/PW-11_rabu", "ラブ"],
  ["shared/PW-12_daisuki", "だいすき"],
  ["shared/PW-13_heart-times-heart", "愛心×愛心"],
  ["shared/PW-14_seishun", "青春"],
  ["shared/PW-15_omoide", "思い出"],
  ["shared/PW-16_kinenbi", "記念日"],
];
const stampImages = new Map();
function stampImage(key) {
  let img = stampImages.get(key);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (stage === "edit") queueEditorRender();
    };
    img.src = STAMP_DIR + key + ".webp";
    stampImages.set(key, img);
  }
  return img;
}
// Words read smaller than pictures at the same box size, so they get a little extra room.
function stampDims(key, size) {
  const img = stampImage(key);
  if (!img.naturalWidth) return { img, w: size, h: size };
  const k = (size * (key.includes("/PW-") ? 1.35 : 1)) / Math.max(img.naturalWidth, img.naturalHeight);
  return { img, w: img.naturalWidth * k, h: img.naturalHeight * k };
}
function drawStamp(c, key, x, y, size, rotation = 0) {
  const { img, w, h } = stampDims(key, size);
  if (!img.complete || !img.naturalWidth) return;
  c.save();
  c.translate(x, y);
  c.rotate(rotation);
  c.drawImage(img, -w / 2, -h / 2, w, h);
  c.restore();
}

/* =========================
   印章與塗鴉筆刷
========================= */
function paintStroke(c, points) {
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
const wallpapers = new Map(),
  maskLayer = makeCanvas(800, 600);
function wallpaper(kind, color) {
  const key = kind + theme + color + PW;
  if (wallpapers.has(key)) return wallpapers.get(key);
  const w = makeCanvas(PW, PH),
    c = w.getContext("2d"),
    t = THEMES[theme],
    n = parseInt(color.slice(1), 16),
    light = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 200,
    base = light ? t.accent : paleTint(color, 0.8),
    ink = color;
  if (kind === "rainbow") {
    const g = c.createLinearGradient(0, 0, PW, PH);
    for (let i = 0; i <= 12; i++) g.addColorStop(i / 12, "hsl(" + ((i * 60) % 360) + " 95% 66%)");
    c.fillStyle = g;
    c.fillRect(0, 0, PW, PH);
  } else {
    c.fillStyle = base;
    c.fillRect(0, 0, PW, PH);
    const step = kind === "dots" ? 40 : 56;
    for (let row = 0, y = 0; y < PH + step; y += step / 2, row++)
      for (let x = row % 2 ? step / 2 : 0; x < PW + step; x += step) {
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
function paintPattern(c, o) {
  const m = maskLayer.getContext("2d");
  m.globalCompositeOperation = "source-over";
  m.clearRect(0, 0, PW, PH);
  m.lineCap = "round";
  m.lineJoin = "round";
  m.lineWidth = o.width;
  m.strokeStyle = m.fillStyle = "#000";
  paintStroke(m, o.points);
  m.globalCompositeOperation = "source-in";
  m.drawImage(wallpaper(o.brush, o.color), 0, 0);
  c.drawImage(maskLayer, 0, 0);
}
const GLOW_COLORS = ["#ff3d9a", "#c43dff", "#4d6bff", "#13b8e8", "#22c26a", "#ffab1a", "#ff4f4f"];
function paleTint(hex, amount = 0.86) {
  const n = parseInt(hex.slice(1), 16),
    mix = (v) => Math.round(v + (255 - v) * amount);
  return "rgb(" + mix((n >> 16) & 255) + "," + mix((n >> 8) & 255) + "," + mix(n & 255) + ")";
}
const doodleLayer = makeCanvas(800, 600);
// Stamps and pen strokes stack in the order they were made, so a new stamp can sit on an earlier doodle; the eraser only ever removes pen strokes.
function eraseStroke(d, o) {
  d.save();
  d.globalCompositeOperation = "destination-out";
  d.lineCap = d.lineJoin = "round";
  d.lineWidth = o.width;
  d.strokeStyle = d.fillStyle = "#000";
  paintStroke(d, o.points);
  d.restore();
}
function drawDecorations(c, list) {
  for (let i = 0; i < list.length;) {
    if (list[i].type === "stamp") {
      drawObject(c, list[i++]);
      continue;
    }
    // A run of strokes between stamps shares one layer. Every eraser stroke made later also applies to it, so the
    // eraser still reaches ink under a newer stamp without ever touching the stamp itself.
    const d = doodleLayer.getContext("2d");
    d.clearRect(0, 0, PW, PH);
    let j = i;
    for (; j < list.length && list[j].type !== "stamp"; j++)
      if (list[j].brush === "eraser") eraseStroke(d, list[j]);
      else drawObject(d, list[j]);
    for (let k = j; k < list.length; k++) if (list[k].brush === "eraser") eraseStroke(d, list[k]);
    c.drawImage(doodleLayer, 0, 0);
    i = j;
  }
}
function drawObject(c, o) {
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

function setHurry(on) {
  document.body.dataset.hurry = String(on);
}
function setStage(next) {
  stage = next;
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
function setOrientation(next) {
  orient = next;
  [PW, PH] = next === "portrait" ? [600, 800] : [800, 600];
  document.body.dataset.orient = next;
  for (const c of [editCanvas, $("cameraCanvas"), maskLayer, doodleLayer]) {
    c.width = PW;
    c.height = PH;
  }
  for (const id of ["oldPreview", "softPreview"]) {
    const c = $(id);
    c.width = PW * 0.6;
    c.height = PH * 0.6;
  }
  wallpapers.clear();
}
function syncTheme() {
  document.body.dataset.theme = theme;
  for (const src of Object.values(PAPER_ART[theme] || {})) paperImage(src);
  document
    .querySelectorAll(".machine-name")
    .forEach((el) => (el.textContent = THEMES[theme].name + " / PURI CLUB 2000"));
  drawColor = THEMES[theme].accent;
  if (!STAMP_SETS[theme].some(([key]) => key === stampKey)) stampKey = STAMP_SETS[theme][0][0];
  buildSwatches();
  buildStampButtons();
}
function selectButtons(selector, key, value) {
  document.querySelectorAll(selector).forEach((b) => {
    const active = b.dataset[key] === value;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
}
function placeholder(canvas, label) {
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  c.fillStyle = THEMES[theme].ink;
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
  drawShape(c, THEMES[theme].symbol, w / 2, h * 0.39, w * 0.13, THEMES[theme].secondary);
  if (label) {
    c.fillStyle = "#fff";
    c.font = "bold " + w * 0.028 + "px monospace";
    c.fillText(label, w / 2, h * 0.65);
  }
}
function cameraError(e) {
  if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) return "相機需要 HTTPS 或 localhost。也可以匯入照片。";
  return (
    {
      NotAllowedError: "請允許使用相機，或匯入照片。",
      NotFoundError: "找不到相機，改用你喜歡的照片也可以。",
      NotReadableError: "相機被其他程式使用中，關閉後再試一次。",
    }[e.name] || "相機暫時無法啟動，請再試一次或匯入照片。"
  );
}
function stopCamera() {
  cameraToken++;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
  cameraReady = false;
  cameraBusy = false;
  updateCameraUI();
}
function updateCameraUI() {
  if (!cameraReady) $("startSection").dataset.cameraReady = "false";
  $("enableCamera").disabled = cameraBusy;
  $("enableCamera").textContent = cameraBusy ? "正在開啟鏡頭…" : "開啟相機";
  $("flipBtn").disabled = cameraBusy;
  $("permission").hidden = cameraReady;
}
async function startCamera() {
  if (cameraBusy || !["start", "shoot", "review"].includes(stage)) return false;
  stopCamera();
  const token = cameraToken;
  cameraBusy = true;
  updateCameraUI();
  let acquired;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Error("unsupported");
    acquired = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 960 } },
    });
    if (token !== cameraToken) {
      acquired.getTracks().forEach((t) => t.stop());
      return false;
    }
    stream = acquired;
    video.srcObject = stream;
    await video.play();
    const until = performance.now() + 8000;
    while (video.readyState < 2 || !video.videoWidth) {
      if (token !== cameraToken) return false;
      if (performance.now() > until) throw Error("Video timeout");
      await sleep(80);
    }
    if (token !== cameraToken) return false;
    mirror = (stream.getVideoTracks()[0]?.getSettings().facingMode || facing) !== "environment";
    cameraReady = true;
    stream.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (stream === acquired) interruptCapture("鏡頭中斷了，重新開啟就能繼續。");
    });
    status("鏡頭已連線。選好質感，準備開始！");
    return true;
  } catch (e) {
    acquired?.getTracks().forEach((t) => t.stop());
    if (token === cameraToken) {
      stopCamera();
      $("cameraMessage").textContent = cameraError(e);
      status(cameraError(e));
    }
    return false;
  } finally {
    if (token === cameraToken) {
      cameraBusy = false;
      updateCameraUI();
    }
  }
}
function rawFromCamera() {
  if (!cameraReady || video.readyState < 2 || !video.videoWidth) throw Error("camera not ready");
  const raw = makeCanvas(PW, PH),
    c = raw.getContext("2d");
  if (mirror) {
    c.translate(PW, 0);
    c.scale(-1, 1);
  }
  cropDraw(c, video, 0, 0, PW, PH);
  return raw;
}
function processedWith(raw, mode, preview = false) {
  const previous = look;
  look = mode;
  try {
    return processPhoto(raw, preview);
  } finally {
    look = previous;
  }
}
function previewLoop(now) {
  if (
    cameraReady &&
    stream &&
    video.readyState >= 2 &&
    !document.hidden &&
    ["start", "shoot"].includes(stage) &&
    now - lastPreview > 120
  ) {
    lastPreview = now;
    try {
      const raw = rawFromCamera();
      if (stage === "start") {
        for (const mode of ["old", "soft"]) {
          const c = $(mode + "Preview");
          drawProcessed(c.getContext("2d"), processedWith(raw, mode, true), 0, 0, c.width, c.height, mode);
        }
        $("startSection").dataset.cameraReady = "true";
      } else {
        drawProcessed($("cameraCanvas").getContext("2d"), processPhoto(raw, true), 0, 0, PW, PH);
      }
    } catch (e) {
      interruptCapture("鏡頭暫時沒有畫面，請重新開啟。");
    }
  }
  requestAnimationFrame(previewLoop);
}
function interruptCapture(message) {
  sequenceToken++;
  running = false;
  stopCamera();
  if (stage === "shoot") {
    $("shootSection").dataset.paused = "true";
    $("countOverlay").hidden = true;
    $("resumeBtn").hidden = false;
    $("shootNote").hidden = false;
    $("shootNote").textContent = message;
  } else if (stage === "start") {
    $("cameraMessage").textContent = message;
  }
  status(message);
}
async function sequenceWait(ms, token) {
  await sleep(ms);
  return token === sequenceToken && stage === "shoot" && !document.hidden && cameraReady && video.readyState >= 2;
}
// Booths with countdown artwork show it for READY and 5–1; the rest use the theme symbol and plain digits.
const COUNTDOWN_ART = {
  gal: "assets/countdown/web/109-style-",
  hara: "assets/countdown/web/harajuku-mix-",
  cyber: "assets/countdown/web/cyber-angel-",
};
function preloadCountdown() {
  new Image().src = SHOT_DONE_ART[theme];
  const base = COUNTDOWN_ART[theme];
  if (base) for (const step of ["ready", 5, 4, 3, 2, 1]) new Image().src = base + step + ".webp";
}
// After each shot one of the booth's stamps pops up next to the GET! label.
const SHOT_DONE_ART = {
  gal: STAMP_DIR + "109-style/109-01-heart.webp",
  hara: STAMP_DIR + "harajuku-mix/13-three-stars.webp",
  cyber: STAMP_DIR + "cyber-angel/07-ice-bow.webp",
};
function showShotDone() {
  const img = new Image();
  img.className = "count-art shot-done";
  img.src = SHOT_DONE_ART[theme];
  img.alt = "";
  $("countNumber").replaceChildren(img);
}
function showCount(step) {
  const el = $("countNumber"),
    base = COUNTDOWN_ART[theme];
  if (base) {
    const img = new Image();
    img.className = step === "ready" ? "count-art" : "count-art digit";
    img.src = base + step + ".webp";
    img.alt = step === "ready" ? "READY" : String(step);
    el.replaceChildren(img);
  } else if (step === "ready") el.innerHTML = icon(THEMES[theme].symbol);
  else el.textContent = step;
}
async function captureSequence(slots, isRetake = false) {
  if (running || !slots.length) return;
  if (isRetake && retakes[slots[0]] >= 1) return;
  pendingSlots = [...slots];
  retakeSlot = isRetake ? slots[0] : null;
  setStage("shoot");
  $("shootSection").dataset.paused = "false";
  $("resumeBtn").hidden = true;
  $("shootNote").hidden = true;
  $("countOverlay").hidden = false;
  $("countLabel").hidden = false;
  if (!cameraReady) {
    $("countNumber").innerHTML = icon(THEMES[theme].symbol);
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
  running = true;
  const token = ++sequenceToken,
    usedPoseHints = new Set();
  const wait = async (ms) => {
    const ok = await sequenceWait(ms, token);
    if (!ok && token === sequenceToken) interruptCapture("拍攝已暫停，回來後繼續就好。");
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
      photos[i] = raw;
      processed[i] = image;
      if (isRetake) retakes[i] = 1;
      pendingSlots = pendingSlots.filter((s) => s !== i);
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
  running = false;
  pendingSlots = [];
  retakeSlot = null;
  showReview();
}
function updateReviewClock() {
  if (stage !== "review" || !timed) return;
  const seconds = Math.max(0, Math.ceil((reviewDeadline - performance.now()) / 1000));
  $("reviewClock").querySelector("b").textContent = seconds;
  $("reviewClock").setAttribute("aria-label", seconds ? "檢查剩餘 " + seconds + " 秒" : "檢查時間已結束");
  $("reviewClock").classList.toggle("urgent", seconds > 0 && seconds <= 15);
  $("reviewClock").classList.toggle("final", seconds > 0 && seconds <= 10);
  setHurry(seconds > 0 && seconds <= 10);
  $("reviewClock").classList.toggle("time-up", seconds === 0);
  $("reviewSection").dataset.timeUp = String(seconds === 0);
  if (seconds === 0 && !reviewLocked) {
    reviewLocked = true;
    $("reviewGrid")
      .querySelectorAll("button")
      .forEach((b, i) => {
        b.disabled = true;
        if (!retakes[i]) {
          b.textContent = "時間到";
          b.setAttribute("aria-label", "檢查時間已結束，無法重拍第 " + (i + 1) + " 張");
        }
      });
    status("檢查時間到了，照片已保留。按「完成，開始裝飾」繼續。");
  }
}
function showReview() {
  setStage("review");
  if (timed && !reviewDeadline) reviewDeadline = performance.now() + REVIEW_SECONDS * 1000;
  $("reviewClock").hidden = !timed;
  reviewLocked = timed && performance.now() >= reviewDeadline;
  $("reviewSection").dataset.timeUp = String(reviewLocked);
  $("reviewClock").classList.toggle("time-up", reviewLocked);
  const grid = $("reviewGrid");
  grid.replaceChildren();
  for (let i = 0; i < 4; i++) {
    const tile = document.createElement("div");
    tile.className = "photo-tile";
    const c = makeCanvas(PW * 0.4, PH * 0.4);
    drawProcessed(c.getContext("2d"), processed[i], 0, 0, c.width, c.height);
    const label = document.createElement("div");
    label.className = "tile-label";
    label.textContent = String(i + 1).padStart(2, "0") + " / 04";
    const b = document.createElement("button");
    b.className = "spark";
    b.textContent = retakes[i] ? "已重拍" : reviewLocked ? "時間到" : "重拍（剩1次）";
    b.setAttribute(
      "aria-label",
      retakes[i]
        ? "第 " + (i + 1) + " 張已重拍"
        : reviewLocked
          ? "檢查時間已結束，無法重拍第 " + (i + 1) + " 張"
          : "重拍第 " + (i + 1) + " 張，每張限一次",
    );
    b.disabled = reviewLocked || retakes[i] >= 1;
    b.onclick = () => {
      updateReviewClock();
      if (!reviewLocked) captureSequence([i], true);
    };
    tile.append(c, label, b);
    grid.append(tile);
  }
  updateReviewClock();
  status(
    reviewLocked ? "檢查時間到了，照片已保留。按「完成，開始裝飾」繼續。" : "四張都拍好了，可以選擇重拍或開始裝飾。",
  );
}
function renderImport() {
  const grid = $("importGrid");
  grid.replaceChildren();
  for (let i = 0; i < 4; i++) {
    const b = document.createElement("button"),
      c = makeCanvas(PW / 2, PH / 2);
    if (processed[i]) drawProcessed(c.getContext("2d"), processed[i], 0, 0, c.width, c.height);
    else placeholder(c, "＋ SELECT PHOTO 0" + (i + 1));
    const label = document.createElement("span");
    label.textContent = photos[i] ? "第 " + (i + 1) + " 張 · 更換照片" : "第 " + (i + 1) + " 張 · 選擇照片";
    b.disabled = importBusy;
    b.append(c, label);
    b.onclick = () => {
      if (importBusy) return;
      importSlot = i;
      $("fileInput").click();
    };
    grid.append(b);
  }
  $("importDone").disabled = importBusy || !photos.every(Boolean);
  $("importBack").disabled = importBusy;
}
async function importPhoto(file) {
  if (!file || stage !== "import" || importBusy) return;
  const slot = importSlot;
  importBusy = true;
  renderImport();
  const url = URL.createObjectURL(file);
  try {
    if (file.size > 35 * 1024 * 1024) throw Error("照片超過 35 MB，請先縮小。");
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.naturalWidth * img.naturalHeight > 40000000) throw Error("照片尺寸過大，請先縮小。");
    const raw = makeCanvas(PW, PH),
      c = raw.getContext("2d");
    c.fillStyle = "white";
    c.fillRect(0, 0, PW, PH);
    cropDraw(c, img, 0, 0, PW, PH);
    photos[slot] = raw;
    processed[slot] = processPhoto(raw);
    status("第 " + (slot + 1) + " 張放好了。" + (photos.every(Boolean) ? "可以開始裝飾囉！" : "繼續選擇下一格。"));
  } catch (e) {
    status("這張無法讀取：" + e.message);
  } finally {
    URL.revokeObjectURL(url);
    importBusy = false;
    renderImport();
  }
}
function objects() {
  return decorations[activePhoto];
}
function remember() {
  histories[activePhoto].push(structuredClone(objects()));
  if (histories[activePhoto].length > 35) histories[activePhoto].shift();
  syncEditControls();
}
function canEdit() {
  if (stage !== "edit" || editLocked) return false;
  if (timed && performance.now() >= deadline) {
    lockEditing();
    return false;
  }
  return true;
}
function finishGesture() {
  adjustPointers.clear();
  if (gesture) {
    gesture = null;
    renderEditor();
  }
}
function lockEditing() {
  if (editLocked) return;
  editLocked = true;
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
function updateClock() {
  if (stage !== "edit" || editLocked) return;
  const seconds = !timed ? Infinity : Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
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
function beginEdit() {
  if (!photos.every(Boolean) || importBusy || running) return;
  finalPhotos = null;
  activePhoto = 0;
  magicTurns = [0, 0, 0, 0];
  editLocked = false;
  deadline = performance.now() + EDIT_SECONDS * 1000;
  setStage("edit");
  $("clock").classList.remove("time-up");
  $("editCaption").textContent = "DECORATE YOUR PHOTOS · STAMP & DRAW";
  buildPhotoTabs();
  setTool("stamp");
  updateClock();
  renderEditor();
  syncEditControls();
  status(!timed ? "慢慢裝飾，今天不限時" : "5 分鐘裝飾開始！四張各自裝飾，點縮圖切換。");
}
function decoratedPhoto(i) {
  const c = makeCanvas(PW, PH),
    ctx = c.getContext("2d");
  drawProcessed(ctx, processed[i], 0, 0, PW, PH);
  drawDecorations(ctx, decorations[i]);
  return c;
}
function buildPhotoTabs() {
  const tabs = $("photoTabs");
  tabs.replaceChildren();
  for (let i = 0; i < 4; i++) {
    const b = document.createElement("button"),
      c = makeCanvas(PW / 5, PH / 5),
      small = document.createElement("small");
    small.textContent = "PHOTO 0" + (i + 1);
    c.getContext("2d").drawImage(decoratedPhoto(i), 0, 0, c.width, c.height);
    b.append(c, small);
    b.setAttribute("aria-label", "裝飾第 " + (i + 1) + " 張");
    b.onclick = () => {
      finishGesture();
      activePhoto = i;
      selectedId = null;
      renderEditor();
    };
    tabs.append(b);
  }
}
function renderEditor() {
  if (stage !== "edit") return;
  const c = editCanvas.getContext("2d");
  c.clearRect(0, 0, PW, PH);
  drawProcessed(c, processed[activePhoto], 0, 0, PW, PH);
  drawDecorations(c, objects());
  [...$("photoTabs").children].forEach((b, i) => {
    b.classList.toggle("active", i === activePhoto);
    b.setAttribute("aria-pressed", String(i === activePhoto));
  });
  $("photoTabs")
    .children[activePhoto]?.querySelector("canvas")
    .getContext("2d")
    .drawImage(editCanvas, 0, 0, PW / 5, PH / 5);
  drawSelection(c);
  syncEditControls();
}
let editorRenderQueued = false;
function queueEditorRender() {
  if (editorRenderQueued) return;
  editorRenderQueued = true;
  requestAnimationFrame(() => {
    editorRenderQueued = false;
    renderEditor();
  });
}
function syncEditControls() {
  document.querySelectorAll("#toolbox button,#toolbox input").forEach((b) => (b.disabled = editLocked));
  $("undoBtn").disabled = editLocked || !histories[activePhoto].length;
}
function setTool(next) {
  finishGesture();
  tool = next;
  selectButtons("[data-tool]", "tool", tool);
  $("stampTools").hidden = tool !== "stamp";
  $("drawTools").hidden = tool !== "draw";
  $("adjustTools").hidden = tool !== "adjust";
  if (tool !== "adjust") selectedId = null;
  editCanvas.dataset.tool = tool;
  editCanvas.style.cursor = "";
  syncEditControls();
  if (stage === "edit") renderEditor();
}
function selectStamp(key) {
  if (!canEdit()) return;
  stampKey = key;
  document.querySelectorAll("#stampButtons button").forEach((b) => {
    const active = b.dataset.stamp === key;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  setTool("stamp");
}
const STAMP_HOLD_MS = 260,
  STAMP_MAX = 460;
function placeStamp(p, pointerId) {
  if (!canEdit() || objects().length >= 200) return;
  remember();
  const o = {
    id: nextId++,
    type: "stamp",
    key: stampKey,
    x: p.x,
    y: p.y,
    size: Math.round(rand(72, 170)),
    rotation: rand(-0.85, 0.85),
  };
  objects().push(o);
  if (pointerId !== undefined) {
    editCanvas.setPointerCapture(pointerId);
    gesture = { id: pointerId, object: o, stamp: true, start: performance.now(), base: o.size };
    requestAnimationFrame(growStamp);
  }
  renderEditor();
}
// Holding a stamp keeps it under the finger and slowly blows it up.
function growStamp(now) {
  if (!gesture?.stamp) return;
  const held = now - gesture.start;
  if (held > STAMP_HOLD_MS) {
    gesture.object.size = Math.round(Math.min(STAMP_MAX, gesture.base * (1 + (held - STAMP_HOLD_MS) / 850)));
    queueEditorRender();
  }
  requestAnimationFrame(growStamp);
}
function undo() {
  if (!canEdit() || !histories[activePhoto].length) return;
  finishGesture();
  decorations[activePhoto] = histories[activePhoto].pop();
  renderEditor();
}
function buildStampButtons() {
  $("stampButtons").replaceChildren();
  for (const [title, set] of [
    [THEMES[theme].name + " 限定", STAMP_SETS[theme]],
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
      b.className = "stamp-button" + (key === stampKey ? " active" : "");
      b.dataset.stamp = key;
      b.setAttribute("aria-label", "選擇" + name + "印章");
      b.setAttribute("aria-pressed", String(key === stampKey));
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
function buildSwatches() {
  const glow = brushMode === "glow",
    current = glow ? glowColor : drawColor;
  $("drawColors").replaceChildren();
  const colors = glow
    ? [...GLOW_COLORS]
    : [THEMES[theme].accent, "#7547a2", "#302532", "#ffffff", "#7cbbea", "#b0d756", "#ffcb4d"];
  if (brushMode !== "dots" && brushMode !== "hearts") colors.push("rainbow");
  else if (current === "rainbow") drawColor = colors[0];
  for (const color of colors) {
    const rainbow = color === "rainbow",
      b = document.createElement("button");
    b.className =
      "swatch" +
      (glow ? " glow" : "") +
      (rainbow ? " rainbow" : "") +
      (color === (glow ? glowColor : drawColor) ? " active" : "");
    if (!rainbow) b.style.background = glow ? "radial-gradient(circle,#fffdf8 0 30%," + color + " 72%)" : color;
    b.setAttribute("aria-label", rainbow ? (glow ? "彩虹強光" : "彩虹") : (glow ? "光暈顏色 " : "畫筆顏色 ") + color);
    b.onclick = () => {
      if (!canEdit()) return;
      if (glow) glowColor = color;
      else drawColor = color;
      [...$("drawColors").children].forEach((el) => el.classList.toggle("active", el === b));
    };
    $("drawColors").append(b);
  }
}
function syncBrushUI() {
  buildSwatches();
  syncEditControls();
  selectButtons("[data-brush-category]", "brushCategory", brushCategory);
  selectButtons("[data-brush-preset]", "brushPreset", patternPreset);
  $("patternPresets").hidden = brushCategory !== "pattern";
  $("drawColors").hidden = brushMode === "eraser";
  $("brushSizeValue").value = brushSize;
}
function point(e) {
  const r = editCanvas.getBoundingClientRect();
  return {
    x: clamp(((e.clientX - r.left) / r.width) * PW, 0, PW),
    y: clamp(((e.clientY - r.top) / r.height) * PH, 0, PH),
  };
}
editCanvas.addEventListener("pointerdown", (e) => {
  if (!canEdit() || e.button > 0) return;
  if (tool === "adjust") {
    adjustDown(e);
    return;
  }
  if (gesture) return;
  e.preventDefault();
  const p = point(e);
  if (tool === "stamp") {
    placeStamp(p, e.pointerId);
    return;
  }
  if (objects().length >= 200) return;
  editCanvas.setPointerCapture(e.pointerId);
  remember();
  const color = brushMode === "glow" ? glowColor : drawColor,
    o = {
      id: nextId++,
      type: "stroke",
      points: [p],
      width: brushSize,
      color,
      brush: brushMode === "solid" && color === "rainbow" ? "rainbow" : brushMode,
    };
  objects().push(o);
  gesture = { id: e.pointerId, object: o };
  renderEditor();
});
editCanvas.addEventListener("pointermove", (e) => {
  if (tool === "adjust") {
    adjustMove(e);
    return;
  }
  if (!canEdit() || gesture?.id !== e.pointerId) return;
  const p = point(e),
    o = gesture.object;
  if (gesture.stamp) {
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
    if (tool === "adjust") {
      adjustUp(e);
      return;
    }
    if (gesture?.id === e.pointerId) finishGesture();
  });
/* =========================
   調整 tool: select, move, scale and rotate placed stamps
========================= */
const ADJUST_MIN = 36,
  ADJUST_MAX = 620,
  QUARTER = Math.PI / 2,
  SNAP_RANGE = (6 * Math.PI) / 180;
const adjustPointers = new Map(),
  stampMasks = new Map();
const normAngle = (r) => r - 2 * Math.PI * Math.round(r / (2 * Math.PI));
function canvasScale() {
  return PW / (editCanvas.getBoundingClientRect().width || PW);
}
function selectedStamp() {
  return selectedId === null ? null : objects().find((o) => o.id === selectedId && o.type === "stamp") || null;
}
function toLocal(o, p) {
  const dx = p.x - o.x,
    dy = p.y - o.y,
    cos = Math.cos(o.rotation),
    sin = Math.sin(o.rotation);
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}
function toCanvas(o, x, y) {
  const cos = Math.cos(o.rotation),
    sin = Math.sin(o.rotation);
  return { x: o.x + x * cos - y * sin, y: o.y + x * sin + y * cos };
}
// A 64 px alpha copy of each stamp lets taps on transparent corners fall through to the stamp underneath.
function stampMask(key) {
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
function hitStamp(p) {
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
function selectionPad() {
  return 7 * canvasScale();
}
function handlePoint(o) {
  const { w, h } = stampDims(o.key, o.size),
    pad = selectionPad();
  return toCanvas(o, w / 2 + pad, h / 2 + pad);
}
function nearHandle(o, p) {
  const hp = handlePoint(o);
  return Math.hypot(p.x - hp.x, p.y - hp.y) < 24 * canvasScale();
}
// Rotation snaps to the nearest quarter turn within 6°; Shift keeps any angle.
function applyRotation(g, r, free) {
  const near = Math.round(r / QUARTER) * QUARTER,
    snapped = !free && Math.abs(r - near) < SNAP_RANGE;
  g.o.rotation = normAngle(snapped ? near : r);
  if (snapped && !g.snapped) navigator.vibrate?.(8);
  g.snapped = snapped;
}
function touchGesture(g) {
  if (!g.changed) {
    remember();
    g.changed = true;
    delete g.o.magic;
  }
}
function adjustDown(e) {
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
    gesture = {
      adjust: true,
      mode: "pinch",
      o,
      start: { x: o.x, y: o.y, size: o.size, rotation: o.rotation },
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      changed: gesture?.changed || false,
      snapped: false,
    };
    queueEditorRender();
    return;
  }
  if (adjustPointers.size > 2) return;
  if (o && nearHandle(o, p)) {
    gesture = {
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
  selectedId = hit ? hit.id : null;
  gesture = hit
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
function adjustMove(e) {
  if (!canEdit()) return;
  const p = point(e),
    g = gesture?.adjust ? gesture : null;
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
    o.x = clamp(p.x - g.offset.x, 0, PW);
    o.y = clamp(p.y - g.offset.y, 0, PH);
  } else if (g.mode === "handle" && e.pointerId === g.id) {
    touchGesture(g);
    o.size = Math.round(clamp((g.start.size * Math.hypot(p.x - o.x, p.y - o.y)) / g.d0, ADJUST_MIN, ADJUST_MAX));
    applyRotation(g, g.start.rotation + Math.atan2(p.y - o.y, p.x - o.x) - g.a0, e.shiftKey);
  } else if (g.mode === "pinch") {
    const [a, b] = [...adjustPointers.values()];
    if (!b) return;
    touchGesture(g);
    o.x = clamp(g.start.x + (a.x + b.x) / 2 - g.mid.x, 0, PW);
    o.y = clamp(g.start.y + (a.y + b.y) / 2 - g.mid.y, 0, PH);
    o.size = Math.round(clamp((g.start.size * Math.hypot(b.x - a.x, b.y - a.y)) / g.dist, ADJUST_MIN, ADJUST_MAX));
    applyRotation(g, g.start.rotation + Math.atan2(b.y - a.y, b.x - a.x) - g.angle, false);
  } else return;
  queueEditorRender();
}
function adjustUp(e) {
  if (!adjustPointers.delete(e.pointerId)) return;
  if (gesture?.adjust && (gesture.mode === "pinch" || gesture.id === e.pointerId)) {
    gesture = null;
    renderEditor();
  }
}
// Outline, corner handle and angle badge are drawn on the editor only, never into the printed photo.
function drawSelection(c) {
  const o = tool === "adjust" && !editLocked ? selectedStamp() : null;
  placeStampActions(o);
  if (!o) return;
  const { w, h } = stampDims(o.key, o.size),
    s = canvasScale(),
    pad = selectionPad(),
    snapped = gesture?.adjust && gesture.snapped,
    accent = THEMES[theme].accent;
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
  if (gesture?.adjust && gesture.mode !== "move") {
    const deg = Math.round(((((o.rotation * 180) / Math.PI) % 360) + 360) % 360) % 360,
      label = deg + "°";
    c.save();
    c.font = "900 " + Math.round(15 * s) + "px monospace";
    const tw = c.measureText(label).width,
      bx = clamp(o.x, tw / 2 + 14 * s, PW - tw / 2 - 14 * s),
      by = clamp(o.y - h / 2 - pad - 24 * s, 18 * s, PH - 18 * s);
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
function placeStampActions(o) {
  const bar = $("stampActions");
  if (!o || gesture?.adjust || editLocked) {
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
    k = cr.width / PW,
    bw = bar.offsetWidth,
    bh = bar.offsetHeight,
    top = cr.top - wr.top + Math.min(...ys) * k - 8,
    below = top - bh < 4;
  bar.classList.toggle("below", below);
  bar.style.left = clamp(cr.left - wr.left + o.x * k, bw / 2 + 4, wr.width - bw / 2 - 4) + "px";
  bar.style.top = (below ? Math.min(cr.top - wr.top + Math.max(...ys) * k + 8, wr.height - bh - 4) : top) + "px";
}
$("rotate90").onclick = () => {
  const o = selectedStamp();
  if (!canEdit() || !o) return;
  remember();
  delete o.magic;
  o.rotation = normAngle(Math.round(o.rotation / QUARTER) * QUARTER + QUARTER);
  renderEditor();
};
function deleteSelectedStamp() {
  const o = selectedStamp();
  if (!canEdit() || !o) return;
  remember();
  decorations[activePhoto] = objects().filter((x) => x !== o);
  selectedId = null;
  renderEditor();
}
$("deleteStamp").onclick = deleteSelectedStamp;
// Sheets are sticker sheets: every piece is one photo, cut apart along thin lines.
// "split" packs square-cornered pieces edge to edge with no backing paper, turned sideways for landscape photos;
// "eight" prints each photo twice on themed paper, once in a rounded frame and once in a shaped window.
// Its photos bleed SHEET_BLEED past the half-cut line, so a slightly off cut never shows paper.
const SHEET_MARGIN = 20,
  SHEET_BLEED = 6;
// Each 5 × 4 cell quarter of the split sheet holds all four photos (1 large, 2 medium, 3 small), so it can be cut into four full sets.
// A quarter only tiles four ways, so each one uses a different tiling; pieces are listed large, medium, medium, small, small, small.
const SPLIT_QUARTERS = [
  [
    [0, 0, 3],
    [3, 0, 2],
    [3, 2, 2],
    [0, 3, 1],
    [1, 3, 1],
    [2, 3, 1],
  ],
  [
    [0, 1, 3],
    [3, 0, 2],
    [3, 2, 2],
    [0, 0, 1],
    [1, 0, 1],
    [2, 0, 1],
  ],
  [
    [2, 1, 3],
    [0, 0, 2],
    [0, 2, 2],
    [2, 0, 1],
    [3, 0, 1],
    [4, 0, 1],
  ],
  [
    [2, 0, 3],
    [0, 0, 2],
    [0, 2, 2],
    [2, 3, 1],
    [3, 3, 1],
    [4, 3, 1],
  ],
];
const WINDOW_SHAPES = { portrait: ["oval", "arch", "pill", "stamp"], landscape: ["oval", "heart", "pill", "stamp"] };
function sheetSpec(forLayout = layout) {
  const portrait = PH > PW,
    m = SHEET_MARGIN,
    pieces = [];
  if (forLayout === "eight") {
    const gap = 16,
      [w, h] = portrait ? [195, 260] : [260, 195],
      cols = portrait ? 4 : 2,
      rows = portrait ? 2 : 4;
    // Line i holds a rounded frame and the i-th shaped window; lines 2 and 4 put the shape first so frames and shapes
    // alternate. The second line of pieces runs 3·4·1·2, so each photo's two copies sit apart.
    for (let i = 0; i < 4; i++)
      for (let k = 0; k < 2; k++) {
        const slot = i % 2 ? 1 - k : k,
          col = portrait ? i : slot,
          row = portrait ? slot : i;
        pieces.push({
          photo: slot ? (i + 2) % 4 : i,
          shape: k ? WINDOW_SHAPES[orient][i] : "rect",
          x: m + col * (w + gap),
          y: m + row * (h + gap),
          w,
          h,
        });
      }
    return { w: m * 2 + cols * w + (cols - 1) * gap, h: m * 2 + rows * h + (rows - 1) * gap, pieces };
  }
  // Quarter q makes photo q large, the next two medium and the rest small, shuffling which slot each one lands in.
  const cw = portrait ? 60 : 80,
    ch = portrait ? 80 : 60,
    edge = 8;
  SPLIT_QUARTERS.forEach((tiles, q) => {
    const p = (k) => (q + k) % 4,
      small = [p(3), p(0), p(1)],
      order = [p(0), ...(q % 2 ? [p(2), p(1)] : [p(1), p(2)]), ...small.slice(q % 3), ...small.slice(0, q % 3)];
    tiles.forEach(([c0, r0, n], k) => {
      let c = (q % 2) * 5 + c0,
        r = Math.floor(q / 2) * 4 + r0;
      if (!portrait) [c, r] = [r, c];
      pieces.push({
        photo: order[k],
        shape: "square",
        flush: true,
        x: edge + c * cw,
        y: edge + r * ch,
        w: n * cw,
        h: n * ch,
      });
    });
  });
  return { w: edge * 2 + (portrait ? 10 : 8) * cw, h: edge * 2 + (portrait ? 8 : 10) * ch, pieces, bare: true };
}
function stickerPath(shape, x, y, w, h) {
  const p = new Path2D();
  if (shape === "square") p.rect(x, y, w, h);
  else if (shape === "oval") p.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (shape === "pill") p.roundRect(x, y, w, h, Math.min(w, h) / 2);
  else if (shape === "arch") {
    const r = w / 2,
      k = w * 0.08;
    p.moveTo(x, y + r);
    p.arc(x + r, y + r, r, Math.PI, 0);
    p.lineTo(x + w, y + h - k);
    p.arcTo(x + w, y + h, x + w - k, y + h, k);
    p.lineTo(x + k, y + h);
    p.arcTo(x, y + h, x, y + h - k, k);
    p.closePath();
  } else if (shape === "heart") {
    const s = Math.min(w / 19, h / 16.5);
    p.addPath(
      new Path2D(SHAPES.heart),
      new DOMMatrix()
        .translate(x + w / 2, y + h / 2)
        .scale(s)
        .translate(-12, -12.25),
    );
  } else if (shape === "stamp") {
    // Perforated edge: walk the outline clockwise and bite a half circle inward at each hole.
    const r = Math.min(w, h) * 0.035;
    p.moveTo(x, y);
    for (const [sx, sy, len, a] of [
      [x, y, w, 0],
      [x + w, y, h, Math.PI / 2],
      [x + w, y + h, w, Math.PI],
      [x, y + h, h, -Math.PI / 2],
    ]) {
      const dx = Math.cos(a),
        dy = Math.sin(a),
        n = Math.max(3, Math.round(len / (r * 4.2)));
      for (let j = 0; j < n; j++) {
        const t = ((j + 0.5) * len) / n,
          cx = sx + dx * t,
          cy = sy + dy * t;
        p.lineTo(cx - dx * r, cy - dy * r);
        p.arc(cx, cy, r, a + Math.PI, a, true);
      }
      p.lineTo(sx + dx * len, sy + dy * len);
    }
    p.closePath();
  } else p.roundRect(x, y, w, h, Math.min(w, h) * 0.08);
  return p;
}
// Flush pieces fill their whole cell and are split from their neighbours by a thin white line.
// Shaped pieces print the photo past the half-cut line, which is drawn over it as a thin white line with a soft dark edge;
// the stamp keeps a solid line so its perforations read.
function drawSticker(c, piece, img) {
  const { shape, x, y, w, h } = piece,
    b = SHEET_BLEED,
    cut = stickerPath(shape, x, y, w, h);
  if (piece.flush) {
    cropDraw(c, img, x, y, w, h);
    c.strokeStyle = "#fff";
    c.lineWidth = 2;
    c.strokeRect(x, y, w, h);
    return;
  }
  c.save();
  c.clip(stickerPath(shape === "stamp" ? "square" : shape, x - b, y - b, w + b * 2, h + b * 2));
  cropDraw(c, img, x - b, y - b, w + b * 2, h + b * 2);
  c.restore();
  c.save();
  c.lineJoin = "round";
  c.strokeStyle = "#2a181040";
  c.lineWidth = 2.6;
  c.stroke(cut);
  c.strokeStyle = "#fffdf8";
  c.lineWidth = 1.1;
  if (shape !== "stamp") c.setLineDash([5, 3]);
  c.stroke(cut);
  c.restore();
}
// Booth artwork used as sheet paper, as a tall piece, a wide piece or both. A sheet facing the other way from the only
// piece a booth has turns it a quarter turn instead of cropping it. Until a file loads the paper falls back to a drawn
// pattern (or the plain paper colour), and the layout preview redraws once it arrives.
const PAPER_ART = {
    gal: { wide: "assets/109-style-leopard-paper.jpg" },
    hara: { tall: "assets/harajuku-mix-flat-background.png" },
    cyber: { tall: "assets/cyber-angel-flat-background.png", wide: "assets/cyber-angel-flat-background-landscape.jpg" },
  },
  paperImages = new Map();
function paperImage(src) {
  let img = paperImages.get(src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (stage === "layout") renderSheet($("layoutCanvas"));
    };
    img.src = src;
    paperImages.set(src, img);
  }
  return img;
}
function drawArtPaper(c, w, h, art) {
  const wideSheet = w > h,
    src = (wideSheet ? art.wide : art.tall) || art.tall || art.wide,
    img = paperImage(src);
  if (!img.naturalWidth) return false;
  if ((src === art.wide) !== wideSheet) {
    c.save();
    c.translate(w, 0);
    c.rotate(Math.PI / 2);
    cropDraw(c, img, 0, 0, h, w);
    c.restore();
  } else cropDraw(c, img, 0, 0, w, h);
  return true;
}
function drawPaper(c, w, h) {
  const t = THEMES[theme];
  c.fillStyle = t.paper;
  c.fillRect(0, 0, w, h);
  if (PAPER_ART[theme] && drawArtPaper(c, w, h, PAPER_ART[theme]));
  else if (theme === "hara") {
    for (let y = 0; y < h; y += 18)
      for (let x = 0; x < w; x += 18) {
        c.fillStyle = (x / 18 + y / 18) % 2 ? t.secondary : "#ba87cf";
        c.fillRect(x, y, 18, 18);
      }
    c.fillStyle = t.paper;
    roundRect(c, 10, 10, w - 20, h - 20, 12);
    c.fill();
  } else if (theme === "cyber") {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#d0e4ff");
    g.addColorStop(0.28, "#fcfdff");
    g.addColorStop(0.48, "#c0c8e9");
    g.addColorStop(0.7, "#faffff");
    g.addColorStop(1, "#b1cbec");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
}
function renderSheet(canvas, scale = 2, withFilm = false, forLayout = layout) {
  const s = sheetSpec(forLayout);
  canvas.width = Math.round(s.w * scale);
  canvas.height = Math.round(s.h * scale);
  const c = canvas.getContext("2d");
  c.scale(scale, scale);
  if (s.bare) {
    c.fillStyle = "#fff";
    c.fillRect(0, 0, s.w, s.h);
  } else drawPaper(c, s.w, s.h);
  const shots = Array.from({ length: 4 }, (_, i) => finalPhotos?.[i] || decoratedPhoto(i));
  s.pieces.forEach((p) => drawSticker(c, p, shots[p.photo]));
  if (withFilm && film !== "none") drawFilm(c, s.w, s.h);
}
// Laminate patterns sit on a slanted, staggered lattice.
function filmPattern(c, w, h, step, draw) {
  c.save();
  c.translate(w / 2, h / 2);
  c.rotate(-0.42);
  const r = Math.hypot(w, h) / 2 + step;
  for (let row = 0, y = -r; y < r; y += step / 2, row++)
    for (let x = -r + (row % 2 ? step / 2 : 0); x < r; x += step) draw(x, y, row);
  c.restore();
}
function drawFilm(c, w, h) {
  c.save();
  const g = c.createLinearGradient(0, h * 0.8, w, h * 0.1);
  if (film === "rainbow") {
    [
      [0, "#ff86cf"],
      [0.25, "#90d5ff"],
      [0.5, "#fff291"],
      [0.75, "#d49dff"],
      [1, "#9dffee"],
    ].forEach((p) => g.addColorStop(...p));
    c.globalCompositeOperation = "soft-light";
    c.globalAlpha = 0.24;
  } else {
    g.addColorStop(0, "#ffffff00");
    g.addColorStop(0.4, "#ffffff00");
    g.addColorStop(0.5, "#ffffff");
    g.addColorStop(0.62, "#ffffff00");
    g.addColorStop(1, "#ffffff00");
    c.globalAlpha = 0.18;
  }
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  if (film === "dots") {
    c.globalAlpha = 0.2;
    c.fillStyle = "#fff";
    filmPattern(c, w, h, 24, (x, y) => {
      c.beginPath();
      c.arc(x, y, 2.7, 0, Math.PI * 2);
      c.fill();
    });
  } else if (film === "stars") {
    c.globalAlpha = 0.24;
    filmPattern(c, w, h, 32, (x, y, row) => drawShape(c, row % 2 ? "spark" : "star", x, y, row % 2 ? 12 : 10, "#fff"));
  } else if (film === "hearts") {
    c.globalAlpha = 0.22;
    filmPattern(c, w, h, 32, (x, y) => drawShape(c, "heart", x, y, 11, "#ffe8f4"));
  }
  c.restore();
}
// Picker icons are drawn from the same specs as the sheets, so they follow the session's orientation.
function buildLayoutIcons() {
  document.querySelectorAll("[data-layout]").forEach((b) => {
    const s = sheetSpec(b.dataset.layout),
      svg = b.querySelector("svg");
    svg.setAttribute("viewBox", "0 0 " + s.w + " " + s.h);
    svg.innerHTML =
      `<rect width="${s.w}" height="${s.h}" rx="16" fill="#fff" stroke="currentColor" stroke-width="12"/><g style="fill:var(--accent)">` +
      s.pieces
        .map(({ shape, x, y, w, h, flush }) =>
          flush
            ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="#fff" stroke-width="12"/>`
            : shape === "oval"
              ? `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"/>`
              : shape === "heart"
                ? `<path d="${SHAPES.heart}" transform="translate(${x + w / 2} ${y + h / 2}) scale(${Math.min(w / 19, h / 16.5)}) translate(-12 -12.25)"/>`
                : shape === "arch"
                  ? `<path d="M${x} ${y + h}V${y + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2}V${y + h}Z"/>`
                  : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${shape === "pill" ? Math.min(w, h) / 2 : shape === "stamp" ? 0 : Math.min(w, h) * 0.08}"/>`,
        )
        .join("") +
      "</g>";
  });
}
function finishEdit() {
  if (stage !== "edit") return;
  updateClock();
  finishGesture();
  editLocked = true;
  finalPhotos = Array.from({ length: 4 }, (_, i) => decoratedPhoto(i));
  setStage("layout");
  buildLayoutIcons();
  renderSheet($("layoutCanvas"));
  status("裝飾完成。選擇喜歡的版面，就能印刷。");
}
function clearExport() {
  exportToken++;
  exportBlob = null;
  exportFile = null;
  for (const id of ["saveBtn", "shareBtn"]) $(id).disabled = true;
}
async function prepareExport() {
  clearExport();
  const token = exportToken;
  $("exportStatus").hidden = true;
  $("exportStatus").textContent = "";
  await sleep(20);
  if (token !== exportToken || stage !== "result") return;
  try {
    const c = makeCanvas(1, 1);
    renderSheet(c, 3, true);
    const blob = await new Promise((resolve, reject) =>
      c.toBlob((b) => (b ? resolve(b) : reject(Error("encode"))), "image/png"),
    );
    if (token !== exportToken || stage !== "result") return;
    exportBlob = blob;
    exportFile = new File([blob], "puri-club-" + theme + "-" + Date.now() + ".png", { type: "image/png" });
    for (const id of ["saveBtn", "shareBtn"]) $(id).disabled = false;
  } catch (e) {
    $("exportStatus").textContent = "印刷未完成，請重新選擇膜款再試一次。";
    $("exportStatus").hidden = false;
  }
}
function showResult() {
  setStage("result");
  renderSheet($("resultCanvas"));
  $("foilCard").dataset.film = film;
  $("motionBtn").hidden = typeof DeviceOrientationEvent === "undefined";
  resetTilt();
  prepareExport();
  status("拍貼印好了！幫它上膜，或直接存圖帶回家。");
}
function openImage() {
  if (!exportBlob) return;
  if (imageURL) URL.revokeObjectURL(imageURL);
  imageURL = URL.createObjectURL(exportBlob);
  $("saveImage").src = imageURL;
  $("imageDialog").showModal();
}
// iPhone, iPad and in-app browsers don't save downloads where people look for photos, so there 存圖 opens the image for a long-press save.
const longPressSave =
  /iP(hone|ad|od)|Line\/|Instagram|FBAN|FBAV|MicroMessenger/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function savePNG() {
  if (!exportBlob) return;
  if (longPressSave) {
    openImage();
    status("長按圖片就能存到相簿。");
    return;
  }
  const url = URL.createObjectURL(exportBlob),
    a = document.createElement("a");
  a.href = url;
  a.download = exportFile.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  status("已送出圖片下載。");
}
async function share() {
  if (!exportFile) return;
  if (!navigator.canShare?.({ files: [exportFile] }) || !navigator.share) {
    openImage();
    status("此瀏覽器沒有圖片分享功能，可長按儲存後分享。");
    return;
  }
  try {
    await navigator.share({ files: [exportFile] });
  } catch (e) {
    if (e.name !== "AbortError") status("分享未完成，可以改用存圖。");
  }
}
function tilt(x, y) {
  if (stage !== "result" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const card = $("foilCard");
  card.style.transform = "rotateX(" + -y * 20 + "deg) rotateY(" + x * 24 + "deg)";
  card.style.setProperty("--shine-x", 50 + x * 70 + "%");
  card.style.setProperty("--shine-y", 50 + y * 70 + "%");
  card.style.setProperty("--tilt-x", x);
  card.style.setProperty("--tilt-y", y);
}
function resetTilt() {
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
let tiltDrag = null;
$("tiltArea").addEventListener("pointerdown", (e) => {
  if (motionEnabled || e.button > 0 || e.target.closest("#motionBtn")) return;
  e.preventDefault();
  tiltDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  $("tiltArea").setPointerCapture(e.pointerId);
  $("tiltArea").classList.add("dragging");
});
$("tiltArea").addEventListener("pointermove", (e) => {
  if (motionEnabled) return;
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
  if (!tiltDrag && !motionEnabled) resetTilt();
});
window.addEventListener("deviceorientation", (e) => {
  if (motionEnabled && e.gamma !== null && e.beta !== null)
    tilt(clamp(e.gamma / 16, -1, 1), clamp((e.beta - 45) / 18, -1, 1));
});
function setMotion(on) {
  motionEnabled = on;
  $("motionBtn").setAttribute("aria-label", on ? "關閉手機感應" : "跟著手機轉動");
  $("motionBtn").setAttribute("aria-pressed", String(on));
  if (!on) resetTilt();
}
$("motionBtn").onclick = async () => {
  try {
    if (
      !motionEnabled &&
      typeof DeviceOrientationEvent.requestPermission === "function" &&
      (await DeviceOrientationEvent.requestPermission()) !== "granted"
    ) {
      status("感應器未開啟，仍然可以用手指拖曳相片。");
      return;
    }
    setMotion(!motionEnabled);
  } catch (e) {
    status("此裝置無法使用方向感應，試著用手指拖曳相片。");
  }
};
const machineCards = [...document.querySelectorAll(".machine")];
const openingDurationMs = 620,
  openingStaggerMs = openingDurationMs;
machineCards.forEach((card, index) => {
  for (const className of ["exit-shade", "opening-shade"]) {
    const shade = document.createElement("span");
    shade.className = className;
    shade.setAttribute("aria-hidden", "true");
    if (className === "opening-shade") shade.style.transitionDelay = index * openingStaggerMs + "ms";
    card.append(shade);
  }
});
// Each poster cycles its ornament through three spots, each with its own size and pace.
const ORNAMENT_SLOTS = {
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
const ORNAMENT_ANIMATION = { gal: "ornamentTurn", hara: "wanderingStar", cyber: "angelBloom" };
function placeOrnament(img, slot) {
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
let lobbyOpening = true;
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
let visibleMachine = 0;
function showMachine(index) {
  visibleMachine = (index + machineCards.length) % machineCards.length;
  machineCards.forEach((card, i) => card.classList.toggle("is-active", i === visibleMachine));
  $("lobbyMachines").setAttribute(
    "aria-label",
    "目前顯示 " + THEMES[machineCards[visibleMachine].querySelector("[data-machine]").dataset.machine].name,
  );
  $("machineIndex").textContent = visibleMachine + 1 + "/" + machineCards.length;
}
showMachine(0);
$("prevMachine").onclick = () => showMachine(visibleMachine - 1);
$("nextMachine").onclick = () => showMachine(visibleMachine + 1);
let enteringMachine = false;
async function enterMachine(nextTheme) {
  if (stage !== "lobby" || lobbyOpening || enteringMachine) return;
  enteringMachine = true;
  theme = nextTheme;
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
document.querySelectorAll("[data-machine]").forEach((b) => (b.onclick = () => enterMachine(b.dataset.machine)));
machineCards.forEach((card) =>
  card.addEventListener("click", (e) => {
    if (stage !== "lobby" || !matchMedia("(min-width:761px)").matches || e.target.closest(".choose")) return;
    card.querySelector(".choose").click();
  }),
);
document.querySelectorAll("[data-look]").forEach(
  (b) =>
    (b.onclick = () => {
      if (stage !== "start" || running) return;
      look = b.dataset.look;
      selectButtons("[data-look]", "look", look);
      if (cameraBusy) return;
      if (!cameraReady) {
        startCamera();
        return;
      }
      photos = Array(4).fill(null);
      processed = Array(4).fill(null);
      retakes = [0, 0, 0, 0];
      reviewDeadline = 0;
      reviewLocked = false;
      captureSequence([0, 1, 2, 3]);
    }),
);
$("timeToggle").onclick = () => {
  timed = !timed;
  $("timeToggle").innerHTML = icon(timed ? "timer" : "infinity");
  $("timeToggle").setAttribute(
    "aria-label",
    !timed
      ? "不限時模式，點擊切換限時"
      : "限時模式：檢查照片 " + REVIEW_SECONDS + " 秒、裝飾 " + EDIT_SECONDS + " 秒，點擊切換不限時",
  );
};
$("enableCamera").onclick = startCamera;
$("flipBtn").onclick = () => {
  facing = facing === "user" ? "environment" : "user";
  startCamera();
};
$("backLobby").onclick = () => setStage("lobby");
$("resumeBtn").onclick = async () => {
  if (cameraBusy || running) return;
  $("resumeBtn").disabled = true;
  try {
    if (await startCamera()) {
      if (!pendingSlots.length && photos.every(Boolean)) {
        retakeSlot = null;
        showReview();
      } else await captureSequence([...pendingSlots], retakeSlot !== null);
    }
  } finally {
    $("resumeBtn").disabled = false;
  }
};
$("reviewDone").onclick = beginEdit;
$("importEntry").onclick = () => {
  photos = Array(4).fill(null);
  processed = Array(4).fill(null);
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
      brushCategory = b.dataset.brushCategory;
      brushMode = brushCategory === "pattern" ? patternPreset : brushCategory;
      syncBrushUI();
    }),
);
document.querySelectorAll("[data-brush-preset]").forEach(
  (b) =>
    (b.onclick = () => {
      if (!canEdit()) return;
      patternPreset = b.dataset.brushPreset;
      brushCategory = "pattern";
      brushMode = patternPreset;
      syncBrushUI();
    }),
);
$("brushSize").oninput = (e) => {
  if (!canEdit()) return;
  brushSize = Number(e.target.value);
  syncBrushUI();
};
$("undoBtn").onclick = undo;
// One-tap magic picks from hand-made stamp sets instead of scattering stamps at random. Each stamp is
// [key, x, y, size, degrees]: x and y are fractions of the photo's width and height, and size is a fraction of its
// short edge, so a set fits both orientations; a set with "only":"portrait" or "landscape" is used in that one alone.
// Sets leave the face area clear, hold at most one word, and skip frame and accessory stamps (lace, tape, chains, pearls…).
// To add sets, open the page with ?magic-dev, arrange a photo by hand and copy it with the export button.
const MAGIC_SETS = {
  gal: [
    {
      stamps: [
        ["109-style/109-03-crown", 0.2, 0.17, 0.41, -14],
        ["109-style/109-16-gems", 0.39, 0.08, 0.14, 10],
        ["109-style/109-14-stars", 0.08, 0.38, 0.16, 0],
        ["109-style/109-13-kiss", 0.84, 0.83, 0.32, 12],
        ["shared/PW-10_love", 0.19, 0.88, 0.3, -6],
      ],
    },
    {
      stamps: [
        ["109-style/109-04-butterfly", 0.83, 0.18, 0.41, 14],
        ["109-style/109-01-heart", 0.17, 0.16, 0.23, -10],
        ["109-style/109-04-butterfly", 0.15, 0.82, 0.26, -16],
        ["109-style/109-14-stars", 0.88, 0.66, 0.16, 0],
      ],
    },
    {
      stamps: [
        ["109-style/109-07-bow", 0.18, 0.15, 0.36, -8],
        ["109-style/109-01-heart", 0.85, 0.82, 0.31, 10],
        ["109-style/109-16-gems", 0.9, 0.63, 0.12, 0],
        ["109-style/109-14-stars", 0.09, 0.62, 0.15, 0],
        ["shared/PW-01_zuttomo", 0.8, 0.12, 0.3, 8],
      ],
    },
    {
      stamps: [
        ["109-style/109-13-kiss", 0.85, 0.16, 0.31, 16],
        ["109-style/109-01-heart", 0.13, 0.83, 0.28, -12],
        ["109-style/109-16-gems", 0.3, 0.92, 0.12, 0],
        ["109-style/109-14-stars", 0.68, 0.08, 0.14, 0],
        ["shared/PW-12_daisuki", 0.2, 0.12, 0.3, -8],
      ],
    },
    {
      stamps: [
        ["shared/PB-01_hand-heart", 0.15, 0.82, 0.32, -10],
        ["109-style/109-03-crown", 0.85, 0.15, 0.31, 12],
        ["shared/PB-05_sparkle-group", 0.13, 0.16, 0.2, 0],
        ["109-style/109-16-gems", 0.9, 0.4, 0.12, 0],
        ["shared/PW-05_best-friends", 0.74, 0.89, 0.41, -4],
      ],
    },
  ],
  hara: [
    {
      stamps: [
        ["harajuku-mix/01-bubble-star", 0.16, 0.16, 0.38, -12],
        ["harajuku-mix/13-three-stars", 0.86, 0.14, 0.24, 10],
        ["harajuku-mix/03-six-flower", 0.86, 0.83, 0.32, 8],
        ["harajuku-mix/18-paper-confetti", 0.12, 0.86, 0.22, 0],
        ["shared/PW-06_itsumen", 0.5, 0.92, 0.3, -3],
      ],
    },
    {
      stamps: [
        ["harajuku-mix/02-checker-heart", 0.84, 0.18, 0.35, 12],
        ["harajuku-mix/14-rays", 0.14, 0.14, 0.27, 0],
        ["harajuku-mix/07-checker-bow", 0.15, 0.84, 0.32, -10],
        ["shared/PB-07_daisy", 0.88, 0.82, 0.19, 0],
      ],
    },
    {
      stamps: [
        ["harajuku-mix/03-six-flower", 0.15, 0.18, 0.35, -6],
        ["shared/PB-07_daisy", 0.34, 0.08, 0.15, 0],
        ["harajuku-mix/01-bubble-star", 0.86, 0.82, 0.32, 14],
        ["harajuku-mix/13-three-stars", 0.86, 0.2, 0.19, -8],
        ["shared/PW-07_saikyou-combi", 0.25, 0.88, 0.38, -5],
      ],
    },
    {
      stamps: [
        ["harajuku-mix/07-checker-bow", 0.18, 0.14, 0.32, -12],
        ["harajuku-mix/14-rays", 0.86, 0.84, 0.3, 0],
        ["harajuku-mix/01-bubble-star", 0.84, 0.16, 0.2, 10],
        ["harajuku-mix/02-checker-heart", 0.12, 0.82, 0.22, -8],
        ["shared/PB-06_smile-badge", 0.9, 0.6, 0.15, 0],
      ],
    },
    {
      stamps: [
        ["harajuku-mix/18-paper-confetti", 0.84, 0.14, 0.32, 0],
        ["harajuku-mix/03-six-flower", 0.16, 0.84, 0.3, 8],
        ["harajuku-mix/13-three-stars", 0.14, 0.16, 0.22, -10],
        ["shared/PW-08_muteki", 0.85, 0.85, 0.27, 8],
      ],
    },
  ],
  cyber: [
    {
      stamps: [
        ["cyber-angel/05-angel-wings", 0.18, 0.15, 0.41, -10],
        ["cyber-angel/13-ice-stars", 0.86, 0.14, 0.22, 0],
        ["cyber-angel/01-ice-butterfly", 0.85, 0.82, 0.35, 12],
        ["cyber-angel/14-glass-bubbles", 0.12, 0.82, 0.19, 0],
      ],
    },
    {
      stamps: [
        ["cyber-angel/01-ice-butterfly", 0.16, 0.18, 0.38, -14],
        ["cyber-angel/03-chrome-heart", 0.86, 0.84, 0.3, 10],
        ["cyber-angel/15-rhinestone-diamond", 0.9, 0.62, 0.14, 0],
        ["cyber-angel/13-ice-stars", 0.84, 0.14, 0.16, 0],
        ["shared/PW-15_omoide", 0.2, 0.88, 0.3, -6],
      ],
    },
    {
      stamps: [
        ["cyber-angel/07-ice-bow", 0.84, 0.16, 0.35, 12],
        ["cyber-angel/03-chrome-heart", 0.14, 0.82, 0.27, -10],
        ["cyber-angel/14-glass-bubbles", 0.12, 0.2, 0.19, 0],
        ["cyber-angel/13-ice-stars", 0.88, 0.82, 0.19, 0],
        ["cyber-angel/15-rhinestone-diamond", 0.32, 0.08, 0.12, -12],
      ],
    },
    {
      stamps: [
        ["cyber-angel/03-chrome-heart", 0.18, 0.16, 0.32, -12],
        ["cyber-angel/05-angel-wings", 0.84, 0.84, 0.35, 8],
        ["cyber-angel/15-rhinestone-diamond", 0.36, 0.08, 0.12, 15],
        ["shared/PB-05_sparkle-group", 0.88, 0.16, 0.19, 0],
        ["cyber-angel/14-glass-bubbles", 0.14, 0.86, 0.2, 0],
      ],
    },
    {
      stamps: [
        ["cyber-angel/13-ice-stars", 0.14, 0.14, 0.27, 0],
        ["cyber-angel/01-ice-butterfly", 0.86, 0.2, 0.3, 14],
        ["cyber-angel/01-ice-butterfly", 0.82, 0.84, 0.19, -10],
        ["cyber-angel/14-glass-bubbles", 0.16, 0.84, 0.22, 0],
      ],
    },
  ],
};
let magicTurns = [0, 0, 0, 0];
// Each tap swaps the previous magic stamps for the next set. Photo n starts n sets in so the four photos differ, and
// every other pass through the list is mirrored. Stamps the player moves or turns stop counting as magic and stay put.
$("autoDecor").onclick = () => {
  if (!canEdit()) return;
  const sets = MAGIC_SETS[theme].filter((s) => !s.only || s.only === orient),
    turn = activePhoto + magicTurns[activePhoto],
    set = sets[turn % sets.length],
    flip = Math.floor(turn / sets.length) % 2 === 1,
    keep = objects().filter((o) => !o.magic);
  if (keep.length + set.stamps.length > 200) return;
  magicTurns[activePhoto]++;
  remember();
  selectedId = null;
  const short = Math.min(PW, PH);
  // A stamp that would hang off the photo is nudged back inside, using its turned bounding box.
  decorations[activePhoto] = keep.concat(
    set.stamps.map(([key, x, y, size, deg]) => {
      const rotation = ((flip ? -deg : deg) * Math.PI) / 180,
        px = Math.round(size * short),
        { w, h } = stampDims(key, px),
        bw = Math.abs(w * Math.cos(rotation)) + Math.abs(h * Math.sin(rotation)),
        bh = Math.abs(w * Math.sin(rotation)) + Math.abs(h * Math.cos(rotation));
      return {
        id: nextId++,
        type: "stamp",
        key,
        x: clamp((flip ? 1 - x : x) * PW, bw / 2 + 6, PW - bw / 2 - 6),
        y: clamp(y * PH, bh / 2 + 6, PH - bh / 2 - 6),
        size: px,
        rotation,
        magic: true,
      };
    }),
  );
  renderEditor();
  status("魔法套組 " + ((turn % sets.length) + 1) + " / " + sets.length + (flip ? "（鏡像）" : ""));
};
// Authoring aid for MAGIC_SETS: ?magic-dev shows a button that copies the current photo's stamps as one set.
if (new URLSearchParams(location.search).has("magic-dev")) {
  const b = $("exportMagic");
  b.hidden = false;
  b.onclick = async () => {
    const r = (n) => Math.round(n * 1000) / 1000,
      short = Math.min(PW, PH),
      stamps = objects()
        .filter((o) => o.type === "stamp")
        .map((o) => [
          o.key,
          r(o.x / PW),
          r(o.y / PH),
          r(o.size / short),
          Math.round((normAngle(o.rotation) * 180) / Math.PI),
        ]),
      text = JSON.stringify({ stamps });
    try {
      await navigator.clipboard.writeText(text);
      status(
        "已複製 " + stamps.length + " 個印章的套組資料（" + (orient === "portrait" ? "直式" : "橫式") + "照片）。",
      );
    } catch (e) {
      prompt("複製這段套組資料：", text);
    }
  };
}
$("editDone").onclick = finishEdit;
document.querySelectorAll("[data-layout]").forEach(
  (b) =>
    (b.onclick = () => {
      layout = b.dataset.layout;
      selectButtons("[data-layout]", "layout", layout);
      renderSheet($("layoutCanvas"));
    }),
); // 印這張 plays a short print-out: the finished sheet feeds out of the booth slot before the film step shows.
// The result page renders and starts exporting underneath, and a tap anywhere skips the wait.
let printTimers = [];
function endPrinting() {
  printTimers.forEach(clearTimeout);
  printTimers = [];
  $("printing").hidden = true;
}
function printSheet() {
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
$("printing").onclick = endPrinting;
$("printBtn").onclick = printSheet;
document.querySelectorAll("button[data-film]").forEach(
  (b) =>
    (b.onclick = () => {
      film = b.dataset.film;
      selectButtons("button[data-film]", "film", film);
      $("foilCard").dataset.film = film;
      resetTilt();
      prepareExport();
    }),
);
$("saveBtn").onclick = savePNG;
$("shareBtn").onclick = share;
$("closeImage").onclick = () => $("imageDialog").close();
$("imageDialog").addEventListener("close", () => {
  if (imageURL) URL.revokeObjectURL(imageURL);
  imageURL = null;
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
$("restartYes").onclick = () => {
  $("restartDialog").close();
  sequenceToken++;
  running = false;
  clearExport();
  photos = Array(4).fill(null);
  processed = Array(4).fill(null);
  finalPhotos = null;
  decorations = Array.from({ length: 4 }, () => []);
  histories = Array.from({ length: 4 }, () => []);
  retakes = [0, 0, 0, 0];
  gesture = null;
  editLocked = false;
  reviewDeadline = 0;
  reviewLocked = false;
  tool = "stamp";
  stampKey = STAMP_SETS[theme][0][0];
  brushCategory = "solid";
  brushMode = "solid";
  patternPreset = "dots";
  drawColor = "#f73692";
  brushSize = 7;
  $("brushSize").value = 7;
  glowColor = GLOW_COLORS[0];
  syncBrushUI();
  film = "none";
  layout = "split";
  timed = true;
  setMotion(false);
  $("timeToggle").innerHTML = icon("timer");
  $("timeToggle").setAttribute(
    "aria-label",
    "限時模式：檢查照片 " + REVIEW_SECONDS + " 秒、裝飾 " + EDIT_SECONDS + " 秒，點擊切換不限時",
  );
  selectButtons("button[data-film]", "film", film);
  selectButtons("[data-layout]", "layout", layout);
  resetTilt();
  setStage("lobby");
  status("再選一台，製造新的回憶");
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && ["start", "shoot", "review"].includes(stage))
    interruptCapture("相機已暫停，回來後重新開啟就能繼續。");
  if (stage === "edit") updateClock();
});
window.addEventListener("pagehide", () => {
  sequenceToken++;
  running = false;
  stopCamera();
});
window.addEventListener("keydown", (e) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (stage === "edit" && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
  } else if (
    stage === "edit" &&
    tool === "adjust" &&
    (e.key === "Delete" || e.key === "Backspace") &&
    selectedStamp()
  ) {
    e.preventDefault();
    deleteSelectedStamp();
  }
});
stampKey = STAMP_SETS[theme][0][0];
buildStampButtons();
syncBrushUI();
setInterval(() => {
  updateClock();
  updateReviewClock();
}, 150);
requestAnimationFrame(previewLoop);
// Dev-only console handle for checking renders against a saved baseline; the build drops it.
if (import.meta.env.DEV) window.__puri = { eval: (code) => eval(code) };
