/* 08 — Elastic Letterforms
 * The outlines of the real glyphs (traced from the font by marching squares) are deformed by a set of
 * damped oscillators — a closed-form "impulse response" for every strike — so the physics is stylised
 * but exact at any time: scrubbing, looping and reduced motion all see the same frame.
 * Each letter carries three modes: a stretch that lags towards its top, a sway that bends it, and a
 * dent where it was struck. The baseline is a string that rings when anything lands.
 */
(() => {
  const { ease: E, seg, clamp, lerp, TAU } = Motion;
  const D = 14;
  const WORD = 'tension';
  const FONT = '"Bodoni Moda", "Didot", "Bodoni 72", serif';
  const YELLOW = '#F3C318', INK = '#111111';
  const RASTER = 1000; /* px size at which outlines are traced: large enough that Bodoni's hairlines survive */

  const stage = document.getElementById('stage');
  const cv = Motion.canvas(stage);
  const ctx = cv.ctx;
  let W = 0, H = 0, k = 1, base = 0, x0 = 0, xh = 1, wall = 0;
  let glyphs = [], dot = null;

  /* ---------- outlines: marching squares over a rasterised glyph ---------- */
  function trace(ch) {
    const m = document.createElement('canvas').getContext('2d');
    m.font = `900 ${RASTER}px ${FONT}`;
    const mt = m.measureText(ch);
    const pad = 4;
    const asc = Math.ceil(mt.actualBoundingBoxAscent), desc = Math.ceil(mt.actualBoundingBoxDescent);
    const left = Math.ceil(mt.actualBoundingBoxLeft);
    const w = Math.ceil(left + mt.actualBoundingBoxRight) + pad * 2, h = asc + desc + pad * 2;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.font = m.font;
    x.fillStyle = '#000';
    x.fillText(ch, pad + left, pad + asc);
    const px = x.getImageData(0, 0, w, h).data;
    const a = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : px[(j * w + i) * 4 + 3] / 255);
    /* edge ids: horizontal edge (i,j)-(i+1,j) = 2*(j*(w+1)+i); vertical (i,j)-(i,j+1) = +1 */
    const pts = new Map(), links = new Map();
    const eid = (i, j, v) => 2 * (j * (w + 1) + i) + v;
    const point = (id, i, j, v) => {
      if (pts.has(id)) return;
      const a0 = a(i, j), a1 = v ? a(i, j + 1) : a(i + 1, j);
      const f = (0.5 - a0) / (a1 - a0 || 1e-6);
      pts.set(id, v ? [i, j + f] : [i + f, j]);
    };
    const link = (p, q) => { (links.get(p) || links.set(p, []).get(p)).push(q); (links.get(q) || links.set(q, []).get(q)).push(p); };
    for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
      const tl = a(i, j) > 0.5, tr = a(i + 1, j) > 0.5, br = a(i + 1, j + 1) > 0.5, bl = a(i, j + 1) > 0.5;
      const code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const T = eid(i, j, 0), B = eid(i, j + 1, 0), L = eid(i, j, 1), R = eid(i + 1, j, 1);
      const P = { T: [T, i, j, 0], B: [B, i, j + 1, 0], L: [L, i, j, 1], R: [R, i + 1, j, 1] };
      const seg2 = (u, v) => { point(...P[u]); point(...P[v]); link(P[u][0], P[v][0]); };
      const centre = (a(i, j) + a(i + 1, j) + a(i + 1, j + 1) + a(i, j + 1)) / 4 > 0.5;
      switch (code) {
        case 1: case 14: seg2('L', 'B'); break;
        case 2: case 13: seg2('B', 'R'); break;
        case 3: case 12: seg2('L', 'R'); break;
        case 4: case 11: seg2('T', 'R'); break;
        case 6: case 9: seg2('T', 'B'); break;
        case 7: case 8: seg2('L', 'T'); break;
        case 5: if (centre) { seg2('L', 'T'); seg2('B', 'R'); } else { seg2('L', 'B'); seg2('T', 'R'); } break;
        case 10: if (centre) { seg2('T', 'R'); seg2('L', 'B'); } else { seg2('L', 'T'); seg2('B', 'R'); } break;
      }
    }
    /* chain the segments into closed loops, then thin them to ~1.5 raster px spacing */
    const used = new Set(), loops = [];
    for (const start of links.keys()) {
      if (used.has(start)) continue;
      const loop = [];
      let prev = -1, cur = start;
      while (cur !== undefined && !used.has(cur)) {
        used.add(cur);
        const p = pts.get(cur);
        loop.push([p[0] - pad - left, p[1] - pad - asc]);
        const nb = links.get(cur);
        const next = nb[0] !== prev ? nb[0] : nb[1];
        prev = cur; cur = next;
      }
      if (loop.length < 8) continue;
      const thin = [loop[0]];
      for (const p of loop) { const q = thin[thin.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2.6) thin.push(p); }
      loops.push(thin);
    }
    const adv = m.measureText(ch).width;
    let top = 0;
    for (const l of loops) for (const p of l) top = Math.min(top, p[1]);
    return { ch, loops, adv, top };
  }

  /* ---------- the score: who strikes whom, and when ---------- */
  /* strike = [time, glyph, kind]; kinds give each impulse its amplitudes */
  const KIND = {
    land: { s: -0.5, w: 12.5, z: 0.1, b: 0.09, dent: 0.3, str: 10 },
    leap: { s: -0.18, w: 11, z: 0.16, b: 0.0, dent: 0.0, str: 3 },
    side: { s: 0.25, w: 9, z: 0.1, b: -0.55, dent: 0.0, str: 6 },
    tutti: { s: 0.95, w: 6.4, z: 0.12, b: 0.0, dent: 0.0, str: 16 },
  };
  let STRIKES = [], PATH = [], impulses = [];

  function compose() {
    /* the dot's path: leap from the i, land on t, then hop rightward over every other letter,
     * rebound off the page edge, hit the last n from the side, rise, and drop home into the i */
    const top = (j) => ({ x: glyphs[j].cx, y: glyphs[j].base + glyphs[j].top * k - dot.r });
    const I = glyphs.findIndex((g) => g.ch === 'i');
    const home = { x: glyphs[I].cx + dot.ox * k, y: glyphs[I].base + dot.oy * k };
    PATH = [
      [0, home, 0], [3.0, home, 0],
      [3.85, top(0), 0.42], [4.3, top(1), 0.16], [4.72, top(2), 0.15], [5.1, top(3), 0.14],
      [5.62, top(5), 0.2], [6.0, top(6), 0.12],
      [6.36, { x: wall - dot.r, y: glyphs[6].base - xh * 0.72 }, 0.14],
      [6.62, { x: glyphs[6].cx + glyphs[6].adv * k * 0.42 + dot.r, y: glyphs[6].base - xh * 0.46 }, 0.02],
      [7.92, home, 0.62], [D, home, 0],
    ];
    STRIKES = [[2.84, I, 'leap'], [3.85, 0, 'land'], [4.3, 1, 'land'], [4.72, 2, 'land'], [5.1, 3, 'land'], [5.62, 5, 'land'], [6.0, 6, 'land'], [6.62, 6, 'side']];
    impulses = [];
    for (const [t, j, kind] of STRIKES) {
      const K = KIND[kind];
      glyphs.forEach((g, n) => {
        const dist = Math.abs(n - j);
        /* energy travels along the word: neighbours answer later, and weaker */
        const fall = kind === 'side' ? Math.pow(0.86, dist) : Math.pow(0.32, dist);
        const delay = kind === 'side' ? dist * 0.075 : dist * 0.06;
        if (fall < 0.02) return;
        impulses.push({ g: n, t: t + delay, K, a: fall, local: n === j });
      });
    }
    /* the climax: the dot drops home and every letter is thrown upward at once */
    glyphs.forEach((g, n) => impulses.push({ g: n, t: 7.92, K: KIND.tutti, a: n === I ? 1.18 : 1, local: n === I }));
  }

  /* impulse response; the last second of the loop settles everything to exact rest */
  let settle = 1;
  const osc = (tau, w, z) => (tau <= 0 ? 0 : Math.exp(-z * w * tau) * Math.sin(w * tau) * settle);

  /* deformation of glyph n at height u (0 = baseline, 1 = x-height) */
  function modes(n, t, u) {
    let s = 0, b = 0, dent = 0;
    for (const im of impulses) {
      if (im.g !== n) continue;
      const tau = t - im.t;
      if (tau <= 0 || tau > 7) continue;
      const K = im.K;
      /* the top of a letter answers a little later and a little slower than its foot */
      s += K.s * im.a * osc(tau - u * 0.045, K.w * (1 - 0.14 * u), K.z);
      b += K.b * im.a * (im.g % 2 ? -1 : 1) * osc(tau - u * 0.07, K.w * 0.62, K.z * 1.2);
      if (im.local) dent += K.dent * osc(tau, 21, 0.3);
    }
    return { s, b, dent };
  }

  function stringAt(x, t, line) {
    let y = 0;
    for (const [t0, j, kind] of STRIKES.concat([[7.92, 4, 'tutti']])) {
      if (glyphs[j].line !== line) continue;
      const tau = t - t0;
      if (tau <= 0 || tau > 4) continue;
      const x1 = glyphs[j].cx;
      const env = Math.exp(-Math.abs(x - x1) / (W * 0.35));
      y += KIND[kind].str * env * osc(tau - Math.abs(x - x1) / 1600, 19, 0.16);
    }
    return y;
  }

  /* modes only depend on height, so each frame they are sampled once per letter in 48 bands */
  const BANDS = 48, cache = { t: -1, m: [] };
  function modesCached(n, t, u) {
    if (cache.t !== t) {
      cache.t = t;
      cache.m = glyphs.map((g, gi) => Array.from({ length: BANDS + 1 }, (_, b) => modes(gi, t, (b / BANDS) * 2.2)));
    }
    const f = (u / 2.2) * BANDS, b0 = Math.floor(f), b1 = Math.min(BANDS, b0 + 1), k2 = f - b0;
    const A = cache.m[n][b0], B = cache.m[n][b1];
    return { s: lerp(A.s, B.s, k2), b: lerp(A.b, B.b, k2), dent: lerp(A.dent, B.dent, k2) };
  }
  function deform(g, n, t, lx, ly, out) {
    /* lx: from glyph centre; ly: from baseline (negative is up), both in screen px */
    const u = clamp(-ly / xh, 0, 2.2);
    const M = modesCached(n, t, u);
    const sy = 1 + M.s * Math.pow(u / 1.05, 0.7);
    let x = lx * (1 - 0.32 * M.s * Math.min(u, 1)) + M.b * xh * Math.pow(u, 1.6);
    let y = ly * sy;
    /* the dent: a soft depression under the point of impact, at the top of the letter */
    if (M.dent) y += M.dent * xh * Math.exp(-(lx * lx) / (xh * xh * 0.18)) * clamp((u - 0.55) / 0.45);
    out[0] = g.cx + x; out[1] = g.base + y + stringAt(g.cx + x, t, g.line);
  }

  function dotAt(t) {
    let i = 0;
    while (i < PATH.length - 2 && t > PATH[i + 1][0]) i++;
    const [t0, p0] = PATH[i], [t1, p1, hop] = PATH[i + 1];
    const s = clamp((t - t0) / (t1 - t0));
    let x = lerp(p0.x, p1.x, s), y = lerp(p0.y, p1.y, s) - hop * H * 4 * s * (1 - s);
    /* at home the dot rides its letter: it goes wherever the top of the i goes */
    if (i === 0 || i === PATH.length - 2) {
      const I = glyphs.findIndex((g) => g.ch === 'i');
      const o = [0, 0];
      deform(glyphs[I], I, t, dot.ox * k, dot.oy * k, o);
      x = o[0]; y = o[1];
      /* anticipation: the i crouches, the dot sinks with it, then it is gone */
    }
    /* squash on every contact */
    let q = 0;
    for (const [ts] of STRIKES) q += osc(t - ts, 30, 0.35) * 0.55;
    q += osc(t - 7.92, 26, 0.3) * 0.7;
    return { x, y, q };
  }

  /* wide frames: one line on one string. Tall frames: "ten / sion" on two strings, much larger */
  let LINES = [];
  function layout() {
    const portrait = W / H < 0.9;
    const m = document.createElement('canvas').getContext('2d');
    m.font = `900 ${RASTER}px ${FONT}`;
    const breaks = portrait ? [[0, 3], [3, 7]] : [[0, 7]];
    const widest = Math.max(...breaks.map(([a, b]) => m.measureText(WORD.slice(a, b)).width));
    k = (W * (portrait ? 0.86 : 0.8)) / widest;
    x0 = portrait ? W * 0.06 : W * 0.065;
    wall = W * (portrait ? 0.975 : 0.965);
    xh = m.measureText('x').actualBoundingBoxAscent * k;
    LINES = breaks.map(([a, b], li) => ({ a, b, base: portrait ? H * (0.47 + li * 0.25) : H * 0.78 }));
    base = LINES[LINES.length - 1].base;
    LINES.forEach((L) => {
      for (let n = L.a; n < L.b; n++) {
        const before = m.measureText(WORD.slice(L.a, n)).width;
        glyphs[n].cx = x0 + (before + glyphs[n].adv / 2) * k;
        glyphs[n].base = L.base;
        glyphs[n].line = L;
      }
    });
  }

  const tmp = [0, 0];
  function render(t) {
    settle = 1 - Motion.smooth(seg(t, 12.2, 13.7));
    ctx.fillStyle = YELLOW;
    ctx.fillRect(0, 0, W, H);
    /* the string the letters stand on */
    ctx.beginPath();
    for (const L of LINES) for (let s = 0; s <= 120; s++) {
      const x = (s / 120) * W;
      const y = L.base + 1.5 + stringAt(x, t, L);
      s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, xh * 0.012);
    ctx.stroke();
    ctx.fillStyle = INK;
    glyphs.forEach((g, n) => {
      ctx.beginPath();
      for (const loop of g.loops) {
        if (loop === g.dotLoop) continue;
        for (let i = 0; i < loop.length; i++) {
          const p = loop[i];
          deform(g, n, t, (p[0] - g.adv / 2) * k, p[1] * k, tmp);
          i ? ctx.lineTo(tmp[0], tmp[1]) : ctx.moveTo(tmp[0], tmp[1]);
        }
        ctx.closePath();
      }
      ctx.fill('evenodd');
    });
    /* the dot */
    const d = dotAt(t);
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.scale(1 + d.q * 0.5, 1 - d.q * 0.42);
    ctx.beginPath();
    dot.loop.forEach((p, i) => { const x = (p[0] - dot.cx) * k, y = (p[1] - dot.cy) * k; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function resize(w, h, dpr) {
    W = w; H = h;
    cv.resize(w, h, dpr);
    layout();
    compose();
  }

  Motion.player({
    number: '08',
    title: 'Elastic Letterforms',
    subtitle: 'The Physics of Expression',
    duration: D,
    poster: 8.1,
    stage,
    description: [
      'A word about being stretched tight, set in the heaviest Bodoni, where every letter is a heavy stem and a hairline — a body with mass and a spring. The force that enters the word comes from inside it: the dot of the i.',
      'The i crouches, the dot leaps, and lands on the t. Then it hops along the word, letter by letter, and every letter it touches squashes, rebounds and sways — each at its own frequency, the top of each letter a fraction behind its foot. The string they stand on rings under every landing.',
      'The dot rebounds off the edge of the page and strikes the last n from the side, sending a bend back through the whole word. Then it drops home, hard, and all seven letters are thrown upward together — the one moment of unison — before the energy drains out of them.',
      'The outlines are traced from the real glyphs. The motion is stylised physics: a sum of damped oscillators, one for every impact, so any frame can be computed directly from its time.',
    ],
    init: async () => {
      await Motion.fonts([['900 100px "Bodoni Moda"', WORD]]);
      glyphs = [...WORD].map(trace);
      const gi = glyphs.find((g) => g.ch === 'i');
      /* the dot is the i's topmost separate loop */
      let best = null, bestY = Infinity;
      for (const l of gi.loops) { const my = Math.max(...l.map((p) => p[1])); if (my < bestY) { bestY = my; best = l; } }
      gi.dotLoop = best;
      const cx = best.reduce((s, p) => s + p[0], 0) / best.length, cy = best.reduce((s, p) => s + p[1], 0) / best.length;
      const r = Math.max(...best.map((p) => Math.hypot(p[0] - cx, p[1] - cy)));
      dot = { loop: best, cx, cy, ox: cx - gi.adv / 2, oy: cy, rRaster: r };
      Object.defineProperty(dot, 'r', { get: () => r * k });
    },
    resize,
    render,
  });
})();
