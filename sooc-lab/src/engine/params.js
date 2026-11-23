// Neutral defaults for every pipeline parameter. Filters override only what they need.

export const NEUTRAL = {
  // 2
  exposure: 0, temperature: 0, tint: 0, wbShift: [0, 0],
  // 3
  curve: null, curveR: null, curveG: null, curveB: null, contrast: 0,
  // 3.5
  lut: null, lutAmount: 1,
  // 4
  highlights: 0, shadows: 0, whites: 0, blacks: 0, midtone: 0,
  // 5
  hsl: {
    red: [0, 0, 0], orange: [0, 0, 0], yellow: [0, 0, 0], green: [0, 0, 0],
    aqua: [0, 0, 0], blue: [0, 0, 0], purple: [0, 0, 0], magenta: [0, 0, 0],
  },
  hueShift: 0,
  // 6
  shadowTint: { hue: 0, amount: 0 }, highlightTint: { hue: 0, amount: 0 }, balance: 0,
  // 7
  saturation: 0, vibrance: 0,
  // 8
  colorChrome: 0, colorChromeBlue: 0,
  // 9
  mono: 0, mixer: [0.2126, 0.7152, 0.0722], toning: { hue: 0, amount: 0 },
  keepColor: { hue: 0, width: 30, amount: 0 }, // partial colour: hue kept out of monochrome
  // 0 geometry
  warp: 0,
  // 10
  clarity: 0, hdrTone: 0,
  // painterly / optical (run alongside 10–11)
  skinSoft: 0, watercolor: 0, outline: 0,
  miniature: { amount: 0, center: 0.55, width: 0.18 },
  // 11
  sharpness: 0, sharpRadius: 1,
  // 12
  diffusion: { amount: 0, threshold: 0.62, radius: 0.025 },
  // 13
  downscale: 0, posterize: 0, posterizeMode: 'rgb', pixelate: 0, jpeg: 0, noise: 0,
  // 14
  vignette: { amount: 0, radius: 0.7, feather: 0.6 },
  // 15
  grain: { amount: 0, size: 1 },
};

export const HSL_KEYS = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
const CURVE_KEYS = ['curve', 'curveR', 'curveG', 'curveB'];
const LOFI_KEYS = ['downscale', 'posterize', 'pixelate'];
// Structural values: never interpolated by filter strength (their amounts are).
const NO_LERP = new Set(['hue', 'width', 'center', 'size', 'radius', 'feather', 'threshold', 'mixer', 'posterizeMode', 'sharpRadius', 'lut', ...LOFI_KEYS]);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v.size && v.data);

export function clone(v) {
  if (Array.isArray(v)) return v.map(clone);
  if (isObj(v)) { const o = {}; for (const k in v) o[k] = clone(v[k]); return o; }
  return v;
}

export function merge(base, over) {
  const out = clone(base);
  if (!over) return out;
  for (const k in over) {
    const v = over[k];
    out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : clone(v);
  }
  return out;
}

function lerpValue(a, b, t, key) {
  if (NO_LERP.has(key)) return clone(b);
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && typeof a[0] === 'number') return a.map((x, i) => x + (b[i] - x) * t);
  if (isObj(a) && isObj(b)) { const o = {}; for (const k in b) o[k] = lerpValue(a[k], b[k], t, k); return o; }
  return clone(b);
}

// Filter strength: interpolate from the camera's neutral (incl. body processing) to the full filter.
export function lerpParams(neutral, full, t) {
  const out = {};
  for (const k in full) {
    if (CURVE_KEYS.includes(k)) out[k] = clone(full[k]);
    else out[k] = lerpValue(neutral[k], full[k], t, k);
  }
  out._curveT = t;
  out._curveNeutral = { curve: neutral.curve, curveR: neutral.curveR, curveG: neutral.curveG, curveB: neutral.curveB };
  const lofiChanged = LOFI_KEYS.some((k) => full[k] !== neutral[k]);
  out._lofiT = lofiChanged ? t : 1;
  return out;
}
