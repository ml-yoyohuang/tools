import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, ease, mod, num, rgba, TAU } from '../../engine/helpers';
import { glyphWidth100, graphemes, isLatin, phrases, textWidth } from '../../engine/text';
import { font, seg } from './_t14kit';

// Ported from kinetic-typography e56-text-fan (DOM + GSAP, vertical-rl columns) to a
// pure-time Canvas 2D version. Every blade is one copy of a word set as a vertical
// column that reads from the tip toward the shared pivot: CJK / emoji stay upright,
// latin runs are rotated 90° (like writing-mode: vertical-rl; text-orientation: mixed).
const DEG = Math.PI / 180;

/** Split one long phrase into short readable chunks (by words for latin, evenly otherwise). */
function chunks(text: string, max: number): string[] {
  const ws = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  if (ws.length > 1) {
    let cur = '';
    for (const w of ws) {
      if (cur && graphemes(cur + ' ' + w).length > max) {
        out.push(cur);
        cur = w;
      } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) out.push(cur);
    return out;
  }
  const g = graphemes(text);
  const parts = Math.ceil(g.length / max);
  const size = Math.ceil(g.length / parts);
  for (let i = 0; i < g.length; i += size) out.push(g.slice(i, i + size).join(''));
  return out;
}

/** Bounding box (unit radius) of a sector spanning [a0, a1] incl. its apex. */
function sectorBox(a0: number, a1: number) {
  const pts: [number, number][] = [[0, 0], [Math.cos(a0), Math.sin(a0)], [Math.cos(a1), Math.sin(a1)]];
  for (let k = -4; k <= 4; k++) {
    const a = (k * Math.PI) / 2;
    if (a > a0 && a < a1) pts.push([Math.cos(a), Math.sin(a)]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs) - 0.08, x1: Math.max(...xs) + 0.08, y0: Math.min(...ys) - 0.08, y1: Math.max(...ys) + 0.08 };
}

/** Column pieces: upright single graphemes or rotated latin runs, with advance along the column. */
function columnPieces(word: string, fs: number, family: string, weight: number, tracking: number) {
  const out: { s: string; rot: boolean; adv: number }[] = [];
  let run = '';
  const flush = () => {
    if (!run) return;
    out.push({ s: run, rot: true, adv: textWidth(run, fs, family, weight, tracking) + tracking * fs });
    run = '';
  };
  for (const ch of graphemes(word)) {
    if (isLatin(ch) || ch === ' ') run += ch;
    else {
      flush();
      out.push({ s: ch, rot: false, adv: Math.max(fs, (glyphWidth100(ch, family, weight) / 100) * fs) + tracking * fs });
    }
  }
  flush();
  return out;
}

export default defineEffect({
  id: 'text-fan',
  code: 'T15',
  nameZh: '文字扇形',
  nameEn: 'Text Fan',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '重複的詞以共同支點像摺扇一樣逐片展開、輕輕搖動，再依序收回。',
  tags: ['扇形', '展開', '支點', '和風', 'fan'],
  suitable: ['登場動畫', '和風視覺', '節慶標語'],
  principle:
    'Canvas 2D：每片扇骨是一個從支點出發、以直書排列的詞（中文直立、拉丁字母轉 90°）。扇骨 i 的角度 = a0 + i·Δ（Δ = 展開角 / (N−1)），以 back.out 彈性補間，開始時間依序錯開（展開節奏），最後一片走得最遠；展開後整把扇子以 sine 小幅搖動，收回時以 power3.inOut 由最後一片反向錯開。',
  defaultText: '展開／OPEN',
  palette: 'PASTEL',
  colors: { primary: '#141414', secondary: '#ED589A', accent: '#9A86DE' },
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['cw', 'ccw'],
  maxChars: 30,
  textHint: '用「／」分隔多個詞，扇骨會輪流使用。',
  loopable: true,
  params: [
    { key: 'blades', label: '扇骨數', type: 'range', min: 3, max: 16, step: 1, default: 9 },
    { key: 'spread', label: '展開角度', type: 'range', min: 90, max: 300, step: 5, default: 180, unit: '°' },
    { key: 'stagger', label: '展開節奏（每片間隔）', type: 'range', min: 0, max: 0.2, step: 0.005, default: 0.055, unit: 's' },
    { key: 'hold', label: '展開停留', type: 'range', min: 0.5, max: 4, step: 0.1, default: 1.9, unit: 's' },
  ],
  recipe: {
    enter: '所有扇骨疊在一起淡入（0.25s），扇子略微傾斜縮小。',
    motion: '扇骨依序以 back.out 拖動展開到等分角度，整把扇子同時以 expo.out 轉正放大。',
    hold: '完全展開後以 sine 小幅搖動，停留可調（預設 1.9s）。',
    exit: '扇骨由最後一片開始以 power3.inOut 依序收回，最後淡出。',
    loop: '收合淡出後重新展開；關閉循環時停在展開狀態。',
  },
  accept: [
    '所有扇骨共用同一個支點，展開後角度等分。',
    '展開時扇骨依序錯開出發，收回時順序相反。',
    '調整展開角度後扇形張角改變；方向改為逆時針後從另一側展開。',
    '中文字在扇骨上保持直立，英文字沿扇骨方向旋轉。',
  ],
  transparent: true,
  cycle: 6,
  posterTime: 2.6,
  legacyIds: ['text-fan'],
  create(ctx) {
    let ws = phrases(ctx.text);
    if (ws.length === 1 && graphemes(ws[0]).length > 10) ws = chunks(ws[0], 6);
    const N = Math.max(3, Math.round(num(ctx, 'blades', 9) * (ctx.mode === 'card' ? 0.85 : 1) * (0.6 + 0.4 * ctx.q)));
    const S = clamp(num(ctx, 'spread', 180), 60, 330) * DEG;
    const stag = num(ctx, 'stagger', 0.055);
    const hold = num(ctx, 'hold', 1.9);
    const k = ctx.s.intensity;
    const fit = (dir: number) => {
      const b = sectorBox(dir - S / 2, dir + S / 2);
      return { dir, box: b, R: Math.min((ctx.width * 0.9) / (b.x1 - b.x0), (ctx.height * 0.86) / (b.y1 - b.y0)) };
    };
    const up = fit(-Math.PI / 2);
    const side = fit(0);
    const { dir, box, R } = side.R > up.R * 1.12 ? side : up;
    const a0 = dir - S / 2;
    const px = ctx.width / 2 - ((box.x0 + box.x1) / 2) * R;
    const py = ctx.height / 2 - ((box.y0 + box.y1) / 2) * R;
    const step = S / (N - 1);
    const family = ctx.family;
    const wt = ctx.weight;
    const tr = ctx.s.tracking;
    const lenEm = Math.max(...ws.map((w) => columnPieces(w, 100, family, wt, tr).reduce((a, p) => a + p.adv, 0) / 100), 0.6);
    const sp = Math.max(0.12, Math.min(step, 0.7));
    const fBase = R / (lenEm + 0.92 / sp + 0.08);
    const fs = clamp(fBase * ctx.s.scale, 6, R * 0.32);
    const inner = Math.max(R * 0.2, Math.min(R - lenEm * fs - fs * 0.1, (fs * 0.92) / sp));
    const tipW = Math.min(R * sp * 0.98, fs * 2.2);
    const cols = ws.map((w) => columnPieces(w, fs, family, wt, tr));
    const backOut = ease(`back.out(${(1 + 0.8 * k).toFixed(2)})`);
    const expoOut = ease('expo.out');
    const p3 = ease('power3.inOut');
    const p2in = ease('power2.in');

    // timeline (seconds)
    const open = 0.35;
    const opened = open + (N - 1) * stag + 1.15;
    const fold = opened + hold;
    const end = fold + (N - 1) * 0.035 + 0.85;
    const cycle = end + 0.5;
    // closed angle and order depend on direction: cw opens clockwise from a0
    const closedA = ctx.dirSign > 0 ? a0 : a0 + S;
    const target = (i: number) => (ctx.dirSign > 0 ? a0 + i * step : a0 + S - i * step);
    const rv = Math.max(4, fs * 0.22);

    return canvasRuntime(
      ctx,
      (g, time) => {
        const t = mod(time, cycle);
        const alpha = Math.min(seg(t, 0.05, 0.25), 1 - seg(t, end - 0.05, 0.3));
        if (alpha <= 0) return;
        // whole-fan rotation / scale
        let fr = -6 * k * (1 - expoOut(seg(t, open, 1.4)));
        let fsc = 0.94 + 0.06 * expoOut(seg(t, open, 1.4));
        if (t >= opened && t < fold) fr += 2.5 * k * Math.sin(((t - opened) / 1.8) * Math.PI) * (t - opened < 1.8 ? 1 : 0);
        if (t >= fold) {
          const u = p2in(seg(t, fold + 0.1, 0.9));
          fr = -6 * k * u;
          fsc = 1 - 0.06 * u;
        }
        g.globalAlpha = alpha;
        g.translate(px, py);
        g.rotate(fr * DEG * ctx.dirSign);
        g.scale(fsc, fsc);
        for (let i = 0; i < N; i++) {
          // blade angle
          let a = closedA;
          if (t < fold) a = closedA + (target(i) - closedA) * backOut(seg(t, open + i * stag, 1.15));
          else a = target(i) + (closedA - target(i)) * p3(seg(t, fold + (N - 1 - i) * 0.035, 0.85));
          const alt = i % 2 === 1;
          g.save();
          g.rotate(a + Math.PI / 2); // local −y = outward
          // paper strip, tapering toward the pivot
          const top = -R;
          const bot = -inner * 0.72;
          g.fillStyle = rgba(alt ? ctx.s.secondary : ctx.s.accent, alt ? 0.2 : 0.22);
          g.beginPath();
          g.moveTo(-tipW / 2, top);
          g.lineTo(tipW / 2, top);
          g.lineTo(tipW * 0.24, bot);
          g.lineTo(-tipW * 0.24, bot);
          g.closePath();
          g.fill();
          // rib
          g.fillStyle = rgba(ctx.s.primary, 0.55);
          g.fillRect(-0.75, -inner * 0.95, 1.5, inner * 0.95);
          // text column: reads from the tip toward the pivot; on blades that end up
          // pointing right the column is turned 180° so latin never reads upside down
          g.fillStyle = alt ? ctx.s.secondary : ctx.s.primary;
          g.font = font(fs, family, wt);
          g.textBaseline = 'middle';
          const col = cols[i % cols.length];
          const flip = Math.cos(target(i)) > 0.05;
          if (flip) {
            const len = col.reduce((acc, p) => acc + p.adv, 0);
            g.rotate(Math.PI);
            g.translate(0, 2 * (R - fs * 0.08) - len);
          }
          let y = top + fs * 0.08;
          for (const p of col) {
            if (p.rot) {
              g.save();
              g.translate(0, y);
              g.rotate(Math.PI / 2);
              g.textAlign = 'left';
              let x = 0;
              for (const ch of graphemes(p.s)) {
                g.fillText(ch, x, 0);
                x += (glyphWidth100(ch, family, wt) / 100) * fs + tr * fs;
              }
              g.restore();
            } else {
              g.textAlign = 'center';
              g.fillText(p.s, 0, y + p.adv / 2);
            }
            y += p.adv;
          }
          g.restore();
        }
        // pivot rivet
        g.fillStyle = ctx.s.background;
        g.beginPath();
        g.arc(0, 0, rv * 1.45, 0, TAU);
        g.fill();
        g.strokeStyle = ctx.s.primary;
        g.lineWidth = Math.max(1, rv * 0.3);
        g.stroke();
        g.fillStyle = ctx.s.secondary;
        g.beginPath();
        g.arc(0, 0, rv, 0, TAU);
        g.fill();
      },
      { settle: opened + 0.9 },
    );
  },
});
