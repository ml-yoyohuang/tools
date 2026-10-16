/* 03 — the three "photographs" of the feature, made once at load.
 * No image files: each is painted from soft light, shadow and film grain, with a fixed seed.
 */
(() => {
  const rng = Motion.rng;

  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  };

  /* blur that works everywhere: draw the shape far off-canvas and keep only its shadow */
  const softly = (ctx, blur, color, draw) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = 20000;
    ctx.translate(-20000, 0);
    draw();
    ctx.restore();
  };

  const grain = (ctx, w, h, amount, seed) => {
    const r = rng(seed);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] + d[i + 1] + d[i + 2]) / 765;
      const n = (r() + r() - 1) * amount * (0.55 + 0.9 * lum * (1 - lum) * 2);
      d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.96;
    }
    ctx.putImageData(img, 0, 0);
  };

  const mottle = (ctx, w, h, seed, n, colors, alpha) => {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h, rx = 60 + r() * 260, ry = 40 + r() * 200;
      softly(ctx, 80, colors[i % colors.length], () => {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
  };

  const quad = (A, B, C, D, u0, u1, v0, v1) => {
    const p = (u, v) => ({
      x: (1 - v) * ((1 - u) * A.x + u * B.x) + v * ((1 - u) * D.x + u * C.x),
      y: (1 - v) * ((1 - u) * A.y + u * B.y) + v * ((1 - u) * D.y + u * C.y),
    });
    return [p(u0, v0), p(u1, v0), p(u1, v1), p(u0, v1)];
  };

  /* Fig. 1 — window light on a north wall, with the shadow of a branch */
  function wall() {
    const w = 1200, h = 1500;
    const [c, x] = mk(w, h);
    x.fillStyle = '#9d907e';
    x.fillRect(0, 0, w, h);
    mottle(x, w, h, 11, 46, ['#b0a290', '#8c7f6e', '#a6987f'], 0.35);
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(40,30,20,.28)'); g.addColorStop(0.45, 'rgba(40,30,20,0)'); g.addColorStop(1, 'rgba(40,30,20,.34)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);

    /* the window, projected: a 2 × 3 pane parallelogram, light falling from upper left */
    const [pc, p] = mk(w, h);
    const A = { x: 250, y: 300 }, B = { x: 880, y: 210 }, C = { x: 960, y: 1080 }, D = { x: 300, y: 1230 };
    p.fillStyle = '#000';
    const mul = 0.035;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      const q = quad(A, B, C, D, i / 2 + (i ? mul / 2 : 0), (i + 1) / 2 - (i ? 0 : mul / 2), j / 3 + (j ? mul / 2 : 0), (j + 1) / 3 - (j < 2 ? mul / 2 : 0));
      p.beginPath(); p.moveTo(q[0].x, q[0].y); q.slice(1).forEach((v) => p.lineTo(v.x, v.y)); p.closePath(); p.fill();
    }
    /* a branch outside interrupts the light */
    const r = rng(5);
    p.globalCompositeOperation = 'destination-out';
    p.strokeStyle = 'rgba(0,0,0,.72)';
    p.fillStyle = 'rgba(0,0,0,.62)';
    p.lineWidth = 9;
    p.beginPath(); p.moveTo(1010, 560); p.bezierCurveTo(820, 640, 700, 760, 520, 980); p.stroke();
    p.lineWidth = 5;
    p.beginPath(); p.moveTo(770, 690); p.bezierCurveTo(720, 600, 690, 540, 610, 500); p.stroke();
    for (let i = 0; i < 26; i++) {
      const tt = r();
      const bx = 1010 + (520 - 1010) * tt + (r() - 0.5) * 120, by = 560 + (980 - 560) * tt + (r() - 0.5) * 120;
      p.beginPath();
      p.ellipse(bx, by, 22 + r() * 30, 9 + r() * 9, -0.6 + r() * 1.6, 0, Math.PI * 2);
      p.fill();
    }
    p.globalCompositeOperation = 'source-over';
    softly(x, 26, 'rgba(246,220,172,.95)', () => x.drawImage(pc, 0, 0));
    softly(x, 90, 'rgba(250,214,160,.38)', () => x.drawImage(pc, 0, 0));
    grain(x, w, h, 26, 101);
    return c;
  }

  /* Fig. 2 — a horizon after rain, sun low behind haze */
  function horizon() {
    const w = 1800, h = 1000, hz = 600;
    const [c, x] = mk(w, h);
    let g = x.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#76838c'); g.addColorStop(0.6, '#b3b2ab'); g.addColorStop(1, '#dcd0bf');
    x.fillStyle = g; x.fillRect(0, 0, w, hz);
    const sx = 1180;
    g = x.createRadialGradient(sx, hz - 20, 0, sx, hz - 20, 520);
    g.addColorStop(0, 'rgba(248,226,190,.95)'); g.addColorStop(0.25, 'rgba(240,214,178,.45)'); g.addColorStop(1, 'rgba(240,214,178,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, hz);
    /* strata of cloud */
    const r = rng(23);
    for (let i = 0; i < 18; i++) {
      const y = 80 + r() * (hz - 180), cx = r() * w;
      softly(x, 40, i % 3 ? 'rgba(90,98,104,.22)' : 'rgba(236,224,206,.3)', () => {
        x.beginPath(); x.ellipse(cx, y, 260 + r() * 520, 10 + r() * 22, 0, 0, Math.PI * 2); x.fill();
      });
    }
    /* sea */
    g = x.createLinearGradient(0, hz, 0, h);
    g.addColorStop(0, '#79807f'); g.addColorStop(0.3, '#555d5f'); g.addColorStop(1, '#2c3335');
    x.fillStyle = g; x.fillRect(0, hz, w, h - hz);
    /* the sun's path on the water */
    for (let i = 0; i < 260; i++) {
      const d = r();
      const y = hz + 3 + Math.pow(d, 1.6) * (h - hz);
      const spread = 40 + d * 260;
      const cx = sx + (r() - 0.5) * spread * 2;
      const len = (8 + r() * 70) * (1 - d * 0.5);
      x.fillStyle = `rgba(246,226,192,${(0.5 * (1 - d) + 0.06) * (0.4 + r() * 0.6)})`;
      x.fillRect(cx - len / 2, y, len, 1.5 + d * 3);
    }
    x.fillStyle = 'rgba(225,214,198,.55)';
    x.fillRect(0, hz - 1, w, 2);
    grain(x, w, h, 22, 202);
    return c;
  }

  /* Fig. 3 — a glass of water on linen, its shadow holding a crescent of focused light */
  function glass() {
    const w = 1200, h = 1200;
    const [c, x] = mk(w, h);
    let g = x.createRadialGradient(260, 200, 50, 420, 420, 1300);
    g.addColorStop(0, '#e2d7c2'); g.addColorStop(0.55, '#c8baa2'); g.addColorStop(1, '#988a74');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    /* linen weave */
    x.globalAlpha = 0.05;
    x.fillStyle = '#3a3024';
    for (let y = 0; y < h; y += 5) x.fillRect(0, y, w, 1);
    for (let xx = 0; xx < w; xx += 6) x.fillRect(xx, 0, 1, h);
    x.globalAlpha = 1;
    mottle(x, w, h, 31, 22, ['#d9cdb6', '#b8aa91'], 0.25);

    const gx = 520, gy = 500, gr = 175;
    /* long shadow, cast to the lower right */
    softly(x, 46, 'rgba(92,78,58,.55)', () => {
      x.beginPath(); x.ellipse(gx + 210, gy + 210, gr * 1.95, gr * 0.98, Math.PI / 4, 0, Math.PI * 2); x.fill();
    });
    /* caustic: the water focuses the light into a crescent inside the shadow */
    softly(x, 16, 'rgba(255,240,206,.9)', () => {
      x.beginPath();
      x.ellipse(gx + 250, gy + 250, gr * 0.95, gr * 0.5, Math.PI / 4, 0, Math.PI * 2);
      x.ellipse(gx + 215, gy + 215, gr * 0.86, gr * 0.42, Math.PI / 4, 0, Math.PI * 2);
      x.fill('evenodd');
    });
    softly(x, 6, 'rgba(255,248,226,.85)', () => {
      x.beginPath(); x.ellipse(gx + 300, gy + 300, 50, 14, Math.PI / 4, 0, Math.PI * 2); x.fill();
    });
    /* the glass itself, seen from above */
    g = x.createRadialGradient(gx - 40, gy - 50, 10, gx, gy, gr);
    g.addColorStop(0, 'rgba(236,232,222,.55)'); g.addColorStop(0.8, 'rgba(176,170,156,.35)'); g.addColorStop(1, 'rgba(120,112,98,.5)');
    x.fillStyle = g;
    x.beginPath(); x.arc(gx, gy, gr, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(255,255,250,.65)'; x.lineWidth = 3;
    x.beginPath(); x.arc(gx, gy, gr - 2, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(90,82,70,.35)'; x.lineWidth = 2;
    x.beginPath(); x.arc(gx, gy, gr * 0.86, 0, Math.PI * 2); x.stroke();
    softly(x, 10, 'rgba(255,255,255,.9)', () => {
      x.lineWidth = 9; x.strokeStyle = '#fff';
      x.beginPath(); x.arc(gx, gy, gr * 0.93, Math.PI * 1.05, Math.PI * 1.42); x.stroke();
    });
    grain(x, w, h, 20, 303);
    return c;
  }

  window.EditorialImages = { wall, horizon, glass };
})();
