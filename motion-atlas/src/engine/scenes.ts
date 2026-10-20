// Shared A / B scenes for SPLIT and WIPE transitions. Both scenes are rendered once
// per build into offscreen canvases (so every frame is just compositing), and each
// scene has its own colour field, phrase and motif so the A→B relation is readable.
import { offscreen, drawLayout } from './canvas';
import { bool, clamp, easeInOut, mod, num } from './helpers';
import { layoutText, phrases } from './text';
import type { EffectContext, ParamDef } from './types';

export interface Scene {
  canvas: HTMLCanvasElement;
  bg: string;
  fg: string;
  label: string;
}

export interface Scenes {
  a: Scene;
  b: Scene;
  /** draw scene 0 (A) or 1 (B) covering the stage */
  draw(g: CanvasRenderingContext2D, which: 0 | 1): void;
  scene(which: 0 | 1): Scene;
}

function paintScene(ctx: EffectContext, label: string, bg: string, fg: string, motif: string, kind: 0 | 1): HTMLCanvasElement {
  const { width: w, height: h, dpr } = ctx;
  const o = offscreen(w * dpr, h * dpr);
  const g = o.g;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const m = Math.min(w, h);
  // motif: A = large circle bottom-left, B = rotated square top-right (different geometry, not just colour)
  g.fillStyle = motif;
  if (kind === 0) {
    g.beginPath();
    g.arc(w * 0.2, h * 0.78, m * 0.26, 0, Math.PI * 2);
    g.fill();
  } else {
    g.save();
    g.translate(w * 0.8, h * 0.24);
    g.rotate(0.35);
    g.fillRect(-m * 0.2, -m * 0.2, m * 0.4, m * 0.4);
    g.restore();
  }
  g.fillStyle = fg;
  g.font = `700 ${Math.max(10, m * 0.05)}px ${ctx.font.mono}`;
  g.textBaseline = 'top';
  g.fillText(kind === 0 ? 'A' : 'B', m * 0.06, m * 0.06);
  const L = layoutText(ctx, label, { maxWidth: w * 0.78, maxHeight: h * 0.42, fill: 0.9 });
  drawLayout(g, L, { fill: fg });
  return o.canvas;
}

export function makeScenes(ctx: EffectContext): Scenes {
  const ph = phrases(ctx.text);
  const la = ph[0] ?? 'A';
  const lb = ph[1] ?? ph[0] ?? 'B';
  const s = ctx.s;
  const a: Scene = { canvas: paintScene(ctx, la, s.background, s.primary, s.secondary, 0), bg: s.background, fg: s.primary, label: la };
  const b: Scene = { canvas: paintScene(ctx, lb, s.primary, s.background, s.accent, 1), bg: s.primary, fg: s.background, label: lb };
  return {
    a,
    b,
    scene: (w) => (w ? b : a),
    draw(g, which) {
      g.drawImage(which ? b.canvas : a.canvas, 0, 0, ctx.width, ctx.height);
    },
  };
}

/** Params every transition gets (duration, hold, manual scrubbing). */
export const TRANSITION_PARAMS: ParamDef[] = [
  { key: 'dur', label: '轉場時間', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { key: 'hold', label: '停留時間', type: 'range', min: 0.2, max: 3, step: 0.1, default: 1, unit: 's' },
  { key: 'manual', label: '手動進度', type: 'toggle', default: false, hint: '開啟後由下方滑桿控制 A→B 進度' },
  { key: 'progress', label: '進度', type: 'range', min: 0, max: 100, step: 1, default: 50, unit: '%', when: { key: 'manual', value: true } },
];

export interface TransitionState {
  /** scene being replaced */
  from: 0 | 1;
  /** scene being revealed */
  to: 0 | 1;
  /** raw linear progress 0–1 */
  p: number;
  /** eased progress 0–1 */
  e: number;
  /** whether we are inside the transition (vs. holding) */
  moving: boolean;
  /** cycle length (s) */
  cycle: number;
}

/**
 * Loop: hold A → A→B → hold B → B→A. With `manual` on, progress comes from the slider.
 * `easing` defaults to a cubic in-out; pass your own for a different feel.
 */
export function transition(ctx: EffectContext, t: number, easing: (x: number) => number = easeInOut): TransitionState {
  const dur = num(ctx, 'dur', 1.2);
  const hold = num(ctx, 'hold', 1);
  const cycle = 2 * (dur + hold);
  if (bool(ctx, 'manual', false)) {
    const p = clamp(num(ctx, 'progress', 50) / 100, 0, 1);
    return { from: 0, to: 1, p, e: easing(p), moving: true, cycle };
  }
  const x = mod(t, cycle);
  const half = dur + hold;
  const first = x < half;
  const local = first ? x : x - half;
  const from: 0 | 1 = first ? 0 : 1;
  const to: 0 | 1 = first ? 1 : 0;
  if (local < hold) return { from, to, p: 0, e: 0, moving: false, cycle };
  const p = clamp((local - hold) / dur, 0, 1);
  return { from, to, p, e: easing(p), moving: true, cycle };
}
