// Shared types for the effect engine. Every effect is described by metadata
// (catalog.ts) plus an implementation (effects/impl/eXX.ts) that builds a
// runtime driven by the shared Player clock.

export type CategoryId = 'impact' | 'flow' | 'switch' | 'space' | 'material' | 'interactive';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type RendererKind = 'dom' | 'svg' | 'canvas' | '3d';
export type Ratio = '16:9' | '1:1' | '9:16';
export type StageMode = 'card' | 'detail';

export interface CommonSettings {
  text: string;
  primary: string;
  secondary: string;
  background: string;
  /** multiplier of the auto-fitted font size (0.5–1.6) */
  fontScale: number;
  /** letter spacing in em (-0.1–0.6) */
  tracking: number;
  /** playback speed multiplier (0.25–3) */
  speed: number;
  /** motion strength multiplier (0–2) */
  intensity: number;
  loop: boolean;
  ratio: Ratio;
}

export type ParamValue = number | boolean | string;

interface ParamBase {
  key: string;
  label: string;
  hint?: string;
}
export interface RangeParam extends ParamBase {
  type: 'range';
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}
export interface ToggleParam extends ParamBase {
  type: 'toggle';
  default: boolean;
}
export interface SelectParam extends ParamBase {
  type: 'select';
  options: { value: string; label: string }[];
  default: string;
}
export interface TextParam extends ParamBase {
  type: 'text';
  default: string;
  maxLength: number;
}
export type ParamDef = RangeParam | ToggleParam | SelectParam | TextParam;

export interface EffectSettings extends CommonSettings {
  params: Record<string, ParamValue>;
}

/** Common controls that an effect may hide when they have no visible effect. */
export type CommonControl = 'text' | 'secondary' | 'fontScale' | 'tracking' | 'intensity';

export interface PointerState {
  /** stage-local px */
  x: number;
  y: number;
  /** pointer is over the stage (detail mode only) */
  inside: boolean;
  down: boolean;
  /** performance.now() of the last real pointer movement, 0 if never */
  lastMove: number;
}

export interface FontStacks {
  sans: string;
  serif: string;
  mono: string;
}

export interface EffectContext {
  /** effect-owned layer, aria-hidden, absolutely filling the stage */
  root: HTMLElement;
  /** accessible overlay for effect-specific UI (buttons, file input, scroll area) */
  ui: HTMLElement;
  width: number;
  height: number;
  /** device pixel ratio already capped for the mode */
  dpr: number;
  s: EffectSettings;
  /** sanitized text, never empty (falls back to the default text) */
  text: string;
  mode: StageMode;
  reducedMotion: boolean;
  lowPower: boolean;
  /** quality factor 0.3–1, use it to scale particle / grid / trail counts */
  q: number;
  seed: number;
  /** seeded PRNG in [0,1) — reset on every build so replays are identical */
  rand: () => number;
  font: FontStacks;
  pointer: PointerState;
  /** true when the WebGL path is allowed (detail mode + support) */
  webgl: boolean;
}

export interface EffectRuntime {
  /** Draw the state at effect-time t (seconds, already speed-scaled). dt = frame delta (0 on seek). */
  render(t: number, dt: number): void;
  /** Optional fixed-step simulation; when present, seek() replays it from reset(). */
  step?(t: number, dt: number): void;
  reset?(): void;
  /** When loop is off, playback stops and holds at this time. */
  settle?: number;
  dispose?(): void;
  /** Canvas that represents the whole visual (enables PNG / WebM export). */
  canvas?: HTMLCanvasElement;
  /** Called right before exporting a canvas frame (WebGL needs a fresh draw). */
  beforeCapture?(): void;
  /** Message shown under the stage (e.g. WebGL fallback). */
  notice?: string;
}

export interface EffectImpl {
  id: string;
  create(ctx: EffectContext): EffectRuntime | Promise<EffectRuntime>;
  /** lightweight version used for cards and when WebGL is unavailable */
  lite?(ctx: EffectContext): EffectRuntime | Promise<EffectRuntime>;
  requiresWebGL?: boolean;
  params?: ParamDef[];
  defaults?: Partial<CommonSettings>;
  hide?: CommonControl[];
  /** entrance / exit effects: true shows the loop toggle */
  loopable?: boolean;
  /** time used for the static poster frame (cards in reduced motion / not playing) */
  posterTime?: number;
  /** extra hint shown under the text field */
  textHint?: string;
  /** max grapheme count for this effect's text (default 40) */
  maxChars?: number;
  /** uses pointer input in detail mode */
  interactive?: boolean;
}

export interface EffectMeta {
  id: string;
  number: number;
  nameZh: string;
  nameEn: string;
  description: string;
  category: CategoryId;
  tags: string[];
  difficulty: Difficulty;
  renderer: RendererKind;
  /** uses Three.js in detail view */
  webgl?: boolean;
  defaultText: string;
  suitableFor: string[];
  implementationNotes: string;
}

export type EffectDef = EffectMeta & EffectImpl;
