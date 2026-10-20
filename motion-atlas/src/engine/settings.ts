import { usableWeight, WEIGHT_RANGE } from './fonts';
import { presetPalette } from './palette';
import { mulberry32 } from './random';
import { clampGraphemes } from './text';
import type { CommonSettings, Direction, EffectSettings, EffectSpec, FontKey, ParamDef, ParamValue, Ratio } from './types';

export const RATIOS: Ratio[] = ['16:9', '1:1', '9:16'];
export const RATIO_VALUE: Record<Ratio, number> = { '16:9': 16 / 9, '1:1': 1, '9:16': 9 / 16 };
/** suggested export size per ratio (for prompts / docs) */
export const RATIO_SIZE: Record<Ratio, [number, number]> = { '16:9': [1920, 1080], '1:1': [1080, 1080], '9:16': [1080, 1920] };
export const FONTS: FontKey[] = ['sans', 'condensed', 'serif', 'mono'];
export const DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down', 'cw', 'ccw'];
export const DIRECTION_LABEL: Record<Direction, string> = {
  left: '向左',
  right: '向右',
  up: '向上',
  down: '向下',
  cw: '順時針',
  ccw: '逆時針',
};

export const LIMITS = {
  tracking: { min: -0.1, max: 0.6, step: 0.01 },
  weight: { min: 300, max: 900, step: 100 },
  speed: { min: 0.25, max: 3, step: 0.05 },
  intensity: { min: 0, max: 2, step: 0.05 },
  scale: { min: 0.5, max: 1.6, step: 0.05 },
  seed: { min: 1, max: 9999, step: 1 },
} as const;

export const MAX_TEXT = 80;
export const DEFAULT_MAX_CHARS = 40;

const BASE: Omit<CommonSettings, 'text' | 'background' | 'primary' | 'secondary' | 'accent' | 'direction'> = {
  font: 'sans',
  tracking: 0,
  weight: 900,
  speed: 1,
  intensity: 1,
  scale: 1,
  seed: 1,
  loop: true,
  ratio: '16:9',
};

export function defaultParams(spec: Pick<EffectSpec, 'params'>): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const p of spec.params ?? []) out[p.key] = p.default;
  return out;
}

export function buildDefaultSettings(spec: EffectSpec): EffectSettings {
  const pal = { ...presetPalette(spec.palette ?? 'MONO'), ...spec.colors };
  const direction = spec.defaults?.direction ?? spec.directions?.[0] ?? 'right';
  return {
    ...BASE,
    ...pal,
    direction,
    text: spec.defaultText,
    ...spec.defaults,
    params: defaultParams(spec),
  };
}

const HEX = /^#[0-9a-f]{6}$/i;
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (v: number, step: number) => Math.round(v / step) * step;
// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u0009\u000b-\u001f\u007f]/g;

export function validParam(p: ParamDef, raw: unknown): ParamValue {
  switch (p.type) {
    case 'range': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
      if (!Number.isFinite(n)) return p.default;
      return +clampN(snap(n - p.min, p.step) + p.min, p.min, p.max).toFixed(4);
    }
    case 'toggle':
      if (typeof raw === 'boolean') return raw;
      if (raw === '1' || raw === 'true') return true;
      if (raw === '0' || raw === 'false') return false;
      return p.default;
    case 'select':
      return p.options.some((o) => o.value === raw) ? (raw as string) : p.default;
    case 'text':
      return typeof raw === 'string' ? clampGraphemes(raw.replace(CTRL, ''), p.maxLength) : p.default;
  }
}

type Loose = Partial<Record<keyof CommonSettings, unknown>> & { params?: unknown };

/** Validate any (possibly hostile) partial settings object against an effect. Never throws. */
export function normalizeSettings(spec: EffectSpec, input: unknown, base?: EffectSettings): EffectSettings {
  const d = base ?? buildDefaultSettings(spec);
  const src: Loose = input && typeof input === 'object' ? (input as Loose) : {};
  const num = (v: unknown, key: keyof typeof LIMITS, fb: number) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    const L = LIMITS[key];
    return Number.isFinite(n) ? +clampN(n, L.min, L.max).toFixed(3) : fb;
  };
  const color = (v: unknown, fb: string) => (typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : fb);
  const rawParams = src.params && typeof src.params === 'object' ? (src.params as Record<string, unknown>) : {};
  const params: Record<string, ParamValue> = {};
  for (const p of spec.params ?? []) {
    params[p.key] = p.key in rawParams ? validParam(p, rawParams[p.key]) : (d.params[p.key] ?? p.default);
  }
  const font = FONTS.includes(src.font as FontKey) ? (src.font as FontKey) : d.font;
  const allowedDirs = spec.directions ?? [];
  const direction = allowedDirs.includes(src.direction as Direction) ? (src.direction as Direction) : d.direction;
  const text =
    typeof src.text === 'string' ? clampGraphemes(src.text.replace(/\r\n?/g, '\n').replace(CTRL, ''), spec.maxChars ?? DEFAULT_MAX_CHARS) : d.text;
  return {
    text,
    font,
    background: color(src.background, d.background),
    primary: color(src.primary, d.primary),
    secondary: color(src.secondary, d.secondary),
    accent: color(src.accent, d.accent),
    tracking: num(src.tracking, 'tracking', d.tracking),
    weight: Math.round(num(src.weight, 'weight', d.weight) / 100) * 100,
    speed: num(src.speed, 'speed', d.speed),
    intensity: num(src.intensity, 'intensity', d.intensity),
    scale: num(src.scale, 'scale', d.scale),
    seed: Math.round(num(src.seed, 'seed', d.seed)),
    direction,
    loop: typeof src.loop === 'boolean' ? src.loop : d.loop,
    ratio: RATIOS.includes(src.ratio as Ratio) ? (src.ratio as Ratio) : d.ratio,
    params,
  };
}

export const weightSupported = (font: FontKey) => WEIGHT_RANGE[font] !== null;
export { usableWeight };

// ---- URL (de)serialisation: only values that differ from defaults ------------

const KEYS: [keyof CommonSettings, string][] = [
  ['text', 't'],
  ['font', 'f'],
  ['background', 'bg'],
  ['primary', 'c1'],
  ['secondary', 'c2'],
  ['accent', 'c3'],
  ['tracking', 'tr'],
  ['weight', 'w'],
  ['speed', 'sp'],
  ['intensity', 'in'],
  ['scale', 'sc'],
  ['direction', 'd'],
  ['seed', 'sd'],
  ['loop', 'lp'],
  ['ratio', 'r'],
];
const STRING_KEYS = new Set<keyof CommonSettings>(['text', 'font', 'primary', 'secondary', 'accent', 'background', 'ratio', 'direction']);
/** hard cap on any single query value before parsing (defence against huge URLs) */
const MAX_QUERY_VALUE = 400;

export function settingsToQuery(spec: EffectSpec, s: EffectSettings, d: EffectSettings = buildDefaultSettings(spec)): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, short] of KEYS) {
    if (s[k] === d[k]) continue;
    const v = s[k];
    q.set(short, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  for (const p of spec.params ?? []) {
    const v = s.params[p.key];
    if (v === p.default || v === undefined) continue;
    q.set(`p.${p.key}`, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return q;
}

export function settingsFromQuery(spec: EffectSpec, q: URLSearchParams, base?: EffectSettings): EffectSettings {
  const b = base ?? buildDefaultSettings(spec);
  const raw: Loose = { ...b, params: { ...b.params } };
  const params = raw.params as Record<string, unknown>;
  for (const [k, short] of KEYS) {
    const v = q.get(short);
    if (v === null || v.length > MAX_QUERY_VALUE) continue;
    raw[k] = k === 'loop' ? v === '1' || v === 'true' : STRING_KEYS.has(k) ? v : v;
  }
  for (const p of spec.params ?? []) {
    const v = q.get(`p.${p.key}`);
    if (v === null || v.length > MAX_QUERY_VALUE) continue;
    params[p.key] = v;
  }
  return normalizeSettings(spec, raw, b);
}

export function hasQuerySettings(q: URLSearchParams): boolean {
  for (const key of q.keys()) if (KEYS.some(([, s]) => s === key) || key.startsWith('p.')) return true;
  return false;
}

/**
 * "Random but reproducible": derive a new seed and, from it, every range / select /
 * toggle param. The same seed always produces the same settings.
 */
export function randomizeSettings(spec: EffectSpec, s: EffectSettings, seed: number): EffectSettings {
  const r = mulberry32(seed * 7919 + 13);
  const params = { ...s.params };
  for (const p of spec.params ?? []) {
    if (p.type === 'range') {
      const steps = Math.round((p.max - p.min) / p.step);
      // stay in the middle 70% of the range so results remain usable
      const k = Math.round(steps * (0.15 + r() * 0.7));
      params[p.key] = validParam(p, p.min + k * p.step);
    } else if (p.type === 'select') params[p.key] = p.options[Math.floor(r() * p.options.length)].value;
    else if (p.type === 'toggle') params[p.key] = r() < 0.5;
  }
  const next: EffectSettings = { ...s, seed, params };
  if (spec.controls.includes('intensity')) next.intensity = +(0.6 + r() * 0.9).toFixed(2);
  if (spec.directions && spec.directions.length > 1 && spec.controls.includes('direction'))
    next.direction = spec.directions[Math.floor(r() * spec.directions.length)];
  return next;
}
