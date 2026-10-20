import { defineEffect } from '../../engine/define';
import { el, glyphSpans } from '../../engine/dom';
import { num, str } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText, phrases } from '../../engine/text';

// Pure function of time: a schedule of (type → hold → delete → pause) per sentence.
// Layout is computed for the full sentence first so glyphs never shift while typing.
const PAUSE_AFTER = /[，。！？、；：,.!?;:…]/;

export default defineEffect({
  id: 'typewriter',
  code: 'T10',
  nameZh: '打字機',
  nameEn: 'Typewriter',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'beginner',
  renderer: 'dom',
  description: '逐字輸入、游標閃爍，停留後刪除再輸入下一句；輸入與刪除速度分開設定。',
  tags: ['打字', '游標', '逐字', '字幕', 'typewriter'],
  suitable: ['標語輪播', '對話字幕', '產品介紹'],
  principle:
    'DOM：先為整句排版並建立每個字的 span（含空白），再依「輸入 → 停留 → 刪除 → 間隔」的時間表計算目前可見字數；輸入節奏使用 seeded 抖動，標點後多停 0.35 秒。只在可見字數改變時寫入 DOM。',
  defaultText: '你好！Hello 🙂／動效圖鑑／MOTION PLAY',
  palette: 'MONO',
  colors: { background: '#F2E8D5', primary: '#141414', secondary: '#E63A2E' },
  controls: ['text', 'font', 'weight', 'tracking', 'scale', 'secondary', 'seed'],
  maxChars: 80,
  textHint: '用「／」或換行分隔多個句子，會依序輸入、刪除、再輸入下一句。',
  loopable: true,
  params: [
    { key: 'cps', label: '輸入速度（字／秒）', type: 'range', min: 3, max: 24, step: 1, default: 10 },
    { key: 'dps', label: '刪除速度（字／秒）', type: 'range', min: 4, max: 60, step: 1, default: 26 },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.5, max: 4, step: 0.1, default: 1.6, unit: 's' },
    { key: 'cursor', label: '游標樣式', type: 'select', default: 'bar', options: [{ value: 'bar', label: '直線' }, { value: 'block', label: '方塊' }, { value: 'under', label: '底線' }] },
  ],
  recipe: {
    enter: '游標在第一行起點閃爍 0.35 秒。',
    motion: '逐字出現，速度帶輕微隨機抖動，標點後停頓；輸入中游標常亮。',
    hold: '整句完成後停留（可調），游標以約 1.6Hz 閃爍。',
    exit: '以獨立的刪除速度由尾端逐字刪除。',
    loop: '刪除完畢後輸入下一句；最後一句之後回到第一句。關閉循環時停在第一句完成處。',
  },
  accept: [
    '字逐一出現，已出現的字位置不跳動。',
    '刪除速度與輸入速度可分別調整並可觀察到差異。',
    '「你好！Hello 🙂」的 emoji 被當成單一字元輸入。',
    '多句輸入時依序出現每一句。',
  ],
  limits: ['DOM renderer：PNG 以 SVG foreignObject 實驗性截取，網頁字體可能以系統字替代。'],
  cycle: 12,
  posterTime: 2.4,
  legacyIds: ['typewriter'],
  create(ctx) {
    const sentences = phrases(ctx.text);
    const cps = num(ctx, 'cps', 10);
    const dps = num(ctx, 'dps', 26);
    const hold = num(ctx, 'hold', 1.6);
    const cursorKind = str(ctx, 'cursor', 'bar');
    const stage = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);

    interface Seg {
      start: number;
      typeEnd: number;
      holdEnd: number;
      delEnd: number;
      end: number;
      times: number[];
      spans: HTMLSpanElement[];
      layer: HTMLDivElement;
      L: ReturnType<typeof layoutText>;
    }
    const segs: Seg[] = [];
    let t0 = 0.35;
    sentences.forEach((s, si) => {
      const L = layoutText(ctx, s, { align: 'left', maxWidth: ctx.width * 0.8, maxHeight: ctx.height * 0.5, lineHeight: 1.3, fill: 0.8 });
      const layer = el('div', { style: { position: 'absolute', inset: '0', visibility: 'hidden' } }, stage);
      const spans = glyphSpans(layer, L, { color: ctx.s.primary, includeSpaces: true }).map((x) => x.el);
      const times: number[] = [];
      let acc = 0;
      L.glyphs.forEach((g, i) => {
        times.push(acc);
        acc += (1 / cps) * (0.6 + hash2(i, si, ctx.seed) * 0.8) + (PAUSE_AFTER.test(g.ch) ? 0.35 : 0);
      });
      const typeEnd = t0 + acc;
      const holdEnd = typeEnd + hold;
      const delEnd = holdEnd + L.glyphs.length / dps;
      segs.push({ start: t0, typeEnd, holdEnd, delEnd, end: delEnd + 0.45, times, spans, layer, L });
      t0 = delEnd + 0.45;
    });
    const cycle = t0;
    const first = segs[0];
    const cursor = el('div', { style: { position: 'absolute', background: ctx.s.secondary, borderRadius: '2px' } }, stage);
    let lastSeg = -1;
    let lastN = -1;

    return {
      settle: first.typeEnd + 0.6,
      render(time) {
        const t = time % cycle;
        let si = segs.findIndex((s) => t < s.end);
        if (si < 0) si = segs.length - 1;
        const seg = segs[si];
        const rel = t - seg.start;
        let n: number;
        let typing = false;
        if (t < seg.start) n = 0;
        else if (t < seg.typeEnd) {
          n = seg.times.filter((x) => x <= rel).length;
          typing = true;
        } else if (t < seg.holdEnd) n = seg.spans.length;
        else if (t < seg.delEnd) {
          n = Math.max(0, Math.ceil(seg.spans.length * (1 - (t - seg.holdEnd) / (seg.delEnd - seg.holdEnd))));
          typing = true;
        } else n = 0;

        if (si !== lastSeg) {
          segs.forEach((s, i) => (s.layer.style.visibility = i === si ? 'visible' : 'hidden'));
          lastSeg = si;
          lastN = -1;
        }
        if (n !== lastN) {
          seg.spans.forEach((sp, i) => (sp.style.visibility = i < n ? 'visible' : 'hidden'));
          lastN = n;
        }
        const L = seg.L;
        const g = n > 0 ? L.glyphs[n - 1] : null;
        const fs = L.fontSize;
        const x = g ? g.x + g.w + L.tracking * fs * 0.5 : (L.lines[0].glyphs[0]?.x ?? L.x);
        const lineY = g ? g.y : L.lines[0].y;
        const cw = cursorKind === 'block' ? fs * 0.55 : cursorKind === 'under' ? fs * 0.6 : Math.max(2, fs * 0.07);
        const chh = cursorKind === 'under' ? Math.max(2, fs * 0.08) : fs * 0.95;
        const cy = cursorKind === 'under' ? lineY + L.lineHeight * 0.5 + fs * 0.45 : lineY + (L.lineHeight - chh) / 2;
        Object.assign(cursor.style, { left: `${x + fs * 0.04}px`, top: `${cy}px`, width: `${cw}px`, height: `${chh}px` });
        const blink = (time * 1.6) % 1 < 0.55;
        cursor.style.opacity = typing || blink ? (cursorKind === 'block' ? '0.75' : '1') : '0';
      },
    };
  },
});
