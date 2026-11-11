/* 第 3 幕：集滿三站的慶祝（第一段）
   醞釀：燈暗下來，只剩聚光燈照著卡片；對話列上的站務員不見了
   動作：站務員抱著拉炮跑進來 → 你拉繩子 → 砰！三色紙花和墨水滴噴出來
   揭曉：你自己把完成章蓋在卡片上喜歡的地方（按穩的時間決定蓋出來的樣子）
   每一步都由使用者動手；說明交給站務員。 */
import { CONFIG } from './config.js';
import { COPY } from './copy.js';
import { attendantSVG, registerHost, say, setMood } from './attendant.js';
import { SEAL_SPAN } from './cardface.js';
import { $, TAU, clamp, lerp, wait } from './util.js';

const INKS = ['#FFE800', '#0078BF', '#FF48B0'], PAPER = '#F7F4EE';
const vibe = ms => { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) { try { navigator.vibrate(ms); } catch (_) {} } };
const sayFor = (lines, ms = 9000) => Promise.race([say(lines), wait(ms)]);   // 保險：台詞被別的台詞蓋掉時也會往下走

/* getCard()：卡片目前在畫面上的位置 {x, y, w, h, k}；onSeal(seal)：完成章蓋好了（存檔＋畫上卡面） */
export async function runFinale({ getCard, art, onSeal }) {
  const F = CONFIG.FINALE, root = $('#finale'), body = document.body;
  root.innerHTML = `
    <div class="dim"></div>
    <canvas class="confetti"></canvas>
    <div class="clerk">${attendantSVG('full')}</div>
    <div class="popper">${popperSVG()}</div>
    <svg class="cord"><line/><g class="ring"><circle class="hit" r="26"/><circle class="loop" r="8.5"/></g></svg>
    <div class="ghost"></div>
    <div class="sealer">${sealerSVG(F.SEAL_INK)}</div>`;
  root.hidden = false;
  body.classList.add('finale-on');
  const dim = $('#finale .dim'), cv = $('#finale .confetti'), clerk = $('#finale .clerk'), popper = $('#finale .popper');
  const cord = $('#finale .cord'), line = cord.querySelector('line'), ring = cord.querySelector('.ring');
  const ghost = $('#finale .ghost'), sealer = $('#finale .sealer');
  registerHost(clerk);

  /* ---------- 畫面配置 ---------- */
  const W = innerWidth, H = innerHeight;
  const ch = clamp(H * .21, 112, 176), cw = ch * .8;
  const clerkX = Math.min(W - cw * .62, W / 2 + Math.min(W * .2, 120)), clerkB = Math.max(10, H * .02);
  Object.assign(clerk.style, { width: cw + 'px', height: ch + 'px', left: clerkX - cw / 2 + 'px', bottom: clerkB + 'px' });
  const ph = ch * .6, pw = ph * 40 / 64, ANG = -32;                         // 拉炮朝左上，對著卡片
  const hand = { x: clerkX - cw * .5, y: H - clerkB - ch * .6 };          // 拉炮底部（握住的地方）：舉高一點，繩子才有空間往下拉
  Object.assign(popper.style, { width: pw + 'px', height: ph + 'px', left: hand.x - pw / 2 + 'px', top: hand.y - ph * .94 + 'px' });
  const axis = { x: Math.sin(ANG * Math.PI / 180), y: -Math.cos(ANG * Math.PI / 180) };
  const mouth = { x: hand.x + axis.x * ph * .9, y: hand.y + axis.y * ph * .9 };
  const REST = 44, PULL = Math.max(36, Math.min(F.PULL_PX, H - (hand.y + REST) - 14));   // 螢幕很矮時，拉短一點也算

  /* ---------- 聚光燈＋紙花：一個迴圈一直跟著卡片 ---------- */
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr;
  const cx = cv.getContext('2d');
  let pieces = [], running = true, last = performance.now();
  const loop = now => {
    if (!running) return;
    requestAnimationFrame(loop);
    const R = getCard(), r = Math.hypot(R.w, R.h) / 2;
    dim.style.background = `radial-gradient(circle at ${R.x + R.w / 2}px ${R.y + R.h / 2}px, rgba(14,11,8,0) ${r * .74}px, rgba(14,11,8,${F.DIM * .55}) ${r * 1.02}px, rgba(14,11,8,${F.DIM}) ${r * 1.6}px)`;
    const dt = Math.min(.04, (now - last) / 1000); last = now;
    stepConfetti(pieces, dt, H);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
    drawConfetti(cx, pieces);
  };
  requestAnimationFrame(loop);

  /* ========== 1. 醞釀：熄燈 ========== */
  await dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1100, easing: 'ease-in-out', fill: 'forwards' }).finished;
  await wait(500);

  /* ========== 2. 站務員抱著拉炮跑進來 ========== */
  const runIn = [{ translate: `${W - clerkX + cw}px 0` }, { translate: '-8px 0', offset: .82 }, { translate: '0 0' }];   // 用 translate，transform 留給拉炮的角度
  const bob = { duration: 900, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' };
  clerk.animate(runIn, bob); popper.animate(runIn, bob);
  clerk.querySelector('svg').animate([{ translate: '0 0' }, { translate: '0 -6px' }, { translate: '0 0' }], { duration: 225, iterations: 4 });   // 跑步的小跳
  await wait(900);
  placeCord(hand.x, hand.y + REST);
  cord.classList.add('in');
  setMood('happy');
  await sayFor(COPY.finale.arrive);
  setMood('');

  /* ========== 3. 拉繩子 → 砰！ ========== */
  await pullCord();
  cord.classList.add('gone');
  popper.animate([
    { transform: `rotate(${ANG}deg)` }, { transform: `translate(${-axis.x * 10}px, ${-axis.y * 10}px) rotate(${ANG - 6}deg) scale(.92)`, offset: .25 },
    { transform: `rotate(${ANG}deg)` },
  ], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' });
  vibe([22, 40, 16]);
  pieces = burst(mouth, axis, F.CONFETTI);
  dim.animate([{ opacity: 1 }, { opacity: .42 }], { duration: 700, easing: 'ease-out', fill: 'forwards' });
  setMood('happy');
  clerk.classList.add('cheer');
  await sayFor(COPY.finale.pop);
  clerk.classList.remove('cheer');
  setMood('');

  /* ========== 4. 完成章：自己蓋 ========== */
  popper.animate([{ opacity: 1 }, { opacity: 0, transform: `translate(${-cw * .2}px, ${ch * .4}px) rotate(${ANG - 40}deg)` }], { duration: 420, easing: 'ease-in', fill: 'forwards' });
  const R0 = getCard(), sw = SEAL_SPAN * .76 * R0.k * 80 / 54, sh = sw * 112 / 80;   // 章底寬 ≈ 完成章圖案寬
  Object.assign(sealer.style, { width: sw + 'px', height: sh + 'px' });
  const home = { x: clerkX - cw * .62, y: H - clerkB - ch * .18 };       // 章底中心的位置
  const put = (x, y, s = 1) => { sealer.style.transform = `translate(${x - sw / 2}px, ${y - sh * .82}px) scale(${s})`; };
  put(home.x, home.y);
  sealer.classList.add('in');
  const gs = 64 * R0.k;
  Object.assign(ghost.style, { width: gs + 'px', height: gs + 'px', marginLeft: -gs / 2 + 'px', marginTop: -gs / 2 + 'px' });
  say(COPY.finale.seal);
  const seal = await sealStep();
  onSeal({ art, ...seal });
  vibe(16);
  ghost.classList.remove('on');
  sealer.classList.remove('in', 'press');
  sealer.animate([{ opacity: 1 }, { opacity: 0, translate: '24px -90px', rotate: '8deg' }], { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
  await wait(420);
  setMood('happy');
  clerk.classList.add('cheer');
  const q = seal.hold < F.SEAL_GOOD_S * .55 ? 'light' : seal.hold > F.SEAL_BLEED_S + F.SEAL_BLEED_RANGE_S * .3 ? 'heavy' : 'good';
  await sayFor([COPY.finale.sealed[q], ...COPY.finale.end]);
  clerk.classList.remove('cheer');
  setMood('');

  /* ---------- 收場：燈亮，站務員揮手跑回去 ---------- */
  dim.animate([{ opacity: .42 }, { opacity: 0 }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
  await clerk.animate([{ translate: '0 0' }, { translate: `${W - clerkX + cw}px 0` }], { duration: 700, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }).finished;
  while (pieces.some(p => p.y < H + (p.type === 'streamer' ? 240 : 40))) await wait(200);
  running = false;
  root.hidden = true; root.innerHTML = '';
  body.classList.remove('finale-on');

  /* ---------------- 拉繩 ---------------- */
  function placeCord(x, y) {
    line.setAttribute('x1', hand.x); line.setAttribute('y1', hand.y);
    line.setAttribute('x2', x); line.setAttribute('y2', y);
    ring.setAttribute('transform', `translate(${x} ${y})`);
  }
  function pullCord() {
    return new Promise(res => {
      let id = null, nagged = false;
      const tilt = d => { popper.style.transform = `rotate(${ANG + clamp(d * .12, 0, 9)}deg)`; };
      tilt(0);
      ring.addEventListener('pointerdown', e => {
        e.preventDefault(); if (id !== null) return;
        id = e.pointerId; try { ring.setPointerCapture(id); } catch (_) {}
        cord.classList.add('held');
      });
      ring.addEventListener('pointermove', e => {
        if (e.pointerId !== id) return;
        const dx = e.clientX - hand.x, dy = Math.max(8, e.clientY - hand.y);
        const len = Math.hypot(dx, dy), d = len - REST;
        placeCord(hand.x + dx, hand.y + dy); tilt(d);
        if (d >= PULL) { id = null; cord.classList.remove('held'); res(); }
      });
      const up = e => {
        if (e.pointerId !== id) return;
        id = null; cord.classList.remove('held');
        const from = { x: +line.getAttribute('x2'), y: +line.getAttribute('y2') };
        const t0 = performance.now();
        const spring = now => {        // 彈回去
          const t = Math.min(1, (now - t0) / 380), e2 = 1 - Math.pow(1 - t, 3) * Math.cos(t * 6);
          placeCord(lerp(from.x, hand.x, e2), lerp(from.y, hand.y + REST, e2)); tilt((1 - e2) * 30);
          if (t < 1) requestAnimationFrame(spring);
        };
        requestAnimationFrame(spring);
        if (!nagged) { nagged = true; say(COPY.finale.pullMore); }
      };
      ring.addEventListener('pointerup', up); ring.addEventListener('pointercancel', up);
    });
  }

  /* ---------------- 完成章 ---------------- */
  function sealStep() {
    return new Promise(res => {
      let id = null, off = { x: 0, y: 0 }, pos = { ...home }, still = 0, vx = 0, lastP = null, raf = 0;
      const over = () => { const R = getCard(); return pos.x > R.x && pos.x < R.x + R.w && pos.y > R.y && pos.y < R.y + R.h; };
      const tick = now => {            // 停在卡片上不動 → 慢慢壓下去
        raf = requestAnimationFrame(tick);
        if (id === null) return;
        const p = over() ? clamp((now - still) / (F.SEAL_GOOD_S * 1000), 0, 1) : 0;
        put(pos.x, pos.y, 1 - .06 * p);
        ghost.style.opacity = over() ? (.35 + .5 * p).toFixed(2) : '0';
        sealer.classList.toggle('press', p > 0);
      };
      raf = requestAnimationFrame(tick);
      sealer.addEventListener('pointerdown', e => {
        e.preventDefault(); if (id !== null) return;
        id = e.pointerId; try { sealer.setPointerCapture(id); } catch (_) {}
        // 手指會擋住章底：觸控時章底在手指上方
        off = e.pointerType === 'mouse' ? { x: pos.x - e.clientX, y: pos.y - e.clientY } : { x: 0, y: -Math.max(58, sh * .55) };
        pos = { x: e.clientX + off.x, y: e.clientY + off.y };
        still = performance.now(); lastP = { x: e.clientX, t: still };
        sealer.classList.add('held'); ghost.classList.add('on');
      });
      sealer.addEventListener('pointermove', e => {
        if (e.pointerId !== id) return;
        const np = { x: e.clientX + off.x, y: e.clientY + off.y }, now = performance.now();
        if (Math.hypot(np.x - pos.x, np.y - pos.y) > 2.5) still = now;
        vx = lerp(vx, (e.clientX - lastP.x) / Math.max(8, now - lastP.t) * 1000, .3); lastP = { x: e.clientX, t: now };
        pos = np;
        ghost.style.left = pos.x + 'px'; ghost.style.top = pos.y + 'px';
      });
      const up = e => {
        if (e.pointerId !== id) return;
        id = null; sealer.classList.remove('held', 'press');
        if (!over()) {                  // 沒放在卡片上：回到站務員旁邊
          ghost.style.opacity = '0';
          sealer.animate([{ transform: sealer.style.transform }, { transform: `translate(${home.x - sw / 2}px, ${home.y - sh * .82}px)` }], { duration: 360, easing: 'cubic-bezier(.3,.9,.3,1)' });
          pos = { ...home }; put(home.x, home.y);
          return;
        }
        cancelAnimationFrame(raf);
        const R = getCard(), hold = (performance.now() - still) / 1000;
        res({
          x: +((pos.x - R.x) / R.k).toFixed(1), y: +((pos.y - R.y) / R.k).toFixed(1),
          a: +clamp(vx * .006 + (Math.random() - .5) * 8, -12, 12).toFixed(1),
          hold: +hold.toFixed(2), seed: (Date.now() ^ (Math.random() * 1e9)) | 0, at: new Date().toISOString(),
        });
      };
      sealer.addEventListener('pointerup', up); sealer.addEventListener('pointercancel', up);
      ghost.style.left = pos.x + 'px'; ghost.style.top = pos.y + 'px';
    });
  }
}

/* ---------------- 紙花 ---------------- */
function burst(o, axis, n) {
  const base = Math.atan2(axis.y, axis.x), out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random(), type = r < .1 ? 'streamer' : r < .38 ? 'drop' : 'paper';
    const a = base + (Math.random() - .5) * 1.2, sp = 950 + Math.random() * 1150;
    out.push({
      type, x: o.x + (Math.random() - .5) * 8, y: o.y + (Math.random() - .5) * 8,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      rot: Math.random() * TAU, vr: (Math.random() - .5) * 14, ph: Math.random() * TAU, fr: 5 + Math.random() * 7,
      vt: type === 'streamer' ? 170 + Math.random() * 70 : 60 + Math.random() * 80,
      sway: 18 + Math.random() * 30, s: type === 'drop' ? 4 + Math.random() * 3 : 4 + Math.random() * 3.5,
      col: Math.random() < .14 ? PAPER : INKS[i % 3], trail: [], t: 0,
    });
  }
  return out;
}
function stepConfetti(ps, dt, H) {
  for (const p of ps) {
    if (p.y > H + (p.type === 'streamer' ? 260 : 60)) continue;   // 彩帶的尾巴比較長，要等整條掉出畫面
    p.t += dt;
    p.vy += 950 * dt;
    const k = Math.exp(-1.4 * dt);
    p.vx *= k; if (p.vy < 0) p.vy *= k;
    if (p.vy > p.vt) p.vy += (p.vt - p.vy) * Math.min(1, dt * 5);    // 下落時被空氣托住，慢慢飄
    const sway = p.vy > 0 ? Math.sin(p.t * 3 + p.ph) * p.sway : 0;
    p.x += (p.vx + sway) * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt; p.ph += p.fr * dt;
    if (p.type === 'streamer') { p.trail.unshift({ x: p.x, y: p.y }); if (p.trail.length > 16) p.trail.pop(); }
  }
}
function drawConfetti(c, ps) {
  for (const p of ps) {
    c.fillStyle = c.strokeStyle = p.col;
    if (p.type === 'streamer') {
      if (p.trail.length < 2) continue;
      c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath();
      p.trail.forEach((q, i) => { const w = Math.sin(i * .9 + p.ph) * 4; i ? c.lineTo(q.x + w, q.y) : c.moveTo(q.x + w, q.y); });
      c.stroke(); continue;
    }
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
    if (p.type === 'paper') {
      c.scale(1, Math.cos(p.ph));       // 翻面
      c.fillRect(-p.s * 1.1, -p.s * .65, p.s * 2.2, p.s * 1.3);
    } else {                            // 墨水滴
      const s = p.s; c.scale(1, .85 + .15 * Math.cos(p.ph));
      c.beginPath(); c.moveTo(0, -s * 1.7);
      c.bezierCurveTo(s * .55, -s * .7, s, -s * .1, s, s * .35);
      c.arc(0, s * .35, s, 0, Math.PI);
      c.bezierCurveTo(-s, -s * .1, -s * .55, -s * .7, 0, -s * 1.7); c.fill();
    }
    c.restore();
  }
}

/* ---------------- 道具 ---------------- */
function popperSVG() {          // 拉炮：三色斜紋圓錐，開口朝上；底部是站務員的手
  return `<svg viewBox="0 0 40 64" aria-hidden="true">
    <defs><clipPath id="cone"><path d="M3 7 L37 7 L22.5 58 L17.5 58 Z"/></clipPath>
      <pattern id="stripe" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
        <rect width="12" height="12" fill="#FFE800"/><rect width="4" height="12" fill="#FF48B0"/><rect x="4" width="4" height="12" fill="#0078BF"/>
      </pattern></defs>
    <g clip-path="url(#cone)"><rect width="40" height="64" fill="url(#stripe)"/></g>
    <path d="M3 7 L37 7 L22.5 58 L17.5 58 Z" fill="none" stroke="#24221F" stroke-width="1.4" stroke-linejoin="round"/>
    <ellipse cx="20" cy="7" rx="17" ry="3.6" fill="#24221F"/>
    <path d="M8 6 L10 1 L13 6 M16 5 L19 0 L22 5 M25 6 L29 1 L31 6" fill="#F7F4EE" stroke="#24221F" stroke-width=".8" stroke-linejoin="round"/>
    <ellipse cx="20" cy="57" rx="7.5" ry="6.5" fill="#F3E3CF" stroke="#24221F" stroke-width="1.1"/>
  </svg>`;
}
function sealerSVG(ink) {       // 完成章：跟日期章同一型，章底換成完成章的朱紅，帽帶換黃色
  return `<svg viewBox="0 0 80 112" aria-hidden="true">
    <ellipse class="shadow" cx="40" cy="106" rx="24" ry="4" fill="rgba(45,35,20,.2)"/>
    <circle cx="40" cy="20" r="15" fill="#B8865B"/><circle cx="35" cy="15" r="5" fill="#fff" opacity=".22"/>
    <rect x="34" y="31" width="12" height="20" rx="3" fill="#9C6F49"/>
    <rect x="16" y="50" width="48" height="36" rx="8" fill="#24221F"/>
    <rect x="22" y="56" width="36" height="5" rx="2.5" fill="#FFE800"/>
    <rect x="13" y="86" width="54" height="12" rx="4" fill="${ink}"/>
  </svg>`;
}
