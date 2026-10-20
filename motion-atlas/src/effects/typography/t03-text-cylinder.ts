import { defineEffect } from '../../engine/define';
import { el } from '../../engine/dom';
import { bool, clamp, minSide, num, TAU } from '../../engine/helpers';
import { fitSize, phrases } from '../../engine/text';

export default defineEffect({
  id: 'text-cylinder',
  code: 'T03',
  nameZh: '文字圓柱',
  nameEn: 'Text Cylinder',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'css3d',
  description: '文字卡片包覆成多層圓柱，層與層反向旋轉，前後有透視與遮擋。',
  tags: ['3D', '圓柱', '旋轉', '透視', 'cylinder'],
  suitable: ['品牌標語', '展場循環畫面', '節目片頭'],
  principle:
    'CSS 3D：每層是一個 preserve-3d 容器，卡片以 rotateY(i·360°/N) translateZ(R) 圍成一圈，卡寬 = 2R·tan(π/N) 讓圈閉合。播放器每幀設定每層 rotateY，並依卡片朝向的 cos 值調整亮度，背面卡片較暗。',
  defaultText: 'MOTION／ATLAS／動效圖鑑',
  palette: 'POP',
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['cw', 'ccw'],
  textHint: '用「／」分隔多個詞，詞會輪流排在卡片上。',
  params: [
    { key: 'layers', label: '層數', type: 'range', min: 1, max: 4, step: 1, default: 3 },
    { key: 'cards', label: '每層卡片數', type: 'range', min: 6, max: 18, step: 1, default: 10 },
    { key: 'counter', label: '相鄰層反向旋轉', type: 'toggle', default: true },
    { key: 'tilt', label: '俯仰角', type: 'range', min: -30, max: 30, step: 1, default: -12, unit: '°' },
  ],
  recipe: {
    enter: '進場即為完整圓柱，所有卡片已就位。',
    motion: '每層繞垂直軸等速旋轉，相鄰層方向相反、速度略有差異；強度控制旋轉速度與俯仰。',
    hold: '連續旋轉，沒有停頓；正對鏡頭的卡片最亮、最易讀。',
    exit: '無離場，持續循環。',
    loop: '旋轉角度以時間計算，一圈後無縫接續。',
  },
  accept: [
    '可看到 2 層以上圓柱同時旋轉，開啟「反向旋轉」時相鄰層方向相反。',
    '後方卡片被前方卡片遮擋，背面卡片明顯較暗。',
    '改變方向為逆時針後，所有層的旋轉方向反轉。',
    '改變卡片數時圓周仍閉合、卡片間無大縫隙。',
  ],
  limits: ['使用 CSS 3D，不支援 PNG 截取；極舊瀏覽器若不支援 preserve-3d 會變平面。'],
  cycle: 12,
  legacyIds: ['text-cylinder'],
  posterTime: 0.6,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const layers = Math.round(num(ctx, 'layers', 3));
    const cards = Math.round(num(ctx, 'cards', 10) * (ctx.mode === 'card' ? 0.8 : 1));
    const counter = bool(ctx, 'counter', true);
    const tilt = num(ctx, 'tilt', -12);
    const words = phrases(ctx.text);
    const m = minSide(ctx);
    const R = Math.min(w * 0.36, m * 0.62) * ctx.s.scale;
    const cardW = 2 * R * Math.tan(Math.PI / cards) * 0.98;
    const layerH = Math.min((h * 0.6) / layers, cardW * 0.7);
    const colors = [ctx.s.primary, ctx.s.secondary, ctx.s.accent];

    const scene = el('div', { style: { position: 'absolute', inset: '0', perspective: `${Math.max(w, h) * 1.4}px`, overflow: 'hidden' } }, ctx.root);
    const rig = el(
      'div',
      { style: { position: 'absolute', left: '50%', top: '50%', width: '0', height: '0', transformStyle: 'preserve-3d', transform: `rotateX(${tilt * ctx.s.intensity}deg)` } },
      scene,
    );
    interface Ring {
      node: HTMLDivElement;
      cards: { node: HTMLDivElement; a: number }[];
      speed: number;
    }
    const rings: Ring[] = [];
    let wi = 0;
    for (let l = 0; l < layers; l++) {
      const y = (l - (layers - 1) / 2) * layerH * 1.06;
      const node = el('div', { style: { position: 'absolute', left: '0', top: '0', transformStyle: 'preserve-3d', transform: `translateY(${y}px)` } }, rig);
      const color = colors[l % colors.length];
      const list: Ring['cards'] = [];
      for (let i = 0; i < cards; i++) {
        const word = words[wi++ % words.length];
        const a = (i / cards) * 360;
        const fs = clamp(fitSize(word, cardW * 0.84, layerH * 0.72, ctx.family, ctx.weight, ctx.s.tracking), 6, layerH * 0.72);
        const card = el(
          'div',
          {
            text: word,
            style: {
              position: 'absolute',
              left: `${-cardW / 2}px`,
              top: `${-layerH / 2}px`,
              width: `${cardW}px`,
              height: `${layerH}px`,
              display: 'grid',
              placeItems: 'center',
              font: `${ctx.weight} ${fs}px ${ctx.family}`,
              letterSpacing: `${ctx.s.tracking}em`,
              color: ctx.s.background,
              background: color,
              borderRadius: `${Math.max(2, layerH * 0.06)}px`,
              whiteSpace: 'pre',
              transform: `rotateY(${a}deg) translateZ(${R}px)`,
              backfaceVisibility: 'visible',
            },
          },
          node,
        );
        list.push({ node: card, a: (a * Math.PI) / 180 });
      }
      // seeded speed variation per layer (stable across renders)
      const sp = (0.75 + ctx.rand() * 0.5) * (counter && l % 2 ? -1 : 1);
      rings.push({ node, cards: list, speed: sp });
    }
    const baseSpeed = 0.09 * (0.4 + ctx.s.intensity * 0.6) * ctx.dirSign; // revolutions per second
    return {
      render(t) {
        rings.forEach((r, l) => {
          const y = (l - (layers - 1) / 2) * layerH * 1.06;
          const ang = t * baseSpeed * r.speed * TAU;
          r.node.style.transform = `translateY(${y}px) rotateY(${(ang * 180) / Math.PI}deg)`;
          for (const c of r.cards) {
            const facing = Math.cos(c.a + ang); // 1 = facing camera
            const b = 0.38 + 0.62 * clamp((facing + 1) / 2, 0, 1);
            c.node.style.filter = `brightness(${b.toFixed(3)})`;
          }
        });
      },
    };
  },
});
