import type { FontStacks } from './types';

// Self-hosted via @fontsource (SIL OFL). The CSS is split by unicode-range, so
// only the subsets for the characters actually typed get downloaded.
export const SANS_FAMILY = 'Noto Sans TC Variable';
export const SERIF_FAMILY = 'Noto Serif TC Variable';
export const MONO_FAMILY = 'JetBrains Mono';

const CJK_FALLBACK = '"PingFang TC", "Heiti TC", "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif';

export const FONT: FontStacks = {
  sans: `"${SANS_FAMILY}", "Noto Sans TC", ${CJK_FALLBACK}`,
  serif: `"${SERIF_FAMILY}", "Noto Serif TC", "PMingLiU", "Songti TC", serif`,
  mono: `"${MONO_FAMILY}", ui-monospace, "SFMono-Regular", Consolas, "${SANS_FAMILY}", monospace`,
};

const loaded = new Map<string, Promise<void>>();

/**
 * Make sure the glyphs for `text` are loaded for every stack before an effect
 * measures them. Never rejects: on failure / timeout the fallback fonts are used.
 */
export function ensureFonts(text: string, timeoutMs = 3500): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  const sample = (text || '') + 'ABCabc0123456789';
  const key = sample;
  const cached = loaded.get(key);
  if (cached) return cached;
  const jobs = [
    `900 64px "${SANS_FAMILY}"`,
    `400 64px "${SANS_FAMILY}"`,
    `700 64px "${SERIF_FAMILY}"`,
    `700 64px "${MONO_FAMILY}"`,
  ].map((f) => document.fonts.load(f, sample).catch(() => []));
  const p = Promise.race([
    Promise.all(jobs).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]).catch(() => undefined);
  loaded.set(key, p);
  if (loaded.size > 200) loaded.clear();
  return p;
}
