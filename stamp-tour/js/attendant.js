/* 站務員：原創角色＋對話框
   造型：包子臉、五官偏高且靠近、小圓點眼睛、戴站務帽（粉紅帽帶、黃色徽章）、藍色制服。
   眼睛會眨，說話時嘴巴會動，開心時眼睛變成 ^ ^。 */
import { CONFIG } from './config.js';
import { $ } from './util.js';

/* full：含身體（櫃台用）；head：只有頭（對話列用） */
export function attendantSVG(kind = 'full') {
  const vb = kind === 'head' ? '14 2 92 104' : '0 0 120 150';
  return `<svg class="att att--${kind}" viewBox="${vb}" aria-hidden="true">
  <g class="att-body">
    <path d="M16 150 C18 121 34 106 60 106 C86 106 102 121 104 150 Z" fill="#0078BF"/>
    <path d="M45 106 L60 125 L75 106 Z" fill="#F7F4EE"/>
    <path d="M55 112 L60 118 L65 112 L60 130 Z" fill="#FF48B0"/>
    <circle cx="44" cy="136" r="3" fill="#FFE800"/><circle cx="76" cy="136" r="3" fill="#FFE800"/>
  </g>
  <g class="att-head">
    <path d="M20 70 C20 40 38 26 60 26 C82 26 100 40 100 70 C100 94 84 104 60 104 C36 104 20 94 20 70 Z" fill="#F3E3CF"/>
    <path d="M27 39 L31 16 Q60 4 89 16 L93 39 Z" fill="#24221F"/>
    <rect x="29" y="29" width="62" height="7" fill="#FF48B0"/>
    <circle cx="60" cy="21" r="5.2" fill="#FFE800"/>
    <path d="M22 38 Q60 56 98 38 L95 37 Q60 47 25 37 Z" fill="#24221F"/>
    <g class="att-eyes">
      <circle cx="50" cy="58" r="2.8" fill="#24221F"/>
      <circle cx="70" cy="58" r="2.8" fill="#24221F"/>
    </g>
    <g class="att-happy" fill="none" stroke="#24221F" stroke-width="2.4" stroke-linecap="round">
      <path d="M46 60 Q50 54.5 54 60"/><path d="M66 60 Q70 54.5 74 60"/>
    </g>
    <path class="att-mouth-c" d="M55 72 Q60 77 65 72" fill="none" stroke="#24221F" stroke-width="2.4" stroke-linecap="round"/>
    <path class="att-mouth-o" d="M54.5 71 Q60 83 65.5 71 Z" fill="#24221F"/>
  </g>
</svg>`;
}

/* 對話框：一句一句跳出來，點一下跳下一句，也會自動往下 */
const hosts = new Set();
let lineEl, moreEl, bubbleEl, queue = [], talkTimer = 0, mouthTimer = 0, onDone = null;

export function initSpeech() {
  bubbleEl = $('#bubble'); lineEl = $('#line'); moreEl = $('#more');
  bubbleEl.addEventListener('pointerdown', e => { e.preventDefault(); next(); });
}
export function registerHost(el) { hosts.add(el); }
export function setMood(mood) { for (const h of hosts) h.dataset.mood = mood || ''; }

function next() { if (queue.length) showLine(queue.shift()); }

function showLine(text) {
  clearTimeout(talkTimer);
  lineEl.textContent = text;
  bubbleEl.classList.remove('in'); void bubbleEl.offsetWidth; bubbleEl.classList.add('in');
  moreEl.hidden = queue.length === 0;
  for (const h of hosts) { h.classList.remove('hop'); void h.getBoundingClientRect(); h.classList.add('hop', 'talking'); }
  clearTimeout(mouthTimer);
  mouthTimer = setTimeout(() => { for (const h of hosts) h.classList.remove('talking'); }, 260 + text.length * 70);
  if (queue.length) talkTimer = setTimeout(next, CONFIG.TALK_AUTO_MS);
  else if (onDone) { const f = onDone; onDone = null; talkTimer = setTimeout(f, Math.min(CONFIG.TALK_AUTO_MS, 900 + text.length * 60)); }
}

/* say(lines) 回傳 Promise：最後一句出現並停留片刻後 resolve（給劇情腳本用） */
export function say(lines) {
  if (typeof lines === 'string') lines = [lines];
  queue = lines.slice();
  return new Promise(res => { onDone = res; showLine(queue.shift()); });
}
export function hideBubble() { bubbleEl.classList.remove('in'); queue = []; clearTimeout(talkTimer); }
