import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, ease, minSide, num, rgba } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { decoFade, type Pt } from './_util';

export default defineEffect({
  id: 'zipper-wipe',
  code: 'W10',
  nameZh: '拉鍊揭露',
  nameEn: 'Zipper Wipe',
  category: 'wipe',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '拉鍊頭沿中線往下拉，上方的開口呈 V 形向兩側退開，開口內露出新場景，兩緣帶著拉鍊齒。',
  tags: ['拉鍊', '開口', '中線', '擦拭', 'zipper'],
  suitable: ['服飾／時尚主題', '開箱揭曉', '品牌活動'],
  principle:
    'Canvas 2D clip：拉鍊頭位置 Y = e·(H + D)。在 y < Y 的高度，開口半寬 = (W/2 + 邊距)·clamp((Y − y)/D)^0.6，形成頂端最寬、拉鍊頭處收成一點的曲線開口；開口多邊形 clip 畫新場景，舊場景不移動、只是遮罩兩緣向外退。拉鍊齒是沿兩條遮罩邊緣交錯排列的小矩形，Y 以下的閉合段齒在中線交錯咬合；方向「向上」時整個 y 軸翻轉。',
  defaultText: 'ZIP／打開',
  palette: 'POP',
  colors: { background: C.pink, primary: C.black, secondary: C.yellow, accent: C.white },
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['down', 'up'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    { key: 'open', label: '開口長度', type: 'range', min: 0.2, max: 1.2, step: 0.05, default: 0.55, hint: '開口從拉鍊頭到完全張開所需的高度（相對畫面高）' },
    { key: 'teeth', label: '拉鍊齒', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '完整顯示 A 場景；轉場一開始中線淡入一排咬合的拉鍊齒。',
    motion: '拉鍊頭以 power1.inOut 沿中線往下拉，經過處向兩側裂開成弧形 V 口，兩緣持續外退直到離開畫面。',
    hold: 'B 完整停留，拉鍊齒與拉鍊頭已離開畫面。',
    exit: '再拉一次，由 B 換回 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中開口從中線開始，由上往下（或由下往上）逐步裂開。',
    '開口兩緣向左右退開，開口內是新場景、外側舊場景不移動。',
    '開口長度越小，V 口越陡越短；越大則開口越緩。',
    '關閉拉鍊齒後只剩純遮罩開口。',
  ],
  cycle: 4.4,
  posterTime: 1.75,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const D = num(ctx, 'open', 0.55) * h;
    const teeth = bool(ctx, 'teeth', true);
    const flip = ctx.dir === 'up';
    const cx = w / 2;
    const tooth = Math.max(4, m * 0.026); // pitch along the line
    const toothW = Math.max(3, m * 0.022);
    const toothH = tooth * 0.55;
    const halfMax = w / 2 + toothW * 2 + 4;
    const travelLen = h + D + tooth;
    const pull = ease('power1.inOut');
    const steps = Math.max(24, Math.round(60 * ctx.q));
    const Y = (yy: number) => (flip ? h - yy : yy);
    const halfW = (y: number, slider: number) => (y >= slider ? 0 : halfMax * clamp((slider - y) / D, 0, 1) ** 0.6);
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, pull);
      sc.draw(g, tr.from);
      if (tr.p <= 0) return;
      const slider = -tooth + tr.e * travelLen;
      // opening polygon: left edge top→slider, right edge slider→top
      const left: Pt[] = [];
      const right: Pt[] = [];
      const top = -4;
      const bottom = Math.min(slider, h + 4);
      for (let i = 0; i <= steps; i++) {
        const y = top + ((bottom - top) * i) / steps;
        const hw = halfW(y, slider);
        left.push([cx - hw, Y(y)]);
        right.push([cx + hw, Y(y)]);
      }
      if (bottom > top) {
        g.save();
        g.beginPath();
        g.moveTo(cx - halfMax, Y(top - 10));
        for (const p of left) g.lineTo(p[0], p[1]);
        for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
        g.lineTo(cx + halfMax, Y(top - 10));
        g.closePath();
        g.clip();
        sc.draw(g, tr.to);
        g.restore();
      }
      if (!teeth) return;
      const fade = decoFade(tr.p);
      // teeth on the retreating edges and along the still-closed centre line
      g.fillStyle = rgba(ctx.s.accent, fade);
      const nT = Math.ceil((h + 8) / tooth);
      for (let k = 0; k < nT; k++) {
        const y = k * tooth;
        const isLeft = k % 2 === 0;
        const hw = halfW(y + toothH / 2, slider);
        // closed: the tooth crosses the centre line slightly (interlocked)
        const lock = toothW * 0.35 * (1 - clamp(hw / toothW, 0, 1));
        const x = isLeft ? cx - hw - toothW + lock : cx + hw - lock;
        if (x > w + toothW || x < -toothW * 2) continue;
        const yy = Y(y);
        g.fillRect(x, flip ? yy - toothH : yy, toothW, toothH);
      }
      // slider (pull tab)
      if (slider > -tooth && slider < h + tooth * 3) {
        const sy = Y(slider);
        const sw = toothW * 2.4;
        const sh = tooth * 1.6;
        g.fillStyle = rgba(ctx.s.accent, fade);
        g.strokeStyle = rgba('#000000', 0.35 * fade);
        g.lineWidth = Math.max(1, m * 0.003);
        g.beginPath();
        g.roundRect(cx - sw / 2, flip ? sy : sy - sh, sw, sh, sw * 0.25);
        g.fill();
        g.stroke();
        // tab hanging from the slider
        const tw = sw * 0.42;
        const tl = sh * 1.4;
        g.beginPath();
        g.roundRect(cx - tw / 2, flip ? sy - tl * 0.95 : sy - sh * 0.1, tw, tl, tw * 0.5);
        g.fill();
        g.stroke();
      }
    });
  },
});
