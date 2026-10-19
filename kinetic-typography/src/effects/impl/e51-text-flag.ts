import { drawLayout, offscreen, rgba, stageCanvas } from '../../engine/canvas';
import { clamp, num, PALETTE } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectContext, EffectImpl, EffectRuntime } from '../../engine/types';

// Detail: a Three.js plane (texture = the text on fabric) whose vertices are displaced
// in the vertex shader by three travelling waves, pinned at the pole (amplitude ∝ u^1.1).
// Normals come from finite differences of the same displacement and drive diffuse +
// a soft sheen. Lite (cards / no WebGL): the same wave field drives vertical strips
// of the texture in Canvas 2D (offset, scale and slope shading per strip).
const ASPECT = 1.6;

function flagTexture(ctx: EffectContext, TW: number, TH: number) {
  const o = offscreen(TW, TH);
  const g = o.g;
  const { primary: fg, secondary: fabric } = ctx.s;
  g.fillStyle = fabric;
  g.fillRect(0, 0, TW, TH);
  // weave
  g.fillStyle = rgba(fg, 0.02);
  for (let y = 0; y < TH; y += 6) g.fillRect(0, y, TW, 2);
  // hoist band + inset border
  g.fillStyle = fg;
  g.fillRect(0, 0, TW * 0.045, TH);
  g.strokeStyle = rgba(fg, 0.35);
  g.lineWidth = TH * 0.012;
  g.strokeRect(TW * 0.08, TH * 0.07, TW * 0.88, TH * 0.86);
  // grommets
  g.fillStyle = fabric;
  for (const y of [0.06, 0.94]) {
    g.beginPath();
    g.arc(TW * 0.0225, TH * y, TH * 0.018, 0, Math.PI * 2);
    g.fill();
  }
  const L = layoutText({ ...ctx, width: TW, height: TH }, ctx.text, { maxWidth: TW * 0.74, maxHeight: TH * 0.66, cx: TW * 0.525, cy: TH * 0.5, lineHeight: 1.1 });
  drawLayout(g, L, { fill: fg });
  return o.canvas;
}

/** Shared wave field (world units: flag width FW, height FH, x from the pole). */
function makeWave(amp: number, FW: number) {
  return (x: number, y: number, t: number) => {
    const u = x / FW;
    const A = amp * Math.pow(Math.max(0, u), 1.1);
    return A * (Math.sin(3.1 * x - 3.4 * t + 0.6 * y) + 0.45 * Math.sin(4.7 * x - 5.3 * t - 0.9 * y + 1.7) + 0.18 * Math.sin(9.0 * x - 7.7 * t + 2.1 * y));
  };
}

const VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uW;
varying vec2 vUv;
varying vec3 vN;
varying float vZ;
float wave(vec2 p) {
  float u = max(p.x / uW, 0.0);
  float A = uAmp * pow(u, 1.1);
  return A * (sin(3.1 * p.x - 3.4 * uTime + 0.6 * p.y) + 0.45 * sin(4.7 * p.x - 5.3 * uTime - 0.9 * p.y + 1.7) + 0.18 * sin(9.0 * p.x - 7.7 * uTime + 2.1 * p.y));
}
vec3 disp(vec2 p) {
  float u = max(p.x / uW, 0.0);
  float z = wave(p);
  // fabric pulls in a little along x and sags at the fly end
  return vec3(p.x - 0.05 * u * abs(z), p.y - 0.08 * u * u + 0.22 * z * u, z);
}
void main() {
  vUv = uv;
  vec2 p = position.xy;
  vec3 P = disp(p);
  float e = 0.01;
  vec3 dx = disp(p + vec2(e, 0.0)) - P;
  vec3 dy = disp(p + vec2(0.0, e)) - P;
  vN = normalize(normalMatrix * normalize(cross(dx, dy)));
  vZ = P.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vN;
varying float vZ;
void main() {
  vec4 c = texture2D(uMap, vUv);
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 l = normalize(vec3(0.45, 0.55, 1.0));
  float diff = dot(n, l);
  float shade = 0.6 + 0.5 * diff;
  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float sheen = pow(max(dot(n, h), 0.0), 36.0) * 0.18;
  gl_FragColor = vec4(c.rgb * shade + sheen, 1.0);
}`;

async function createGL(ctx: EffectContext): Promise<EffectRuntime> {
  const THREE = await import('three');
  const amp = 0.42 * num(ctx, 'wind', 1) * Math.max(0.1, ctx.s.intensity);
  const speed = num(ctx, 'speed', 1);
  const pole = ctx.s.params.pole !== false;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
  renderer.setPixelRatio(ctx.dpr);
  renderer.setSize(ctx.width, ctx.height, false);
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  ctx.root.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(ctx.s.background);

  const FH = 2;
  const FW = FH * ASPECT;
  const TW = 1024;
  const TH = Math.round(TW / ASPECT);
  const tex = new THREE.CanvasTexture(flagTexture(ctx, TW, TH));
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  const seg = Math.round(clamp(90 * ctx.q, 40, 90));
  const geo = new THREE.PlaneGeometry(FW, FH, seg, Math.round(seg / ASPECT));
  geo.translate(FW / 2, 0, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmp: { value: amp }, uW: { value: FW }, uMap: { value: tex } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
  });
  const flag = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(flag);
  const disposables: { dispose(): void }[] = [geo, mat, tex];
  const poleR = 0.045;
  if (pole) {
    const pg = new THREE.CylinderGeometry(poleR, poleR, FH + 3.2, 16);
    const pm = new THREE.MeshBasicMaterial({ color: new THREE.Color(ctx.s.primary) });
    const pm2 = new THREE.Mesh(pg, pm);
    pm2.position.set(-poleR, FH / 2 + 0.15 - (FH + 3.2) / 2, 0);
    const bg = new THREE.SphereGeometry(poleR * 2.4, 20, 12);
    const ball = new THREE.Mesh(bg, pm);
    ball.position.set(-poleR, FH / 2 + 0.15 + poleR * 2, 0);
    group.add(pm2, ball);
    disposables.push(pg, pm, bg);
  }
  group.position.set(-FW / 2 + 0.1, 0.05, 0);
  group.rotation.y = -0.42;
  group.rotation.z = 0.02;
  scene.add(group);

  // fit: both the flag width and height (+ margin) must be visible
  const fov = 32;
  const camera = new THREE.PerspectiveCamera(fov, ctx.width / ctx.height, 0.1, 100);
  const vH = 2 * Math.tan(((fov / 2) * Math.PI) / 180);
  const needH = FH * 1.75;
  const needW = FW * 1.3;
  const dist = Math.max(needH / vH, needW / (vH * camera.aspect));
  camera.position.set(0.15, 0.25, dist);
  camera.lookAt(0, 0, 0);

  let last = 0;
  const draw = (t: number) => {
    last = t;
    mat.uniforms.uTime.value = t * speed;
    group.rotation.y = -0.42 + Math.sin(t * 0.35) * 0.06;
    renderer.render(scene, camera);
  };
  return {
    canvas: renderer.domElement,
    beforeCapture: () => draw(last),
    render: draw,
    dispose() {
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

function createLite(ctx: EffectContext): EffectRuntime {
  const sc = stageCanvas(ctx);
  const g = sc.g;
  const W = ctx.width;
  const H = ctx.height;
  const pole = ctx.s.params.pole !== false;
  const speed = num(ctx, 'speed', 1);
  const FH = 2;
  const FW = FH * ASPECT;
  const amp = 0.42 * num(ctx, 'wind', 1) * Math.max(0.1, ctx.s.intensity);
  const wave = makeWave(amp, FW);
  const flagW = Math.min(W * 0.7, H * 0.56 * ASPECT);
  const flagH = flagW / ASPECT;
  const px = flagW / FW; // px per world unit
  const TW = Math.min(1024, Math.ceil(flagW * ctx.dpr * 1.2));
  const TH = Math.round(TW / ASPECT);
  const tex = flagTexture(ctx, TW, TH);
  const left = (W - flagW) / 2 + flagW * 0.03;
  const top = (H - flagH) / 2 - flagH * 0.04;
  const strips = Math.round(clamp(110 * ctx.q, 40, 110));
  const poleW = Math.max(3, flagH * 0.035);

  return {
    canvas: sc.canvas,
    render(t0) {
      const t = t0 * speed;
      sc.clear(ctx.s.background);
      if (pole) {
        g.fillStyle = ctx.s.primary;
        g.fillRect(left - poleW, top - flagH * 0.1, poleW, H);
        g.beginPath();
        g.arc(left - poleW / 2, top - flagH * 0.1 - poleW * 0.9, poleW * 1.2, 0, Math.PI * 2);
        g.fill();
      }
      let x = left;
      const dxw = FW / strips;
      for (let i = 0; i < strips; i++) {
        const x0 = i * dxw;
        const xm = x0 + dxw / 2;
        const zT = wave(xm, FH / 2, t);
        const zB = wave(xm, -FH / 2, t);
        const slope = (wave(xm + 0.01, 0, t) - wave(xm - 0.01, 0, t)) / 0.02;
        const u = xm / FW;
        // foreshortening along the wave
        const wpx = (dxw * px) / Math.sqrt(1 + slope * slope * 0.5);
        // perspective: nearer (z>0) = bigger, viewed slightly from above => z lifts
        const sT = 1 + zT * 0.16;
        const sB = 1 + zB * 0.16;
        const sag = 0.07 * u * u * px;
        const yT = top + flagH / 2 - (flagH / 2) * sT - zT * px * 0.22 + sag;
        const yB = top + flagH / 2 + (flagH / 2) * sB - zB * px * 0.22 + sag;
        const sx = (i / strips) * TW;
        g.drawImage(tex, sx, 0, TW / strips + 0.5, TH, x, yT, wpx + 0.6, yB - yT);
        // shading from the slope (normal ≈ (-slope, 0, 1))
        const nl = (-slope * 0.45 + 1) / Math.sqrt(1 + slope * slope) / 1.1;
        const shade = 0.6 + 0.5 * nl - 1;
        g.fillStyle = shade < 0 ? `rgba(0,0,0,${clamp(-shade, 0, 0.6)})` : `rgba(255,255,255,${clamp(shade * 0.8, 0, 0.3)})`;
        g.fillRect(x, yT, wpx + 0.6, yB - yT);
        x += wpx;
      }
    },
  };
}

const impl: EffectImpl = {
  id: 'text-flag',
  defaults: { ...PALETTE.teal },
  requiresWebGL: true,
  posterTime: 1.4,
  maxChars: 24,
  params: [
    { key: 'wind', label: '風力', type: 'range', min: 0.2, max: 2, step: 0.05, default: 1 },
    { key: 'speed', label: '波速', type: 'range', min: 0.3, max: 2.5, step: 0.05, default: 1 },
    { key: 'pole', label: '旗桿', type: 'toggle', default: true },
  ],
  create: createGL,
  lite: createLite,
};
export default impl;
