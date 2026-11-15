import { readLedger, settle, newRiteId, roundsAvailable, cnNum, ROUND } from './ledger.js';
import { scrollBlob } from './scroll.js';
import { cnDate } from './poster.js';
import { RiteAudio } from './rite-audio.js';

/*
 * 十方迴向: a small rite of this site's own, inspired by the spirit of dedicating merit.
 * Act 1 靜心 — a bell, and प्रेम surfaces.  Act 2 十數稱念 — ten knocks of the wooden fish
 * light the Devanagari numerals ० … ९.  Act 3 迴向十方 — ten rays, wishes as points of light,
 * the blessings; then the lights gather into the 百願經卷.
 * Rounds change how rich it is, never how long: one round or twelve, ten knocks, ~25 s.
 */

export const NUMERALS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export const WORD = 'प्रेम';

const COPY = {
  plan: (rounds) => `${cnNum(rounds * ROUND)}紙龜，${cnNum(rounds)}輪祈願。`,
  note: (rounds) => `禮成後，${cnNum(rounds * ROUND)}紙龜將收存於迴向紀錄。`,
  still: (rounds) => (rounds === 1 ? '百願既集，宜行迴向。' : `${cnNum(rounds)}輪祈願，迴向十方。`),
  hint: '輕敲木魚',
  blessings: ['願以此番善念，迴向天地一切有情。', '願晴雨各得其時，萬物各得其安。', '所願皆善，所行皆順。'],
  title: (rounds) => `十方迴向・${cnNum(rounds)}輪圓滿`,
  sent: (count) => `${cnNum(count)}份祈願，已寄於天地。`,
  peace: '願晴雨各得其時，萬物皆安。',
  making: '經卷收束中',
  failed: '經卷暫時無法生成。迴向已經完成，可以再試一次。',
  gone: '這批紙龜已在其他分頁完成迴向。',
  storage: '紀錄暫時無法寫入，紙龜都還在。稍後可以再試一次。',
  privacy: '經卷上有你寫下的心願，分享前請先看過。',
};

// Seconds. Act 2 waits for the ten knocks.
const T = { word: 0.5, line: 1.8, count: 5.2, fish: 5.8, afterTen: 1.1, blessing: [3.2, 6.2, 9.2], gather: 12.6, gatherFor: 2.4 };
const T_REDUCED = { word: 0.2, line: 0.8, count: 2.4, fish: 2.6, afterTen: 0.6, blessing: [1.2, 2.8, 4.4], gather: 6.6, gatherFor: 1 };
const MAX_LAYERS = 5;
const MAX_POINTS = 450;
const GOLD = [200, 163, 95];
const GOLD_HI = [234, 214, 164];

const damp = (x, goal, k, dt) => x + (goal - x) * (1 - Math.exp(-k * dt));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const isoDate = (t) => {
  const d = new Date(t);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * deps: { save(blob, name), share(blob, name) → Promise<boolean>, canShare, onCover(bool), onClose(changed) }
 */
export function createRite(deps) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TT = reduced ? T_REDUCED : T;
  const root = document.getElementById('rite');
  const $ = (s) => root.querySelector(s);
  const canvas = $('.rite-canvas');
  const g = canvas.getContext('2d');
  const word = $('.rite-word');
  const ring = $('.rite-ring');
  const line = $('.rite-line');
  const fish = $('.rite-fish');
  const hint = $('.rite-hint');
  const muteBtn = $('.rite-mute');
  const leaveBtn = $('.rite-leave');
  const doneTitle = $('.rite-done-title');
  const doneLines = $('.rite-done-lines');
  const figure = $('.rite-scroll');
  const scrollImg = figure.querySelector('img');
  const scrollMsg = $('.rite-scroll-msg');
  const retryBtn = $('.rite-retry');
  const saveBtn = $('[data-act="save"]');
  const shareBtn = $('[data-act="share"]');
  const finishBtn = $('[data-act="finish"]');
  const privacy = $('.rite-privacy');
  const historyList = $('.rite-history ol');
  word.textContent = WORD;
  ring.innerHTML = NUMERALS.map((n) => `<li>${n}</li>`).join('');
  const nums = [...ring.children];
  const audio = new RiteAudio();

  let open = false;
  let mode = null; // prep | rite | done | history | record
  let rounds = 0;
  let level = 0;
  let riteId = null;
  let lit = 0;
  let timers = [];
  let changed = false;
  let record = null;
  let blob = null;
  let lastFocus = null;
  let raf = 0;
  let phase = 'idle'; // still | count | spread | gather | rest
  let phaseAt = 0;
  let last = 0;
  const geo = { w: 0, h: 0, dpr: 1, cx: 0, cy: 0, R: 0 };
  const v = { inner: 0, numRing: 0, progress: 0, glow: 0, rays: 0, layers: [], extra: 0, gather: 0, fade: 1 };
  const pts = [];
  let target = null;

  const later = (s, fn) => timers.push(setTimeout(fn, s * 1000));
  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };
  const setMode = (m) => {
    mode = m;
    root.dataset.mode = m;
  };

  /* ---------- Layout ---------- */

  function layout() {
    const w = root.clientWidth;
    const h = root.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    Object.assign(geo, { w, h, dpr, cx: w / 2, cy: h * (w < 700 ? 0.4 : 0.44), R: Math.min(w * 0.33, h * 0.23, 300) });
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const { cx, cy, R } = geo;
    root.style.setProperty('--word', `${Math.max(40, R * 0.42)}px`);
    root.style.setProperty('--num', `${Math.max(16, Math.min(30, R * 0.15))}px`);
    word.style.left = `${cx}px`;
    word.style.top = `${cy}px`;
    nums.forEach((el, k) => {
      const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
      el.style.left = `${cx + Math.cos(a) * R}px`;
      el.style.top = `${cy + Math.sin(a) * R}px`;
    });
    fish.style.top = `${Math.min(h - 120, cy + R * 1.18 + 64)}px`;
    hint.style.top = `${Math.min(h - 62, cy + R * 1.18 + 116)}px`;
  }
  addEventListener('resize', () => open && layout());

  /* ---------- Open / close ---------- */

  function show(m) {
    lastFocus = document.activeElement;
    open = true;
    changed = false;
    root.hidden = false;
    layout();
    setMode(m);
    requestAnimationFrame(() => root.classList.add('open'));
  }

  function close() {
    if (!open) return;
    clearTimers();
    audio.stop();
    cancelAnimationFrame(raf);
    raf = 0;
    open = false;
    root.classList.remove('open', 'lit', 'gathering');
    deps.onCover(false);
    setTimeout(() => {
      if (!open) root.hidden = true;
    }, 500);
    if (blob && scrollImg.src) URL.revokeObjectURL(scrollImg.src);
    scrollImg.removeAttribute('src');
    blob = null;
    deps.onClose(changed);
    lastFocus?.focus?.();
    // the entry icon may have just disappeared (fewer than 100 left): land somewhere sensible
    if (!root.contains(document.activeElement) && document.activeElement !== lastFocus) deps.focusAfter?.();
  }

  function openPrep() {
    const l = readLedger();
    if (!l) return;
    rounds = roundsAvailable(l);
    if (rounds < 1) return;
    level = Math.min(rounds, MAX_LAYERS);
    riteId = newRiteId();
    $('.rite-plan').textContent = COPY.plan(rounds);
    $('.rite-note').textContent = COPY.note(rounds);
    show('prep');
    $('[data-act="start"]').focus();
  }

  function openHistory() {
    const l = readLedger();
    if (!l || !l.records.length) return;
    historyList.innerHTML = '';
    [...l.records].reverse().forEach((r) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span>${COPY.title(r.rounds)}</span><small>${cnDate(isoDate(r.at))}・${cnNum(r.count)}則</small>`;
      b.addEventListener('click', () => showRecord(r, true));
      li.append(b);
      historyList.append(li);
    });
    show('history');
    historyList.querySelector('button')?.focus();
  }

  /* ---------- The rite ---------- */

  function begin() {
    setMode('rite');
    deps.onCover(true);
    audio.start(level);
    syncMute();
    lit = 0;
    nums.forEach((n) => n.classList.remove('lit'));
    root.classList.remove('lit', 'gathering', 'counting', 'spreading', 'still');
    Object.assign(v, { inner: 0, numRing: 0, progress: 0, glow: 0, rays: 0, layers: Array(level).fill(0), extra: 0, gather: 0, fade: 1 });
    pts.length = 0;
    line.textContent = '';
    line.classList.remove('on');
    setPhase('still');
    last = performance.now();
    raf = requestAnimationFrame(frame);

    // Act 1 · 靜心
    later(0.25, () => audio.bell(1, 1));
    later(0.4, () => audio.pad(1)); // a faint drone beneath; richer layers join in act 3
    later(TT.word, () => root.classList.add('still'));
    later(TT.line, () => say(COPY.still(rounds)));
    // Act 2 · 十數稱念
    later(TT.count, () => {
      setPhase('count');
      unsay();
      root.classList.add('counting');
    });
    later(TT.fish, () => {
      root.classList.add('fish-on');
      fish.disabled = false;
      fish.focus({ preventScroll: true });
    });
    leaveBtn.focus({ preventScroll: true });
  }

  function knock() {
    if (phase !== 'count' || lit >= 10) return;
    audio.knock();
    fish.classList.remove('struck');
    void fish.offsetWidth;
    fish.classList.add('struck');
    nums[lit].classList.add('lit');
    lit++;
    v.glow = Math.min(1.4, v.glow + 0.55);
    if (lit === 1) hint.classList.add('gone');
    if (lit === 10) {
      fish.disabled = true;
      later(TT.afterTen, spread);
    }
  }
  fish.addEventListener('click', knock);

  // Act 3 · 迴向十方
  function spread() {
    setPhase('spread');
    root.classList.remove('fish-on', 'counting');
    root.classList.add('spreading', 'lit');
    line.innerHTML = ''; // act 1's line gives way to the blessings
    audio.bell(1, 1);
    if (level >= 3) audio.pad(level);
    if (level >= 2) for (let i = 0; i < Math.min(6, level + 1); i++) audio.chime(i, 0.6 + i * 0.45);
    const n = Math.min(MAX_POINTS, 70 + 75 * (level - 1) + Math.max(0, Math.min(rounds - MAX_LAYERS, 10)) * 8);
    for (let i = 0; i < n; i++) {
      const ray = i % 10;
      pts.push({
        a: -Math.PI / 2 + (ray / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
        r: geo.R * (1.05 + Math.random() * 0.2),
        sp: geo.R * (0.12 + Math.random() * 0.5),
        orbit: (Math.random() - 0.5) * 0.06,
        born: (reduced ? 0 : 0.8) + Math.random() * (reduced ? 0.6 : 4.2),
        size: 0.7 + Math.pow(Math.random(), 3) * 1.8,
        tw: Math.random() * 10,
        x: 0,
        y: 0,
      });
    }
    TT.blessing.forEach((s, i) =>
      later(s, () => {
        sayAppend(COPY.blessings[i]);
        if (level >= 2) audio.chime(i + 2);
      })
    );
    later(TT.gather, gather);
  }

  async function gather() {
    // the done panel lays itself out invisibly, so the lights know where the scroll will be
    prepareDone(null);
    root.classList.add('measuring');
    const rc = figure.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    target = { x: rc.left - rr.left, y: rc.top - rr.top, w: rc.width, h: rc.height };
    root.classList.remove('measuring');
    for (const p of pts) {
      p.gx = target.x + target.w * (0.08 + Math.random() * 0.84);
      p.gy = target.y + target.h * (0.06 + Math.random() * 0.88);
    }
    setPhase('gather');
    root.classList.add('gathering');
    audio.stopPad(3);

    const settled = settle(riteId, rounds);
    const minWait = new Promise((res) => later(TT.gatherFor, res));
    const result = await settled;
    if (!open) return;
    if (result.error) {
      await minWait;
      if (open) failSettle(result.error);
      return;
    }
    record = result.record;
    changed = true;
    const making = makeScroll(record);
    await minWait;
    if (!open) return;
    setPhase('rest');
    audio.close(level);
    showDone();
    await making;
  }

  /* ---------- Done / record ---------- */

  function prepareDone(r) {
    doneTitle.textContent = COPY.title(r ? r.rounds : rounds);
    doneLines.innerHTML = '';
    for (const t of [COPY.sent(r ? r.count : rounds * ROUND), COPY.peace]) {
      const p = document.createElement('p');
      p.textContent = t;
      doneLines.append(p);
    }
  }

  function showDone() {
    prepareDone(record);
    retryBtn.hidden = true;
    finishBtn.textContent = '禮成';
    setMode('done');
    root.classList.remove('gathering', 'spreading', 'still');
    deps.onCover(true);
    finishBtn.focus({ preventScroll: true });
  }

  function showRecord(r, fromHistory) {
    record = r;
    prepareDone(r);
    const p = document.createElement('p');
    p.className = 'rite-done-date';
    p.textContent = cnDate(isoDate(r.at));
    doneLines.prepend(p);
    finishBtn.textContent = '返回';
    finishBtn.dataset.back = fromHistory ? 'history' : '';
    setMode('record');
    makeScroll(r);
    finishBtn.focus({ preventScroll: true });
  }

  async function makeScroll(r) {
    blob = null;
    figure.classList.remove('ready', 'failed');
    figure.classList.add('making');
    scrollMsg.textContent = COPY.making;
    saveBtn.disabled = shareBtn.disabled = true;
    retryBtn.hidden = true;
    try {
      const b = await scrollBlob(r);
      if (record !== r) return;
      blob = b;
      if (scrollImg.src) URL.revokeObjectURL(scrollImg.src);
      scrollImg.src = URL.createObjectURL(b);
      await scrollImg.decode().catch(() => {});
      figure.classList.remove('making');
      figure.classList.add('ready');
      scrollMsg.textContent = '';
      saveBtn.disabled = shareBtn.disabled = false;
    } catch {
      if (record !== r) return;
      figure.classList.remove('making');
      figure.classList.add('failed');
      scrollMsg.textContent = COPY.failed;
      retryBtn.hidden = false;
    }
  }

  function failSettle(kind) {
    setPhase('rest');
    doneTitle.textContent = '十方迴向';
    doneLines.innerHTML = `<p>${kind === 'gone' ? COPY.gone : COPY.storage}</p>`;
    figure.classList.remove('ready', 'making');
    figure.classList.add('failed');
    scrollMsg.textContent = '';
    retryBtn.hidden = kind !== 'storage';
    retryBtn.dataset.kind = 'settle';
    finishBtn.textContent = '返回';
    setMode('done');
    root.classList.add('settle-failed');
    root.classList.remove('gathering', 'spreading', 'still');
    finishBtn.focus({ preventScroll: true });
  }

  retryBtn.addEventListener('click', async () => {
    if (retryBtn.dataset.kind === 'settle') {
      retryBtn.disabled = true;
      const result = await settle(riteId, rounds);
      retryBtn.disabled = false;
      if (result.error) return failSettle(result.error);
      retryBtn.dataset.kind = '';
      root.classList.remove('settle-failed');
      record = result.record;
      changed = true;
      showDone();
      makeScroll(record);
    } else if (record) makeScroll(record);
  });

  const fileName = (r) => `百願經卷-${isoDate(r.at).replaceAll('-', '')}.png`;
  saveBtn.addEventListener('click', () => blob && deps.save(blob, fileName(record)));
  shareBtn.addEventListener('click', () => blob && deps.share(blob, fileName(record)));
  shareBtn.hidden = !deps.canShare;
  privacy.textContent = COPY.privacy;

  finishBtn.addEventListener('click', () => {
    if (mode === 'record' && finishBtn.dataset.back === 'history') openHistoryInPlace();
    else close();
  });

  function openHistoryInPlace() {
    const keepFocus = lastFocus;
    const wasChanged = changed;
    open = false;
    openHistory();
    lastFocus = keepFocus;
    changed = wasChanged;
  }

  $('[data-act="start"]').addEventListener('click', begin);
  $('[data-act="back"]').addEventListener('click', close);
  $('.rite-history [data-act="close"]').addEventListener('click', close);
  leaveBtn.addEventListener('click', close);

  function syncMute() {
    muteBtn.setAttribute('aria-pressed', String(audio.muted));
    muteBtn.setAttribute('aria-label', audio.muted ? '開啟聲音' : '靜音');
  }
  muteBtn.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    syncMute();
  });
  syncMute();

  /* ---------- Words ---------- */

  function say(t) {
    line.innerHTML = '';
    sayAppend(t);
  }
  function sayAppend(t) {
    const p = document.createElement('span');
    p.textContent = t;
    line.append(p);
    line.classList.add('on');
    requestAnimationFrame(() => p.classList.add('in'));
  }
  function unsay() {
    line.classList.remove('on');
  }

  /* ---------- Keyboard: Escape, and keep focus inside ---------- */

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // Escape here closes the rite only, not the gallery behind it
      if (mode === 'record' && finishBtn.dataset.back === 'history') openHistoryInPlace();
      else close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...root.querySelectorAll('button:not([disabled]):not([hidden])')].filter((b) => b.offsetParent !== null && getComputedStyle(b).visibility !== 'hidden');
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
    e.preventDefault();
    items[next].focus();
  });

  /* ---------- Drawing ---------- */

  function setPhase(p) {
    phase = p;
    phaseAt = performance.now();
  }

  function frame(now) {
    if (!open) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - phaseAt) / 1000;
    const { w, h, dpr, cx, cy, R } = geo;
    const k = reduced ? 6 : 1.6;

    // targets per phase
    const tInner = phase === 'gather' || phase === 'rest' ? 0 : 1;
    v.inner = damp(v.inner, tInner, phase === 'still' ? 0.7 * k : 2, dt);
    const tRing = phase === 'count' || phase === 'spread' ? 1 : 0;
    v.numRing = damp(v.numRing, tRing, 1.5 * k, dt);
    v.progress = damp(v.progress, lit / 10, 6, dt);
    const baseGlow = phase === 'spread' ? 0.55 + 0.09 * level : phase === 'count' ? 0.25 : phase === 'still' ? 0.18 : 0;
    v.glow = damp(v.glow, baseGlow, 1.4, dt);
    v.rays = damp(v.rays, phase === 'spread' ? 1 : 0, phase === 'spread' ? 0.45 * k : 2.2, dt);
    v.layers = v.layers.map((a, i) => damp(a, phase === 'spread' && t > 0.6 + i * 0.55 ? 1 : 0, phase === 'spread' ? 0.9 * k : 2.5, dt));
    v.extra = damp(v.extra, phase === 'spread' && rounds > MAX_LAYERS && t > 3.4 ? 1 : 0, 0.9, dt);
    v.gather = phase === 'gather' ? Math.min(1, t / TT.gatherFor) : phase === 'rest' ? 1 : 0;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    // breath of light at the centre
    if (v.glow > 0.01) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
      gr.addColorStop(0, `rgba(255,186,110,${0.2 * v.glow})`);
      gr.addColorStop(0.45, `rgba(200,130,60,${0.07 * v.glow})`);
      gr.addColorStop(1, 'rgba(200,130,60,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }

    g.lineCap = 'round';
    // inner rings around the word, drawn round once like a brush circle
    if (v.inner > 0.002) {
      g.strokeStyle = rgba(GOLD_HI, 0.5 * Math.min(1, v.inner * 1.4));
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, R * 0.55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, v.inner * 1.05));
      g.stroke();
      g.strokeStyle = rgba(GOLD, 0.22 * v.inner);
      g.lineWidth = 0.6;
      g.beginPath();
      g.arc(cx, cy, R * 0.61, 0, Math.PI * 2);
      g.stroke();
    }

    // the numeral ring: two hairlines and a ring of ticks, progress drawn in gold
    if (v.numRing > 0.002) {
      const a = v.numRing;
      g.strokeStyle = rgba(GOLD, 0.28 * a);
      g.lineWidth = 0.7;
      for (const rr of [R * 0.84, R * 1.16]) {
        g.beginPath();
        g.arc(cx, cy, rr, 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = rgba(GOLD, 0.2 * a);
      for (let i = 0; i < 60; i++) {
        const an = (i / 60) * Math.PI * 2;
        const r0 = R * 1.16;
        g.beginPath();
        g.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0);
        g.lineTo(cx + Math.cos(an) * (r0 - (i % 6 === 0 ? 7 : 3.5)), cy + Math.sin(an) * (r0 - (i % 6 === 0 ? 7 : 3.5)));
        g.stroke();
      }
      if (v.progress > 0.001) {
        g.strokeStyle = rgba(GOLD_HI, 0.9 * a);
        g.lineWidth = 1.6;
        g.beginPath();
        g.arc(cx, cy, R * 0.84, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v.progress);
        g.stroke();
      }
    }

    // ten rays, one from each numeral
    if (v.rays > 0.002) {
      const reach = Math.hypot(w, h) * 0.6 * ease(Math.min(1, v.rays));
      const bright = (0.38 + 0.06 * level) * (1 - v.gather);
      for (let i = 0; i < 10; i++) {
        const an = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const breathe = reduced ? 1 : 0.85 + 0.15 * Math.sin(now / 900 + i * 0.7);
        const x0 = cx + Math.cos(an) * R * 1.22;
        const y0 = cy + Math.sin(an) * R * 1.22;
        const x1 = cx + Math.cos(an) * (R * 1.22 + reach);
        const y1 = cy + Math.sin(an) * (R * 1.22 + reach);
        const gr = g.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, rgba(GOLD_HI, bright * breathe));
        gr.addColorStop(1, rgba(GOLD_HI, 0));
        g.strokeStyle = gr;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
        g.globalAlpha = 0.12;
        g.lineWidth = 7;
        g.stroke();
        g.globalAlpha = 1;
      }
    }

    // layered wheels, one per round (at most five)
    v.layers.forEach((a, i) => {
      if (a < 0.003) return;
      const rr = R * (1.36 + 0.21 * i) * (1 - 0.25 * v.gather);
      const seg = 10 * (i + 1);
      const circ = Math.PI * 2 * rr;
      g.save();
      g.translate(cx, cy);
      g.rotate(reduced ? 0 : (now / 1000) * 0.035 * (i % 2 ? -1 : 1) * (1 + i * 0.2));
      g.setLineDash([circ / seg * 0.55, circ / seg * 0.45]);
      g.strokeStyle = rgba(GOLD, 0.32 * a * (1 - v.gather) * (1 - i * 0.1));
      g.lineWidth = 0.8;
      g.beginPath();
      g.arc(0, 0, rr, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    });
    // past five rounds: a finer outer ring of ticks, denser with each round (bounded)
    if (v.extra > 0.003) {
      const rr = R * (1.36 + 0.21 * MAX_LAYERS);
      const ticks = 10 * Math.min(rounds, 36);
      g.strokeStyle = rgba(GOLD_HI, 0.28 * v.extra * (1 - v.gather));
      g.lineWidth = 0.6;
      for (let i = 0; i < ticks; i++) {
        const an = (i / ticks) * Math.PI * 2 + (reduced ? 0 : now / 26000);
        g.beginPath();
        g.moveTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr);
        g.lineTo(cx + Math.cos(an) * (rr + 4), cy + Math.sin(an) * (rr + 4));
        g.stroke();
      }
    }

    // wishes as points of light: out along the rays, then gathering into the scroll
    if (pts.length) {
      const age = phase === 'spread' ? t : phase === 'gather' || phase === 'rest' ? 99 : 0;
      for (const p of pts) {
        let x;
        let y;
        let alpha;
        if (phase === 'spread') {
          const life = age - p.born;
          if (life < 0) continue;
          if (!reduced) {
            p.r += p.sp * dt * Math.exp(-life * 0.35);
            p.a += p.orbit * dt;
          }
          x = cx + Math.cos(p.a) * p.r;
          y = cy + Math.sin(p.a) * p.r;
          p.x = x;
          p.y = y;
          alpha = Math.min(1, life * 1.5);
        } else {
          const e = ease(v.gather);
          x = p.x + (p.gx - p.x) * e;
          y = p.y + (p.gy - p.y) * e;
          alpha = 1 - v.gather * 0.95;
        }
        const tw = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(now / 420 + p.tw);
        g.fillStyle = rgba(GOLD_HI, alpha * tw * 0.9);
        g.beginPath();
        g.arc(x, y, p.size * (1 - v.gather * 0.5), 0, Math.PI * 2);
        g.fill();
      }
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    openPrep,
    openHistory,
    close,
    isOpen: () => open,
  };
}
