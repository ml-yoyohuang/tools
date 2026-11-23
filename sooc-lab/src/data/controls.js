// Camera-native adjustments.
//   slider  → adds a delta (0 = filter default)
//   segment → sets an absolute value; `from(params)` reads the filter's own setting
// Flags: color (hidden for monochrome filters), filmOnly (Ricoh grain: B&W / Film / Cinema only),
//        geometry (handled by the app as a crop, not by the pipeline).

const nearest = (values, v) => values.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(values[best] - v) ? i : best), 0);

const slider = (label, min, max, apply, flags = {}) => ({ type: 'slider', label, min, max, step: 1, apply, ...flags });
const segment = (label, options, values, get, set, flags = {}) => ({
  type: 'segment', label, options, values,
  from: (p) => nearest(values, get(p)),
  apply: (p, i, adj) => set(p, values[i], adj, i),
  ...flags,
});
// Variant pickers: index 0 is the filter as defined; others layer extra params on top.
const variant = (label, options, layers, flags = {}) => ({
  type: 'segment', label, options,
  from: () => 0,
  apply: (p, i, adj) => { const l = layers[i]; if (typeof l === 'function') l(p, adj); else if (l) deepAdd(p, l); },
  ...flags,
});
function deepAdd(p, layer) {
  for (const k in layer) {
    const v = layer[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) deepAdd(p[k], v);
    else p[k] = v;
  }
}

const MIXERS = {
  none: [0.2126, 0.7152, 0.0722],
  yellow: [0.42, 0.62, -0.04],
  orange: [0.58, 0.5, -0.08],
  red: [0.88, 0.3, -0.18],
  green: [0.02, 1.1, -0.12],
};
export { MIXERS };

// seeded random for Cross Processing "隨機"
function rng(seed) {
  let s = Math.floor(seed * 2 ** 31) || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const grain = (label, values, flags) => segment(label, ['關', '弱', '中', '強'].slice(0, values.length), values, (p) => p.grain.amount, (p, v) => { p.grain.amount = v; }, flags);

export const CONTROLS = {
  // ---------- shared ----------
  saturation: slider('飽和度', -4, 4, (p, v) => { p.saturation += v * 0.08; }, { color: true }),
  contrast: slider('對比', -4, 4, (p, v) => { p.contrast += v * 0.1; }),
  sharpness: slider('銳利度', -4, 4, (p, v) => { p.sharpness += v * 0.12; }),

  // ---------- Ricoh GR ----------
  hue: slider('色相', -4, 4, (p, v) => { p.hueShift += v * 5; }, { color: true }),
  key: slider('高調／低調', -4, 4, (p, v) => { p.midtone += v * 0.09; }),
  grainStrength: grain('顆粒強度', [0, 0.25, 0.5, 0.8], { filmOnly: true }),
  grainSize: segment('顆粒大小', ['小', '中', '大'], [0.8, 1.3, 2], (p) => p.grain.size, (p, v) => { p.grain.size = v; }, { filmOnly: true }),
  hdf: segment('HDF', ['關', '開'], [0, 1],
    (p) => (p.diffusion.amount > 0 ? 1 : 0),
    (p, v) => {
      if (v && !p.diffusion.amount) { p.diffusion.amount = 0.5; p.diffusion.threshold = 0.55; p.diffusion.radius = 0.03; p.contrast -= 0.06; }
      if (!v) p.diffusion.amount = 0;
    }),
  hdfStrength: slider('HDF 強度', -4, 4, (p, v) => { p.diffusion.amount = Math.max(0, p.diffusion.amount + v * 0.1); }),
  crossVariant: variant('變體', ['基本', '洋紅', '黃', '綠', '隨機'], [
    null,
    { tint: 0.3, highlightTint: { hue: 325, amount: 0.12 } },
    { temperature: 0.22, highlightTint: { hue: 55, amount: 0.16 } },
    { tint: -0.32, shadowTint: { hue: 150, amount: 0.14 } },
    (p, adj) => {
      const r = rng(adj.crossSeed ?? 0.5);
      p.temperature += (r() - 0.5) * 0.6;
      p.tint += (r() - 0.5) * 0.6;
      p.shadowTint = { hue: r() * 360, amount: 0.08 + r() * 0.1 };
      p.highlightTint = { hue: r() * 360, amount: 0.06 + r() * 0.1 };
    },
  ], { reroll: 4 }),

  // ---------- Ricoh GR Monochrome ----------
  shadowsM: slider('陰影', -4, 4, (p, v) => { p.shadows += v * 0.08; }),
  clarityM: slider('清晰度', -4, 4, (p, v) => { p.clarity += v * 0.1; }),
  toningM: segment('色調', ['無', '棕褐', '硒', '藍'], [0, 1, 2, 3],
    (p) => (p.toning.amount > 0 ? 1 : 0),
    (p, v) => { p.toning = [{ hue: 0, amount: 0 }, { hue: 32, amount: 0.3 }, { hue: 280, amount: 0.1 }, { hue: 214, amount: 0.24 }][v]; }),
  grainM: grain('顆粒', [0, 0.25, 0.5, 0.8]),
  redFilter: segment('紅色濾鏡', ['關', '開'], [0, 1],
    (p) => (p.mixer[0] > 0.6 ? 1 : 0),
    (p, v) => { p.mixer = v ? MIXERS.red : MIXERS.none; }),

  // ---------- Fujifilm ----------
  fujiGrain: segment('顆粒效果', ['關', '弱', '強'], [0, 0.3, 0.55], (p) => p.grain.amount, (p, v) => { p.grain.amount = v; }),
  fujiGrainSize: segment('顆粒大小', ['小', '大'], [1, 1.8], (p) => p.grain.size, (p, v) => { p.grain.size = v; }),
  colorChrome: segment('Color Chrome', ['關', '弱', '強'], [0, 0.5, 1], (p) => p.colorChrome, (p, v) => { p.colorChrome = v; }, { color: true }),
  colorChromeBlue: segment('Color Chrome Blue', ['關', '弱', '強'], [0, 0.5, 1], (p) => p.colorChromeBlue, (p, v) => { p.colorChromeBlue = v; }, { color: true }),
  wbR: slider('白平衡偏移 R', -9, 9, (p, v) => { p.wbShift[0] += v; }, { color: true }),
  wbB: slider('白平衡偏移 B', -9, 9, (p, v) => { p.wbShift[1] += v; }, { color: true }),
  highlightTone: slider('亮部色調', -2, 4, (p, v) => { p.highlights += v * 0.12; }),
  shadowTone: slider('暗部色調', -2, 4, (p, v) => { p.shadows -= v * 0.12; }),
  color: slider('色彩', -4, 4, (p, v) => { p.saturation += v * 0.08; }, { color: true }),
  clarity: slider('清晰度', -5, 5, (p, v) => { p.clarity += v * 0.1; }),
  mediumFormat: segment('中片幅質感', ['關', '弱', '強'], [0, 1, 2], () => 1, (p, v) => mediumFormat(p, v), { always: true }),
  aspect: { type: 'segment', label: '畫面比例', options: ['原始', '3:2', '4:3', '1:1', '16:9', '65:24'], ratios: [0, 3 / 2, 4 / 3, 1, 16 / 9, 65 / 24], from: () => 0, apply: () => {}, geometry: true },

  // ---------- Leica ----------
  lContrast: slider('對比', -2, 2, (p, v) => { p.contrast += v * 0.15; }),
  lHighlights: slider('亮部', -2, 2, (p, v) => { p.highlights += v * 0.15; }),
  lShadows: slider('暗部', -2, 2, (p, v) => { p.shadows += v * 0.15; }),
  lSharpness: slider('銳利度', -2, 2, (p, v) => { p.sharpness += v * 0.2; }),
  lSaturation: slider('飽和度', -2, 2, (p, v) => { p.saturation += v * 0.15; }, { color: true }),

  // ---------- Sony Creative Look ----------
  sContrast: slider('對比', -9, 9, (p, v) => { p.contrast += v * 0.045; }),
  sHighlights: slider('亮部', -9, 9, (p, v) => { p.highlights += v * 0.05; }),
  sShadows: slider('暗部', -9, 9, (p, v) => { p.shadows += v * 0.05; }),
  sFade: slider('褪色', 0, 9, (p, v) => { p.blacks += v * 0.012; }),
  sSaturation: slider('飽和度', -9, 9, (p, v) => { p.saturation += v * 0.04; }, { color: true }),
  sSharpness: slider('銳利度', -9, 9, (p, v) => { p.sharpness += v * 0.06; }),
  sClarity: slider('清晰度', -9, 9, (p, v) => { p.clarity += v * 0.05; }),
  // Sony Creative Style (RX100)
  rContrast: slider('對比', -3, 3, (p, v) => { p.contrast += v * 0.12; }),
  rSaturation: slider('飽和度', -3, 3, (p, v) => { p.saturation += v * 0.1; }, { color: true }),
  rSharpness: slider('銳利度', -3, 3, (p, v) => { p.sharpness += v * 0.15; }),
  toyVariant: variant('色調', ['標準', '冷', '暖', '綠', '洋紅'], [
    null, { temperature: -0.3 }, { temperature: 0.3 }, { tint: -0.35 }, { tint: 0.35 },
  ]),
  posterVariant: variant('色彩', ['彩色', '黑白'], [null, { mono: 1, posterizeMode: 'luma' }]),
  partialVariant: variant('保留色', ['紅', '綠', '藍', '黃'], [
    null, { keepColor: { hue: 120, width: 45 } }, { keepColor: { hue: 215, width: 40 } }, { keepColor: { hue: 55, width: 25 } },
  ]),
  miniPos: slider('清晰位置', -5, 5, (p, v) => { p.miniature.center = Math.min(0.95, Math.max(0.05, p.miniature.center + v * 0.07)); }),

  // ---------- Canon ----------
  cSharpness: slider('銳利度', -4, 4, (p, v) => { p.sharpness += v * 0.12; }),
  cContrast: slider('對比', -4, 4, (p, v) => { p.contrast += v * 0.1; }),
  cSaturation: slider('飽和度', -4, 4, (p, v) => { p.saturation += v * 0.08; }, { color: true }),
  cTone: slider('色調', -4, 4, (p, v) => { p.hueShift += v * 2.5; }, { color: true }),
  canonFilter: segment('濾鏡效果', ['無', '黃', '橙', '紅', '綠'], [0, 1, 2, 3, 4], () => 0,
    (p, v) => { p.mixer = [MIXERS.none, MIXERS.yellow, MIXERS.orange, MIXERS.red, MIXERS.green][v]; }, { monoOnly: true }),
  canonToning: segment('色調效果', ['無', '棕褐', '藍', '紫', '綠'], [0, 1, 2, 3, 4], () => 0,
    (p, v) => { p.toning = [{ hue: 0, amount: 0 }, { hue: 32, amount: 0.32 }, { hue: 214, amount: 0.26 }, { hue: 285, amount: 0.2 }, { hue: 140, amount: 0.2 }][v]; }, { monoOnly: true }),

  // ---------- Panasonic Lumix ----------
  xContrast: slider('對比', -5, 5, (p, v) => { p.contrast += v * 0.08; }),
  xHighlights: slider('亮部', -5, 5, (p, v) => { p.highlights += v * 0.07; }),
  xShadows: slider('暗部', -5, 5, (p, v) => { p.shadows += v * 0.07; }),
  xSaturation: slider('飽和度', -5, 5, (p, v) => { p.saturation += v * 0.07; }, { color: true }),
  xTone: slider('色調', -5, 5, (p, v) => { p.temperature += v * 0.04; }, { color: true }),
  xSharpness: slider('銳利度', -5, 5, (p, v) => { p.sharpness += v * 0.1; }),
  xGrain: segment('顆粒', ['關', '低', '標準', '高'], [0, 0.22, 0.42, 0.65], (p) => p.grain.amount, (p, v) => { p.grain.amount = v; }),
  // ---------- Kodak Charmera (print finishing, drawn after the pipeline) ----------
  chFrame: { type: 'segment', label: '相框', options: ['無', '白邊', '片框', '底片', '幻燈片'], from: () => 0, apply: () => {}, overlay: true },
  chDate: { type: 'segment', label: '日期戳記', options: ['關', '開'], from: () => 0, apply: () => {}, overlay: true },

  skinSoft: segment('柔膚效果', ['關', '開'], [0, 1], (p) => (p.skinSoft > 0 ? 1 : 0), (p, v) => { p.skinSoft = v ? 0.7 : 0; }),
};

// GFX "medium format" rendition: finer grain, smoother tonal transitions.
function mediumFormat(p, level) {
  const k = [0, 1, 1.8][level];
  p.grain.size *= 1 - 0.22 * k;
  p.sharpRadius *= 1 + 0.35 * k;
  p.contrast -= 0.03 * k;
  p.highlights -= 0.03 * k;
  p.shadows += 0.03 * k;
}
