import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, minSide, num, str } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { dirVec, extent, frontLine, halfPlane } from './_util';

export default defineEffect({
  id: 'linear-wipe',
  code: 'W01',
  nameZh: '線性擦拭',
  nameEn: 'Linear Wipe',
  category: 'wipe',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '一條筆直的遮罩邊界從畫面一側推到另一側，邊界後方即是新場景。',
  tags: ['擦拭', '遮罩', '直線', '轉場', 'wipe'],
  suitable: ['簡報換頁', '前後對照', '資訊卡切換'],
  principle:
    'Canvas 2D clip：取方向單位向量 n，計算四個角點投影 p·n 的最小／最大值，邊界位置 front = lerp(min − 線寬, max + 線寬, e)。先畫舊場景，再以半平面 {p·n < front} 為 clip 畫新場景，邊界上描一條 accent 直線。兩個場景都不移動，只有遮罩覆蓋範圍改變。',
  defaultText: '昨天／今天',
  palette: 'MONO',
  colors: { accent: C.red },
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left', 'down', 'up'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    { key: 'edgeW', label: '邊界線粗細', type: 'range', min: 0, max: 16, step: 1, default: 4, unit: 'px' },
    {
      key: 'curve',
      label: '速度曲線',
      type: 'select',
      options: [
        { value: 'power3.inOut', label: '平滑進出' },
        { value: 'none', label: '等速' },
        { value: 'expo.out', label: '急起緩停' },
        { value: 'back.inOut(1.6)', label: '回彈' },
      ],
      default: 'power3.inOut',
    },
  ],
  recipe: {
    enter: '完整顯示 A 場景（停留時間可調）。',
    motion: '直線邊界以 power3.inOut（可改等速／急起緩停／回彈）從起始邊推到對側，邊界後方已是 B。',
    hold: 'B 完整停留，邊界線已移出畫面。',
    exit: '同方向再擦一次，由 B 換回 A。',
    loop: 'A → B → A，週期 = 2 ×（轉場 + 停留）。',
  },
  accept: [
    '轉場中畫面被一條筆直邊界分成 A、B 兩區，兩邊內容都不移動。',
    '方向「向下」時邊界為水平線並由上往下推。',
    '邊界線粗細設為 0 時只剩純遮罩邊緣。',
    '停留時畫面只有單一場景，無殘留線條。',
  ],
  cycle: 4.4,
  posterTime: 1.6,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const [nx, ny] = dirVec(ctx.dir);
    const [lo, hi] = extent(w, h, nx, ny);
    const ew = num(ctx, 'edgeW', 4) * Math.max(0.5, minSide(ctx) / 500);
    const easing = ease(str(ctx, 'curve', 'power3.inOut'));
    const L = (w + h) * 2;
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, easing);
      sc.draw(g, tr.from);
      if (tr.p <= 0) return;
      const front = lo - ew + tr.e * (hi - lo + ew * 2);
      g.save();
      g.beginPath();
      halfPlane(g, nx, ny, front, L);
      g.clip();
      sc.draw(g, tr.to);
      g.restore();
      if (ew > 0 && tr.p < 1) {
        g.strokeStyle = ctx.s.accent;
        g.lineWidth = ew;
        g.beginPath();
        frontLine(g, nx, ny, front, L);
        g.stroke();
      }
    });
  },
});
