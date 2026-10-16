/* 10 — Iridescent Sculpture
 * A ribbon of constant thickness bent into a ring with one full twist, ray-marched as a signed
 * distance field. Its colour is not painted: the surface carries a thin transparent film, and the
 * reflectance of that film is computed for seven wavelengths from the film's thickness and the angle
 * of view (two-interface Airy reflectance), then converted to RGB through the CIE colour-matching
 * functions. The body underneath is a neutral grey; colour exists only where light is reflected.
 * ?white renders the bare form in matte white — the test that the sculpture stands without its colour.
 */
(() => {
  const { ease: E, track, seg, clamp, lerp } = Motion;
  const D = 20;
  const WHITE = /[?&]white/.test(location.search);
  const stage = document.getElementById('stage');
  const cv = Motion.canvas(stage, { webgl: true, dprCap: 1.25 });
  const pl1 = document.getElementById('pl1'), pl2 = document.getElementById('pl2'), plate = document.getElementById('plate');
  let G = null, W = 0, H = 0;

  /* seven wavelengths, and their sRGB weights from the CIE 1931 observer (Wyman et al. fit),
   * normalised so a flat spectrum is neutral white */
  const LAMBDA = [410, 450, 490, 530, 570, 610, 650];
  function cmf(l) {
    const g = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
    const X = 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
    const Y = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
    const Z = 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
    return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  }
  const WEIGHTS = (() => {
    const w = LAMBDA.map(cmf);
    const sum = [0, 1, 2].map((c) => w.reduce((s, v) => s + v[c], 0));
    return w.map((v) => v.map((x, c) => x / sum[c]));
  })();

  const FS = `
precision highp float;
uniform vec2 uRes;
uniform float uTwist, uYaw, uTilt, uWidth, uWave;
uniform float uFilm, uFilmVar, uDrain, uIrid, uEnv, uT;
uniform vec2 uOff;
uniform float uCamZ;
uniform float uWhite;
uniform float uL[7];
uniform vec3 uWt[7];

const float R0 = 1.0, TH = 0.016;

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }

/* the ribbon: a thin rounded rectangle swept around a circle, turning once on the way round */
float ribbon(vec3 p, out vec2 uv) {
  float th = atan(p.z, p.x);
  vec2 q = vec2(length(p.xz) - R0, p.y);
  float a = th + uTwist;                       /* one full turn per revolution */
  float c = cos(a), s = sin(a);
  q = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
  float w = uWidth * (1.0 + uWave * sin(th * 2.0 - uT * 0.6));
  vec2 d = abs(q) - vec2(w, TH);
  uv = vec2(th, q.x / w);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 0.004;
}
mat3 ORI;
float map(vec3 p, out vec2 uv) { return ribbon(ORI * p, uv); }
float map(vec3 p) { vec2 uv; return ribbon(ORI * p, uv); }

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0012, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
}

/* the studio: a seamless pale wall, a large soft box above left, a narrow strip at right */
vec3 studio(vec3 d) {
  vec3 base = mix(vec3(0.62, 0.6, 0.57), vec3(0.83, 0.81, 0.77), smoothstep(-0.4, 0.6, d.y));
  float a = uEnv;
  vec3 k1 = normalize(vec3(-0.55 * cos(a) - 0.3 * sin(a), 0.75, 0.35 * cos(a)));
  float box = smoothstep(0.86, 0.93, dot(d, k1));
  vec3 k2 = normalize(vec3(0.9 * cos(a * 0.7 + 1.2), 0.1, 0.4 * sin(a * 0.7 + 1.2)));
  float strip = smoothstep(0.975, 0.99, dot(d, k2)) * smoothstep(0.55, 0.0, abs(d.y - k2.y));
  return base + vec3(1.0, 0.99, 0.97) * (box * 2.4 + strip * 1.6);
}

/* Airy reflectance of a single thin film (air / film n=1.38 / substrate n=1.6), s-polarised */
float film(float cosI, float dnm, float lam) {
  float n1 = 1.0, n2 = 1.38, n3 = 1.6;
  float sinI = sqrt(max(0.0, 1.0 - cosI * cosI));
  float cos2 = sqrt(max(0.0, 1.0 - pow(n1 / n2 * sinI, 2.0)));
  float cos3 = sqrt(max(0.0, 1.0 - pow(n1 / n3 * sinI, 2.0)));
  float r12 = (n1 * cosI - n2 * cos2) / (n1 * cosI + n2 * cos2);
  float r23 = (n2 * cos2 - n3 * cos3) / (n2 * cos2 + n3 * cos3);
  float delta = 4.0 * 3.14159265 * n2 * dnm * cos2 / lam;
  float c = cos(delta);
  return (r12 * r12 + r23 * r23 + 2.0 * r12 * r23 * c) / (1.0 + r12 * r12 * r23 * r23 + 2.0 * r12 * r23 * c);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv0 = (frag - 0.5 * uRes) / uRes.y - uOff;
  vec3 ro = vec3(0.0, 0.16, uCamZ);
  vec3 rd = normalize(vec3(uv0, -1.75));
  /* spin about the ring's own (tilted) axis: half a turn then maps the twisted ring exactly onto itself */
  ORI = rotY(uYaw) * rotX(uTilt);
  /* background: the wall, and a floor that meets it in a soft curve */
  vec3 bg = mix(vec3(0.76, 0.745, 0.715), vec3(0.83, 0.82, 0.79), smoothstep(-0.55, 0.45, uv0.y + uOff.y));
  float t = 0.0, dist = 1.0;
  vec2 suv;
  bool hit = false;
  for (int i = 0; i < 128; i++) {
    vec3 p = ro + rd * t;
    dist = map(p, suv);
    if (dist < 0.0006) { hit = true; break; }
    t += dist * 0.55;
    if (t > uCamZ + 3.0) break;
  }
  /* contact shadow on the floor: how close the sculpture comes to the floor below this pixel */
  float fy = -1.18;
  float tf = (fy - ro.y) / rd.y;
  if (!hit && rd.y < 0.0 && tf > 0.0) {
    vec3 fp = ro + rd * tf;
    float occ = 1.0;
    for (int k = 1; k <= 5; k++) { float h = float(k) * 0.2; occ -= (h - min(map(fp + vec3(0.0, h, 0.0)), h)) * 0.32 / float(k); }
    bg *= mix(0.84, 1.0, clamp(occ, 0.0, 1.0));
  }
  vec3 col = bg;
  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = normalAt(p);
    if (dot(n, rd) > 0.0) n = -n;
    float cosI = clamp(dot(-rd, n), 0.0, 1.0);
    vec3 r = reflect(rd, n);
    vec3 env = studio(r);
    vec3 key = normalize(vec3(-0.5, 0.8, 0.45));
    float dif = clamp(dot(n, key), 0.0, 1.0) * 0.7 + 0.3 * (0.5 + 0.5 * n.y);
    if (uWhite > 0.5) {
      col = vec3(0.93, 0.925, 0.91) * (0.42 + 0.62 * dif);
    } else {
      /* film thickness: a base thickness, a slow swirl across the ribbon, and gravity drainage */
      float dnm = uFilm + uFilmVar * (sin(suv.x * 3.0 + suv.y * 2.2 + uT * 0.35) * 0.6 + sin(suv.x * 7.0 - uT * 0.5) * 0.25);
      dnm += uDrain * (0.5 - 0.5 * (ORI * p).y) * 170.0;
      dnm = max(dnm, 20.0);
      vec3 refl = vec3(0.0);
      for (int k = 0; k < 7; k++) refl += uWt[k] * film(cosI, dnm, uL[k]);
      /* a plain dielectric of the same body, for comparison: the film only redistributes colour */
      float F0 = 0.05, Fs = F0 + (1.0 - F0) * pow(1.0 - cosI, 5.0);
      vec3 R = mix(vec3(Fs), clamp(refl * 1.0, 0.0, 1.0) * (1.0 + 2.2 * pow(1.0 - cosI, 3.0)), uIrid);
      vec3 body = vec3(0.47, 0.465, 0.455) * dif;
      col = body * (1.0 - R * 0.6) + env * R * 1.25;
    }
  }
  col = col / (1.0 + col * 0.18);
  col = pow(col, vec3(1.0 / 1.08));
  gl_FragColor = vec4(col, 1.0);
}`;

  /* ---------- the score ---------- */
  const T = {
    film: track([[0, 70], [3, 70], [7, 280, E.inOutSine], [11, 340, E.inOutSine], [14.5, 400, E.inOutSine], [17.5, 90, E.inOutCubic]]),
    filmVar: track([[0, 10], [3, 10], [7, 80, E.inOutSine], [11.5, 110], [14.5, 140, E.inOutSine], [17.5, 10, E.inOutCubic]]),
    drain: track([[0, 0], [9, 0], [13, 1, E.inOutSine], [16.5, 0, E.inOutCubic]]),
    irid: track([[0, 0.25], [3, 0.25], [6, 1, E.inOutSine], [16, 1], [18.5, 0.25, E.inOutCubic]]),
    /* the light makes exactly one circuit, so the loop closes */
    env: track([[0, 0], [3, 0], [9, 1.4, E.inOutSine], [14, 2.9, E.inOutSine], [D, Math.PI * 2, E.inOutSine]]),
    twist: track([[0, 0], [7, 0], [12.5, Math.PI * 0.75, E.inOutCubic], [17, Math.PI, E.inOutCubic]]),
    wave: track([[0, 0], [7, 0], [10, 0.22, E.inOutSine], [14, 0.3], [17, 0, E.inOutCubic]]),
  };

  function render(t) {
    if (!G) return;
    const { gl, u } = G;
    /* the sculpture makes half a turn per loop: with one full twist, half a turn maps it onto itself */
    const yaw = (t / D) * Math.PI + 0.35;
    gl.uniform1f(u('uYaw'), yaw);
    gl.uniform1f(u('uTwist'), T.twist(t));
    gl.uniform1f(u('uWave'), T.wave(t));
    gl.uniform1f(u('uFilm'), T.film(t));
    gl.uniform1f(u('uFilmVar'), T.filmVar(t));
    gl.uniform1f(u('uDrain'), T.drain(t));
    gl.uniform1f(u('uIrid'), T.irid(t));
    gl.uniform1f(u('uEnv'), T.env(t) % (Math.PI * 2));
    gl.uniform1f(u('uT'), t);
    G.draw();
    pl1.textContent = WHITE ? 'bare form — matte white' : `thickness ≈ ${Math.round(T.film(t))} nm ± ${Math.round(T.filmVar(t))}`;
    pl2.textContent = WHITE ? 'no film, no colour' : 'n = 1.38 on 1.60 · seven wavelengths';
  }

  function resize(w, h, dpr) {
    W = w; H = h;
    cv.resize(w, h, dpr);
    if (!G) return;
    const { gl, u } = G;
    G.viewport();
    gl.uniform2f(u('uRes'), cv.canvas.width, cv.canvas.height);
    const portrait = w / h < 0.9;
    /* wide frames: the ring sits left of centre, tilted into a diagonal; tall frames: higher, smaller tilt */
    gl.uniform2f(u('uOff'), portrait ? 0 : -0.16 * (w / h) * 0.6, portrait ? 0.02 : 0.0);
    gl.uniform1f(u('uTilt'), portrait ? 0.62 : 0.5);
    gl.uniform1f(u('uWidth'), 0.3);
    /* a tall frame is narrow: step back until the whole ring fits across it */
    gl.uniform1f(u('uCamZ'), portrait ? 4.7 * Math.min(2.1, 1.4 / (w / h)) : 4.7);
    plate.style.left = portrait ? '22px' : (w * 0.79) + 'px';
    plate.style.top = portrait ? (h * 0.82) + 'px' : (h * 0.72) + 'px';
  }

  Motion.player({
    number: '10',
    title: 'Iridescent Sculpture',
    subtitle: 'The Color of Changing Light',
    duration: D,
    poster: 13.2,
    stage,
    description: [
      'One ribbon, of constant thickness, bent into a ring and turned once on its way round. It is the simplest form that shows its front and its back at the same time, so light meets it at every angle.',
      'The colour is not a pigment. The ribbon carries a transparent film a few hundred nanometres thick, and the light reflected from its two surfaces interferes. Which wavelengths survive depends on the film’s thickness and the angle you see it from — so the colour moves when the light moves, when the ribbon turns, and when the film itself thickens, swirls and drains.',
      'It begins nearly colourless: a film too thin to separate the spectrum. The light shifts, the film thickens, the ribbon starts to twist through itself, and the colour reaches its richest when gravity drains the film and stripes it from top to bottom. Then it thins again and the grey returns.',
      'Physics: Airy reflectance of one film (n = 1.38) on a substrate (n = 1.6), s-polarised, at seven wavelengths weighted by the CIE 1931 observer. Art: the film’s thickness field, the studio, and the exaggerated strength of the reflection at grazing angles. Add ?white to the address to see the bare form.',
    ],
    init: async () => {
      await Motion.fonts([['600 10px "Inter Tight"', 'FILM'], ['400 10px "Inter Tight"', 'thickness']]);
      G = Motion.glProgram(cv.canvas, FS, { onLost: () => { document.getElementById('fallback').hidden = false; } });
      if (!G) { document.getElementById('fallback').hidden = false; return; }
      const { gl, u } = G;
      gl.uniform1fv(u('uL[0]'), new Float32Array(LAMBDA));
      gl.uniform3fv(u('uWt[0]'), new Float32Array(WEIGHTS.flat()));
      gl.uniform1f(u('uWhite'), WHITE ? 1 : 0);
    },
    resize,
    render,
  });
})();
