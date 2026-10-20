import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, mixHex, num, rgba } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { AB_HINT, blit, local } from './_util';

export default defineEffect({
  id: 'fold-panels',
  code: 'P11',
  nameZh: '摺頁切分',
  nameEn: 'Fold Panels',
  category: 'split',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '舊畫面分成數片直向面板，每片沿鉸鏈像書頁一樣翻過去：正面是舊內容、背面是新內容，翻起時有透視與明暗。',
  tags: ['摺頁', '翻頁', '鉸鏈', '透視', 'fold'],
  suitable: ['雜誌／型錄翻頁', '故事章節', '產品手冊'],
  principle:
    'Canvas 2D 模擬 3D：面板 i 的鉸鏈在 hx，面上距鉸鏈 d 的點旋轉 θ 後為 (hx + σ·d·cosθ, z = d·sinθ)，以焦距 f 投影 s = f / (f − z)，X = cx + (x − cx)·s、高度 = H·s。每片拆成 M 條直條各自以仿射繪製，形成梯形透視。θ<90° 畫 A 正面（取 hx+σd），θ>90° 畫背面＝落點的 B（取 hx−σd），故翻完時與底下的 B 完全吻合。明暗 = 0.5·(1∓cosθ)；繪製順序依 |θ−90°| 由小到大（立起的頁最靠近觀者，最後畫）。',
  defaultText: 'FOLD／UNFOLD',
  palette: 'PASTEL',
  colors: { primary: C.blue },
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['left', 'right'],
  textHint: AB_HINT,
  params: [
    ...TRANSITION_PARAMS,
    { key: 'panels', label: '面板數', type: 'range', min: 2, max: 8, step: 1, default: 4 },
    { key: 'persp', label: '透視強度', type: 'range', min: 0, max: 1, step: 0.05, default: 0.75 },
    { key: 'stagger', label: '依序間隔', type: 'range', min: 0, max: 0.8, step: 0.05, default: 0.5 },
  ],
  recipe: {
    enter: '完整顯示 A 場景，面板間有細摺線。',
    motion: '面板依序沿鉸鏈以 power2.inOut 翻 180°：翻起時透視放大、正面逐漸變暗，過 90° 後露出印著 B 的背面並逐漸變亮，落在前一片的位置。',
    hold: '全部翻完後即為完整的 B。',
    exit: '同樣機制把 B 的面板翻回 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '翻動中的面板呈梯形（遠端較高），有明顯透視壓縮。',
    '翻過 90° 前看到 A 的正面，之後看到 B 的背面，且會遮住旁邊的面板。',
    '面板越接近垂直越暗，平放時無陰影。',
    '方向切換時鉸鏈改在另一側、往另一邊翻；面板數可調。',
  ],
  cycle: 4.4,
  posterTime: 1.75,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const n = Math.round(num(ctx, 'panels', 4));
    const pw = w / n;
    const persp = num(ctx, 'persp', 0.75);
    const f = Math.max(w, h) * (1.15 + 6 * (1 - persp) ** 2);
    const stag = num(ctx, 'stagger', 0.5);
    const sig = ctx.dir === 'left' ? 1 : -1; // panel extends +x from its hinge when turning left
    const M = Math.max(6, Math.round(22 * ctx.q));
    const cx = w / 2;
    const cy = h / 2;
    const turn = ease('power2.inOut');
    const paper = mixHex(ctx.s.accent, '#000000', 0.15);
    const lw = Math.max(1, Math.min(w, h) * 0.004);
    const panels = Array.from({ length: n }, (_, i) => ({
      x0: i * pw,
      hx: sig > 0 ? i * pw : (i + 1) * pw,
      ord: sig > 0 ? i / Math.max(1, n - 1) : (n - 1 - i) / Math.max(1, n - 1),
    }));
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      const imgs = [sc.a.canvas, sc.b.canvas];
      if (tr.p <= 0) return sc.draw(g, tr.from);
      if (tr.p >= 1) return sc.draw(g, tr.to);
      sc.draw(g, tr.to);
      const span = 1 - stag;
      const live: { pn: (typeof panels)[number]; th: number }[] = [];
      for (const pn of panels) {
        const th = Math.PI * turn(local(tr.p, pn.ord * stag, span));
        if (th >= Math.PI - 1e-4) continue;
        if (th <= 1e-4) blit(g, imgs[tr.from], w, h, pn.x0, 0, pw, h, pn.x0, 0, pw, h);
        else live.push({ pn, th });
      }
      // fold lines between panels
      g.strokeStyle = rgba(ctx.s.secondary, 0.9);
      g.lineWidth = lw;
      g.beginPath();
      for (let i = 1; i < n; i++) {
        g.moveTo(i * pw, 0);
        g.lineTo(i * pw, h);
      }
      g.stroke();
      live.sort((a, b) => Math.abs(b.th - Math.PI / 2) - Math.abs(a.th - Math.PI / 2));
      for (const { pn, th } of live) {
        const c = Math.cos(th);
        const sn = Math.sin(th);
        const back = c < 0;
        const img = imgs[back ? tr.to : tr.from];
        const shade = back ? 0.5 * (1 + c) : 0.5 * (1 - c);
        const X = (d: number) => cx + (pn.hx + sig * d * c - cx) * (f / (f - d * sn));
        // contact shadow cast on the page below
        g.fillStyle = rgba('#000000', 0.22 * sn);
        const xs = X(pw);
        g.fillRect(Math.min(pn.hx, xs), 0, Math.abs(xs - pn.hx), h);
        for (let s = 0; s < M; s++) {
          const d0 = (pw * s) / M;
          const d1 = (pw * (s + 1)) / M;
          const s0 = back ? -sig : sig;
          const sa = pn.hx + s0 * d0;
          const sb = pn.hx + s0 * d1;
          const xa = X(d0);
          const xb = X(d1);
          const k = f / (f - ((d0 + d1) / 2) * sn);
          const top = cy - cy * k;
          const hh = h * k;
          const dx = Math.min(xa, xb) - 0.4;
          const dw = Math.abs(xb - xa) + 0.8;
          const smin = Math.min(sa, sb);
          if (smin < -0.5 || smin + pw / M > w + 0.5) {
            g.fillStyle = paper;
            g.fillRect(dx, top, dw, hh);
          } else blit(g, img, w, h, smin, 0, pw / M, h, dx, top, dw, hh);
          if (shade > 0.01) {
            g.fillStyle = rgba('#000000', shade * 0.85);
            g.fillRect(dx, top, dw, hh);
          }
        }
        // hinge + free edge
        const kf = f / (f - pw * sn);
        g.strokeStyle = ctx.s.secondary;
        g.lineWidth = lw * 2;
        g.beginPath();
        g.moveTo(pn.hx, 0);
        g.lineTo(pn.hx, h);
        g.moveTo(xs, cy - cy * kf);
        g.lineTo(xs, cy - cy * kf + h * kf);
        g.stroke();
      }
    });
  },
});
