import { gsap } from 'gsap';
import type { EffectContext, EffectRuntime } from './types';
import { stageCanvas, type StageCanvas } from './canvas';

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
/** 0→1→0 triangle over one unit */
export const tri = (x: number) => 1 - Math.abs(mod(x, 1) * 2 - 1);

/** GSAP ease as a plain function, e.g. ease('back.out(2)')(0.5) */
export const ease = (name: string): ((t: number) => number) => gsap.parseEase(name) as (t: number) => number;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut3 = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 3;
export const easeIn3 = (t: number) => clamp(t, 0, 1) ** 3;
export const easeOutBack = (t: number, s = 1.70158) => {
  const x = clamp(t, 0, 1) - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
};
export const easeOutElastic = (t: number) => {
  const x = clamp(t, 0, 1);
  if (x === 0 || x === 1) return x;
  return 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};
/** Damped oscillation: 1 at t=0 decaying to 0. */
export const damp = (t: number, freq = 6, decay = 5) => Math.exp(-decay * Math.max(0, t)) * Math.cos(freq * TAU * Math.max(0, t));

/**
 * Phase helper for scripted timelines: given time t inside a cycle and a list of
 * segment durations, returns { i, p } = active segment index and its 0–1 progress.
 */
export function phase(t: number, durations: number[]): { i: number; p: number; total: number } {
  const total = durations.reduce((a, b) => a + b, 0);
  let x = mod(t, total);
  for (let i = 0; i < durations.length; i++) {
    if (x < durations[i]) return { i, p: durations[i] > 0 ? x / durations[i] : 1, total };
    x -= durations[i];
  }
  return { i: durations.length - 1, p: 1, total };
}

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
  settle?: number;
}

/**
 * Build a runtime from a paused GSAP timeline. The Player drives it via totalTime(t),
 * so speed / pause / seek / replay are handled centrally and deterministically.
 * Everything created inside `build` is reverted on dispose (gsap.context).
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
 * The most common runtime: one full-stage canvas redrawn from scratch every frame
 * as a pure function of time. The background is painted automatically (skipped for
 * transparent PNG capture) unless `paintBackground: false`.
 */
export function canvasRuntime(
  ctx: EffectContext,
  draw: (g: CanvasRenderingContext2D, t: number, cv: StageCanvas, dt: number) => void,
  opts: { paintBackground?: boolean; settle?: number; dispose?: () => void; background?: () => string } = {},
): EffectRuntime & { cv: StageCanvas } {
  const cv = stageCanvas(ctx);
  const paint = opts.paintBackground !== false;
  return {
    cv,
    canvas: cv.canvas,
    settle: opts.settle,
    render(t, dt) {
      if (paint && !ctx.capture.transparent) cv.clear(opts.background ? opts.background() : ctx.s.background);
      else cv.clear();
      cv.g.save();
      draw(cv.g, t, cv, dt);
      cv.g.restore();
    },
    dispose() {
      opts.dispose?.();
      cv.canvas.width = cv.canvas.height = 0;
    },
  };
}

/**
 * Pointer position for interactive effects: the real pointer when it is over the stage
 * (detail mode), otherwise an automatic path so cards and idle stages still demonstrate.
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
export function autoPath(ctx: EffectContext, t: number, sx = 0.34, sy = 0.24, fx = 0.13, fy = 0.21) {
  return {
    x: ctx.width * (0.5 + sx * Math.sin(t * TAU * fx)),
    y: ctx.height * (0.5 + sy * Math.sin(t * TAU * fy + 0.6)),
  };
}

/** Shorter stage side — use it to size things so 16:9, 1:1 and 9:16 all work. */
export const minSide = (ctx: EffectContext) => Math.min(ctx.width, ctx.height);

export { hexToRgb, rgba, mix, mixHex, luminance } from './canvas';
