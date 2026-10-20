import type { Palette, PresetId } from './types';

/** Base motion colours (spec 03). */
export const C = {
  black: '#141414',
  cream: '#F2E8D5',
  blue: '#3450FF',
  yellow: '#FFE35A',
  pink: '#ED589A',
  red: '#E63A2E',
  white: '#FFFFFF',
} as const;

export interface PresetDef extends Palette {
  id: PresetId;
  label: string;
  note: string;
}

export const PRESETS: PresetDef[] = [
  { id: 'POP', label: 'POP', note: '藍、黃、粉紅、白', background: C.blue, primary: C.yellow, secondary: C.pink, accent: C.white },
  { id: 'COOL', label: 'COOL', note: '深藍、亮藍、淺藍、白', background: '#0D1A4A', primary: C.white, secondary: '#3D7BFF', accent: '#A8D0FF' },
  { id: 'PASTEL', label: 'PASTEL', note: '米白、淡紫、淡粉、淡藍', background: C.cream, primary: '#9A86DE', secondary: '#F2A2C0', accent: '#92C4EE' },
  { id: 'MONO', label: 'MONO', note: '黑、白與灰階', background: C.black, primary: C.white, secondary: '#8A8A8A', accent: '#D4D4D4' },
  { id: 'STREET', label: 'STREET', note: '黑、紅橘、米白、白', background: C.black, primary: C.cream, secondary: C.red, accent: C.white },
];

export const PRESET_MAP = Object.fromEntries(PRESETS.map((p) => [p.id, p])) as Record<PresetId, PresetDef>;

export function presetPalette(id: PresetId): Palette {
  const p = PRESET_MAP[id];
  return { background: p.background, primary: p.primary, secondary: p.secondary, accent: p.accent };
}

/** Which preset (if any) a palette matches exactly. */
export function matchPreset(p: Palette): PresetId | null {
  for (const d of PRESETS) {
    if (d.background === p.background && d.primary === p.primary && d.secondary === p.secondary && d.accent === p.accent) return d.id;
  }
  return null;
}
