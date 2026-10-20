import type { FontKey, FontStacks } from './types';

// Self-hosted via @fontsource (SIL OFL). The CJK CSS is split by unicode-range, so
// only the subsets for the characters actually typed get downloaded. Every stack
// ends in a Traditional Chinese fallback so Latin-only display faces (Oswald,
// JetBrains Mono) still render 中文 instead of tofu.
export const SANS_FAMILY = 'Noto Sans TC Variable';
export const SERIF_FAMILY = 'Noto Serif TC Variable';
export const COND_FAMILY = 'Oswald Variable';
export const MONO_FAMILY = 'JetBrains Mono';

const CJK_FALLBACK = '"PingFang TC", "Heiti TC", "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif';

export const FONT: FontStacks = {
  sans: `"${SANS_FAMILY}", "Noto Sans TC", ${CJK_FALLBACK}`,
  condensed: `"${COND_FAMILY}", "Oswald", "Arial Narrow", "${SANS_FAMILY}", ${CJK_FALLBACK}`,
  serif: `"${SERIF_FAMILY}", "Noto Serif TC", "PMingLiU", "Songti TC", serif`,
  mono: `"${MONO_FAMILY}", ui-monospace, Consolas, "${SANS_FAMILY}", ${CJK_FALLBACK}`,
};

export const FONT_OPTIONS: { value: FontKey; label: string }[] = [
  { value: 'sans', label: '黑體 Noto Sans TC' },
  { value: 'condensed', label: '窄體 Oswald（中文回退黑體）' },
  { value: 'serif', label: '明體 Noto Serif TC' },
  { value: 'mono', label: '等寬 JetBrains Mono' },
];

/** Weight range that is really available per family (variable axes / loaded files). */
export const WEIGHT_RANGE: Record<FontKey, [number, number] | null> = {
  sans: [300, 900],
  condensed: [300, 700],
  serif: [300, 900],
  mono: null, // only 400 / 700 files are loaded → weight slider hidden
};

export function usableWeight(font: FontKey, w: number): number {
  const r = WEIGHT_RANGE[font];
  if (!r) return w >= 600 ? 700 : 400;
  return Math.min(r[1], Math.max(r[0], w));
}

const loaded = new Map<string, Promise<void>>();
/** test hook: ?nofonts=1 in the hash pretends webfonts failed (fallback stacks are used). */
const FORCE_NO_FONTS = typeof location !== 'undefined' && /[?&]nofonts=1/.test(location.hash);

/**
 * Make sure the glyphs for `text` are loaded for the chosen stack before an effect
 * measures them. Never rejects: on failure / timeout the fallback fonts are used.
 */
export function ensureFonts(text: string, font: FontKey, timeoutMs = 3000): Promise<void> {
  if (FORCE_NO_FONTS || typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  const sample = (text || '') + 'ABCabc0123456789';
  const key = font + '|' + sample;
  const cached = loaded.get(key);
  if (cached) return cached;
  const fam = font === 'serif' ? SERIF_FAMILY : font === 'condensed' ? COND_FAMILY : font === 'mono' ? MONO_FAMILY : SANS_FAMILY;
  const jobs = [`700 64px "${fam}"`, `400 64px "${fam}"`, `900 64px "${SANS_FAMILY}"`, `500 64px "${SANS_FAMILY}"`].map((f) =>
    document.fonts.load(f, sample).catch(() => []),
  );
  const p = Promise.race([
    Promise.all(jobs).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]).catch(() => undefined);
  loaded.set(key, p);
  if (loaded.size > 300) loaded.clear();
  return p;
}

export const fontsDisabled = () => FORCE_NO_FONTS;
