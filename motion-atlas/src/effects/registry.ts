import { buildDefaultSettings } from '../engine/settings';
import type { Capabilities, EffectDef, EffectSpec } from '../engine/types';
import { CATEGORIES } from './categories';

// Every file in ./<category>/ default-exports one EffectSpec (see docs/AUTHORING.md).
const modules = import.meta.glob<{ default: EffectSpec }>('./*/*.ts', { eager: true });

const specs: EffectSpec[] = [];
for (const [path, mod] of Object.entries(modules)) {
  if (path.split('/').pop()!.startsWith('_')) continue;
  if (mod?.default?.id) specs.push(mod.default);
}
const catOrder = new Map(CATEGORIES.map((c, i) => [c.id, i]));
specs.sort((a, b) => catOrder.get(a.category)! - catOrder.get(b.category)! || a.code.localeCompare(b.code, 'en', { numeric: true }));

function capabilities(s: EffectSpec): Capabilities {
  const png = s.renderer === 'canvas' ? 'canvas' : s.renderer === 'svg' ? 'svg' : s.renderer === 'dom' ? 'dom' : false;
  return {
    png,
    transparentPng: !!s.transparent && (png === 'canvas' || png === 'svg'),
    webm: s.renderer === 'canvas',
    seek: true,
    pointer: !!s.interactive,
  };
}

export const EFFECTS: EffectDef[] = specs.map((s, i) => ({
  ...s,
  displayNumber: i + 1,
  defaultSettings: buildDefaultSettings(s),
  parameterSchema: { common: s.controls, params: s.params ?? [] },
  motionRecipe: s.recipe,
  acceptanceCriteria: s.accept,
  capabilities: capabilities(s),
  rendererFactory: s.create,
}));

export const EFFECT_MAP = new Map(EFFECTS.map((e) => [e.id, e]));
/** previous kinetic-typography id → atlas id (keeps old favourites / links working) */
export const LEGACY_MAP = new Map<string, string>();
for (const e of EFFECTS) for (const l of e.legacyIds ?? []) LEGACY_MAP.set(l, e.id);

export function getEffect(id: string): EffectDef | undefined {
  return EFFECT_MAP.get(id) ?? EFFECT_MAP.get(LEGACY_MAP.get(id) ?? '');
}

export function categoryCounts(list: EffectDef[] = EFFECTS): Record<string, number> {
  const out: Record<string, number> = { all: list.length };
  for (const e of list) out[e.category] = (out[e.category] ?? 0) + 1;
  return out;
}
