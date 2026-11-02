// Laminate film patterns drawn onto the exported sheet.
import { state } from "./state.js";
import { drawShape } from "./util.js";

// Laminate patterns sit on a slanted, staggered lattice.
export function filmPattern(c, w, h, step, draw) {
  c.save();
  c.translate(w / 2, h / 2);
  c.rotate(-0.42);
  const r = Math.hypot(w, h) / 2 + step;
  for (let row = 0, y = -r; y < r; y += step / 2, row++)
    for (let x = -r + (row % 2 ? step / 2 : 0); x < r; x += step) draw(x, y, row);
  c.restore();
}

export function drawFilm(c, w, h) {
  c.save();
  const g = c.createLinearGradient(0, h * 0.8, w, h * 0.1);
  if (state.film === "rainbow") {
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
  if (state.film === "dots") {
    c.globalAlpha = 0.2;
    c.fillStyle = "#fff";
    filmPattern(c, w, h, 24, (x, y) => {
      c.beginPath();
      c.arc(x, y, 2.7, 0, Math.PI * 2);
      c.fill();
    });
  } else if (state.film === "stars") {
    c.globalAlpha = 0.24;
    filmPattern(c, w, h, 32, (x, y, row) => drawShape(c, row % 2 ? "spark" : "star", x, y, row % 2 ? 12 : 10, "#fff"));
  } else if (state.film === "hearts") {
    c.globalAlpha = 0.22;
    filmPattern(c, w, h, 32, (x, y) => drawShape(c, "heart", x, y, 11, "#ffe8f4"));
  }
  c.restore();
}
