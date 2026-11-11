/* 蓋章場景：沾墨 → 對位 → 施力蓋下 → 拿起揭曉 → 評語
   station = 1..3 在某一站；station = 0 是「卡片首頁」（還沒到任何一站） */
import { CONFIG, ROT } from './config.js';
import { COPY } from './copy.js';
import { ART_SETS, artId, shapeOf, stationName, drawGuides } from './art.js';
import { CARD, printCv, inkCv, genMask, composite, simplifyPath } from './print.js';
import { drawCardExtras } from './cardface.js';
import { say } from './attendant.js';
import { store } from './storage.js';
import { TAU, D2R, $, clamp, lerp, smooth, easeInOut, easeOut, easeIn, hex, rgba, makeCanvas, rr, inRect } from './util.js';

const RUBBER = '#b4ab9c';
let stage, ctx, loupe, lctx, topEl, stackEl, devEl;
let W = 0, H = 0, DPR = 1, k = 1;
let card = {}, pad = {}, rest = {}, fc = {};
const faceCache = {};
let hooks = { onReset: () => {}, onStationChange: () => {}, onArtToggle: () => {}, onGoStation: n => enterStation(n) };

const app = {
  active: false,
  station: 1, phase: 'ready',        // ready | pressing | lifting | done | hub | out
  layers: [], ink: 0,
  s: { x: 0, y: 0, a: 0 },
  fine: 0, focus: 0, prox: 0,
  liftT: 0, shakeT: -1e9, dabT: -1e9, wheelT: -1e9, outT: 0, outOff: 0, hubOff: 0,
  dabs: [], hint: {}, armedUntil: 0,
  cam: 0, camPad: 0, camHold: false, lastFrame: 0, returnT: -1e9, enterT: -1e9,
  goT: -1e9, goEnd: -1e9, goMode: CONFIG.GO_HINT,
};
const wy = y => y - app.cam;
const impressions = st => app.layers.filter(L => L.station === st);
const ptrs = new Map();
const g = { mode: null, pid: null, timer: 0, downT: 0, lastFast: 0, speed: 0, lastAng: 0, two: null, press: null };

/* =====================================================================
   對外介面
   ===================================================================== */
export function initStamping(h) {
  hooks = { ...hooks, ...h };
  stage = $('#stage'); ctx = stage.getContext('2d');
  loupe = $('#loupe'); lctx = loupe.getContext('2d');
  topEl = $('#top'); stackEl = $('#stack'); devEl = $('#dev');
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', layout);
  stackEl.addEventListener('click', onStack);
  layout();
  requestAnimationFrame(frame);
}

/* 從存檔重建所有蓋印 */
export function loadImpressions(list) {
  app.layers = list.map(imp => ({ ...imp, mask: genMask(imp) }));
  composite(app.layers);
}

export function getCardRect() { layout(); return { ...card, k }; }

export function show() { app.active = true; document.body.classList.add('scene-stamp'); }
export function hide() { app.active = false; document.body.classList.remove('scene-stamp'); }

export function enterStation(n, lines) {
  app.station = n; app.ink = 0; app.dabs = []; app.hint = {}; app.camHold = false; app.cam = 0;
  app.s = { x: rest.x, y: rest.y, a: 0 };
  app.enterT = performance.now();
  ptrs.clear(); g.mode = null; clearTimeout(g.timer);
  const done = impressions(n).length > 0;
  app.phase = done ? 'done' : 'ready';
  setUrlStation(n);
  updateDev();
  hooks.onStationChange(n);
  const name = stationName(n);
  say(lines || (done ? COPY.stamped : COPY.enter(n, name)));
}

export function enterHub(lines) {
  app.station = 0; app.phase = 'hub'; app.cam = 0;
  ptrs.clear(); g.mode = null;
  setUrlStation(0);
  updateDev();
  hooks.onStationChange(0);
  if (lines) say(lines);
}

function setUrlStation(n) {
  try { const u = new URL(location.href); if (n) u.searchParams.set('station', n); else u.searchParams.delete('station'); history.replaceState(null, '', u); } catch (e) {}
}

/* =====================================================================
   版面
   ===================================================================== */
function layout() {
  W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2.5);
  stage.width = Math.round(W * DPR); stage.height = Math.round(H * DPR);
  stage.style.width = W + 'px'; stage.style.height = H + 'px';
  const S = CONFIG.LOUPE.SIZE;
  loupe.width = loupe.height = Math.round(S * DPR);
  loupe.style.width = loupe.style.height = S + 'px';

  const top = topEl.getBoundingClientRect().bottom + 14;
  const colW = Math.min(W - 32, 460);
  k = Math.min(colW / CARD.W, (H - top - 24 - 30) / (CARD.H + CARD.BLOCK * .72), 1.15);
  const B = CARD.BLOCK * k, padS = B + 44;
  const total = CARD.H * k + 24 + padS;
  const y0 = top + Math.max(0, (H - 12 - top - total) * .45);
  card = { x: (W - CARD.W * k) / 2, y: y0, w: CARD.W * k, h: CARD.H * k };
  rest = { x: W / 2, y: card.y + card.h + 24 + padS / 2 };
  pad = { x: rest.x - padS / 2, y: rest.y - padS / 2, w: padS, h: padS };
  fc = { x: card.x + CARD.FX * k, y: card.y + CARD.FY * k };
  app.camPad = Math.min(0, H - CONFIG.CAMERA.MARGIN - (pad.y + pad.h));
  for (const key in faceCache) delete faceCache[key];
  if (app.phase !== 'pressing' && app.phase !== 'lifting' && !g.mode) { app.s.x = rest.x; app.s.y = rest.y; }
}

function faceImage(kind) {   // kind: rubber | ink | white
  const key = kind + app.station + artId();
  if (faceCache[key]) return faceCache[key];
  const B = CARD.BLOCK * k, px = Math.ceil(B * DPR);
  const cv = makeCanvas(px, px), c = cv.getContext('2d');
  c.setTransform(px / CARD.BLOCK, 0, 0, px / CARD.BLOCK, px / 2, px / 2);
  c.fillStyle = kind === 'rubber' ? RUBBER : kind === 'white' ? '#fff' : CONFIG.INKS[app.station].ink;
  shapeOf(app.station)(c);
  return faceCache[key] = cv;
}

/* =====================================================================
   對位判定
   ===================================================================== */
function refTransform() {
  const own = app.layers.find(L => L.station === app.station);       // 補蓋：對準自己剛蓋的那一層
  if (own) return { x: own.x, y: own.y, a: own.a };
  const prim = app.layers.filter(L => !L.retouch);                     // 其他站：對準已蓋好各層（不含補蓋）的平均
  if (!prim.length) return { x: 0, y: 0, a: 0 };
  const n = prim.length;
  return prim.reduce((r, L) => ({ x: r.x + L.x / n, y: r.y + L.y / n, a: r.a + L.a / n }), { x: 0, y: 0, a: 0 });
}
function errorOf(x, y, a) {
  const r = refTransform(), S = CONFIG.SCORE;
  const d = Math.hypot(x - r.x, y - r.y), da = ROT ? Math.abs(a - r.a) : 0;
  return Math.hypot(d / S.POS_NORM, da / S.ANGLE_NORM);
}
const stampUnits = () => ({ x: (app.s.x - fc.x) / k, y: (app.s.y - fc.y) / k, a: ROT ? app.s.a : 0 });
const overCard = () => inRect(app.s.x, app.s.y, card);
const felt = () => ({ x: pad.x + 14, y: pad.y + 22, w: pad.w - 28, h: pad.h - 36 });
const stampOnPad = () => inRect(app.s.x, app.s.y, felt());
const hasStamp = () => app.phase !== 'hub' && app.phase !== 'out';

function hintOnce(key, lines) { if (app.hint[key]) return; app.hint[key] = true; say(lines); }

/* =====================================================================
   開發用：站點切換、提示模式
   ===================================================================== */
function updateDev() {
  if (!CONFIG.DEV_SWITCHER) { devEl.hidden = true; return; }
  devEl.innerHTML = '';
  for (const n of [1, 2, 3]) {
    const b = document.createElement('button');
    b.textContent = n; b.className = n === app.station ? 'cur' : '';
    if (app.layers.some(L => L.station === n)) { const i = document.createElement('i'); i.style.background = CONFIG.INKS[n].ink; b.appendChild(i); }
    b.addEventListener('click', () => { if (!app.active || ['pressing', 'lifting', 'out'].includes(app.phase)) return; hooks.onGoStation(n); });
    devEl.appendChild(b);
  }
  const labels = { arrow: '箭頭', hop: '跳動', both: '兩者', none: '無' }, order = ['arrow', 'hop', 'both', 'none'];
  const hb = document.createElement('button');
  hb.textContent = labels[app.goMode]; hb.style.width = 'auto'; hb.style.padding = '0 8px';
  hb.addEventListener('click', () => {
    app.goMode = order[(order.indexOf(app.goMode) + 1) % order.length];
    app.goT = performance.now(); app.goEnd = app.goT + CONFIG.GO_HINT_MS;
    updateDev();
  });
  devEl.appendChild(hb);
  // 圖案組切換：換一組就換一張新卡（舊卡上的章是用舊圖案蓋的）
  const ab = document.createElement('button');
  ab.textContent = ART_SETS[artId()].label; ab.style.width = 'auto'; ab.style.padding = '0 8px';
  ab.addEventListener('click', () => {
    if (!app.active || ['pressing', 'lifting', 'out'].includes(app.phase)) return;
    const ids = Object.keys(ART_SETS); hooks.onArtToggle(ids[(ids.indexOf(artId()) + 1) % ids.length]);
    app.phase = 'out'; app.outT = performance.now(); ptrs.clear(); g.mode = null;
  });
  devEl.appendChild(ab);
}

/* 重來：卡片堆點兩下 → 舊卡滑走 → 重新領卡 */
let armTimer = 0;
function onStack() {
  if (!app.active || ['pressing', 'lifting', 'out'].includes(app.phase)) return;
  if (performance.now() < app.armedUntil) {
    app.armedUntil = 0; stackEl.classList.remove('armed'); clearTimeout(armTimer);
    app.phase = 'out'; app.outT = performance.now();
    ptrs.clear(); g.mode = null;
    return;
  }
  app.armedUntil = performance.now() + 4000; stackEl.classList.add('armed');
  clearTimeout(armTimer); armTimer = setTimeout(() => stackEl.classList.remove('armed'), 4000);
  say(COPY.resetAsk);
}

/* =====================================================================
   手勢
   ===================================================================== */
function toLocal(px, py) {
  const dx = px - app.s.x, dy = py - app.s.y, c = Math.cos(-app.s.a * D2R), s = Math.sin(-app.s.a * D2R);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}
function hitStamp(px, py) { const l = toLocal(px, py), hb = CARD.BLOCK * k / 2; return Math.abs(l.x) <= hb && Math.abs(l.y) <= hb; }
function handlePos() {
  const off = CARD.BLOCK * k / 2 + 18, c = Math.cos(app.s.a * D2R), s = Math.sin(app.s.a * D2R);
  return { x: app.s.x + off * c + off * s, y: app.s.y + off * s - off * c };
}
function hitHandle(px, py) { if (!ROT) return false; const h = handlePos(); return Math.hypot(px - h.x, py - h.y) < 26; }

function moveStamp(dx, dy, gn) { app.s.x = clamp(app.s.x + dx * gn, 0, W); app.s.y = clamp(app.s.y + dy * gn, -app.cam, H - app.cam); }
function rotateStamp(deg) { if (!ROT) return; app.s.a = clamp(app.s.a + deg, -CONFIG.ANGLE_LIMIT, CONFIG.ANGLE_LIMIT); }
const gain = () => lerp(1, CONFIG.FINE.GAIN, app.fine);
function trackSpeed(v, now) { g.speed = g.speed * .7 + v * .3; if (g.speed > CONFIG.FINE.SPEED) g.lastFast = now; }
function markFast() { g.lastFast = performance.now(); g.speed = 1; }
function twoState() {
  const [a, b] = [...ptrs.values()];
  return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ang: Math.atan2(b.y - a.y, b.x - a.x) };
}
const wrapAng = d => d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d;

function onDown(e) {
  e.preventDefault();
  if (!app.active || app.phase !== 'ready') return;
  if (ptrs.size >= 2) return;
  const now = performance.now();
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  const p = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, sx: e.clientX, sy: e.clientY, t: now, lt: now, touch: e.pointerType !== 'mouse' };
  ptrs.set(e.pointerId, p);
  if (ptrs.size === 1) {
    g.pid = e.pointerId;
    const py = wy(p.y);
    if (hitHandle(p.x, py)) { g.mode = 'rotate'; g.lastAng = Math.atan2(py - app.s.y, p.x - app.s.x); markFast(); }
    else if (hitStamp(p.x, py)) {
      g.mode = 'pending'; g.downT = now; clearTimeout(g.timer);
      g.timer = setTimeout(decide, CONFIG.PRESS.DECIDE_MS);
    }
    else if (inRect(p.x, py, pad) && stampOnPad()) g.mode = 'padtap';
    else g.mode = null;
    if (g.mode) app.camHold = false;                     // 碰了印章或印台：鏡頭可以回到印台
    if (g.mode && g.mode !== 'padtap') app.goEnd = Math.min(app.goEnd, now + 180);   // 拿起印章：提示立刻淡出
  } else if (['pending', 'drag', 'rotate'].includes(g.mode)) {
    clearTimeout(g.timer); g.mode = 'two'; g.two = twoState(); markFast();
  }
}

function decide() {
  if (g.mode !== 'pending') return;
  if (!overCard()) return;                                // 在印台或空中：等放開（點＝沾墨）或移動（拖動）
  if (app.ink === 0) { say(COPY.dry); g.mode = 'drag'; markFast(); return; }
  const p = ptrs.get(g.pid);
  const l = toLocal(p.x, wy(p.y));
  g.mode = 'press'; app.phase = 'pressing';
  g.press = { t0: g.downT, x0: app.s.x, y0: app.s.y, a0: app.s.a, path: [{ x: 0, y: 0 }], local: { x: l.x / k, y: l.y / k }, px: p.x, py: p.y, touch: p.touch };
}

function onMove(e) {
  const p = ptrs.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse') updateCursor(e.clientX, e.clientY); return; }
  e.preventDefault();
  const now = performance.now(), x = e.clientX, y = e.clientY;
  const dx = x - p.lx, dy = y - p.ly, dt = Math.max(1, now - p.lt);
  p.lx = p.x = x; p.ly = p.y = y; p.lt = now;
  switch (g.mode) {
    case 'pending':
      if (Math.hypot(x - p.sx, y - p.sy) > (p.touch ? CONFIG.PRESS.MOVE_TOLERANCE : 6)) { clearTimeout(g.timer); g.mode = 'drag'; markFast(); moveStamp(x - p.sx, y - p.sy, 1); }
      break;
    case 'drag':
      trackSpeed(Math.hypot(dx, dy) / dt, now); moveStamp(dx, dy, gain());
      break;
    case 'rotate': {
      const ang = Math.atan2(wy(y) - app.s.y, x - app.s.x), d = wrapAng(ang - g.lastAng);
      g.lastAng = ang;
      trackSpeed(Math.abs(d) * CARD.BLOCK * k / 2 / dt, now); rotateStamp(d / D2R * gain());
      break;
    }
    case 'two': {
      const n = twoState(), dmx = n.mx - g.two.mx, dmy = n.my - g.two.my, da = wrapAng(n.ang - g.two.ang);
      g.two = n;
      trackSpeed((Math.hypot(dmx, dmy) + Math.abs(da) * 120) / dt, now);
      const gn = gain(); moveStamp(dmx, dmy, gn); rotateStamp(da / D2R * gn);
      break;
    }
    case 'press':
      if (e.pointerId !== g.pid) break;
      app.s.x += dx; app.s.y += dy;
      g.press.path.push({ x: (app.s.x - g.press.x0) / k, y: (app.s.y - g.press.y0) / k });
      g.press.px = x; g.press.py = y;
      break;
  }
}

function onUp(e) {
  const p = ptrs.get(e.pointerId); if (!p) return;
  ptrs.delete(e.pointerId);
  const now = performance.now();
  if (g.mode === 'press') { if (e.pointerId === g.pid) { commit(now); ptrs.clear(); g.mode = null; } return; }
  const tap = now - p.t < 450 && Math.hypot(p.x - p.sx, p.y - p.sy) < 8;
  if (g.mode === 'pending') { clearTimeout(g.timer); if (tap && stampOnPad()) dab(); g.mode = null; }
  else if (g.mode === 'padtap') { if (tap) dab(); g.mode = null; }
  else if (g.mode === 'two') {
    if (ptrs.size === 1) { g.pid = [...ptrs.keys()][0]; g.mode = 'drag'; markFast(); } else g.mode = null;
  }
  if (ptrs.size === 0) g.mode = null;
}

function onWheel(e) {
  e.preventDefault();
  if (!app.active || !ROT || app.phase !== 'ready') return;
  let d = e.deltaY || e.deltaX; if (e.deltaMode === 1) d *= 33;
  rotateStamp(clamp(d / 100, -1, 1) * CONFIG.WHEEL_STEP * (e.shiftKey ? .25 : 1));
  app.wheelT = performance.now();
}

function updateCursor(x, sy) {
  let c = 'default'; const y = wy(sy);
  if (app.phase === 'ready') {
    if (hitHandle(x, y) || hitStamp(x, y)) c = 'grab';
    else if (inRect(x, y, pad) && stampOnPad()) c = 'pointer';
  }
  if (stage.style.cursor !== c) stage.style.cursor = c;
}

/* =====================================================================
   動作：沾墨 / 蓋下
   ===================================================================== */
function dab() {
  const I = CONFIG.INK_TAPS;
  if (app.ink >= I.MAX) { say(COPY.inkMax); app.dabT = performance.now(); return; }
  app.ink++;
  app.dabT = performance.now();
  app.dabs.push({ x: app.s.x, y: app.s.y, a: app.s.a, t: app.dabT });
  if (app.ink === I.GOOD_MIN) { say(COPY.inkGood); app.goT = performance.now(); app.goEnd = app.goT + CONFIG.GO_HINT_MS; }
  else if (app.ink === I.GOOD_MAX + 1) say(COPY.inkMuch);
  else if (app.ink === I.MAX) say(COPY.inkMax);
}

function commit(now) {
  const P = g.press;
  const L = {
    station: app.station,
    x: (P.x0 - fc.x) / k, y: (P.y0 - fc.y) / k, a: ROT ? P.a0 : 0,
    taps: app.ink, hold: (now - P.t0) / 1000,
    smear: simplifyPath(P.path), press: { x: +P.local.x.toFixed(2), y: +P.local.y.toFixed(2) },
    seed: (Date.now() ^ (Math.random() * 1e9)) | 0,
    retouch: impressions(app.station).length > 0,
    at: new Date().toISOString(),
  };
  L.e = errorOf(L.x, L.y, L.a);
  L.comment = L.e < CONFIG.SCORE.MASTER ? 0 : L.e < CONFIG.SCORE.CRAFT ? 1 : 2;
  L.mask = genMask(L);
  app.layers.push(L);
  composite(app.layers);
  const { mask, fx, ...saved } = L;
  store.addImpression(saved);
  app.ink = 0;
  app.phase = 'lifting';
  app.liftT = app.shakeT = performance.now();
  if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) { try { navigator.vibrate(18); } catch (_) {} }
  window.__lastLayer = { e: +L.e.toFixed(2), comment: (L.retouch ? COPY.retouch : COPY.comments)[L.comment], retouch: L.retouch, hold: +L.hold.toFixed(2), taps: L.taps, fx: L.fx };
}

function afterLift() {
  const L = app.layers[app.layers.length - 1];
  const left = 3 - new Set(app.layers.map(l => l.station)).size;
  const canMore = impressions(app.station).length <= CONFIG.RESTAMP.MAX;
  app.phase = canMore ? 'ready' : 'done';
  if (canMore) {
    app.s = { x: rest.x, y: rest.y, a: 0 }; app.ink = 0; app.returnT = performance.now();
    app.camHold = true; delete app.hint.align;
  }
  updateDev();
  const tail = left > 0 ? COPY.left(left) : COPY.full;
  const faint = !L.retouch && canMore && CONFIG.RESTAMP.FAINT_HINT && (L.fx.starve > 0 || L.fx.short > 0);
  say(L.retouch ? [COPY.retouch[L.comment], tail] : [COPY.comments[L.comment], faint ? COPY.faint : tail]);
}

/* =====================================================================
   繪製
   ===================================================================== */
function dropShadow(pts, ox, oy, blur, a) {
  ctx.save();
  ctx.shadowColor = `rgba(45,35,20,${a})`; ctx.shadowBlur = blur * DPR;
  ctx.shadowOffsetX = (10000 + ox) * DPR; ctx.shadowOffsetY = oy * DPR;
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x - 10000, p.y) : ctx.moveTo(p.x - 10000, p.y));
  ctx.closePath(); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
}
const rectPts = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

function drawBackground() {
  ctx.fillStyle = '#e8e4dc'; ctx.fillRect(0, 0, W, H);
  const gr = ctx.createRadialGradient(W / 2, H * .32, 0, W / 2, H * .32, Math.max(W, H) * .75);
  gr.addColorStop(0, 'rgba(255,255,255,.38)'); gr.addColorStop(1, 'rgba(120,105,80,.10)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
}

function drawCard() {
  const x = card.x + app.outOff, y = card.y + app.hubOff, w = card.w, h = card.h;
  dropShadow(rectPts(x + 4, y + 4, w - 8, h - 8), 0, 10, 26, .2);
  ctx.save(); rr(ctx, x, y, w, h, 7 * k); ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(printCv, x, y, w, h);
  if (app.focus > .01 && app.layers.length) {
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .32 * app.focus;
    ctx.drawImage(inkCv, x, y, w, h);
  }
  ctx.restore();
  const c = store.card || {};
  drawCardExtras(ctx, x, y, k, { name: c.name, signature: c.signature, dateISO: c.issuedAt, dateShape: c.dateShape, route: [...new Set(app.layers.map(l => l.station))] });
}

function drawPad(now) {
  if (!hasStamp()) return;
  const enter = clamp((now - app.enterT) / 420, 0, 1), slide = (1 - easeOut(enter)) * 120;
  const a = (app.phase === 'done' ? .3 : 1) * (1 - .72 * app.focus) * enter;
  if (a < .02) return;
  const ink = CONFIG.INKS[app.station], f = felt();
  ctx.save(); ctx.globalAlpha = a; ctx.translate(0, slide);
  dropShadow(rectPts(pad.x + 3, pad.y + 3, pad.w - 6, pad.h - 6), 0, 8, 20, .22);
  rr(ctx, pad.x, pad.y, pad.w, pad.h, 12); ctx.fillStyle = '#2a2825'; ctx.fill();
  rr(ctx, pad.x + .5, pad.y + .5, pad.w - 1, pad.h - 1, 12); ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.save(); rr(ctx, f.x, f.y, f.w, f.h, 6); ctx.clip();
  ctx.fillStyle = ink.ink; ctx.fillRect(f.x, f.y, f.w, f.h);
  const gr = ctx.createRadialGradient(f.x + f.w / 2, f.y + f.h / 2, f.w * .2, f.x + f.w / 2, f.y + f.h / 2, f.w * .75);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.2)');
  ctx.fillStyle = gr; ctx.fillRect(f.x, f.y, f.w, f.h);
  const B = CARD.BLOCK * k, wimg = faceImage('white');
  app.dabs = app.dabs.filter(d => now - d.t < 1600);
  for (const d of app.dabs) {
    ctx.save(); ctx.globalAlpha = a * .3 * (1 - (now - d.t) / 1600);
    ctx.translate(d.x, d.y); ctx.rotate(d.a * D2R); ctx.drawImage(wimg, -B / 2, -B / 2, B, B); ctx.restore();
  }
  ctx.restore();
  const I = CONFIG.INK_TAPS, gap = 9, x0 = pad.x + pad.w / 2 - (I.MAX - 1) * gap / 2;
  for (let i = 0; i < I.MAX; i++) {
    const good = i + 1 >= I.GOOD_MIN && i + 1 <= I.GOOD_MAX, len = good ? 8 : 5;
    ctx.fillStyle = i < app.ink ? '#f3efe6' : 'rgba(255,255,255,.2)';
    ctx.fillRect(x0 + i * gap - 1, pad.y + 6 + (8 - len) / 2, 2, len);
  }
  ctx.restore();
}

function proxColor(e) {
  const c = 1 - smooth(0, CONFIG.SCORE.PROXIMITY_RANGE, e);
  const gray = [138, 132, 122], hi = hex(CONFIG.INKS[app.station].line);
  return { c, col: [0, 1, 2].map(i => Math.round(lerp(gray[i], hi[i], c))) };
}
function liftP(now) { return easeInOut(clamp((now - app.liftT - 160) / CONFIG.LIFT_MS, 0, 1)); }

function drawStamp(now) {
  if (!hasStamp() || app.phase === 'done') return;
  const B = CARD.BLOCK * k, over = overCard(), onPad = stampOnPad();
  const lvl = Math.min(1, app.ink / CONFIG.INK_TAPS.GOOD_MIN);
  let h = over ? 1 : onPad ? .3 : .85, sc = 1, alpha = 1, mode = over ? 'ghost' : 'rubber', p = 0;
  if (app.phase === 'pressing') {
    const t = (now - g.press.t0) / 1000;
    h = .05; sc = 1 - .028 * Math.min(1, t / CONFIG.PRESS.SHORT_S); mode = 'pressed';
  } else if (app.phase === 'lifting') {
    p = liftP(now); h = .05 + 1.6 * p; sc = 1 + .06 * p; alpha = 1 - easeIn(p); mode = 'lift';
  }
  const dp = now - app.dabT; if (dp < 200) sc *= 1 - .045 * Math.sin(Math.PI * dp / 200);
  const rt = now - Math.max(app.returnT, app.enterT), fa = rt < 500 ? easeOut(rt / 500) : 1;   // 到站或補蓋前：印章出現
  if (fa < 1) { alpha *= fa; h += (1 - fa) * .8; }
  const hop = hopOffset(now); h += hop * .045;
  const s = { x: app.s.x, y: app.s.y - hop, a: app.s.a };

  const c = Math.cos(s.a * D2R), sn = Math.sin(s.a * D2R), hb = B / 2 * sc;
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => ({ x: s.x + (u * c - v * sn) * hb, y: s.y + (u * sn + v * c) * hb }));
  ctx.save();                                   // 透明壓克力：影子只落在印章外面
  ctx.beginPath(); ctx.rect(-50, -50 - app.cam, W + 100, H + 100);
  pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath();
  ctx.clip('evenodd');
  dropShadow(pts, 2 + 7 * h, 3 + 16 * h, 3 + 24 * h, .2 * alpha);
  ctx.restore();
  ctx.save(); ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q.x + 2 + 7 * h, q.y + 3 + 16 * h) : ctx.moveTo(q.x + 2 + 7 * h, q.y + 3 + 16 * h));
  ctx.closePath(); ctx.fillStyle = `rgba(45,35,20,${.035 * alpha})`; ctx.fill(); ctx.restore();

  ctx.save();
  ctx.translate(s.x, s.y); ctx.rotate(s.a * D2R); ctx.scale(sc, sc);
  const half = B / 2;
  if (mode === 'rubber') {
    ctx.globalAlpha = .85 * fa; ctx.drawImage(faceImage('rubber'), -half, -half, B, B);
    if (lvl > 0) { ctx.globalAlpha = .92 * lvl * fa; ctx.drawImage(faceImage('ink'), -half, -half, B, B); }
  } else if (mode === 'ghost') {
    if (app.ink > 0) { ctx.globalAlpha = (.26 + .3 * lvl) * fa; ctx.drawImage(faceImage('ink'), -half, -half, B, B); }
    else { ctx.globalAlpha = .3 * fa; ctx.drawImage(faceImage('rubber'), -half, -half, B, B); }
  } else if (mode === 'pressed') {
    ctx.globalAlpha = (.55 + .2 * lvl) * fa; ctx.drawImage(faceImage('ink'), -half, -half, B, B);
  } else if (mode === 'lift') {
    ctx.globalAlpha = .9 * (1 - easeOut(Math.min(1, p * 1.5))); ctx.drawImage(faceImage('rubber'), -half, -half, B, B);
  }
  ctx.globalAlpha = alpha;

  rr(ctx, -half, -half, B, B, 10 * k);
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
  const gl = ctx.createLinearGradient(-half, -half, half * .2, half * .2);
  gl.addColorStop(0, 'rgba(255,255,255,.34)'); gl.addColorStop(.45, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fill();
  ctx.strokeStyle = 'rgba(30,26,20,.3)'; ctx.lineWidth = 1; ctx.stroke();
  rr(ctx, -half + 2, -half + 2, B - 4, B - 4, 8 * k);
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.stroke();

  let gcol = 'rgba(40,36,30,.32)', glw = 1.1;
  if (over || app.phase === 'pressing') {
    const u = stampUnits(), e = errorOf(u.x, u.y, u.a), pc = proxColor(e);
    app.prox = pc.c;
    gcol = rgba(pc.col, .6 + .4 * pc.c); glw = lerp(1.6, .8, app.fine);
  }
  ctx.save(); ctx.scale(k, k); drawGuides(ctx, gcol, glw / k); ctx.restore();

  if (ROT && app.phase === 'ready') {
    const o = half + 18;
    ctx.beginPath(); ctx.moveTo(half - 2, -half + 2); ctx.lineTo(o - 8, -o + 8);
    ctx.strokeStyle = 'rgba(30,26,20,.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(o, -o, 12, 0, TAU);
    ctx.fillStyle = 'rgba(251,250,246,.96)'; ctx.fill();
    ctx.strokeStyle = g.mode === 'rotate' ? 'rgba(30,26,20,.6)' : 'rgba(30,26,20,.22)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(o, -o, 5.2, -Math.PI * .15, Math.PI * 1.25);
    ctx.strokeStyle = '#2a2723'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.stroke();
    const ea = -Math.PI * .15, ex = o + 5.2 * Math.cos(ea), ey = -o + 5.2 * Math.sin(ea);
    const TILT = .38, AL = 3.6, SP = .98;
    const tx = Math.sin(ea) * Math.cos(TILT) + Math.cos(ea) * Math.sin(TILT);
    const ty = Math.sin(ea) * Math.sin(TILT) - Math.cos(ea) * Math.cos(TILT);
    const wing = s2 => ({ x: -(tx * Math.cos(s2) - ty * Math.sin(s2)) * AL, y: -(tx * Math.sin(s2) + ty * Math.cos(s2)) * AL });
    const w1 = wing(SP), w2 = wing(-SP);
    ctx.beginPath(); ctx.moveTo(ex + w1.x, ey + w1.y); ctx.lineTo(ex, ey); ctx.lineTo(ex + w2.x, ey + w2.y); ctx.lineJoin = 'round'; ctx.stroke();
  }
  ctx.restore();
}

function drawPressure(now) {
  if (app.phase !== 'pressing') return;
  const P = CONFIG.PRESS, t = (now - g.press.t0) / 1000, x = g.press.px, y = g.press.py, r = g.press.touch ? P.RING_TOUCH : P.RING_MOUSE;
  const line = hex(CONFIG.INKS[app.station].line), start = -Math.PI / 2;
  ctx.save(); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = 'rgba(251,250,246,.75)'; ctx.lineWidth = 5; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = 'rgba(30,26,20,.14)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r, start + TAU * P.SHORT_S / P.LONG_S, start + TAU);
  ctx.strokeStyle = 'rgba(30,26,20,.32)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r, start, start + TAU * Math.min(1, t / P.LONG_S));
  ctx.strokeStyle = rgba(line, 1); ctx.lineWidth = 3; ctx.stroke();
  if (t > P.LONG_S) {                           // 第二圈：暈染風，外圈同心圓
    const over = Math.min(1, (t - P.LONG_S) / P.LONG_RANGE_S), deep = hex(CONFIG.INKS[app.station].deep);
    const r2 = r + 10, appear = Math.min(1, (t - P.LONG_S) / .15);
    const pulse = over >= 1 ? .5 + .5 * Math.sin(now / 160) : 0;
    ctx.globalAlpha = appear;
    ctx.beginPath(); ctx.arc(x, y, r2 + 3 + over * 6 + pulse * 3, 0, TAU);
    ctx.strokeStyle = rgba(deep, .1 + .1 * over + .08 * pulse); ctx.lineWidth = 6 + over * 8; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.strokeStyle = 'rgba(251,250,246,.75)'; ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.strokeStyle = rgba(deep, .18); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r2, start, start + TAU * over);
    ctx.strokeStyle = rgba(deep, 1); ctx.lineWidth = 4 + pulse; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* 「拿起印章去蓋吧」的提示 */
function goHintA(now) {
  if (now < app.goT || now > app.goEnd + 300) return 0;
  return Math.min(1, (now - app.goT) / 200) * (1 - clamp((now - app.goEnd) / 300, 0, 1));
}
function hopOffset(now) {        // 印章自己往上輕跳兩下（之後的段落可以活用）
  if (app.goMode !== 'hop' && app.goMode !== 'both') return 0;
  if (app.phase !== 'ready' || g.mode) return 0;
  const t = (now - app.goT) / 1000 - .25, period = .5;
  if (t < 0 || t > period * 2 || now > app.goEnd) return 0;
  const ph = (t % period) / period;
  return Math.sin(Math.PI * ph) * 16 * (t < period ? 1 : .7);
}
function drawGoArrow(now) {
  if (app.goMode !== 'arrow' && app.goMode !== 'both') return;
  const A = goHintA(now); if (A <= 0 || app.phase !== 'ready') return;
  const B = CARD.BLOCK * k, x = app.s.x, y0 = app.s.y + app.cam - B * .06;
  const t = (now - app.goT) / 1000;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const ph = ((t * 1.45 - i * .2) % 1 + 1) % 1;
    const a = Math.sin(Math.PI * clamp(ph * 1.6, 0, 1)) * A, y = y0 - i * 22 - ph * 6;
    if (a <= .01) continue;
    ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.lineTo(x, y - 12); ctx.lineTo(x + 16, y);
    ctx.strokeStyle = `rgba(251,250,246,${.9 * a})`; ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = `rgba(36,34,31,${a})`; ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.restore();
}

let loupePos = null;
function drawLoupe() {
  const active = ptrs.size > 0 && (app.phase === 'ready' || app.phase === 'pressing')
    && ['drag', 'rotate', 'two', 'pending'].includes(g.mode) && overCard();
  if (!active) { loupe.classList.remove('on'); loupePos = null; return; }
  let fx, fy;
  if (g.mode === 'two' || g.mode === 'rotate') { fx = app.s.x; fy = app.s.y + app.cam; }
  else { const p = ptrs.get(g.pid) || [...ptrs.values()][0]; fx = p.x; fy = p.y; }
  const S = CONFIG.LOUPE.SIZE, Z = CONFIG.LOUPE.ZOOM, m = 10;
  const anchor = (g.mode === 'two' || g.mode === 'rotate') ? [...ptrs.values()][0] : { x: fx, y: fy };
  const order = anchor.x > W / 2 ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[1, -1], [-1, -1], [1, 1], [-1, 1]];
  let pos = null;
  for (const [sx, sy] of order) {
    const cx = anchor.x + sx * 92, cy = anchor.y + sy * 128;
    if (cx - S / 2 >= m && cx + S / 2 <= W - m && cy - S / 2 >= m && cy + S / 2 <= H - m) { pos = { x: cx, y: cy }; break; }
  }
  if (!pos) pos = { x: clamp(anchor.x - 92, S / 2 + m, W - S / 2 - m), y: clamp(anchor.y - 128, S / 2 + m, H - S / 2 - m) };
  loupePos = loupePos ? { x: lerp(loupePos.x, pos.x, .35), y: lerp(loupePos.y, pos.y, .35) } : pos;
  loupe.style.transform = `translate(${loupePos.x - S / 2}px,${loupePos.y - S / 2}px)`;
  loupe.classList.add('on');
  const src = S / Z, px = S * DPR;
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.fillStyle = '#e8e4dc'; lctx.fillRect(0, 0, px, px);
  lctx.drawImage(stage, (fx - src / 2) * DPR, (fy - src / 2) * DPR, src * DPR, src * DPR, 0, 0, px, px);
  lctx.strokeStyle = 'rgba(30,26,20,.35)'; lctx.lineWidth = DPR;
  lctx.beginPath(); lctx.moveTo(px / 2 - 5 * DPR, px / 2); lctx.lineTo(px / 2 + 5 * DPR, px / 2);
  lctx.moveTo(px / 2, px / 2 - 5 * DPR); lctx.lineTo(px / 2, px / 2 + 5 * DPR); lctx.stroke();
}

/* =====================================================================
   主迴圈
   ===================================================================== */
let topAlpha = 1;
function frame(now) {
  requestAnimationFrame(frame);
  if (!app.active) return;

  const dtf = Math.min(64, now - (app.lastFrame || now)); app.lastFrame = now;
  const camT = app.phase === 'ready' && !app.camHold && stampOnPad() ? app.camPad : 0;
  const prevCam = app.cam;
  app.cam += (camT - app.cam) * (1 - Math.exp(-dtf / CONFIG.CAMERA.EASE_MS));
  if (Math.abs(camT - app.cam) < .05) app.cam = camT;
  if (app.cam !== prevCam && ['drag', 'pending', 'rotate', 'two'].includes(g.mode)) app.s.y -= app.cam - prevCam;

  const aligning = ['drag', 'rotate', 'two'].includes(g.mode);
  const fineT = aligning && now - g.lastFast > CONFIG.FINE.DELAY_MS ? 1 : 0;
  app.fine += (fineT - app.fine) * (fineT ? .12 : .35);

  const focusOn = app.phase === 'lifting' || app.phase === 'pressing'
    || (overCard() && app.phase === 'ready' && (['drag', 'rotate', 'two', 'pending'].includes(g.mode) || now - app.wheelT < 700));
  app.focus += ((focusOn ? 1 : 0) - app.focus) * .1;
  const ta = 1 - .72 * app.focus;
  if (Math.abs(ta - topAlpha) > .01) { topAlpha = ta; topEl.style.opacity = ta.toFixed(3); devEl.style.opacity = (.34 * ta).toFixed(3); }

  if (app.phase === 'ready' && app.ink > 0 && overCard() && g.mode === 'drag')
    hintOnce('align', impressions(app.station).length ? COPY.alignRetouch : app.layers.length ? COPY.alignNext : COPY.alignFirst);

  if (app.phase === 'lifting' && now - app.liftT > 160 + CONFIG.LIFT_MS + 120) afterLift();

  // 卡片首頁：沒有印台，卡片緩緩移到畫面中央
  const hubT = app.phase === 'hub' || (app.phase === 'out' && app.station === 0) ? Math.max(0, (H - card.h) / 2 - card.y - 10) : 0;
  app.hubOff += (hubT - app.hubOff) * (1 - Math.exp(-dtf / 380));

  if (app.phase === 'out') {                    // 重來：舊卡滑走，交給主程式重新領卡
    const t = (now - app.outT) / 420;
    app.outOff = -easeIn(Math.min(1, t)) * (card.x + card.w + 20);
    if (t >= 1) { app.outOff = 0; app.layers = []; composite([]); hooks.onReset(); }
  }

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawBackground();
  const st = now - app.shakeT;
  if (st < 220) { const t = st / 220, o = Math.sin(t * TAU * 3) * (1 - t) * 3.2; ctx.translate(o * .5, o); }
  ctx.save(); ctx.translate(0, app.cam);
  if (!(app.phase === 'out' && app.outOff <= -(card.x + card.w))) drawCard();
  drawPad(now);
  drawStamp(now);
  ctx.restore();
  drawPressure(now);
  drawGoArrow(now);
  drawLoupe();
}
