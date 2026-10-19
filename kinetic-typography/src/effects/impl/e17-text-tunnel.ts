import { offscreen, rgba, stageCanvas } from '../../engine/canvas';
import { clamp, mod, num, PALETTE } from '../../engine/helpers';
import { asLines, fontString } from '../../engine/text';
import type { EffectContext, EffectImpl, EffectRuntime } from '../../engine/types';

// Square tube: every segment has 4 text walls + a frame at its mouth. The camera
// stays still; segments move toward it and wrap, so the flight is endless.
const SEG = 4; // segment depth
const SIDE = 4; // tube width

function wordStrip(ctx: EffectContext, w: number, h: number) {
  const word = asLines(ctx.text).replace(/\n/g, ' ');
  const o = offscreen(w, h);
  o.g.clearRect(0, 0, w, h);
  o.g.font = fontString(h * 0.62, ctx.font.sans, 900);
  o.g.textBaseline = 'middle';
  o.g.letterSpacing = `${ctx.s.tracking * h * 0.62}px`;
  const unit = word + '  ';
  const uw = Math.max(10, o.g.measureText(unit).width);
  let x = 0;
  let i = 0;
  while (x < w) {
    o.g.fillStyle = i % 2 ? ctx.s.secondary : ctx.s.primary;
    o.g.fillText(unit, x, h / 2);
    x += uw;
    i++;
  }
  return o.canvas;
}

async function createGL(ctx: EffectContext): Promise<EffectRuntime> {
  const THREE = await import('three');
  const segs = Math.round(clamp(num(ctx, 'segments', 10), 4, 16) * (ctx.lowPower ? 0.7 : 1));
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(ctx.dpr);
  renderer.setSize(ctx.width, ctx.height, false);
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  ctx.root.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const bg = new THREE.Color(ctx.s.background);
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, SEG * 1.5, SEG * segs * 0.95);
  const camera = new THREE.PerspectiveCamera(70, ctx.width / ctx.height, 0.05, 200);

  const tex = new THREE.CanvasTexture(wordStrip(ctx, 1024, 256));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const wallMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const wallGeo = new THREE.PlaneGeometry(SEG, SIDE * 0.42);
  const frameMat = new THREE.LineBasicMaterial({ color: new THREE.Color(ctx.s.secondary) });
  const h = SIDE / 2;
  const frameGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-h, -h, 0), new THREE.Vector3(h, -h, 0), new THREE.Vector3(h, h, 0), new THREE.Vector3(-h, h, 0), new THREE.Vector3(-h, -h, 0),
  ]);
  const groups: InstanceType<typeof THREE.Group>[] = [];
  for (let i = 0; i < segs; i++) {
    const g = new THREE.Group();
    // [x, y, rotX, rotY, rotZ] (Euler XYZ: Z applied first) — text runs along the depth axis
    const walls: [number, number, number, number, number][] = [
      [0, -h, -Math.PI / 2, 0, Math.PI / 2],
      [0, h, Math.PI / 2, 0, Math.PI / 2],
      [-h, 0, 0, Math.PI / 2, 0],
      [h, 0, 0, -Math.PI / 2, 0],
    ];
    for (const [x, y, rx, ry, rz] of walls) {
      const m = new THREE.Mesh(wallGeo, wallMat);
      m.position.set(x, y, -SEG / 2);
      m.rotation.set(rx, ry, rz, 'XYZ');
      g.add(m);
    }
    g.add(new THREE.Line(frameGeo, frameMat));
    scene.add(g);
    groups.push(g);
  }
  const speed = 2.4 * Math.max(0.15, ctx.s.intensity);
  let last = 0;
  const draw = (t: number) => {
    last = t;
    const travel = t * speed;
    groups.forEach((g, i) => {
      g.position.z = -mod(i * SEG - travel, segs * SEG) + SEG * 0.5;
      g.rotation.z = Math.sin(t * 0.3 + i * 0.25) * 0.05 * ctx.s.intensity;
    });
    camera.rotation.z = Math.sin(t * 0.4) * 0.08 * ctx.s.intensity;
    renderer.render(scene, camera);
  };
  return {
    canvas: renderer.domElement,
    beforeCapture: () => draw(last),
    render: draw,
    dispose() {
      wallGeo.dispose();
      frameGeo.dispose();
      wallMat.dispose();
      frameMat.dispose();
      tex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

// Canvas 2D version: same structure, manual 1/z projection.
function createLite(ctx: EffectContext): EffectRuntime {
  const sc = stageCanvas(ctx);
  const g = sc.g;
  const segs = Math.round(clamp(num(ctx, 'segments', 10), 4, 16) * (ctx.mode === 'card' ? 0.8 : 1));
  const word = asLines(ctx.text).replace(/\n/g, ' ');
  const f = ctx.height * 0.9; // focal length in px per world unit
  const cx = ctx.width / 2;
  const cy = ctx.height / 2;
  const speed = 2.4 * Math.max(0.15, ctx.s.intensity);
  const far = segs * SEG;
  return {
    canvas: sc.canvas,
    render(t) {
      sc.clear(ctx.s.background);
      const travel = t * speed;
      const zs = Array.from({ length: segs }, (_, i) => mod(i * SEG - travel, far) + 0.35).sort((a, b) => b - a);
      const roll = Math.sin(t * 0.4) * 0.08 * ctx.s.intensity;
      g.save();
      g.translate(cx, cy);
      g.rotate(roll);
      for (const z of zs) {
        const s = f / z; // px per unit at this depth
        const half = (SIDE / 2) * s;
        const fade = clamp(1 - z / far, 0, 1) ** 1.2;
        g.globalAlpha = fade;
        g.strokeStyle = ctx.s.secondary;
        g.lineWidth = Math.max(1, s * 0.02);
        g.strokeRect(-half, -half, half * 2, half * 2);
        // words on the four walls at the frame mouth, facing the camera
        const fs = SIDE * 0.16 * s;
        g.font = fontString(fs, ctx.font.sans, 900);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = ctx.s.primary;
        for (let k = 0; k < 4; k++) {
          g.save();
          g.rotate((k * Math.PI) / 2);
          g.fillText(word, 0, half - fs * 0.75);
          g.restore();
        }
      }
      g.restore();
      g.globalAlpha = 1;
      // vignette toward the vanishing point
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, ctx.height * 0.12);
      grd.addColorStop(0, rgba(ctx.s.background, 1));
      grd.addColorStop(1, rgba(ctx.s.background, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, ctx.width, ctx.height);
    },
  };
}

const impl: EffectImpl = {
  id: 'text-tunnel',
  defaults: { ...PALETTE.darkViolet, secondary: '#9D7BFF' },
  requiresWebGL: true,
  posterTime: 2,
  maxChars: 16,
  hide: ['fontScale'],
  params: [{ key: 'segments', label: '隧道節數', type: 'range', min: 4, max: 16, step: 1, default: 10 }],
  create: createGL,
  lite: createLite,
};
export default impl;
