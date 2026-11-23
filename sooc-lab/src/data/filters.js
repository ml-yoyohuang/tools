// Filter presets: parameter overrides on top of NEUTRAL (+ camera body processing).
// Flags: film (Ricoh grain controls allowed), locked (no camera adjustments; strength only),
//        extra (variant controls specific to this filter).
import { MIXERS } from './controls.js';

const mono = (extra = {}) => ({ mono: 1, ...extra });
const SEPIA = { hue: 32, amount: 0.34 };
const F = (name, params, flags = {}) => ({ name, params, ...flags });

// ---------------- Ricoh GR ----------------
const GR = {
  'gr-standard': F('Standard', { contrast: 0.12, sharpness: 0.28, saturation: 0.04, clarity: 0.06 }),
  'gr-vivid': F('Vivid', { saturation: 0.38, vibrance: 0.12, contrast: 0.26, sharpness: 0.4 }),
  'gr-monotone': F('Monotone', mono({ contrast: 0.12, sharpness: 0.22 }), { film: true }),
  'gr-soft-monotone': F('Soft Monotone', mono({ contrast: -0.38, blacks: 0.04, highlights: 0.14, midtone: 0.06, sharpness: -0.05 }), { film: true }),
  'gr-hard-monotone': F('Hard Monotone', mono({ contrast: 0.62, sharpness: 0.75, clarity: 0.25 }), { film: true }),
  'gr4-hi-contrast-bw': F('Hi-Contrast B&W', mono({
    mixer: [0.3, 0.6, 0.1],
    curve: [[0, 0], [0.22, 0.03], [0.45, 0.36], [0.7, 0.86], [1, 1]],
    contrast: 0.55, blacks: -0.04, clarity: 0.35, sharpness: 0.45,
    vignette: { amount: 0.6, radius: 0.55, feather: 0.75 },
    grain: { amount: 0.75, size: 1.6 },
  }), { film: true }),
  'gr-negative-film': F('Negative Film', {
    contrast: -0.2, saturation: -0.04,
    curve: [[0, 0.05], [0.5, 0.5], [1, 0.96]],
    shadowTint: { hue: 186, amount: 0.12 }, highlightTint: { hue: 36, amount: 0.09 },
  }, { film: true }),
  'gr-positive-film': F('Positive Film', {
    saturation: 0.32, contrast: 0.36,
    hsl: { yellow: [-6, 0.12, 0], green: [-14, 0.15, -0.05], aqua: [-6, 0, 0] },
    shadowTint: { hue: 190, amount: 0.14 }, highlightTint: { hue: 58, amount: 0.07 },
  }, { film: true }),
  'gr-cinema-yellow': F('Cinema (Yellow)', {
    temperature: 0.12, tint: -0.02, saturation: -0.12, contrast: -0.12, blacks: 0.03,
    highlightTint: { hue: 42, amount: 0.13 }, shadowTint: { hue: 34, amount: 0.06 },
  }, { film: true }),
  'gr-cinema-green': F('Cinema (Green)', {
    temperature: -0.06, tint: -0.16, saturation: -0.18, contrast: -0.05,
    shadowTint: { hue: 172, amount: 0.14 }, highlightTint: { hue: 150, amount: 0.05 },
  }, { film: true }),
  'gr-bleach-bypass': F('Bleach Bypass', {
    saturation: -0.55, contrast: 0.46, clarity: 0.22, sharpness: 0.2, highlightTint: { hue: 210, amount: 0.03 },
  }),
  'gr-retro': F('Retro', {
    saturation: -0.36, temperature: 0.1, contrast: -0.1,
    curve: [[0, 0.07], [1, 0.92]],
    highlightTint: { hue: 46, amount: 0.15 }, shadowTint: { hue: 30, amount: 0.08 },
    vignette: { amount: 0.36, radius: 0.6, feather: 0.7 },
  }),
  'gr-cross-processing': F('Cross Processing', {
    contrast: 0.42, saturation: 0.32,
    curveR: [[0, 0], [0.25, 0.3], [0.75, 0.86], [1, 1]],
    curveG: [[0, 0.02], [0.5, 0.55], [1, 0.95]],
    curveB: [[0, 0.16], [0.5, 0.45], [1, 0.78]],
  }, { extra: ['crossVariant'] }),
  'gr-hdr-tone': F('HDR Tone', { hdrTone: 0.85, saturation: 0.15, clarity: 0.2, sharpness: 0.2 }),
};

// ---------------- Ricoh GR Monochrome ----------------
const GRM = {
  'grm-standard': F('Standard', mono({ contrast: 0.04, sharpness: 0.2, clarity: 0.05, curve: [[0, 0], [0.25, 0.23], [0.75, 0.78], [1, 1]] })),
  'grm-solid': F('Solid', mono({ contrast: 0.36, sharpness: 0.6, clarity: 0.22 })),
  'grm-soft': F('Soft', mono({ contrast: -0.32, highlights: 0.1, blacks: 0.03, sharpness: -0.08 })),
  'grm-hi-contrast': F('Hi-Contrast', mono({ contrast: 0.72, blacks: -0.03 })),
  'grm-grainy': F('Grainy', mono({ contrast: 0.3, highlights: -0.28, shadows: -0.16, blacks: -0.02, grain: { amount: 0.6, size: 1.5 } })),
  'grm-hdr-tone': F('HDR Tone', mono({ hdrTone: 0.9, clarity: 0.2 })),
};

// ---------------- Fujifilm ----------------
const ACROS = { contrast: 0.2, shadows: -0.12, sharpness: 0.25, grain: { amount: 0.18, size: 0.7 } };
const FJ = {
  'fj-provia': F('PROVIA / 標準', { contrast: 0.08, saturation: 0.08 }),
  'fj-velvia': F('Velvia / 鮮豔', { saturation: 0.46, vibrance: 0.15, contrast: 0.3, shadows: -0.08, hsl: { green: [0, 0.1, -0.05], blue: [0, 0.12, -0.1] } }),
  'fj-astia': F('ASTIA / 柔和', { contrast: -0.12, saturation: 0.1, highlights: -0.05, hsl: { red: [0, -0.05, 0.04], orange: [0, -0.06, 0.06], blue: [0, 0.16, 0] } }),
  'x100vi-classic-chrome': F('Classic Chrome', {
    saturation: -0.28,
    curve: [[0, 0], [0.12, 0.07], [0.3, 0.25], [0.55, 0.55], [0.8, 0.82], [1, 0.965]],
    contrast: 0.12, highlights: -0.2,
    hsl: {
      red: [5, -0.12, -0.1], orange: [-2, -0.08, 0], yellow: [-6, -0.3, -0.04], green: [-8, -0.4, -0.14],
      aqua: [-8, -0.35, -0.16], blue: [-10, -0.32, -0.2], purple: [-6, -0.3, -0.1], magenta: [0, -0.2, -0.05],
    },
    shadowTint: { hue: 195, amount: 0.05 }, highlightTint: { hue: 40, amount: 0.03 },
    colorChrome: 0.5, sharpness: 0.1,
  }),
  'fj-reala-ace': F('REALA ACE', { contrast: 0.24, saturation: 0.05, sharpness: 0.12, clarity: 0.06 }),
  'fj-pro-neg-hi': F('PRO Neg. Hi', { contrast: 0.06, saturation: -0.06, hsl: { orange: [0, -0.08, 0.05], red: [0, -0.05, 0.03] } }),
  'fj-pro-neg-std': F('PRO Neg. Std', { contrast: -0.2, saturation: -0.12, blacks: 0.01, hsl: { orange: [0, -0.08, 0.06] } }),
  'fj-classic-neg': F('Classic Neg.', {
    saturation: -0.2, contrast: 0.32,
    curve: [[0, 0], [0.2, 0.13], [0.5, 0.5], [0.8, 0.86], [1, 0.97]],
    shadowTint: { hue: 168, amount: 0.13 }, highlightTint: { hue: 352, amount: 0.07 },
    hsl: { red: [0, -0.05, -0.05], yellow: [-4, -0.15, 0], green: [-6, -0.25, -0.05], blue: [-5, -0.2, -0.06] },
  }),
  'fj-nostalgic-neg': F('Nostalgic Neg.', {
    temperature: 0.06, contrast: -0.06, shadows: 0.12, saturation: -0.04,
    highlightTint: { hue: 38, amount: 0.15 }, hsl: { yellow: [-3, 0, 0.03] },
  }),
  'fj-eterna': F('ETERNA / 電影', {
    saturation: -0.4, contrast: -0.3, shadows: -0.06,
    curve: [[0, 0], [0.2, 0.15], [0.5, 0.47], [0.85, 0.83], [1, 0.94]],
    shadowTint: { hue: 186, amount: 0.06 },
  }),
  'fj-eterna-bb': F('ETERNA Bleach Bypass', { saturation: -0.68, contrast: 0.5, clarity: 0.15 }),
  'fj-acros': F('ACROS', mono({ ...ACROS })),
  'fj-acros-ye': F('ACROS + Ye', mono({ ...ACROS, mixer: MIXERS.yellow })),
  'fj-acros-r': F('ACROS + R', mono({ ...ACROS, mixer: MIXERS.red, contrast: 0.32 })),
  'fj-acros-g': F('ACROS + G', mono({ ...ACROS, mixer: MIXERS.green })),
  'fj-mono': F('Monochrome', mono({ contrast: 0.08 })),
  'fj-mono-ye': F('Monochrome + Ye', mono({ contrast: 0.08, mixer: MIXERS.yellow })),
  'fj-mono-r': F('Monochrome + R', mono({ contrast: 0.16, mixer: MIXERS.red })),
  'fj-mono-g': F('Monochrome + G', mono({ contrast: 0.08, mixer: MIXERS.green })),
  'fj-sepia': F('Sepia', mono({ toning: SEPIA, contrast: 0.02 })),
};

// ---------------- Leica Q3 ----------------
const LQ = {
  'lq-standard': F('Standard', { contrast: 0.15, saturation: -0.06, shadows: -0.1, clarity: 0.05, curve: [[0, 0], [0.2, 0.15], [0.6, 0.6], [1, 1]] }),
  'lq-vivid': F('Vivid', { saturation: 0.3, contrast: 0.28, shadows: -0.08 }),
  'lq-natural': F('Natural', { contrast: -0.02, saturation: -0.16 }),
  'lq-bw-natural': F('B&W Natural', mono({ contrast: 0.05 })),
  'lq-bw-high-contrast': F('B&W High Contrast', mono({ contrast: 0.66, blacks: -0.03, clarity: 0.15 })),
  'lq-classic': F('Classic', { contrast: 0.3, saturation: -0.1, temperature: 0.05, blacks: 0.03, highlightTint: { hue: 40, amount: 0.08 } }, { locked: true }),
  'lq-contemporary': F('Contemporary', { temperature: -0.08, contrast: 0.1, saturation: -0.08, highlights: -0.05, shadowTint: { hue: 200, amount: 0.06 } }, { locked: true }),
  'lq-eternal': F('Eternal', { contrast: 0.36, saturation: 0.3, tint: 0.12, highlightTint: { hue: 320, amount: 0.06 } }, { locked: true }),
  'lq-pure': F('Pure', { exposure: 0.06, contrast: -0.15, saturation: -0.02, highlights: -0.15, shadows: 0.16, blacks: 0.02 }, { locked: true }),
  'lq-cine': F('Cine', { temperature: 0.1, contrast: -0.1, highlights: -0.16, saturation: -0.05, shadowTint: { hue: 30, amount: 0.05 }, grain: { amount: 0.15, size: 1.2 } }, { locked: true }),
  'lq-chrome': F('Chrome', { saturation: 0.3, contrast: 0.3, colorChrome: 0.6, shadowTint: { hue: 200, amount: 0.06 } }, { locked: true }),
  'lq-teal': F('Teal', { saturation: -0.05, shadowTint: { hue: 184, amount: 0.22 }, highlightTint: { hue: 30, amount: 0.15 }, hsl: { orange: [0, 0.1, 0], blue: [-14, 0, 0], aqua: [-6, 0.1, 0] } }, { locked: true }),
  'lq-brass': F('Brass', { temperature: 0.15, contrast: 0.1, saturation: -0.2, highlightTint: { hue: 45, amount: 0.2 }, shadowTint: { hue: 35, amount: 0.1 } }, { locked: true }),
  'lq-bleach': F('Bleach', { saturation: -0.6, contrast: 0.5 }, { locked: true }),
  'lq-greg-williams': F('Greg Williams', { contrast: 0.4, temperature: 0.1, saturation: -0.1, clarity: 0.2, highlightTint: { hue: 35, amount: 0.1 }, vignette: { amount: 0.25, radius: 0.6, feather: 0.7 }, grain: { amount: 0.2, size: 1.2 } }, { locked: true }),
  'lq-selenium': F('Selenium', mono({ toning: { hue: 275, amount: 0.1 }, contrast: 0.25 }), { locked: true }),
  'lq-sepia': F('Sepia', mono({ toning: { hue: 32, amount: 0.33 } }), { locked: true }),
  'lq-blue': F('Blue', mono({ toning: { hue: 215, amount: 0.28 } }), { locked: true }),
  'lq-silver': F('Silver', mono({ toning: { hue: 210, amount: 0.04 }, contrast: 0.15, highlights: 0.1, sharpness: 0.1 }), { locked: true }),
};

// ---------------- Sony Creative Look ----------------
const SN = {
  'sn-st': F('ST（Standard）', { contrast: 0.08, saturation: 0.05 }),
  'sn-pt': F('PT（Portrait）', { sharpness: -0.25, contrast: -0.05, saturation: -0.05, hsl: { orange: [0, -0.05, 0.06] } }),
  'sn-nt': F('NT（Neutral）', { saturation: -0.3, sharpness: -0.15, contrast: -0.05 }),
  'sn-vv': F('VV（Vivid）', { saturation: 0.36, contrast: 0.2, hsl: { green: [0, 0.15, 0], blue: [0, 0.15, -0.05], red: [0, 0.1, 0] } }),
  'sn-vv2': F('VV2（Vivid 2）', { saturation: 0.3, vibrance: 0.2, exposure: 0.1, clarity: 0.12, contrast: 0.1 }),
  'sn-fl': F('FL（Film）', { saturation: -0.15, contrast: 0.3, sharpness: 0.2, shadowTint: { hue: 195, amount: 0.06 }, hsl: { blue: [-8, -0.1, -0.1], aqua: [-6, -0.1, -0.05], green: [-8, -0.1, -0.05] } }),
  'sn-fl2': F('FL2（Film 2）', { contrast: 0.15, saturation: -0.25, temperature: 0.05, blacks: 0.03, highlightTint: { hue: 40, amount: 0.06 } }),
  'sn-fl3': F('FL3（Film 3）', { contrast: 0.42, saturation: 0.25, shadowTint: { hue: 200, amount: 0.05 } }),
  'sn-in': F('IN（Instant）', { contrast: -0.35, saturation: -0.3, blacks: 0.1, highlights: -0.1, highlightTint: { hue: 50, amount: 0.04 } }),
  'sn-sh': F('SH（Soft Highkey）', { exposure: 0.3, contrast: -0.25, saturation: 0.12, highlights: -0.1, blacks: 0.03 }),
  'sn-bw': F('BW（Black & White）', mono({ contrast: 0.1 })),
  'sn-se': F('SE（Sepia）', mono({ toning: SEPIA })),
};

// ---------------- Sony RX100 VII ----------------
const TOY = { contrast: 0.45, saturation: 0.2, sharpness: -0.1, vignette: { amount: 0.72, radius: 0.45, feather: 0.8 } };
const MINI = { miniature: { amount: 1, center: 0.55, width: 0.18 }, saturation: 0.35, contrast: 0.2 };
const RETRO = { saturation: -0.4, temperature: 0.12, contrast: -0.05, blacks: 0.08, highlightTint: { hue: 45, amount: 0.18 }, vignette: { amount: 0.3, radius: 0.6, feather: 0.7 } };
const RX = {
  'rx-standard': F('Standard', { contrast: 0.05, saturation: 0.05 }),
  'rx-vivid': F('Vivid', { saturation: 0.4, contrast: 0.2 }),
  'rx-neutral': F('Neutral', { saturation: -0.25, contrast: -0.08, sharpness: -0.1 }),
  'rx-clear': F('Clear', { contrast: 0.1, highlights: 0.12, whites: 0.12, clarity: 0.06 }),
  'rx-deep': F('Deep', { exposure: -0.15, contrast: 0.25, saturation: 0.15, shadows: -0.1 }),
  'rx-light': F('Light', { exposure: 0.25, contrast: -0.2, blacks: 0.03 }),
  'rx-portrait': F('Portrait', { sharpness: -0.15, contrast: -0.05, hsl: { orange: [0, -0.05, 0.08] } }),
  'rx-landscape': F('Landscape', { saturation: 0.2, sharpness: 0.3, clarity: 0.1, hsl: { green: [0, 0.25, 0], blue: [0, 0.25, -0.05] } }),
  'rx-sunset': F('Sunset', { temperature: 0.22, saturation: 0.1, hsl: { red: [0, 0.25, 0], orange: [0, 0.3, 0] } }),
  'rx-night': F('Night Scene', { exposure: -0.3, contrast: -0.2, saturation: -0.1 }),
  'rx-autumn': F('Autumn Leaves', { contrast: 0.1, saturation: 0.05, hsl: { red: [0, 0.35, 0], orange: [0, 0.35, 0], yellow: [0, 0.3, 0] } }),
  'rx-bw': F('Black & White', mono()),
  'rx-sepia': F('Sepia', mono({ toning: SEPIA })),
  'rx-toy': F('Toy Camera', { ...TOY }, { locked: true, extra: ['toyVariant'] }),
  'rx-pop': F('Pop Color', { saturation: 0.8, vibrance: 0.3, contrast: 0.15 }, { locked: true }),
  'rx-poster': F('Posterization', { posterize: 4, saturation: 0.4, contrast: 0.2 }, { locked: true, extra: ['posterVariant'] }),
  'rx-retro': F('Retro Photo', { ...RETRO }, { locked: true }),
  'rx-soft-highkey': F('Soft High-key', { exposure: 0.35, contrast: -0.3, saturation: -0.1, blacks: 0.05, highlightTint: { hue: 200, amount: 0.03 }, diffusion: { amount: 0.3, threshold: 0.5, radius: 0.02 } }, { locked: true }),
  'rx-partial': F('Partial Color', mono({ keepColor: { hue: 2, width: 32, amount: 1 }, saturation: 0.25, contrast: 0.08 }), { locked: true, extra: ['partialVariant'] }),
  'rx-hc-mono': F('High Contrast Mono', mono({ contrast: 0.85, clarity: 0.3, blacks: -0.05 }), { locked: true }),
  'rx-soft-focus': F('Soft Focus', { sharpness: -0.6, contrast: -0.1, diffusion: { amount: 0.55, threshold: 0.2, radius: 0.02 } }, { locked: true }),
  'rx-hdr-painting': F('HDR Painting', { hdrTone: 1, saturation: 0.3, clarity: 0.4 }, { locked: true }),
  'rx-rich-mono': F('Rich-tone Mono', mono({ hdrTone: 0.45, contrast: 0.15 }), { locked: true }),
  'rx-miniature': F('Miniature', { ...MINI }, { locked: true, extra: ['miniPos'] }),
  'rx-watercolor': F('Watercolor', { watercolor: 0.9, saturation: 0.2, contrast: -0.1, blacks: 0.05, posterize: 12, grain: { amount: 0.22, size: 2.6 } }, { locked: true }),
  'rx-illustration': F('Illustration', { outline: 0.9, posterize: 6, saturation: 0.35, contrast: 0.15 }, { locked: true }),
};

// ---------------- Canon G7X Mark III ----------------
const CN = {
  'cn-auto': F('Auto', { exposure: 0.06, contrast: 0.02, saturation: 0.04, vibrance: 0.3, shadows: 0.08 }),
  'cn-standard': F('Standard', { contrast: 0.16, saturation: 0.12, sharpness: 0.22 }),
  'cn-portrait': F('Portrait', { exposure: 0.05, tint: 0.03, contrast: -0.03, sharpness: -0.1, hsl: { orange: [0, -0.05, 0.08], red: [0, -0.03, 0.06] } }),
  'cn-landscape': F('Landscape', { saturation: 0.15, sharpness: 0.3, hsl: { green: [0, 0.3, 0], blue: [0, 0.3, -0.05] } }),
  'cn-fine-detail': F('Fine Detail', { sharpness: 0.6, sharpRadius: 0.7, clarity: 0.1 }),
  'cn-neutral': F('Neutral', { saturation: -0.25, contrast: -0.1 }),
  'cn-faithful': F('Faithful', { saturation: -0.08, contrast: -0.03 }),
  'cn-monochrome': F('Monochrome', mono(), { extra: ['canonFilter', 'canonToning'] }),
  'cn-grainy-bw': F('Grainy B/W', mono({ contrast: 0.55, blacks: -0.02, grain: { amount: 0.85, size: 1.8 } }), { locked: true }),
  'cn-soft-focus': F('Soft Focus', { sharpness: -0.5, diffusion: { amount: 0.5, threshold: 0.25, radius: 0.022 } }, { locked: true }),
  'cn-fisheye': F('Fish-eye', { warp: 0.75, saturation: 0.1, contrast: 0.08 }, { locked: true }),
  'cn-art-bold': F('Art Bold', { saturation: 0.45, contrast: 0.3, hdrTone: 0.45, clarity: 0.3 }, { locked: true }),
  'cn-water-painting': F('Water Painting', { watercolor: 1, saturation: 0.1, posterize: 10, grain: { amount: 0.25, size: 3 } }, { locked: true }),
  'cn-toy': F('Toy Camera', { ...TOY, temperature: 0.12 }, { locked: true }),
  'cn-miniature': F('Miniature', { ...MINI }, { locked: true, extra: ['miniPos'] }),
};

// ---------------- Panasonic Lumix L10 ----------------
const LX = {
  'lx-standard': F('Standard', { contrast: 0.08, saturation: 0.05 }),
  'lx-vivid': F('Vivid', { saturation: 0.35, contrast: 0.2 }),
  'lx-natural': F('Natural', { saturation: -0.1, contrast: -0.08, sharpness: -0.05 }),
  'lx-l-classic': F('L.Classic', { saturation: -0.3, contrast: -0.15, blacks: 0.02, hsl: { green: [0, 0.06, 0.05] }, curve: [[0, 0.02], [0.3, 0.3], [0.7, 0.71], [1, 0.98]] }),
  'lx-l-classic-neo': F('L.ClassicNeo', { contrast: -0.12, saturation: -0.1, exposure: 0.05, highlights: 0.05, shadowTint: { hue: 185, amount: 0.11 }, hsl: { blue: [0, -0.2, -0.05] } }),
  'lx-l-classic-gold': F('L.ClassicGold', { temperature: 0.1, contrast: 0.05, saturation: -0.05, highlightTint: { hue: 40, amount: 0.16 }, diffusion: { amount: 0.15, threshold: 0.65, radius: 0.03 } }),
  'lx-flat': F('Flat', { contrast: -0.4, saturation: -0.3, blacks: 0.02 }),
  'lx-landscape': F('Landscape', { saturation: 0.15, hsl: { green: [0, 0.25, 0], blue: [0, 0.25, -0.05] } }),
  'lx-portrait': F('Portrait', { exposure: 0.04, tint: 0.03, contrast: -0.06, sharpness: -0.12, hsl: { orange: [0, -0.06, 0.1], red: [0, -0.04, 0.05] } }),
  'lx-cinelike-d2': F('Cinelike D2', { contrast: -0.36, highlights: -0.2, shadows: 0.2, saturation: -0.12 }),
  'lx-cinelike-v2': F('Cinelike V2', { contrast: 0.2, saturation: -0.05, highlights: -0.1, shadowTint: { hue: 190, amount: 0.04 } }),
  'lx-cinelike-a2': F('Cinelike A2', { contrast: -0.1, saturation: -0.08, highlights: -0.12, temperature: 0.04 }),
  'lx-monochrome': F('Monochrome', mono()),
  'lx-l-monochrome': F('L.Monochrome', mono({ contrast: 0.2, blacks: -0.03, curve: [[0, 0], [0.25, 0.22], [0.75, 0.8], [1, 1]] })),
  'lx-l-monochrome-d': F('L.Monochrome D', mono({ hdrTone: 0.4, contrast: 0.3, highlights: 0.1, shadows: -0.1 })),
  'lx-l-monochrome-s': F('L.Monochrome S', mono({ contrast: -0.2, highlights: -0.05, shadows: 0.08 })),
  'lx-leica-monochrome': F('LEICA Monochrome', mono({ contrast: 0.45, shadows: -0.15, blacks: -0.03, clarity: 0.1 })),
};

// ---------------- Kodak Charmera ----------------
const PIXEL = (hue, amount) => mono({ toning: { hue, amount }, contrast: 0.25, pixelate: 128, posterize: 5, posterizeMode: 'luma', jpeg: 0 });
const CH = {
  'ch-original': F('原色', {}),
  'ch-bw': F('Black & White', mono({ contrast: 0.3, curve: [[0, 0.06], [1, 0.9]] })),
  'ch-cool': F('Cool Tone', { temperature: -0.32, tint: 0.02, shadowTint: { hue: 210, amount: 0.06 } }),
  'ch-warm': F('Warm Tone', { temperature: 0.3, saturation: -0.1, blacks: 0.04, highlightTint: { hue: 40, amount: 0.12 } }),
  'ch-pixel-yellow': F('Pixel Yellow', PIXEL(48, 0.8)),
  'ch-pixel-red': F('Pixel Red', PIXEL(2, 0.7)),
  'charmera-pixel-blue': F('Pixel Blue', PIXEL(214, 0.75)),
  'ch-pixel-gray': F('Pixel Gray', PIXEL(0, 0)),
};

export const FILTERS = { ...GR, ...GRM, ...FJ, ...LQ, ...SN, ...RX, ...CN, ...LX, ...CH };
