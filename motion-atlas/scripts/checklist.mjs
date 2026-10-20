// Generates EFFECTS_CHECKLIST.md and docs/LEGACY_MAPPING.md from the live registry
// (needs the dev server on 5288) plus test-results/smoke/summary.json from scripts/smoke.mjs.
import { chromium } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const BASE = process.argv.find((a) => a.startsWith('--base='))?.slice(7) ?? 'http://localhost:5288/';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE);
await page.waitForFunction(() => window.__ma?.effects?.length);
const effects = await page.evaluate(() => window.__ma.effects);
await browser.close();

const smoke = existsSync('test-results/smoke/summary.json') ? JSON.parse(readFileSync('test-results/smoke/summary.json', 'utf8')) : [];
const smokeMap = new Map(smoke.map((r) => [r.id, r]));
const CAT = { typography: 'TYPOGRAPHY', halftone: 'HALFTONE', grid: 'GRID', lines: 'LINES', shapes: 'SHAPES', split: 'SPLIT', wipe: 'WIPE', comic: 'COMIC', minimal: 'MINIMAL' };
const SRC = { reference: '[R] 參考重建', 'partial-reference': '[P] 部分參考', original: '[E] 延伸設計' };
const REN = { canvas: 'Canvas 2D', svg: 'SVG', dom: 'DOM', css3d: 'CSS 3D' };
const CTRL = { text: '文字', font: '字體', weight: '字重', tracking: '字距', intensity: '強度', scale: '尺度', direction: '方向', secondary: 'Secondary', accent: 'Accent', seed: 'seed' };
const esc = (s) => String(s).replace(/\|/g, '\|').replace(/\n/g, ' ');

const exp = (c) => [c.png === 'canvas' ? 'PNG' : c.png === 'svg' ? 'PNG（SVG 轉點陣）' : c.png === 'dom' ? 'PNG（實驗性 DOM）' : '無 PNG', c.transparentPng ? '透明 PNG' : null, c.webm ? 'WebM' : null].filter(Boolean).join('、');

let md = `# EFFECTS_CHECKLIST

自動產生：\`node scripts/checklist.mjs\`（資料來源：執行中的 registry + \`scripts/smoke.mjs\` 的結果）。

- 效果總數：**${effects.length}**（目前圖鑑）
- 驗收欄：smoke = 4 個時間點畫面不同（確有時間變化）、seek 可重現、16:9／1:1／9:16、測試字串（「動效圖鑑」「MOTION PLAY」「你好！Hello 🙂」、空字串、長字串＋多行）無錯誤、無 console error。
- 目視：120 張 smoke 對照圖（每個效果 4 個時間點）已依分類拼圖人工檢視過，確認主要機制可辨、16:9 無溢出；這是抽樣幀檢查，不是逐幀的完整動畫審查。
- 已知：C01、M01 的 seek 以截圖雜湊比對時偶有差異（SVG 文字反鋸齒／版面量測時機），以 DOM 狀態比對則完全一致。
- 所有效果皆支援：播放、暫停、重播、速度、背景／主色、色彩 presets、恢復預設、隨機（可重現）、16:9／1:1／9:16、分享連結、AI prompt、JSON 匯入匯出。
\n`;
const smokeDate = existsSync('test-results/smoke/summary.json') ? '' : '（尚未執行 smoke）';
for (const [cat, label] of Object.entries(CAT)) {
  const list = effects.filter((e) => e.category === cat);
  md += `\n## ${label}（${list.length}）\n\n| ID | 名稱 | renderer | 來源 | 狀態 | 支援控制項（共用＋專屬） | 匯出 | 驗收 | 已知限制 |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const e of list) {
    const s = smokeMap.get(e.id);
    const res = s ? (s.ok ? `✅ smoke（${s.distinctFrames}/4 幀不同）` : `❌ ${esc(s.notes.join('; '))}`) : `未執行${smokeDate}`;
    const ctrls = [...e.controls.map((c) => CTRL[c]), ...e.paramLabels].join('、');
    md += `| ${e.code} \`${e.id}\` | ${e.nameZh} ${e.nameEn} | ${REN[e.renderer]} | ${SRC[e.sourceType]} | 已實作 | ${esc(ctrls)} | ${exp(e.capabilities)} | ${res} | ${esc(e.limits.join('；') || '—')} |\n`;
  }
}
writeFileSync('EFFECTS_CHECKLIST.md', md);

// ---- legacy mapping ----------------------------------------------------------
const catalogPath = '../kinetic-typography/src/effects/catalog.ts';
if (existsSync(catalogPath)) {
  const src = readFileSync(catalogPath, 'utf8');
  const old = [...src.matchAll(/id: '([^']+)', nameZh: '([^']+)', nameEn: '([^']+)'/g)].map((m) => ({ id: m[1], zh: m[2], en: m[3] }));
  const map = new Map();
  for (const e of effects) for (const l of e.legacyIds) map.set(l, e);
  const merged = old.filter((o) => map.has(o.id));
  let lm = `# 與既有文字庫（kinetic-typography）對照\n\n自動產生：\`node scripts/checklist.mjs\`。\n\n`;
  lm += `- 既有文字庫：${old.length} 個效果（\`kinetic-typography/\`，全部已實作）。\n- MOTION ATLAS：${effects.length} 個效果。\n- 重複並合併：**${merged.length}** 個（atlas 沿用舊實作的運動機制移植並擴充 4 色、方向、seed 等設定；舊 ID 列在 \`legacyIds\`）。\n`;
  lm += `- 兩個庫合計的唯一效果數：${old.length} + ${effects.length} − ${merged.length} = **${old.length + effects.length - merged.length}**（不是 ${old.length + effects.length}）。\n\n`;
  lm += `## Migration\n\n- 收藏：首次載入 atlas 時讀取同網域舊庫的 \`kt:favorites\`，可對應的 ID 轉成 atlas ID 寫入 \`ma:favorites\`（只做一次，旗標 \`ma:migrated\`）；不在 atlas 內的舊 ID 忽略。\n- 分享連結：\`#/e/<舊 ID>\` 會自動導向對應的 atlas ID（例如 \`#/e/karaoke-ball\` → \`#/e/karaoke-text\`）。舊連結的 query 參數名稱不同（例如 fontScale \`fs\` → scale \`sc\`），無法辨識的參數會被忽略並回到預設值。\n\n`;
  lm += `## 重複對照（已合併）\n\n| 舊 ID | 舊名稱 | → atlas | atlas 名稱 |\n|---|---|---|---|\n`;
  for (const o of merged) {
    const e = map.get(o.id);
    lm += `| \`${o.id}\` | ${o.zh} ${o.en} | ${e.code} \`${e.id}\` | ${e.nameZh} ${e.nameEn} |\n`;
  }
  lm += `\n## atlas 新增（不在舊文字庫）\n\n${effects.filter((e) => !e.legacyIds.length).map((e) => `${e.code} ${e.nameZh}`).join('、')}\n`;
  lm += `\n## 僅存在於舊文字庫（未併入 atlas，仍可在 kinetic-typography 使用）\n\n${old.filter((o) => !map.has(o.id)).map((o) => `\`${o.id}\` ${o.zh}`).join('、')}\n`;
  writeFileSync('docs/LEGACY_MAPPING.md', lm);
}
console.log(`checklist: ${effects.length} effects, smoke results for ${smoke.length}`);
