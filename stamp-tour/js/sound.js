/* 音效：全部用 Web Audio 現場合成（沒有音檔、沒有套件，聲音都是原創的）
   瀏覽器規定要使用者碰過畫面才能出聲：第一次碰觸時才啟動。
   sfx(名稱, 選項) 播一次；roll() 回傳停止函式（拉炮時的鼓聲）。 */
import { CONFIG } from './config.js';

const PREF = 'stamp-tour:sound';
let ctx = null, master = null, noiseBuf = null;
let on = (() => { try { return localStorage.getItem(PREF) === 'on'; } catch (_) { return false; } })();   // 預設靜音：入口讓使用者自己選

export const soundOn = () => on;
export const soundState = () => (ctx ? ctx.state : 'none');   // 開發檢查用
export function setSound(v) {
  on = v;
  try { localStorage.setItem(PREF, v ? 'on' : 'off'); } catch (_) {}
  if (master) master.gain.setTargetAtTime(v ? CONFIG.SOUND.VOLUME : 0, ctx.currentTime, .05);
}
export function initSound() {
  const unlock = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (_) {}   // iPhone：跟著靜音鍵
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = on ? CONFIG.SOUND.VOLUME : 0;
      master.connect(comp); comp.connect(ctx.destination);
      const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state !== 'running') {
      ctx.resume();
      try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start(); } catch (_) {}   // iPhone：在手勢裡播一下無聲，才算真的解鎖
    }
  };
  // 手機上「手指按下」不算數，要等「放開」或「點擊」才能出聲：全部都聽
  for (const t of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(t, unlock, { capture: true, passive: true });
}

/* ---------------- 合成的基本零件 ---------------- */
function env(g, t, a, peak, dec, sustain = 0) {   // 起音 a、衰減 dec（秒）
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(1e-4, sustain || 1e-4), t + a + dec);
}
function tone({ f, f2, type = 'sine', at = 0, a = .004, dec = .2, peak = .3, dest = master }) {
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dec);
  env(g, t, a, peak, dec); o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + a + dec + .05);
}
function noise({ at = 0, a = .003, dec = .1, peak = .2, type = 'lowpass', f = 1000, f2, q = .8, dest = master }) {
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + dec);
  env(g, t, a, peak, dec); s.connect(fl); fl.connect(g); g.connect(dest);
  s.start(t, Math.random()); s.stop(t + a + dec + .05);
}
/* 鐵琴般的音：基音＋高八度＋一點泛音 */
function bell(f, at = 0, dec = 1.2, peak = .18) {
  tone({ f, at, dec, peak }); tone({ f: f * 2, at, dec: dec * .5, peak: peak * .35 }); tone({ f: f * 3.01, at, dec: dec * .25, peak: peak * .12 });
}
function marimba(f, at = 0, peak = .22) {
  tone({ f, at, dec: .45, peak }); tone({ f: f * 4, at, dec: .08, peak: peak * .25 });
}
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);   // MIDI 音高 → Hz

/* ---------------- 音效表 ---------------- */
const SFX = {
  // 對話框跳出一句：小小的「啵」
  blip() { tone({ f: 760 + Math.random() * 120, f2: 520, type: 'triangle', dec: .07, peak: .09 }); },
  // 會場：布條降下、開場小樂句
  whoosh({ dur = .45 } = {}) { noise({ type: 'bandpass', f: 380, f2: 1600, q: 1.2, a: dur * .45, dec: dur * .55, peak: .16 }); },
  jingle() { [72, 76, 79, 84, 79].forEach((n, i) => marimba(NOTE(n), i * .11, i === 3 ? .24 : .18)); },
  // 卡片：滑出來、收下、換卡
  slide() { noise({ type: 'lowpass', f: 1400, f2: 500, a: .08, dec: .28, peak: .14 }); },
  take() { tone({ f: 420, f2: 1100, type: 'sine', dec: .09, peak: .2 }); noise({ type: 'highpass', f: 2500, dec: .05, peak: .05 }); },
  // 筆：一小段沙沙聲（寫字時節流播放）
  pen() { noise({ type: 'bandpass', f: 3200 + Math.random() * 900, q: 2, a: .005, dec: .04, peak: .035 }); },
  // 手章（日期章、完成章、郵戳）：「咚」＋橡膠的「啪」；metal = 郵戳的金屬感
  thunk({ metal = false } = {}) {
    tone({ f: 150, f2: 60, dec: .18, peak: .55 });
    noise({ type: 'lowpass', f: 900, dec: .07, peak: .3 });
    if (metal) { tone({ f: 1320, type: 'triangle', dec: .12, peak: .05 }); tone({ f: 1960, dec: .08, peak: .03 }); }
  },
  // 蓋章：點印台（點越多次越「濕」）、壓下去、拿起來
  pad({ n = 1 } = {}) {
    tone({ f: 120 + n * 6, f2: 70, dec: .09, peak: .32 });
    noise({ type: 'lowpass', f: 500 + n * 90, dec: .05, peak: .14 });
  },
  press() {
    tone({ f: 130, f2: 52, dec: .22, peak: .7 });
    noise({ type: 'lowpass', f: 700, dec: .1, peak: .35 });
    tone({ f: 1800, type: 'square', dec: .012, peak: .03 });
  },
  lift() { noise({ type: 'bandpass', f: 2400, f2: 700, q: 1.6, a: .04, dec: .4, peak: .12 }); },
  sparkle() { [84, 88, 91, 96].forEach((n, i) => bell(NOTE(n), i * .07, .5, .07)); },
  // 到站：站牌落下、翻牌、到站鈴（三個音的原創小旋律）
  drop() { SFX.whoosh({ dur: .5 }); tone({ f: 90, f2: 60, at: .42, dec: .12, peak: .25 }); },
  clack() {
    tone({ f: 980, type: 'triangle', dec: .03, peak: .12 }); noise({ type: 'highpass', f: 1800, dec: .02, peak: .08 });
    tone({ f: 760, type: 'triangle', at: .07, dec: .04, peak: .1 }); noise({ type: 'highpass', f: 1500, at: .07, dec: .02, peak: .06 });
  },
  chime() { [79, 76, 84].forEach((n, i) => bell(NOTE(n), i * .26, 1.4, .16)); },
  // 慶祝：熄燈、跑步、鼓聲、拉炮、鑼、號角般的小樂句
  dim() { tone({ f: 220, f2: 70, a: .3, dec: 1.1, peak: .12 }); noise({ type: 'lowpass', f: 600, f2: 120, a: .3, dec: 1, peak: .06 }); },
  steps() { for (let i = 0; i < 7; i++) { tone({ f: 260 + (i % 2) * 40, f2: 120, at: i * .12, dec: .05, peak: .12 }); noise({ type: 'lowpass', f: 900, at: i * .12, dec: .03, peak: .05 }); } },
  bang() {
    noise({ type: 'highpass', f: 900, dec: .18, peak: .55 });
    tone({ f: 160, f2: 45, dec: .25, peak: .6 });
    for (let i = 0; i < 26; i++) noise({ type: 'bandpass', f: 2500 + Math.random() * 4000, q: 3, at: .1 + Math.random() * .9, dec: .02, peak: .03 + Math.random() * .03 });   // 紙花沙沙
  },
  gong() {                                     // 鑼：不和諧的泛音，長長的尾音
    [[196, .2], [287, .12], [403, .1], [523, .07], [671, .05]].forEach(([f, p]) => tone({ f, f2: f * .985, a: .01, dec: 2.6, peak: p }));
    tone({ f: 70, f2: 50, dec: .5, peak: .5 });   // 大鼓
  },
  fanfare() {
    [[72, 0], [76, .12], [79, .24], [84, .36]].forEach(([n, at]) => marimba(NOTE(n), at, .2));
    [72, 76, 79, 84].forEach(n => bell(NOTE(n), .5, 1.6, .07));
  },
  // 明信片：翻面、郵筒「哐」、小旗子、寄到的門鈴
  flip() { noise({ type: 'bandpass', f: 900, f2: 2600, q: 1, a: .12, dec: .3, peak: .1 }); },
  mailbox() {
    tone({ f: 190, f2: 120, dec: .35, peak: .4 }); tone({ f: 287, dec: .3, peak: .12 }); tone({ f: 431, dec: .25, peak: .07 });
    noise({ type: 'lowpass', f: 1200, dec: .12, peak: .2 });
    bell(NOTE(91), .32, .6, .08);               // 小旗子彈起來：叮
  },
  doorbell() { bell(NOTE(76), 0, 1.1, .17); bell(NOTE(72), .42, 1.6, .17); },
};

export function sfx(name, opts) {
  if (!ctx || !on || ctx.state !== 'running' || !SFX[name]) return;
  try { SFX[name](opts); } catch (e) { console.warn('sfx', name, e); }
}

/* 拉炮時的鼓聲：越拉越快；回傳停止函式 */
export function roll() {
  if (!ctx || !on) return () => {};
  let alive = true, gap = .16;
  const hit = () => {
    if (!alive) return;
    tone({ f: 110 + Math.random() * 10, f2: 60, dec: .09, peak: .28 });
    noise({ type: 'lowpass', f: 700, dec: .04, peak: .08 });
    gap = Math.max(.055, gap * .9);
    setTimeout(hit, gap * 1000);
  };
  hit();
  return () => { alive = false; };
}

/* 寫字的沙沙聲：移動時呼叫，最多每 70ms 響一次 */
let lastPen = 0;
export function penScratch() { const n = performance.now(); if (n - lastPen > 70) { lastPen = n; sfx('pen'); } }
