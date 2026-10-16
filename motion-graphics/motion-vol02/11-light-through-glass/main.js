/* 11 — Light Through Glass
 * The poster is printed once into a texture. Three pieces of glass are thickness fields over it:
 * a rod (half-cylinder), a prism (a wedge) and a plano-convex lens. Everything optical comes from
 * those fields and nowhere else — the refracted offset follows the thickness gradient, dispersion
 * scales that offset per channel, the caustic on the paper follows the curvature (a Laplacian) of
 * the glass shifted along the light, and the bright and dark rims come from where the slope is steep.
 */
(() => {
  const { ease: E, track, clamp } = Motion;
  const D = 18;
  const stage = document.getElementById('stage');
  const cv = Motion.canvas(stage, { webgl: true, dprCap: 2 });
  let G = null, W = 0, H = 0, S = 1, portrait = false;

  /* ---------- the printed poster ---------- */
  function poster() {
    const dpr = cv.dpr;
    const c = document.createElement('canvas');
    c.width = cv.canvas.width; c.height = cv.canvas.height;
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    x.fillStyle = '#e7e3db'; x.fillRect(0, 0, W, H);
    const ink = '#171717';
    if (!portrait) {
      /* the headline, left */
      const hs = Math.min(H * 0.2, W * 0.12);
      x.fillStyle = ink;
      x.font = `700 ${hs}px "Inter Tight", "Helvetica Neue", Arial, sans-serif`;
      x.textBaseline = 'alphabetic';
      ['Light', 'bends', 'here.'].forEach((s, i) => x.fillText(s, W * 0.055, H * 0.33 + i * hs * 0.9));
      x.font = `500 ${hs * 0.17}px "Noto Serif TC", serif`;
      [...'光在這裡轉彎'].forEach((ch, i) => x.fillText(ch, W * 0.46, H * 0.19 + i * hs * 0.2));
      /* ruled block with the disc and the colour field, right */
      ruled(x, W * 0.56, H * 0.14, W * 0.38, H * 0.64, 30);
      disc(x, W * 0.8, H * 0.32, S * 0.1);
      x.fillStyle = '#2f4fa2'; x.fillRect(W * 0.56, H * 0.6, W * 0.11, H * 0.18);
      caption(x, W * 0.055, H * 0.9, W * 0.89);
    } else {
      const hs = W * 0.25;
      x.fillStyle = ink;
      x.font = `700 ${hs}px "Inter Tight", "Helvetica Neue", Arial, sans-serif`;
      ['Light', 'bends', 'here.'].forEach((s, i) => x.fillText(s, W * 0.06, H * 0.16 + i * hs * 0.88));
      ruled(x, W * 0.06, H * 0.5, W * 0.88, H * 0.3, 22);
      disc(x, W * 0.7, H * 0.6, S * 0.15);
      x.fillStyle = '#2f4fa2'; x.fillRect(W * 0.06, H * 0.71, W * 0.26, H * 0.09);
      x.font = `500 ${W * 0.042}px "Noto Serif TC", serif`;
      [...'光在這裡轉彎'].forEach((ch, i) => x.fillText(ch, W * 0.88, H * 0.09 + i * W * 0.05));
      caption(x, W * 0.06, H * 0.86, W * 0.88);
    }
    return c;
    function ruled(x, l, t, w, h, n) {
      x.fillStyle = ink;
      for (let i = 0; i <= n; i++) x.fillRect(l, Math.round(t + (h * i) / n), w, i % 5 === 0 ? 1.6 : 0.8);
    }
    function disc(x, cx, cy, r) { x.fillStyle = ink; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); }
    function caption(x, l, t, w) {
      x.fillStyle = ink; x.fillRect(l, t, w, 1);
      const fs = Math.max(10, Math.min(W, H) * 0.013);
      x.font = `500 ${fs}px "Inter Tight", sans-serif`;
      x.textBaseline = 'top';
      x.fillText('No. 11 — refraction study: glass on paper, afternoon light', l, t + fs * 0.8);
      x.textAlign = 'right';
      x.fillText('crown glass, n = 1.52', l + w, t + fs * 0.8);
      x.textAlign = 'left';
    }
  }

  const FS = `
precision highp float;
uniform sampler2D uPoster;
uniform vec2 uRes;
uniform float uS;
uniform vec4 uRod;    /* x, y, half-width, tilt */
uniform float uRodLen;
uniform vec4 uPrism;  /* x, y, rotation, half-width */
uniform vec2 uPrismHalf;
uniform vec3 uLens;   /* x, y, radius */
uniform float uAmbient, uCaustic;

/* thickness of all the glass at a point (device px) */
float rodH(vec2 p) {
  vec2 d = p - uRod.xy;
  float c = cos(uRod.w), s = sin(uRod.w);
  vec2 q = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
  float w = uRod.z;
  float u = clamp(q.x / w, -1.0, 1.0);
  float ends = smoothstep(uRodLen, uRodLen - w * 0.6, abs(q.y));
  return w * sqrt(max(0.0, 1.0 - u * u)) * step(abs(q.x), w) * ends;
}
float prismH(vec2 p) {
  vec2 d = p - uPrism.xy;
  float c = cos(uPrism.z), s = sin(uPrism.z);
  vec2 q = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
  vec2 hb = uPrismHalf;
  float inside = step(abs(q.x), hb.x) * step(abs(q.y), hb.y);
  return inside * (q.x + hb.x) / (2.0 * hb.x) * hb.x * 0.55;
}
float lensH(vec2 p) {
  float r = uLens.z;
  if (r < 1.0) return 0.0;
  float d = length(p - uLens.xy) / r;
  return d < 1.0 ? r * 0.42 * (sqrt(1.0 - d * d * 0.86) - sqrt(0.14)) / (1.0 - sqrt(0.14)) : 0.0;
}
float glass(vec2 p) { return rodH(p) + prismH(p) + lensH(p); }

vec3 paper(vec2 p) { return texture2D(uPoster, vec2(p.x / uRes.x, 1.0 - p.y / uRes.y)).rgb; }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float e = 1.5;
  float h = glass(p);
  vec2 g = vec2(glass(p + vec2(e, 0.0)) - glass(p - vec2(e, 0.0)), glass(p + vec2(0.0, e)) - glass(p - vec2(0.0, e))) / (2.0 * e);
  /* refraction: look through the glass along its slope; red, green and blue bend by different amounts */
  vec2 off = -g * uS * 0.11;
  vec3 col;
  col.r = paper(p + off * 0.955).r;
  col.g = paper(p + off).g;
  col.b = paper(p + off * 1.05).b;
  /* light arriving at the paper: shadowed and focused by the glass a little up and to the left of it */
  vec2 lp = p - vec2(0.018, 0.026) * uS;
  float hc = glass(lp);
  float lap = glass(lp + vec2(3.0, 0.0)) + glass(lp - vec2(3.0, 0.0)) + glass(lp + vec2(0.0, 3.0)) + glass(lp - vec2(0.0, 3.0)) - 4.0 * hc;
  vec2 gl = vec2(glass(lp + vec2(e, 0.0)) - glass(lp - vec2(e, 0.0)), glass(lp + vec2(0.0, e)) - glass(lp - vec2(0.0, e))) / (2.0 * e);
  /* light leaves the steep rims (thin shadow lines) and gathers where the glass is convex (caustics) */
  float steep = smoothstep(1.4, 4.5, length(gl));
  float inGlass = step(0.001, hc);
  float caustic = clamp(-lap * 2.6, -1.0, 2.2) * inGlass;
  float focus = pow(max(caustic, 0.0), 1.7) * 0.75 + max(caustic, 0.0) * 0.18;
  float light = uAmbient * (1.0 - 0.6 * steep * inGlass) + uCaustic * focus * (0.35 + 0.65 * (1.0 - uAmbient)) - 0.3 * max(-caustic, 0.0);
  light += (1.0 - uAmbient) * 0.05;
  col *= max(light, 0.0);
  /* the glass itself: a faint green-grey body where it is thick, rims bright on the lit side */
  if (h > 0.0) {
    float th = clamp(h / (uS * 0.07), 0.0, 1.0);
    col *= mix(vec3(1.0), vec3(0.95, 0.975, 0.965), th);
    float slope = length(g);
    float rim = smoothstep(1.2, 5.0, slope);
    vec2 n2 = g / max(slope, 1e-4);
    float lit = clamp(dot(-n2, normalize(vec2(-0.6, -0.8))), 0.0, 1.0);
    col += vec3(1.0, 0.99, 0.96) * rim * (0.05 + 0.6 * lit * lit) * (0.4 + 0.6 * uAmbient);
    col *= 1.0 - rim * (1.0 - lit) * 0.35;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

  /* ---------- the score ---------- */
  const T = {
    rodX: track([[0, -0.15], [2.4, -0.15], [5.1, 0.32, E.outCubic], [9.2, 0.35, E.inOutSine], [12.8, 0.39, E.inOutSine], [15.4, 1.18, E.inCubic]]),
    rodXP: track([[0, -0.95], [2.4, -0.95], [5.1, 0.28, E.outCubic], [9.2, 0.31, E.inOutSine], [12.8, 0.36, E.inOutSine], [15.4, 1.7, E.inCubic]]),
    rodTilt: track([[0, 0], [5.0, 0], [8.2, 0.13, E.inOutSine], [12.6, 0.05, E.inOutSine], [15.2, 0]]),
    prismY: track([[0, -0.7], [5.2, -0.7], [8.2, 0.36, E.outBack], [12.8, 0.4, E.inOutSine], [15.6, -0.7, E.inCubic]]),
    prismRot: track([[0, 0.32], [8.2, 0.42], [12.8, 0.55, E.inOutSine], [15.6, 0.32]]),
    lensY: track([[0, 1.45], [8.4, 1.45], [10.7, 0.56, E.outCubic], [13.2, 0.5, E.inOutSine], [15.4, 1.45, E.inCubic]]),
    ambient: track([[0, 1], [9.4, 1], [11.0, 0.16, E.inOutSine], [12.9, 0.16], [14.6, 1, E.inOutSine]]),
    caustic: track([[0, 0.35], [9.4, 0.35], [11.0, 1.2, E.inOutSine], [12.9, 1.2], [14.6, 0.35, E.inOutSine]]),
  };

  function render(t) {
    if (!G) return;
    const { gl, u } = G;
    const d = cv.dpr;
    if (!portrait) {
      gl.uniform4f(u('uRod'), T.rodX(t) * W * d, H * 0.48 * d, S * 0.085 * d, T.rodTilt(t));
      gl.uniform1f(u('uRodLen'), H * 0.44 * d);
      gl.uniform4f(u('uPrism'), W * 0.76 * d, T.prismY(t) * H * d, T.prismRot(t), S * 0.13 * d);
      gl.uniform2f(u('uPrismHalf'), S * 0.13 * d, S * 0.3 * d);
      gl.uniform3f(u('uLens'), W * 0.5 * d, T.lensY(t) * H * d, S * 0.28 * d);
    } else {
      gl.uniform4f(u('uRod'), T.rodXP(t) * W * d, H * 0.3 * d, S * 0.13 * d, T.rodTilt(t) + 1.25);
      gl.uniform1f(u('uRodLen'), W * 0.6 * d);
      gl.uniform4f(u('uPrism'), W * 0.62 * d, (T.prismY(t) * 0.9 + 0.3) * H * d, T.prismRot(t), S * 0.2 * d);
      gl.uniform2f(u('uPrismHalf'), S * 0.2 * d, S * 0.42 * d);
      gl.uniform3f(u('uLens'), W * 0.5 * d, (T.lensY(t) * 0.9 + 0.12) * H * d, S * 0.42 * d);
    }
    gl.uniform1f(u('uAmbient'), T.ambient(t));
    gl.uniform1f(u('uCaustic'), T.caustic(t));
    G.draw();
  }

  function resize(w, h, dpr) {
    W = w; H = h; S = Math.min(w, h);
    portrait = w / h < 0.9;
    cv.resize(w, h, dpr);
    if (!G) return;
    const { gl, u } = G;
    G.viewport();
    gl.uniform2f(u('uRes'), cv.canvas.width, cv.canvas.height);
    gl.uniform1f(u('uS'), S * cv.dpr);
    G.texture(0, poster(), 'uPoster');
  }

  Motion.player({
    number: '11',
    title: 'Light Through Glass',
    subtitle: 'An Optical Poem',
    duration: D,
    poster: 11.8,
    stage,
    description: [
      'A quiet printed poster: three words, a block of ruled lines, a black disc, one field of cobalt. Then glass is laid on it, and the glass begins to re-design the page.',
      'A rod of glass slides in from the left and settles on the headline: inside it the letters are squeezed and flipped, bright on its lit edge, dark on the other. A prism drops onto the ruled block and shifts it, splitting the edge of the disc and the blue into thin spectra. A round lens rises from below.',
      'Then the room darkens. The print almost disappears, and what remains is the light the glass has gathered — bright lines where the rod and the lens focus it, dark ones where their slopes turn it away. For a few seconds the poster is made only of light and the space around it. The glass leaves, and the page comes back, unchanged.',
      'All of it — refraction, dispersion, rims, shadows, caustics — is derived from three thickness fields; no image is warped by hand.',
    ],
    init: async () => {
      await Motion.fonts([['700 100px "Inter Tight"', 'Light bends here.'], ['500 20px "Noto Serif TC"', '光在這裡轉彎'], ['500 12px "Inter Tight"', 'No.']]);
      G = Motion.glProgram(cv.canvas, FS, { onLost: () => { document.getElementById('fallback').hidden = false; } });
      if (!G) document.getElementById('fallback').hidden = false;
    },
    resize,
    render,
  });
})();
