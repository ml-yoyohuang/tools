import { CATALOG } from './catalog';
import type { EffectDef, EffectImpl } from '../engine/types';

// Every file in ./impl exports one EffectImpl as default; metadata lives in catalog.ts.
const modules = import.meta.glob<{ default: EffectImpl }>('./impl/e*.ts', { eager: true });
const impls = new Map<string, EffectImpl>();
for (const mod of Object.values(modules)) {
  if (mod?.default?.id) impls.set(mod.default.id, mod.default);
}

export const MISSING_IDS: string[] = [];

export const EFFECTS: EffectDef[] = CATALOG.map((meta) => {
  const impl = impls.get(meta.id);
  if (!impl) {
    MISSING_IDS.push(meta.id);
    return {
      ...meta,
      create: (ctx) => {
        const n = document.createElement('div');
        n.textContent = '尚未實作';
        Object.assign(n.style, { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', color: '#888', font: `700 16px ${ctx.font.sans}` });
        ctx.root.appendChild(n);
        return { render() {} };
      },
    };
  }
  return { ...meta, ...impl, id: meta.id };
});

export const EFFECT_MAP = new Map(EFFECTS.map((e) => [e.id, e]));

export function getEffect(id: string): EffectDef | undefined {
  return EFFECT_MAP.get(id);
}

export function neighbours(id: string): { prev: EffectDef; next: EffectDef } {
  const i = EFFECTS.findIndex((e) => e.id === id);
  const n = EFFECTS.length;
  return { prev: EFFECTS[(i - 1 + n) % n], next: EFFECTS[(i + 1) % n] };
}
