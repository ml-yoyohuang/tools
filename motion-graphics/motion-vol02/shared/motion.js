/* Motion Studies Vol. 02 — shared kit (extends the Vol. 01 player with a WebGL helper)
 * A deterministic timeline player plus the small math vocabulary every piece shares.
 * Each artwork supplies render(t) as a pure function of time; the player owns the clock.
 */
(function () {
  'use strict';
  const M = {};

  /* ---------- math ---------- */
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (x) => x * x * (3 - 2 * x);
  const TAU = Math.PI * 2;
  Object.assign(M, { clamp, lerp, seg, smooth, TAU });

  const E = {
    linear: (x) => x,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    inCubic: (x) => x * x * x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inQuart: (x) => x * x * x * x,
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    inOutQuart: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
    inQuint: (x) => x * x * x * x * x,
    outQuint: (x) => 1 - Math.pow(1 - x, 5),
    inOutQuint: (x) => (x < 0.5 ? 16 * Math.pow(x, 5) : 1 - Math.pow(-2 * x + 2, 5) / 2),
    inExpo: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutExpo: (x) =>
      x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
    inSine: (x) => 1 - Math.cos((x * Math.PI) / 2),
    outSine: (x) => Math.sin((x * Math.PI) / 2),
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
    inBack: (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x,
    inOutBack: (x, s = 1.70158 * 1.525) =>
      x < 0.5
        ? (Math.pow(2 * x, 2) * ((s + 1) * 2 * x - s)) / 2
        : (Math.pow(2 * x - 2, 2) * ((s + 1) * (x * 2 - 2) + s) + 2) / 2,
    /* damped spring, normalised so it lands exactly on 1 at x = 1 */
    spring: (x, zeta = 0.38, w = 13) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      const wd = w * Math.sqrt(1 - zeta * zeta);
      const v = 1 - Math.exp(-zeta * w * x) * (Math.cos(wd * x) + ((zeta * w) / wd) * Math.sin(wd * x));
      return v + (1 - v) * smooth(seg(x, 0.8, 1));
    },
  };
  M.ease = E;

  /* tween between a and b over [t0,t1] with easing */
  M.tw = (t, t0, t1, a, b, ease = E.inOutCubic) => lerp(a, b, ease(seg(t, t0, t1)));

  /* keyframe track: keys = [[time, value, easeIntoThisKey], ...] (value: number) */
  M.track = (keys) => (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const k = keys[i];
      if (t <= k[0]) {
        const p = keys[i - 1];
        const e = k[2] || E.inOutCubic;
        return lerp(p[1], k[1], e(seg(t, p[0], k[0])));
      }
    }
    return keys[keys.length - 1][1];
  };

  /* seeded PRNG */
  M.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* 3D gradient noise (Perlin style), deterministic, range roughly [-1,1] */
  M.noise3 = (() => {
    const r = M.rng(1337);
    const p = new Uint8Array(512);
    const perm = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const grad = (h, x, y, z) => {
      h &= 15;
      const u = h < 8 ? x : y;
      const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
      return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    };
    return (x, y, z) => {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      const u = fade(x), v = fade(y), w = fade(z);
      const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
      const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
      return lerp(
        lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
             lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
        lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
             lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
        w);
    };
  })();

  /* wait for named web fonts, but never block longer than `ms` */
  M.fonts = (specs, ms = 3500) => {
    if (!document.fonts) return Promise.resolve();
    const all = Promise.all(specs.map((s) => document.fonts.load(s[0], s[1] || 'A').catch(() => null)));
    return Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
  };

  /* a canvas that tracks its host element at a capped device pixel ratio */
  M.canvas = (host, opts = {}) => {
    const c = document.createElement('canvas');
    c.className = 'mp-canvas';
    c.setAttribute('aria-hidden', 'true');
    host.appendChild(c);
    const o = { canvas: c, ctx: opts.webgl ? null : c.getContext('2d', { alpha: !!opts.alpha }), w: 0, h: 0, dpr: 1 };
    o.resize = (w, h, dpr) => {
      o.w = w; o.h = h; o.dpr = Math.min(dpr, opts.dprCap || 2);
      c.width = Math.max(1, Math.round(w * o.dpr));
      c.height = Math.max(1, Math.round(h * o.dpr));
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      if (o.ctx) o.ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
    };
    return o;
  };

  /* ---------- WebGL: one full-screen fragment program ----------
   * Returns null (and logs the compile log) when WebGL or the shader is unavailable, so a page can show its fallback. */
  M.glProgram = (canvas, fs, opts = {}) => {
    const grab = /[?&]grab/.test(location.search);
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: grab });
    if (!gl) return null;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }');
    const f = sh(gl.FRAGMENT_SHADER, fs);
    if (!vs || !f) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return null; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const cache = {};
    const u = (n) => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(prog, n)));
    /* upload a canvas as a texture into a unit; reuses the texture object for that unit */
    const texs = {};
    const texture = (unit, source, name) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      if (!texs[unit]) texs[unit] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texs[unit]);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (name) gl.uniform1i(u(name), unit);
    };
    const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);
    const viewport = () => { gl.viewport(0, 0, canvas.width, canvas.height); };
    /* a lost context is reported, not hidden: the page shows its fallback text */
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (opts.onLost) opts.onLost(); });
    addEventListener('pagehide', () => { const ext = gl.getExtension('WEBGL_lose_context'); if (ext && opts.releaseOnHide) ext.loseContext(); });
    return { gl, prog, u, texture, draw, viewport };
  };

  /* ---------- player ---------- */
  const fmt = (s) => {
    s = Math.max(0, s);
    const whole = Math.floor(s);
    const cs = Math.floor((s - whole) * 100);
    return String(whole).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
  };

  M.player = (cfg) => {
    const D = cfg.duration;
    const stage = cfg.stage;
    const params = new URLSearchParams(location.search);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state = { t: 0, playing: false, loop: true, ready: false };

    /* --- UI --- */
    document.body.insertAdjacentHTML(
      'beforeend',
      `<header class="mp-head mp-ui">
         <a class="mp-back" href="${cfg.back || '../index.html'}">Motion Studies — Vol. 02</a>
         <div class="mp-title"><span class="mp-no">${cfg.number}</span><h1>${cfg.title}</h1><p>${cfg.subtitle}</p></div>
       </header>
       <aside class="mp-info" id="mp-info" hidden aria-label="About this work">
         <p class="mp-info-k">${cfg.number} — Concept</p>
         ${cfg.description.map((p) => `<p>${p}</p>`).join('')}
         <p class="mp-keys">Space play / pause · R restart · L loop · ← → step · F fullscreen · I info</p>
       </aside>
       <footer class="mp-bar mp-ui" role="toolbar" aria-label="Playback controls">
         <button type="button" data-act="play" aria-label="Play">Play</button>
         <button type="button" data-act="restart" aria-label="Restart from the beginning">Restart</button>
         <input class="mp-scrub" type="range" min="0" max="${D}" step="0.01" value="0" aria-label="Timeline position in seconds">
         <output class="mp-time" aria-hidden="true">00.00 / ${fmt(D)}</output>
         <button type="button" data-act="loop" aria-pressed="true" aria-label="Loop playback">Loop</button>
         <button type="button" data-act="info" aria-expanded="false" aria-controls="mp-info" aria-label="About this work">Info</button>
         <button type="button" data-act="fs" aria-label="Enter fullscreen">Full</button>
       </footer>
       <p class="mp-note" hidden></p>
       <div class="mp-sr" aria-live="polite"></div>`
    );
    const $ = (s) => document.querySelector(s);
    const bPlay = $('[data-act=play]'), bLoop = $('[data-act=loop]'), bInfo = $('[data-act=info]'), bFs = $('[data-act=fs]');
    const scrub = $('.mp-scrub'), time = $('.mp-time'), info = $('#mp-info'), note = $('.mp-note'), sr = $('.mp-sr');

    const announce = (s) => { sr.textContent = s; };
    const syncPlay = () => {
      const atEnd = !state.loop && state.t >= D;
      const label = state.playing ? 'Pause' : atEnd ? 'Replay' : 'Play';
      bPlay.textContent = label;
      bPlay.setAttribute('aria-label', label);
      document.body.classList.toggle('is-playing', state.playing);
    };
    let lastShown = -1;
    const syncTime = () => {
      const cs = Math.floor(state.t * 100);
      if (cs === lastShown) return;
      lastShown = cs;
      scrub.value = state.t;
      time.textContent = fmt(state.t) + ' / ' + fmt(D);
    };

    const draw = () => { if (state.ready) cfg.render(state.t); syncTime(); };

    /* --- clock --- */
    let raf = 0, last = 0;
    const frame = (ts) => {
      raf = 0;
      if (!state.playing) return;
      const dt = last ? Math.min((ts - last) / 1000, 0.1) : 0;
      last = ts;
      let t = state.t + dt;
      let ended = false;
      if (t >= D) {
        if (state.loop) t %= D;
        else { t = D; ended = true; }
      }
      state.t = t;
      if (ended) { state.playing = false; syncPlay(); announce('Ended'); }
      draw();
      if (state.playing) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && state.playing && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };

    const play = () => {
      if (!state.loop && state.t >= D) state.t = 0;
      state.playing = true; note.hidden = true; syncPlay(); kick(); announce('Playing');
    };
    const pause = () => { state.playing = false; syncPlay(); announce('Paused'); };
    const toggle = () => (state.playing ? pause() : play());
    const seek = (t) => { state.t = clamp(t, 0, D); draw(); syncPlay(); };
    const restart = () => { seek(0); if (!state.playing) play(); };
    const setLoop = (v) => {
      state.loop = v;
      bLoop.setAttribute('aria-pressed', String(v));
      bLoop.textContent = v ? 'Loop' : 'Once';
      announce(v ? 'Loop on' : 'Loop off');
      syncPlay();
    };
    const setInfo = (v) => {
      info.hidden = !v;
      bInfo.setAttribute('aria-expanded', String(v));
      document.body.classList.toggle('info-open', v);
    };
    const fullscreen = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    };
    document.addEventListener('fullscreenchange', () => {
      const on = !!document.fullscreenElement;
      bFs.textContent = on ? 'Exit' : 'Full';
      bFs.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
    });

    bPlay.addEventListener('click', toggle);
    $('[data-act=restart]').addEventListener('click', restart);
    bLoop.addEventListener('click', () => setLoop(!state.loop));
    bInfo.addEventListener('click', () => setInfo(info.hidden));
    bFs.addEventListener('click', fullscreen);

    let resumeAfterScrub = false, scrubbing = false;
    scrub.addEventListener('pointerdown', () => { scrubbing = true; resumeAfterScrub = state.playing; if (state.playing) pause(); });
    scrub.addEventListener('input', () => seek(parseFloat(scrub.value)));
    const endScrub = () => { if (scrubbing) { scrubbing = false; if (resumeAfterScrub) play(); } };
    scrub.addEventListener('pointerup', endScrub);
    scrub.addEventListener('change', endScrub);

    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target.tagName;
      const onControl = tag === 'BUTTON' || tag === 'INPUT' || tag === 'A';
      const k = e.key;
      wake();
      if (k === ' ' || k === 'k' || k === 'K') { if (onControl && k === ' ') return; e.preventDefault(); toggle(); }
      else if (k === 'r' || k === 'R') restart();
      else if (k === 'l' || k === 'L') setLoop(!state.loop);
      else if (k === 'f' || k === 'F') fullscreen();
      else if (k === 'i' || k === 'I') setInfo(info.hidden);
      else if (k === 'Escape') setInfo(false);
      else if ((k === 'ArrowLeft' || k === 'ArrowRight') && tag !== 'INPUT') {
        e.preventDefault();
        if (state.playing) pause();
        seek(state.t + (k === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 0.1 : 1));
      } else if (k === 'Home') { e.preventDefault(); seek(0); }
      else if (k === 'End') { e.preventDefault(); seek(D - 0.001); }
    });

    /* --- idle fade: UI disappears while the work plays undisturbed --- */
    let idleTimer = 0;
    const ui = document.querySelectorAll('.mp-ui');
    function wake() {
      document.body.classList.remove('is-idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        const focusInUi = [...ui].some((n) => n.contains(document.activeElement)) && document.activeElement !== document.body;
        if (state.playing && info.hidden && !focusInUi && !scrubbing) document.body.classList.add('is-idle');
        else wake();
      }, 2600);
    }
    ['pointermove', 'pointerdown', 'touchstart', 'focusin'].forEach((ev) => addEventListener(ev, wake, { passive: true }));

    /* --- visibility: no frames while nobody can see them --- */
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

    /* --- sizing --- */
    let rw = 0, rh = 0;
    const doResize = () => {
      const r = stage.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w === rw && h === rh) return;
      rw = w; rh = h;
      if (state.ready && cfg.resize) cfg.resize(w, h, window.devicePixelRatio || 1);
      draw();
    };
    new ResizeObserver(doResize).observe(stage);

    /* --- boot --- */
    const api = { seek, play, pause, restart, setLoop, get t() { return state.t; }, get playing() { return state.playing; }, duration: D };
    window.__motion = api;

    Promise.resolve(cfg.init ? cfg.init() : null).then(() => {
      state.ready = true;
      const r = stage.getBoundingClientRect();
      rw = Math.round(r.width); rh = Math.round(r.height);
      if (cfg.resize) cfg.resize(rw, rh, window.devicePixelRatio || 1);
      document.body.classList.add('is-ready');
      const qt = params.get('t');
      if (qt !== null) { seek(parseFloat(qt) || 0); syncPlay(); return; }
      if (reduced) {
        seek(cfg.poster != null ? cfg.poster : 0);
        note.textContent = 'Reduced motion is on — showing a still composition. Press Play to watch the full piece.';
        note.hidden = false;
        syncPlay();
        return;
      }
      seek(0);
      play();
      wake();
    });
    syncPlay();
    return api;
  };

  window.Motion = M;
})();
