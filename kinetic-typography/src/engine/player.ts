import { gsap } from 'gsap';
import { ensureFonts, FONT } from './fonts';
import { hashString, mulberry32 } from './random';
import { clearMeasureCache, sanitizeText } from './text';
import type { EffectContext, EffectDef, EffectRuntime, EffectSettings, PointerState, StageMode } from './types';

// ---------------------------------------------------------------------------
// One global clock for every live stage. Effects never run their own rAF / GSAP
// ticker: the Player calls runtime.render(t) so pause, speed, seek and replay
// behave identically for DOM, SVG, Canvas and WebGL effects.
// ---------------------------------------------------------------------------

const active = new Set<Player>();
let liveCount = 0;
/** debug: number of undisposed players and of currently ticking players */
export const playerStats = () => ({ live: liveCount, playing: active.size });
let tickerOn = false;
function onTick(_time: number, deltaMs: number) {
  if (typeof document !== 'undefined' && document.hidden) return;
  const dt = Math.min(deltaMs / 1000, 1 / 15);
  for (const p of active) p.tick(dt);
}
function ensureTicker() {
  if (tickerOn) return;
  tickerOn = true;
  gsap.ticker.lagSmoothing(250, 33);
  gsap.ticker.add(onTick);
}

let fontsSettled = false;
if (typeof document !== 'undefined' && 'fonts' in document) {
  document.fonts.ready.then(() => {
    fontsSettled = true;
    clearMeasureCache();
  });
  document.fonts.addEventListener?.('loadingdone', () => clearMeasureCache());
}

// test hook: #/...?nowebgl=1 on first load simulates a browser without WebGL
const FORCE_NO_WEBGL = typeof location !== 'undefined' && /[?&]nowebgl=1/.test(location.hash);
// Only a positive result is cached: context creation can fail transiently
// (e.g. while the page is still loading in a background pane), so a negative
// answer is re-checked on the next build instead of disabling WebGL for good.
let webglCache = false;
export function webglSupported(): boolean {
  if (webglCache) return true;
  if (FORCE_NO_WEBGL) return false;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    webglCache = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

export const FIXED_DT = 1 / 60;
const MAX_SEEK_STEPS = 60 * 24;

export interface PlayerOptions {
  mode: StageMode;
  reducedMotion: boolean;
  lowPower: boolean;
  autoplay: boolean;
  /** initial effect time (default: posterTime when paused, 0 when autoplaying) */
  startTime?: number;
  /** called when play state / readiness changes (NOT every frame) */
  onState?: (s: PlayerState) => void;
}

export interface PlayerState {
  ready: boolean;
  playing: boolean;
  ended: boolean;
  error: string | null;
  notice: string | null;
  canCapture: boolean;
  usingLite: boolean;
}

export class Player {
  readonly stage: HTMLElement;
  def: EffectDef;
  settings: EffectSettings;
  opts: PlayerOptions;
  t = 0;
  private simT = 0;
  private acc = 0;
  private runtime: EffectRuntime | null = null;
  private token = 0;
  private wantPlay: boolean;
  private ro: ResizeObserver | null = null;
  private resizeTimer = 0;
  private size = { w: 0, h: 0 };
  private offPointer: (() => void) | null = null;
  private disposed = false;
  private renderFailed = false;
  readonly pointer: PointerState = { x: 0, y: 0, inside: false, down: false, lastMove: 0 };
  state: PlayerState = { ready: false, playing: false, ended: false, error: null, notice: null, canCapture: false, usingLite: false };

  constructor(stage: HTMLElement, def: EffectDef, settings: EffectSettings, opts: PlayerOptions) {
    this.stage = stage;
    this.def = def;
    this.settings = settings;
    this.opts = opts;
    this.wantPlay = opts.autoplay && !opts.reducedMotion;
    liveCount++;
    ensureTicker();
    stage.classList.add('kt-stage');
    stage.style.background = settings.background;
    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(stage);
    this.size = { w: stage.clientWidth, h: stage.clientHeight };
    if (def.interactive && opts.mode === 'detail') this.bindPointer();
    this.t = def.posterTime ?? 1.2;
    if (this.wantPlay) this.t = 0;
    if (opts.startTime !== undefined) this.t = opts.startTime;
    void this.build();
  }

  // ---- public controls ----------------------------------------------------

  play() {
    if (this.disposed) return;
    if (this.state.ended || (!this.settings.loop && this.runtime?.settle != null && this.t >= this.runtime.settle)) {
      this.seek(0);
    }
    this.wantPlay = true;
    this.setPlaying(true);
  }

  pause() {
    this.wantPlay = false;
    this.setPlaying(false);
  }

  toggle() {
    if (this.state.playing) this.pause();
    else this.play();
  }

  restart() {
    this.seek(0);
    this.play();
  }

  /** Jump to effect-time t (seconds). Deterministic. */
  seek(t: number) {
    this.t = Math.max(0, t);
    this.state.ended = false;
    const rt = this.runtime;
    if (!rt) return;
    if (rt.step) {
      rt.reset?.();
      const start = Math.max(0, this.t - MAX_SEEK_STEPS * FIXED_DT);
      this.simT = 0;
      this.acc = 0;
      let n = Math.floor((this.t - start) / FIXED_DT);
      // warm-start from `start` (only for very long seeks)
      this.simT = start;
      while (n-- > 0) {
        this.simT += FIXED_DT;
        this.safe(() => rt.step!(this.simT, FIXED_DT));
      }
    } else rt.reset?.();
    this.safe(() => rt.render(this.t, 0));
  }

  /** Apply new settings. Speed / loop are applied live; everything else rebuilds. */
  update(next: EffectSettings) {
    const prev = this.settings;
    this.settings = next;
    const liveOnly =
      prev.text === next.text &&
      prev.primary === next.primary &&
      prev.secondary === next.secondary &&
      prev.background === next.background &&
      prev.fontScale === next.fontScale &&
      prev.tracking === next.tracking &&
      prev.intensity === next.intensity &&
      prev.ratio === next.ratio &&
      JSON.stringify(prev.params) === JSON.stringify(next.params);
    if (liveOnly) {
      if (!next.loop && this.runtime?.settle != null && this.t > this.runtime.settle) this.seek(this.runtime.settle);
      return;
    }
    this.stage.style.background = next.background;
    void this.build();
  }

  setDef(def: EffectDef, settings: EffectSettings) {
    this.def = def;
    this.settings = settings;
    this.t = 0;
    this.offPointer?.();
    this.offPointer = null;
    if (def.interactive && this.opts.mode === 'detail') this.bindPointer();
    this.stage.style.background = settings.background;
    void this.build();
  }

  /** PNG of the current frame (canvas / WebGL renderers only). */
  capturePNG(): string | null {
    const rt = this.runtime;
    if (!rt?.canvas) return null;
    try {
      rt.beforeCapture?.();
      return rt.canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  get captureCanvas(): HTMLCanvasElement | null {
    return this.runtime?.canvas ?? null;
  }

  dispose() {
    if (this.disposed) return;
    liveCount--;
    this.disposed = true;
    this.token++;
    active.delete(this);
    this.ro?.disconnect();
    this.ro = null;
    clearTimeout(this.resizeTimer);
    this.offPointer?.();
    this.teardown();
    this.stage.classList.remove('kt-stage');
  }

  // ---- ticking --------------------------------------------------------------

  tick(dt: number) {
    const rt = this.runtime;
    if (!rt || !this.state.playing) return;
    const sdt = dt * this.settings.speed;
    let t = this.t + sdt;
    let ended = false;
    if (!this.settings.loop && this.def.loopable && rt.settle != null && t >= rt.settle) {
      t = rt.settle;
      ended = true;
    }
    if (rt.step) {
      this.acc += t - this.t;
      let n = 0;
      while (this.acc >= FIXED_DT && n++ < 8) {
        this.simT += FIXED_DT;
        this.acc -= FIXED_DT;
        this.safe(() => rt.step!(this.simT, FIXED_DT));
      }
      if (n >= 8) this.acc = 0;
    }
    this.t = t;
    this.safe(() => rt.render(t, sdt));
    if (ended) {
      this.state.ended = true;
      this.wantPlay = false;
      this.setPlaying(false);
    }
  }

  // ---- internals ------------------------------------------------------------

  private safe(fn: () => void) {
    if (this.renderFailed) return;
    try {
      fn();
    } catch (err) {
      this.renderFailed = true;
      console.error(`[effect ${this.def.id}] render failed`, err);
      this.emit({ error: '此效果執行時發生錯誤，請重新整理或恢復預設設定。' });
      this.setPlaying(false);
    }
  }

  private setPlaying(on: boolean) {
    const playing = on && !!this.runtime && !this.renderFailed;
    if (playing) active.add(this);
    else active.delete(this);
    if (playing !== this.state.playing) this.emit({ playing });
  }

  private emit(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    this.opts.onState?.(this.state);
  }

  private onResize() {
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    if (Math.abs(w - this.size.w) < 2 && Math.abs(h - this.size.h) < 2) return;
    this.size = { w, h };
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => void this.build(), this.runtime ? 140 : 0);
  }

  private bindPointer() {
    const st = this.stage;
    const p = this.pointer;
    const move = (e: PointerEvent) => {
      const r = st.getBoundingClientRect();
      p.x = e.clientX - r.left;
      p.y = e.clientY - r.top;
      p.inside = p.x >= 0 && p.y >= 0 && p.x <= r.width && p.y <= r.height;
      p.lastMove = performance.now();
    };
    const down = (e: PointerEvent) => {
      move(e);
      p.down = true;
    };
    const up = () => {
      p.down = false;
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') p.inside = false;
      p.down = false;
    };
    st.addEventListener('pointermove', move);
    st.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    st.addEventListener('pointerleave', leave);
    st.addEventListener('pointercancel', leave);
    st.style.touchAction = 'none';
    this.offPointer = () => {
      st.removeEventListener('pointermove', move);
      st.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      st.removeEventListener('pointerleave', leave);
      st.removeEventListener('pointercancel', leave);
      st.style.touchAction = '';
      p.inside = false;
    };
  }

  private teardown() {
    const rt = this.runtime;
    this.runtime = null;
    if (rt) {
      try {
        rt.dispose?.();
      } catch (err) {
        console.error(`[effect ${this.def.id}] dispose failed`, err);
      }
    }
    this.stage.querySelectorAll(':scope > .kt-layer, :scope > .kt-ui').forEach((n) => n.remove());
  }

  private async build() {
    const token = ++this.token;
    const def = this.def;
    const s = this.settings;
    const max = def.maxChars ?? 40;
    let text = sanitizeText(s.text, max);
    if (!text.trim()) text = def.defaultText;
    await ensureFonts(text);
    if (!fontsSettled) clearMeasureCache();
    if (token !== this.token || this.disposed) return;

    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    if (w < 4 || h < 4) return; // resize observer will rebuild once laid out
    this.size = { w, h };

    this.teardown();
    this.renderFailed = false;
    const root = document.createElement('div');
    root.className = 'kt-layer';
    root.setAttribute('aria-hidden', 'true');
    const ui = document.createElement('div');
    ui.className = 'kt-ui';
    this.stage.append(root, ui);

    const mode = this.opts.mode;
    const dprRaw = window.devicePixelRatio || 1;
    const dpr = Math.min(dprRaw, mode === 'card' ? 1.5 : 2);
    const seed = hashString(def.id);
    const glOK = webglSupported();
    const useLite = !!def.lite && (mode === 'card' || !glOK);
    const ctx: EffectContext = {
      root,
      ui,
      width: w,
      height: h,
      dpr,
      s: { ...s, text },
      text,
      mode,
      reducedMotion: this.opts.reducedMotion,
      lowPower: this.opts.lowPower,
      q: (mode === 'card' ? 0.55 : 1) * (this.opts.lowPower ? 0.6 : 1),
      seed,
      rand: mulberry32(seed),
      font: FONT,
      pointer: this.pointer,
      webgl: mode === 'detail' && glOK,
    };

    let rt: EffectRuntime;
    try {
      const factory = useLite ? def.lite! : def.create;
      rt = await factory(ctx);
    } catch (err) {
      console.error(`[effect ${def.id}] create failed`, err);
      if (token === this.token) this.emit({ ready: true, error: '此效果無法在目前環境初始化。' });
      return;
    }
    if (token !== this.token || this.disposed) {
      rt.dispose?.();
      root.remove();
      ui.remove();
      return;
    }
    this.runtime = rt;
    let notice = rt.notice ?? null;
    if (def.lite && mode === 'detail' && !glOK) notice = '此瀏覽器未啟用 WebGL，目前顯示 2D 替代版本。';
    if (!s.loop && def.loopable && rt.settle != null && this.t > rt.settle) this.t = rt.settle;
    this.seek(this.t);
    this.emit({ ready: true, error: this.renderFailed ? this.state.error : null, notice, canCapture: !!rt.canvas, usingLite: useLite });
    this.setPlaying(this.wantPlay);
  }
}
