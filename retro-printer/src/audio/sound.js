// 音效：全部用 Web Audio 即時合成，不用音檔。
// 只有「動手」的動作有聲音；介面按鈕、換頁保持安靜。
// 瀏覽器要等使用者第一次操作後才能出聲，所以第一次點擊或按鍵時才建立聲音環境。
import { CONFIG as C } from '../config.js';

/* ───────── 手感參數 ───────── */
const T = {
  master: 0.55,          // 總音量
  // 刮印
  scrapeGain: 0.22,      // 正常速度的音量
  scrapeLow: 480,        // 慢速時的摩擦音高 Hz
  scrapeHigh: 2600,      // 快速時的摩擦音高 Hz
  scrapeVmax: 2.2,       // 速度達此值時音高、音量最大 px/ms（乾裂聲跟著 config 的飛白速度區間）
  fastGain: 0.1,         // 乾裂聲音量
  dwellGain: 0.07,       // 刮板停住時的壓擠聲音量
  // 其他
  dropGain: 0.32,        // 放下網框
  pourGain: 0.16,        // 倒墨
  peelGain: 0.2,         // 掀框
  dryerGain: 0.09,       // 吹風機
  stirGain: 0.14,        // 調墨台攪拌
  exposeGain: 0.05,      // 曝光燈管
  washGain: 0.12         // 沖水
};

const STORE = 'retro-printer.sound';
let enabled = true;
try { enabled = localStorage.getItem(STORE) !== '0'; } catch {}
const listeners = new Set();

let ctx = null, master = null, noiseBuf = null;
const voices = {};

function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? T.master : 0;
    master.connect(ctx.destination);
    noiseBuf = makeNoise(2);
  }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
}

const ready = () => ctx && enabled && ctx.state === 'running';
const now = () => ctx.currentTime;

function makeNoise(sec) {
  const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function noise(loop = true) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf; s.loop = loop;
  s.loopStart = Math.random(); s.loopEnd = s.loopStart + 0.9;
  return s;
}
function filter(type, freq, Q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = Q;
  return f;
}
function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
const glide = (param, v, tc = 0.03) => param.setTargetAtTime(v, now(), tc);

/* ───────── 開關 ───────── */
export function soundEnabled() { return enabled; }
export function setSoundEnabled(on) {
  enabled = !!on;
  try { localStorage.setItem(STORE, enabled ? '1' : '0'); } catch {}
  if (master) glide(master.gain, enabled ? T.master : 0, 0.05);
  listeners.forEach(fn => fn(enabled));
}
export function onSoundChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* ───────── 連續的聲音（音量由呼叫端每一格更新） ───────── */
function voice(name, build) {
  if (!voices[name]) voices[name] = build();
  return voices[name];
}

// 刮印：pressing 刮板是否壓著；v 目前速度 px/ms
export function scrape(pressing, v) {
  if (!ctx) return;
  const s = voice('scrape', () => {
    const src = noise(), bp = filter('bandpass', T.scrapeLow, 1.1), g = gain();
    chain(src, bp, g, master);
    const fsrc = noise(), hp = filter('highpass', 3800, 0.7), fg = gain();
    chain(fsrc, hp, fg, master);
    const dsrc = noise(), lp = filter('lowpass', 260, 2), dg = gain();
    chain(dsrc, lp, dg, master);
    src.start(); fsrc.start(); dsrc.start();
    return { bp, g, fg, dg };
  });
  const k = Math.min(1, Math.max(0, v / T.scrapeVmax));
  const moving = pressing && v > 0.02;
  glide(s.bp.frequency, T.scrapeLow + (T.scrapeHigh - T.scrapeLow) * k);
  glide(s.g.gain, moving ? T.scrapeGain * (0.35 + 0.65 * Math.pow(k, 0.6)) : 0);
  const f = pressing ? Math.min(1, Math.max(0, (v - C.speedFastStart) / (C.speedFastFull - C.speedFastStart))) : 0;
  glide(s.fg.gain, f * T.fastGain * (0.4 + Math.random() * 0.9), 0.012);
  glide(s.dg.gain, pressing && v < 0.08 ? T.dwellGain : 0, 0.06);
}

// 吹風機：level 0..1（淡入淡出由呼叫端控制），pan -1..1 跟著圖示左右擺動
export function dryer(level, pan = 0) {
  if (!ctx) return;
  const d = voice('dryer', () => {
    const src = noise(), lp = filter('lowpass', 1100, 0.6), g = gain();
    const hum = ctx.createOscillator(), hg = gain(0.25);
    hum.type = 'sine'; hum.frequency.value = 118;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    chain(src, lp, g);
    chain(hum, hg, g);
    if (p) chain(g, p, master); else g.connect(master);
    src.start(); hum.start();
    return { g, p };
  });
  glide(d.g.gain, T.dryerGain * level, 0.05);
  if (d.p) glide(d.p.pan, pan * 0.6, 0.05);
}

// 調墨台攪拌：每次移動時呼叫；speed 為每秒移動的距離（調墨台寬度 = 1）
export function stir(speed) {
  if (!ready()) return;
  const s = voice('stir', () => {
    const src = noise(), bp = filter('bandpass', 500, 3), g = gain();
    chain(src, bp, g, master);
    src.start();
    return { bp, g };
  });
  const k = Math.min(1, speed / 3);
  const t = now();
  s.bp.frequency.setTargetAtTime(380 + 900 * k + Math.random() * 120, t, 0.02);
  s.g.gain.cancelScheduledValues(t);
  s.g.gain.setTargetAtTime(T.stirGain * (0.3 + 0.7 * k), t, 0.02);
  s.g.gain.setTargetAtTime(0, t + 0.08, 0.06);
}

/* ───────── 單次的聲音 ───────── */
function env(g, t, peak, attack, hold, release) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return t + attack + hold + release + 0.05;
}
function tone(t, f0, f1, dur, peak, type = 'sine') {
  const o = ctx.createOscillator(), g = gain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  chain(o, g, master);
  const end = env(g, t, peak, 0.004, 0, dur);
  o.start(t); o.stop(end);
}
function burst(t, type, freq, Q, dur, peak, attack = 0.003) {
  const src = noise(false), f = filter(type, freq, Q), g = gain();
  chain(src, f, g, master);
  const end = env(g, t, peak, attack, 0, dur);
  src.start(t); src.stop(end);
  return f;
}

// 放下網框：短而低沉的木頭聲
export function drop() {
  if (!ready()) return;
  const t = now();
  tone(t, 160, 62, 0.12, T.dropGain);
  burst(t, 'lowpass', 1600, 0.8, 0.035, T.dropGain * 0.45);
}

// 倒墨：黏稠的流動聲，最後一兩聲小小的啵
export function pour(dur = 0.6) {
  if (!ready()) return;
  const t = now(), src = noise(false), lp = filter('lowpass', 420, 5), g = gain();
  chain(src, lp, g, master);
  for (let i = 0; i <= 6; i++) lp.frequency.setValueAtTime(320 + Math.random() * 260, t + dur * i / 6);
  const end = env(g, t, T.pourGain, 0.05, Math.max(0, dur - 0.2), 0.18);
  src.start(t); src.stop(end);
  const bubble = at => tone(at, 260 + Math.random() * 80, 620 + Math.random() * 160, 0.05, T.pourGain * 0.9);
  bubble(t + dur * (0.35 + Math.random() * 0.2));
  if (Math.random() < 0.7) bubble(t + dur * 0.9);
}

// 掀框：網布離開紙面，由高往低滑，最後輕輕一聲
export function peel(dur = 0.4) {
  if (!ready()) return;
  const t = now(), f = burst(t, 'bandpass', 3200, 2.2, dur, T.peelGain, 0.03);
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(380, t + dur);
  tone(t + dur * 0.85, 120, 70, 0.06, T.peelGain * 0.6);
}

// 曝光：安靜、慢慢升起的燈管嗡聲
export function expose(dur) {
  if (!ready()) return;
  const t = now(), g = gain(), lp = filter('lowpass', 900, 0.7);
  chain(lp, g, master);
  for (const [f, type, v] of [[100, 'triangle', 1], [200, 'sine', 0.5], [300, 'sine', 0.2]]) {
    const o = ctx.createOscillator(), og = gain(v);
    o.type = type; o.frequency.value = f;
    chain(o, og, lp);
    o.start(t); o.stop(t + dur + 0.4);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(T.exposeGain, t + dur * 0.7);
  g.gain.setValueAtTime(T.exposeGain, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
}

// 沖水：水流沖刷，音量微微起伏
export function wash(dur) {
  if (!ready()) return;
  const t = now(), src = noise(false), bp = filter('bandpass', 1300, 0.7), g = gain();
  chain(src, bp, g, master);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(T.washGain, t + 0.15);
  for (let i = 1; i < 12; i++) {
    const at = t + 0.15 + (dur - 0.15) * i / 12;
    g.gain.linearRampToValueAtTime(T.washGain * (0.7 + Math.random() * 0.45), at);
    bp.frequency.setValueAtTime(1000 + Math.random() * 700, at);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
  src.start(t); src.stop(t + dur + 0.35);
}
