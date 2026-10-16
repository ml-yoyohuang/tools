/* 12 — Time as Material
 * No frame buffer remembers anything. The picture at time t is rebuilt from the bar's past:
 * its pose is a pure function of time, and a memory window says how much of the past survives.
 * Three ways of keeping the past share that window —
 *   continuous trails  (the ends, sampled densely),
 *   discrete slices    (the whole bar, at fixed moments of absolute time, like a strobe plate),
 *   layered exposure   (light accumulated between consecutive slices).
 * So any time can be scrubbed to, and the loop closes exactly.
 */
(() => {
  const { ease: E, track, seg, clamp, lerp, TAU } = Motion;
  const D = 20;
  const stage = document.getElementById('stage');
  const cv = Motion.canvas(stage);
  const ctx = cv.ctx;
  let W = 0, H = 0, S = 1, portrait = false;

  /* ---------- the bar ---------- */
  /* phase of the motion: still, a slow start, a fast middle, a long slow passage (where slices crowd), a settle */
  const PHI = track([[0, 0], [2.6, 0], [6, 0.16, E.inQuad], [10, 0.56, E.linear], [13.8, 0.7, E.outSine], [17.0, 0.94, E.inOutSine], [18.7, 1, E.outCubic]]);
  /* how much of the past survives: grows, holds, then is forgotten from the oldest end */
  const MEM = track([[0, 0], [4.6, 0], [5.4, 0.12], [9.4, 5.8, E.inOutSine], [14, 7.2, E.inOutSine], [17.4, 0, E.inOutCubic]]);
  /* how the three techniques enter: trails first, slices at accumulation, exposure last */
  const TRAILS = track([[0, 0], [5, 0], [7, 1, E.inOutSine], [16.5, 1], [17.4, 0]]);
  const SLICES = track([[0, 0], [8, 0], [10.5, 1, E.inOutSine], [16, 1], [17.4, 0]]);
  const EXPO = track([[0, 0], [9.5, 0], [12.8, 1, E.inOutSine], [15.6, 0.8], [17.2, 0, E.inOutSine]]);

  function pose(phi, out) {
    const a = TAU * phi;
    const ax = portrait ? 0.27 : 0.25, ay = portrait ? 0.24 : 0.19;
    const cx = W * (portrait ? 0.5 : 0.52) + (portrait ? W : W) * ax * Math.sin(a + 0.35) * (portrait ? 0.9 : 1);
    const cy = H * 0.5 + (portrait ? H : H) * ay * Math.sin(2 * a) * (portrait ? 0.9 : 1);
    /* one and a half turns: an undirected bar returns to itself */
    const th = 0.25 + 1.5 * TAU * phi + 0.6 * Math.sin(a * 3);
    const L = S * 0.17 * (1 + 0.28 * Math.sin(a * 3 + 1));
    out.x0 = cx - Math.cos(th) * L; out.y0 = cy - Math.sin(th) * L;
    out.x1 = cx + Math.cos(th) * L; out.y1 = cy + Math.sin(th) * L;
    return out;
  }
  const P = {}, Q = {};

  function render(t) {
    ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#12100D';
    ctx.fillRect(0, 0, W, H);
    const mem = MEM(t);
    const t0 = Math.max(0, t - mem);
    const ageOf = (tau) => (mem > 0 ? clamp((t - tau) / Math.max(mem, 1e-3)) : 1);

    /* layered exposure: soft light accumulated between consecutive strobe moments */
    const ex = EXPO(t);
    const DT = 0.11;
    if (ex > 0 && mem > 0.2) {
      ctx.globalCompositeOperation = 'lighter';
      let prev = null;
      for (let tau = Math.ceil(t0 / DT) * DT; tau <= t; tau += DT) {
        const p = pose(PHI(tau), {});
        if (prev) {
          const age = ageOf(tau);
          ctx.fillStyle = `rgba(168,138,96,${(0.11 * ex * Math.pow(1 - age, 1.2)).toFixed(4)})`;
          ctx.beginPath();
          ctx.moveTo(prev.x0, prev.y0); ctx.lineTo(prev.x1, prev.y1); ctx.lineTo(p.x1, p.y1); ctx.lineTo(p.x0, p.y0);
          ctx.closePath();
          ctx.fill();
        }
        prev = p;
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    /* discrete slices: the bar photographed at fixed moments of absolute time */
    const sl = SLICES(t);
    if (sl > 0 && mem > 0.2) {
      ctx.lineCap = 'butt';
      for (let tau = Math.ceil(t0 / DT) * DT; tau <= t - DT * 0.5; tau += DT) {
        const age = ageOf(tau);
        const p = pose(PHI(tau), P);
        /* every fifth slice is a heavier exposure: a rhythm in the record */
        const heavy = Math.round(tau / DT) % 5 === 0;
        ctx.strokeStyle = `rgba(226,216,196,${((heavy ? 0.85 : 0.42) * sl * Math.pow(1 - age, 1.0)).toFixed(3)})`;
        ctx.lineWidth = heavy ? 1.2 : 0.7;
        ctx.beginPath(); ctx.moveTo(p.x0, p.y0); ctx.lineTo(p.x1, p.y1); ctx.stroke();
      }
    }

    /* continuous trails: the two ends, densely sampled, fading with age */
    const tr = TRAILS(t);
    if (tr > 0 && mem > 0.02) {
      const step = 1 / 90;
      ctx.lineWidth = 1;
      for (const end of [0, 1]) {
        let prev = null;
        for (let tau = t0; tau <= t + 1e-6; tau += step) {
          const p = pose(PHI(tau), Q);
          const x = end ? p.x1 : p.x0, y = end ? p.y1 : p.y0;
          if (prev) {
            const age = ageOf(tau);
            ctx.strokeStyle = `rgba(240,232,216,${(0.9 * tr * Math.pow(1 - age, 1.2)).toFixed(3)})`;
            ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(x, y); ctx.stroke();
          }
          prev = [x, y];
        }
      }
    }

    /* motion blur of the present: a short shutter, only while it moves */
    const now = pose(PHI(t), P);
    const back = pose(PHI(Math.max(0, t - 0.06)), Q);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(200,188,165,0.18)';
    ctx.beginPath();
    ctx.moveTo(back.x0, back.y0); ctx.lineTo(back.x1, back.y1); ctx.lineTo(now.x1, now.y1); ctx.lineTo(now.x0, now.y0);
    ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    /* the present */
    ctx.strokeStyle = '#F4EFE4';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, S * 0.006);
    ctx.beginPath(); ctx.moveTo(now.x0, now.y0); ctx.lineTo(now.x1, now.y1); ctx.stroke();

    caption(t, mem);
  }

  /* one line of text, set like a plate caption: how much time the picture currently holds */
  function caption(t, mem) {
    const m = Math.max(10, S * 0.0135);
    ctx.font = `italic 400 ${m * 1.45}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillStyle = 'rgba(233,225,210,.82)';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    const x = W - Math.max(24, W * 0.04), y = H - Math.max(70, H * 0.09);
    const held = mem < 0.05 ? 'the present only' : `the last ${mem.toFixed(1)} seconds`;
    ctx.fillText(held, x, y);
    ctx.font = `500 ${m * 0.78}px "Inter Tight", sans-serif`;
    ctx.fillStyle = 'rgba(233,225,210,.48)';
    ctx.fillText('THIS PLATE HOLDS', x, y - m * 1.9);
    ctx.textAlign = 'left';
  }

  function resize(w, h, dpr) {
    W = w; H = h; S = Math.min(w, h);
    portrait = w / h < 0.9;
    cv.resize(w, h, dpr);
  }

  Motion.player({
    number: '12',
    title: 'Time as Material',
    subtitle: 'The Shape of What Remains',
    duration: D,
    poster: 13.2,
    stage,
    description: [
      'A single bar of light on a dark plate. It begins to move, through a slow figure of eight, turning as it goes. At first only the present exists.',
      'Then the plate starts to keep things. The two ends leave fine continuous trails. Later the whole bar is recorded at fixed moments, like a strobe photograph, every fifth exposure a little heavier; where it moved slowly the slices crowd together, where it moved fast they spread apart, so speed becomes density. Last, light accumulates between the slices, and the structure the bar has been weaving becomes a surface.',
      'Then the plate forgets, oldest first: the far end of the record moves faster than the present, until only the bar remains, at rest where it began.',
      'Nothing is stored between frames. The bar’s pose is a function of time and the record is recomputed from it, so the picture at any moment is exact — scrubbed, paused or looped.',
    ],
    init: () => Motion.fonts([['italic 400 20px "Cormorant Garamond"', 'the last'], ['500 10px "Inter Tight"', 'THIS']]),
    resize,
    render,
  });
})();
