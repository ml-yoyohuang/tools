import { PALETTE } from './helpers';
import { clampGraphemes } from './text';
import type { CommonSettings, EffectDef, EffectSettings, ParamDef, ParamValue, Ratio } from './types';

export const RATIOS: Ratio[] = ['16:9', '1:1', '9:16'];
export const RATIO_VALUE: Record<Ratio, number> = { '16:9': 16 / 9, '1:1': 1, '9:16': 9 / 16 };

export const LIMITS = {
  fontScale: { min: 0.5, max: 1.6, step: 0.05 },
  tracking: { min: -0.1, max: 0.6, step: 0.01 },
  speed: { min: 0.25, max: 3, step: 0.05 },
  intensity: { min: 0, max: 2, step: 0.05 },
} as const;

export const BASE_SETTINGS: Omit<CommonSettings, 'text'> = {
  ...PALETTE.darkLime,
  fontScale: 1,
  tracking: 0,
  speed: 1,
  intensity: 1,
  loop: true,
  ratio: '16:9',
};

export function defaultParams(def: EffectDef): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const p of def.params ?? []) out[p.key] = p.default;
  return out;
}

export function defaultSettings(def: EffectDef): EffectSettings {
  return {
    ...BASE_SETTINGS,
    text: def.defaultText,
    ...def.defaults,
    params: defaultParams(def),
  };
}

const HEX = /^#[0-9a-f]{6}$/i;
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (v: number, step: number) => Math.round(v / step) * step;

function validParam(p: ParamDef, raw: unknown): ParamValue {
  switch (p.type) {
    case 'range': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (raw === '' || raw === null || !Number.isFinite(n)) return p.default;
      return +clampN(snap(n, p.step), p.min, p.max).toFixed(4);
    }
    case 'toggle':
      if (typeof raw === 'boolean') return raw;
      if (raw === '1' || raw === 'true') return true;
      if (raw === '0' || raw === 'false') return false;
      return p.default;
    case 'select':
      return p.options.some((o) => o.value === raw) ? (raw as string) : p.default;
    case 'text':
      return typeof raw === 'string' ? clampGraphemes(raw.replace(/[\u0000-\u001f\u007f]/g, ''), p.maxLength) : p.default;
  }
}

type LooseSettings = Partial<Record<keyof CommonSettings, unknown>> & { params?: Record<string, unknown> };

/** Validate any (possibly hostile) partial settings object against an effect. */
export function normalizeSettings(def: EffectDef, input: LooseSettings): EffectSettings {
  const d = defaultSettings(def);
  const num = (v: unknown, key: keyof typeof LIMITS) => {
    const n = typeof v === 'number' ? v : Number(v);
    const L = LIMITS[key];
    return v !== '' && v !== null && v !== undefined && Number.isFinite(n) ? +clampN(n, L.min, L.max).toFixed(3) : d[key];
  };
  const color = (v: unknown, fb: string) => (typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : fb);
  const params: Record<string, ParamValue> = {};
  for (const p of def.params ?? []) {
    params[p.key] = input.params && p.key in input.params ? validParam(p, input.params[p.key]) : p.default;
  }
  return {
    text: typeof input.text === 'string' ? clampGraphemes(input.text, def.maxChars ?? 40) : d.text,
    primary: color(input.primary, d.primary),
    secondary: color(input.secondary, d.secondary),
    background: color(input.background, d.background),
    fontScale: num(input.fontScale, 'fontScale'),
    tracking: num(input.tracking, 'tracking'),
    speed: num(input.speed, 'speed'),
    intensity: num(input.intensity, 'intensity'),
    loop: typeof input.loop === 'boolean' ? input.loop : d.loop,
    ratio: RATIOS.includes(input.ratio as Ratio) ? (input.ratio as Ratio) : d.ratio,
    params,
  };
}

// ---- URL (de)serialisation: only values that differ from defaults ------------

const KEYS: [keyof CommonSettings, string][] = [
  ['text', 't'],
  ['primary', 'c1'],
  ['secondary', 'c2'],
  ['background', 'bg'],
  ['fontScale', 'fs'],
  ['tracking', 'tr'],
  ['speed', 'sp'],
  ['intensity', 'in'],
  ['loop', 'lp'],
  ['ratio', 'r'],
];
const STRING_KEYS = new Set<keyof CommonSettings>(['text', 'primary', 'secondary', 'background', 'ratio']);

export function settingsToQuery(def: EffectDef, s: EffectSettings): URLSearchParams {
  const d = defaultSettings(def);
  const q = new URLSearchParams();
  for (const [k, short] of KEYS) {
    if (s[k] === d[k]) continue;
    const v = s[k];
    q.set(short, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  for (const p of def.params ?? []) {
    const v = s.params[p.key];
    if (v === p.default || v === undefined) continue;
    q.set(`p.${p.key}`, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return q;
}

export function settingsFromQuery(def: EffectDef, q: URLSearchParams, base?: EffectSettings): EffectSettings {
  const b = base ?? defaultSettings(def);
  const raw: LooseSettings = { ...b, params: { ...b.params } };
  for (const [k, short] of KEYS) {
    const v = q.get(short);
    if (v === null) continue;
    raw[k] = k === 'loop' ? v === '1' || v === 'true' : STRING_KEYS.has(k) ? v : Number(v);
  }
  for (const p of def.params ?? []) {
    const v = q.get(`p.${p.key}`);
    if (v === null) continue;
    raw.params![p.key] = p.type === 'range' ? Number(v) : v;
  }
  return normalizeSettings(def, raw);
}

export function hasQuerySettings(q: URLSearchParams): boolean {
  for (const key of q.keys()) if (KEYS.some(([, s]) => s === key) || key.startsWith('p.')) return true;
  return false;
}
