import { CONFIG as C } from '../../config.js';
import { W, S, PW } from '../../engine/geometry.js';
import { clamp } from '../../engine/util.js';
import { startStroke, moveStroke, dwell } from '../../engine/record.js';
import { printLayer, compositeJob } from '../../engine/print.js';
import { createJob } from '../../state.js';
import { createPanel } from '../../ui/panel.js';
import { FRAME, MESH, buildFrame, buildMarks, createMeshInk } from './overlay.js';
import { DESIGN } from '../../plates/registration.js';
import * as sfx from '../../audio/sound.js';
import { showCanvas } from '../../ui/display.js';

// 工作桌：一層一層 放下網框 → 倒墨 → 刮印 → 掀框 → 等乾。
// 每層都經過同樣的五步，最後一層的第五步為「完成」。
const STEPS = ['放下網框', '倒墨', '刮印', '掀框', '等乾'];
const STEPS_LAST = ['放下網框', '倒墨', '刮印', '掀框', '完成'];
const PHASE_STEP = { place: 0, ink: 1, squeegee: 2, lift: 3, dry: 4, done: 4 };
const VMAX = 2.6;       // 速度條最大值 px/ms
const LIFT_MS = 700;
const DROP_MS = 220;    // 放下網框：浮起的陰影收掉
const BEAD_R = 4;       // 倒墨：上緣那條墨的半徑（紙張座標）
const POUR_GROW = 0.16; // 墨滴從一點長到半徑 BEAD_R 的秒數
const POUR_SPEED = 420; // 自動補齊時，兩端每秒往外流多遠
const FLASH_MS = 500;   // 倒好時墨邊閃一下
const DARK = [21, 21, 20];
const mixTo = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const ease = p => 1 - Math.pow(1 - clamp(p, 0, 1), 3);

// onFinish(paperCanvas)：最後一層掀框後按「完成」
export function mountWorkbench(root, { plates, inks, medium, onBack, onFinish }) {
  const stage = document.createElement('section');
  stage.className = 'stage';
  stage.innerHTML = `<div class="sheet">
      <canvas class="paper" width="${PW}" height="${PW}"></canvas>
      <canvas class="overlay" width="${PW}" height="${PW}"></canvas>
    </div>`;
  root.appendChild(stage);
  // 成品畫在全尺寸的 full 上（完成時交出這張）；畫面上的 paper 依顯示大小縮好再畫
  const paper = stage.querySelector('.paper'), overlay = stage.querySelector('.overlay');
  const full = document.createElement('canvas');
  full.width = full.height = PW;
  const pctx = full.getContext('2d'), octx = overlay.getContext('2d');
  // 手機上工作桌塞進一個螢幕高，操作時不用捲動，也不會觸發下拉重新整理
  root.classList.add('bench');
  document.documentElement.classList.add('no-overscroll');
  stage.querySelector('.sheet').style.background = `rgb(${medium.paper.join(',')})`;

  const panel = createPanel(root, { title: '工作桌', back: onBack ? '換媒材' : null });
  if (onBack) panel.onBack(onBack);
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
      hover: null, drag: null, dryer: false, liftStart: 0, busy: false,
      drop: 0, pour: newPour(), dryVis: 0
    };
    layer().offset = scatter();
    paintPrint(); // 還沒印時，畫出媒材本身（含織紋）
    meshInk.markDirty();
    ui();
  }

  function primaryAction() {
    if (st.busy) return;
    const ph = st.phase;
    if (ph === 'place') placeFrame();
    else if (ph === 'ink') autoPour(bar().w / 2);
    else if (ph === 'squeegee' && layer().rec.strokes > 0) lift();
    else if (ph === 'dry') nextLayer();
    else if (ph === 'done' && onFinish) { onFinish(full); return; }
    ui();
  }

  // 網框一開始稍微偏離，使用者自己拖到位置
  function scatter() {
    const ang = Math.random() * Math.PI * 2, r = 20 + Math.random() * 15;
    return [Math.round(Math.cos(ang) * r), Math.round(Math.sin(ang) * r)];
  }

  function placeFrame() {
    st.drag = null;
    st.phase = 'ink';
    st.drop = performance.now();
    sfx.drop();
    ui();
  }

  /* ───────── 倒墨 ───────── */
  // 一滴墨從落點長成圓，再往兩端拉長成兩頭圓的一整條。
  //   a、b：兩端圓心（從上緣墨條左端起算）；r：半徑
  function newPour() {
    return { a: -1, b: -1, r: 0, auto: false, drag: false, flash: 0 };
  }
  const bar = () => {
    const [ox, oy] = layer().offset;
    return { x: MESH.x + ox + 40, y: MESH.y + oy + 18, w: MESH.w - 80 };
  };
  const along = x => { const b = bar(); return clamp(x - b.x, BEAD_R, b.w - BEAD_R); };
  const poured = () => { const P = st.pour; return P.a < 0 ? 0 : (P.b - P.a) / (bar().w - 2 * BEAD_R); };

  function pourTo(x) {
    const P = st.pour;
    if (P.a < 0) { P.a = P.b = x; sfx.pour(0.65); }
    else { P.a = Math.min(P.a, x); P.b = Math.max(P.b, x); }
    if (poured() >= 0.8) autoPour(x);
  }
  // 從已倒的地方往兩端流開，直到整條補齊
  function autoPour(x) {
    const P = st.pour;
    if (P.auto) return;
    if (P.a < 0) { P.a = P.b = x; sfx.pour(0.65); }
    P.auto = true;
    P.drag = false;
    ui();
  }
  function updatePour(dt) {
    const P = st.pour;
    if (P.a < 0) return;
    P.r = Math.min(BEAD_R, P.r + dt * BEAD_R / POUR_GROW);
    if (!P.auto || P.r < BEAD_R) return;
    const end = bar().w - BEAD_R;
    P.a = Math.max(BEAD_R, P.a - dt * POUR_SPEED);
    P.b = Math.min(end, P.b + dt * POUR_SPEED);
    if (P.a <= BEAD_R && P.b >= end) finishPour();
  }
  function finishPour() {
    st.pour.auto = false;
    st.pour.flash = performance.now();
    st.inkPlaced = true;
    st.phase = 'squeegee';
    meshInk.markDirty();
    ui();
  }

  function lift() {
    st.phase = 'lift';
    st.pressing = false;
    sfx.peel();
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
    layer().offset = scatter();
    st.inkPlaced = false;
    st.pour = newPour();
    meshInk.markDirty();
  }

  function paintPrint() {
    const img = pctx.createImageData(PW, PW);
    img.data.set(compositeJob(job, C));
    pctx.putImageData(img, 0, 0);
    showCanvas(full, paper);
  }

  /* ───────── 刮印 ───────── */
  function bladePos(p) {
    const [ox, oy] = layer().offset, h = C.bladeLength / 2;
    return {
      x: clamp(p.x, MESH.x + ox + h, MESH.x + ox + MESH.w - h),
      y: clamp(p.y, MESH.y + oy + 6, MESH.y + oy + MESH.h - 6)
    };
  }
  // 刮印速度以螢幕上的實際移動來算：紙張顯示得比 600px 小時（例如手機），
  // 同樣的手指速度換算到紙張座標會變快，所以把時間依比例拉長，桌機和手機的手感才一致
  const strokeTime = t => t * W / Math.max(1, overlay.getBoundingClientRect().width);
  const underLayers = () => job.layers.slice(0, st.L).map(l => ({ wet: l.wet, cover: l.cover }));

  function beginStroke(p, t) {
    const l = layer();
    st.pressing = true;
    st.inkPlaced = false;
    startStroke(l.rec, bladePos(p), strokeTime(t));
    st.lastMoveT = t;
    for (let j = 0; j < st.L; j++) l.wetAt[j] = Math.max(l.wetAt[j], job.layers[j].wet);
    ui();
  }

  function continueStroke(p, t) {
    const l = layer();
    if (moveStroke(l.rec, bladePos(p), strokeTime(t), underLayers(), C)) {
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
        hint = st.L === 0 ? '拖動網框到想印的位置，點一下放下。' : '拖動網框或用方向鍵對齊十字，點一下放下。';
        label = '放下網框';
        break;
      case 'ink':
        hint = '沿著上緣的虛線拖動，倒一條墨。';
        label = '倒墨';
        enabled = !st.pour.auto;
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
        hint = '掀開了。看看成品。';
        label = '完成';
        visible = !!onFinish;
        break;
    }
    panel.setHint(hint);
    panel.setPrimary({ label, enabled, visible });
    panel.showMeter(ph === 'squeegee');

    const wet = maxWet() > 0;
    const beforePrint = st.L > 0 && (ph === 'place' || ph === 'ink' || (ph === 'squeegee' && l.rec.strokes === 0));
    panel.showDry((wet && (ph === 'dry' || beforePrint)) || (ph === 'dry' && !wet));

    overlay.style.cursor =
      ph === 'place' ? (st.drag ? 'grabbing' : 'grab') :
      ph === 'ink' ? (st.pour.auto ? 'default' : 'pointer') :
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
    if (st.phase !== 'dry' && st.phase !== 'done') drawFrame(now);
    drawDryer(now);
  }

  // 第 1 層放下前：紙上很淡的定位角，提示大概的置中位置（不會印進成品）
  function drawGuides() {
    const { x, y, size } = DESIGN, k = 14;
    octx.save();
    octx.setTransform(S, 0, 0, S, 0, 0);
    octx.strokeStyle = 'rgba(21, 21, 20, 0.28)';
    octx.lineWidth = 1;
    octx.beginPath();
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + size, y, -1, 1], [x, y + size, 1, -1], [x + size, y + size, -1, -1]]) {
      octx.moveTo(cx + sx * k, cy); octx.lineTo(cx, cy); octx.lineTo(cx, cy + sy * k);
    }
    octx.stroke();
    octx.restore();
  }

  // 上緣那條墨：先畫一圈深色邊，再畫墨，淺色墨也看得清楚。
  // 形狀是兩頭圓的長條；兩端圓心重疊時就是一個圓。
  function drawBead(rgb, P, flash) {
    if (P.a < 0 || P.r <= 0.01) return;
    const b = bar(), cy = b.y * S, xa = (b.x + P.a) * S, xb = (b.x + P.b) * S;
    const shape = grow => {
      const r = P.r * S + grow;
      octx.beginPath();
      octx.arc(xb, cy, r, -Math.PI / 2, Math.PI / 2);
      octx.arc(xa, cy, r, Math.PI / 2, Math.PI * 1.5);
      octx.closePath();
      octx.fill();
    };
    octx.fillStyle = `rgb(${mixTo(rgb, DARK, 0.45).join(',')})`;
    shape((1 + flash * 1.6) * S);
    octx.fillStyle = `rgb(${rgb.join(',')})`;
    shape(0);
  }

  function drawFrame(now) {
    const L = st.L, ph = st.phase, l = layer();
    const [ox, oy] = l.offset;
    if (L === 0 && ph === 'place') drawGuides();
    // 還沒放下時浮在紙上，放下時陰影收掉
    let float = 0;
    if (ph === 'place') float = 1;
    else if (st.drop) {
      float = 1 - ease((now - st.drop) / DROP_MS);
      if (float <= 0) st.drop = 0;
    }
    let alpha = L === 0 ? 1 : C.wetFrameAlpha, lift = 0;
    if (ph === 'lift' && st.liftStart) {
      const p = clamp((now - st.liftStart) / LIFT_MS, 0, 1);
      lift = 1 - Math.pow(1 - p, 3);
      alpha *= 1 - p;
      if (p >= 1) { finishLift(); return; }
    }
    const shift = -lift * 48;

    octx.globalAlpha = alpha;
    const fy = FRAME.y + oy + shift - 3 * float;
    if (float > 0) {
      octx.save();
      octx.shadowColor = `rgba(20, 18, 14, ${0.32 * float})`;
      octx.shadowBlur = 18 * float * S;
      octx.shadowOffsetY = 9 * float * S;
      octx.drawImage(frames[L], (FRAME.x + ox) * S, fy * S);
      octx.restore();
    } else octx.drawImage(frames[L], (FRAME.x + ox) * S, fy * S);
    if (L > 0 && ph === 'place') {
      octx.globalAlpha = 1;
      octx.drawImage(marks[L], (FRAME.x + ox) * S, fy * S);
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

    if (ph === 'ink') {
      // 會倒墨的位置：流動的虛線框，滑到網框上時更清楚
      const b = bar(), on = st.hover && inFrame(st.hover);
      if (!st.pour.auto) {
        octx.save();
        octx.setTransform(S, 0, 0, S, 0, 0);
        octx.strokeStyle = `rgba(21, 21, 20, ${on || st.pour.drag ? 0.7 : 0.32})`;
        octx.lineWidth = 1;
        octx.setLineDash([5, 4]);
        octx.lineDashOffset = -now / 60;
        octx.strokeRect(b.x - 6, b.y - 9, b.w + 12, 18);
        octx.restore();
      }
      drawBead(l.ink.rgb, st.pour, 0);
    }
    if (ph === 'squeegee' && st.inkPlaced) {
      const f = st.pour.flash ? clamp((now - st.pour.flash) / FLASH_MS, 0, 1) : 1;
      drawBead(inkOnMesh(), st.pour, Math.sin(Math.PI * f));
    }

    if (ph === 'squeegee' && (st.hover || st.pressing)) {
      const bp = st.pressing ? l.rec.last : bladePos(st.hover), h = C.bladeLength / 2;
      octx.fillStyle = st.pressing ? '#151514' : 'rgba(21,21,20,0.72)';
      octx.fillRect((bp.x - h) * S, (bp.y - 4) * S, C.bladeLength * S, 8 * S);
    }
  }

  // 吹風機：按住時，平面的吹風機圖形在紙面上方左右擺動
  const DRYER = { x: 20, y: 46, w: 52, h: 82 };   // 圖形範圍（以機身圓心為原點）
  const dryerShape = (() => {
    const c = document.createElement('canvas');
    c.width = DRYER.w * S; c.height = DRYER.h * S;
    const x = c.getContext('2d');
    x.setTransform(S, 0, 0, S, DRYER.x * S, DRYER.y * S);
    x.fillStyle = '#151514';
    // 各部位分開填滿（這張畫布不透明，重疊處不會變深）
    x.beginPath(); x.moveTo(4, -12); x.lineTo(13, -8); x.lineTo(28, -40); x.lineTo(19, -44); x.closePath(); x.fill();   // 把手
    x.beginPath(); x.arc(0, 0, 17, 0, Math.PI * 2); x.fill();                                                          // 機身
    x.beginPath(); x.moveTo(-8, 10); x.lineTo(8, 10); x.lineTo(11, 32); x.lineTo(-11, 32); x.closePath(); x.fill();     // 出風口
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.arc(0, 0, 6, 0, Math.PI * 2); x.fill();                                    // 進風孔
    return c;
  })();
  function drawDryer(now) {
    if (st.dryVis <= 0.01) return;
    const t = now / 1000, w = Math.PI * 2 / 1.2;
    const x = 300 + Math.sin(t * w) * 150, y = 58, tilt = Math.cos(t * w) * 0.16;
    octx.save();
    octx.setTransform(S, 0, 0, S, 0, 0);
    octx.translate(x, y);
    octx.rotate(tilt);
    // 先在另一張畫布上畫成一整塊，再整塊淡入，接合處才不會因為重疊而變深
    octx.globalAlpha = 0.9 * st.dryVis;
    octx.drawImage(dryerShape, -DRYER.x, -DRYER.y, DRYER.w, DRYER.h);
    octx.strokeStyle = '#151514';
    octx.globalAlpha = 0.55 * st.dryVis;
    octx.lineWidth = 1.6;
    octx.setLineDash([6, 6]);
    octx.lineDashOffset = -t * 70;
    octx.beginPath();
    for (const dx of [-8, 0, 8]) { octx.moveTo(dx, 38); octx.lineTo(dx * 1.5, 64); }
    octx.stroke();
    octx.restore();
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
    st.dryVis += ((st.dryer && maxWet() > 0 ? 1 : 0) - st.dryVis) * Math.min(1, dt * 8);
    if (st.phase === 'ink') updatePour(dt);
    sfx.scrape(st.phase === 'squeegee' && st.pressing, st.vShow);
    sfx.dryer(st.dryVis, Math.sin(now / 1000 * Math.PI * 2 / 1.2));

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

  const capture = e => { try { overlay.setPointerCapture(e.pointerId); } catch {} };
  overlay.addEventListener('pointerdown', e => {
    if (st.busy) return;
    const p = toL(e);
    st.hover = p;
    if (st.phase === 'place' && inFrame(p)) {
      st.drag = { p, o: layer().offset.slice(), moved: false, slop: e.pointerType === 'mouse' ? 3 : 9 };
      capture(e);
      ui();
    } else if (st.phase === 'ink' && inFrame(p) && !st.pour.auto) {
      capture(e);
      st.pour.drag = true;
      pourTo(along(p.x));
    } else if (st.phase === 'squeegee') {
      capture(e);
      beginStroke(p, e.timeStamp);
    }
  });
  overlay.addEventListener('pointermove', e => {
    const p = toL(e);
    st.hover = p;
    if (st.drag) {
      if (Math.hypot(p.x - st.drag.p.x, p.y - st.drag.p.y) > st.drag.slop) st.drag.moved = true;
      if (st.drag.moved) setOffset(st.drag.o[0] + p.x - st.drag.p.x, st.drag.o[1] + p.y - st.drag.p.y);
    } else if (st.pour.drag) {
      pourTo(along(p.x));
    } else if (st.pressing) {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (evs.length) for (const ce of evs) continueStroke(toL(ce), ce.timeStamp);
      else continueStroke(p, e.timeStamp);
    }
  });
  const endPointer = () => {
    if (st.drag) {
      if (st.drag.moved) { st.drag = null; ui(); } else placeFrame(); // 點一下（沒有拖動）就放下
    }
    if (st.pour.drag) autoPour(st.pour.b);
    if (st.pressing) { st.pressing = false; ui(); }
  };
  overlay.addEventListener('pointerup', endPointer);
  overlay.addEventListener('pointercancel', endPointer);
  overlay.addEventListener('pointerleave', () => { if (!st.pressing && !st.drag) st.hover = null; });

  const onKey = e => {
    if (st.phase !== 'place') return;
    const step = e.shiftKey ? 10 : 1, [x, y] = layer().offset;
    if (e.key === 'ArrowLeft') setOffset(x - step, y);
    else if (e.key === 'ArrowRight') setOffset(x + step, y);
    else if (e.key === 'ArrowUp') setOffset(x, y - step);
    else if (e.key === 'ArrowDown') setOffset(x, y + step);
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  let resizeT = 0;
  const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(() => showCanvas(full, paper), 120); };
  window.addEventListener('resize', onResize);

  panel.onDryer(on => { st.dryer = on; });
  panel.onPrimary(primaryAction);
  panel.onReset(reset);

  reset();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      sfx.scrape(false, 0);
      sfx.dryer(0);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeT);
      root.classList.remove('bench');
      document.documentElement.classList.remove('no-overscroll');
      root.innerHTML = '';
    }
  };
}
