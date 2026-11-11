/* 拖著蓋的手章（完成章、郵戳共用）
   拿起來拖到卡片上 → 停住不動會慢慢壓下去 → 放開就蓋上
   「停住按了多久」= hold，決定蓋出來的樣子；沒放在卡片上就回到原位 */
import { clamp, lerp } from './util.js';

/* el：章的元素（章底中心在元素寬 50%、高 82% 的位置）；home：章底中心的待機位置
   getCard()：可以蓋的範圍 {x, y, w, h, k}；ghost：預告落點的虛線圈；goodS：按穩的秒數
   回傳 Promise → { px, py（螢幕座標）, x, y（卡片單位）, a, hold, seed, at } */
export function dragStamp({ el, home, getCard, ghost, goodS }) {
  const sw = el.offsetWidth, sh = el.offsetHeight;
  const put = (x, y, s = 1) => { el.style.transform = `translate(${x - sw / 2}px, ${y - sh * .82}px) scale(${s})`; };
  put(home.x, home.y);
  return new Promise(res => {
    let id = null, off = { x: 0, y: 0 }, pos = { ...home }, still = 0, vx = 0, lastP = null, raf = 0, start = null, moved = false;
    const over = () => { const R = getCard(); return pos.x > R.x && pos.x < R.x + R.w && pos.y > R.y && pos.y < R.y + R.h; };
    const tick = now => {              // 停在卡片上不動 → 慢慢壓下去
      raf = requestAnimationFrame(tick);
      if (id === null) return;
      const ok = moved && over();      // 要真的拖過來才算（手機上章會跳到手指上方，光是按一下可能剛好碰到卡片邊）
      const p = ok ? clamp((now - still) / (goodS * 1000), 0, 1) : 0;
      put(pos.x, pos.y, 1 - .06 * p);
      ghost.style.opacity = ok ? (.35 + .5 * p).toFixed(2) : '0';
      el.classList.toggle('press', p > 0);
    };
    raf = requestAnimationFrame(tick);
    const place = () => { ghost.style.left = pos.x + 'px'; ghost.style.top = pos.y + 'px'; };
    place();
    const down = e => {
      e.preventDefault();
      if (id !== null && e.pointerId === id) return;
      // 上一次的手指沒收到放開（手機偶爾會漏）：不要卡住，直接換這一指接手
      id = e.pointerId; try { el.setPointerCapture(id); } catch (_) {}
      start = { x: e.clientX, y: e.clientY }; moved = false;
      // 手指會擋住章底：觸控時章底在手指上方
      off = e.pointerType === 'mouse' ? { x: pos.x - e.clientX, y: pos.y - e.clientY } : { x: 0, y: -Math.max(58, sh * .55) };
      pos = { x: e.clientX + off.x, y: e.clientY + off.y }; place();
      still = performance.now(); lastP = { x: e.clientX, t: still };
      el.classList.add('held'); ghost.classList.add('on');
    };
    const move = e => {
      if (e.pointerId !== id) return;
      const np = { x: e.clientX + off.x, y: e.clientY + off.y }, now = performance.now();
      if (Math.hypot(np.x - pos.x, np.y - pos.y) > 2.5) still = now;
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 14) moved = true;
      vx = lerp(vx, (e.clientX - lastP.x) / Math.max(8, now - lastP.t) * 1000, .3); lastP = { x: e.clientX, t: now };
      pos = np; place();
    };
    const up = e => {
      if (e.pointerId !== id) return;
      id = null; el.classList.remove('held', 'press');
      // 沒放在卡片上、只是點一下（沒拖過）、或被系統中斷：回到原位，不算蓋
      if (!over() || !moved || e.type !== 'pointerup') {
        ghost.style.opacity = '0';
        ghost.classList.remove('on');
        el.animate([{ transform: el.style.transform }, { transform: `translate(${home.x - sw / 2}px, ${home.y - sh * .82}px)` }], { duration: 360, easing: 'cubic-bezier(.3,.9,.3,1)' });
        pos = { ...home }; put(home.x, home.y); place();
        return;
      }
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('lostpointercapture', up);
      ghost.classList.remove('on');
      const R = getCard(), hold = (performance.now() - still) / 1000;
      res({
        px: pos.x, py: pos.y,
        x: +((pos.x - R.x) / R.k).toFixed(1), y: +((pos.y - R.y) / R.k).toFixed(1),
        a: +clamp(vx * .006 + (Math.random() - .5) * 8, -12, 12).toFixed(1),
        hold: +hold.toFixed(2), seed: (Date.now() ^ (Math.random() * 1e9)) | 0, at: new Date().toISOString(),
      });
    };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);   // 手指被別的東西搶走：當作放開（回原位）
  });
}

/* 手章的外型：跟日期章同一型，章底與帽帶換色 */
export function handStampSVG(base, band) {
  return `<svg viewBox="0 0 80 112" aria-hidden="true">
    <ellipse class="shadow" cx="40" cy="106" rx="24" ry="4" fill="rgba(45,35,20,.2)"/>
    <circle cx="40" cy="20" r="15" fill="#B8865B"/><circle cx="35" cy="15" r="5" fill="#fff" opacity=".22"/>
    <rect x="34" y="31" width="12" height="20" rx="3" fill="#9C6F49"/>
    <rect x="16" y="50" width="48" height="36" rx="8" fill="#24221F"/>
    <rect x="22" y="56" width="36" height="5" rx="2.5" fill="${band}"/>
    <rect x="13" y="86" width="54" height="12" rx="4" fill="${base}"/>
  </svg>`;
}
