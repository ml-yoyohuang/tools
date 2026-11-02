// Stamp images: loading, sizing and drawing.
import { STAMP_DIR } from "./data/stamps.js";
import { queueEditorRender } from "./editor.js";
import { state } from "./state.js";

export const stampImages = new Map();

export function stampImage(key) {
  let img = stampImages.get(key);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (state.stage === "edit") queueEditorRender();
    };
    img.src = STAMP_DIR + key + ".webp";
    stampImages.set(key, img);
  }
  return img;
}

// Words read smaller than pictures at the same box size, so they get a little extra room.
export function stampDims(key, size) {
  const img = stampImage(key);
  if (!img.naturalWidth) return { img, w: size, h: size };
  const k = (size * (key.includes("/PW-") ? 1.35 : 1)) / Math.max(img.naturalWidth, img.naturalHeight);
  return { img, w: img.naturalWidth * k, h: img.naturalHeight * k };
}

export function drawStamp(c, key, x, y, size, rotation = 0) {
  const { img, w, h } = stampDims(key, size);
  if (!img.complete || !img.naturalWidth) return;
  c.save();
  c.translate(x, y);
  c.rotate(rotation);
  c.drawImage(img, -w / 2, -h / 2, w, h);
  c.restore();
}
