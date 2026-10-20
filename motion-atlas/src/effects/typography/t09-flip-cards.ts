import { defineEffect } from '../../engine/define';
import { el } from '../../engine/dom';
import { clamp, ease, num, str } from '../../engine/helpers';
import { fontString, graphemes, isSpace, phrases } from '../../engine/text';
import { cellLayout, fontOf } from './_util';

// Ported from kinetic-typography e26-flip-cards, plus an X / Y / alternating axis.
// Whole-card flips (not split halves): every card has a front and a back face
// (backface-visibility: hidden) and turns 180° about its axis, lifting toward the
// viewer mid-turn. Flip k shows state k on the leaving face and state k+1 on the
// arriving face, so the glyph switches exactly when the card is edge-on (the
// midpoint) and any number of words cycles. Cards start in a diagonal wave.
export default defineEffect({
  id: 'flip-cards',
  code: 'T09',
  nameZh: '翻字卡',
  nameEn: 'Flip Cards',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'css3d',
  description: '每個字是一張整張翻面的字卡，依序以波浪翻轉，翻到中點時換成下一個字；可選 X 或 Y 軸。',
  tags: ['翻卡', '3D', '切換', '字卡', 'flip'],
  suitable: ['公告切換', '倒數與揭曉', '標語輪播'],
  principle:
    'CSS 3D：每張卡是 preserve-3d 容器，正反兩面設 backface-visibility: hidden，背面預先 rotateY(180°)（X 軸時 rotateX(180°)）。第 k 次翻轉角度 = 180°·(k + power3.inOut(u))，離開面顯示第 k 組字、到達面顯示第 k+1 組字，因此字元在卡片側立（90°）時切換。翻轉中以 sin(πu) 讓卡片朝鏡頭抬起、陰影縮小，並依 |cos θ| 加深側面陰影；延遲 = (col + 1.5·row)·stagger 形成斜向波。',
  defaultText: '夜未眠／動效圖鑑',
  palette: 'PASTEL',
  colors: { background: '#F2E8D5', primary: '#141414', secondary: '#ED589A', accent: '#9A86DE' },
  controls: ['text', 'font', 'weight', 'intensity', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left'],
  maxChars: 36,
  textHint: '用「／」分隔多組詞，卡片翻面時換成下一組；只有一組時背面換字體與配色。',
  params: [
    {
      key: 'axis',
      label: '翻轉軸',
      type: 'select',
      default: 'y',
      options: [
        { value: 'y', label: 'Y 軸（左右翻）' },
        { value: 'x', label: 'X 軸（上下翻）' },
        { value: 'mix', label: '交錯 X／Y' },
      ],
    },
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.4, max: 4, step: 0.1, default: 1.4, unit: 's' },
    { key: 'stagger', label: '波動間隔', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0.09, unit: 's' },
    { key: 'lift', label: '翻起高度', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
  ],
  recipe: {
    enter: '卡片已就位顯示第一組字。',
    motion: '每張卡以 power3.inOut 翻轉 180°（0.75s），中途向鏡頭抬起並輕微傾斜，陰影縮小；卡片依斜向波錯開。',
    hold: '每組字完整停留 hold 秒（預設 1.4s）。',
    exit: '下一次翻轉帶出下一組字。',
    loop: '翻轉角度累加，第 k 次翻轉顯示第 k+1 組字，無限循環。',
  },
  accept: [
    '整張卡翻轉（不是上下兩半），卡背顯示下一個字。',
    '字元在卡片側立時切換，不會在正面時跳字。',
    '翻轉軸切到 X 時卡片上下翻，交錯時相鄰卡片軸向不同。',
    '卡片依斜向波依序翻動，方向可左右切換。',
  ],
  limits: ['CSS 3D：不支援 PNG / WebM 匯出。'],
  cycle: 4.3,
  posterTime: 0.6,
  legacyIds: ['flip-cards'],
  create(ctx) {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: sec, accent: acc, background: bg } = ctx.s;
    const hold = num(ctx, 'hold', 1.4);
    const stagger = num(ctx, 'stagger', 0.09);
    const lift = num(ctx, 'lift', 0.5) * clamp(ctx.s.intensity, 0, 2);
    const axisMode = str(ctx, 'axis', 'y');
    const flipDur = 0.75;
    const beat = hold + flipDur;
    let states = phrases(ctx.text).map((p) => graphemes(p));
    const single = states.length === 1;
    if (single) states = [states[0], states[0]];
    const n = Math.max(...states.map((s) => s.length));
    states = states.map((s) => [...s, ...Array(n - s.length).fill(' ')]);
    const S = states.length;

    const aspect = 1.3;
    const gapF = 0.12;
    const emptyAt = Array.from({ length: n }, (_, i) => states.every((s) => isSpace(s[i])));
    const G = cellLayout(emptyAt, W, H, { aspect, gap: gapF });
    const cw = G.cw;
    const chh = cw * aspect;
    const gap = cw * gapF;
    const boardH = G.rows.length * chh + (G.rows.length - 1) * gap;
    const y0 = (H - boardH) / 2;
    const place = new Map<number, { x: number; y: number; col: number; row: number; cols: number }>();
    G.rows.forEach((r, ri) => {
      const rw = r.length * cw + (r.length - 1) * gap;
      r.forEach((idx, si) => {
        if (idx >= 0) place.set(idx, { x: (W - rw) / 2 + si * (cw + gap), y: y0 + ri * (chh + gap), col: si, row: ri, cols: r.length });
      });
    });
    const fs = cw * 0.64 * clamp(ctx.s.scale, 0.5, 1.3);
    const radius = cw * 0.08;
    const altFamily = ctx.s.font === 'serif' ? ctx.font.sans : ctx.font.serif;
    // face A = ink card / paper glyph, face B = secondary card / ink glyph (single phrase: other typeface)
    const styles = [
      { bg: fg, color: bg, pip: acc, font: fontOf(ctx, fs) },
      { bg: sec, color: fg, pip: acc, font: single ? fontString(fs * 0.98, altFamily, ctx.weight) : fontOf(ctx, fs) },
    ];
    const P = chh * 4.5;

    const cards = Array.from({ length: n }, (_, i) => {
      const pl = place.get(i);
      if (!pl) return null;
      const { x, y, col, row, cols } = pl;
      const axis: 'X' | 'Y' = axisMode === 'x' ? 'X' : axisMode === 'mix' ? ((col + row) % 2 ? 'X' : 'Y') : 'Y';
      const shadow = el('div', { style: { position: 'absolute', left: `${x + cw * 0.06}px`, top: `${y + chh * 0.92}px`, width: `${cw * 0.88}px`, height: `${chh * 0.16}px`, borderRadius: '50%', background: 'rgba(0,0,0,.26)', filter: `blur(${cw * 0.06}px)` } }, ctx.root);
      const card = el('div', { style: { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${cw}px`, height: `${chh}px`, transformStyle: 'preserve-3d', willChange: 'transform' } }, ctx.root);
      const faces = styles.map((st, fi) => {
        const f = el(
          'div',
          {
            style: {
              position: 'absolute',
              inset: '0',
              borderRadius: `${radius}px`,
              background: st.bg,
              backfaceVisibility: 'hidden',
              transform: fi ? `rotate${axis}(180deg)` : 'none',
              overflow: 'hidden',
              boxShadow: `inset 0 ${-chh * 0.04}px 0 rgba(0,0,0,.12)`,
            },
          },
          card,
        );
        const glyph = el('div', { style: { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', font: st.font, lineHeight: '1', color: st.color, whiteSpace: 'pre' } }, f);
        el('div', { style: { position: 'absolute', right: `${cw * 0.09}px`, top: `${cw * 0.09}px`, width: `${cw * 0.08}px`, height: `${cw * 0.08}px`, borderRadius: '50%', background: st.pip } }, f);
        const shade = el('div', { style: { position: 'absolute', inset: '0', background: '#000', opacity: '0' } }, f);
        return { glyph, shade };
      });
      const c = ctx.dirSign > 0 ? col : cols - 1 - col;
      return { card, shadow, faces, axis, delay: (c + row * 1.5) * stagger, i, last: '' };
    });

    const flipE = ease('power3.inOut');
    const set = (node: HTMLElement, ch: string) => {
      if (node.textContent !== ch) node.textContent = ch;
    };

    return {
      render(t) {
        for (const c of cards) {
          if (!c) continue;
          const local = t - c.delay;
          let kk = 0;
          let u = 0;
          if (local > 0) {
            kk = Math.floor(local / beat);
            u = clamp((local - kk * beat - hold) / flipDur, 0, 1);
          }
          const e = flipE(u);
          const ang = 180 * (kk + e);
          const arc = Math.sin(Math.PI * u);
          const z = arc * cw * 0.6 * lift;
          // Y-axis: flip with rotateY, tilt with rotateX (and vice versa); X flips go "downwards"
          const tf =
            c.axis === 'Y'
              ? `perspective(${P}px) translateZ(${z}px) rotateY(${ang * ctx.dirSign}deg) rotateX(${arc * 6 * lift}deg)`
              : `perspective(${P}px) translateZ(${z}px) rotateX(${-ang}deg) rotateY(${arc * 6 * lift * ctx.dirSign}deg)`;
          if (tf !== c.last) {
            c.last = tf;
            c.card.style.transform = tf;
            c.shadow.style.transform = `translateY(${arc * chh * 0.06 * lift}px) scale(${1 - arc * 0.25 * lift})`;
            c.shadow.style.opacity = String(1 - arc * 0.5);
            const edge = Math.abs(Math.cos((ang * Math.PI) / 180));
            for (const f of c.faces) f.shade.style.opacity = String((1 - edge) * 0.45);
          }
          const leave = kk % 2;
          set(c.faces[leave].glyph, states[kk % S][c.i]);
          set(c.faces[1 - leave].glyph, states[(kk + 1) % S][c.i]);
        }
      },
    };
  },
});
