import { gsap } from 'gsap';
import { ensureFonts, FONT, usableWeight } from './fonts';
import { hashString, mulberry32 } from './random';
import { clearMeasureCache, sanitizeText } from './text';
import { DEFAULT_MAX_CHARS } from './settings';
import type { CaptureFlags, EffectContext, EffectDef, EffectRuntime, EffectSettings, PointerState, StageMode } from './types';

// ---------------------------------------------------------------------------
// One global clock for every live stage. Effects never run their own rAF / GSAP
// ticker: the Player calls runtime.render(t) so pause, speed, seek and replay
// behave identically for DOM, SVG, CSS 3D and Canvas effects.
// ---------------------------------------------------------------------------

const active = new Set<Player>();
let liveCount = 0;
/** debug: number of undisposed players and of currently ticking players */
export const playerStats = () => ({ live: liveCount, playing: active.size });
let tickerOn = false;
function onTick(_time: number, deltaMs: number) {
  // background tab: skip work entirely (GSAP also throttles, this makes it explicit)
  if (typeof document !== 'undefined' && document.hidden) return;
  // clamp dt so a resumed tab / long frame never jumps far ahead
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

export const FIXED_DT = 1 / 60;
const MAX_SEEK_STEPS = 60 * 30;

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
  /** number of times the runtime was (re)built — used by tests */
  builds: number;
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
  private ctx: EffectContext | null = null;
  private token = 0;
  private wantPlay: boolean;
  private ro: ResizeObserver | null = null;
  private resizeTimer = 0;
  private size = { w: 0, h: 0 };
  private offPointer: (() => void) | null = null;
  private disposed = false;
  private renderFailed = false;
  readonly capture: CaptureFlags = { transparent: false };
  readonly pointer: PointerState = { x: 0, y: 0, inside: false, down: false, lastMove: 0, lastDown: 0 };
  state: PlayerState = { ready: false, playing: false, ended: false, error: null, notice: null, builds: 0 };

  constructor(stage: HTMLElement, def: EffectDef, settings: EffectSettings, opts: PlayerOptions) {
    this.stage = stage;
    this.def = def;
    this.settings = settings;
    this.opts = opts;
    this.wantPlay = opts.autoplay && !opts.reducedMotion;
    liveCount++;
    ensureTicker();
    stage.classList.add('ma-stage');
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
    if (this.state.ended || this.atSettle()) this.seek(0);
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

  get playing() {
    return this.state.playing;
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
      this.simT = start;
      this.acc = 0;
      let n = Math.floor((this.t - start) / FIXED_DT);
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
    const { speed: _a, loop: _b, ...pa } = prev;
    const { speed: _c, loop: _d, ...na } = next;
    if (JSON.stringify(pa) === JSON.stringify(na)) {
      if (!next.loop && this.def.loopable && this.runtime?.settle != null && this.t > this.runtime.settle) this.seek(this.runtime.settle);
      return;
    }
    this.stage.style.background = next.background;
    void this.build();
  }

  /** Render the current frame again (used around PNG capture). */
  redraw() {
    const rt = this.runtime;
    if (rt) this.safe(() => rt.render(this.t, 0));
  }

  get currentRuntime(): EffectRuntime | null {
    return this.runtime;
  }
  get effectRoot(): HTMLElement | null {
    return this.ctx?.root ?? null;
  }

  /** Render one frame with the background omitted (canvas renderers that opt in). */
  withTransparent<T>(fn: () => T): T {
    this.capture.transparent = true;
    try {
      this.redraw();
      return fn();
    } finally {
      this.capture.transparent = false;
      this.redraw();
    }
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
    this.stage.classList.remove('ma-stage');
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

  private atSettle() {
    const rt = this.runtime;
    return !this.settings.loop && !!this.def.loopable && rt?.settle != null && this.t >= rt.settle;
  }

  private safe(fn: () => void) {
    if (this.renderFailed) return;
    try {
      fn();
    } catch (err) {
      this.renderFailed = true;
      console.error(`[effect ${this.def.id}] render failed`, err);
      this.emit({ error: '此效果執行時發生錯誤，請恢復預設設定或重新整理。' });
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
      p.lastDown = performance.now();
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
    this.offPointer = () => {
      st.removeEventListener('pointermove', move);
      st.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      st.removeEventListener('pointerleave', leave);
      st.removeEventListener('pointercancel', leave);
      p.inside = false;
    };
  }

  private teardown() {
    const rt = this.runtime;
    this.runtime = null;
    this.ctx = null;
    if (rt) {
      try {
        rt.dispose?.();
      } catch (err) {
        console.error(`[effect ${this.def.id}] dispose failed`, err);
      }
    }
    this.stage.querySelectorAll(':scope > .ma-layer, :scope > .ma-ui').forEach((n) => n.remove());
  }

  private async build() {
    const token = ++this.token;
    const def = this.def;
    const s = this.settings;
    const max = def.maxChars ?? DEFAULT_MAX_CHARS;
    let text = sanitizeText(s.text, max);
    if (!text.trim()) text = def.defaultText;
    await ensureFonts(text, s.font);
    if (!fontsSettled) clearMeasureCache();
    if (token !== this.token || this.disposed) return;

    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    if (w < 4 || h < 4) return; // resize observer will rebuild once laid out
    this.size = { w, h };

    this.teardown();
    this.renderFailed = false;
    const root = document.createElement('div');
    root.className = 'ma-layer';
    root.setAttribute('aria-hidden', 'true');
    const ui = document.createElement('div');
    ui.className = 'ma-ui';
    this.stage.append(root, ui);

    const mode = this.opts.mode;
    const dpr = Math.min(window.devicePixelRatio || 1, mode === 'card' ? 1.5 : 2);
    const seed = (hashString(def.id) ^ Math.imul(s.seed, 2654435761)) >>> 0;
    const dirSign: 1 | -1 = s.direction === 'left' || s.direction === 'up' || s.direction === 'ccw' ? -1 : 1;
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
      family: FONT[s.font] ?? FONT.sans,
      weight: usableWeight(s.font, s.weight),
      dir: s.direction,
      dirSign,
      pointer: this.pointer,
      capture: this.capture,
    };

    let rt: EffectRuntime;
    try {
      rt = await def.create(ctx);
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
    this.ctx = ctx;
    if (!s.loop && def.loopable && rt.settle != null && this.t > rt.settle) this.t = rt.settle;
    this.seek(this.t);
    this.emit({ ready: true, error: this.renderFailed ? this.state.error : null, notice: rt.notice ?? null, builds: this.state.builds + 1 });
    this.setPlaying(this.wantPlay);
  }
}
