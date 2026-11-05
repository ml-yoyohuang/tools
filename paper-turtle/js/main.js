import * as THREE from 'three';
import { SPAN, turtleTriangles, buildGeometry, rasterize, samplePoints, paperTextures, colorPaperTextures, createPaperMaterial } from './turtle.js';
import { BurnSim } from './burn.js';
import { Pool, KINDS, Dust, GoldTurtle, pointUniforms } from './particles.js';
import { cnDate, makeSeal, composePoster } from './poster.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const phone = () => innerWidth <= 860;
const damp = (x, goal, k, dt) => x + (goal - x) * (1 - Math.exp(-k * dt));

const DEFAULT_PLACE = '大安森林公園';
// Always tomorrow, in the visitor's local time zone
function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const MAX_TURTLES = 7;

body.classList.add('loading');

/* ---------- Renderer & room ---------- */

const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const INK = new THREE.Color(0x090807);
scene.background = INK;
scene.fog = new THREE.Fog(INK, 12, 34);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

// Soft studio environment for the gold leaf
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0c0a08, side: THREE.BackSide })));
  const box = (w, h, x, y, z, c) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  box(6, 6, 2, 8, 3, new THREE.Color(3.2, 2.8, 2.3));
  box(3, 8, -7, 2, -2, new THREE.Color(0.7, 0.55, 0.4));
  box(8, 2, 0, 1, 7, new THREE.Color(0.35, 0.3, 0.25));
  scene.environment = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
}

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(30, 96),
  new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.94, metalness: 0, envMapIntensity: 0.12 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const SPOT = 60;
const spot = new THREE.SpotLight(0xfff0da, SPOT, 0, 0.36, 0.95, 1.5);
spot.position.set(1.3, 6.2, 2.4);
spot.castShadow = true;
spot.shadow.mapSize.setScalar(coarse ? 1024 : 2048);
spot.shadow.bias = -0.0003;
spot.shadow.normalBias = 0.015;
spot.shadow.camera.near = 3;
spot.shadow.camera.far = 40;
scene.add(spot, spot.target);

const hemi = new THREE.HemisphereLight(0x3a332a, 0x060504, 0.55);
scene.add(hemi);

const rim = new THREE.DirectionalLight(0xc9d2ff, 0.35);
rim.position.set(-4, 2.5, -5);
scene.add(rim);

const fireLight = new THREE.PointLight(0xff7428, 0, 0, 2);
const torch = new THREE.PointLight(0xffa04a, 0, 0, 2);
const goldLight = new THREE.PointLight(0xffb35c, 0, 0, 2);
goldLight.position.set(0, 0.25, 0);
scene.add(fireLight, torch, goldLight);

// Gold pool of light under the finale
const halo = new THREE.Mesh(
  new THREE.PlaneGeometry(7, 7),
  new THREE.MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(255,190,110,0.55)'], [0.25, 'rgba(210,140,60,0.18)'], [1, 'rgba(0,0,0,0)']]),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
halo.rotation.x = -Math.PI / 2;
halo.position.y = 0.004;
scene.add(halo);

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- Papers ---------- */

// Joss paper is weighted double; the rest are dyed origami sheets
const PAPERS = [
  { id: 'joss', weight: 2 },
  { id: 'vermilion', color: '#b3402b' },
  { id: 'indigo', color: '#2e4776' },
  { id: 'jade', color: '#3d7862' },
  { id: 'sakura', color: '#d6919a' },
  { id: 'wisteria', color: '#7b69a3' },
  { id: 'yamabuki', color: '#d9a33b' },
  { id: 'washi', color: '#e7ddca' },
];
const textureCache = new Map();

function texturesFor(paper) {
  if (!textureCache.has(paper.id)) {
    textureCache.set(paper.id, paper.color ? colorPaperTextures(1024, paper.color) : paperTextures(coarse ? 1024 : 2048));
  }
  return textureCache.get(paper.id);
}

function pickPaper(avoid) {
  const pool = PAPERS.filter((p) => !avoid.includes(p.id));
  const total = pool.reduce((s, p) => s + (p.weight || 1), 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight || 1;
    if (r <= 0) return p;
  }
  return pool[0];
}

/* ---------- Turtles ---------- */

const tris = turtleTriangles();
const N = 160;
const { mask, height } = rasterize(tris, N);
const geometry = buildGeometry(tris);
const ashGeometry = new THREE.PlaneGeometry(2 * SPAN, 2 * SPAN);
const ashMap = ashTexture();

function ashTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const cell = S / N;
  for (let k = 0; k < N * N; k++) {
    if (!mask[k] || Math.random() > 0.55) continue;
    const i = k % N;
    const j = (k - i) / N;
    const l = 40 + Math.random() * 70;
    g.fillStyle = `rgba(${l},${l * 0.96},${l * 0.92},${0.25 + Math.random() * 0.5})`;
    const s = cell * (0.4 + Math.random() * 1.1);
    g.fillRect(i * cell + Math.random() * cell, j * cell + Math.random() * cell, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class PaperTurtle {
  constructor(paper) {
    this.paperKind = paper;
    this.sim = new BurnSim(N, mask, height);
    this.paper = createPaperMaterial(texturesFor(paper), this.sim.tex);
    this.group = new THREE.Group();
    this.mesh = new THREE.Mesh(geometry, this.paper.mat);
    this.mesh.customDepthMaterial = this.paper.depth;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.turtle = this;
    this.ash = new THREE.Mesh(ashGeometry, new THREE.MeshBasicMaterial({ map: ashMap, transparent: true, opacity: 0, depthWrite: false }));
    this.ash.rotation.x = -Math.PI / 2;
    this.ash.position.y = 0.003;
    this.group.add(this.mesh, this.ash);
    this.reveal = 0;
    this.slot = new THREE.Vector2();
  }

  dispose() {
    this.group.removeFromParent();
    this.paper.mat.dispose();
    this.paper.depth.dispose();
    this.ash.material.dispose();
    this.sim.tex.dispose();
  }
}

const flock = new THREE.Group();
scene.add(flock);
const turtles = [];

/** Sunflower spiral, recentred, so any count sits as one loose arrangement. */
function layout() {
  const n = turtles.length;
  const pts = turtles.map((_, i) => {
    const r = n === 1 ? 0 : 1.85 * Math.sqrt(i + 0.5);
    const a = i * 2.39996 + 0.6;
    return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  });
  const c = pts.reduce((s, p) => s.add(p), new THREE.Vector2()).multiplyScalar(1 / n);
  pts.forEach((p, i) => turtles[i].slot.copy(p.sub(c)));
}

function flockRadius() {
  return turtles.reduce((m, t) => Math.max(m, t.slot.length()), 0) + 1.5;
}

function addTurtle() {
  if (turtles.length >= MAX_TURTLES) return;
  const t = new PaperTurtle(pickPaper(turtles.slice(-2).map((x) => x.paperKind.id)));
  t.group.rotation.y = turtles.length ? (Math.random() - 0.5) * 1.6 : 0;
  turtles.push(t);
  flock.add(t.group);
  layout();
  if (turtles.length === 1) t.group.position.set(0, 0, 0);
  else t.group.position.set(t.slot.x, 0, t.slot.y);
  syncAdd();
  frame(state.step);
}

function resetTurtles(count) {
  turtles.splice(0).forEach((t) => t.dispose());
  for (let i = 0; i < count; i++) addTurtle();
}

/* ---------- Particles ---------- */

const flames = new Pool(coarse ? 600 : 1000, KINDS.flame);
const embers = new Pool(400, KINDS.ember);
const ashes = new Pool(coarse ? 420 : 640, KINDS.ash);
const smoke = new Pool(110, KINDS.smoke);
const dust = new Dust(coarse ? 240 : 380);
scene.add(smoke.points, ashes.points, flames.points, embers.points, dust.points);

const LIFT = 0.42;
const goldFlock = new THREE.Group();
goldFlock.visible = false;
scene.add(goldFlock);
const goldShared = { uProgress: { value: 0 }, uAlpha: { value: 0 } };
let golds = [];

function buildGold() {
  golds.forEach((g) => {
    g.points.geometry.dispose();
    g.points.material.dispose();
  });
  goldFlock.clear();
  const per = Math.max(1600, Math.round((coarse ? 5200 : 8200) / turtles.length));
  golds = turtles.map((t) => {
    const g = new GoldTurtle(samplePoints(tris, per), LIFT);
    g.uniforms.uProgress = goldShared.uProgress;
    g.uniforms.uAlpha = goldShared.uAlpha;
    g.points.position.set(t.group.position.x, LIFT, t.group.position.z);
    g.points.rotation.y = t.group.rotation.y;
    goldFlock.add(g.points);
    return g;
  });
}

/* ---------- Camera framing ---------- */

const view = { ox: 0, oy: 0, dist: 8, elev: 0.55, azim: 0.42, ty: 0.12 };
const goal = { ...view };

function frame(step) {
  const aspect = innerWidth / innerHeight;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * aspect;
  const p = phone();
  const g = goal;
  const R = Math.max(1.55, flockRadius());
  if (step === 'intro' || step === 'finale') {
    const half = step === 'finale' ? R - 0.1 : R;
    if (p) {
      g.ox = 0;
      g.oy = 0.15;
      g.dist = Math.max(half / (tanH * 0.94), (half * 0.61) / (tanV * 0.48));
    } else {
      g.ox = 0.17;
      g.oy = 0;
      g.dist = Math.max(half / (tanH * 0.54), (half * 0.68) / (tanV * 0.62));
    }
    g.elev = step === 'finale' ? 0.42 : 0.5;
    g.ty = step === 'finale' ? LIFT + 0.1 : 0.15;
  } else {
    g.ox = 0;
    g.oy = p ? 0.02 : 0;
    g.dist = Math.max(R / (tanH * 0.9), (R * 0.78) / (tanV * 0.62));
    g.elev = 0.78;
    g.ty = 0.05;
  }
}

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  frame(state.step);
  pointUniforms.uScale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}

function placeCamera(cam, v, w, h) {
  const target = new THREE.Vector3(0, v.ty, 0);
  cam.position.set(Math.sin(v.azim) * Math.cos(v.elev), Math.sin(v.elev), Math.cos(v.azim) * Math.cos(v.elev)).multiplyScalar(v.dist).add(target);
  cam.lookAt(target);
  if (v.ox || v.oy) cam.setViewOffset(w, h, v.ox * w, v.oy * h, w, h);
  else cam.clearViewOffset();
  cam.updateProjectionMatrix();
}

/* ---------- State ---------- */

const state = { step: 'intro', done: false, doneAt: 0, prewarmed: false };
const form = $('#wish-form');
const placeEl = $('#place');
const wishEl = $('#wish');
const dateEl = $('#date');
const dateText = $('#date-text');
const igniteBtn = form.querySelector('.ignite');
const addBtn = $('#add');
const hint = $('#hint');
const meter = $('#meter');
const meterBox = meter.parentElement;
const flameEl = $('#flame');
const seal = makeSeal(240);

function setStep(step) {
  state.step = step;
  body.dataset.step = step;
  frame(step);
}

function syncAdd() {
  addBtn.disabled = turtles.length >= MAX_TURTLES || state.done;
}

addBtn.addEventListener('click', () => {
  if (state.step !== 'intro') return;
  addTurtle();
});

/* ---------- Step 1 ---------- */

placeEl.value = DEFAULT_PLACE;
dateEl.value = tomorrow();

function syncDate() {
  if (!dateEl.value) dateEl.value = tomorrow();
  dateText.textContent = cnDate(dateEl.value);
}
syncDate();
dateEl.addEventListener('change', syncDate);
dateEl.addEventListener('input', syncDate);
dateEl.addEventListener('click', () => {
  try {
    dateEl.showPicker();
  } catch {
    /* native picker opens on its own where showPicker is unavailable */
  }
});

function validate() {
  igniteBtn.disabled = !(placeEl.value.trim() && wishEl.value.trim());
}

function grow() {
  wishEl.style.height = 'auto';
  wishEl.style.height = `${wishEl.scrollHeight}px`;
}

placeEl.addEventListener('input', validate);
placeEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    wishEl.focus();
  }
});
wishEl.addEventListener('input', () => {
  wishEl.value = wishEl.value.replace(/\n/g, '');
  grow();
  validate();
});
wishEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!igniteBtn.disabled) form.requestSubmit();
  }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (igniteBtn.disabled) return;
  document.activeElement?.blur();
  $('#burn-wish').textContent = wishEl.value.trim();
  hint.classList.remove('gone');
  setMeter(0);
  setStep('burn');
});

/* ---------- Step 2: burning ---------- */

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointer = { down: false, x: 0, y: 0, last: null, id: null };

function pointerAt(e) {
  // On touch, the flame floats just above the fingertip so it stays visible
  const lift = e.pointerType === 'touch' ? 34 : 0;
  pointer.x = e.clientX;
  pointer.y = e.clientY - lift;
  flameEl.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
}

function hitPaper() {
  ndc.set((pointer.x / innerWidth) * 2 - 1, -(pointer.y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const meshes = turtles.map((t) => t.mesh);
  for (const h of raycaster.intersectObjects(meshes, false)) {
    const t = h.object.userData.turtle;
    if (t.reveal > 0.6 && !t.sim.isGone(h.uv.x, h.uv.y)) return { hit: h, turtle: t };
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (state.step !== 'burn' || state.done) return;
  pointer.down = true;
  pointer.id = e.pointerId;
  pointer.last = null;
  canvas.setPointerCapture(e.pointerId);
  pointerAt(e);
  flameEl.classList.add('on', 'lit');
});

canvas.addEventListener('pointermove', (e) => {
  if (state.step !== 'burn') return;
  pointerAt(e);
  if (e.pointerType === 'mouse' && !state.done) flameEl.classList.add('on');
});

const release = (e) => {
  if (e.pointerId !== pointer.id) return;
  pointer.down = false;
  pointer.last = null;
  flameEl.classList.remove('lit');
  if (e.pointerType !== 'mouse') flameEl.classList.remove('on');
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse' && !pointer.down) flameEl.classList.remove('on');
});

// Keyboard: Enter or Space lights a spot on a turtle still unburnt
addEventListener('keydown', (e) => {
  if (state.step !== 'burn' || state.done || (e.key !== 'Enter' && e.key !== ' ')) return;
  if (e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  const t = turtles.find((x) => !x.sim.lit) || turtles[(Math.random() * turtles.length) | 0];
  const k = t.sim.cells[(Math.random() * t.sim.cells.length) | 0];
  t.sim.ignite(((k % N) + 0.5) / N, (Math.floor(k / N) + 0.5) / N, 0.03);
});

function setMeter(p) {
  meter.style.transform = `scaleX(${p})`;
  meterBox.setAttribute('aria-valuenow', String(Math.round(p * 100)));
}

const tmp = new THREE.Vector3();
const centroid = new THREE.Vector3();

function updateBurn(dt, time) {
  // Torch from the pointer
  torch.intensity = damp(torch.intensity, 0, 10, dt);
  if (pointer.down && !state.done) {
    const found = hitPaper();
    if (found) {
      const { hit, turtle } = found;
      const uv = hit.uv;
      const last = pointer.last && pointer.last.turtle === turtle ? pointer.last.uv : null;
      const steps = last ? Math.min(12, Math.ceil(Math.hypot(uv.x - last.x, uv.y - last.y) / 0.008)) : 1;
      for (let s = 1; s <= steps; s++) {
        const f = s / steps;
        turtle.sim.ignite(last ? last.x + (uv.x - last.x) * f : uv.x, last ? last.y + (uv.y - last.y) * f : uv.y, 0.022);
      }
      pointer.last = { turtle, uv: uv.clone() };
      torch.position.copy(hit.point).add(tmp.set(0, 0.18, 0));
      torch.intensity = 1.6;
      if (turtle.sim.lit) hint.classList.add('gone');
    } else pointer.last = null;
  }

  // Flames, embers and smoke rise off each burning front; ash lifts from what is gone
  flock.updateMatrixWorld();
  const share = 1 / Math.sqrt(turtles.length);
  let hotTotal = 0;
  let progress = 0;
  let allDone = true;
  centroid.set(0, 0, 0);
  for (const t of turtles) {
    const sim = t.sim;
    sim.step(dt);
    progress += sim.progress;
    if (sim.progress <= 0.997) allDone = false;
    if (sim.lit && sim.active === 0 && sim.progress <= 0.997) sim.igniteRemaining(); // unreachable scraps
    const hot = sim.hot;
    const m = t.group.matrixWorld;
    if (hot.length) {
      hotTotal += hot.length;
      const nFlame = Math.min(16, hot.length * 0.05 + 1) * share * dt * 60;
      for (let n = 0; n < nFlame; n++) {
        sim.cellPosition(hot[(Math.random() * hot.length) | 0], tmp).applyMatrix4(m);
        flames.spawn(tmp.x, tmp.y, tmp.z, (Math.random() - 0.5) * 0.08, 0.15 + Math.random() * 0.25, (Math.random() - 0.5) * 0.08, 0.35 + Math.random() * 0.5, 0.07 + Math.random() * 0.09);
      }
      const nEmber = Math.floor(Math.min(3, hot.length * 0.004) * share * dt * 60 + Math.random());
      for (let n = 0; n < nEmber; n++) {
        sim.cellPosition(hot[(Math.random() * hot.length) | 0], tmp).applyMatrix4(m);
        embers.spawn(tmp.x, tmp.y, tmp.z, (Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4, 1.4 + Math.random() * 2.2, 0.012 + Math.random() * 0.016);
      }
      if (Math.random() < Math.min(1, hot.length / 300) * share * dt * 8) {
        sim.cellPosition(hot[(Math.random() * hot.length) | 0], tmp).applyMatrix4(m);
        smoke.spawn(tmp.x, tmp.y + 0.1, tmp.z, 0, 0.12, 0, 2.6 + Math.random() * 1.6, 0.35 + Math.random() * 0.3);
      }
      const sample = Math.min(24, hot.length);
      const local = new THREE.Vector3();
      for (let n = 0; n < sample; n++) local.add(sim.cellPosition(hot[(Math.random() * hot.length) | 0], tmp));
      centroid.add(local.multiplyScalar(1 / sample).applyMatrix4(m).multiplyScalar(hot.length));
    }
    for (const k of sim.gone) {
      if (Math.random() > 0.075 * share) continue;
      sim.cellPosition(k, tmp).applyMatrix4(m);
      ashes.spawn(tmp.x, tmp.y, tmp.z, (Math.random() - 0.5) * 0.12, 0.12 + Math.random() * 0.22, (Math.random() - 0.5) * 0.12, 2.6 + Math.random() * 3.2, 0.022 + Math.random() * 0.03);
    }
    if (!state.done) t.ash.material.opacity = Math.min(0.6, sim.progress * 0.7);
  }
  if (hotTotal) {
    centroid.multiplyScalar(1 / hotTotal).add(tmp.set(0, 0.35, 0));
    fireLight.position.lerp(centroid, fireLight.intensity < 0.05 ? 1 : 0.15);
  }
  const heat = Math.min(1, hotTotal / 500);
  const flicker = 0.75 + 0.25 * Math.sin(time * 23) * Math.sin(time * 7.3 + 1.3);
  fireLight.intensity = damp(fireLight.intensity, heat * 7 * flicker, 12, dt);

  if (!state.done) {
    setMeter(progress / turtles.length);
    if (allDone) finish(time);
  }
}

/* ---------- Step 3: finale ---------- */

function finish(time) {
  state.done = true;
  state.doneAt = time;
  state.prewarmed = false;
  body.classList.add('done');
  syncAdd();
  pointer.down = false;
  flameEl.classList.remove('on', 'lit');
  hint.classList.add('gone');
  setMeter(1);
  $('#f-wish').innerHTML = '';
  [...wishEl.value.trim()].forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch;
    s.style.setProperty('--i', i);
    $('#f-wish').append(s);
  });
  $('#f-place').textContent = placeEl.value.trim();
  $('#f-date').textContent = cnDate(dateEl.value);
  posterBlob = null;
}

function updateFinale(dt, time) {
  const t = time - state.doneAt;
  turtles.forEach((x) => (x.mesh.visible = t < 0.5));
  if (t > 1.1 && !goldFlock.visible) {
    buildGold();
    goldFlock.visible = true;
    goldFlock.rotation.y = flock.rotation.y;
    goldShared.uProgress.value = 0;
    const R = flockRadius();
    halo.scale.setScalar(Math.max(1, R / 1.5));
  }
  if (goldFlock.visible) {
    const g = goldShared;
    g.uProgress.value = Math.min(1, g.uProgress.value + dt / (reduced ? 2.5 : 5.2));
    g.uAlpha.value = damp(g.uAlpha.value, 1, 3, dt);
    goldFlock.rotation.y += dt * 0.16 * Math.min(1, g.uProgress.value * 1.5);
    halo.material.opacity = damp(halo.material.opacity, 1, 0.8, dt);
    goldLight.intensity = damp(goldLight.intensity, 2.6 * Math.sqrt(turtles.length), 1.2, dt);
    turtles.forEach((x) => (x.ash.material.opacity = damp(x.ash.material.opacity, 0, 0.9, dt)));
    spot.intensity = damp(spot.intensity, 20, 0.8, dt);
    dust.uniforms.uColor.value.lerp(new THREE.Color(1, 0.75, 0.42), dt);
    dust.uniforms.uAlpha.value = damp(dust.uniforms.uAlpha.value, 1.4, 1, dt);
  }
  if (t > 3.6 && state.step !== 'finale') setStep('finale');
  if (t > 4.4 && !body.classList.contains('revealed')) body.classList.add('revealed');
  // Have the keepsake ready before anyone taps 保存, so the share sheet opens inside the tap
  if (t > 7 && !state.prewarmed) {
    state.prewarmed = true;
    makePoster().catch(() => {});
  }
}

/* ---------- Keepsake ---------- */

const saveBtn = $('#save');
const shareBtn = $('#share');
const viewer = $('#viewer');
const viewerImg = viewer.querySelector('img');
let posterBlob = null;
let posterPending = null;

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canShareFiles = (() => {
  try {
    return !!navigator.canShare?.({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
})();
// iPhone: 保存 opens the share sheet (it holds 儲存影像). Elsewhere 保存 downloads and 分享 is separate.
shareBtn.hidden = !canShareFiles || isIOS;

function posterArt() {
  const size = 1000;
  const w = innerWidth;
  const h = innerHeight;
  const pr = renderer.getPixelRatio();
  const scale = pointUniforms.uScale.value;
  const cam = camera.clone();
  cam.far = 200;
  cam.aspect = 1;
  cam.fov = 30;
  const R = flockRadius();
  placeCamera(cam, { ox: 0, oy: 0, dist: 5.9 * Math.max(1, R / 1.5), elev: 0.42, azim: view.azim, ty: LIFT + 0.02 }, size, size);
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  pointUniforms.uScale.value = size / (2 * Math.tan(THREE.MathUtils.degToRad(15)));
  renderer.render(scene, cam);
  const art = document.createElement('canvas');
  art.width = art.height = size;
  art.getContext('2d').drawImage(renderer.domElement, 0, 0);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  pointUniforms.uScale.value = scale;
  renderer.render(scene, camera);
  return art;
}

function makePoster() {
  if (posterBlob) return Promise.resolve(posterBlob);
  if (posterPending) return posterPending;
  posterPending = (async () => {
    const c = await composePoster({
      art: posterArt(),
      wish: wishEl.value.trim(),
      place: placeEl.value.trim(),
      date: cnDate(dateEl.value),
      seal,
    });
    posterBlob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return posterBlob;
  })().finally(() => {
    posterPending = null;
  });
  return posterPending;
}

const fileName = () => `紙龜祈福-${dateEl.value.replaceAll('-', '')}.png`;
const posterFile = (blob) => new File([blob], fileName(), { type: 'image/png' });

function showViewer(blob) {
  if (viewerImg.src) URL.revokeObjectURL(viewerImg.src);
  viewerImg.src = URL.createObjectURL(blob);
  viewer.hidden = false;
  requestAnimationFrame(() => viewer.classList.add('open'));
}

viewer.addEventListener('click', () => {
  viewer.classList.remove('open');
  setTimeout(() => (viewer.hidden = true), 400);
});

async function sharePoster(blob) {
  try {
    await navigator.share({ files: [posterFile(blob)] });
    return true;
  } catch (err) {
    if (err?.name === 'AbortError') return true; // closed the sheet
    return false; // e.g. the tap's activation expired while the image was rendering
  }
}

function download(blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  try {
    const blob = posterBlob || (await makePoster());
    if (isIOS) {
      // Share sheet when possible; otherwise (in-app browsers) show the image to long-press
      if (!(canShareFiles && (await sharePoster(blob)))) showViewer(blob);
    } else {
      download(blob);
    }
  } finally {
    saveBtn.disabled = false;
  }
});

shareBtn.addEventListener('click', async () => {
  shareBtn.disabled = true;
  try {
    const blob = posterBlob || (await makePoster());
    if (!(await sharePoster(blob))) showViewer(blob);
  } finally {
    shareBtn.disabled = false;
  }
});

$('#again').addEventListener('click', () => {
  // Same wish, place, date and number of turtles; fresh papers
  body.classList.remove('revealed', 'done');
  state.done = false;
  goldFlock.visible = false;
  goldShared.uAlpha.value = 0;
  [flames, embers, ashes, smoke].forEach((p) => p.clear());
  posterBlob = null;
  resetTurtles(turtles.length);
  grow();
  validate();
  setStep('intro');
});

/* ---------- Loop ---------- */

$('#seal').src = seal.toDataURL();
const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const time = clock.elapsedTime;
  pointUniforms.uTime.value = time;

  // Each sheet materialises with a gold edge; new ones glide to their place
  const loading = body.classList.contains('loading');
  for (const t of turtles) {
    if (!loading) t.reveal = Math.min(1, t.reveal + dt / (reduced ? 0.6 : 2.6));
    t.paper.uniforms.uReveal.value = 1 - Math.pow(1 - t.reveal, 2);
    t.paper.uniforms.uTime.value = time;
    t.group.position.x = damp(t.group.position.x, t.slot.x, 3, dt);
    t.group.position.z = damp(t.group.position.z, t.slot.y, 3, dt);
  }

  const s = state.step;
  if (s === 'intro') {
    flock.rotation.y += dt * (reduced ? 0.05 : 0.14) / Math.max(1, Math.sqrt(turtles.length) * 0.8);
    halo.material.opacity = damp(halo.material.opacity, 0, 2, dt);
    goldLight.intensity = damp(goldLight.intensity, 0, 2, dt);
    spot.intensity = damp(spot.intensity, SPOT, 2, dt);
    dust.uniforms.uColor.value.lerp(new THREE.Color(1, 0.92, 0.8), dt);
    dust.uniforms.uAlpha.value = damp(dust.uniforms.uAlpha.value, 0.5, 2, dt);
  } else {
    // Settle to a three-quarter view, heads toward the viewer
    const target = Math.round(flock.rotation.y / (Math.PI * 2)) * Math.PI * 2 - 0.35;
    if (!state.done) flock.rotation.y = damp(flock.rotation.y, target, 2.2, dt);
    updateBurn(dt, time);
    if (state.done) updateFinale(dt, time);
  }

  // Wider arrangements need a wider light
  const R = flockRadius();
  spot.angle = Math.min(0.75, 0.36 * Math.max(1, R / 1.55));
  hemi.intensity = damp(hemi.intensity, Math.min(1.2, 0.55 + 0.12 * (turtles.length - 1)), 2, dt);

  view.ox = damp(view.ox, goal.ox, 1.8, dt);
  view.oy = damp(view.oy, goal.oy, 1.8, dt);
  view.dist = damp(view.dist, goal.dist, 1.6, dt);
  view.elev = damp(view.elev, goal.elev, 1.6, dt);
  view.ty = damp(view.ty, goal.ty, 1.6, dt);
  view.azim = 0.42 + (reduced ? 0 : Math.sin(time * 0.11) * 0.05);
  const sway = reduced ? 0 : Math.sin(time * 0.17) * 0.012;
  // Fog and clip range follow the camera, however far a large arrangement pushes it
  scene.fog.near = view.dist * 0.85;
  scene.fog.far = view.dist * 2.4 + 6;
  camera.far = view.dist * 3 + 10;
  placeCamera(camera, { ...view, elev: view.elev + sway }, innerWidth, innerHeight);

  smoke.update(dt, time);
  ashes.update(dt, time);
  flames.update(dt, time);
  embers.update(dt, time);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

addTurtle();
addEventListener('resize', resize);
resize();
Object.assign(view, goal);
grow();
validate();
requestAnimationFrame(tick);
document.fonts.ready.then(() => requestAnimationFrame(() => body.classList.remove('loading')));
setTimeout(() => body.classList.remove('loading'), 1200);
