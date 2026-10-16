/* 04 — Moiré Kinetics
 * Two transmission gratings of light, multiplied. Nothing in the image is drawn as a wave:
 * every band, fringe and ripple is the interference of two very fine, perfectly regular structures.
 *
 * Each grating is one family of curves that can morph continuously:
 *   straight lines  →  concentric circles (a centre arriving from infinity)  →  a zone plate (r²)
 * Stripes are box-filtered analytically over each pixel's footprint, so the moiré you see is the real
 * one, not aliasing produced by the screen.
 */
(() => {
  const { ease: E, track, seg, clamp, lerp } = Motion;
  const D = 32;
  const DEG = Math.PI / 180;
  const LOGD = Math.log(1 + 1e5);

  const stage = document.getElementById('stage');
  const readout = document.getElementById('readout');
  const cv = Motion.canvas(stage, { webgl: true, dprCap: 2 });
  const overlay = Motion.canvas(stage, { alpha: true, dprCap: 2 });
  overlay.canvas.classList.add('overlay');
  const octx = overlay.ctx;
  const gl = cv.canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: /[?&]grab/.test(location.search) });

  const VS = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
  const FS = `
precision highp float;
uniform vec2 uRes;      // device px
uniform float uDpr;
uniform float uLambda;  // css px
uniform float uRz;      // zone plate radius, css px
uniform vec4 uA;        // p0.x, p0.y, angle, d     (css px from centre)
uniform vec4 uB;
uniform vec2 uKz;       // zone mix for A, B
uniform vec2 uPhi;      // phase offset in cycles
uniform vec3 uBg;
uniform vec3 uFg;
uniform vec3 uAp;       // aperture centre (css px from screen centre) and radius
const float DUTY = 0.56;

/* antiderivative of a square wave with the given duty: makes box filtering exact */
float F(float x) { return floor(x) * DUTY + min(fract(x), DUTY); }

float grating(vec2 p, vec4 g, float kz, float phi) {
  vec2 q = p - g.xy;
  vec2 n = vec2(cos(g.z), sin(g.z));
  float d = g.w;
  float u = dot(q, n);
  vec2 m = q + n * d;
  float lm = length(m);
  /* distance to a circle whose centre sits d px behind p0, minus d: equals u when d → ∞ (stable form) */
  float circ = (dot(q, q) + 2.0 * d * u) / (lm + d);
  vec2 gCirc = lm > 1e-4 ? m / lm : n;
  float zone = dot(q, q) / (2.0 * uRz);
  vec2 gZone = q / uRz;
  float ph = mix(circ, zone, kz) / uLambda + phi;
  vec2 gr = mix(gCirc, gZone, kz) / uLambda;
  float w = (abs(gr.x) + abs(gr.y)) / uDpr;    // footprint of one device pixel, in cycles
  w = max(w, 1e-4);
  if (w > 1.0) return DUTY;                      // finer than a pixel: only the mean survives
  return (F(ph + 0.5 * w) - F(ph - 0.5 * w)) / w;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uDpr;
  p.y = -p.y;
  p -= uAp.xy;
  /* the plate: a circular aperture with an antialiased edge */
  float edge = clamp((uAp.z - length(p)) * uDpr + 0.5, 0.0, 1.0);
  if (edge <= 0.0) { gl_FragColor = vec4(uBg, 1.0); return; }
  float ta = grating(p, uA, uKz.x, uPhi.x);
  float tb = grating(p, uB, uKz.y, uPhi.y);
  float v = ta * tb / DUTY;
  vec3 c = mix(uBg, uFg, clamp(v, 0.0, 1.0) * edge);
  gl_FragColor = vec4(c, 1.0);
}`;

  let prog = null, U = {};
  function compile() {
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uRes', 'uDpr', 'uLambda', 'uRz', 'uA', 'uB', 'uKz', 'uPhi', 'uBg', 'uFg', 'uAp']) U[n] = gl.getUniformLocation(prog, n);
    gl.uniform3f(U.uBg, 13 / 255, 14 / 255, 16 / 255);
    gl.uniform3f(U.uFg, 232 / 255, 226 / 255, 210 / 255);
  }

  /* ---------- the score ---------- */
  const T = {
    dAlpha: track([[0, 0], [3, 0], [7.4, 3.2, E.inOutSine], [10, 1.2, E.inOutSine], [12.6, 0.6], [27.6, 0.6], [31.2, 0, E.inOutCubic]]),
    phiB: track([[0, 0], [3, 0], [10, 1.5, E.inOutSine], [27.6, 1.5], [31.4, 2, E.inOutCubic]]),
    logd: track([[0, LOGD], [10, LOGD], [13.4, 0, E.inOutCubic], [28.4, 0], [31.3, LOGD, E.inOutCubic]]),
    sep: track([[0, 0], [10, 0], [13.4, 0.22, E.inOutCubic], [16.6, 0.085, E.inOutSine], [19.6, 0.3, E.inOutSine], [21.6, 0.16, E.inOutSine],
                [24.6, 0.055, E.inOutSine], [27.4, 0.13, E.inOutSine], [29, 0.1], [31.3, 0, E.inOutCubic]]),
    rot: track([[0, 0], [10, 0], [20, -35, E.inOutSine], [28, 48, E.inOutSine], [32, 90]]),
    kz: track([[0, 0], [20, 0], [23.2, 1, E.inOutCubic], [27.8, 1], [29.6, 0, E.inOutCubic]]),
  };
  const ALPHA = 78 * DEG;

  const STRUCT = [[0, 'I', 'Linear × linear', 'rotation'], [10.6, 'II', 'Concentric × concentric', 'two centres'],
                  [20.6, 'III', 'Zone plate × zone plate', 'offset'], [28.6, '—', 'Linear × linear', 'return']];

  let W = 0, H = 0, S = 1, lambda = 5, AP = { x: 0, y: 0, r: 100 }, landscape = true;

  function params(t) {
    const sep = T.sep(t) * S, rot = T.rot(t) * DEG;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const off = -0.06 * S * T.sep(t) / 0.3;   // a slight vertical stagger between the two centres
    const A = { x: -cr * sep / 2 - sr * off, y: -sr * sep / 2 + cr * off };
    const B = { x: cr * sep / 2 + sr * off, y: sr * sep / 2 - cr * off };
    const d = Math.exp(T.logd(t)) - 1;
    return { A, B, d, aA: ALPHA, aB: ALPHA + T.dAlpha(t) * DEG, kz: T.kz(t), phiB: T.phiB(t), sep };
  }

  function render(t) {
    if (!prog) return;
    const P = params(t);
    gl.uniform4f(U.uA, P.A.x, P.A.y, P.aA, P.d);
    gl.uniform4f(U.uB, P.B.x, P.B.y, P.aB, P.d);
    gl.uniform2f(U.uKz, P.kz, P.kz);
    gl.uniform2f(U.uPhi, 0, P.phiB);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    drawOverlay(t, P);
  }

  /* the instrument: a graduated dial around the plate, two pointers for the two gratings,
   * reticles on the centres once they are on the plate, and a caption that reports its state */
  let lastText = '';
  function drawOverlay(t, P) {
    const o = octx;
    o.setTransform(overlay.dpr, 0, 0, overlay.dpr, 0, 0);
    o.clearRect(0, 0, W, H);
    const cx = W / 2 + AP.x, cy = H / 2 + AP.y, R = AP.r;
    o.strokeStyle = 'rgba(232,226,210,.55)';
    o.lineWidth = 1;
    o.beginPath();
    o.arc(cx, cy, R + 9, 0, Math.PI * 2);
    o.stroke();
    o.beginPath();
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const l = i % 15 === 0 ? 12 : i % 5 === 0 ? 7 : 4;
      const c = Math.cos(a), s = Math.sin(a);
      o.moveTo(cx + c * (R + 13), cy + s * (R + 13));
      o.lineTo(cx + c * (R + 13 + l), cy + s * (R + 13 + l));
    }
    o.strokeStyle = 'rgba(232,226,210,.32)';
    o.stroke();
    /* pointers: direction of each grating's lines (or of each centre, once they are circles) */
    const ptr = (a, len, col) => {
      const c = Math.cos(a), s = Math.sin(a);
      o.beginPath();
      o.moveTo(cx + c * (R + 13), cy + s * (R + 13));
      o.lineTo(cx + c * (R + 13 + len), cy + s * (R + 13 + len));
      o.strokeStyle = col; o.lineWidth = 1.5; o.stroke();
      o.beginPath();
      o.arc(cx + c * (R + 17 + len), cy + s * (R + 17 + len), 2.2, 0, Math.PI * 2);
      o.fillStyle = col; o.fill();
    };
    const circ = clamp(1 - T.logd(t) / LOGD);
    const rot = T.rot(t) * DEG;
    const aA = lerp(P.aA - Math.PI / 2, rot + Math.PI, E.inOutCubic(circ));
    const aB = lerp(P.aB - Math.PI / 2, rot, E.inOutCubic(circ));
    ptr(aA, 22, '#e8e2d2');
    ptr(aB, 34, '#e8e2d2');
    o.lineWidth = 1;
    const vis = clamp(1 - T.logd(t) / 3.2) * (1 - E.inOutCubic(seg(t, 28.4, 29.6)));
    if (vis > 0) {
      o.strokeStyle = `rgba(13,14,16,${0.9 * vis})`;
      o.lineWidth = 3;
      const ret = () => {
        for (const c of [P.A, P.B]) {
          const x = cx + c.x, y = cy + c.y;
          o.beginPath();
          o.arc(x, y, 9, 0, Math.PI * 2);
          o.moveTo(x - 22, y); o.lineTo(x - 13, y); o.moveTo(x + 13, y); o.lineTo(x + 22, y);
          o.moveTo(x, y - 22); o.lineTo(x, y - 13); o.moveTo(x, y + 13); o.lineTo(x, y + 22);
          o.stroke();
        }
      };
      ret();
      o.strokeStyle = `rgba(232,226,210,${vis})`;
      o.lineWidth = 1;
      ret();
    }
    let cur = 0;
    STRUCT.forEach((s, i) => { if (t >= s[0]) cur = i; });
    const da = (P.aB - P.aA) / DEG;
    const rows = STRUCT.slice(0, 3).map((s, i) =>
      `<li class="${i === cur || (cur === 3 && i === 0) ? 'on' : ''}"><b>${s[1]}</b>${s[2]}<em>${s[3]}</em></li>`).join('');
    const text = `<p class="k">Plate 04 — two gratings, <i>λ</i> ${lambda.toFixed(1)} px</p><ol>${rows}</ol>` +
      `<dl><dt>Δθ</dt><dd>${da.toFixed(2)}°</dd><dt>sep</dt><dd>${P.sep.toFixed(1)} px</dd>` +
      `<dt>d</dt><dd>${P.d > 9e4 ? '∞' : P.d.toFixed(0) + ' px'}</dd><dt>r²</dt><dd>${P.kz.toFixed(2)}</dd></dl>`;
    if (text !== lastText) { readout.innerHTML = text; lastText = text; }
  }

  function resize(w, h, dpr) {
    W = w; H = h;
    cv.resize(w, h, dpr);
    overlay.resize(w, h, dpr);
    S = Math.min(w, h);
    landscape = w / h > 1.25;
    /* the plate sits left of centre on wide screens, with its caption beside it; above it on tall ones */
    if (landscape) AP = { x: -w * 0.1, y: -h * 0.01, r: Math.min(h * 0.38, w * 0.3) };
    else AP = { x: 0, y: -h * 0.09, r: Math.min(w * 0.36, h * 0.3) };
    S = AP.r * 2.4;
    lambda = clamp(AP.r / 64, 3.4, 5.6);
    readout.className = 'readout ' + (landscape ? 'side' : 'below');
    if (landscape) { readout.style.left = (w / 2 + AP.x + AP.r + Math.max(70, w * 0.06)) + 'px'; readout.style.top = (h / 2 + AP.y - 60) + 'px'; }
    else { readout.style.left = (w / 2 - AP.r) + 'px'; readout.style.top = (h / 2 + AP.y + AP.r + 46) + 'px'; readout.style.width = (AP.r * 2) + 'px'; }
    if (!prog) return;
    gl.viewport(0, 0, cv.canvas.width, cv.canvas.height);
    gl.uniform2f(U.uRes, cv.canvas.width, cv.canvas.height);
    gl.uniform1f(U.uDpr, cv.dpr);
    gl.uniform1f(U.uLambda, lambda);
    gl.uniform1f(U.uRz, S * 0.42);
    gl.uniform3f(U.uAp, AP.x, AP.y, AP.r);
  }

  Motion.player({
    number: '04',
    title: 'Moiré Kinetics',
    subtitle: 'The Geometry of Optical Interference',
    duration: D,
    poster: 17.5,
    stage,
    description: [
      'Two perfectly regular gratings of light lie one over the other; where both are open, light passes. Nothing in the image is drawn as a wave or a curve. Every band and fringe you see is the interference between two structures far finer than the patterns they produce.',
      'Structure I: two sets of straight lines, rotated against each other by less than four degrees. Broad bands appear at right angles to the motion and swing as the angle changes.',
      'Structure II: each grating bends into concentric circles as its centre arrives from infinity. Two centres a few centimetres apart produce families of curved fringes that turn as the centres orbit.',
      'Structure III: the circles tighten into zone plates, whose rings grow closer as they move outward. Two offset zone plates interfere in perfectly straight fringes — the most ordered image in the piece comes from its most complex structures.',
      'Each stripe is box-filtered analytically over the footprint of a single device pixel, so the patterns are the real optical moiré and not artefacts of the screen.',
    ],
    init: async () => {
      await Motion.fonts([['500 10px "Inter Tight"', 'LINEAR']]);
      if (!gl) { document.getElementById('fallback').hidden = false; return; }
      try { compile(); } catch (e) { console.error(e); document.getElementById('fallback').hidden = false; }
    },
    resize,
    render,
  });
})();
