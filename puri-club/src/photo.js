// Photo processing: the retro and soft looks applied to camera and imported photos.
import { state } from "./state.js";
import { clamp, cropDraw, makeCanvas } from "./util.js";

// Reused original photo processing and vector sticker artwork.
export function processPhoto(raw, preview = false) {
  const retro = state.look === "old";
  const low = retro ? 160 : 640;
  const long = preview ? Math.min(low, 320) : low;
  const w = state.PW > state.PH ? long : Math.round(long * 0.75);
  const h = state.PW > state.PH ? Math.round(long * 0.75) : long;
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
    if (state.theme === "gal") {
      r += 4;
      b += 2;
    }
    if (state.theme === "hara") {
      r += 2;
      g += 2;
    }
    if (state.theme === "cyber") {
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

export function drawProcessed(ctx, img, x, y, w, h, mode = state.look) {
  ctx.save();
  ctx.imageSmoothingEnabled = mode !== "old";
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

export function processedWith(raw, mode, preview = false) {
  const previous = state.look;
  state.look = mode;
  try {
    return processPhoto(raw, preview);
  } finally {
    state.look = previous;
  }
}
