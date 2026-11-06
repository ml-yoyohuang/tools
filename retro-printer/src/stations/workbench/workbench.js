import { CONFIG as C } from '../../config.js';
import { W, S, PW } from '../../engine/geometry.js';
import { clamp } from '../../engine/util.js';
import { startStroke, moveStroke, dwell } from '../../engine/record.js';
import { printLayer, compositeJob } from '../../engine/print.js';
import { createJob } from '../../state.js';
import { createPanel } from '../../ui/panel.js';
import { FRAME, MESH, buildFrame, buildMarks, createMeshInk } from './overlay.js';

// 工作桌：一層一層 放下網框 → 倒墨 → 刮印 → 掀框 → 等乾。
// 每層都經過同樣的五步，最後一層的第五步為「完成」。
const STEPS = ['放下網框', '倒墨', '刮印', '掀框', '等乾'];
const STEPS_LAST = ['放下網框', '倒墨', '刮印', '掀框', '完成'];
const PHASE_STEP = { place: 0, ink: 1, squeegee: 2, lift: 3, dry: 4, done: 4 };
const COUNT = ['零', '一', '兩', '三', '四', '五', '六', '七', '八', '九'];
const VMAX = 2.6;       // 速度條最大值 px/ms
const LIFT_MS = 700;

export function mountWorkbench(root, { plates, inks, medium }) {
  const stage = document.createElement('section');
  stage.className = 'stage';
  stage.innerHTML = `<div class="sheet">
      <canvas class="paper" width="${PW}" height="${PW}"></canvas>
      <canvas class="overlay" width="${PW}" height="${PW}"></canvas>
    </div>`;
  root.appendChild(stage);
  const paper = stage.querySelector('.paper'), overlay = stage.querySelector('.overlay');
  const pctx = paper.getContext('2d'), octx = overlay.getContext('2d');
  stage.querySelector('.sheet').style.background = `rgb(${medium.paper.join(',')})`;

  const panel = createPanel(root, { title: '工作桌' });
  panel.setMeterZone(C.speedSlow / VMAX, C.speedFastStart / VMAX);

  const frames = plates.map((p, i) => buildFrame(p, inks[i].rgb));
  const marks = inks.map(ink => buildMarks(ink.rgb));
  const meshInk = createMeshInk();

  let job, st;
  const layer = () => job.layers[st.L];
  const isLast = () => st.L === job.layers.length - 1;
  const maxWet = () => job.layers.reduce((m, l) => Math.max(m, l.wet), 0);

  /* ───────── 流程 ───────── */
  function reset() {
    job = createJob({ plates, inks, medium });
    st = {
      L: 0, phase: 'place', inkPlaced: false,
      pressing: false, lastMoveT: 0, vShow: 0,
      hover: null, drag: null, dryer: false, liftStart: 0, busy: false
    };
    pctx.fillStyle = `rgb(${medium.paper.join(',')})`;
    pctx.fillRect(0, 0, PW, PW);
    meshInk.markDirty();
    ui();
  }

  function primaryAction() {
    if (st.busy) return;
    const ph = st.phase;
    if (ph === 'place') st.phase = 'ink';
    else if (ph === 'ink') pourInk();
    else if (ph === 'squeegee' && layer().rec.strokes > 0) lift();
    else if (ph === 'dry') nextLayer();
    ui();
  }

  function pourInk() {
    st.inkPlaced = true;
    st.phase = 'squeegee';
    meshInk.markDirty();
    ui();
  }

  function lift() {
    st.phase = 'lift';
    st.pressing = false;
    st.busy = true;
    ui();
    requestAnimationFrame(() => setTimeout(() => {
      printLayer(job, st.L, C);
      paintPrint();
      st.liftStart = performance.now();
    }, 30));
  }

  function finishLift() {
    st.liftStart = 0;
    st.busy = false;
    if (isLast()) st.phase = 'done';
    else { st.phase = 'dry'; layer().wet = 1; }
    ui();
  }

  function nextLayer() {
    st.L++;
    st.phase = 'place';
    const ang = Math.random() * Math.PI * 2, r = 20 + Math.random() * 15;
    layer().offset = [Math.round(Math.cos(ang) * r), Math.round(Math.sin(ang) * r)];
    st.inkPlaced = false;
    meshInk.markDirty();
  }

  function paintPrint() {
    const img = pctx.createImageData(PW, PW);
    img.data.set(compositeJob(job, C));
    pctx.putImageData(img, 0, 0);
  }

  /* ───────── 刮印 ───────── */
  function bladePos(p) {
    const [ox, oy] = layer().offset, h = C.bladeLength / 2;
    return {
      x: clamp(p.x, MESH.x + ox + h, MESH.x + ox + MESH.w - h),
      y: clamp(p.y, MESH.y + oy + 6, MESH.y + oy + MESH.h - 6)
    };
  }
  const underLayers = () => job.layers.slice(0, st.L).map(l => ({ wet: l.wet, cover: l.cover }));

  function beginStroke(p, t) {
    const l = layer();
    st.pressing = true;
    st.inkPlaced = false;
    startStroke(l.rec, bladePos(p), t);
    st.lastMoveT = t;
    for (let j = 0; j < st.L; j++) l.wetAt[j] = Math.max(l.wetAt[j], job.layers[j].wet);
    ui();
  }

  function continueStroke(p, t) {
    const l = layer();
    if (moveStroke(l.rec, bladePos(p), t, underLayers(), C)) {
      st.vShow = l.rec.v;
      st.lastMoveT = t;
      meshInk.markDirty();
    }
  }

  /* ───────── 介面 ───────── */
  function ui() {
    const l = layer(), ph = st.phase, n = job.layers.length;
    panel.setLayer(st.L, n, l.ink);
    panel.setSteps(isLast() ? STEPS_LAST : STEPS, PHASE_STEP[ph]);

    let hint = '', label = '', enabled = true, visible = true;
    switch (ph) {
      case 'place':
        hint = st.L === 0 ? '網框位置已固定。' : '拖動網框或用方向鍵，對齊十字標記。';
        label = '放下網框';
        break;
      case 'ink':
        hint = '點一下網框，在上緣倒一條墨。';
        label = '倒墨';
        break;
      case 'squeegee':
        hint = '按住刮板，拖過整個圖案。';
        label = '掀框';
        enabled = l.rec.strokes > 0 && !st.pressing;
        break;
      case 'lift':
        label = '掀框'; enabled = false;
        break;
      case 'dry':
        hint = maxWet() > 0 ? '等墨乾，或按住吹風機。' : '墨已乾。';
        label = '下一層';
        break;
      case 'done':
        hint = `${COUNT[n] || n}層完成。`;
        visible = false;
        break;
    }
    panel.setHint(hint);
    panel.setPrimary({ label, enabled, visible });
    panel.showMeter(ph === 'squeegee');

    const wet = maxWet() > 0;
    const beforePrint = st.L > 0 && (ph === 'place' || ph === 'ink' || (ph === 'squeegee' && l.rec.strokes === 0));
    panel.showDry((wet && (ph === 'dry' || beforePrint)) || (ph === 'dry' && !wet));
    panel.setDownload(!!job.layers[0].alpha);

    overlay.style.cursor =
      ph === 'place' && st.L > 0 ? (st.drag ? 'grabbing' : 'grab') :
      ph === 'ink' ? 'pointer' :
      ph === 'squeegee' ? 'none' : 'default';
  }

  // 塞網時，網上的墨變得暗沉
  const inkOnMesh = () => {
    const k = layer().clog * 0.5;
    return layer().ink.rgb.map(v => Math.round(v + (92 - v) * k));
  };

  /* ───────── 網框層 ───────── */
  function drawOverlay(now) {
    octx.clearRect(0, 0, PW, PW);
    const L = st.L, ph = st.phase, l = layer();
    if (ph === 'dry' || ph === 'done') return;
    const [ox, oy] = l.offset;
    let alpha = L === 0 ? 1 : C.wetFrameAlpha, lift = 0;
    if (ph === 'lift' && st.liftStart) {
      const p = clamp((now - st.liftStart) / LIFT_MS, 0, 1);
      lift = 1 - Math.pow(1 - p, 3);
      alpha *= 1 - p;
      if (p >= 1) { finishLift(); return; }
    }
    const shift = -lift * 48;

    octx.globalAlpha = alpha;
    octx.drawImage(frames[L], (FRAME.x + ox) * S, (FRAME.y + oy + shift) * S);
    if (L > 0 && ph === 'place') {
      octx.globalAlpha = 1;
      octx.drawImage(marks[L], (FRAME.x + ox) * S, (FRAME.y + oy) * S);
      octx.globalAlpha = alpha;
    }

    if (ph === 'squeegee' || ph === 'lift') {
      const picks = job.layers.slice(0, L).map((u, j) => ({ rgb: u.ink.rgb, pick: l.rec.pick[j] }));
      meshInk.update(l.rec.grid, inkOnMesh(), picks, C);
      octx.save();
      octx.beginPath();
      octx.rect((MESH.x + ox) * S, (MESH.y + oy + shift) * S, MESH.w * S, MESH.h * S);
      octx.clip();
      octx.imageSmoothingEnabled = true;
      octx.drawImage(meshInk.canvas, 0, shift * S, PW, PW);
      octx.restore();
    }
    octx.globalAlpha = 1;

    const [r, g, b] = l.ink.rgb;
    const barX = (MESH.x + ox + 40) * S, barW = (MESH.w - 80) * S, barY = (MESH.y + oy + 14) * S;
    if (ph === 'ink' && st.hover) {
      octx.fillStyle = `rgba(${r},${g},${b},0.35)`;
      octx.fillRect(barX, barY, barW, 8 * S);
    }
    if (ph === 'squeegee' && st.inkPlaced) {
      octx.fillStyle = `rgb(${inkOnMesh().join(',')})`;
      octx.fillRect(barX, barY, barW, 8 * S);
    }

    if (ph === 'squeegee' && (st.hover || st.pressing)) {
      const bp = st.pressing ? l.rec.last : bladePos(st.hover), h = C.bladeLength / 2;
      octx.fillStyle = st.pressing ? '#151514' : 'rgba(21,21,20,0.72)';
      octx.fillRect((bp.x - h) * S, (bp.y - 4) * S, C.bladeLength * S, 8 * S);
    }
  }

  /* ───────── 主迴圈 ───────── */
  let prevT = performance.now(), raf = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - prevT) / 1000);
    prevT = now;
    const l = layer();

    // 等乾：所有已印的層一起變乾
    if (st.phase !== 'lift') {
      let dried = false;
      for (const u of job.layers) {
        if (u.wet > 0) {
          u.wet = Math.max(0, u.wet - dt / C.dryTime * (st.dryer ? C.dryerBoost : 1));
          if (u.wet === 0) dried = true;
        }
      }
      if (dried) ui();
    }
    if (panel.isDryShown()) panel.setDry(1 - maxWet());

    // 墨在網上閒置太久會塞網；刮印時重新計時，但已塞住的不會恢復
    if (st.phase === 'squeegee') {
      if (st.pressing) l.idle = 0;
      else {
        l.idle += dt;
        if (l.idle > C.clogGrace) {
          const before = l.clog;
          l.clog = Math.min(1, l.clog + dt / C.clogTime);
          if (Math.floor(before * 20) !== Math.floor(l.clog * 20)) meshInk.markDirty();
        }
      }
    }

    if (st.pressing && now - st.lastMoveT > 120) {
      dwell(l.rec, dt, C);
      st.vShow *= 0.85;
    } else if (!st.pressing) {
      st.vShow *= 0.9;
    }
    if (st.phase === 'squeegee') panel.setMeter(clamp(st.vShow / VMAX, 0, 1));

    drawOverlay(now);
    raf = requestAnimationFrame(frame);
  }

  /* ───────── 輸入 ───────── */
  const toL = e => {
    const r = overlay.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * W };
  };
  const inFrame = p => {
    const [ox, oy] = layer().offset;
    return p.x >= FRAME.x + ox && p.x <= FRAME.x + ox + FRAME.w && p.y >= FRAME.y + oy && p.y <= FRAME.y + oy + FRAME.h;
  };
  const setOffset = (x, y) => {
    layer().offset = [clamp(x, -C.maxOffset, C.maxOffset), clamp(y, -C.maxOffset, C.maxOffset)];
  };

  overlay.addEventListener('pointerdown', e => {
    if (st.busy) return;
    const p = toL(e);
    st.hover = p;
    if (st.phase === 'place' && st.L > 0 && inFrame(p)) {
      st.drag = { p, o: layer().offset.slice() };
      overlay.setPointerCapture(e.pointerId);
      ui();
    } else if (st.phase === 'ink') {
      pourInk();
    } else if (st.phase === 'squeegee') {
      overlay.setPointerCapture(e.pointerId);
      beginStroke(p, e.timeStamp);
    }
  });
  overlay.addEventListener('pointermove', e => {
    const p = toL(e);
    st.hover = p;
    if (st.drag) {
      setOffset(st.drag.o[0] + p.x - st.drag.p.x, st.drag.o[1] + p.y - st.drag.p.y);
    } else if (st.pressing) {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (evs.length) for (const ce of evs) continueStroke(toL(ce), ce.timeStamp);
      else continueStroke(p, e.timeStamp);
    }
  });
  const endPointer = () => {
    if (st.drag) { st.drag = null; ui(); }
    if (st.pressing) { st.pressing = false; ui(); }
  };
  overlay.addEventListener('pointerup', endPointer);
  overlay.addEventListener('pointercancel', endPointer);
  overlay.addEventListener('pointerleave', () => { if (!st.pressing && !st.drag) st.hover = null; });

  const onKey = e => {
    if (st.phase !== 'place' || st.L === 0) return;
    const step = e.shiftKey ? 10 : 1, [x, y] = layer().offset;
    if (e.key === 'ArrowLeft') setOffset(x - step, y);
    else if (e.key === 'ArrowRight') setOffset(x + step, y);
    else if (e.key === 'ArrowUp') setOffset(x, y - step);
    else if (e.key === 'ArrowDown') setOffset(x, y + step);
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  panel.onDryer(on => { st.dryer = on; });
  panel.onPrimary(primaryAction);
  panel.onReset(reset);
  panel.onDownload(() => {
    paper.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'print.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  });

  reset();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      root.innerHTML = '';
    }
  };
}
