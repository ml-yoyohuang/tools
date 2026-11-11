/* 站務員的閒聊：點站務員的頭，或發呆一陣子，就聊一句八卦
   - 第一次聊：先聊現在這個時段的事
   - 之後：每次隨機挑一類，同一句不重複，全部聊完再重來；阿伯的八卦照順序講
   - 聊完會把剛剛那句說明再講一次（閒聊不能蓋掉正在進行的說明） */
import { CONFIG } from './config.js';
import { COPY } from './copy.js';
import { interject } from './attendant.js';
import { $ } from './util.js';

const seen = new Set();
let first = true, lastInput = performance.now(), lastLine = performance.now(), idleKey = null, idleDone = false;

function timeKey(h = new Date().getHours()) {
  return h < 2 ? 'night' : h < 5 ? 'dawn' : h < 11 ? 'morning' : h < 13 ? 'noon' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night';
}
function pick() {
  const C = COPY.chat, time = C.time[timeKey()];
  const fresh = list => list.filter(l => !seen.has(l));
  if (first) { first = false; const t = fresh(time); if (t.length) return t[Math.floor(Math.random() * t.length)]; }
  let groups = [['self', C.self], ['uncle', C.uncle], ['conductor', C.conductor], ['residents', C.residents], ['travelers', C.travelers], ['time', time]]
    .map(([k, l]) => [k, fresh(l)]).filter(([, l]) => l.length);
  if (!groups.length) { seen.clear(); return pick(); }
  const [k, list] = groups[Math.floor(Math.random() * groups.length)];
  return k === 'uncle' ? list[0] : list[Math.floor(Math.random() * list.length)];
}

/* canChat()：現在可以閒聊嗎（不在開場、慶祝、明信片流程，也沒在拿印章）
   scene()：現在在哪個畫面（換畫面就重新計算發呆） */
export function initChatter({ canChat, scene }) {
  const chat = () => {
    if (!canChat()) return false;
    const line = pick(); seen.add(line);
    const resume = $('#line').textContent;
    const isChat = t => Object.values(COPY.chat).flatMap(v => Array.isArray(v) ? v : Object.values(v).flat()).includes(t);
    interject(resume && !isChat(resume) ? [line, resume] : [line]);
    return true;
  };
  // 點站務員的頭
  $('#host').addEventListener('click', () => { lastInput = performance.now(); chat(); });
  // 發呆：一陣子沒碰畫面、也沒有新的台詞，就聊一句（每個畫面最多一次）
  for (const t of ['pointerdown', 'keydown']) window.addEventListener(t, () => { lastInput = performance.now(); }, { capture: true, passive: true });
  new MutationObserver(() => { lastLine = performance.now(); }).observe($('#line'), { childList: true, characterData: true, subtree: true });
  setInterval(() => {
    const k = scene();
    if (k !== idleKey) { idleKey = k; idleDone = false; return; }
    if (idleDone) return;
    const now = performance.now(), quiet = Math.min(now - lastInput, now - lastLine);
    if (quiet > CONFIG.CHAT.IDLE_MS && chat()) idleDone = true;
  }, 1000);
}
