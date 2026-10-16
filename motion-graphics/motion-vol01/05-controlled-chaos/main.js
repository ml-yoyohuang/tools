/* 05 — Controlled Chaos
 * A deterministic system with five phases. Nothing is random at playback: the disturbance is a wave
 * front plus a curl-noise field (divergence-free, so the dots swirl instead of clumping), and the new
 * order is Vogel's phyllotaxis — the sunflower — reached by an equal-area mapping from the grid,
 * so each dot only needs to turn, not travel far.
 */
(() => {
  const { ease: E, track, seg, clamp, lerp, smooth, noise3, TAU } = Motion;
  const D = 24;
  const BLUE = '#1E2EA6', CREAM = '#F0ECE2', YELLOW = '#F2C230';
  const GOLD = Math.PI * (3 - Math.sqrt(5));

  const stage = document.getElementById('stage');
  const cv = Motion.canvas(stage);
  const ctx = cv.ctx;

  let W = 0, H = 0, g = 30, r0 = 4, O = { x: 0, y: 0 }, maxD = 1, dots = [], order = [];

  const PHASES = [[0, 'I', 'Perfect order'], [3.5, 'II', 'Disturbance'], [7, 'III', 'Propagation'],
                  [11, 'IV', 'Emergence'], [16, 'V', 'Return']];

  /* amplitude of the disturbance, in grid units */
  const AMP = track([[0, 0], [3.5, 0], [4.4, 0.16, E.outCubic], [7, 0.34], [10.2, 0.85, E.inOutSine], [12, 0.8], [14.6, 0, E.inOutCubic]]);
  const SPIN = track([[0, 0], [13, 0], [16.4, 0.16, E.inOutSine]]); // the spiral turns while it holds

  function build() {
    const portrait = W / H < 0.85;
    g = Math.min(W, H) / (portrait ? 15 : 27);
    r0 = g * 0.15;
    const cols = Math.floor((W - g * 1.2) / g), rows = Math.floor((H - g * 1.2) / g);
    const ox = (W - (cols - 1) * g) / 2, oy = (H - (rows - 1) * g) / 2;
    /* the disturbance starts at the grid point nearest the golden section */
    const ci = Math.round(cols * (portrait ? 0.5 : 0.618)), ri = Math.round(rows * (portrait ? 0.47 : 0.42));
    O = { x: ox + ci * g, y: oy + ri * g };
    dots = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = ox + i * g, y = oy + j * g;
      const dx = x - O.x, dy = y - O.y;
      const d = Math.hypot(dx, dy);
      dots.push({ x, y, d, ux: d ? dx / d : 0, uy: d ? dy / d : 0, k: 0, sx: 0, sy: 0, sr: r0, arm: false, origin: i === ci && j === ri });
    }
    maxD = Math.max(...dots.map((p) => p.d));
    /* equal-area mapping: rank by distance from the origin → index on the spiral */
    const byD = dots.slice().sort((a, b) => a.d - b.d || Math.atan2(a.uy, a.ux) - Math.atan2(b.uy, b.ux));
    const c = g / Math.sqrt(Math.PI);
    const N = byD.length;
    byD.forEach((p, k) => {
      p.k = k;
      p.sa = k * GOLD;
      p.sd = c * Math.sqrt(k + 0.5);
      p.sr = r0 * (1.75 - 1.05 * Math.sqrt(k / N));
      p.arm = k % 21 === 0 || k % 34 === 0; /* two Fibonacci parastichies, revealed only in the spiral */
    });
    orderCurve();
  }

  /* position of one dot at time t — a pure function, so scrubbing is exact */
  function place(p, t, out) {
    const amp = AMP(t) * g;
    /* the front: a wave that leaves the origin at 3.5 s and reaches the far corner at 10.5 s */
    const front = t > 3.5 ? maxD * Math.pow(seg(t, 3.5, 10.5), 1.35) + g * 0.5 : -1;
    const act = clamp((front - p.d) / (g * 4));
    let x = p.x, y = p.y, r = r0, hot = 0;
    if (act > 0 && amp > 0) {
      const a = amp * smooth(act);
      /* ripple along the radius, travelling outward */
      const rip = Math.sin(p.d / (g * 2.1) - (t - 3.5) * 4.6) * a * 0.85;
      /* curl noise: swirls without sinks or sources */
      const f = 1 / (g * 9), z = t * 0.18, e = 0.35;
      const n0 = noise3(p.x * f, p.y * f, z);
      const nx = noise3(p.x * f + e, p.y * f, z), ny = noise3(p.x * f, p.y * f + e, z);
      const cx = (ny - n0) / e, cy = -(nx - n0) / e;
      x += p.ux * rip + cx * a * 1.1;
      y += p.uy * rip + cy * a * 1.1;
      r = r0 * (1 + 0.45 * (a / g));
      /* the front itself is marked: dots glow yellow for a moment as it passes */
      hot = Math.max(0, 1 - Math.abs(front - p.d) / (g * 2.2)) * clamp(seg(t, 3.5, 4.2)) * (1 - seg(t, 9.6, 10.6));
    }
    if (p.origin) hot = Math.max(hot, clamp(seg(t, 2.6, 3.2)) * (1 - seg(t, 11, 12.5)));
    /* emergence: inner dots find the spiral first */
    const lag = (p.d / maxD) * 1.9;
    const em = E.inOutCubic(seg(t, 10.6 + lag, 13.4 + lag));
    const ret = E.spring(seg(t, 16 + (p.x / W) * 3.4, 17.7 + (p.x / W) * 3.4), 0.5, 11);
    if (em > 0) {
      const a = p.sa + SPIN(t) * TAU;
      const sx = O.x + Math.cos(a) * p.sd, sy = O.y + Math.sin(a) * p.sd;
      x = lerp(x, sx, em); y = lerp(y, sy, em); r = lerp(r, p.sr, em);
      if (ret > 0) {
        /* the return is a scan: left to right, each dot lifted back into its cell */
        const wob = Math.sin(clamp(ret) * Math.PI) * g * 0.22;
        x = lerp(sx, p.x, ret) + wob * p.uy; y = lerp(sy, p.y, ret) - wob * p.ux; r = lerp(p.sr, r0, clamp(ret));
      }
    }
    const arm = p.arm ? em * (1 - clamp(ret * 1.4)) : 0;
    /* anticipation: the origin dot draws a breath before anything happens */
    if (p.origin) r *= 1 + Math.sin(seg(t, 2.6, 3.6) * Math.PI) * 0.7;
    out.x = x; out.y = y; out.r = r; out.hot = Math.max(hot, arm);
    return out;
  }

  /* the order parameter (mean displacement from the grid), sampled once per layout */
  function orderCurve() {
    order = [];
    const tmp = {};
    const step = Math.max(1, Math.floor(dots.length / 260));
    for (let s = 0; s <= 160; s++) {
      const t = (s / 160) * D;
      let sum = 0, n = 0;
      for (let i = 0; i < dots.length; i += step) { place(dots[i], t, tmp); sum += Math.hypot(tmp.x - dots[i].x, tmp.y - dots[i].y); n++; }
      order.push(sum / n / g);
    }
  }

  const tmp = {};
  function render(t) {
    ctx.fillStyle = BLUE;
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    const hotList = [];
    for (const p of dots) {
      place(p, t, tmp);
      if (tmp.hot > 0.5) { hotList.push(tmp.x, tmp.y, tmp.r * (1 + tmp.hot * 0.25)); continue; }
      ctx.moveTo(tmp.x + tmp.r, tmp.y);
      ctx.arc(tmp.x, tmp.y, tmp.r, 0, TAU);
    }
    ctx.fillStyle = CREAM;
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < hotList.length; i += 3) { ctx.moveTo(hotList[i] + hotList[i + 2], hotList[i + 1]); ctx.arc(hotList[i], hotList[i + 1], hotList[i + 2], 0, TAU); }
    ctx.fillStyle = YELLOW;
    ctx.fill();
    legend(t);
  }

  /* a small plate in the corner: phase, and the order parameter drawn as a line over the whole loop */
  function legend(t) {
    const m = Math.max(9.5, Math.min(W, H) * 0.012);
    const w = m * 15, h = m * 3.4;
    const x = W - w - Math.max(22, W * 0.03), y = Math.max(20, H * 0.03);
    ctx.save();
    ctx.fillStyle = BLUE;
    ctx.fillRect(x - m, y - m * 0.8, w + m * 2, h + m * 4.6);
    let ph = PHASES[0];
    for (const p of PHASES) if (t >= p[0]) ph = p;
    ctx.fillStyle = CREAM;
    ctx.font = `600 ${m}px "Inter Tight", "Helvetica Neue", Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(`PHASE ${ph[1]} — ${ph[2].toUpperCase()}`, x, y);
    ctx.font = `400 ${m * 0.92}px "Inter Tight", "Helvetica Neue", Arial, sans-serif`;
    ctx.globalAlpha = 0.6;
    ctx.fillText('mean displacement from the grid', x, y + m * 1.5);
    ctx.globalAlpha = 1;
    const gy = y + m * 3.4, gh = h;
    const mx = Math.max(...order, 0.01);
    ctx.strokeStyle = 'rgba(240,236,226,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, gy + gh + 0.5); ctx.lineTo(x + w, gy + gh + 0.5);
    ctx.stroke();
    ctx.beginPath();
    order.forEach((v, i) => { const px = x + (i / (order.length - 1)) * w, py = gy + gh - (v / mx) * gh; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.strokeStyle = CREAM;
    ctx.stroke();
    const k = t / D, ci = Math.min(order.length - 1, Math.round(k * (order.length - 1)));
    const px = x + k * w, py = gy + gh - (order[ci] / mx) * gh;
    ctx.fillStyle = YELLOW;
    ctx.beginPath(); ctx.arc(px, py, m * 0.32, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function resize(w, h, dpr) {
    W = w; H = h;
    cv.resize(w, h, dpr);
    build();
  }

  Motion.player({
    number: '05',
    title: 'Controlled Chaos',
    subtitle: 'The Emergence of Order',
    duration: D,
    poster: 14.8,
    stage,
    description: [
      'A perfectly regular grid, and one point — the golden section of the page — where an error begins. The error is not random: it is a wave front that leaves that point and crosses the field in seven seconds, and behind it a curl-noise field, divergence-free, so the dots swirl around each other instead of collapsing into clumps.',
      'At the height of the turbulence a new order takes over. Every dot is ranked by its distance from the origin and handed the matching seat on Vogel’s sunflower spiral, an equal-area mapping, so no dot travels far — each one only has to turn. Two Fibonacci spiral arms, 21 and 34, light up only in this state.',
      'Then the system is restored, not by reversing the film but by a different procedure: a scan from left to right that lifts each dot back into its cell.',
      'The small plate in the corner draws the order parameter — mean distance from the grid — across the whole loop, with the present moment marked on it.',
    ],
    init: () => Motion.fonts([['600 12px "Inter Tight"', 'PHASE'], ['400 12px "Inter Tight"', 'mean']]),
    resize,
    render,
  });
})();
