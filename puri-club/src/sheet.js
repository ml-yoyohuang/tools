// Sticker sheets: layouts, sticker shapes, booth papers and the layout picker icons.
import { THEMES } from "./data/themes.js";
import { decoratedPhoto } from "./editor.js";
import { drawFilm } from "./film.js";
import { state } from "./state.js";
import { $, SHAPES, cropDraw, roundRect } from "./util.js";

// Sheets are sticker sheets: every piece is one photo, cut apart along thin lines.
// "split" packs square-cornered pieces edge to edge with no backing paper, turned sideways for landscape photos;
// "eight" prints each photo twice on themed paper, once in a rounded frame and once in a shaped window.
// Its photos bleed SHEET_BLEED past the half-cut line, so a slightly off cut never shows paper.
export const SHEET_MARGIN = 20,
  SHEET_BLEED = 6;

// Each 5 × 4 cell quarter of the split sheet holds all four photos (1 large, 2 medium, 3 small), so it can be cut into four full sets.
// A quarter only tiles four ways, so each one uses a different tiling; pieces are listed large, medium, medium, small, small, small.
export const SPLIT_QUARTERS = [
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

export const WINDOW_SHAPES = {
  portrait: ["oval", "arch", "pill", "stamp"],
  landscape: ["oval", "heart", "pill", "stamp"],
};

export function sheetSpec(forLayout = state.layout) {
  const portrait = state.PH > state.PW,
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
          shape: k ? WINDOW_SHAPES[state.orient][i] : "rect",
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

export function stickerPath(shape, x, y, w, h) {
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
export function drawSticker(c, piece, img) {
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
export const PAPER_ART = {
    gal: { wide: "assets/109-style-leopard-paper.webp" },
    hara: { tall: "assets/harajuku-mix-flat-background.webp" },
    cyber: { tall: "assets/cyber-angel-flat-background.webp", wide: "assets/cyber-angel-flat-background-landscape.webp" },
  },
  paperImages = new Map();

export function paperImage(src) {
  let img = paperImages.get(src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (state.stage === "layout") renderSheet($("layoutCanvas"));
    };
    img.src = src;
    paperImages.set(src, img);
  }
  return img;
}

export function drawArtPaper(c, w, h, art) {
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

export function drawPaper(c, w, h) {
  const t = THEMES[state.theme];
  c.fillStyle = t.paper;
  c.fillRect(0, 0, w, h);
  if (PAPER_ART[state.theme] && drawArtPaper(c, w, h, PAPER_ART[state.theme]));
  else if (state.theme === "hara") {
    for (let y = 0; y < h; y += 18)
      for (let x = 0; x < w; x += 18) {
        c.fillStyle = (x / 18 + y / 18) % 2 ? t.secondary : "#ba87cf";
        c.fillRect(x, y, 18, 18);
      }
    c.fillStyle = t.paper;
    roundRect(c, 10, 10, w - 20, h - 20, 12);
    c.fill();
  } else if (state.theme === "cyber") {
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

export function renderSheet(canvas, scale = 2, withFilm = false, forLayout = state.layout) {
  const s = sheetSpec(forLayout);
  canvas.width = Math.round(s.w * scale);
  canvas.height = Math.round(s.h * scale);
  const c = canvas.getContext("2d");
  c.scale(scale, scale);
  if (s.bare) {
    c.fillStyle = "#fff";
    c.fillRect(0, 0, s.w, s.h);
  } else drawPaper(c, s.w, s.h);
  const shots = Array.from({ length: 4 }, (_, i) => state.finalPhotos?.[i] || decoratedPhoto(i));
  s.pieces.forEach((p) => drawSticker(c, p, shots[p.photo]));
  if (withFilm && state.film !== "none") drawFilm(c, s.w, s.h);
}

// Picker icons are drawn from the same specs as the sheets, so they follow the session's orientation.
export function buildLayoutIcons() {
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
