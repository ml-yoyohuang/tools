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
import { initStamping, loadImpressions, getCardRect, show, hide, enterStation, enterHub, refreshDev, enterFinale, liveCardRect, setCardHidden } from './stamping.js';
import { runOpening } from './opening.js';
import { playArrival } from './arrival.js';
import { runFinale } from './finale.js';
import { runPostcard, showPostcard, hidePostcard } from './postcard.js';
import { initSound, soundOn, setSound, soundState } from './sound.js';
import { $, wait } from './util.js';

/* 音效開關（Material Design Icons：volume-high / volume-off） */
const VOL_ON = 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z';
const VOL_OFF = 'M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z';
let drawSound = () => {};
function soundButton() {
  const b = $('#sound');
  const draw = drawSound = () => { b.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${soundOn() ? VOL_ON : VOL_OFF}"/></svg>`; b.classList.toggle('off', !soundOn()); };
  draw();
  b.addEventListener('click', () => { setSound(!soundOn()); draw(); });
}

/* 防止頁面縮放、捲動、選取、長按選單 */
for (const t of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu', 'selectstart'])
  document.addEventListener(t, e => { if (e.target.id !== 'nameInput' && e.target.id !== 'msgInput') e.preventDefault(); }, { passive: false });
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
    before: () => { hide(); leaveCard(); before?.(); },
    onReveal: () => {
      show(); enterStation(n, arrivalLines(n));
      if (store.stationsLeft() === 0 && !store.card.seal) finale();   // 集滿但還沒慶祝（慶祝被打斷了）
    },
  });
  arriving = false;
}

/* 第 3 幕：集滿三站。停一下 → 熄燈、拉炮、完成章 → 回到卡片首頁 */
let celebrating = false;
async function finale() {
  if (celebrating) return;
  celebrating = true;
  await wait(CONFIG.FINALE.PAUSE_MS);
  enterFinale();
  await runFinale({ getCard: liveCardRect, art: store.card.art || 'classic', onSeal: seal => store.setSeal(seal) });
  enterHub();
  await postcard();
  celebrating = false;
}

/* 明信片：蓋在卡片上的元件；寄出前跑完整儀式，寄出後就是卡片首頁 */
async function postcard() {
  setCardHidden(true);
  await runPostcard(liveCardRect);
}
function leaveCard() { hidePostcard(); setCardHidden(false); }

async function opening(station, short) {
  hide();
  setArt(preferredArt());
  refreshDev();
  composite([]);
  // 聲音還沒被點開過（第一次進來）：入口先讓使用者選要不要聲音，那一下點擊也順便解鎖聲音
  const sound = soundState() === 'running' ? null : { icons: { on: VOL_ON, off: VOL_OFF }, choose: v => { setSound(v); drawSound(); } };
  const close = await runOpening({ short, station, cardRect: getCardRect(), sound });
  if (station) { await arrive(station, close); return; }
  show();
  enterHub();
  requestAnimationFrame(() => requestAnimationFrame(close));   // 蓋章畫面畫好之後才收掉開場的卡，避免閃爍
}

async function boot() {
  initSound(); soundButton();
  $('#host').innerHTML = attendantSVG('head');
  initSpeech();
  registerHost($('#host'));
  initStamping({
    onReset: async () => { await store.reset(); opening(stationParam(), true); },
    onArtToggle: id => { try { localStorage.setItem(ART_PREF, id); } catch (_) {} },
    onGoStation: n => arrive(n),
    onComplete: () => finale(),
    onLeave: () => leaveCard(),
  });
  await store.init();
  buildBase();

  const station = stationParam();
  if (!store.hasCard()) { opening(station, station > 0); return; }

  setArt(store.card.art || 'classic');            // 舊卡沒有記錄時，就是當時唯一的「日、海、鳥」
  loadImpressions(store.impressions);
  if (station) { arrive(station); return; }
  show();
  if (store.stationsLeft() === 0 && !store.card.seal) { enterHub(); finale(); return; }   // 集滿但慶祝被打斷了：重新慶祝
  if (store.card.seal && !(store.card.post && store.card.post.sentAt)) { enterHub(); postcard(); return; }   // 明信片還沒寄出：接著做
  if (store.card.post && store.card.post.sentAt) { enterHub(COPY.post.back); setCardHidden(true); showPostcard(liveCardRect); return; }
  enterHub(COPY.hub.back(store.stationsLeft()));
}

boot();
