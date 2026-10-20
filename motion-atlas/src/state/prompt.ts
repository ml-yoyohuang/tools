// AI production prompt generator. Produces plain text from the CURRENT settings —
// never raw HTML or executable code — so the prompt can be pasted into any AI tool.
import { CATEGORY_MAP, RENDERER_LABEL } from '../effects/categories';
import { FONT_OPTIONS, WEIGHT_RANGE } from '../engine/fonts';
import { matchPreset } from '../engine/palette';
import { DIRECTION_LABEL, RATIO_SIZE } from '../engine/settings';
import type { CommonControl, EffectDef, EffectSettings, ParamDef, RendererKind } from '../engine/types';

export type PromptKind = 'standalone' | 'integrate';

const RENDERER_HINT: Record<RendererKind, string> = {
  canvas: 'Canvas 2D：單一 <canvas> 以 requestAnimationFrame 重繪，backing store 依 devicePixelRatio 縮放（上限 2）。',
  svg: 'SVG：以屬性（path d、transform、points）逐幀更新，向量輸出可縮放。',
  dom: 'DOM + CSS transform / opacity（可用 GSAP timeline 或 Web Animations API），文字以 textContent 插入。',
  css3d: 'DOM + CSS 3D（perspective、transform-style: preserve-3d）；若需要更複雜的幾何或光影，可改用 WebGL（例如 Three.js），但需提供無 WebGL 的 2D 替代。',
};

const COMMON_LABEL: Record<CommonControl, string> = {
  text: '文字',
  font: '字體',
  tracking: '字距',
  weight: '字重',
  intensity: '強度',
  scale: '尺度',
  direction: '方向',
  secondary: 'Secondary 色',
  accent: 'Accent 色',
  seed: '隨機種子',
};

function paramLine(p: ParamDef, v: unknown): string {
  switch (p.type) {
    case 'range':
      return `- ${p.label}（${p.key}）：${v}${p.unit ?? ''}（範圍 ${p.min}–${p.max}${p.unit ?? ''}）`;
    case 'toggle':
      return `- ${p.label}（${p.key}）：${v ? '開' : '關'}`;
    case 'select':
      return `- ${p.label}（${p.key}）：${p.options.find((o) => o.value === v)?.label ?? v}`;
    case 'text':
      return `- ${p.label}（${p.key}）：「${String(v)}」`;
  }
}

/** Params that actually apply (respects `when` conditions). */
export function activeParams(def: EffectDef, s: EffectSettings): ParamDef[] {
  return (def.params ?? []).filter((p) => !p.when || s.params[p.when.key] === p.when.value);
}

/** The current settings as a JSON object restricted to what applies to this effect. */
export function settingsJSON(def: EffectDef, s: EffectSettings) {
  const c = new Set(def.controls);
  const out: Record<string, unknown> = { effect: def.id, code: def.code, version: 1 };
  if (c.has('text')) out.text = s.text;
  if (c.has('font')) out.font = s.font;
  if (c.has('weight') && WEIGHT_RANGE[s.font]) out.weight = s.weight;
  if (c.has('tracking')) out.trackingEm = s.tracking;
  out.colors = {
    background: s.background,
    primary: s.primary,
    ...(c.has('secondary') ? { secondary: s.secondary } : {}),
    ...(c.has('accent') ? { accent: s.accent } : {}),
  };
  out.ratio = s.ratio;
  out.speed = s.speed;
  if (c.has('intensity')) out.intensity = s.intensity;
  if (c.has('scale')) out.scale = s.scale;
  if (c.has('direction')) out.direction = s.direction;
  if (c.has('seed')) out.seed = s.seed;
  if (def.loopable) out.loop = s.loop;
  const params: Record<string, unknown> = {};
  for (const p of activeParams(def, s)) params[p.key] = s.params[p.key];
  out.params = params;
  return out;
}

export function buildPrompt(def: EffectDef, s: EffectSettings, kind: PromptKind): string {
  const c = new Set(def.controls);
  const cat = CATEGORY_MAP[def.category];
  const [W, H] = RATIO_SIZE[s.ratio];
  const preset = matchPreset(s);
  const font = FONT_OPTIONS.find((f) => f.value === s.font)?.label ?? s.font;
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  if (kind === 'standalone') {
    push(
      `請實作一個可在瀏覽器即時播放的動態效果（用程式碼產生動畫，不是生成靜態圖片或影片檔）。`,
      `交付一個可直接開啟的獨立頁面（HTML + CSS + JavaScript，可使用 TypeScript／建置工具），不依賴付費外掛、影片素材或外部圖片。`,
      '',
    );
  } else {
    push(
      `請把下列動態效果整合到我既有的網站中（用程式碼即時產生動畫，不是生成靜態圖片）。`,
      `請先閱讀現有專案結構與技術棧，沿用既有框架、樣式與建置方式；把效果封裝成可重複使用的元件／模組，提供 mount(container, options) 與 destroy()（或框架對應的元件生命週期），不要修改無關檔案。`,
      '',
    );
  }

  push(`## 1. 效果名稱`, `${def.nameZh} / ${def.nameEn}（${cat.label}・${def.code}）`, '');
  push(`## 2. 運動機制`, def.description, def.principle, '');

  if (c.has('text')) {
    push(`## 3. 文字內容`);
    push(`使用以下文字（以純文字插入，例如 textContent，不可當成 HTML 解析）：`);
    push(`「${s.text.trim() ? s.text : def.defaultText}」`);
    push(`「／」或換行代表分段，需依序處理每一段。必須以 grapheme（Intl.Segmenter，並提供 fallback）切分，中文、英文、數字、標點與 emoji 都要正確。空字串時使用預設文字。`);
    push(`字體：${font}${c.has('weight') && WEIGHT_RANGE[s.font] ? `，字重 ${s.weight}` : ''}${c.has('tracking') ? `，字距 ${s.tracking}em` : ''}。字體需等載入完成後再量測；載入失敗時以系統中文黑體 fallback 繼續運作。`);
    push('');
  } else push(`## 3. 文字內容`, `此效果不使用文字。`, '');

  push(`## 4. 色彩 token`);
  push(`- --color-background: ${s.background}`);
  push(`- --color-primary: ${s.primary}`);
  if (c.has('secondary')) push(`- --color-secondary: ${s.secondary}`);
  if (c.has('accent')) push(`- --color-accent: ${s.accent}`);
  if (preset) push(`（對應色彩 preset：${preset}）`);
  push(`顏色需可由參數替換，替換後畫面仍需清楚可辨；不要自行加入彩虹漸層。`, '');

  push(`## 5. 舞台`, `比例 ${s.ratio}，建議輸出尺寸 ${W}×${H}px；容器尺寸改變時依比例重新排版，不可變形或裁掉主體。`, '');

  push(`## 6. 參數（目前設定）`);
  push(`- 速度：${s.speed}×（以時間而非幀數驅動，speed 只縮放時間）`);
  if (c.has('intensity')) push(`- 強度：${s.intensity}（0 = 幾乎靜止，1 = 預設，2 = 最強）`);
  if (c.has('scale')) push(`- 尺度：${s.scale}×`);
  if (c.has('direction')) push(`- 方向：${DIRECTION_LABEL[s.direction]}（${s.direction}）`);
  if (c.has('seed')) push(`- 隨機種子：${s.seed}（所有隨機配置必須由此 seed 決定，重新整理後畫面一致）`);
  if (def.loopable) push(`- 循環：${s.loop ? '開' : '關（播放完停在最終畫面）'}`);
  for (const p of activeParams(def, s)) push(paramLine(p, s.params[p.key]));
  push(`- 需要對外開放調整的共用控制項：${['速度', ...def.controls.map((k) => COMMON_LABEL[k])].join('、')}；不要提供沒有實際影響的參數。`);
  push('');

  push(`## 7. 建議 renderer`, `${RENDERER_LABEL[def.renderer]}：${RENDERER_HINT[def.renderer]}`, '');

  push(`## 8. 時間結構`);
  push(`- 入場：${def.recipe.enter}`);
  push(`- 運動：${def.recipe.motion}`);
  push(`- 停留：${def.recipe.hold}`);
  push(`- 離場：${def.recipe.exit}`);
  push(`- 循環：${def.recipe.loop}`);
  push('');

  push(
    `## 9. 響應式`,
    `支援 16:9、1:1、9:16 與任意容器寬度；以較短邊計算尺寸。手機寬度（< 720px）降低粒子、網格與殘影數量；canvas 的 devicePixelRatio 上限 2。`,
    '',
    `## 10. 減少動態（prefers-reduced-motion）`,
    `偵測到 reduce 時預設顯示靜態首幀或低幅度版本，並提供明確的播放按鈕讓使用者主動播放；避免高頻、高對比閃爍。`,
    '',
    `## 11. 資源清理`,
    `提供 play／pause／restart／destroy。destroy 時取消 requestAnimationFrame、停止並清除 timeline／動畫、移除 event listener 與 ResizeObserver／IntersectionObserver、釋放 canvas 與其他圖形資源；離開可視區域或分頁隱藏時暫停，恢復時不可一次跳過大量時間。`,
    '',
    `## 12. 驗收條件（需可觀察）`,
    ...def.accept.map((a) => `- ${a}`),
    `- 暫停後恢復，動畫從原位置繼續，不跳幀。`,
    `- 連續建立／銷毀 10 次後無殘留節點、無 console error。`,
    '',
  );

  if (kind === 'integrate') {
    push(
      `## 13. 整合要求`,
      `- 以既有的設計 token／CSS 變數承接上述色彩，不要硬寫在多處。`,
      `- 效果容器需設定 aria-hidden="true"，並在旁邊提供完整的可讀文字（給輔助技術）。`,
      `- 在列表或長頁面中，只有進入可視區域時才播放（IntersectionObserver），並限制同時播放數量。`,
      `- 不新增全域樣式污染，不改動現有路由與資料流程。`,
      '',
    );
  }

  push(`## 目前參數 JSON`, '```json', JSON.stringify(settingsJSON(def, s), null, 2), '```');
  return lines.join('\n');
}
