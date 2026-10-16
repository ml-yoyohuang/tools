/* 07 — Liquid Typography
 * The letters are not a picture being wobbled: each layout is turned into a signed distance field
 * (exact Euclidean distance transform of the set type), and the shader draws the zero contour of a
 * field that can soften, drip, inflate into its neighbours, and interpolate into another word.
 * Gloss comes from treating the ink as a bead whose height follows the distance to its edge,
 * so the material changes — matte print, wet enamel, matte print again — along with the form.
 */
(() => {
  const { ease: E, track, seg, clamp, smooth } = Motion;
  const D = 16;
  const R = 56; /* distance range stored in the field, in field pixels */
  const FONT = 'Fraunces, "Iowan Old Style", Georgia, serif';

  const stage = document.getElementById('stage');
  const cv = Motion.canvas(stage, { webgl: true, dprCap: 1.5 });
  const defA = document.getElementById('defA'), defB = document.getElementById('defB');
  let G = null, W = 0, H = 0, q = 1, portrait = false;

  const FS = `
precision highp float;
uniform sampler2D uA, uB;
uniform vec2 uRes;
uniform float uDpr, uQ, uT;
uniform float uMorph, uInflate, uWarp, uDrip, uGloss, uGrain, uTurn;
uniform vec2 uCA, uCB;   /* centres of the two words, device px */
uniform float uScaleAB;  /* length of B over length of A */
uniform vec3 uPaper, uInk, uHi;
const float R = ${R.toFixed(1)};

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
/* distance in device px at screen point p (device px, y down) */
float sdAt(sampler2D s, vec2 p) {
  vec2 uv = vec2(p.x / uRes.x, 1.0 - p.y / uRes.y);
  return (texture2D(s, uv).r - 0.5) * 2.0 * R / (uQ * uDpr);
}
/* A is carried into B's frame — moved, turned a quarter and stretched — so the body visibly travels */
float shape(vec2 p) {
  float sc = mix(1.0, uScaleAB, uTurn);
  float ph = 1.5707963 * uTurn;
  vec2 c = mix(uCA, uCB, uTurn);
  vec2 r = p - c;
  vec2 pa = uCA + vec2(cos(ph) * r.x - sin(ph) * r.y, sin(ph) * r.x + cos(ph) * r.y) / sc;
  return mix(sdAt(uA, pa) * sc, sdAt(uB, p), uMorph) - uInflate * uDpr;
}

/* polynomial smooth minimum: the drip is a continuous sweep, not a stack of copies */
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float field(vec2 p) {
  /* a slow, large domain warp: the letters soften as a body, not as a ripple */
  vec2 w = vec2(vnoise(p / (180.0 * uDpr) + vec2(uT * 0.11, 3.1)), vnoise(p / (180.0 * uDpr) + vec2(7.7, uT * 0.09))) - 0.5;
  vec2 qp = p + w * uWarp * uDpr * 2.0;
  /* drips: each column hangs a little of the letter above it, tapering as it falls */
  float col = vnoise(vec2(qp.x / (34.0 * uDpr), 1.7));
  float s = uDrip * uDpr * pow(col, 3.2) * 2.4;
  float d = shape(qp);
  if (s < 0.75) return d;
  for (int k = 1; k <= 22; k++) {
    float f = float(k) / 22.0;
    d = smin(d, shape(qp - vec2(0.0, s * f)) + f * f * 7.0 * uDpr * (1.0 - 0.6 * col), 5.0 * uDpr);
  }
  return d;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float d = field(p);
  /* a printed edge: in the dry states the ink edge picks up the tooth of the paper */
  d += uGrain * (hash(floor(p / uDpr)) - 0.5) * 0.9 * uDpr;
  float a = clamp(0.5 - d, 0.0, 1.0);
  /* the wet surface: a meniscus highlight just inside every edge that faces the light.
   * Only the edge direction comes from derivatives; the profile is analytic, so it never sparkles. */
  vec2 g = vec2(0.0, -1.0);
  float near = step(-14.0 * uDpr, d) * step(d, 2.0);
  if (near * uGloss > 0.0) {
    float e = 2.5 * uDpr;
    g = vec2(field(p + vec2(e, 0.0)) - d, field(p + vec2(0.0, e)) - d);
    g /= max(length(g), 1e-4);
  }
  vec2 L = normalize(vec2(-0.55, -0.83));
  float facing = smoothstep(0.15, 0.85, dot(g, L));
  float px = uDpr;
  float band = smoothstep(-1.6 * px, -3.2 * px, d) * (1.0 - smoothstep(-5.0 * px, -9.5 * px, d));
  float sheen = (1.0 - smoothstep(-6.0 * px, -26.0 * px, d)) * 0.07;
  vec3 ink = mix(uInk, uHi, (band * facing * 0.82 + sheen * facing) * uGloss);
  gl_FragColor = vec4(mix(uPaper, ink, a), 1.0);
}`;

  /* ---------- the score ---------- */
  const T = {
    turn: track([[0, 0], [8.0, 0], [11.5, 1, E.inOutCubic], [14.6, 1], [15.8, 0, E.inOutExpo]]),
    morph: track([[0, 0], [9.6, 0], [11.7, 1, E.inOutCubic], [14.6, 1], [15.8, 0, E.inOutExpo]]),
    inflate: track([[0, 0], [3, 0], [6, 2.2, E.inOutSine], [9.2, 9.5, E.inOutSine], [11.2, 3.5, E.inOutSine], [12.7, 0, E.outCubic]]),
    warp: track([[0, 0], [3, 0], [6.2, 3.5, E.inOutSine], [9.6, 13, E.inOutSine], [11.6, 4, E.inOutSine], [12.9, 0, E.outCubic]]),
    drip: track([[0, 0], [3.8, 0], [6.6, 30, E.inCubic], [9.3, 150, E.inOutSine], [11.3, 45, E.inOutCubic], [12.6, 0, E.outCubic]]),
    gloss: track([[0, 0], [3, 0], [5.6, 0.85, E.inOutSine], [10.4, 1], [12.9, 0.12, E.inOutSine], [14, 0]]),
    grain: track([[0, 1], [3.2, 1], [5.2, 0.15], [12.8, 0.15], [14.2, 1]]),
  };

  /* ---------- signed distance fields from set type ---------- */
  function edt1(f, n, d, v, z) {
    let k = 0;
    v[0] = 0; z[0] = -1e20; z[1] = 1e20;
    for (let qq = 1; qq < n; qq++) {
      let s = (f[qq] + qq * qq - (f[v[k]] + v[k] * v[k])) / (2 * qq - 2 * v[k]);
      while (s <= z[k]) { k--; s = (f[qq] + qq * qq - (f[v[k]] + v[k] * v[k])) / (2 * qq - 2 * v[k]); }
      k++; v[k] = qq; z[k] = s; z[k + 1] = 1e20;
    }
    k = 0;
    for (let qq = 0; qq < n; qq++) {
      while (z[k + 1] < qq) k++;
      d[qq] = (qq - v[k]) * (qq - v[k]) + f[v[k]];
    }
  }
  function edt(grid, w, h) {
    const n = Math.max(w, h);
    const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
      edt1(f, h, d, v, z);
      for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
      edt1(f, w, d, v, z);
      for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
    }
  }
  function sdfCanvas(draw, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff';
    draw(x);
    const img = x.getImageData(0, 0, w, h), px = img.data;
    const N = w * h, inside = new Float64Array(N), outside = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const on = px[i * 4] > 127;
      outside[i] = on ? 0 : 1e20;
      inside[i] = on ? 1e20 : 0;
    }
    edt(outside, w, h); edt(inside, w, h);
    for (let i = 0; i < N; i++) {
      const sd = Math.sqrt(outside[i]) - Math.sqrt(inside[i]);
      const v = clamp(sd / R * 0.5 + 0.5) * 255;
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v; px[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  /* the two compositions, in screen space */
  function layouts() {
    const sw = Math.round(W * q), sh = Math.round(H * q);
    const m = document.createElement('canvas').getContext('2d');
    const ratio = (word) => { m.font = `900 100px ${FONT}`; return m.measureText(word).width / 100; };
    /* A — "solid": enormous, left-aligned, low on the page */
    const sizeA = portrait ? (W * 0.84) / ratio('solid') : Math.min((W * 0.84) / ratio('solid'), H * 0.7);
    const ax = portrait ? W * 0.06 : W * 0.07, ay = portrait ? H * 0.55 : H * 0.7;
    const a = sdfCanvas((x) => {
      x.font = `900 ${sizeA * q}px ${FONT}`;
      x.textBaseline = 'alphabetic';
      x.fillText('solid', ax * q, ay * q);
    }, sw, sh);
    const sizeB = Math.min((H * (portrait ? 0.66 : 0.86)) / ratio('liquid'), portrait ? W * 0.62 : 1e9);
    const bx = portrait ? W * 0.56 : W * 0.75;
    /* B — "liquid": stood on end, reading upward along the right edge */
    const b = sdfCanvas((x) => {
      x.font = `900 ${sizeB * q}px ${FONT}`;
      x.textBaseline = 'middle';
      x.textAlign = 'center';
      x.translate(bx * q, H * 0.5 * q);
      x.rotate(-Math.PI / 2);
      x.fillText('liquid', 0, sizeB * 0.08 * q);
    }, sw, sh);
    const lenA = ratio('solid') * sizeA, lenB = ratio('liquid') * sizeB;
    return { a, b, cA: [ax + lenA / 2, ay - sizeA * 0.33], cB: [bx, H * 0.5], scale: lenB / lenA };
  }

  function placeDefs() {
    defA.style.transform = `translate(${portrait ? W * 0.06 : W * 0.075}px, ${portrait ? H * 0.64 : H * 0.79}px)`;
    defB.style.transform = `translate(${portrait ? W * 0.06 : W * 0.075}px, ${portrait ? H * 0.86 : H * 0.79}px)`;
    defB.style.width = portrait ? '17em' : '20em';
  }

  function render(t) {
    if (!G) return;
    const { gl, u } = G;
    gl.uniform1f(u('uT'), t);
    for (const k of ['turn', 'morph', 'inflate', 'warp', 'drip', 'gloss', 'grain']) gl.uniform1f(u('u' + k[0].toUpperCase() + k.slice(1)), T[k](t));
    G.draw();
    const ca = 1 - smooth(seg(t, 6.4, 7.4)) + smooth(seg(t, 15.2, 16));
    const cb = smooth(seg(t, 11.8, 12.6)) * (1 - smooth(seg(t, 14.3, 14.9)));
    defA.style.clipPath = `inset(0 ${(1 - clamp(ca)) * 100}% 0 0)`;
    defB.style.clipPath = `inset(0 ${(1 - clamp(cb)) * 100}% 0 0)`;
  }

  function resize(w, h, dpr) {
    W = w; H = h;
    portrait = w / h < 0.9;
    cv.resize(w, h, dpr);
    q = Math.min(0.9, 1300 / Math.max(w, h));
    if (!G) return;
    G.viewport();
    const { gl, u } = G;
    gl.uniform2f(u('uRes'), cv.canvas.width, cv.canvas.height);
    gl.uniform1f(u('uDpr'), cv.dpr);
    gl.uniform1f(u('uQ'), q);
    const L = layouts();
    G.texture(0, L.a, 'uA');
    G.texture(1, L.b, 'uB');
    gl.uniform2f(u('uCA'), L.cA[0] * cv.dpr, L.cA[1] * cv.dpr);
    gl.uniform2f(u('uCB'), L.cB[0] * cv.dpr, L.cB[1] * cv.dpr);
    gl.uniform1f(u('uScaleAB'), L.scale);
    placeDefs();
  }

  Motion.player({
    number: '07',
    title: 'Liquid Typography',
    subtitle: 'The Dissolution of Language',
    duration: D,
    poster: 7.6,
    stage,
    description: [
      'A word that names a state of matter, set in the heaviest weight of a soft serif, is asked to change state. “solid” begins as print: matte ink with the tooth of the paper on its edges. It turns glossy before it moves — the surface becomes wet first — then its letters drip, swell into one another, and lose their counters.',
      'At the bottom of the dissolution the body re-forms, not as the word it was but as “liquid”, stood on end along the edge of the page: the same ink, a different shape, holding the shape of whatever holds it. The return is the opposite tempo: a fast, almost brittle freeze back into the first word.',
      'Each layout is converted into an exact signed distance field of the set type. The shader draws the edge of a field that is warped, extended downward column by column (the drips), inflated (the fusions), and interpolated between the two words. The highlight is computed from the ink’s distance to its own edge, treated as the height of a bead.',
    ],
    init: async () => {
      await Motion.fonts([['900 100px Fraunces', 'solidliquid'], ['italic 400 15px Fraunces', 'adj'], ['600 10px "Inter Tight"', 'SOLID']]);
      G = Motion.glProgram(cv.canvas, FS, { onLost: () => { document.getElementById('fallback').hidden = false; } });
      if (!G) { document.getElementById('fallback').hidden = false; return; }
      const { gl: g, u } = G;
      g.uniform3f(u('uPaper'), 241 / 255, 236 / 255, 226 / 255);
      g.uniform3f(u('uInk'), 43 / 255, 26 / 255, 18 / 255);
      g.uniform3f(u('uHi'), 246 / 255, 236 / 255, 222 / 255);
    },
    resize,
    render,
  });
})();
