import { defineEffect } from '../../engine/define';
import { canvasRuntime, easeInOut, num, phase } from '../../engine/helpers';
import { layoutText, phrases } from '../../engine/text';
import type { Pt } from '../../engine/shapes';
import { drawPanel, makePanels, type Panel, type PageColors } from './_panels';
import { clipHalf, INK, polyPath, reflect } from './_util';

export default defineEffect({
  id: 'comic-page-turn',
  code: 'C11',
  nameZh: '漫畫翻頁',
  nameEn: 'Comic Page Turn',
  category: 'comic',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '漫畫頁從右下角被掀起，沿一條移動的摺線翻向左側，露出下一頁的分鏡，翻起的背面有明暗。',
  tags: ['漫畫', '翻頁', '摺線', '分鏡', 'page turn'],
  suitable: ['電子書預覽', '章節切換', '作品集', '故事簡介'],
  principle:
    'Canvas 2D：頁角 P₀ 沿弧線移動到以書脊鏡射的位置 P₁；摺線 = P₀ 與目前角點 P 的垂直平分線。以半平面裁切（Sutherland–Hodgman）把頁面分成「留下的部分」與「被掀起的角」，掀起的角對摺線反射後成為翻頁片；翻頁片背面的內容以 反射∘書脊鏡射 的仿射矩陣繪製，因此翻完時剛好成為左頁。背面再疊一層沿摺線法向的線性漸層做明暗，下一頁在摺線旁有柔和投影。',
  defaultText: '第二話／NEXT PAGE',
  palette: 'STREET',
  colors: { background: '#141414', primary: '#F2E8D5', secondary: '#E63A2E', accent: '#FFFFFF' },
  controls: ['text', 'font', 'weight', 'scale', 'secondary', 'seed'],
  textHint: '用「／」分隔，每一頁的大格顯示其中一段。',
  maxChars: 30,
  params: [
    { key: 'turn', label: '翻頁時間', type: 'range', min: 0.6, max: 2.6, step: 0.1, default: 1.4, unit: 's' },
    { key: 'hold', label: '每頁停留', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1, unit: 's' },
    { key: 'lift', label: '頁角抬起', type: 'range', min: 0, max: 0.6, step: 0.02, default: 0.3 },
    { key: 'shade', label: '背面明暗', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
  ],
  recipe: {
    enter: '目前頁完整停留，下一頁藏在底下。',
    motion: '頁角以 easeInOut 沿弧線往左上再往左下移動；摺線隨之旋轉移動，掀起的部分翻成背面，背面靠摺線處較暗。',
    hold: '翻完後新頁與左頁（寬畫面時）靜止停留「每頁停留」秒。',
    exit: '下一次翻頁把新頁翻走。',
    loop: '兩頁交替翻動，循環無縫。',
  },
  accept: [
    '可以看到一條直的摺線，摺線一側是原頁，另一側是翻起的背面。',
    '翻起時下方露出下一頁不同的漫畫格。',
    '翻起的背面有明暗漸層，摺線旁的下一頁有陰影。',
    '寬畫面時翻完的頁會落在左側成為左頁；直式畫面時翻出畫面外。',
  ],
  transparent: true,
  cycle: 4.8,
  posterTime: 1.75,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const turn = num(ctx, 'turn', 1.4);
    const hold = num(ctx, 'hold', 1);
    const lift = num(ctx, 'lift', 0.3);
    const shade = num(ctx, 'shade', 0.6);
    const words = phrases(ctx.text);
    let pageH = h * 0.86;
    let pageW = pageH * 0.7;
    const spread = pageW * 2 <= w * 0.94;
    if (!spread && pageW > w * 0.86) {
      pageW = w * 0.86;
      pageH = Math.min(pageH, pageW / 0.62);
    }
    const top = (h - pageH) / 2;
    const bot = top + pageH;
    const S = spread ? w / 2 : (w - pageW) / 2; // spine x
    const R = S + pageW;
    const rightRect: Pt[] = [
      [S, top],
      [R, top],
      [R, bot],
      [S, bot],
    ];
    const pad = pageW * 0.07;
    const gut = pageW * 0.03;
    const rows = 3;
    const make = (x0: number, caption: string | null) => {
      const ps = makePanels(ctx.rand, x0 + pad, top + pad, pageW - pad * 2, pageH - pad * 2, gut, { rows, slant: 0.5, maxCols: 2 });
      for (const p of ps) {
        if (p.kind === 'caption' && caption) {
          p.layout = layoutText(ctx, caption, { cx: p.cx, cy: p.cy, maxWidth: p.w * 0.78, maxHeight: p.h * 0.6, fill: 0.95 });
        }
      }
      return ps;
    };
    // two rectos (right pages) and two versos (their back sides, laid out as left pages)
    const recto = [make(S, words[0]), make(S, words[1 % words.length])];
    const verso = [make(S - pageW, null), make(S - pageW, null)];
    const colors: PageColors = { ink: INK, paper: ctx.s.primary, tone: ctx.s.secondary, accent: ctx.s.accent };
    const lw = Math.max(1.5, pageW * 0.008);
    const drawPage = (g: CanvasRenderingContext2D, x0: number, panels: Panel[]) => {
      g.fillStyle = colors.paper;
      g.fillRect(x0, top, pageW, pageH);
      for (const p of panels) drawPanel(g, p, colors, lw, 0);
    };
    const durs = [hold, turn, hold, turn];
    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, durs);
      const k = ph.i < 2 ? 0 : 1; // which recto is turning (or showing)
      const turning = ph.i === 1 || ph.i === 3;
      const cur = recto[k];
      const next = recto[1 - k];
      const e = turning ? easeInOut(ph.p) : 0;
      // left page (spread only): the verso turned in the previous turn
      if (spread) {
        drawPage(g, S - pageW, verso[1 - k]);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(S - pageW, top, pageW, pageH);
      }
      if (!turning || e < 0.002) {
        drawPage(g, S, cur);
      } else {
        const P0: Pt = [R, bot];
        const P: Pt = [P0[0] + (2 * S - 2 * R) * e, bot - Math.sin(Math.PI * e) * pageH * lift];
        const dx = P0[0] - P[0];
        const dy = P0[1] - P[1];
        const dl = Math.hypot(dx, dy) || 1;
        const nx = dx / dl;
        const ny = dy / dl;
        const q0: Pt = [(P0[0] + P[0]) / 2, (P0[1] + P[1]) / 2];
        const c = -(nx * q0[0] + ny * q0[1]);
        const corner = clipHalf(rightRect, nx, ny, c); // lifted part (corner side)
        const stay = clipHalf(rightRect, -nx, -ny, -c);
        const flap = corner.map((p) => reflect(p, q0, nx, ny));
        // next page underneath
        drawPage(g, S, next);
        // current page: the part that stays
        if (stay.length > 2) {
          g.save();
          g.beginPath();
          polyPath(g, stay);
          g.clip();
          drawPage(g, S, cur);
          g.restore();
        }
        // soft shadow on the revealed next page along the fold
        if (corner.length > 2) {
          g.save();
          g.beginPath();
          polyPath(g, corner);
          g.clip();
          const L = pageW * 0.16;
          const gr = g.createLinearGradient(q0[0], q0[1], q0[0] + nx * L, q0[1] + ny * L);
          gr.addColorStop(0, `rgba(0,0,0,${0.45 * shade + 0.1})`);
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr;
          g.fillRect(S - 2, top - 2, pageW + 4, pageH + 4);
          g.restore();
        }
        if (flap.length > 2) {
          // flap drop shadow
          g.save();
          g.translate(-pageW * 0.012, pageW * 0.016);
          g.beginPath();
          polyPath(g, flap);
          g.fillStyle = 'rgba(0,0,0,0.28)';
          g.fill();
          g.restore();
          g.save();
          g.beginPath();
          polyPath(g, flap);
          g.clip();
          // back side: verso content mapped by reflect(fold) ∘ mirror(spine)
          g.save();
          const a = 1 - 2 * nx * nx;
          const b = -2 * nx * ny;
          const d = 1 - 2 * ny * ny;
          const qd = 2 * (q0[0] * nx + q0[1] * ny);
          g.transform(a, b, b, d, qd * nx, qd * ny);
          g.transform(-1, 0, 0, 1, 2 * S, 0);
          drawPage(g, S - pageW, verso[k]);
          g.restore();
          // shading across the flap: darkest at the fold, highlight stripe, then light
          const sk = shade * Math.sin(Math.PI * e) ** 0.5;
          if (spread) {
            g.fillStyle = `rgba(0,0,0,${0.12 * e})`;
            g.fillRect(0, 0, w, h);
          }
          const L = Math.max(pageW * 0.35, Math.min(pageW, dl * 0.5));
          const gr = g.createLinearGradient(q0[0], q0[1], q0[0] - nx * L, q0[1] - ny * L);
          gr.addColorStop(0, `rgba(0,0,0,${0.5 * sk})`);
          gr.addColorStop(0.18, `rgba(255,255,255,${0.22 * sk})`);
          gr.addColorStop(0.45, `rgba(0,0,0,${0.08 * sk})`);
          gr.addColorStop(1, `rgba(0,0,0,${0.18 * sk})`);
          g.fillStyle = gr;
          g.fillRect(0, 0, w, h);
          g.restore();
          g.beginPath();
          polyPath(g, flap);
          g.lineWidth = Math.max(1, lw * 0.6);
          g.strokeStyle = 'rgba(20,20,20,0.6)';
          g.stroke();
        }
      }
      // spine shading
      if (spread) {
        const sg = g.createLinearGradient(S - pageW * 0.06, 0, S + pageW * 0.06, 0);
        sg.addColorStop(0, 'rgba(0,0,0,0)');
        sg.addColorStop(0.5, 'rgba(0,0,0,0.22)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sg;
        g.fillRect(S - pageW * 0.06, top, pageW * 0.12, pageH);
      }
    });
  },
});
