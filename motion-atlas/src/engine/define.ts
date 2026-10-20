import type { EffectSpec } from './types';

/** Typed identity: every effect file default-exports defineEffect({...}). */
export function defineEffect(spec: EffectSpec): EffectSpec {
  return spec;
}
