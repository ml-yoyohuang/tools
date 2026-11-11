/* 第 1 幕：抵達某一站
   醞釀：掛在橫桿上的站牌垂降下來，牌面還往上翻著，只看得到背面
   動作：牌面越過橫桿翻下來，晃兩下停住
   揭曉：站號、站名一個字一個字浮現，底下的路線點亮；接著站牌收上去，露出印章台
   點一下畫面會加速（不能整段跳過：這是儀式，但不該拖時間） */
import { CONFIG } from './config.js';
import { stationName } from './art.js';
import { hideBubble } from './attendant.js';
import { $, hex, rgba } from './util.js';
import { sfx } from './sound.js';

const PAPER = '#F7F4EE', INK_DARK = '#24221F';

export async function playArrival(n, { route = [], before, onReveal } = {}) {
  const A = CONFIG.ARRIVAL, root = $('#arrival');
  const inks = CONFIG.INKS, c = inks[n], name = stationName(n);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  hideBubble();

  root.innerHTML = `
    <div class="sign">
      <div class="wires"><i></i><i></i></div>
      <div class="flip">
        <div class="face back"><i class="tri"></i><b class="dots"></b><i class="tri"></i></div>
        <div class="face front" style="--c:${c.ink};--l:${c.line};--sh:${rgba(hex(c.ink), .55)};--t:${n === 1 ? INK_DARK : PAPER}">
          <div class="num"><span>${n}</span></div>
          <div class="info">
            <div class="name">${[...name].map(ch => `<span>${ch}</span>`).join('')}</div>
            <i class="rule"></i>
            <div class="route">${[1, 2, 3].map(s => `<b class="${route.includes(s) ? 'got' : ''}${s === n ? ' here' : ''}" style="--c:${inks[s].ink};--l:${inks[s].line}"></b>`).join('')}</div>
          </div>
          <i class="band"></i>
        </div>
      </div>
      <div class="rail"></div>
    </div>`;
  root.hidden = false;

  /* 時鐘：點一下就把剩下的動畫全部加速 */
  const clock = { sp: 1 }, live = new Set();
  const anim = (el, kf, opt) => {
    const a = el.animate(kf, { fill: 'both', ...opt });
    a.updatePlaybackRate(clock.sp); live.add(a); a.finished.then(() => live.delete(a), () => live.delete(a));
    return a;
  };
  const step = ms => new Promise(res => {   // 用計時器而不是 requestAnimationFrame：分頁在背景時也會走完
    let t = 0, last = performance.now();
    const f = () => { const now = performance.now(); t += (now - last) * clock.sp; last = now; t >= ms ? res() : setTimeout(f, 16); };
    setTimeout(f, 16);
  });
  const hurry = e => {
    e.preventDefault();
    if (clock.sp > 1) return;
    clock.sp = A.HURRY;
    for (const a of live) a.updatePlaybackRate(A.HURRY);
  };
  root.addEventListener('pointerdown', hurry);

  const sign = $('#arrival .sign'), flip = $('#arrival .flip'), front = $('#arrival .front');
  const parts = {
    num: front.querySelector('.num'), chars: [...front.querySelectorAll('.name span')],
    rule: front.querySelector('.rule'), dots: [...front.querySelectorAll('.route b')], band: front.querySelector('.band'),
  };
  const lift = () => -(sign.getBoundingClientRect().bottom + 60);

  // 站牌先藏在畫面外、牌面翻在上面
  if (reduce) anim(sign, [{ opacity: 0 }], { duration: 0 });
  else {
    anim(sign, [{ transform: `translateY(${lift()}px)` }], { duration: 0 });
    anim(flip, [{ transform: 'rotateX(180deg)' }], { duration: 0 });
    for (const el of [parts.num, ...parts.chars, parts.rule, ...parts.dots]) anim(el, [{ opacity: 0 }], { duration: 0 });   // 站色底條一開始就在，翻下來時牌面不會一片空白
  }

  // 背景先蓋上來，蓋滿了才收掉後面的東西（開場、上一站）
  await anim(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' }).finished;
  before?.();

  if (reduce) {
    await anim(sign, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }).finished;
  } else {
    // ---------- 醞釀：垂降，牌面還翻在上面 ----------
    sfx('drop');
    await anim(sign, [
      { transform: `translateY(${lift()}px)` },
      { transform: 'translateY(7px)', offset: .74 },
      { transform: 'translateY(-2px)', offset: .9 },
      { transform: 'none' },
    ], { duration: A.DROP_MS, easing: 'cubic-bezier(.25,.8,.3,1)' }).finished;
    await step(A.PAUSE_MS);

    // ---------- 動作：越過橫桿翻下來，晃兩下停住 ----------
    sfx('clack');
    anim(flip, [
      { transform: 'rotateX(180deg)', easing: 'cubic-bezier(.55,0,.75,.35)' },
      { transform: 'rotateX(90deg)', offset: .36, easing: 'cubic-bezier(.2,.6,.35,1)' },
      { transform: 'rotateX(-24deg)', offset: .62, easing: 'ease-in-out' },
      { transform: 'rotateX(11deg)', offset: .8, easing: 'ease-in-out' },
      { transform: 'rotateX(-3deg)', offset: .92, easing: 'ease-in-out' },
      { transform: 'rotateX(0)' },
    ], { duration: A.FLIP_MS });
    await step(A.FLIP_MS * .5);

    // ---------- 揭曉：站號、站名、路線 ----------
    sfx('chime');
    anim(parts.num, [
      { opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.1)', offset: .6 }, { opacity: 1, transform: 'none' },
    ], { duration: 460, delay: 80, easing: 'cubic-bezier(.3,.9,.4,1)' });
    parts.chars.forEach((ch, i) => anim(ch, [
      { opacity: 0, transform: 'translateY(.42em)', filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' },
    ], { duration: 420, delay: 220 + i * A.CHAR_MS, easing: 'cubic-bezier(.2,.9,.3,1)' }));
    const after = 220 + parts.chars.length * A.CHAR_MS;
    anim(parts.rule, [{ opacity: 1, transform: 'scaleX(0)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: after, easing: 'cubic-bezier(.3,.8,.2,1)' });
    parts.dots.forEach((d, i) => anim(d, [
      { opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.25)', offset: .6 }, { opacity: 1, transform: 'none' },
    ], { duration: 320, delay: after + 160 + i * 90, easing: 'ease-out' }));
    await step(after + 160 + 3 * 90 + 320);
  }

  // ---------- 停一下讓人看清楚，然後收上去 ----------
  await step(A.HOLD_MS);
  root.removeEventListener('pointerdown', hurry);
  root.style.pointerEvents = 'none';
  onReveal?.();
  if (!reduce) anim(sign, [{ transform: 'none' }, { transform: `translateY(${lift()}px)` }], { duration: A.EXIT_MS, easing: 'cubic-bezier(.55,0,.8,.3)' });
  await anim(root, [{ opacity: 1 }, { opacity: 0 }], { duration: A.EXIT_MS, delay: reduce ? 0 : 120, easing: 'ease-in-out' }).finished;
  root.hidden = true; root.innerHTML = ''; root.style.pointerEvents = '';
  root.getAnimations().forEach(a => a.cancel());
}
