/*
 * Sounds for 十方迴向, all synthesised: a temple bell, a wooden fish, small chimes,
 * a soft harmonic pad and a closing tone. Nothing is recorded or borrowed.
 * One master bus with a limiter keeps the whole thing at one even loudness however
 * many layers the larger rites add. Nothing plays until the visitor presses 開始.
 */

const MUTE_KEY = 'paper-turtle:mute';

export class RiteAudio {
  constructor() {
    this.ctx = null;
    this.lastKnock = 0;
    this.padVoices = [];
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  /** Call from a user gesture. */
  start(level) {
    this.level = level;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -14;
      this.limiter.knee.value = 10;
      this.limiter.ratio.value = 8;
      this.limiter.release.value = 0.4;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.limiter.connect(this.master).connect(ctx.destination);
      this.dry = ctx.createGain();
      this.dry.connect(this.limiter);
      this.verb = ctx.createConvolver();
      this.verb.buffer = this.impulse(3.2);
      this.wet = ctx.createGain();
      this.verb.connect(this.wet).connect(this.limiter);
    }
    this.ctx.resume?.();
    // larger rites sit in a larger room
    this.wet.gain.value = 0.18 + 0.07 * Math.min(level, 5) + (level >= 4 ? 0.08 : 0);
  }

  impulse(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  setMuted(m) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* fine */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  out(send = 0.5) {
    const g = this.ctx.createGain();
    g.connect(this.dry);
    const s = this.ctx.createGain();
    s.gain.value = send;
    g.connect(s).connect(this.verb);
    return g;
  }

  partial(freq, amp, decay, at, dest, type = 'sine') {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(amp, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + decay + 0.05);
  }

  /** A clear, soft temple bell. */
  bell(strength = 1, pitch = 1, delay = 0) {
    if (!this.ctx) return;
    const at = this.ctx.currentTime + delay;
    const out = this.out(0.7);
    const base = 262 * pitch;
    [[1, 0.34, 7], [2.01, 0.16, 5], [2.76, 0.12, 4], [4.07, 0.07, 2.6], [5.43, 0.04, 1.6], [0.5, 0.08, 6]].forEach(([r, a, d]) =>
      this.partial(base * r, a * strength * 0.5, d, at, out)
    );
  }

  /** The wooden fish: a hollow knock, its pitch falling a hair. */
  knock() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (now - this.lastKnock < 0.07) return; // never stack into a buzz
    this.lastKnock = now;
    const out = this.out(0.35);
    const body = ctx.createOscillator();
    const g = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(560, now);
    body.frequency.exponentialRampToValueAtTime(410, now + 0.05);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.5, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    body.connect(g).connect(out);
    body.start(now);
    body.stop(now + 0.25);
    this.partial(1130, 0.08, 0.08, now, out, 'triangle');
    // the strike: a short band of noise
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = ctx.createBufferSource();
    n.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 2.5;
    const ng = ctx.createGain();
    ng.gain.value = 0.22;
    n.connect(bp).connect(ng).connect(out);
    n.start(now);
  }

  /** Small bright chimes, used from two rounds up. */
  chime(i = 0, delay = 0) {
    if (!this.ctx) return;
    const notes = [1568, 1760, 2093, 2349, 2637, 3136];
    const at = this.ctx.currentTime + delay;
    const out = this.out(0.8);
    const f = notes[i % notes.length];
    [[1, 0.05, 2.2], [2.42, 0.02, 1.2], [3.9, 0.01, 0.7]].forEach(([r, a, d]) => this.partial(f * r, a, d, at, out));
  }

  /** A held, warm chord: a faint drone for one round, fuller from three rounds up. */
  pad(level) {
    if (!this.ctx) return;
    this.stopPad(0.1);
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const notes = level >= 5 ? [110, 164.8, 220, 277.2, 329.6, 440] : level >= 3 ? [110, 164.8, 220, 277.2] : [110, 164.8];
    const total = level >= 3 ? 0.11 : 0.035; // one even loudness however many voices
    const out = this.out(level >= 4 ? 0.9 : 0.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = level >= 4 ? 1400 : 900;
    lp.connect(out);
    this.padVoices = notes.flatMap((f, i) =>
      [0, 1].map((k) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = k ? 'triangle' : 'sine';
        o.frequency.value = f * (k ? 1.003 : 1);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(total / notes.length / (k ? 2 : 1), now + 3 + i * 0.4);
        o.connect(g).connect(lp);
        o.start(now);
        return { o, g };
      })
    );
  }

  stopPad(fade = 4) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const { o, g } of this.padVoices) {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + fade);
      o.stop(now + fade + 0.1);
    }
    this.padVoices = [];
  }

  /** The close: a gentle rising figure for big rites, always ending on one quiet bell. */
  close(level) {
    if (!this.ctx) return;
    if (level >= 2) [1, 1.25, 1.5].slice(0, Math.min(3, level - 1)).forEach((p, i) => this.bell(0.45, p, i * 0.35));
    this.bell(0.6, 1, level >= 2 ? 1.6 : 0);
  }

  stop() {
    this.stopPad(0.6);
  }
}
