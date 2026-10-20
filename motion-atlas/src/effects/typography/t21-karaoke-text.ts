import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, lerp, mod, num, rgba, str, TAU } from '../../engine/helpers';
import { isLatin, layoutText, type Glyph } from '../../engine/text';
import { seg } from './_t14kit';

// Ported from kinetic-typography e57-karaoke-ball (DOM, per-char clip-path fill +
// parabolic ball) and generalised to WORD timing on canvas. Tokens = latin words
// (consecutive latin glyphs) or single CJK / emoji glyphs. Each token gets a
// duration on a beat grid (BPM; latin words ≈ ½ beat per 3 letters, CJK = 1 beat,
// optional swing); the highlight either sweeps left→right through the token (clip)
// or switches the whole token at its start. The optional ball hops token to token on
// a parabola (linear x, quadratic y) and squashes on each landing.

interface Token {
  glyphs: Glyph[];
  line: number;
  x0: number;
  x1: number;
  cx: number;
  top: number;
  start: number;
  dur: number;
}

export default defineEffect({
  id: 'karaoke-text',
  code: 'T21',
  nameZh: '卡拉 OK 文字',
  nameEn: 'Karaoke Text',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '歌詞依節拍逐詞被高亮色由左至右填滿（或整詞切換），可開啟跳躍小球帶唱。',
  tags: ['卡拉OK', '歌詞', '節拍', '高亮', 'karaoke'],
  suitable: ['歌詞影片', '節奏教學', '直播字幕'],
  principle:
    'Canvas 2D：先把文字切成詞單位（連續拉丁字母為一詞，中文與 emoji 每字一詞），依 BPM 排出每個詞的起始時間與長度（拉丁詞每 3 個字母半拍、中文一拍、可選搖擺節奏，換行多停一拍）。填色模式下每行以 clip 矩形畫出高亮副本，右緣 = 目前詞的 x0 + p·(x1 − x0)；切換模式在詞開始時整詞換色並彈跳放大。小球在相鄰詞中心間以拋物線插值（x 線性、y 二次），落點時壓扁。不需音檔。',
  defaultText: '跟著節奏唱／SING ALONG WITH ME',
  palette: 'MONO',
  colors: { secondary: '#ED589A', accent: '#FFE35A' },
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'secondary', 'accent'],
  maxChars: 50,
  textHint: '換行或「／」會變成下一行歌詞。',
  params: [
    { key: 'bpm', label: '節拍速度', type: 'range', min: 60, max: 200, step: 2, default: 120, unit: 'BPM' },
    {
      key: 'rhythm',
      label: '節奏型',
      type: 'select',
      default: 'even',
      options: [
        { value: 'even', label: '平均' },
        { value: 'swing', label: '搖擺（長短）' },
      ],
    },
    {
      key: 'mode',
      label: '高亮方式',
      type: 'select',
      default: 'sweep',
      options: [
        { value: 'sweep', label: '由左至右填滿' },
        { value: 'switch', label: '整詞切換' },
      ],
    },
    { key: 'ball', label: '跳躍小球', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '歌詞以低透明度全部顯示；小球從第一個詞左上方跳入。',
    motion: '每個詞在自己的節拍時段內被高亮色由左至右填滿（或在節拍點整詞切換並彈跳）；小球依拋物線跳到下一個詞，落點壓扁，當前詞輕微下沉。',
    hold: '整段唱完後完整高亮停留約 2.5 拍。',
    exit: '高亮淡出、小球跳出畫面右側。',
    loop: '重新從第一個詞開始。',
  },
  accept: [
    '詞依節拍依序被高亮，調高 BPM 後明顯變快。',
    '填色模式下高亮在詞內由左至右推進；切換模式下整詞一次換色。',
    '開啟小球時小球落點與目前高亮的詞一致；關閉後只剩高亮。',
    '多行歌詞會在換行時多停一拍再繼續。',
  ],
  transparent: true,
  cycle: 8,
  posterTime: 2.1,
  legacyIds: ['karaoke-ball'],
  create(ctx) {
    const beat = 60 / clamp(num(ctx, 'bpm', 120), 30, 300);
    const swing = str(ctx, 'rhythm', 'even') === 'swing';
    const sweep = str(ctx, 'mode', 'sweep') === 'sweep';
    const showBall = bool(ctx, 'ball', true);
    const k = clamp(ctx.s.intensity, 0, 2);
    const L = layoutText(ctx, ctx.text, { maxHeight: ctx.height * 0.5, maxWidth: ctx.width * 0.84, lineHeight: 1.85, cy: ctx.height * 0.55 });
    const fs = L.fontSize;

    // tokens
    const tokens: Token[] = [];
    for (const line of L.lines) {
      let cur: Glyph[] = [];
      const flush = () => {
        if (!cur.length) return;
        const a = cur[0];
        const b = cur[cur.length - 1];
        tokens.push({ glyphs: cur, line: a.line, x0: a.x, x1: b.x + b.w, cx: (a.x + b.x + b.w) / 2, top: a.cy - fs * 0.56, start: 0, dur: 0 });
        cur = [];
      };
      for (const gl of line.glyphs) {
        if (gl.space) flush();
        else if (isLatin(gl.ch) && cur.length && isLatin(cur[cur.length - 1].ch)) cur.push(gl);
        else {
          flush();
          cur.push(gl);
          if (!isLatin(gl.ch)) flush();
        }
      }
      flush();
    }
    const n = tokens.length;
    let t = 0.2 + beat;
    tokens.forEach((tk, i) => {
      const latin = isLatin(tk.glyphs[0].ch);
      let d = latin ? beat * 0.5 * clamp(Math.ceil(tk.glyphs.length / 3), 1, 4) : beat;
      if (swing) d *= i % 2 === 0 ? 1.34 : 0.66;
      tk.start = t;
      tk.dur = d;
      const next = tokens[i + 1];
      t += d + (next && next.line !== tk.line ? beat : 0);
    });
    const singEnd = t;
    const exitStart = singEnd + beat * 2.5;
    const exitDur = beat * 1.4;
    const cycle = exitStart + exitDur + 0.5;
    const r = Math.max(3, fs * 0.13);
    const startX = L.x - fs * 1.2;
    const lastX = L.x + L.width + fs * 1.2;
    const hop = (x0: number, y0: number, x1: number, y1: number, u: number) => {
      const Hh = (fs * 0.45 + Math.abs(x1 - x0) * 0.22) * (0.35 + 0.65 * k) + Math.max(0, y0 - y1) * 0.3;
      return { x: lerp(x0, x1, u), y: lerp(y0, y1, u) - Hh * 4 * u * (1 - u) };
    };
    const restY = (i: number) => tokens[i].top - r;

    return canvasRuntime(ctx, (g, time) => {
      const tt = mod(time, cycle);
      const fade = tt > exitStart ? clamp(1 - (tt - exitStart) / (exitDur + 0.3), 0, 1) : 1;
      g.font = L.font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      // dip of the active token
      const dipOf = (tk: Token) => {
        const d = tt - tk.start;
        return d > 0 && d < 0.32 ? Math.sin((Math.PI * d) / 0.32) * (1 - d / 0.32) * fs * 0.08 * k : 0;
      };
      // base (unsung) layer
      g.fillStyle = rgba(ctx.s.primary, 0.32);
      for (const tk of tokens) {
        const dy = dipOf(tk);
        for (const c of tk.glyphs) g.fillText(c.ch, c.cx, c.cy + dy);
      }
      // highlight layer
      for (const tk of tokens) {
        const p = clamp((tt - tk.start) / (Math.min(tk.dur, beat * 1.6) * 0.95), 0, 1);
        if (p <= 0 || fade <= 0) continue;
        const dy = dipOf(tk);
        g.save();
        g.globalAlpha = fade;
        g.fillStyle = ctx.s.secondary;
        if (sweep) {
          g.beginPath();
          g.rect(tk.x0 - fs * 0.05, tk.top - fs * 0.4, (tk.x1 - tk.x0 + fs * 0.1) * p, fs * 1.8);
          g.clip();
          for (const c of tk.glyphs) g.fillText(c.ch, c.cx, c.cy + dy);
        } else {
          const u = seg(tt, tk.start, 0.35);
          const s = 1 + 0.22 * k * Math.sin(Math.PI * u) * (1 - 0.5 * u);
          for (const c of tk.glyphs) {
            g.save();
            g.translate(c.cx, c.cy + dy);
            g.scale(s, s);
            g.fillText(c.ch, 0, 0);
            g.restore();
          }
        }
        g.restore();
      }
      if (!showBall || !n) return;
      // ball
      let x: number;
      let y: number;
      let alpha = 1;
      if (tt < tokens[0].start) {
        const u = clamp((tt - (tokens[0].start - beat)) / beat, 0, 1);
        ({ x, y } = hop(startX, restY(0) - fs * 0.25, tokens[0].cx, restY(0), u));
        alpha = clamp(u * 4, 0, 1);
      } else if (tt < exitStart) {
        let i = 0;
        while (i < n - 1 && tt >= tokens[i + 1].start) i++;
        if (i < n - 1) {
          const u = (tt - tokens[i].start) / (tokens[i + 1].start - tokens[i].start);
          ({ x, y } = hop(tokens[i].cx, restY(i), tokens[i + 1].cx, restY(i + 1), u));
        } else {
          const s = tt - tokens[n - 1].start;
          x = tokens[n - 1].cx;
          y = restY(n - 1) - Math.abs(Math.sin((s / beat) * Math.PI)) * fs * 0.18 * Math.exp(-s * 1.4);
        }
      } else {
        const u = clamp((tt - exitStart) / exitDur, 0, 1);
        ({ x, y } = hop(tokens[n - 1].cx, restY(n - 1), lastX, restY(n - 1) - fs * 0.6, u));
        alpha = 1 - clamp((u - 0.6) / 0.4, 0, 1);
      }
      let squash = 0;
      for (const tk of tokens) {
        const d = Math.abs(tt - tk.start);
        if (d < 0.09) squash = Math.max(squash, 1 - d / 0.09);
      }
      const sx = 1 + 0.35 * squash;
      const sy = 1 - 0.32 * squash;
      g.globalAlpha = alpha;
      g.fillStyle = ctx.s.accent;
      g.beginPath();
      g.ellipse(x, y + r * (1 - sy), r * sx, r * sy, 0, 0, TAU);
      g.fill();
    });
  },
});
