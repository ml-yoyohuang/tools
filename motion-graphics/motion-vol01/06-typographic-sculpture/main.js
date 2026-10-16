/* 06 — Infinite Typographic Sculpture
 * 240 glyphs, each a flat plate with its own frame in space (position, reading direction, up).
 * Three structures give every glyph a place: a helix tower, a Möbius band, a field.
 * Each glyph is projected in perspective and drawn through an affine map from three projected corners;
 * its tone comes from a light direction, so even plain black type reads as a solid in space.
 */
(() => {
  const { ease: E, seg, clamp, lerp, TAU } = Motion;
  const D = 30;
  const TEXT = 'LETTERS BEYOND THE PLANE · ';
  const N = 240;
  const BG = [216, 213, 206], INK = [16, 16, 16], STONE = [132, 128, 121], BACK = [176, 172, 165];
  const TONES = 14;

  const stage = document.getElementById('stage');
  const cv = Motion.canvas(stage);
  const ctx = cv.ctx;
  let W = 0, H = 0;

  /* ---------- glyph atlas: one strip of letters per tone ---------- */
  const FONT_PX = 120;
  let atlas = null, cells = {}, capPx = 1, cellH = 1;
  function buildAtlas() {
    const chars = [...new Set(TEXT.replace(/ /g, ''))];
    const m = document.createElement('canvas').getContext('2d');
    const font = `800 ${FONT_PX}px Archivo, "Helvetica Neue", Arial, sans-serif`;
    m.font = font;
    capPx = m.measureText('H').actualBoundingBoxAscent;
    const pad = 6;
    cellH = Math.ceil(capPx + pad * 2);
    let x = 0;
    for (const ch of chars) {
      const mt = m.measureText(ch);
      const w = Math.ceil(mt.width + pad * 2);
      cells[ch] = { x, w, adv: mt.width };
      x += w;
    }
    cells[' '] = { x: 0, w: 0, adv: m.measureText(' ').width, space: true };
    atlas = document.createElement('canvas');
    atlas.width = x;
    atlas.height = cellH * TONES;
    const a = atlas.getContext('2d');
    a.font = font;
    a.textBaseline = 'alphabetic';
    for (let k = 0; k < TONES; k++) {
      const c = toneColor(k / (TONES - 1));
      a.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      for (const ch of chars) a.fillText(ch, cells[ch].x + pad, k * cellH + pad + capPx);
    }
  }
  /* tone 0 = ink, 0.6 = lit stone, 1 = the pale back of a plate */
  function toneColor(v) {
    const mix = (p, q, k) => p.map((x, i) => Math.round(x + (q[i] - x) * k));
    return v < 0.62 ? mix(INK, STONE, v / 0.62) : mix(STONE, BACK, (v - 0.62) / 0.38);
  }

  /* ---------- the glyph sequence and its proportional spacing ---------- */
  const glyphs = [];
  function buildGlyphs() {
    glyphs.length = 0;
    for (let i = 0; i < N; i++) {
      const ch = TEXT[i % TEXT.length];
      glyphs.push({ ch, adv: cells[ch].adv / capPx });
    }
    /* cumulative advance within a "line" of the given length, normalised to 0..1 */
    const lines = (len) => {
      const out = new Float32Array(N);
      for (let s = 0; s < N; s += len) {
        let tot = 0;
        for (let i = s; i < s + len; i++) tot += glyphs[i].adv;
        let acc = 0;
        for (let i = s; i < s + len; i++) { out[i] = (acc + glyphs[i].adv / 2) / tot; acc += glyphs[i].adv; }
      }
      return out;
    };
    LINE.helix = lines(N); LINE.mob = lines(60); LINE.field = lines(20);
  }
  const LINE = {};

  /* ---------- structures: each returns position P, reading direction R, up U, cap height h ---------- */
  const v3 = (x, y, z) => ({ x, y, z });
  function helix(i, t, o) {
    const turns = 7.6;
    const u = LINE.helix[i];
    const a = u * turns * TAU + t * 0.0;
    const r = 0.98 + 0.05 * Math.sin(u * TAU * 2 + (t / D) * TAU);
    const height = 2.75 * (1 + 0.035 * Math.sin((t / D) * TAU * 2));
    const y = -height / 2 + u * height;
    o.P = v3(Math.cos(a) * r, y, Math.sin(a) * r);
    /* tangent along the climb; up is the cylinder's axis, kept perpendicular to the tangent */
    const pitch = height / (turns * TAU * r);
    const T = norm(v3(-Math.sin(a), pitch, Math.cos(a)));
    o.R = T; o.U = norm(sub(v3(0, 1, 0), scale(T, T.y)));
    o.h = 0.235;
  }
  function mobius(i, t, o) {
    const R0 = 1.5;
    const track = Math.floor(i / 60);
    const u = LINE.mob[i];
    const th = u * TAU;
    const twist = th / 2 + (t / D) * TAU;          /* one half-twist, slowly rolling through the band */
    const radial = v3(Math.cos(th), 0, Math.sin(th));
    const up = v3(0, 1, 0);
    const across = add(scale(radial, Math.cos(twist)), scale(up, Math.sin(twist)));
    const off = (track - 1.5) * 0.205;
    const c = scale(radial, R0);
    o.P = add(c, scale(across, off));
    o.R = norm(v3(-Math.sin(th), 0, Math.cos(th)));
    o.U = across;
    o.h = 0.16;
  }
  function field(i, t, o) {
    const row = Math.floor(i / 20);
    const u = LINE.field[i];
    const x = (u - 0.5) * 3.7;
    const z = (row - 5.5) * 0.31;
    const ph = (t / D) * TAU * 2;
    const f = (x, z) => 0.3 * Math.sin(1.5 * x - ph) * Math.cos(0.9 * z + ph * 0.5) + 0.1 * Math.sin(2.2 * z + ph);
    const y = f(x, z);
    const e = 0.01;
    const dx = (f(x + e, z) - y) / e, dz = (f(x, z + e) - y) / e;
    o.P = v3(x, y - 0.1, z);
    o.R = norm(v3(1, dx, 0));
    /* the page leans away from the reader: "up" points to the far rows */
    o.U = norm(v3(0, -dz, -1));
    o.h = 0.19;
  }
  const STRUCT = [helix, mobius, field];
  const NAMES = [['I', 'Helix', 'a tower read upward'], ['II', 'Möbius band', 'one half-twist, rolling'], ['III', 'Field', 'a page in a slow swell']];

  /* holds and transitions; camera elevation follows the structure */
  const SCHED = [[0, 6.5, 0, 0], [6.5, 10.5, 0, 1], [10.5, 17, 1, 1], [17, 21, 1, 2], [21, 26, 2, 2], [26, 30, 2, 0]];
  const ELEV = [0.12, 0.42, 0.66];
  let DIST = [7.0, 6.6, 6.2];

  /* ---------- vector helpers ---------- */
  function add(a, b) { return v3(a.x + b.x, a.y + b.y, a.z + b.z); }
  function sub(a, b) { return v3(a.x - b.x, a.y - b.y, a.z - b.z); }
  function scale(a, k) { return v3(a.x * k, a.y * k, a.z * k); }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) { return v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  function norm(a) { const l = Math.hypot(a.x, a.y, a.z) || 1; return v3(a.x / l, a.y / l, a.z / l); }
  function vlerp(a, b, k) { return v3(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k)); }

  /* ---------- frame ---------- */
  const A = {}, B = {};
  const items = [];
  for (let i = 0; i < N; i++) items.push({ i, z: 0 });
  let F = 1, cx = 0, cy = 0;

  function cameraAt(t) {
    let seg0 = SCHED[0];
    for (const s of SCHED) if (t >= s[0] && t < s[1]) seg0 = s;
    const [a, b, s0, s1] = seg0;
    const k = s0 === s1 ? 0 : E.inOutCubic(seg(t, a, b));
    return { el: lerp(ELEV[s0], ELEV[s1], k), dist: lerp(DIST[s0], DIST[s1], k), s0, s1, a, b };
  }

  function render(t) {
    ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
    ctx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
    ctx.fillRect(0, 0, W, H);
    const cam = cameraAt(t);
    const yaw = (t / D) * TAU * 1 + 0.6;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cel = Math.cos(cam.el), sel = Math.sin(cam.el);
    const toCam = (p) => {
      const x = p.x * cyw - p.z * syw, z0 = p.x * syw + p.z * cyw;
      const y = p.y * cel - z0 * sel, z = p.y * sel + z0 * cel;
      return v3(x, y, z + cam.dist);
    };
    const rotV = (p) => {
      const x = p.x * cyw - p.z * syw, z0 = p.x * syw + p.z * cyw;
      return v3(x, p.y * cel - z0 * sel, p.y * sel + z0 * cel);
    };
    const proj = (c) => [cx + (c.x / c.z) * F, cy - (c.y / c.z) * F];

    /* floor shadow: a soft ellipse below the sculpture */
    const floor = toCam(v3(0, -1.75, 0));
    const fp = proj(floor);
    ctx.save();
    ctx.translate(fp[0], fp[1]);
    ctx.scale(1, Math.max(0.12, Math.sin(cam.el) * 0.9 + 0.08));
    const sr = (2.0 / floor.z) * F;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
    g.addColorStop(0, 'rgba(60,55,48,.22)'); g.addColorStop(0.6, 'rgba(60,55,48,.07)'); g.addColorStop(1, 'rgba(60,55,48,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, sr, 0, TAU); ctx.fill();
    ctx.restore();

    const light = norm(v3(-0.5, 0.75, -0.45));
    const k0 = cam.s0 === cam.s1 ? 0 : 1;
    for (const it of items) {
      const i = it.i;
      const ch = glyphs[i].ch;
      if (ch === ' ') { it.skip = true; continue; }
      it.skip = false;
      STRUCT[cam.s0](i, t, A);
      let P = A.P, R = A.R, U = A.U, h = A.h;
      if (k0) {
        STRUCT[cam.s1](i, t, B);
        /* each glyph leaves on its own beat: a wave of departures along the text */
        const st = (i / N) * 0.45;
        const k = E.inOutQuart(seg(t, cam.a + st * (cam.b - cam.a), cam.a + (st + 0.55) * (cam.b - cam.a)));
        const lift = Math.sin(k * Math.PI);
        P = vlerp(A.P, B.P, k);
        P = add(P, v3(P.x * lift * 0.35, lift * 0.25, P.z * lift * 0.35));
        R = norm(vlerp(A.R, B.R, k));
        U = vlerp(A.U, B.U, k);
        U = norm(sub(U, scale(R, dot(U, R))));
        h = lerp(A.h, B.h, k);
      }
      const w = glyphs[i].adv * h;
      const c0 = toCam(add(P, add(scale(R, -w / 2), scale(U, -h / 2))));
      const c1 = toCam(add(P, add(scale(R, w / 2), scale(U, -h / 2))));
      const c2 = toCam(add(P, add(scale(R, -w / 2), scale(U, h / 2))));
      it.p0 = proj(c0); it.p1 = proj(c1); it.p2 = proj(c2);
      it.z = (c0.z + c1.z + c2.z) / 3;
      /* shading: front faces toned by the light, back faces pale */
      /* screen y points down, so the plate's visible front is U × R */
      const n = cross(U, R);
      const nc = rotV(n);
      const pc = toCam(P);
      const facing = -(nc.x * pc.x + nc.y * pc.y + nc.z * pc.z) / Math.hypot(pc.x, pc.y, pc.z);
      let tone;
      if (facing >= 0) {
        const lit = Math.max(0, dot(n, light));
        tone = 0.02 + lit * 0.42 + (1 - facing) * 0.18;
      } else tone = 0.78 + (1 + facing) * 0.12;
      const fog = clamp((it.z - (cam.dist - 1.2)) / 3.4);
      it.tone = clamp(tone + fog * 0.22);
      it.ch = ch;
    }
    items.sort((a, b) => b.z - a.z);
    for (const it of items) {
      if (it.skip) continue;
      const c = cells[it.ch];
      const cw = c.w, ch = cellH;
      const { p0, p1, p2 } = it;
      /* plate corners ↔ the glyph's ink box (advance × cap height) inside its padded cell */
      const a = (p1[0] - p0[0]) / c.adv, b = (p1[1] - p0[1]) / c.adv;
      const cc = (p0[0] - p2[0]) / capPx, d = (p0[1] - p2[1]) / capPx;
      /* the cell carries padding: shift so the glyph's padded box maps onto the plate */
      const padU = 6, padV = 6;
      const ex = p2[0] - a * padU - cc * padV, ey = p2[1] - b * padU - d * padV;
      ctx.setTransform(cv.dpr * a, cv.dpr * b, cv.dpr * cc, cv.dpr * d, cv.dpr * ex, cv.dpr * ey);
      const row = Math.round(it.tone * (TONES - 1));
      ctx.drawImage(atlas, c.x, row * cellH, cw, ch, 0, 0, cw, ch);
    }
    ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
    caption(t, cam);
  }

  function caption(t, cam) {
    const m = Math.max(9.5, Math.min(W, H) * 0.0125);
    const x = W - Math.max(22, W * 0.03), y = Math.max(22, H * 0.035);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const idx = cam.s0 === cam.s1 ? cam.s0 : (t - cam.a) / (cam.b - cam.a) < 0.5 ? cam.s0 : cam.s1;
    NAMES.forEach((n, i) => {
      ctx.globalAlpha = i === idx ? 1 : 0.38;
      ctx.fillStyle = '#141414';
      ctx.font = `600 ${m}px "Inter Tight", "Helvetica Neue", Arial, sans-serif`;
      ctx.fillText(`${n[1].toUpperCase()}  ${n[0]}`, x, y + i * m * 2.9);
      ctx.font = `400 ${m}px "Inter Tight", "Helvetica Neue", Arial, sans-serif`;
      ctx.fillText(n[2], x, y + i * m * 2.9 + m * 1.3);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function resize(w, h, dpr) {
    W = w; H = h;
    cv.resize(w, h, dpr);
    const portrait = w / h < 0.85;
    F = portrait ? w * 1.5 : Math.min(w * 1.2, h * 1.62);
    /* in a tall frame the tower comes closer and the wide structures step back */
    DIST = portrait ? [5.0, 6.9, 8.8] : [7.0, 6.6, 6.9];
    cx = w / 2;
    cy = h * 0.5;
  }

  Motion.player({
    number: '06',
    title: 'Typographic Sculpture',
    subtitle: 'Letters Beyond the Plane',
    duration: D,
    poster: 13.5,
    stage,
    description: [
      'The phrase LETTERS BEYOND THE PLANE, repeated until it is two hundred and forty letters long, used as building material. Every letter is a flat plate with its own place in space: a position, a reading direction and an up.',
      'The plates are assembled three ways. A helix tower, read upward as it turns. A Möbius band of four parallel lines, given a half-twist that keeps rolling through it, so the text is always passing from its front to its back. A field, a single page of twelve lines lifted into a slow swell.',
      'Between structures, the letters leave one after another along the text, so each transition is read like a sentence. The camera rises as the sculpture flattens.',
      'There are no materials or lights beyond a single direction: front faces take their tone from it, back faces turn pale, distance adds a little air. If it works, it should work in black and white.',
    ],
    init: async () => {
      await Motion.fonts([['800 100px Archivo', 'LETTERSBYONDHPA·'], ['600 12px "Inter Tight"', 'HELIX'], ['400 12px "Inter Tight"', 'a tower']]);
      buildAtlas();
      buildGlyphs();
    },
    resize,
    render,
  });
})();
