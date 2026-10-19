import { gsap } from 'gsap';
import type { CommonSettings, EffectContext, EffectRuntime } from './types';

export { gsap };

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};
export const TAU = Math.PI * 2;
/** positive modulo */
export const mod = (a: number, n: number) => ((a % n) + n) % n;

/** GSAP ease as a plain function, e.g. ease('back.out(2)')(0.5) */
export const ease = (name: string): ((t: number) => number) => gsap.parseEase(name) as (t: number) => number;

/** Read a numeric param with fallback. */
export function num(ctx: EffectContext, key: string, fallback: number): number {
  const v = ctx.s.params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
export function bool(ctx: EffectContext, key: string, fallback: boolean): boolean {
  const v = ctx.s.params[key];
  return typeof v === 'boolean' ? v : fallback;
}
export function str(ctx: EffectContext, key: string, fallback: string): string {
  const v = ctx.s.params[key];
  return typeof v === 'string' ? v : fallback;
}

export interface TimelineExtra {
  render?: (t: number, dt: number) => void;
  dispose?: () => void;
  /** time to hold when loop is off (overrides opts.settle) */
  settle?: number;
}

/**
 * Build a runtime from a paused GSAP timeline. The Player drives it via totalTime(t),
 * so speed / pause / seek / replay are all handled centrally and deterministically.
 *
 * `build` receives the timeline and may return extra hooks (e.g. a per-frame `render`
 * for things GSAP doesn't animate). Everything created inside `build` is reverted on dispose.
 */
export function timelineRuntime(
  ctx: EffectContext,
  build: (tl: gsap.core.Timeline) => void | TimelineExtra,
  opts: { repeat?: boolean; repeatDelay?: number; settle?: number } = {},
): EffectRuntime {
  let tl!: gsap.core.Timeline;
  let extra: TimelineExtra | undefined;
  const gctx = gsap.context(() => {
    tl = gsap.timeline({ paused: true, repeat: opts.repeat === false ? 0 : -1, repeatDelay: opts.repeatDelay ?? 0 });
    extra = build(tl) || undefined;
  }, ctx.root);
  tl.totalTime(0);
  return {
    render(t, dt) {
      tl.totalTime(Math.max(0, t));
      extra?.render?.(t, dt);
    },
    settle: extra?.settle ?? opts.settle,
    dispose() {
      extra?.dispose?.();
      tl.kill();
      gctx.revert();
    },
  };
}

/**
 * Pointer position for interactive effects: the real pointer when it is over the stage
 * (detail mode), otherwise an automatic path so cards and idle stages still demonstrate.
 * Returns stage px and whether it's the real pointer.
 */
export function pointerOrAuto(
  ctx: EffectContext,
  t: number,
  auto: (t: number) => { x: number; y: number },
  idleMs = 1800,
): { x: number; y: number; real: boolean } {
  const p = ctx.pointer;
  if (p.inside && performance.now() - p.lastMove < idleMs) return { x: p.x, y: p.y, real: true };
  const a = auto(t);
  return { x: a.x, y: a.y, real: false };
}

/** Lissajous-style automatic pointer path across the stage. */
export function autoPath(ctx: EffectContext, t: number, sx = 0.38, sy = 0.22, fx = 0.23, fy = 0.37) {
  return {
    x: ctx.width * (0.5 + sx * Math.sin(t * TAU * fx)),
    y: ctx.height * (0.5 + sy * Math.sin(t * TAU * fy + 0.6)),
  };
}

// ---------------------------------------------------------------------------
// Palettes (2–3 colours per preview, from the lab's brand colours)
// ---------------------------------------------------------------------------

export const C = {
  ink: '#101114',
  card: '#191B20',
  paper: '#F4F1E8',
  lime: '#D7FF00',
  pink: '#E383B4',
  coral: '#FF7153',
  violet: '#9D7BFF',
  teal: '#27D3C2',
} as const;

type Pal = Pick<CommonSettings, 'primary' | 'secondary' | 'background'>;
export const PALETTE = {
  darkLime: { background: C.ink, primary: C.paper, secondary: C.lime },
  darkCoral: { background: C.ink, primary: C.paper, secondary: C.coral },
  darkPink: { background: C.ink, primary: C.paper, secondary: C.pink },
  darkViolet: { background: C.ink, primary: C.paper, secondary: C.violet },
  darkTeal: { background: C.ink, primary: C.paper, secondary: C.teal },
  limeOnDark: { background: C.ink, primary: C.lime, secondary: C.paper },
  tealOnDark: { background: C.ink, primary: C.teal, secondary: C.paper },
  pinkOnDark: { background: C.ink, primary: C.pink, secondary: C.paper },
  paperInk: { background: C.paper, primary: C.ink, secondary: C.coral },
  paperViolet: { background: C.paper, primary: C.ink, secondary: C.violet },
  paperTeal: { background: C.paper, primary: C.ink, secondary: C.teal },
  paperPink: { background: C.paper, primary: C.ink, secondary: C.pink },
  lime: { background: C.lime, primary: C.ink, secondary: C.violet },
  coral: { background: C.coral, primary: C.ink, secondary: C.paper },
  violet: { background: C.violet, primary: C.ink, secondary: C.paper },
  pink: { background: C.pink, primary: C.ink, secondary: C.paper },
  teal: { background: C.teal, primary: C.ink, secondary: C.paper },
} satisfies Record<string, Pal>;
