import { CELL, GN } from './geometry.js';
import { clamp } from './util.js';

// 一層的刮印紀錄。紙張座標切成 GN × GN 格，每格累積：
//   ink     出墨量（一次正常刮印約 1）
//   fast    刮太快的程度（0..1）
//   excess  溢墨量（太慢、停住、刮太多次）
//   passes  被刮過幾次
//   pick[j] 刮板沾到第 j 層未乾墨的程度（0..1）
export function createRecord(priorCount = 0) {
  const n = GN * GN;
  return {
    grid: {
      ink: new Float32Array(n), fast: new Float32Array(n), excess: new Float32Array(n),
      passes: new Uint16Array(n), stamp: new Int32Array(n)
    },
    pick: Array.from({ length: priorCount }, () => new Float32Array(n)),
    dirSum: [0, 0], dirAbs: [0, 0],
    strokeId: 0, strokes: 0,
    trail: [], carry: [], last: null, v: 0
  };
}

export function fastness(v, C) {
  return clamp((v - C.speedFastStart) / (C.speedFastFull - C.speedFastStart), 0, 1);
}
export function slowness(v, C) {
  return clamp((C.speedSlow - v) / C.speedSlow, 0, 1);
}

// b：刮板中心（已限制在網框內），t：毫秒時間戳
export function startStroke(rec, b, t) {
  rec.strokeId++;
  rec.strokes++;
  rec.last = { x: b.x, y: b.y, t };
  rec.trail = [{ t, s: 0 }];
  rec.carry = rec.pick.map(() => new Float32Array(GN));
}

// under：前面各層目前的狀態 [{ wet, cover }]，用於未乾沾染。
// 有移動時回傳 true，並更新 rec.v（px/ms）。
export function moveStroke(rec, b, t, under, C) {
  const a = rec.last;
  const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
  if (dist < 0.5) return false;
  // 速度以最近一個時間窗內的移動距離計算，避免事件時間戳抖動造成尖峰
  const tr = rec.trail, s = tr[tr.length - 1].s + dist;
  tr.push({ t, s });
  while (tr.length > 2 && tr[1].t < t - C.speedWindow) tr.shift();
  const a0 = tr[0];
  rec.v = (s - a0.s) / Math.max(t - a0.t, 1);
  sweep(rec, a, b, rec.v, under, C);
  rec.dirSum[0] += dx; rec.dirSum[1] += dy;
  rec.dirAbs[0] += Math.abs(dx); rec.dirAbs[1] += Math.abs(dy);
  rec.last = { x: b.x, y: b.y, t };
  return true;
}

function touch(rec, k, d, f, slow, C) {
  const g = rec.grid;
  if (g.stamp[k] === rec.strokeId) return;
  g.stamp[k] = rec.strokeId;
  g.passes[k]++;
  g.ink[k] += d;
  g.fast[k] = f > 0.05 ? Math.max(g.fast[k], f) : g.fast[k] * 0.4;
  g.excess[k] += slow * C.slowExcess;
  if (g.passes[k] > C.freePasses) g.excess[k] += C.repeatExcess;
}

function sweep(rec, a, b, v, under, C) {
  const h = C.bladeLength / 2;
  const f = fastness(v, C), slow = slowness(v, C), d = 1 - (1 - C.fastInkMin) * f;
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  for (let i = 1; i <= n; i++) {
    const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
    const row = clamp(Math.floor(y / CELL), 0, GN - 1);
    const c0 = clamp(Math.floor((x - h) / CELL), 0, GN - 1), c1 = clamp(Math.floor((x + h) / CELL), 0, GN - 1);
    for (let c = c0; c <= c1; c++) touch(rec, row * GN + c, d, f, slow, C);
    // 未乾時，刮板把下層的墨帶上網，並沿刮的方向拖一小段
    for (let j = 0; j < under.length; j++) {
      const u = under[j];
      if (!(u.wet > 0 && u.cover)) continue;
      const carry = rec.carry[j], pk = rec.pick[j];
      for (let c = c0; c <= c1; c++) {
        const kk = row * GN + c;
        carry[c] = carry[c] * C.pickCarry + u.wet * u.cover[kk] * (1 - C.pickCarry);
        if (carry[c] > pk[kk]) pk[kk] = carry[c];
      }
    }
  }
}

// 刮板停住不動時，壓著的格子持續累積溢墨
export function dwell(rec, dt, C) {
  const g = rec.grid, b = rec.last, h = C.bladeLength / 2;
  const row = clamp(Math.floor(b.y / CELL), 0, GN - 1);
  const c0 = clamp(Math.floor((b.x - h) / CELL), 0, GN - 1), c1 = clamp(Math.floor((b.x + h) / CELL), 0, GN - 1);
  const add = C.dwellExcessPerSec * dt;
  for (let r = Math.max(0, row - 1); r <= Math.min(GN - 1, row + 1); r++)
    for (let c = c0; c <= c1; c++) { const k = r * GN + c; if (g.passes[k]) g.excess[k] += add; }
}
