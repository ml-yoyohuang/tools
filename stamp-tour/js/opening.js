/* 第 0 幕：抵達會場 → 站務員出場 → 親手收下集章卡 → 寫名字（可略過）→ 蓋日期章 → 說明玩法
   每一步都是「醞釀、動作、揭曉」。說明交給站務員，介面上沒有按鈕。 */
import { CONFIG } from './config.js';
import { COPY } from './copy.js';
import { CARD, printCv } from './print.js';
import { drawCardExtras, NAME, NAME_FONT, DATE } from './cardface.js';
import { attendantSVG, registerHost, say, setMood } from './attendant.js';
import { store } from './storage.js';
import { $, wait, clamp } from './util.js';

const INK = ['#FFE800', '#0078BF', '#FF48B0', '#F7F4EE'];

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
    <canvas id="newcard"></canvas>
    <input id="nameInput" maxlength="${CONFIG.OPENING.NAME_MAX}" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="name">
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

  // ---------- 5. 寫名字（可略過）＋日期章 ----------
  const input = $('#nameInput'), dater = $('#dater');
  let name = '', glow = true, glowT = performance.now();
  placeInput(input, R);
  input.addEventListener('input', () => { name = input.value.trim(); paint({ hideName: true, nameGlow: 0 }); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  let saidName = '';
  input.addEventListener('blur', () => {
    name = input.value.trim();
    if (name && name !== saidName) { saidName = name; say(COPY.open.named(name)); }
  });
  const glowLoop = () => {
    if (!glow) return;
    const t = (performance.now() - glowT) / 1000;
    paint({ hideName: true, nameGlow: name ? 0 : .5 + .5 * Math.sin(t * 3.2) });
    requestAnimationFrame(glowLoop);
  };
  requestAnimationFrame(glowLoop);
  placeDater(dater, R);
  root.classList.add('dater-in');
  say(COPY.open.name);

  await new Promise(res => dater.addEventListener('pointerdown', e => { e.preventDefault(); res(); }, { once: true }));
  input.blur(); name = input.value.trim(); glow = false;
  input.disabled = true;

  // ---------- 6. 蓋日期章 ----------
  const issuedAt = new Date().toISOString();
  await stampDate(dater, cardEl, R, alpha => paint({ hideName: true, dateISO: issuedAt, dateAlpha: alpha, name: '' }));
  input.style.visibility = 'hidden';
  paint({ name, dateISO: issuedAt });
  await store.issueCard({ name, issuedAt });
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
  el.width = Math.round(R.w * dpr); el.height = Math.round(R.h * dpr);
  Object.assign(el.style, { left: R.x + 'px', top: R.y + 'px', width: R.w + 'px', height: R.h + 'px' });
  el.classList.add('ready');
  const c = el.getContext('2d');
  return (opts = {}) => {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, R.w, R.h);
    c.save(); roundRect(c, 0, 0, R.w, R.h, 7 * R.k); c.clip();
    c.drawImage(printCv, 0, 0, R.w, R.h); c.restore();
    drawCardExtras(c, 0, 0, R.k, { route: [], ...opts });
  };
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
