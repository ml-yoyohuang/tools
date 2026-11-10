/* 第 0 幕：抵達會場 → 站務員出場 → 親手收下集章卡 → 簽名或打字（可略過）→ 蓋日期章 → 說明玩法
   每一步都是「醞釀、動作、揭曉」。說明交給站務員，介面上沒有按鈕。 */
import { CONFIG } from './config.js';
import { COPY } from './copy.js';
import { CARD, printCv } from './print.js';
import { drawCardExtras, drawStroke, drawTail, NAME, NAME_FONT, DATE, SIGN, PEN_INK } from './cardface.js';
import { attendantSVG, registerHost, say, setMood } from './attendant.js';
import { store } from './storage.js';
import { $, wait, clamp, lerp } from './util.js';

const INK = ['#FFE800', '#0078BF', '#FF48B0', '#F7F4EE'];
const ICON = {   // Material Design Icons
  pen: 'M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25Z',
  keyboard: 'M4 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4m0 2h16v10H4V7m1 1v2h2V8H5m3 0v2h2V8H8m3 0v2h2V8h-2m3 0v2h2V8h-2m3 0v2h2V8h-2M5 11v2h2v-2H5m3 0v2h2v-2H8m3 0v2h2v-2h-2m3 0v2h2v-2h-2m3 0v2h2v-2h-2M8 14v2h8v-2H8Z',
  eraser: 'M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84L13.41 3.56c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95Z',
  check: 'M21 7 9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7Z',
};
const icon = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

export async function runOpening({ short = false, station = 0, cardRect }) {
  const sp = short ? CONFIG.OPENING.SHORT_SPEED : CONFIG.OPENING.SPEED;
  const T = ms => ms / sp;
  const root = $('#opening'), body = document.body;
  root.hidden = false; root.style.setProperty('--sp', sp);
  body.classList.add('scene-open'); body.classList.remove('host-on');
  root.innerHTML = `
    <svg id="bunting" aria-hidden="true"></svg>
    <div id="banner"><i></i><span>歡迎光臨</span><i></i></div>
    <div id="booth"><div id="clerk">${attendantSVG('full')}</div><div id="counter"><b></b></div></div>
    <div id="cardwrap">
      <canvas id="newcard"></canvas>
      <canvas id="sigink"></canvas>
      <input id="nameInput" maxlength="${CONFIG.OPENING.NAME_MAX}" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="name">
    </div>
    <div id="sigcatch"></div>
    <div id="signbar">
      <div class="seg">
        <button data-mode="pen" aria-label="pen">${icon(ICON.pen)}</button>
        <button data-mode="type" aria-label="keyboard">${icon(ICON.keyboard)}</button>
      </div>
      <button data-act="clear" aria-label="clear">${icon(ICON.eraser)}</button>
      <button data-act="done" class="done" aria-label="done">${icon(ICON.check)}</button>
    </div>
    <div id="dater" aria-hidden="true">${daterSVG()}</div>`;
  const clerk = $('#clerk');
  registerHost(clerk);
  buildBunting($('#bunting'));

  // ---------- 1. 抵達：彩旗、布條 ----------
  await wait(T(120));
  root.classList.add('flags-in');
  await wait(T(320));
  root.classList.add('banner-in');
  await wait(T(900));

  // ---------- 2. 站務員出場 ----------
  root.classList.add('clerk-in');
  await wait(T(380));
  setMood('happy');
  await say(short ? COPY.open.welcomeShort : COPY.open.welcome);
  setMood('');

  // ---------- 3. 從櫃台拿出集章卡，滑到面前 ----------
  const cardEl = $('#newcard'), R = cardRect;
  const paint = setupCard(cardEl, R);
  paint();
  const counterTop = $('#counter').getBoundingClientRect().top;
  const offer = { cx: innerWidth / 2, cy: Math.min(innerHeight - R.h * .2, counterTop + R.h * .4), s: .68, r: -3 };   // 遞到面前，下緣可以略超出畫面
  const tuck = { cx: innerWidth / 2, cy: counterTop - 6, s: .34, r: 0 };
  setCardPose(cardEl, R, tuck); cardEl.style.opacity = '0';
  await wait(30);
  cardEl.style.opacity = '1';
  await animateCard(cardEl, R, tuck, offer, T(780), 'cubic-bezier(.2,.9,.25,1.12)');
  say(COPY.open.give);

  // ---------- 4. 親手收下：往上滑，或長按 ----------
  await waitTake(cardEl, R, offer);
  say(COPY.open.taken);
  root.classList.add('booth-out');
  await animateCard(cardEl, R, cardEl._pose, { cx: R.x + R.w / 2, cy: R.y + R.h / 2, s: 1, r: 0 }, 620, 'cubic-bezier(.2,.8,.2,1)');
  cardEl.style.transform = 'none';
  body.classList.add('host-on');
  await wait(380);

  // ---------- 5. 簽名（或切換成打字；什麼都不寫也可以）----------
  const { name, signature } = await signStep(root, cardEl, R, paint);
  say(signature ? COPY.open.signed : name ? COPY.open.named(name) : COPY.open.skipped);

  // ---------- 6. 蓋日期章 ----------
  const dater = $('#dater');
  placeDater(dater, R);
  root.classList.add('dater-in');
  await new Promise(res => dater.addEventListener('pointerdown', e => { e.preventDefault(); res(); }, { once: true }));
  const issuedAt = new Date().toISOString();
  await stampDate(dater, cardEl, R, alpha => paint({ name, signature, dateISO: issuedAt, dateAlpha: alpha }));
  await store.issueCard({ name, signature, issuedAt });
  setMood('happy');
  await say(COPY.open.dated);
  setMood('');
  await say([COPY.open.rules, station ? COPY.open.goStation(station) : COPY.open.goFind]);

  // 收場：卡片位置剛好就是蓋章畫面的卡片，接手後無縫
  return () => {
    root.hidden = true; root.innerHTML = ''; root.className = '';
    body.classList.remove('scene-open');
  };
}

/* ---------------- 卡片 ---------------- */
function setupCard(el, R) {
  const dpr = Math.min(devicePixelRatio || 1, 2.5);
  let scale = dpr;
  const size = () => { el.width = Math.round(R.w * scale); el.height = Math.round(R.h * scale); };
  size();
  Object.assign(el.style, { left: R.x + 'px', top: R.y + 'px', width: R.w + 'px', height: R.h + 'px' });
  el.classList.add('ready');
  const c = el.getContext('2d');
  const paint = (opts = {}) => {
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.clearRect(0, 0, R.w, R.h);
    c.save(); roundRect(c, 0, 0, R.w, R.h, 7 * R.k); c.clip();
    c.drawImage(printCv, 0, 0, R.w, R.h); c.restore();
    drawCardExtras(c, 0, 0, R.k, { route: [], ...opts });
  };
  /* 放大簽名時提高解析度，字和底線才不會糊（限制總像素，避免手機記憶體不足） */
  paint.setZoom = z => { scale = Math.min(dpr * z, Math.sqrt(9e6 / (R.w * R.h))); size(); };
  return paint;
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function poseTransform(R, p) {
  const dx = p.cx - (R.x + R.w / 2), dy = p.cy - (R.y + R.h / 2);
  return `translate(${dx}px,${dy}px) rotate(${p.r}deg) scale(${p.s})`;
}
function setCardPose(el, R, p) { el._pose = p; el.style.transform = poseTransform(R, p); }
function animateCard(el, R, from, to, ms, easing) {
  el._pose = to;
  const a = el.animate([{ transform: poseTransform(R, from) }, { transform: poseTransform(R, to) }], { duration: ms, easing, fill: 'forwards' });
  return a.finished.then(() => { el.style.transform = poseTransform(R, to); a.cancel(); });
}

/* 收下卡片：往上滑超過門檻，或按住不放 */
function waitTake(el, R, offer) {
  const O = CONFIG.OPENING;
  return new Promise(res => {
    let id = null, sy = 0, sx = 0, t0 = 0, timer = 0, done = false;
    el.classList.add('offered');
    const finish = () => {
      if (done) return; done = true; clearTimeout(timer);
      el.classList.remove('offered', 'holding');
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      res();
    };
    const down = e => {
      e.preventDefault(); if (id !== null) return;
      id = e.pointerId; sy = e.clientY; sx = e.clientX; t0 = performance.now();
      try { el.setPointerCapture(id); } catch (_) {}
      el.classList.add('holding');
      timer = setTimeout(finish, O.TAKE_HOLD_MS);
    };
    const move = e => {
      if (e.pointerId !== id) return;
      const dy = e.clientY - sy, dx = e.clientX - sx;
      if (Math.hypot(dx, dy) > 10) clearTimeout(timer);                 // 在滑動，就不算長按
      const lift = Math.min(0, dy);
      setCardPose(el, R, { ...offer, cy: offer.cy + lift * .9 + Math.max(0, dy) * .15, r: offer.r * (1 + lift / 120) });
      if (-dy > O.TAKE_SWIPE) finish();
    };
    const up = e => {
      if (e.pointerId !== id) return;
      id = null; clearTimeout(timer); el.classList.remove('holding');
      if (!done) animateCard(el, R, el._pose, offer, 260, 'cubic-bezier(.3,1.4,.5,1)');
    };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
}

/* ---------------- 簽名欄：卡片放大到簽名欄，用手指（或滑鼠）簽名；也能切換成打字 ---------------- */
function signStep(root, cardEl, R, paint) {
  const O = CONFIG.OPENING;
  const wrap = $('#cardwrap'), ink = $('#sigink'), catcher = $('#sigcatch'), bar = $('#signbar'), input = $('#nameInput');
  const k = R.k;
  const Z = clamp(Math.min(innerWidth * .92 / (SIGN.w * k), innerHeight * .3 / (SIGN.h * k)), 1.4, O.SIGN_ZOOM_MAX);
  const cx = R.x + (SIGN.x + SIGN.w / 2) * k, cy = R.y + (SIGN.y + SIGN.h / 2) * k;
  const tx = innerWidth / 2 - Z * cx, ty = innerHeight * O.SIGN_AT - Z * cy;
  paint.setZoom(Z); paint({ hideName: true });

  // 筆跡畫布：只蓋在簽名欄上，即時只畫新的一小段
  const dpr = Math.min(devicePixelRatio || 1, 2.5), res = Math.min(dpr * Z, 8);
  Object.assign(ink.style, { left: R.x + SIGN.x * k + 'px', top: R.y + SIGN.y * k + 'px', width: SIGN.w * k + 'px', height: SIGN.h * k + 'px' });
  ink.width = Math.round(SIGN.w * k * res); ink.height = Math.round(SIGN.h * k * res);
  const ic = ink.getContext('2d');
  ic.setTransform(res, 0, 0, res, 0, 0);
  ic.strokeStyle = ic.fillStyle = PEN_INK; ic.lineCap = 'round'; ic.lineJoin = 'round';
  const ox = -SIGN.x * k, oy = -SIGN.y * k;      // 卡片單位 → 筆跡畫布座標

  placeInput(input, R);
  wrap.style.transform = `translate(${tx}px,${ty}px) scale(${Z})`;
  bar.style.top = innerHeight * O.SIGN_AT + SIGN.h * k * Z / 2 + 18 + 'px';
  root.classList.add('signing');

  let mode = 'pen';
  const strokes = [];
  const setMode = m => {
    mode = m; root.dataset.sign = m;
    bar.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    if (m === 'type') input.focus(); else input.blur();
  };
  setMode('pen');
  say(COPY.open.name);

  // 簽名：寫得越快，線越細
  let cur = null, last = null, pid = null;
  const toCard = e => { const r = cardEl.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * CARD.W, (e.clientY - r.top) / r.height * CARD.H]; };
  catcher.addEventListener('pointerdown', e => {
    e.preventDefault(); if (mode !== 'pen' || pid !== null) return;
    pid = e.pointerId; try { catcher.setPointerCapture(pid); } catch (_) {}
    const [u, v] = toCard(e);
    cur = [[+u.toFixed(1), +v.toFixed(1), +(O.PEN_MAX * .8).toFixed(2)]]; strokes.push(cur);
    last = { u, v, t: performance.now(), w: O.PEN_MAX * .8 };
    drawStroke(ic, ox, oy, k, cur);
  });
  catcher.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const [u, v] = toCard(e), now = performance.now(), d = Math.hypot(u - last.u, v - last.v);
    if (d < .35) return;
    const speed = d / Math.max(1, now - last.t);
    const w = lerp(last.w, clamp(O.PEN_MAX - speed * 2.2, O.PEN_MIN, O.PEN_MAX), .4);
    cur.push([+u.toFixed(1), +v.toFixed(1), +w.toFixed(2)]);
    last = { u, v, t: now, w };
    drawStroke(ic, ox, oy, k, cur, cur.length - 1);
  });
  const end = e => { if (e.pointerId !== pid) return; pid = null; if (cur) drawTail(ic, ox, oy, k, cur); cur = null; };
  catcher.addEventListener('pointerup', end); catcher.addEventListener('pointercancel', end);

  return new Promise(res => {
    let finished = false;
    const finish = async () => {
      if (finished) return; finished = true;
      input.blur();
      const sig = strokes.filter(s => s.length);
      const result = mode === 'pen' ? { name: '', signature: sig.length ? sig : null } : { name: input.value.trim(), signature: null };
      paint({ name: result.name, signature: result.signature });    // 先在卡片上畫好，再縮回去
      root.classList.remove('signing');
      wrap.style.transform = '';
      await wait(720);
      paint.setZoom(1); paint({ name: result.name, signature: result.signature });
      res(result);
    };
    bar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.mode) setMode(b.dataset.mode);
      else if (b.dataset.act === 'clear') { strokes.length = 0; ic.clearRect(0, 0, ink.width, ink.height); input.value = ''; if (mode === 'type') input.focus(); }
      else if (b.dataset.act === 'done') finish();
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(); } });
  });
}

/* ---------------- 名字欄 ---------------- */
function placeInput(input, R) {
  const size = Math.max(16, NAME.size * R.k);           // iOS 小於 16px 會自動放大頁面
  Object.assign(input.style, {
    left: R.x + NAME.x * R.k + 'px', top: R.y + (NAME.base * R.k - size * 1.05) + 'px',
    width: NAME.w * R.k + 'px', height: size * 1.4 + 'px', fontSize: size + 'px', fontFamily: NAME_FONT,
  });
}

/* ---------------- 日期章 ---------------- */
function daterSVG() {
  return `<svg viewBox="0 0 80 112">
    <ellipse cx="40" cy="106" rx="24" ry="4" fill="rgba(45,35,20,.16)"/>
    <circle cx="40" cy="20" r="15" fill="#B8865B"/><circle cx="35" cy="15" r="5" fill="#fff" opacity=".22"/>
    <rect x="34" y="31" width="12" height="20" rx="3" fill="#9C6F49"/>
    <rect x="16" y="50" width="48" height="36" rx="8" fill="#24221F"/>
    <rect x="22" y="56" width="36" height="5" rx="2.5" fill="#FF48B0"/>
    <rect x="13" y="86" width="54" height="12" rx="4" fill="${CONFIG.DATE_INK}"/>
  </svg>`;
}
function placeDater(el, R) {
  const w = 74, h = w * 112 / 80;
  el._home = { x: R.x + R.w * .5 - w / 2, y: Math.min(innerHeight - h - 24, R.y + R.h + 34) };
  Object.assign(el.style, { width: w + 'px', height: h + 'px', left: el._home.x + 'px', top: el._home.y + 'px' });
}
async function stampDate(el, cardEl, R, paintWith) {
  el.classList.add('using');
  const w = el.offsetWidth, h = el.offsetHeight;
  const tx = R.x + DATE.x * R.k - (el._home.x + w / 2);
  const ty = R.y + DATE.y * R.k - (el._home.y + h * .87);
  const tr = (x, y, s = 1, r = 0) => `translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;
  await el.animate([{ transform: tr(0, 0) }, { transform: tr(tx, ty - 46, 1.04, DATE.tilt) }],
    { duration: 520, easing: 'cubic-bezier(.3,.9,.3,1)', fill: 'forwards' }).finished;
  await wait(160);
  await el.animate([{ transform: tr(tx, ty - 46, 1.04, DATE.tilt) }, { transform: tr(tx, ty, .97, DATE.tilt) }],
    { duration: 140, easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' }).finished;
  // 咚！
  cardEl.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(2px)' }, { transform: 'translateY(-1px)' }, { transform: 'translateY(0)' }], { duration: 200 });
  if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) { try { navigator.vibrate(14); } catch (_) {} }
  paintWith(1);
  await wait(260);
  await el.animate([{ transform: tr(tx, ty, .97, DATE.tilt) }, { transform: tr(tx + 30, ty - 90, 1, 6), opacity: 0 }],
    { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished;
  el.style.visibility = 'hidden';
}

/* ---------------- 彩旗 ---------------- */
function buildBunting(svg) {
  const W = innerWidth, y0 = 0, sag = 26, n = clamp(Math.round(W / 34), 9, 26);
  svg.setAttribute('viewBox', `0 0 ${W} 70`);
  const yAt = x => y0 + 8 + sag * 4 * (x / W) * (1 - x / W);
  let html = `<path d="M-4 ${yAt(0)} Q${W / 2} ${8 + sag * 2} ${W + 4} ${yAt(W)}" fill="none" stroke="#24221F" stroke-width="1.2" opacity=".55"/>`;
  for (let i = 0; i < n; i++) {
    const x = (i + .5) * W / n, y = yAt(x), w = Math.min(22, W / n * .72), hh = w * 1.15;
    html += `<g class="flag" style="--d:${(i % 5) * -.37}s;--i:${i}"><path d="M${x - w / 2} ${y} L${x + w / 2} ${y} L${x} ${y + hh} Z" fill="${INK[i % 4]}"${INK[i % 4] === '#F7F4EE' ? ' stroke="rgba(36,34,31,.18)" stroke-width=".8"' : ''}/></g>`;
  }
  svg.innerHTML = html;
}
