/* 啟動與流程：
   - 還沒領卡 → 第 0 幕（直接掃站點進來時跑「簡短版」）→ 到那一站，或卡片首頁
   - 已領卡   → 直接到那一站，或卡片首頁（不重播開場） */
import { CONFIG } from './config.js';
import { COPY } from './copy.js';
import { buildBase, composite } from './print.js';
import { attendantSVG, initSpeech, registerHost } from './attendant.js';
import { ART_SETS, setArt, stationName } from './art.js';
import { store } from './storage.js';
import { initStamping, loadImpressions, getCardRect, show, hide, enterStation, enterHub } from './stamping.js';
import { runOpening } from './opening.js';
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

async function opening(station, short) {
  hide();
  setArt(preferredArt());
  composite([]);
  const close = await runOpening({ short, station, cardRect: getCardRect() });
  show();
  if (station) enterStation(station, COPY.welcome(station, stationName(station)));
  else enterHub();
  requestAnimationFrame(() => requestAnimationFrame(close));   // 蓋章畫面畫好之後才收掉開場的卡，避免閃爍
}

async function boot() {
  $('#host').innerHTML = attendantSVG('head');
  initSpeech();
  registerHost($('#host'));
  initStamping({
    onReset: async () => { await store.reset(); opening(stationParam(), true); },
    onArtToggle: id => { try { localStorage.setItem(ART_PREF, id); } catch (_) {} },
  });
  await store.init();
  buildBase();

  const station = stationParam();
  if (!store.hasCard()) { opening(station, station > 0); return; }

  setArt(store.card.art || 'classic');            // 舊卡沒有記錄時，就是當時唯一的「日、海、鳥」
  loadImpressions(store.impressions);
  show();
  if (station) enterStation(station);
  else enterHub(COPY.hub.back(store.stationsLeft()));
}

boot();
