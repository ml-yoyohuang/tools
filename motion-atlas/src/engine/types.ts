// Shared types for MOTION ATLAS. Every effect is one file that calls
// defineEffect({...metadata, create}) — see docs/AUTHORING.md.

export type CategoryId = 'typography' | 'halftone' | 'grid' | 'lines' | 'shapes' | 'split' | 'wipe' | 'comic' | 'minimal';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
/** css3d = DOM with real CSS perspective / preserve-3d */
export type RendererKind = 'dom' | 'svg' | 'canvas' | 'css3d';
/** reference = name readable on the reference screenshot (rebuilt from name + frame, NOT source code) */
export type SourceType = 'reference' | 'partial-reference' | 'original';
export type Ratio = '16:9' | '1:1' | '9:16';
export type StageMode = 'card' | 'detail';
export type FontKey = 'sans' | 'condensed' | 'serif' | 'mono';
export type Direction = 'left' | 'right' | 'up' | 'down' | 'cw' | 'ccw';
export type PresetId = 'POP' | 'COOL' | 'PASTEL' | 'MONO' | 'STREET';

export interface Palette {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface CommonSettings extends Palette {
  text: string;
  font: FontKey;
  /** letter spacing in em (-0.1–0.6) */
  tracking: number;
  /** font weight 300–900 (only when the font supports it) */
  weight: number;
  /** playback speed multiplier (0.25–3) */
  speed: number;
  /** motion strength multiplier (0–2) */
  intensity: number;
  /** element / type scale multiplier (0.5–1.6) */
  scale: number;
  direction: Direction;
  /** seed for every random layout (1–9999) */
  seed: number;
  loop: boolean;
  ratio: Ratio;
}

export type ParamValue = number | boolean | string;

interface ParamBase {
  key: string;
  label: string;
  hint?: string;
  /** only shown (and only effective) when another param has this value */
  when?: { key: string; value: ParamValue };
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

/** Common controls an effect opts into. Only listed controls are shown (and only those affect it). */
export type CommonControl = 'text' | 'font' | 'tracking' | 'weight' | 'intensity' | 'scale' | 'direction' | 'secondary' | 'accent' | 'seed';

export interface PointerState {
  x: number;
  y: number;
  inside: boolean;
  down: boolean;
  /** performance.now() of the last real pointer movement, 0 if never */
  lastMove: number;
  /** performance.now() of the last pointerdown, 0 if never */
  lastDown: number;
}

export interface FontStacks {
  sans: string;
  condensed: string;
  serif: string;
  mono: string;
}

export interface CaptureFlags {
  /** true while a transparent PNG is being captured: skip painting the background */
  transparent: boolean;
}

export interface EffectContext {
  /** effect-owned layer, aria-hidden, absolutely filling the stage */
  root: HTMLElement;
  /** accessible overlay for effect-specific UI */
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
  /** quality factor 0.3–1: scale particle / grid / trail counts with it */
  q: number;
  /** combined seed (effect id + settings seed) */
  seed: number;
  /** seeded PRNG in [0,1) — recreated on every build so replays are identical */
  rand: () => number;
  font: FontStacks;
  /** family stack chosen in settings (s.font) */
  family: string;
  /** usable weight for the chosen family */
  weight: number;
  dir: Direction;
  /** +1 for right / down / cw, -1 for left / up / ccw */
  dirSign: 1 | -1;
  pointer: PointerState;
  capture: CaptureFlags;
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
  /** Root SVG that represents the whole visual (enables PNG export via serialisation). */
  svg?: SVGSVGElement;
  /** Message shown under the stage. */
  notice?: string;
}

export interface MotionRecipe {
  /** 入場 */
  enter: string;
  /** 運動 */
  motion: string;
  /** 停留 */
  hold: string;
  /** 離場 */
  exit: string;
  /** 循環 */
  loop: string;
}

/** What an effect author writes. */
export interface EffectSpec {
  id: string;
  /** spec code, e.g. T01 / H03 / P12 */
  code: string;
  nameZh: string;
  nameEn: string;
  category: CategoryId;
  sourceType: SourceType;
  difficulty: Difficulty;
  renderer: RendererKind;
  /** one-sentence description */
  description: string;
  tags: string[];
  /** 適用場景 */
  suitable: string[];
  /** 技術原理 */
  principle: string;
  defaultText: string;
  /** default palette: a preset id, optionally overridden per colour */
  palette?: PresetId;
  colors?: Partial<Palette>;
  defaults?: Partial<Omit<CommonSettings, keyof Palette>>;
  controls: CommonControl[];
  /** allowed directions (first = default unless defaults.direction is set) */
  directions?: Direction[];
  params?: ParamDef[];
  recipe: MotionRecipe;
  /** observable acceptance criteria */
  accept: string[];
  /** known limitations */
  limits?: string[];
  /** has a natural end; shows the loop toggle */
  loopable?: boolean;
  /** time used for the static poster frame */
  posterTime?: number;
  /** length of one full cycle (s) — used for WebM recording length */
  cycle?: number;
  maxChars?: number;
  textHint?: string;
  /** uses pointer input in the detail view */
  interactive?: boolean;
  /** background can be omitted for a transparent PNG */
  transparent?: boolean;
  /** ids in the previous kinetic-typography catalog that this effect replaces */
  legacyIds?: string[];
  create(ctx: EffectContext): EffectRuntime | Promise<EffectRuntime>;
}

export interface Capabilities {
  png: 'canvas' | 'svg' | 'dom' | false;
  transparentPng: boolean;
  webm: boolean;
  seek: true;
  pointer: boolean;
}

/** Registry entry (EffectSpec + derived data). */
export interface EffectDef extends EffectSpec {
  /** 1-based global display number */
  displayNumber: number;
  defaultSettings: EffectSettings;
  parameterSchema: { common: CommonControl[]; params: ParamDef[] };
  motionRecipe: MotionRecipe;
  acceptanceCriteria: string[];
  capabilities: Capabilities;
  rendererFactory: EffectSpec['create'];
}
