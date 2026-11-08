import * as THREE from 'three';
import { SPAN, rasterize } from './turtle.js';

/*
 * The magic papers. Each maker returns { map, orm, bump, glow }:
 *   map  – colour; orm – roughness (G) and metalness (B); bump – fibre and emboss;
 *   glow – a mask of what lights up (strokes, stars, creases…) while the paper burns.
 * Every sheet is drawn in sheet space: canvas x = world x, canvas y = world z, head toward +z
 * (the bottom of the canvas, nearest the viewer). The shell sits around (0, -0.04).
 */

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function sheet(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function tex(cv, srgb) {
  const t = new THREE.CanvasTexture(cv);
  t.flipY = false; // uv (0,0) = canvas top-left = sheet corner at -x,-z
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** World (x, z) → canvas px for a sheet of this size. */
const px = (size) => (w) => ((w + SPAN) / (2 * SPAN)) * size;

// THREE.Color keeps linear values; canvases want sRGB
const SRGB = THREE.SRGBColorSpace;
const rgba = (col, a) => {
  const o = {};
  col.getRGB(o, SRGB);
  return `rgba(${(o.r * 255) | 0},${(o.g * 255) | 0},${(o.b * 255) | 0},${a})`;
};

/** An evenly dyed sheet with slow colour drift and a faint fibre. */
function dye(c, size, hex, r, { drift = 0.08, blotches = 260, fibres = 5000, fibre = 0.06, long = 10 } = {}) {
  const base = new THREE.Color(hex);
  const hsl = {};
  base.getHSL(hsl, SRGB);
  c.fillStyle = hex;
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < blotches; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = size * (0.04 + r() * 0.16);
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    const l = Math.min(0.95, Math.max(0.03, hsl.l + (r() - 0.5) * drift));
    const col = new THREE.Color().setHSL(hsl.h, hsl.s * (0.9 + r() * 0.15), l, SRGB);
    // fade to the same colour, not to transparent black, or every blotch gets a dark rim
    g.addColorStop(0, rgba(col, 0.35));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  c.lineCap = 'round';
  for (let i = 0; i < fibres; i++) {
    const x = r() * size;
    const y = r() * size;
    const a = r() * Math.PI;
    const l = 2 + r() * long;
    c.strokeStyle = r() > 0.5 ? `rgba(255,255,255,${fibre * (0.5 + r())})` : `rgba(0,0,0,${fibre * (0.5 + r())})`;
    c.lineWidth = 0.4 + r() * 0.7;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
}

function fibreBump(size, r, count = 3000, a = 0.14) {
  const [cv, b] = sheet(size);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);
  b.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = r() * size;
    const y = r() * size;
    const ang = r() * Math.PI;
    const l = 2 + r() * 10;
    b.strokeStyle = r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    b.lineWidth = 0.5 + r() * 0.7;
    b.beginPath();
    b.moveTo(x, y);
    b.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l);
    b.stroke();
  }
  return [cv, b];
}

/** Roughness / metalness sheet: rough 0–1, metal 0–1 */
function ormSheet(size, rough, metal) {
  const [cv, o] = sheet(size);
  o.fillStyle = `rgb(255,${(rough * 255) | 0},${(metal * 255) | 0})`;
  o.fillRect(0, 0, size, size);
  return [cv, o];
}

const ormColor = (rough, metal) => `rgb(255,${(rough * 255) | 0},${(metal * 255) | 0})`;

function glowSheet(size) {
  const [cv, g] = sheet(size);
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  return [cv, g];
}

const pack = (map, orm, bump, glow) => ({ map: tex(map, true), orm: tex(orm, false), bump: tex(bump, false), glow: glow ? tex(glow, false) : null });

/* ---------- Brush ---------- */

/** Resample a polyline into brush stamps [x, y, radius, alpha], tapering in and drying out at the end. */
function brush(points, width, r, { dry = 0.35, taperIn = 0.1 } = {}) {
  const lens = [0];
  for (let i = 1; i < points.length; i++) lens.push(lens[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = lens[lens.length - 1];
  const out = [];
  if (!total) return out;
  const step = Math.max(0.6, width * 0.22);
  let seg = 1;
  for (let d = 0; d <= total; d += step) {
    while (seg < points.length - 1 && lens[seg] < d) seg++;
    const f = (d - lens[seg - 1]) / (lens[seg] - lens[seg - 1] || 1);
    const x = points[seg - 1][0] + (points[seg][0] - points[seg - 1][0]) * f;
    const y = points[seg - 1][1] + (points[seg][1] - points[seg - 1][1]) * f;
    const t = d / total;
    const press = (0.55 + 0.45 * Math.min(1, t / taperIn)) * (1 - Math.max(0, (t - 0.72) / 0.28) * 0.6);
    const dryness = Math.max(0, (t - (1 - dry)) / dry);
    if (r() < dryness * 0.55) continue;
    out.push([x + (r() - 0.5) * width * 0.12, y + (r() - 0.5) * width * 0.12, width * press * (0.92 + r() * 0.16), 0.9 - dryness * 0.45]);
    // dry-brush bristle streaks
    if (dryness > 0 && r() < 0.5) {
      const off = (r() - 0.5) * width * 1.6;
      out.push([x + off, y + off * 0.3, width * 0.18, 0.5 * (1 - dryness)]);
    }
  }
  return out;
}

function paint(ctx, stamps, color, scale = 1) {
  ctx.fillStyle = color;
  for (const [x, y, rad, a] of stamps) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(x * scale, y * scale, rad * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Sample a parametric curve f(t) → [worldX, worldZ] into canvas points. */
function curve(P, f, n = 60) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const [x, z] = f(i / n);
    pts.push([P(x), P(z)]);
  }
  return pts;
}

/* ---------- 朱砂符紙: yellow talisman paper with vermilion brushwork ---------- */

export function talismanTextures(size) {
  const r = rand(1031);
  const P = px(size);
  const [map, c] = sheet(size);
  dye(c, size, '#d8ad3c', r, { drift: 0.1, blotches: 320, fibres: 9000, fibre: 0.07, long: 14 });
  // coarse bamboo specks
  for (let i = 0; i < 1400; i++) {
    c.fillStyle = `rgba(120,80,20,${0.08 + r() * 0.2})`;
    c.fillRect(r() * size, r() * size, 0.6 + r() * 1.8, 0.6 + r() * 1.8);
  }

  // Abstract brush script running down the sheet, tail (top) to head (bottom)
  const U = size / 1024;
  const strokes = [];
  const add = (pts, w, o) => strokes.push(brush(pts, w * 1.45 * U, r, o));
  // crown: three short bars
  for (let k = 0; k < 3; k++) {
    const z = -1.02 + k * 0.085;
    const hw = 0.2 - k * 0.035;
    add(curve(P, (t) => [-hw + 2 * hw * t, z + Math.sin(t * Math.PI) * -0.018]), 9, { dry: 0.3 });
  }
  // a bar with a hook
  add(curve(P, (t) => (t < 0.8 ? [-0.3 + 0.75 * t, -0.7 - 0.02 * t] : [0.3 - (t - 0.8) * 0.3, -0.716 + (t - 0.8) * 0.6])), 10);
  // the spine: a long waver from the back to the head
  add(curve(P, (t) => [0.055 * Math.sin(t * 13) * (1 - t * 0.5), -0.6 + t * 1.62], 140), 13, { dry: 0.25, taperIn: 0.04 });
  // the coil over the shell's crown
  add(
    curve(P, (t) => {
      const a = -Math.PI / 2 + t * Math.PI * 2 * 2.3;
      const rr = 0.22 * (1 - t * 0.78);
      return [Math.cos(a) * rr * 1.1, -0.12 + Math.sin(a) * rr];
    }, 160),
    8,
    { dry: 0.4 }
  );
  // two sweeping cross strokes that curl at their ends
  for (const [z, w] of [[0.24, 0.42], [0.44, 0.34]]) {
    add(
      curve(P, (t) => {
        if (t < 0.85) return [-w + 2 * w * (t / 0.85), z + Math.sin((t / 0.85) * Math.PI) * -0.04];
        const a = ((t - 0.85) / 0.15) * Math.PI * 1.4;
        return [w + Math.sin(a) * 0.05, z - (1 - Math.cos(a)) * 0.05];
      }, 90),
      9
    );
  }
  // falling dots either side, like rain
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const x = side * (0.3 + (k % 2) * 0.06);
      const z = -0.42 + k * 0.13;
      add(curve(P, (t) => [x + side * t * 0.05, z + t * 0.06], 8), 7, { dry: 0.6, taperIn: 0.3 });
    }
  }
  // small rings
  for (const [x, z, rr] of [[-0.46, 0.02, 0.04], [0.46, 0.02, 0.04], [0, 0.66, 0.05], [0, -0.86, 0.03]]) {
    add(curve(P, (t) => [x + Math.cos(t * Math.PI * 2.15) * rr, z + Math.sin(t * Math.PI * 2.15) * rr], 40), 5, { dry: 0.2 });
  }
  // flicks on the flippers
  for (const side of [-1, 1]) {
    add(curve(P, (t) => [side * (0.62 + t * 0.5), 0.5 + t * 0.18 - Math.sin(t * Math.PI) * 0.06], 30), 8);
    add(curve(P, (t) => [side * (0.6 + t * 0.32), -0.36 - t * 0.3], 24), 7, { dry: 0.5 });
  }

  const ink = '#b0261a';
  for (const s of strokes) paint(c, s, ink);

  // Seal: a carved vermilion square on the lower shell
  const seal = (ctx, fill, carve, scale = 1) => {
    const x0 = P(0.29) * scale;
    const y0 = P(0.38) * scale;
    const s = (P(0.5) - P(0.29)) * scale;
    const rs = rand(77);
    ctx.fillStyle = fill;
    ctx.beginPath();
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
    corners.forEach(([u, v], i) => {
      for (let k = 0; k < 6; k++) {
        const [u2, v2] = corners[(i + 1) % 4];
        const f = k / 6;
        const x = x0 + (u + (u2 - u) * f) * s + (rs() - 0.5) * s * 0.03;
        const y = y0 + (v + (v2 - v) * f) * s + (rs() - 0.5) * s * 0.03;
        if (i === 0 && k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
    ctx.fill();
    if (!carve) return;
    ctx.strokeStyle = carve;
    ctx.lineCap = 'square';
    ctx.lineWidth = s * 0.045;
    ctx.strokeRect(x0 + s * 0.1, y0 + s * 0.1, s * 0.8, s * 0.8);
    // two columns of abstract carved marks
    ctx.lineWidth = s * 0.055;
    for (let q = 0; q < 4; q++) {
      const qx = x0 + s * (0.18 + (q % 2) * 0.34);
      const qy = y0 + s * (0.18 + Math.floor(q / 2) * 0.34);
      const cell = s * 0.3;
      for (let k = 0; k < 4; k++) {
        const horiz = rs() > 0.45;
        const a = 0.1 + rs() * 0.8;
        const b0 = rs() * 0.4;
        const b1 = b0 + 0.35 + rs() * 0.25;
        ctx.beginPath();
        if (horiz) {
          ctx.moveTo(qx + b0 * cell, qy + a * cell);
          ctx.lineTo(qx + Math.min(1, b1) * cell, qy + a * cell);
        } else {
          ctx.moveTo(qx + a * cell, qy + b0 * cell);
          ctx.lineTo(qx + a * cell, qy + Math.min(1, b1) * cell);
        }
        ctx.stroke();
      }
    }
  };
  seal(c, 'rgba(176,34,22,0.92)', '#d4a93e');

  const [orm, o] = ormSheet(size, 0.95, 0);
  for (const s of strokes) paint(o, s, ormColor(0.62, 0));
  seal(o, ormColor(0.7, 0), null);

  const [bump, b] = fibreBump(size, r, 6000, 0.2);
  for (const s of strokes) paint(b, s, 'rgba(150,150,150,0.5)');

  const half = size / 2;
  const [glow, g] = glowSheet(half);
  for (const s of strokes) paint(g, s, '#fff', 0.5);
  seal(g, '#fff', null, 0.5);

  return pack(map, orm, bump, glow);
}

/* ---------- 星宿紙: night-blue paper with a gold star chart ---------- */

const DIPPER = [[-0.42, -0.3], [-0.2, -0.36], [-0.02, -0.26], [0.13, -0.12], [0.16, 0.12], [0.44, 0.17], [0.47, -0.06]];

export function starTextures(size) {
  const r = rand(4242);
  const P = px(size);
  const U = size / 1024;
  const [map, c] = sheet(size);
  dye(c, size, '#141b31', r, { drift: 0.05, blotches: 300, fibres: 4000, fibre: 0.05 });
  // a faint milky band across the sheet
  for (let i = 0; i < 160; i++) {
    const t = r();
    const x = t * size;
    const y = size * (0.25 + t * 0.5) + (r() - 0.5) * size * 0.18;
    const rad = size * (0.02 + r() * 0.06);
    const gr = c.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(120,140,200,0.07)');
    gr.addColorStop(1, 'rgba(120,140,200,0)');
    c.fillStyle = gr;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // field stars
  const field = [];
  for (let i = 0; i < 1500; i++) field.push([r() * size, r() * size, (0.4 + Math.pow(r(), 4) * 1.6) * U, 0.12 + r() * 0.5]);
  for (const [x, y, rad, a] of field) {
    c.fillStyle = r() > 0.8 ? `rgba(240,215,150,${a})` : `rgba(210,222,255,${a})`;
    c.beginPath();
    c.arc(x, y, rad, 0, Math.PI * 2);
    c.fill();
  }

  // The chart, drawn as gold lines and stars into any of the four sheets
  const cx = P(0);
  const cy = P(-0.04);
  const R = P(0.66) - P(0);
  const minis = [];
  for (const [ox, oz, n] of [[-0.95, 0.62, 4], [0.98, 0.6, 3], [0, 1.1, 3], [-0.72, -0.62, 3], [0.72, -0.6, 4], [0, -0.92, 3]]) {
    const pts = [];
    let x = ox;
    let z = oz;
    for (let k = 0; k < n; k++) {
      pts.push([x, z]);
      x += (r() - 0.5) * 0.22;
      z += (r() - 0.5) * 0.22;
    }
    minis.push(pts);
  }
  const chart = (ctx, line, star, scale, glowing) => {
    const S = (v) => v * scale;
    ctx.strokeStyle = line;
    ctx.lineWidth = S(2.4 * U);
    // double ring with 28 mansion ticks
    for (const rr of [R, R * 0.93]) {
      ctx.beginPath();
      ctx.ellipse(S(cx), S(cy), S(rr), S(rr * 1.12), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      const r0 = R * 0.93;
      const r1 = k % 7 === 0 ? R * 1.06 : R;
      ctx.beginPath();
      ctx.moveTo(S(cx + Math.cos(a) * r0), S(cy + Math.sin(a) * r0 * 1.12));
      ctx.lineTo(S(cx + Math.cos(a) * r1), S(cy + Math.sin(a) * r1 * 1.12));
      ctx.stroke();
    }
    // inner ring
    ctx.lineWidth = S(1.6 * U);
    ctx.beginPath();
    ctx.ellipse(S(cx), S(cy), S(R * 0.24), S(R * 0.27), 0, 0, Math.PI * 2);
    ctx.stroke();
    // the dipper and the small asterisms
    const join = (pts, w) => {
      ctx.lineWidth = S(w * U);
      ctx.beginPath();
      pts.forEach(([x, z], i) => (i ? ctx.lineTo(S(P(x)), S(P(z))) : ctx.moveTo(S(P(x)), S(P(z)))));
      ctx.stroke();
    };
    join(DIPPER, 2.2);
    join([DIPPER[3], DIPPER[6]], 2.2);
    minis.forEach((m) => join(m, 1.6));
    const dot = (x, z, rad, spark) => {
      ctx.fillStyle = star;
      ctx.beginPath();
      ctx.arc(S(P(x)), S(P(z)), S(rad * U), 0, Math.PI * 2);
      ctx.fill();
      if (!spark) return;
      ctx.lineWidth = S(1.1 * U);
      ctx.strokeStyle = star;
      for (const [dx, dz] of [[1, 0], [0, 1]]) {
        ctx.beginPath();
        ctx.moveTo(S(P(x) - dx * rad * 3.2 * U), S(P(z) - dz * rad * 3.2 * U));
        ctx.lineTo(S(P(x) + dx * rad * 3.2 * U), S(P(z) + dz * rad * 3.2 * U));
        ctx.stroke();
      }
      ctx.strokeStyle = line;
    };
    DIPPER.forEach(([x, z]) => dot(x, z, glowing ? 8 : 6, true));
    minis.forEach((m) => m.forEach(([x, z]) => dot(x, z, glowing ? 5.5 : 4, false)));
  };
  chart(c, 'rgba(232,200,126,0.95)', '#f8e2a4', 1.0, false);
  // a hairline gold border just inside the shell's rim
  c.strokeStyle = 'rgba(222,190,118,0.55)';
  c.lineWidth = 1 * U;
  c.beginPath();
  c.ellipse(cx, cy, P(0.76) - P(0), P(0.88) - P(0), 0, 0, Math.PI * 2);
  c.stroke();

  const [orm, o] = ormSheet(size, 0.85, 0);
  chart(o, ormColor(0.32, 1), ormColor(0.28, 1), 1, false);

  const [bump] = fibreBump(size, r, 2400, 0.1);

  const half = size / 2;
  const [glow, g] = glowSheet(half);
  for (const [x, y, rad, a] of field) {
    if (a < 0.4) continue;
    g.fillStyle = `rgba(255,255,255,${a * 0.6})`;
    g.beginPath();
    g.arc(x * 0.5, y * 0.5, rad * 0.5 + 0.4, 0, Math.PI * 2);
    g.fill();
  }
  chart(g, 'rgba(255,255,255,0.35)', '#fff', 0.5, true);

  return pack(map, orm, bump, glow);
}

/* ---------- 灑金紙: deep crimson scattered with gold leaf ---------- */

export function kinpakuTextures(size) {
  const r = rand(9001);
  const U = size / 1024;
  const [map, c] = sheet(size);
  dye(c, size, '#7a1715', r, { drift: 0.06, blotches: 280, fibres: 5000, fibre: 0.05 });

  const flakes = [];
  for (let i = 0; i < 700; i++) {
    const big = Math.pow(r(), 3.6);
    const rad = (1.2 + big * 28) * U;
    const n = 4 + Math.floor(r() * 5);
    const rot = r() * Math.PI * 2;
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.7;
      const rr = rad * (0.45 + r() * 0.65);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    flakes.push({ x: r() * size, y: r() * size, pts, tone: r(), rough: 0.18 + r() * 0.35, alpha: 0.7 + r() * 0.3 });
  }
  const shape = (ctx, f, scale) => {
    ctx.beginPath();
    f.pts.forEach(([dx, dy], i) => (i ? ctx.lineTo((f.x + dx) * scale, (f.y + dy) * scale) : ctx.moveTo((f.x + dx) * scale, (f.y + dy) * scale)));
    ctx.closePath();
  };
  const lo = new THREE.Color('#a87a2c');
  const hi = new THREE.Color('#f6e1a0');
  for (const f of flakes) {
    shape(c, f, 1);
    c.fillStyle = rgba(lo.clone().lerp(hi, f.tone), f.alpha);
    c.fill();
    // crinkle highlight
    c.strokeStyle = `rgba(255,244,205,${0.25 * f.alpha})`;
    c.lineWidth = 0.6 * U;
    c.stroke();
  }
  // gold dust
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `rgba(240,210,140,${0.25 + r() * 0.5})`;
    c.fillRect(r() * size, r() * size, (0.5 + r()) * U, (0.5 + r()) * U);
  }

  const [orm, o] = ormSheet(size, 0.88, 0);
  for (const f of flakes) {
    shape(o, f, 1);
    o.fillStyle = ormColor(f.rough + 0.12, 0.82);
    o.fill();
  }

  const [bump, b] = fibreBump(size, r, 3000, 0.12);
  for (const f of flakes) {
    shape(b, f, 1);
    b.fillStyle = 'rgba(170,170,170,0.6)';
    b.fill();
  }

  const half = size / 2;
  const [glow, g] = glowSheet(half);
  for (const f of flakes) {
    shape(g, f, 0.5);
    g.fillStyle = `rgba(255,255,255,${0.4 + f.tone * 0.5})`;
    g.fill();
  }

  return pack(map, orm, bump, glow);
}

/* ---------- 祥雲紙: vermilion paper with pale gold auspicious clouds ---------- */

/** One ruyi cloud as a list of polylines in unit space (about 4 wide, 2 tall). */
function cloudShape() {
  const spiral = (cx, cy, r0, turns, dir, start) => {
    const pts = [];
    for (let i = 0; i <= 70; i++) {
      const t = i / 70;
      const a = start + dir * t * turns * Math.PI * 2;
      const rr = r0 * (1 - 0.78 * t);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
  };
  return [
    spiral(0, 0, 0.9, 1.3, 1, Math.PI * 0.9),
    spiral(-1.15, 0.38, 0.55, 1.15, -1, Math.PI * 0.1),
    spiral(1.15, 0.38, 0.55, 1.15, 1, Math.PI * 0.9),
    // the base that ties the curls together, trailing off to one side
    Array.from({ length: 61 }, (_, i) => {
      const t = i / 60;
      return [-1.75 + t * 4.6, 0.95 + Math.sin(t * Math.PI * 1.5) * 0.08 - t * t * 0.35];
    }),
  ];
}

export function cloudTextures(size) {
  const r = rand(2718);
  const P = px(size);
  const U = size / 1024;
  const [map, c] = sheet(size);
  dye(c, size, '#b5301e', r, { drift: 0.07, blotches: 280, fibres: 5000, fibre: 0.05 });

  const unit = cloudShape();
  const clouds = [];
  const step = 0.56;
  for (let row = -4; row <= 4; row++) {
    for (let col = -4; col <= 4; col++) {
      const x = col * step + (row % 2 ? step / 2 : 0) + (r() - 0.5) * 0.08;
      const z = row * step * 0.82 + (r() - 0.5) * 0.06;
      if (Math.abs(x) > SPAN + 0.2 || Math.abs(z) > SPAN + 0.2) continue;
      const s = 0.065 + r() * 0.025;
      const flip = r() > 0.5 ? -1 : 1;
      const rot = (r() - 0.5) * 0.3;
      clouds.push(unit.map((pl) => pl.map(([u, v]) => {
        const ux = u * flip;
        return [P(x + (ux * Math.cos(rot) - v * Math.sin(rot)) * s), P(z + (ux * Math.sin(rot) + v * Math.cos(rot)) * s)];
      })));
    }
  }
  const draw = (ctx, color, width, scale) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * U * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const cl of clouds) {
      for (const pl of cl) {
        ctx.beginPath();
        pl.forEach(([x, y], i) => (i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)));
        ctx.stroke();
      }
    }
  };
  draw(c, 'rgba(120,20,10,0.35)', 7, 1); // a soft pressed shadow
  draw(c, 'rgba(232,198,124,0.78)', 3.6, 1);

  const [orm, o] = ormSheet(size, 0.9, 0);
  draw(o, ormColor(0.38, 0.85), 4, 1);

  const [bump, b] = fibreBump(size, r, 3000, 0.12);
  draw(b, 'rgba(200,200,200,0.55)', 4.5, 1);

  const half = size / 2;
  const [glow, g] = glowSheet(half);
  draw(g, 'rgba(255,255,255,0.9)', 4, 0.5);

  return pack(map, orm, bump, glow);
}

/* ---------- 墨染紙: ink-black paper, gold showing along every fold ---------- */

/** The fold lines and cut edges you can see from above, in world xz. */
function visibleCreases(tris) {
  const N = 160;
  const { height } = rasterize(tris, N);
  const cell = (2 * SPAN) / N;
  const key = (p) => `${p.x.toFixed(3)},${p.z.toFixed(3)},${p.y.toFixed(3)}`;
  const edges = new Map();
  for (const t of tris) {
    const n = new THREE.Vector3().subVectors(t[1], t[0]).cross(new THREE.Vector3().subVectors(t[2], t[0])).normalize();
    if (Math.abs(n.y) < 0.05) continue;
    if (n.y < 0) n.negate();
    for (let e = 0; e < 3; e++) {
      const p = t[e];
      const q = t[(e + 1) % 3];
      const k = [key(p), key(q)].sort().join('|');
      if (!edges.has(k)) edges.set(k, { p, q, normals: [] });
      edges.get(k).normals.push(n);
    }
  }
  const out = [];
  for (const { p, q, normals } of edges.values()) {
    const crease = normals.length === 1 || normals[0].dot(normals[1]) < 0.998;
    if (!crease) continue;
    // keep it only where it is the topmost layer
    const mx = (p.x + q.x) / 2;
    const mz = (p.z + q.z) / 2;
    const i = Math.min(N - 1, Math.max(0, Math.floor((mx + SPAN) / cell)));
    const j = Math.min(N - 1, Math.max(0, Math.floor((mz + SPAN) / cell)));
    if ((p.y + q.y) / 2 < height[j * N + i] - 0.03) continue;
    out.push([p.x, p.z, q.x, q.z]);
  }
  return out;
}

export function inkTextures(size, tris) {
  const r = rand(5150);
  const P = px(size);
  const U = size / 1024;
  const [map, c] = sheet(size);
  dye(c, size, '#141110', r, { drift: 0.04, blotches: 200, fibres: 4000, fibre: 0.04 });
  // ink washes and tide lines
  for (let i = 0; i < 70; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = size * (0.05 + r() * 0.18);
    const gr = c.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    gr.addColorStop(0, r() > 0.5 ? 'rgba(52,44,38,0.22)' : 'rgba(4,3,3,0.3)');
    gr.addColorStop(0.92, 'rgba(70,60,50,0.06)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // a few flecks of gold dust caught in the ink
  for (let i = 0; i < 500; i++) {
    c.fillStyle = `rgba(210,170,90,${0.15 + r() * 0.4})`;
    c.fillRect(r() * size, r() * size, (0.5 + r() * 1.2) * U, (0.5 + r() * 1.2) * U);
  }

  const creases = visibleCreases(tris);
  const lines = (ctx, color, width, scale) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * U * scale;
    ctx.lineCap = 'round';
    for (const [x0, z0, x1, z1] of creases) {
      ctx.beginPath();
      ctx.moveTo(P(x0) * scale, P(z0) * scale);
      ctx.lineTo(P(x1) * scale, P(z1) * scale);
      ctx.stroke();
    }
  };
  lines(c, 'rgba(200,150,60,0.18)', 14, 1);
  lines(c, 'rgba(214,170,84,0.45)', 6, 1);
  lines(c, 'rgba(246,220,150,0.95)', 2, 1);

  const [orm, o] = ormSheet(size, 0.82, 0);
  lines(o, ormColor(0.3, 1), 5, 1);

  const [bump, b] = fibreBump(size, r, 2400, 0.1);

  const half = size / 2;
  const [glow, g] = glowSheet(half);
  lines(g, 'rgba(255,255,255,0.25)', 16, 0.5);
  lines(g, 'rgba(255,255,255,0.9)', 4, 0.5);

  return pack(map, orm, bump, glow);
}

/* ---------- 蓮花紙: ivory washi with a lotus watermark ---------- */

export function lotusTextures(size) {
  const r = rand(808);
  const P = px(size);
  const U = size / 1024;
  const [map, c] = sheet(size);
  dye(c, size, '#ebe0c8', r, { drift: 0.05, blotches: 240, fibres: 3000, fibre: 0.05 });
  // long washi fibres
  c.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = r() * size;
    const y = r() * size;
    const a = r() * Math.PI * 2;
    const l = (14 + r() * 40) * U;
    c.strokeStyle = `rgba(255,252,240,${0.18 + r() * 0.25})`;
    c.lineWidth = (0.5 + r() * 0.8) * U;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }

  // Lotus: rings of petals rising from a base on the lower shell, tips toward the tail
  const bx = 0;
  const bz = 0.42;
  const petals = [];
  for (const [ang, len, wid] of [[0, 0.62, 0.17], [0.42, 0.56, 0.16], [-0.42, 0.56, 0.16], [0.85, 0.46, 0.15], [-0.85, 0.46, 0.15], [1.28, 0.34, 0.13], [-1.28, 0.34, 0.13]]) {
    petals.push({ ang, len: len * 1.4, wid: wid * 1.4 });
  }
  const petal = (ctx, p, scale) => {
    const dir = -Math.PI / 2 + p.ang;
    const ux = Math.cos(dir);
    const uz = Math.sin(dir);
    const nx = -uz;
    const nz = ux;
    const at = (a, b) => [P(bx + ux * a + nx * b) * scale, P(bz + uz * a + nz * b) * scale];
    const [x0, y0] = at(0, 0);
    const [tx, ty] = at(p.len, 0);
    const [l1x, l1y] = at(p.len * 0.45, p.wid);
    const [r1x, r1y] = at(p.len * 0.45, -p.wid);
    const [l2x, l2y] = at(p.len * 0.88, p.wid * 0.45);
    const [r2x, r2y] = at(p.len * 0.88, -p.wid * 0.45);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(l1x, l1y, l2x, l2y, tx, ty);
    ctx.bezierCurveTo(r2x, r2y, r1x, r1y, x0, y0);
    // centre vein
    const [vx, vy] = at(p.len * 0.8, 0);
    ctx.moveTo(x0, y0);
    ctx.lineTo(vx, vy);
  };
  const ripples = (ctx, scale) => {
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(P(0) * scale, P(bz + 0.08) * scale, (P(0.42 + k * 0.22) - P(0)) * scale, (P(0.09 + k * 0.05) - P(0)) * scale, 0, 0.08 * Math.PI, 0.92 * Math.PI);
      ctx.stroke();
    }
  };
  const flower = (ctx, stroke, fill, width, scale) => {
    ctx.lineWidth = width * U * scale;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // back petals first so the front ones overlap
    for (const p of [...petals].reverse()) {
      petal(ctx, p, scale);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
    ctx.strokeStyle = stroke;
    ripples(ctx, scale);
  };
  flower(c, 'rgba(178,106,98,0.5)', 'rgba(236,176,168,0.22)', 3, 1);

  const [orm] = ormSheet(size, 0.92, 0);

  // the watermark lives in the paper: a gentle emboss
  const [bump, b] = fibreBump(size, r, 3200, 0.1);
  flower(b, 'rgba(210,210,210,0.6)', 'rgba(150,150,150,0.25)', 3, 1);

  const half = size / 2;
  const [glow, g] = glowSheet(half);
  flower(g, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0.12)', 3, 0.5);

  return pack(map, orm, bump, glow);
}

/* ---------- 天賜紙: the rare one, laid entirely in gold leaf ---------- */

export function heavenTextures(size) {
  const r = rand(888);
  const P = px(size);
  const U = size / 1024;
  const [map, c] = sheet(size);
  const [orm, o] = ormSheet(size, 0.35, 1);

  // Gold leaf is laid in overlapping squares, each a slightly different tone
  const n = 9;
  const leaf = size / n;
  const lo = new THREE.Color('#a8741f');
  const hi = new THREE.Color('#e8c46a');
  c.fillStyle = '#b8862f';
  c.fillRect(0, 0, size, size);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * leaf + (r() - 0.5) * leaf * 0.08;
      const y = j * leaf + (r() - 0.5) * leaf * 0.08;
      const s = leaf * (1.04 + r() * 0.05);
      const g = c.createLinearGradient(x, y, x + s, y + s);
      const t = r();
      g.addColorStop(0, rgba(lo.clone().lerp(hi, 0.35 + t * 0.4), 1));
      g.addColorStop(0.55, rgba(lo.clone().lerp(hi, 0.65 + t * 0.35), 1));
      g.addColorStop(1, rgba(lo.clone().lerp(hi, 0.3 + t * 0.4), 1));
      c.fillStyle = g;
      c.fillRect(x, y, s, s);
      c.strokeStyle = 'rgba(120,80,25,0.28)';
      c.lineWidth = 0.8 * U;
      c.strokeRect(x, y, s, s);
      o.fillStyle = ormColor(0.22 + r() * 0.2, 1);
      o.fillRect(x, y, s, s);
    }
  }
  // hammered texture
  for (let i = 0; i < 4000; i++) {
    c.fillStyle = r() > 0.5 ? `rgba(255,240,190,${r() * 0.14})` : `rgba(110,72,18,${r() * 0.1})`;
    c.beginPath();
    c.arc(r() * size, r() * size, (1.5 + r() * 7) * U, 0, Math.PI * 2);
    c.fill();
  }

  // A sunburst of rays from the shell's crown
  const cx = P(0);
  const cy = P(-0.04);
  const rays = (ctx, color, scale) => {
    ctx.fillStyle = color;
    for (let k = 0; k < 48; k++) {
      const a0 = (k / 48) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2) / 96;
      ctx.beginPath();
      ctx.moveTo(cx * scale, cy * scale);
      ctx.lineTo((cx + Math.cos(a0) * size) * scale, (cy + Math.sin(a0) * size) * scale);
      ctx.lineTo((cx + Math.cos(a1) * size) * scale, (cy + Math.sin(a1) * size) * scale);
      ctx.closePath();
      ctx.fill();
    }
  };
  rays(c, 'rgba(255,246,210,0.1)', 1);
  // vermilion double ring and a small sun at the crown
  c.strokeStyle = 'rgba(168,40,22,0.85)';
  c.lineWidth = 4 * U;
  c.beginPath();
  c.ellipse(cx, cy, P(0.6) - P(0), P(0.68) - P(0), 0, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 1.8 * U;
  c.beginPath();
  c.ellipse(cx, cy, P(0.55) - P(0), P(0.63) - P(0), 0, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = 'rgba(168,40,22,0.85)';
  c.beginPath();
  c.arc(cx, cy, (P(0.07) - P(0)), 0, Math.PI * 2);
  c.fill();
  o.strokeStyle = ormColor(0.7, 0);
  o.lineWidth = 4 * U;
  o.beginPath();
  o.ellipse(cx, cy, P(0.6) - P(0), P(0.68) - P(0), 0, 0, Math.PI * 2);
  o.stroke();

  const [bump, b] = sheet(size / 2);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size / 2, size / 2);
  for (let i = 0; i < 2500; i++) {
    b.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
    b.beginPath();
    b.arc(r() * size * 0.5, r() * size * 0.5, (1 + r() * 4) * U, 0, Math.PI * 2);
    b.fill();
  }
  rays(b, 'rgba(255,255,255,0.08)', 0.5);

  const half = size / 2;
  const [glow, g] = glowSheet(half);
  const gr = g.createRadialGradient(cx * 0.5, cy * 0.5, 0, cx * 0.5, cy * 0.5, half * 0.55);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0.25)');
  g.fillStyle = gr;
  g.fillRect(0, 0, half, half);
  rays(g, 'rgba(255,255,255,0.3)', 0.5);

  return pack(map, orm, bump, glow);
}

/* ---------- The catalogue ---------- */

// fire: 0 ordinary, 1 vermilion, 2 star-blue, 3 gold (particles.js palettes)
// edge: colour of the glowing burn front, low → hot
// glow(time, lit): how brightly the glow mask shines
export const SPECIAL = {
  talisman: {
    make: talismanTextures,
    fire: 1,
    edge: [[1.0, 0.1, 0.04], [1.0, 0.45, 0.25]],
    glowColor: [1.0, 0.12, 0.02],
    glow: (time, lit) => (lit ? 1.15 * (0.8 + 0.2 * Math.sin(time * 7)) : 0),
  },
  stars: {
    make: starTextures,
    fire: 2,
    edge: [[0.25, 0.45, 1.0], [0.8, 0.9, 1.0]],
    glowColor: [0.75, 0.85, 1.0],
    glow: (time, lit) => (lit ? 2.0 : 0.35 + 0.25 * Math.sin(time * 1.3)),
  },
  kinpaku: {
    make: kinpakuTextures,
    fire: 3,
    edge: [[1.0, 0.4, 0.06], [1.0, 0.85, 0.45]],
    glowColor: [1.0, 0.78, 0.4],
    glow: (time, lit) => (lit ? 1.1 : 0),
  },
  cloud: {
    make: cloudTextures,
    fire: 0,
    edge: null,
    glowColor: [1.0, 0.8, 0.45],
    glow: (time, lit) => (lit ? 1.3 : 0),
  },
  ink: {
    make: inkTextures,
    fire: 3,
    edge: [[1.0, 0.4, 0.06], [1.0, 0.85, 0.45]],
    glowColor: [1.0, 0.74, 0.34],
    glow: (time, lit) => (lit ? 2.4 : 0.18 + 0.08 * Math.sin(time * 1.1)),
  },
  lotus: {
    make: lotusTextures,
    fire: 0,
    edge: null,
    glowColor: [1.0, 0.66, 0.6],
    glow: (time, lit) => (lit ? 1.4 : 0),
  },
  heaven: {
    make: heavenTextures,
    fire: 3,
    edge: [[1.0, 0.45, 0.08], [1.0, 0.9, 0.55]],
    glowColor: [1.0, 0.62, 0.22],
    glow: (time, lit) => (lit ? 1.2 : 0.1 + 0.07 * Math.sin(time * 1.6)),
  },
};
