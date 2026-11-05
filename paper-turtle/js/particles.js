import * as THREE from 'three';

const sharedUniforms = { uScale: { value: 600 }, uTime: { value: 0 } };
export const pointUniforms = sharedUniforms;

const POOL_VERT = /* glsl */ `
uniform float uScale;
attribute float aSize;
attribute vec4 aColor;
attribute float aSeed;
varying vec4 vColor;
varying float vSeed;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / -mv.z;
  vColor = aColor;
  vSeed = aSeed;
}`;

const POOL_FRAG = /* glsl */ `
uniform float uShape;
varying vec4 vColor;
varying float vSeed;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float a;
  if (uShape < 0.5) {
    float d = length(p);
    a = smoothstep(0.5, 0.0, d);
    a *= a;
  } else {
    // ash flake: an irregular, slightly rotated quad
    float c = cos(vSeed * 6.28), s = sin(vSeed * 6.28);
    p = mat2(c, -s, s, c) * p * vec2(1.0, 1.0 + vSeed);
    float d = max(abs(p.x), abs(p.y)) + 0.12 * sin(atan(p.y, p.x) * 5.0 + vSeed * 20.0);
    a = smoothstep(0.42, 0.3, d);
  }
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** CPU particle pool with a ring-buffer allocator. Behaviour comes from the kind config. */
export class Pool {
  constructor(max, kind) {
    this.max = max;
    this.kind = kind;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(1);
    this.life = new Float32Array(max).fill(1);
    this.sz = new Float32Array(max);
    this.seed = new Float32Array(max).map(() => Math.random());
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aColor', this.aColor);
    g.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: sharedUniforms.uScale, uShape: { value: kind.flake ? 1 : 0 } },
      vertexShader: POOL_VERT,
      fragmentShader: POOL_FRAG,
      transparent: true,
      depthWrite: false,
      blending: kind.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = kind.additive ? 3 : 2;
    this.col = [0, 0, 0, 0];
  }

  spawn(x, y, z, vx, vy, vz, life, size) {
    const i = this.cursor;
    this.cursor = (i + 1) % this.max;
    this.p.set([x, y, z], i * 3);
    this.v.set([vx, vy, vz], i * 3);
    this.age[i] = 0;
    this.life[i] = life;
    this.sz[i] = size;
    this.seed[i] = Math.random();
  }

  clear() {
    this.age.fill(1);
    this.life.fill(1);
  }

  update(dt, time) {
    const { p, v, age, life, sz, seed, kind, col } = this;
    const pos = this.aPos.array;
    const size = this.aSize.array;
    const color = this.aColor.array;
    const drag = Math.exp(-kind.drag * dt);
    for (let i = 0; i < this.max; i++) {
      if (age[i] >= life[i]) {
        size[i] = 0;
        continue;
      }
      age[i] += dt;
      const t = Math.min(1, age[i] / life[i]);
      const i3 = i * 3;
      const s = seed[i];
      v[i3 + 1] += kind.lift * dt;
      v[i3] += Math.sin(time * kind.swirl + s * 40 + p[i3 + 1] * 3) * kind.turb * dt;
      v[i3 + 2] += Math.cos(time * kind.swirl * 0.9 + s * 57 + p[i3 + 1] * 3) * kind.turb * dt;
      v[i3] *= drag;
      v[i3 + 1] *= drag;
      v[i3 + 2] *= drag;
      p[i3] += v[i3] * dt;
      p[i3 + 1] += v[i3 + 1] * dt;
      p[i3 + 2] += v[i3 + 2] * dt;
      pos[i3] = p[i3];
      pos[i3 + 1] = p[i3 + 1];
      pos[i3 + 2] = p[i3 + 2];
      kind.color(t, s, col, time);
      color.set(col, i * 4);
      size[i] = sz[i] * kind.size(t, s, time);
    }
    this.aPos.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aColor.needsUpdate = true;
  }
}

const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export const KINDS = {
  flame: {
    additive: true,
    drag: 1.2,
    lift: 1.6,
    turb: 1.2,
    swirl: 6,
    size: (t) => (1 - t) * (0.6 + 0.4 * Math.sin(t * Math.PI)),
    color(t, s, out) {
      const hot = clamp01(1 - t * 3);
      out[0] = 1.0;
      out[1] = mix(0.18, 0.78, hot) + s * 0.06;
      out[2] = mix(0.02, 0.38, hot * hot);
      out[3] = (1 - t) * (1 - t) * 0.55;
    },
  },
  ember: {
    additive: true,
    drag: 0.6,
    lift: 0.35,
    turb: 2.4,
    swirl: 2.2,
    size: (t, s, time) => (1 - t * 0.6) * (0.7 + 0.3 * Math.sin(time * 20 + s * 90)),
    color(t, s, out, time) {
      const f = 0.7 + 0.3 * Math.sin(time * 17 + s * 70);
      out[0] = 1.0;
      out[1] = mix(0.55, 0.22, t);
      out[2] = mix(0.18, 0.03, t);
      out[3] = (1 - t) * f;
    },
  },
  ash: {
    flake: true,
    drag: 0.9,
    lift: 0.12,
    turb: 0.9,
    swirl: 1.1,
    size: (t) => 1 - t * 0.35,
    color(t, s, out) {
      const glow = clamp01(1 - t * 6);
      const g = 0.11 + s * 0.12;
      out[0] = mix(g, 0.95, glow);
      out[1] = mix(g * 0.96, 0.32, glow);
      out[2] = mix(g * 0.92, 0.08, glow);
      out[3] = Math.min(1, t * 12) * (1 - t) * 0.9;
    },
  },
  smoke: {
    drag: 0.5,
    lift: 0.25,
    turb: 0.35,
    swirl: 0.7,
    size: (t) => 0.4 + t * 1.4,
    color(t, s, out) {
      const g = 0.32 + s * 0.08;
      out[0] = g;
      out[1] = g * 0.95;
      out[2] = g * 0.9;
      out[3] = Math.sin(t * Math.PI) * 0.06;
    },
  },
};

/* ---------- Light motes drifting in the spotlight ---------- */

export class Dust {
  constructor(count = 380) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos.set([(Math.random() - 0.5) * 7, Math.random() * 3.4, (Math.random() - 0.5) * 6], i * 3);
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.uniforms = {
      uScale: sharedUniforms.uScale,
      uTime: sharedUniforms.uTime,
      uColor: { value: new THREE.Color(1.0, 0.92, 0.8) },
      uAlpha: { value: 0.5 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        uniform float uScale, uTime;
        attribute float aSeed;
        varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.015 + aSeed * 0.03), 3.4);
          p.x += sin(uTime * 0.13 + aSeed * 30.0) * 0.35;
          p.z += cos(uTime * 0.11 + aSeed * 40.0) * 0.35;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.012 + aSeed * 0.018) * uScale / -mv.z;
          float tw = 0.5 + 0.5 * sin(uTime * (0.6 + aSeed) + aSeed * 50.0);
          // brighter inside the cone of light over the plinth
          float beam = exp(-dot(p.xz, p.xz) * 0.35);
          vA = tw * smoothstep(0.0, 0.4, p.y) * smoothstep(3.4, 2.6, p.y) * (0.25 + beam);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uAlpha;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor, a * a * vA * uAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
  }
}

/* ---------- The turtle reborn as gold dust ---------- */

export class GoldTurtle {
  constructor(targets, lift) {
    const count = targets.length / 3;
    const start = new Float32Array(count * 3);
    const delay = new Float32Array(count);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = targets[i * 3];
      const z = targets[i * 3 + 2];
      start.set([x + (Math.random() - 0.5) * 0.12, -lift + 0.01, z + (Math.random() - 0.5) * 0.12], i * 3);
      // gather from the head and shell first, flippers last
      delay[i] = Math.min(0.45, Math.hypot(x, z) * 0.18 + Math.random() * 0.18);
      seed[i] = Math.random();
      size[i] = 0.009 + Math.pow(Math.random(), 7) * 0.04;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(targets, 3));
    g.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
    g.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.uniforms = {
      uScale: sharedUniforms.uScale,
      uTime: sharedUniforms.uTime,
      uProgress: { value: 0 },
      uAlpha: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        uniform float uScale, uTime, uProgress;
        attribute vec3 aStart;
        attribute float aDelay, aSeed, aSize;
        varying float vA;
        varying vec3 vC;
        void main() {
          float t = smoothstep(aDelay, aDelay + 0.55, uProgress);
          float s = sin(t * 3.14159);
          vec3 p = mix(aStart, position, t);
          p.x += sin(aSeed * 40.0 + uTime * 1.3) * 0.32 * s;
          p.z += cos(aSeed * 53.0 + uTime * 1.1) * 0.32 * s;
          p.y += s * 0.45 * aSeed;
          p += 0.006 * t * vec3(sin(uTime * 2.0 + aSeed * 90.0), sin(uTime * 1.7 + aSeed * 70.0), cos(uTime * 2.3 + aSeed * 50.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.5 + 0.5 * sin(uTime * (1.2 + aSeed * 3.0) + aSeed * 100.0);
          float band = (position.x + position.z) * 0.7 - (mod(uTime * 0.45, 5.0) - 2.5);
          float sweep = exp(-band * band * 18.0) * t;
          gl_PointSize = aSize * uScale / -mv.z * (0.7 + 0.5 * tw + sweep * 1.4);
          vA = smoothstep(aDelay - 0.08, aDelay + 0.05, uProgress) * (0.3 + 0.5 * tw);
          vC = mix(vec3(1.0, 0.56, 0.2), vec3(1.0, 0.86, 0.62), tw * 0.7 + sweep);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        varying float vA;
        varying vec3 vC;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float core = smoothstep(0.5, 0.0, d);
          float a = core * core;
          gl_FragColor = vec4(vC * (1.0 + core * 1.5), a * vA * uAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }
}
