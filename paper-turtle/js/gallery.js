import * as THREE from 'three';
import { pointUniforms } from './particles.js';

/*
 * The gallery: every turtle ever burned on this device, drifting as gold dust in the dark.
 * All of them share one Points draw call; each vertex carries its turtle's centre, heading
 * and seed, and the vertex shader does the swimming. drift() below mirrors that shader so
 * taps can be matched to a turtle on the CPU.
 */

export const SKY_SCALE = 0.42;

const VERT = /* glsl */ `
  uniform float uScale, uTime, uIntro, uSel, uSelT, uMinPx, uFar;
  attribute vec3 aCenter;
  attribute vec4 aTurtle; // heading, seed, index, order (0 newest → 1 oldest)
  attribute float aSeed, aSize;
  varying float vA;
  varying vec3 vC;

  vec3 drift(vec3 c, float s, float t) {
    return c + vec3(sin(t * 0.13 + s * 20.0) * 0.22, sin(t * 0.21 + s * 31.0) * 0.14, cos(t * 0.11 + s * 17.0) * 0.22);
  }

  void main() {
    float s = aTurtle.y;
    float yaw = aTurtle.x + sin(uTime * 0.07 + s * 9.0) * 0.3;
    float pitch = sin(s * 47.0) * 0.22 + sin(uTime * 0.5 + s * 13.0) * 0.05;
    float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch);
    vec3 l = position;
    l = vec3(l.x, l.y * cp - l.z * sp, l.y * sp + l.z * cp);
    l = vec3(l.x * cy + l.z * sy, l.y, -l.x * sy + l.z * cy);

    float appear = smoothstep(aTurtle.w * 0.6, aTurtle.w * 0.6 + 0.4, uIntro);
    vec3 p = drift(aCenter, s, uTime) + l;
    p.y -= (1.0 - appear) * 0.35;
    p += 0.004 * vec3(sin(uTime * 2.0 + aSeed * 90.0), sin(uTime * 1.7 + aSeed * 70.0), cos(uTime * 2.3 + aSeed * 50.0));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float sel = 1.0 - step(0.5, abs(aTurtle.z - uSel));
    float tw = 0.5 + 0.5 * sin(uTime * (1.2 + aSeed * 3.0) + aSeed * 100.0);
    float band = (l.x + l.z) * 1.6 - (mod(uTime * 0.35 + s * 7.0, 6.0) - 3.0);
    float sweep = exp(-band * band * 6.0);
    gl_PointSize = max(uMinPx, aSize * uScale / -mv.z * (0.7 + 0.5 * tw + sweep)) * (1.0 + sel * uSelT * 0.35);

    float depth = clamp(1.35 - -mv.z / uFar, 0.3, 1.0);
    float dim = 1.0 - uSelT * 0.55 * (1.0 - sel);
    vA = appear * (0.45 + 0.65 * tw) * depth * dim * (1.0 + sel * uSelT * 0.5);
    vC = mix(vec3(1.0, 0.52, 0.16), vec3(1.0, 0.84, 0.56), tw * 0.5 + sweep * 0.5 + sel * uSelT * 0.45);
  }`;

const FRAG = /* glsl */ `
  uniform float uAlpha;
  varying float vA;
  varying vec3 vC;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vC * (1.0 + core * 1.5), core * core * vA * uAlpha);
  }`;

/** Same motion as the shader's drift(), for picking. */
export function drift(out, x, y, z, s, t) {
  return out.set(x + Math.sin(t * 0.13 + s * 20) * 0.22, y + Math.sin(t * 0.21 + s * 31) * 0.14, z + Math.cos(t * 0.11 + s * 17) * 0.22);
}

export class Sky {
  /**
   * @param {Float32Array} sample turtle-local points (x, y, z), shuffled; the more the finer
   * @param {number} count turtles to show, newest first
   * @param {number} budget total points across all turtles
   */
  constructor(sample, count, budget) {
    const per = Math.max(36, Math.min(sample.length / 3, Math.floor(budget / count)));
    // Fewer points per turtle → each point a little larger, so the silhouette still reads
    const grain = Math.min(4.5, Math.max(1.35, Math.sqrt(4200 / per)));
    const total = per * count;
    const pos = new Float32Array(total * 3);
    const center = new Float32Array(total * 3);
    const turtle = new Float32Array(total * 4);
    const seed = new Float32Array(total);
    const size = new Float32Array(total);

    // Newest at the heart, older ones further out: a loose, flattened ball
    this.radius = count === 1 ? 0 : 1.05 * Math.cbrt(count) + 0.5;
    this.count = count;
    this.centers = new Float32Array(count * 3);
    this.seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = count === 1 ? 0 : this.radius * Math.cbrt((i + 0.5) / count);
      const yN = 1 - (2 * (i + 0.5)) / count;
      const ring = Math.sqrt(Math.max(0, 1 - yN * yN));
      const a = i * 2.39996;
      this.centers.set([Math.cos(a) * ring * r, yN * r * 0.5, Math.sin(a) * ring * r], i * 3);
      this.seeds[i] = Math.random();
    }

    let k = 0;
    for (let i = 0; i < count; i++) {
      const heading = Math.random() * Math.PI * 2;
      const order = count === 1 ? 0 : i / (count - 1);
      const start = Math.floor(Math.random() * (sample.length / 3));
      for (let j = 0; j < per; j++, k++) {
        const q = ((start + j) % (sample.length / 3)) * 3;
        pos.set([sample[q] * SKY_SCALE, sample[q + 1] * SKY_SCALE, sample[q + 2] * SKY_SCALE], k * 3);
        center.set(this.centers.subarray(i * 3, i * 3 + 3), k * 3);
        turtle.set([heading, this.seeds[i], i, order], k * 4);
        seed[k] = Math.random();
        size[k] = (0.009 + Math.pow(Math.random(), 7) * 0.04) * SKY_SCALE * grain;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCenter', new THREE.BufferAttribute(center, 3));
    g.setAttribute('aTurtle', new THREE.BufferAttribute(turtle, 4));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

    this.uniforms = {
      uScale: pointUniforms.uScale,
      uTime: pointUniforms.uTime,
      uIntro: { value: 0 },
      uAlpha: { value: 0 },
      uSel: { value: -1 },
      uSelT: { value: 0 },
      uMinPx: { value: 1.4 },
      uFar: { value: 10 },
    };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  dispose() {
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
