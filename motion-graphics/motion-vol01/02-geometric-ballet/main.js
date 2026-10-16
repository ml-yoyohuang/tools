/* 02 — Geometric Ballet
 * Four characters, one rule each:
 *   circle — fluid, never stops abruptly       rectangle — decisive, falls and stays
 *   line   — reaches across, carries vibration  arc — orbits, finds its place
 * Every movement is caused by a previous one. The choreography lives on a 1000-unit artboard.
 */
(() => {
  const { ease: E, track, seg, clamp, lerp, TAU } = Motion;
  const D = 20;
  const GROUND = '#1B3530', EARTH = '#142925', CREAM = '#EEE6D2', PERSIMMON = '#E0673A', BLUE = '#9DBDC9';
  const DEG = Math.PI / 180;

  const stage = document.getElementById('stage');
  const cv = Motion.canvas(stage);
  const ctx = cv.ctx;
  let W = 0, H = 0, k = 1, ox = 0, oy = 0;

  /* ---------- cast ---------- */
  const C = { x: 500, y: 400 };      // the disc's centre
  const R = 190;                      // disc radius
  const HZ = 700;                     // horizon
  const SLAB = { w: 150, h: 230 };
  const CUT = -20 * DEG;              // the angle of the first cut
  const N = { x: -Math.sin(CUT), y: Math.cos(CUT) }; // normal of the cut (points down-right)
  const RING = 270, ARC0 = -150 * DEG, ARC_SHORT = 64 * DEG, ARC_FULL = 90 * DEG;
  const TRI = { x: 500, y: 338, r: 126 };
  const KR = 62;                      // the notched discs
  const OPEN = 150;                   // how far the halves part

  /* impacts on the horizon: [time, x, amplitude] — every landing makes the ground ring */
  const HITS = [[9.05, 500, 13], [8.12, 200, 5], [8.42, 800, 5], [11.62, 500, 4], [16.55, 500, 3.5], [17.55, 500, 6]];
  /* plucks of the line: [time, amplitude] */
  const PLUCKS = [[2.75, 9], [9.05, 6], [11.25, 11], [18.7, 5]];

  /* ---------- states ---------- */
  const halves = (t) => {
    /* opening along the cut's normal: a breath in, then release */
    const breathe = -Math.sin(seg(t, 3.45, 3.9) * Math.PI) * 5;
    const open = t < 6 ? breathe + E.outBack(seg(t, 3.85, 5.0), 1.1) * OPEN : OPEN;
    const aU = Math.atan2(-N.y, -N.x), aL = Math.atan2(N.y, N.x);
    let U = { x: C.x - N.x * open, y: C.y - N.y * open, a: aU };
    let L = { x: C.x + N.x * open, y: C.y + N.y * open, a: aL };
    /* to the horizon: each half rolls on its own curve and becomes a dome */
    const domeU = { x: 200, y: HZ, a: -90 * DEG }, domeL = { x: 800, y: HZ, a: -90 * DEG };
    const go = (p, d, t0, t1, tBack0, tBack1) => {
      const f = seg(t, t0, t1), b = seg(t, tBack0, tBack1);
      const fx = E.inOutSine(f), fy = E.inOutCubic(f), fa = E.outBack(f, 1.25);
      let x = lerp(p.x, d.x, fx), y = lerp(p.y, d.y, fy), a = lerp(p.a, d.a, fa);
      /* return trip: rise in a slower, higher curve */
      if (b > 0) {
        const bx = E.inOutCubic(b), by = E.inOutSine(b), ba = E.inOutQuart(b);
        x = lerp(d.x, p.x, bx); y = lerp(d.y, p.y, by) - Math.sin(b * Math.PI) * 70; a = lerp(d.a, p.a, ba);
      }
      return { x, y, a };
    };
    U = go(U, domeU, 6.2, 8.12, 16.35, 17.9);
    L = go(L, domeL, 6.45, 8.42, 16.15, 17.9);
    /* the seal: halves glide back together along the normal */
    const seal = E.inOutQuint(seg(t, 18.0, 18.75));
    if (seal > 0) {
      const o = OPEN * (1 - seal);
      U = { x: C.x - N.x * o, y: C.y - N.y * o, a: aU };
      L = { x: C.x + N.x * o, y: C.y + N.y * o, a: aL };
    }
    const whole = t < 3.45 || t >= 18.75;
    return { U, L, whole };
  };

  const slab = (t) => {
    const rest = HZ - SLAB.h / 2;
    let y = C.y;
    /* it hovers, exposed, until both halves have rolled away — then falls, and its landing starts act two */
    y += Math.sin(seg(t, 5.0, 8.5) * Math.PI) * -4;
    const fall = seg(t, 8.55, 9.05);
    if (fall > 0) y = lerp(C.y, rest, E.inQuad(fall));
    const bounce = seg(t, 9.05, 9.37);
    if (bounce > 0 && bounce < 1) y = rest - Math.sin(bounce * Math.PI) * 7 * (1 - bounce * 0.3);
    /* lifted back to the centre, before the halves return to cover it */
    const lift = seg(t, 16.55, 17.55);
    if (lift > 0) y = lerp(rest, C.y, E.inOutQuart(lift));
    /* tiny anticipation: settles 6 units before it rises */
    y += Math.sin(seg(t, 16.25, 16.55) * Math.PI) * 6;
    return { x: C.x, y };
  };

  const line = (t) => {
    /* drawn in from the left, rotates to vertical, rotates back, withdrawn to the right */
    const head = E.outExpo(seg(t, 2.0, 2.75));
    const tail = E.inExpo(seg(t, 18.75, 19.45));
    const ang = track([[0, CUT], [6.6, CUT], [8.4, -90 * DEG, E.inOutQuint], [16.0, -90 * DEG], [17.75, CUT, E.inOutQuint]])(t);
    let vib = 0;
    for (const [t0, a] of PLUCKS) { const d = t - t0; if (d > 0 && d < 1.6) vib += a * Math.exp(-d * 4.2) * Math.sin(d * 34); }
    return { head, tail, ang, vib };
  };

  /* arcs: [angle, length] for each of the four */
  const arcs = (t) => {
    const out = [];
    const turns = [1, 2, 1, 0];
    const drift = seg(t, 0, 3.8) * 3 * DEG;
    for (let i = 0; i < 4; i++) {
      const fan = E.outQuint(seg(t, 3.95 + i * 0.09, 5.25 + i * 0.09));
      let a = ARC0 + drift + fan * (i * 90 * DEG - drift);
      let len = ARC_SHORT;
      /* the chase: each orbits a different number of turns and arrives at its own moment */
      const end = 10.15 + i * 0.16;
      const orb = E.inOutCubic(seg(t, 9.15 + i * 0.05, end));
      const fanned = ARC0 + i * 90 * DEG;
      const locked = -135 * DEG + i * 90 * DEG + turns[i] * TAU;
      if (orb > 0) a = lerp(fanned, locked, orb);
      const click = E.outBack(seg(t, end, end + 0.22), 2.2);
      len = lerp(ARC_SHORT, ARC_FULL, click);
      /* coda: unlock, shorten, and stack back on the first angle */
      const back = E.inOutQuart(seg(t, 15.4 + (3 - i) * 0.12, 16.9 + (3 - i) * 0.12));
      if (back > 0) {
        a = lerp(locked - turns[i] * TAU, ARC0, back);
        len = lerp(ARC_FULL, ARC_SHORT, E.outCubic(clamp(back * 1.6)));
      }
      out.push({ a, len });
    }
    /* ring breathes once when the last arc clicks in */
    const pulse = Math.sin(seg(t, 10.63, 11.1) * Math.PI) * -7;
    return { list: out, r: RING + pulse };
  };

  /* three notched discs: rise from the ground, spin, align → a triangle no one drew */
  const notched = (t) => {
    const out = [];
    const verts = [-90, 30, 150].map((d) => ({ x: TRI.x + Math.cos(d * DEG) * TRI.r, y: TRI.y + Math.sin(d * DEG) * TRI.r, toC: (d + 180) * DEG }));
    const spins = [-1.5, 1.25, -1.0];
    for (let i = 0; i < 3; i++) {
      const v = verts[i];
      const t0 = 11.35 + i * 0.22;
      const rise = seg(t, t0, t0 + 1.85);
      const sink = seg(t, 15.6 + i * 0.16, 16.75 + i * 0.16);
      if (rise <= 0 || sink >= 1) continue;
      const base = { x: 500, y: HZ + KR + 4 };
      const fx = E.inOutCubic(rise), fy = E.outQuart(rise);
      let x = lerp(base.x, v.x, fx), y = lerp(base.y, v.y, fy);
      /* the wedge finds the centre last — a fraction after the disc arrives */
      const settle = E.spring(seg(t, t0 + 0.4, t0 + 2.15), 0.45, 11);
      let a = v.toC + (1 - settle) * spins[i] * TAU;
      /* coda: turn the wedges away, then sink */
      const away = E.inOutCubic(seg(t, 15.0 + i * 0.1, 15.75 + i * 0.1));
      a += away * (i % 2 ? 0.5 : -0.5) * Math.PI;
      if (sink > 0) {
        const s = E.inOutCubic(sink);
        x = lerp(v.x, base.x, s); y = lerp(v.y, base.y, E.inQuart(sink));
      }
      out.push({ x, y, a, align: settle * (1 - away) });
    }
    return out;
  };

  /* ---------- drawing ---------- */
  const semi = (h, r) => {
    ctx.beginPath();
    ctx.arc(h.x, h.y, r, h.a - Math.PI / 2, h.a + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
  };

  function horizon(t) {
    const x0 = -ox / k - 20, x1 = (W - ox) / k + 20;
    const p = new Path2D();
    const steps = 220;
    for (let s = 0; s <= steps; s++) {
      const x = lerp(x0, x1, s / steps);
      let y = HZ;
      for (const [t0, hx, a] of HITS) {
        const d = t - t0;
        if (d <= 0 || d > 2.4) continue;
        const dist = Math.abs(x - hx);
        const front = clamp((d * 950 - dist) / 120);
        y += a * front * Math.exp(-d * 2.6) * Math.exp(-dist / 900) * Math.sin(dist * 0.05 - d * 22);
      }
      s ? p.lineTo(x, y) : p.moveTo(x, y);
    }
    /* below the horizon the ground is a shade deeper: a stage floor, and a field for the programme */
    const floor = new Path2D(p);
    floor.lineTo(x1, 5000);
    floor.lineTo(x0, 5000);
    floor.closePath();
    ctx.fillStyle = EARTH;
    ctx.fill(floor);
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 1.6 / k;
    ctx.stroke(p);
  }

  function cutLine(t, l, gapTri) {
    if (l.head <= 0 || l.tail >= 1) return;
    const ext = 2200;
    const dx = Math.cos(l.ang), dy = Math.sin(l.ang);
    const nx = -dy, ny = dx;
    ctx.save();
    if (gapTri) {
      /* the triangle that isn't drawn still hides the line behind it */
      ctx.beginPath();
      ctx.rect(-5000, -5000, 10000, 10000);
      ctx.moveTo(gapTri[0].x, gapTri[0].y);
      ctx.lineTo(gapTri[2].x, gapTri[2].y);
      ctx.lineTo(gapTri[1].x, gapTri[1].y);
      ctx.closePath();
      ctx.clip('evenodd');
    }
    ctx.beginPath();
    const steps = 90;
    const s0 = lerp(-ext, ext, l.tail), s1 = lerp(-ext, ext, l.head);
    for (let i = 0; i <= steps; i++) {
      const s = lerp(s0, s1, i / steps);
      const u = (s + ext) / (2 * ext);
      const v = l.vib * Math.sin(u * Math.PI * 6) * Math.sin(u * Math.PI);
      const x = C.x + dx * s + nx * v, y = C.y + dy * s + ny * v;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 1.6 / k;
    ctx.stroke();
    ctx.restore();
  }

  function render(t) {
    ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(cv.dpr * k, 0, 0, cv.dpr * k, cv.dpr * ox, cv.dpr * oy);

    const nd = notched(t);
    /* when the three wedges align, the absent triangle becomes an object */
    const align = nd.length === 3 ? Math.min(nd[0].align, nd[1].align, nd[2].align) : 0;
    const triPts = [-90, 30, 150].map((d) => ({ x: TRI.x + Math.cos(d * DEG) * TRI.r, y: TRI.y + Math.sin(d * DEG) * TRI.r }));

    horizon(t);
    cutLine(t, line(t), align > 0.985 ? triPts : null);

    /* the slab */
    const s = slab(t);
    ctx.fillStyle = PERSIMMON;
    ctx.fillRect(s.x - SLAB.w / 2, s.y - SLAB.h / 2, SLAB.w, SLAB.h);

    /* the arcs */
    const A = arcs(t);
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 12;
    ctx.lineCap = 'butt';
    for (const a of A.list) {
      ctx.beginPath();
      ctx.arc(C.x, C.y, A.r, a.a - a.len / 2, a.a + a.len / 2);
      ctx.stroke();
    }

    /* the disc, or its halves */
    const h = halves(t);
    ctx.fillStyle = CREAM;
    if (h.whole) {
      ctx.beginPath();
      ctx.arc(C.x, C.y, R, 0, TAU);
      ctx.fill();
    } else {
      semi(h.U, R);
      semi(h.L, R);
    }

    /* the notched discs, emerging through the horizon */
    if (nd.length) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-5000, -5000, 10000, 5000 + HZ);
      ctx.clip();
      ctx.fillStyle = CREAM;
      for (const d of nd) {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.arc(d.x, d.y, KR, d.a + 30 * DEG, d.a - 30 * DEG + TAU);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    labels(t);
  }

  /* act titles under the horizon, set like a programme */
  const ACTS = [[0, 9.05, 'i', 'the cut'], [9.05, 11.3, 'ii', 'the lock'], [11.3, 15.4, 'iii', 'the absent triangle'], [15.4, 20, '', 'return']];
  function labels(t) {
    const size = Math.max(9.5, 12 * k) / k;
    ctx.font = `500 ${size}px "Inter Tight", "Helvetica Neue", Arial, sans-serif`;
    ctx.textBaseline = 'top';
    let x = 60;
    const y = HZ + 36;
    for (const [a, b, n, name] of ACTS) {
      const on = t >= a && t < b;
      const label = (n ? n + '.  ' : '—  ') + name;
      ctx.fillStyle = CREAM;
      ctx.globalAlpha = on ? 1 : 0.32;
      ctx.fillText(label, x, y);
      if (on) {
        const p = (t - a) / (b - a);
        ctx.fillRect(x, y + size * 1.55, ctx.measureText(label).width * p, 1.2 / k);
      }
      x += ctx.measureText(label).width + 34;
    }
    ctx.globalAlpha = 1;
  }

  function resize(w, h, dpr) {
    W = w; H = h;
    cv.resize(w, h, dpr);
    const portrait = w / h < 0.85;
    k = (portrait ? w * 0.98 : Math.min(w * 0.92, h * 0.94)) / 1000;
    ox = (w - 1000 * k) / 2;
    oy = portrait ? h * 0.45 - 500 * k : (h - 1000 * k) / 2 + h * 0.02;
  }

  Motion.player({
    number: '02',
    title: 'Geometric Ballet',
    subtitle: 'A Choreography of Pure Forms',
    duration: D,
    poster: 14.2,
    stage,
    description: [
      'Four characters and one rule each. The circle is fluid and never stops abruptly. The rectangle is decisive: it falls and it stays. The line reaches across the stage and carries vibration. The arc orbits until it finds its place.',
      'Nothing moves without a cause. A line cuts the disc; the halves part and reveal a slab that was hidden inside it all along; the slab falls and the ground rings; the halves roll down and become domes; the line turns upright and becomes an axis.',
      'Act two: four arcs chase each other at different speeds and click into a single ring around the place where the disc used to be. Act three: three notched discs rise from the ground and turn until their notches agree — and a triangle that nobody drew appears, opaque enough to hide the line behind it.',
    ],
    init: () => Motion.fonts([['500 12px "Inter Tight"', 'the cut']]),
    resize,
    render,
  });
})();
