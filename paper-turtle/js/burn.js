import * as THREE from 'three';
import { SPAN } from './turtle.js';

const BURN_TIME = 2.4; // seconds for one cell to go from lit to ash
const LIGHT_AT = 0.07; // a cell starts spreading once it reaches this
const SPREAD = 14; // neighbour ignition rate per second
export const GONE = 0.8; // burn value at which paper is discarded

/** Fire spreading over the unfolded sheet, uploaded to the shader as a single-channel texture. */
export class BurnSim {
  constructor(N, mask, height) {
    this.N = N;
    this.mask = mask;
    this.height = height;
    this.burn = new Float32Array(N * N);
    this.rate = new Float32Array(N * N).map(() => 0.7 + Math.random() * 0.6);
    this.data = new Uint8Array(N * N);
    this.tex = new THREE.DataTexture(this.data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
    this.total = mask.reduce((s, v) => s + v, 0);
    this.cells = [];
    for (let k = 0; k < N * N; k++) if (mask[k]) this.cells.push(k);

    // Cells just outside the paper copy a neighbour so linear filtering never darkens the edge
    this.halo = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        if (mask[k]) continue;
        let best = -1;
        for (let r = 1; r <= 2 && best < 0; r++) {
          for (let dj = -r; dj <= r && best < 0; dj++) {
            for (let di = -r; di <= r; di++) {
              const ii = i + di;
              const jj = j + dj;
              if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
              if (mask[jj * N + ii]) {
                best = jj * N + ii;
                break;
              }
            }
          }
        }
        if (best >= 0) this.halo.push(k, best);
      }
    }
    this.hot = [];
    this.gone = [];
    this.reset();
  }

  reset() {
    this.burn.fill(0);
    this.data.fill(0);
    this.tex.needsUpdate = true;
    this.active = 0;
    this.progress = 0;
    this.lit = false;
  }

  uvToCell(u, v) {
    const i = Math.min(this.N - 1, Math.max(0, Math.floor(u * this.N)));
    const j = Math.min(this.N - 1, Math.max(0, Math.floor(v * this.N)));
    return j * this.N + i;
  }

  isGone(u, v) {
    return this.burn[this.uvToCell(u, v)] >= GONE * 0.92;
  }

  /** Light every unburnt cell within radius r (in uv units). */
  ignite(u, v, r) {
    const N = this.N;
    const ci = u * N;
    const cj = v * N;
    const rr = r * N;
    let n = 0;
    for (let j = Math.floor(cj - rr); j <= Math.ceil(cj + rr); j++) {
      if (j < 0 || j >= N) continue;
      for (let i = Math.floor(ci - rr); i <= Math.ceil(ci + rr); i++) {
        if (i < 0 || i >= N) continue;
        const di = i + 0.5 - ci;
        const dj = j + 0.5 - cj;
        if (di * di + dj * dj > rr * rr) continue;
        const k = j * N + i;
        if (this.mask[k] && this.burn[k] === 0) {
          this.burn[k] = LIGHT_AT * (0.4 + Math.random() * 0.8);
          n++;
        }
      }
    }
    if (n) this.lit = true;
    return n;
  }

  igniteRemaining() {
    for (const k of this.cells) if (this.burn[k] === 0) this.burn[k] = 0.001 + Math.random() * 0.2;
  }

  step(dt) {
    const { N, burn, mask, rate, data } = this;
    const inc = dt / BURN_TIME;
    const p = dt * SPREAD;
    const pd = p * 0.5;
    this.hot.length = 0;
    this.gone.length = 0;
    let active = 0;
    let gone = 0;
    for (const k of this.cells) {
      let v = burn[k];
      if (v > 0 && v < 1) {
        const prev = v;
        v = Math.min(1, v + inc * rate[k]);
        burn[k] = v;
        active++;
        if (prev >= LIGHT_AT && v < 0.9) {
          const i = k % N;
          const j = (k - i) / N;
          if (i > 0 && mask[k - 1] && burn[k - 1] === 0 && Math.random() < p) burn[k - 1] = 1e-4;
          if (i < N - 1 && mask[k + 1] && burn[k + 1] === 0 && Math.random() < p) burn[k + 1] = 1e-4;
          if (j > 0 && mask[k - N] && burn[k - N] === 0 && Math.random() < p) burn[k - N] = 1e-4;
          if (j < N - 1 && mask[k + N] && burn[k + N] === 0 && Math.random() < p) burn[k + N] = 1e-4;
          if (i > 0 && j > 0 && mask[k - N - 1] && burn[k - N - 1] === 0 && Math.random() < pd) burn[k - N - 1] = 1e-4;
          if (i < N - 1 && j < N - 1 && mask[k + N + 1] && burn[k + N + 1] === 0 && Math.random() < pd) burn[k + N + 1] = 1e-4;
          if (i > 0 && j < N - 1 && mask[k + N - 1] && burn[k + N - 1] === 0 && Math.random() < pd) burn[k + N - 1] = 1e-4;
          if (i < N - 1 && j > 0 && mask[k - N + 1] && burn[k - N + 1] === 0 && Math.random() < pd) burn[k - N + 1] = 1e-4;
        }
        if (v > 0.3 && v < GONE) this.hot.push(k);
        if (prev < GONE && v >= GONE) this.gone.push(k);
      }
      if (v >= GONE) gone++;
      data[k] = v * 255;
    }
    const h = this.halo;
    for (let n = 0; n < h.length; n += 2) data[h[n]] = data[h[n + 1]];
    this.tex.needsUpdate = true;
    this.active = active;
    this.progress = gone / this.total;
  }

  /** Local-space position on top of the paper for a cell. */
  cellPosition(k, out) {
    const N = this.N;
    const i = k % N;
    const j = (k - i) / N;
    const cell = (2 * SPAN) / N;
    return out.set(-SPAN + (i + Math.random()) * cell, this.height[k] + 0.01, -SPAN + (j + Math.random()) * cell);
  }
}
