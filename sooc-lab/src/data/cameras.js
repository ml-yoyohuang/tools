import { FILTERS } from './filters.js';
import { CONTROLS } from './controls.js';
import { NEUTRAL, merge, lerpParams } from '../engine/params.js';

const ids = (prefix, names) => names.map((n) => `${prefix}-${n}`);

const GR_IV_FILTERS = [
  'gr-standard', 'gr-vivid', 'gr-monotone', 'gr-soft-monotone', 'gr-hard-monotone', 'gr4-hi-contrast-bw',
  'gr-negative-film', 'gr-positive-film', 'gr-cinema-yellow', 'gr-cinema-green', 'gr-bleach-bypass',
  'gr-retro', 'gr-cross-processing', 'gr-hdr-tone',
];
const GR_IIIX_FILTERS = [
  'gr-standard', 'gr-vivid', 'gr-monotone', 'gr-soft-monotone', 'gr-hard-monotone', 'gr4-hi-contrast-bw',
  'gr-positive-film', 'gr-negative-film', 'gr-bleach-bypass', 'gr-retro', 'gr-cross-processing', 'gr-hdr-tone',
];
const GR_CONTROLS = ['saturation', 'hue', 'key', 'contrast', 'sharpness', 'grainStrength', 'grainSize'];
const FUJI_FILTERS = [
  'fj-provia', 'fj-velvia', 'fj-astia', 'x100vi-classic-chrome', 'fj-reala-ace', 'fj-pro-neg-hi', 'fj-pro-neg-std',
  'fj-classic-neg', 'fj-nostalgic-neg', 'fj-eterna', 'fj-eterna-bb',
  'fj-acros', 'fj-acros-ye', 'fj-acros-r', 'fj-acros-g', 'fj-mono', 'fj-mono-ye', 'fj-mono-r', 'fj-mono-g', 'fj-sepia',
];
const FUJI_CONTROLS = ['fujiGrain', 'fujiGrainSize', 'colorChrome', 'colorChromeBlue', 'wbR', 'wbB', 'highlightTone', 'shadowTone', 'color', 'sharpness', 'clarity'];
const SONY_LOOK_CONTROLS = ['sContrast', 'sHighlights', 'sShadows', 'sFade', 'sSaturation', 'sSharpness', 'sClarity'];
const HDF_BASE = { diffusion: { amount: 0.5, threshold: 0.55, radius: 0.03 }, contrast: -0.06 };

// Camera definitions. `filters` may reference another camera's presets (shared settings).
export const CAMERAS = [
  {
    id: 'ricoh-gr-iv', name: 'Ricoh GR IV', short: 'GR-IV', focal: '28mm', desc: '銳利、俐落，街拍的基準',
    controls: [...GR_CONTROLS, 'hdf'], filters: GR_IV_FILTERS,
  },
  {
    id: 'ricoh-gr-iv-hdf', name: 'Ricoh GR IV HDF', short: 'GR-IV-HDF', focal: '28mm', desc: '高光柔和擴散，畫面帶霧感',
    base: HDF_BASE, controls: GR_CONTROLS, always: ['hdfStrength'], filters: GR_IV_FILTERS,
  },
  {
    id: 'ricoh-gr-iiix', name: 'Ricoh GR IIIx', short: 'GR-IIIx', focal: '40mm', desc: '稍窄視角，更安靜的觀看距離',
    controls: [...GR_CONTROLS, 'hdf'], filters: GR_IIIX_FILTERS,
  },
  {
    id: 'ricoh-gr-iv-mono', name: 'Ricoh GR IV Monochrome', short: 'GR-IV-Mono', focal: '28mm', desc: '只為黑白而生',
    controls: ['contrast', 'shadowsM', 'clarityM', 'toningM', 'grainM', 'redFilter'],
    filters: ids('grm', ['standard', 'solid', 'soft', 'hi-contrast', 'grainy', 'hdr-tone']),
  },
  {
    id: 'fujifilm-x100vi', name: 'Fujifilm X100VI', short: 'X100VI', focal: '35mm', desc: '底片模擬與配方',
    controls: FUJI_CONTROLS, filters: FUJI_FILTERS,
  },
  {
    id: 'fujifilm-gfx100rf', name: 'Fujifilm GFX100RF', short: 'GFX100RF', focal: '28mm', desc: '中片幅的細膩階調',
    controls: FUJI_CONTROLS, always: ['mediumFormat', 'aspect'], filters: FUJI_FILTERS,
  },
  {
    id: 'leica-q3', name: 'Leica Q3', short: 'Q3', focal: '28mm', desc: '內斂、深沉的色彩',
    controls: ['lContrast', 'lHighlights', 'lShadows', 'lSharpness', 'lSaturation'],
    filters: [
      ...ids('lq', ['standard', 'vivid', 'natural', 'bw-natural', 'bw-high-contrast']),
      ...ids('lq', ['classic', 'contemporary', 'eternal', 'pure', 'cine', 'chrome', 'teal', 'brass', 'bleach', 'greg-williams', 'selenium', 'sepia', 'blue', 'silver']),
    ],
    groups: [['Film Style', 5], ['Leica Looks', 14]],
  },
  {
    id: 'sony-rx1r-iii', name: 'Sony RX1R III', short: 'RX1R-III', focal: '35mm', desc: '全片幅隨身機的 Creative Look',
    controls: SONY_LOOK_CONTROLS,
    filters: ids('sn', ['st', 'pt', 'nt', 'vv', 'vv2', 'fl', 'fl2', 'fl3', 'in', 'sh', 'bw', 'se']),
  },
  {
    id: 'sony-zv-1-ii', name: 'Sony ZV-1 II', short: 'ZV-1-II', focal: '18–50mm', desc: '輕巧的 Creative Look',
    controls: SONY_LOOK_CONTROLS,
    filters: ids('sn', ['st', 'pt', 'nt', 'vv', 'vv2', 'fl', 'in', 'sh', 'bw', 'se']),
  },
  {
    id: 'sony-rx100-vii', name: 'Sony RX100 VII', short: 'RX100-VII', focal: '24–200mm', desc: 'Creative Style 與 Picture Effect',
    controls: ['rContrast', 'rSaturation', 'rSharpness'],
    filters: [
      ...ids('rx', ['standard', 'vivid', 'neutral', 'clear', 'deep', 'light', 'portrait', 'landscape', 'sunset', 'night', 'autumn', 'bw', 'sepia']),
      ...ids('rx', ['toy', 'pop', 'poster', 'retro', 'soft-highkey', 'partial', 'hc-mono', 'soft-focus', 'hdr-painting', 'rich-mono', 'miniature', 'watercolor', 'illustration']),
    ],
    groups: [['Creative Style', 13], ['Picture Effect', 13]],
  },
  {
    id: 'canon-g7x-iii', name: 'Canon PowerShot G7X Mark III', short: 'G7X-III', focal: '24–100mm', desc: 'Picture Style 與創意濾鏡',
    controls: ['cSharpness', 'cContrast', 'cSaturation', 'cTone'],
    filters: [
      ...ids('cn', ['auto', 'standard', 'portrait', 'landscape', 'fine-detail', 'neutral', 'faithful', 'monochrome']),
      ...ids('cn', ['grainy-bw', 'soft-focus', 'fisheye', 'art-bold', 'water-painting', 'toy', 'miniature']),
    ],
    groups: [['Picture Style', 8], ['Creative Filter', 7]],
  },
  {
    id: 'panasonic-lumix-l10', name: 'Panasonic Lumix L10', short: 'L10', focal: '', desc: 'Photo Style 與 L.Classic 系列',
    controls: ['xContrast', 'xHighlights', 'xShadows', 'xSaturation', 'xTone', 'xSharpness', 'xGrain', 'skinSoft'],
    filters: [
      ...ids('lx', ['standard', 'vivid', 'natural', 'l-classic', 'l-classic-neo', 'l-classic-gold', 'flat', 'landscape', 'portrait', 'cinelike-d2', 'cinelike-v2', 'cinelike-a2']),
      ...ids('lx', ['monochrome', 'l-monochrome', 'l-monochrome-d', 'l-monochrome-s', 'leica-monochrome']),
    ],
    groups: [['彩色', 12], ['黑白', 5]],
  },
  {
    id: 'kodak-charmera', name: 'Kodak Charmera', short: 'Charmera', focal: '', desc: '鑰匙圈尺寸的低傳真',
    // Body processing shared by every Charmera filter.
    base: {
      downscale: 1440, sharpness: -0.3, noise: 0.35, jpeg: 0.55,
      temperature: 0.06, tint: -0.05, contrast: 0.08, blacks: 0.02,
      vignette: { amount: 0.4, radius: 0.55, feather: 0.8 },
    },
    controls: [],
    always: ['chFrame', 'chDate'],
    filters: ['ch-original', 'ch-bw', 'ch-cool', 'ch-warm', 'ch-pixel-yellow', 'ch-pixel-red', 'charmera-pixel-blue', 'ch-pixel-gray'],
  },
];

export const cameraById = (id) => CAMERAS.find((c) => c.id === id);
export const filterById = (id) => FILTERS[id];

// Controls offered for this camera + filter.
export function controlsFor(camera, filterId) {
  const f = FILTERS[filterId];
  const isMono = f.params.mono === 1 && !(f.params.keepColor && f.params.keepColor.amount);
  const list = f.locked ? [] : camera.controls.filter((id) => {
    const c = CONTROLS[id];
    if (c.color && isMono) return false;
    if (c.filmOnly && !f.film) return false;
    return true;
  });
  return [...(f.extra || []), ...list, ...(camera.always || [])].map((id) => ({ id, ...CONTROLS[id] }));
}

export function filterDefaults(camera, filterId) {
  return merge(merge(NEUTRAL, camera.base), FILTERS[filterId].params);
}

// camera + filter + strength (0–1) + user adjustments → pipeline params
export function resolveParams(camera, filterId, strength = 1, adjust = {}) {
  const neutral = merge(NEUTRAL, camera.base);
  const full = merge(neutral, FILTERS[filterId].params);
  const p = lerpParams(neutral, full, strength);
  for (const c of controlsFor(camera, filterId)) {
    let v = adjust[c.id];
    if (v === undefined && c.always) v = c.from(full);
    if (v === undefined) continue;
    c.apply(p, v, adjust);
  }
  return p;
}

// Aspect crop (GFX): returns [x, y, w, h] inside a W×H image.
export function cropFor(camera, filterId, adjust, W, H) {
  const c = controlsFor(camera, filterId).find((x) => x.geometry);
  const ratio = c ? c.ratios[adjust[c.id] ?? 0] : 0;
  if (!ratio) return [0, 0, W, H];
  const r = W >= H ? ratio : 1 / ratio; // follow the photo's orientation
  let w = W, h = Math.round(W / r);
  if (h > H) { h = H; w = Math.round(H * r); }
  return [Math.round((W - w) / 2), Math.round((H - h) / 2), w, h];
}
