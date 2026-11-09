import * as THREE from 'three';

/** Half extent of the square sheet the turtle is folded from, in world units. */
export const SPAN = 1.5;

const P = (x, y, z) => new THREE.Vector3(x, y, z);
const mirror = (p) => P(-p.x, p.y, p.z);

/**
 * Faceted origami turtle, head toward +z. Returns a list of [a, b, c] triangles.
 * Shell is a pleated hexagonal dome; head, flippers and tail are creased flat folds.
 */
export function turtleTriangles() {
  const T = [];
  const tri = (a, b, c) => T.push([a, b, c]);

  // Shell
  const cz = -0.04;
  const apex = P(0, 0.5, cz);
  const inner = [];
  const outer = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    inner.push(P(Math.sin(a) * 0.4, 0.37, cz + Math.cos(a) * 0.46));
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const ridge = k % 2 === 0;
    const r = ridge ? 1 : 0.965;
    outer.push(P(Math.sin(a) * 0.8 * r, ridge ? 0.15 : 0.05, cz + Math.cos(a) * 0.92 * r));
  }
  const belly = P(0, 0.025, cz);
  for (let k = 0; k < 6; k++) {
    const k1 = (k + 1) % 6;
    const o0 = outer[2 * k];
    const o1 = outer[2 * k + 1];
    const o2 = outer[(2 * k + 2) % 12];
    tri(apex, inner[k], inner[k1]);
    tri(inner[k], o0, o1);
    tri(inner[k], o1, inner[k1]);
    tri(inner[k1], o1, o2);
  }
  for (let k = 0; k < 12; k++) tri(belly, outer[(k + 1) % 12], outer[k]);

  // Head: a creased diamond on a short neck
  const NL = P(-0.16, 0.035, 0.68);
  const NR = P(0.16, 0.035, 0.68);
  const NT = P(0, 0.15, 0.7);
  const HL = P(-0.21, 0.04, 1.1);
  const HR = P(0.21, 0.04, 1.1);
  const HT = P(0, 0.2, 1.1);
  const TIP = P(0, 0.05, 1.4);
  tri(NL, NT, HT);
  tri(NL, HT, HL);
  tri(NT, NR, HR);
  tri(NT, HR, HT);
  tri(HL, HT, TIP);
  tri(HT, HR, TIP);
  tri(NL, HL, HR);
  tri(NL, HR, NR);
  tri(HL, TIP, HR);

  // Flippers and tail, built on the left then mirrored
  const sides = (fn) => {
    fn((p) => p);
    fn(mirror);
  };
  sides((m) => {
    // Front flipper: three facets with a lifted crease
    const R1 = m(P(-0.52, 0.06, 0.55));
    const R2 = m(P(-0.74, 0.06, 0.12));
    const RM = m(P(-0.62, 0.14, 0.36));
    const M1 = m(P(-1.0, 0.075, 0.74));
    const FT = m(P(-1.42, 0.03, 0.8));
    tri(R1, RM, M1);
    tri(RM, FT, M1);
    tri(RM, R2, FT);
    // Back flipper
    const B1 = m(P(-0.5, 0.05, -0.46));
    const B2 = m(P(-0.7, 0.05, -0.12));
    const BM = m(P(-0.62, 0.11, -0.3));
    const BT = m(P(-1.06, 0.03, -0.84));
    tri(B1, BM, BT);
    tri(BM, B2, BT);
  });
  const T1 = P(-0.12, 0.04, -0.74);
  const T2 = P(0.12, 0.04, -0.74);
  const TM = P(0, 0.095, -0.78);
  const TT = P(0, 0.02, -1.2);
  tri(T1, TM, TT);
  tri(TM, T2, TT);

  return T;
}

export function buildGeometry(tris) {
  const pos = new Float32Array(tris.length * 9);
  const uv = new Float32Array(tris.length * 6);
  tris.forEach((t, i) => {
    t.forEach((p, j) => {
      pos.set([p.x, p.y, p.z], i * 9 + j * 3);
      // Planar projection from above: the sheet before it was folded
      uv.set([(p.x + SPAN) / (2 * SPAN), (p.z + SPAN) / (2 * SPAN)], i * 6 + j * 2);
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals(); // non-indexed, so every facet stays flat
  return g;
}

/** Rasterise the folded paper onto an N×N grid in sheet space: coverage mask and top height. */
export function rasterize(tris, N) {
  const mask = new Uint8Array(N * N);
  const height = new Float32Array(N * N);
  const cell = (2 * SPAN) / N;
  for (const [a, b, c] of tris) {
    const minX = Math.min(a.x, b.x, c.x);
    const maxX = Math.max(a.x, b.x, c.x);
    const minZ = Math.min(a.z, b.z, c.z);
    const maxZ = Math.max(a.z, b.z, c.z);
    const i0 = Math.max(0, Math.floor((minX + SPAN) / cell));
    const i1 = Math.min(N - 1, Math.ceil((maxX + SPAN) / cell));
    const j0 = Math.max(0, Math.floor((minZ + SPAN) / cell));
    const j1 = Math.min(N - 1, Math.ceil((maxZ + SPAN) / cell));
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(d) < 1e-6) continue;
    for (let j = j0; j <= j1; j++) {
      const z = -SPAN + (j + 0.5) * cell;
      for (let i = i0; i <= i1; i++) {
        const x = -SPAN + (i + 0.5) * cell;
        const w1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
        const w2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
        const w3 = 1 - w1 - w2;
        if (w1 < -0.02 || w2 < -0.02 || w3 < -0.02) continue;
        const k = j * N + i;
        const y = w1 * a.y + w2 * b.y + w3 * c.y;
        if (!mask[k] || y > height[k]) height[k] = y;
        mask[k] = 1;
      }
    }
  }
  return { mask, height };
}

/** Area-weighted points on the surface plus extra points along every crease. */
export function samplePoints(tris, count) {
  const areas = tris.map(([a, b, c]) => new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2);
  const total = areas.reduce((s, v) => s + v, 0);
  const edges = [];
  const seen = new Set();
  const key = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
  for (const t of tris) {
    for (let e = 0; e < 3; e++) {
      const p = t[e];
      const q = t[(e + 1) % 3];
      const k = [key(p), key(q)].sort().join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push([p, q, p.distanceTo(q)]);
    }
  }
  const edgeTotal = edges.reduce((s, e) => s + e[2], 0);
  const out = new Float32Array(count * 3);
  const onEdges = Math.floor(count * 0.32);
  const pickWeighted = (list, weights, sum) => {
    let r = Math.random() * sum;
    for (let i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  };
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    if (i < onEdges) {
      const [p, q] = pickWeighted(edges, edges.map((e) => e[2]), edgeTotal);
      v.lerpVectors(p, q, Math.random());
    } else {
      const [a, b, c] = pickWeighted(tris, areas, total);
      let r1 = Math.random();
      let r2 = Math.random();
      if (r1 + r2 > 1) {
        r1 = 1 - r1;
        r2 = 1 - r2;
      }
      v.copy(a).addScaledVector(new THREE.Vector3().subVectors(b, a), r1).addScaledVector(new THREE.Vector3().subVectors(c, a), r2);
    }
    out.set([v.x, v.y, v.z], i * 3);
  }
  return out;
}

/* ---------- Joss-paper textures ---------- */

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const FOIL = 0.4; // half size of the gold leaf square, world units

export function paperTextures(size = 1024) {
  const r = rand(7);
  const toPx = (w) => ((w + SPAN) / (2 * SPAN)) * size;
  const fx0 = toPx(-FOIL);
  const fx1 = toPx(FOIL);
  const fz0 = toPx(-FOIL - 0.04);
  const fz1 = toPx(FOIL - 0.04);

  // Colour: coarse bamboo paper with a hammered gold leaf square
  const map = document.createElement('canvas');
  map.width = map.height = size;
  const c = map.getContext('2d');
  c.fillStyle = '#b8894e';
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 6 + r() * 60;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() > 0.5;
    g.addColorStop(0, dark ? 'rgba(90,55,25,0.08)' : 'rgba(230,190,130,0.07)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  c.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const x = r() * size;
    const y = r() * size;
    const a = r() * Math.PI;
    const l = 2 + r() * 14;
    c.strokeStyle = r() > 0.55 ? `rgba(70,40,15,${0.08 + r() * 0.18})` : `rgba(240,205,150,${0.06 + r() * 0.16})`;
    c.lineWidth = 0.4 + r() * 0.9;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  // Gold leaf
  const gold = c.createLinearGradient(fx0, fz0, fx1, fz1);
  gold.addColorStop(0, '#e9c873');
  gold.addColorStop(0.45, '#c99a3c');
  gold.addColorStop(0.7, '#f1d68e');
  gold.addColorStop(1, '#b8862f');
  c.fillStyle = gold;
  c.fillRect(fx0, fz0, fx1 - fx0, fz1 - fz0);
  for (let i = 0; i < 2200; i++) {
    const x = fx0 + r() * (fx1 - fx0);
    const y = fz0 + r() * (fz1 - fz0);
    const rad = 2 + r() * 10;
    c.fillStyle = r() > 0.5 ? `rgba(255,236,180,${r() * 0.18})` : `rgba(120,80,20,${r() * 0.14})`;
    c.beginPath();
    c.arc(x, y, rad, 0, Math.PI * 2);
    c.fill();
  }
  // Vermilion print line, as on real joss paper
  const inset = (fx1 - fx0) * 0.09;
  c.strokeStyle = 'rgba(160,40,22,0.85)';
  c.lineWidth = size * 0.0045;
  c.strokeRect(fx0 + inset, fz0 + inset, fx1 - fx0 - inset * 2, fz1 - fz0 - inset * 2);
  c.lineWidth = size * 0.0018;
  c.strokeRect(fx0 + inset * 1.45, fz0 + inset * 1.45, fx1 - fx0 - inset * 2.9, fz1 - fz0 - inset * 2.9);

  // Roughness (G) and metalness (B)
  const orm = document.createElement('canvas');
  orm.width = orm.height = size;
  const o = orm.getContext('2d');
  o.fillStyle = 'rgb(255,232,0)';
  o.fillRect(0, 0, size, size);
  o.fillStyle = 'rgb(255,80,255)';
  o.fillRect(fx0, fz0, fx1 - fx0, fz1 - fz0);
  for (let i = 0; i < 1600; i++) {
    const x = fx0 + r() * (fx1 - fx0);
    const y = fz0 + r() * (fz1 - fz0);
    o.fillStyle = `rgba(255,${50 + r() * 90},255,0.5)`;
    o.beginPath();
    o.arc(x, y, 2 + r() * 8, 0, Math.PI * 2);
    o.fill();
  }
  o.strokeStyle = 'rgb(255,200,0)';
  o.lineWidth = size * 0.0045;
  o.strokeRect(fx0 + inset, fz0 + inset, fx1 - fx0 - inset * 2, fz1 - fz0 - inset * 2);

  // Fibre bump
  const bump = document.createElement('canvas');
  bump.width = bump.height = size;
  const b = bump.getContext('2d');
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);
  for (let i = 0; i < 7000; i++) {
    const x = r() * size;
    const y = r() * size;
    const a = r() * Math.PI;
    const l = 3 + r() * 16;
    b.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
    b.lineWidth = 0.6 + r();
    b.beginPath();
    b.moveTo(x, y);
    b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    b.stroke();
  }
  b.fillStyle = 'rgba(128,128,128,0.75)';
  b.fillRect(fx0, fz0, fx1 - fx0, fz1 - fz0);

  const tex = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.flipY = false; // uv (0,0) = canvas top-left = sheet corner at -x,-z
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(map, true), orm: tex(orm, false), bump: tex(bump, false) };
}

/** Coloured origami paper (kami): an even dyed sheet with a faint fibre, matte with a slight sheen. */
export function colorPaperTextures(size, hex) {
  const r = rand(parseInt(hex.slice(1), 16));
  const base = new THREE.Color(hex);
  const hsl = {};
  base.getHSL(hsl);

  const map = document.createElement('canvas');
  map.width = map.height = size;
  const c = map.getContext('2d');
  c.fillStyle = hex;
  c.fillRect(0, 0, size, size);
  // slow dye variation across the sheet
  for (let i = 0; i < 260; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 40 + r() * 160;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    const l = Math.min(0.92, Math.max(0.06, hsl.l + (r() - 0.5) * 0.08));
    const col = new THREE.Color().setHSL(hsl.h, hsl.s * (0.9 + r() * 0.15), l);
    g.addColorStop(0, `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.35)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  c.lineCap = 'round';
  for (let i = 0; i < 5000; i++) {
    const x = r() * size;
    const y = r() * size;
    const a = r() * Math.PI;
    const l = 2 + r() * 10;
    c.strokeStyle = r() > 0.5 ? `rgba(255,255,255,${0.03 + r() * 0.06})` : `rgba(0,0,0,${0.03 + r() * 0.06})`;
    c.lineWidth = 0.4 + r() * 0.7;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }

  const orm = document.createElement('canvas');
  orm.width = orm.height = 4;
  const o = orm.getContext('2d');
  o.fillStyle = 'rgb(255,190,0)';
  o.fillRect(0, 0, 4, 4);

  const bump = document.createElement('canvas');
  bump.width = bump.height = size / 2;
  const b = bump.getContext('2d');
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size / 2, size / 2);
  for (let i = 0; i < 3000; i++) {
    const x = r() * size * 0.5;
    const y = r() * size * 0.5;
    const a = r() * Math.PI;
    const l = 2 + r() * 8;
    b.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)';
    b.lineWidth = 0.5 + r() * 0.6;
    b.beginPath();
    b.moveTo(x, y);
    b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    b.stroke();
  }

  const tex = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.flipY = false;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(map, true), orm: tex(orm, false), bump: tex(bump, false) };
}

/* ---------- Burn shader ---------- */

const NOISE = /* glsl */ `
uniform sampler2D uBurn;
uniform sampler2D uGlowMap;
uniform float uGlow;
uniform vec3 uGlowColor, uEdgeLo, uEdgeHi;
uniform float uTime;
uniform float uReveal;
float tHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tNoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1,0)), u.x), mix(tHash(i + vec2(0,1)), tHash(i + vec2(1,1)), u.x), u.y);
}
float tFbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * tNoise(p); p *= 2.07; a *= 0.5; } return s; }
`;

const BURN_CORE = /* glsl */ `
  float tN = tFbm(vMapUv * 34.0);
  float tRaw = texture2D(uBurn, vMapUv).r;
  float tB = tRaw + (tN - 0.5) * 0.3 * smoothstep(0.0, 0.08, tRaw);
  float tR = tFbm(vMapUv * 5.0 + 3.1);
  if (tR > uReveal * 1.25 - 0.05) discard;
  if (tB > 0.8) discard;
`;

const NO_GLOW = (() => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
})();
const EDGE_LO = [1.0, 0.22, 0.03];
const EDGE_HI = [1.0, 0.72, 0.32];

/**
 * look: { edge: [[lo], [hi]] colour of the burn front, glowColor } for the magic papers.
 * textures.glow, when present, is a mask that shines with uGlow (driven per frame).
 */
export function createPaperMaterial(textures, burnTex, look = {}) {
  const edge = look.edge || [EDGE_LO, EDGE_HI];
  const uniforms = {
    uBurn: { value: burnTex },
    uTime: { value: 0 },
    uReveal: { value: 0 },
    uGlowMap: { value: textures.glow || NO_GLOW },
    uGlow: { value: 0 },
    uGlowColor: { value: new THREE.Color(...(look.glowColor || [0, 0, 0])) },
    uEdgeLo: { value: new THREE.Color(...edge[0]) },
    uEdgeHi: { value: new THREE.Color(...edge[1]) },
  };
  const mat = new THREE.MeshStandardMaterial({
    map: textures.map,
    roughnessMap: textures.orm,
    metalnessMap: textures.orm,
    bumpMap: textures.bump,
    bumpScale: 0.6,
    roughness: 1,
    metalness: 1,
    envMapIntensity: 0.9,
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
${BURN_CORE}
  float tScorch = smoothstep(0.015, 0.3, tB);
  float tChar = smoothstep(0.2, 0.62, tB);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.33, 0.18), tScorch);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.022, 0.018, 0.016), tChar);`
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 1.0, tScorch);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor *= 1.0 - tScorch;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  float tFl = 0.7 + 0.3 * sin(uTime * 14.0 + tN * 31.0);
  float tGlow = smoothstep(0.52, 0.72, tB) * (1.0 - smoothstep(0.77, 0.8, tB));
  float tHot = smoothstep(0.68, 0.79, tB);
  totalEmissiveRadiance += mix(uEdgeLo, uEdgeHi, tHot) * tGlow * (2.0 + 3.5 * tHot) * tFl;
  float tEmb = pow(tFbm(vMapUv * 120.0 + vec2(uTime * 0.25, -uTime * 0.18)), 5.0);
  totalEmissiveRadiance += mix(uEdgeLo, uEdgeHi, 0.12) * tChar * (1.0 - tGlow) * tEmb * 9.0 * step(tRaw, 0.985);
  // Magic papers: strokes, stars or creases light up, and go out as the paper chars
  totalEmissiveRadiance += uGlowColor * texture2D(uGlowMap, vMapUv).r * uGlow * (1.0 - tScorch) * uReveal;
  float tEdge = 1.0 - smoothstep(0.0, 0.05, uReveal * 1.25 - 0.05 - tR);
  totalEmissiveRadiance += vec3(1.0, 0.74, 0.36) * tEdge * 2.4 * step(uReveal, 0.999);`
      );
  };
  mat.customProgramCacheKey = () => 'paper-turtle-burn';

  // Shadow caster that respects the burnt holes
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: textures.map });
  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>\n${BURN_CORE}`);
  };
  depth.customProgramCacheKey = () => 'paper-turtle-burn-depth';

  return { mat, depth, uniforms };
}
