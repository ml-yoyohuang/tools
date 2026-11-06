// 把圖庫作品畫出來：作品牆的縮圖（輕量版質感）、選圖片的縮圖、進入製版用的各層。
import { generatorById } from './registry.js';
import { composeMasks } from './compose.js';
import { flatComposite } from '../engine/flat.js';
import { DESIGN, DESIGN_PX, drawRegistration } from '../plates/registration.js';

const SHEET = 600;
const GROUND = [245, 240, 230];
const specOf = item => ({ gen: generatorById(item.genId), layout: item.layout, seed: item.seed, n: item.n });

// 進入製版：各層遮罩（DESIGN_PX × DESIGN_PX）與預覽圖
const imageCache = new Map();
export function itemImage(item) {
  if (imageCache.has(item.id)) return imageCache.get(item.id);
  const layers = composeMasks(specOf(item), DESIGN_PX);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = DESIGN_PX;
  const x = canvas.getContext('2d'), img = x.createImageData(DESIGN_PX, DESIGN_PX);
  flatComposite(layers, item.inks.map(i => i.rgb), GROUND, img.data);
  x.putImageData(img, 0, 0);
  const image = {
    id: item.id, name: item.name, colors: item.n, canvas, data: img.data, w: DESIGN_PX, h: DESIGN_PX,
    layers, inks: item.inks.slice()
  };
  imageCache.set(item.id, image);
  return image;
}

// 選圖片站的縮圖：只有圖案區，平塊疊色
export function itemThumb(item, size) {
  const layers = composeMasks(specOf(item), size);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d'), img = x.createImageData(size, size);
  flatComposite(layers, item.inks.map(i => i.rgb), GROUND, img.data);
  x.putImageData(img, 0, 0);
  return c;
}

// 作品牆：整張紙（含十字）、各層輕微錯位、零星飛白
const regCache = new Map();
function registration(T) {
  if (regCache.has(T)) return regCache.get(T);
  const c = document.createElement('canvas');
  c.width = c.height = T;
  const x = c.getContext('2d');
  x.setTransform(T / SHEET, 0, 0, T / SHEET, 0, 0);
  x.strokeStyle = '#000';
  drawRegistration(x);
  const d = x.getImageData(0, 0, T, T).data, m = new Float32Array(T * T);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] / 255;
  regCache.set(T, m);
  return m;
}

export function drawWallPrint(item, canvas) {
  const T = canvas.width, k = T / SHEET;
  const D = Math.round(DESIGN.size * k), o = Math.round(DESIGN.x * k);
  const design = composeMasks(specOf(item), D), reg = registration(T);
  const density = item.medium.density ?? 1;
  const out = new Uint8ClampedArray(T * T * 4);
  const paper = item.medium.paper;
  const layers = design.map((m, li) => {
    const sheet = new Float32Array(T * T);
    for (let y = 0; y < D; y++) sheet.set(m.subarray(y * D, (y + 1) * D), (o + y) * T + o);
    for (let i = 0; i < sheet.length; i++) if (reg[i] > sheet[i]) sheet[i] = reg[i];
    // 零星飛白：約 5% 的 2px 小點
    const G = Math.ceil(T / 2), speck = new Uint8Array(G * G);
    for (let i = 0; i < speck.length; i++) speck[i] = Math.random() < 0.05 ? 1 : 0;
    // 縮圖很小，錯位放大一點才看得出手感
    const [dx, dy] = item.offsets[li].map(v => Math.round(v * k * 1.6));
    return { sheet, speck, G, dx, dy, c: item.inks[li].rgb.map(v => v / 255) };
  });
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let r = paper[0], g = paper[1], b = paper[2];
    for (const l of layers) {
      const sx = x - l.dx, sy = y - l.dy;
      if (sx < 0 || sy < 0 || sx >= T || sy >= T) continue;
      let a = l.sheet[sy * T + sx];
      if (!(a > 0)) continue;
      if (l.speck[(y >> 1) * l.G + (x >> 1)]) a *= 0.15;
      a *= density;
      r *= 1 - a + a * l.c[0]; g *= 1 - a + a * l.c[1]; b *= 1 - a + a * l.c[2];
    }
    const j = (y * T + x) * 4;
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = 255;
  }
  canvas.getContext('2d').putImageData(new ImageData(out, T, T), 0, 0);
}
