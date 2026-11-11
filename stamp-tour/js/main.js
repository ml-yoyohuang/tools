/* 啟動與流程：
   - 還沒領卡 → 第 0 幕（直接掃站點進來時跑「簡短版」）→ 到那一站，或卡片首頁
   - 已領卡   → 直接到那一站，或卡片首頁（不重播開場）
   - 每次到站都先播第 1 幕的站牌，站牌收起後才是印章台 */
import { CONFIG } from './config.js';
import { COPY } from './copy.js';
import { buildBase, composite } from './print.js';
import { attendantSVG, initSpeech, registerHost } from './attendant.js';
import { ART_SETS, setArt, stationGreet } from './art.js';
import { store } from './storage.js';
import { initStamping, loadImpressions, getCardRect, show, hide, enterStation, enterHub } from './stamping.js';
import { runOpening } from './opening.js';
import { playArrival } from './arrival.js';
import { $ } from './util.js';

/* 防止頁面縮放、捲動、選取、長按選單 */
for (const t of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu', 'selectstart'])
  document.addEventListener(t, e => { if (e.target.id !== 'nameInput') e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

const stationParam = () => { const q = +new URLSearchParams(location.search).get('station'); return [1, 2, 3].includes(q) ? q : 0; };

/* 新卡要用哪一組圖案：網址 ?art= ＞ 開發切換器記住的選擇 ＞ CONFIG.ART_SET */
const ART_PREF = 'stamp-tour:art';
function preferredArt() {
  const q = new URLSearchParams(location.search).get('art');
  if (q && ART_SETS[q]) return q;
  try { const p = localStorage.getItem(ART_PREF); if (p && ART_SETS[p]) return p; } catch (_) {}
  return CONFIG.ART_SET;
}

/* 到站後站務員說的話：這一站專屬的一句 → 依路線的一句 → 沾墨提醒 */
function arrivalLines(n) {
  const route = store.route(), A = COPY.arrive;
  if (route.includes(n)) return route.length === 3 ? COPY.stampedAll : COPY.stamped;
  const step = route.length === 0 ? (n === 1 ? A.first1 : A.first) : route.length === 1 ? A.second : A.last;
  return [stationGreet(n), step, route.length ? A.inkAgain : A.ink].filter(Boolean);
}

/* 第 1 幕：站牌蓋滿畫面時收掉後面的東西（before），站牌收起時進到那一站 */
let arriving = false;
async function arrive(n, before) {
  if (arriving) return;
  arriving = true;
  await playArrival(n, {
    route: store.route(),
    before: () => { hide(); before?.(); },
    onReveal: () => { show(); enterStation(n, arrivalLines(n)); },
  });
  arriving = false;
}

async function opening(station, short) {
  hide();
  setArt(preferredArt());
  composite([]);
  const close = await runOpening({ short, station, cardRect: getCardRect() });
  if (station) { await arrive(station, close); return; }
  show();
  enterHub();
  requestAnimationFrame(() => requestAnimationFrame(close));   // 蓋章畫面畫好之後才收掉開場的卡，避免閃爍
}

async function boot() {
  $('#host').innerHTML = attendantSVG('head');
  initSpeech();
  registerHost($('#host'));
  initStamping({
    onReset: async () => { await store.reset(); opening(stationParam(), true); },
    onArtToggle: id => { try { localStorage.setItem(ART_PREF, id); } catch (_) {} },
    onGoStation: n => arrive(n),
  });
  await store.init();
  buildBase();

  const station = stationParam();
  if (!store.hasCard()) { opening(station, station > 0); return; }

  setArt(store.card.art || 'classic');            // 舊卡沒有記錄時，就是當時唯一的「日、海、鳥」
  loadImpressions(store.impressions);
  if (station) { arrive(station); return; }
  show();
  enterHub(COPY.hub.back(store.stationsLeft()));
}

boot();
