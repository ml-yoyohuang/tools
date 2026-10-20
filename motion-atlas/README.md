# MOTION ATLAS 動效圖鑑

可搜尋、可收藏、可調整、可預覽，並能產生 AI 製作 prompt 的動態視覺素材工具。
116 個效果全部以 DOM、SVG、CSS 3D 或 Canvas 2D **即時生成**（沒有影片素材、沒有付費外掛）。

- 線上版（靜態 build）：`motion-atlas/dist/index.html`
- 效果清單與驗收：[EFFECTS_CHECKLIST.md](EFFECTS_CHECKLIST.md)
- 與既有文字庫（`../kinetic-typography`）的重複對照與 migration：[docs/LEGACY_MAPPING.md](docs/LEGACY_MAPPING.md)
- 新增效果的完整規範：[docs/AUTHORING.md](docs/AUTHORING.md)

## 功能

- **列表**：全域搜尋（中文名稱、英文名稱、說明、標籤、效果 ID／編號）、分類膠囊（數量由資料計算）、FAVORITES 收藏篩選、排序（編號／名稱／最近新增）、隨機探索、列表預覽開關、可視區自動播放開關、全站「暫停全部動畫」、深色模式。
- **卡片**：16:9 即時預覽、編號、分類、中英文名稱、一句描述、收藏、可辨認的播放／暫停按鈕（觸控可用）。IntersectionObserver 控制：只有接近可視區才建立播放器，離開即暫停，同時最多 6 張（手機 3 張），hover／focus 優先。
- **詳情（可深連結的 modal，`#/e/<id>`）**：左側舞台、右側參數面板（手機上下堆疊）；上一個／下一個、關閉、focus trap、Esc、焦點回到原卡片，關閉後保留搜尋、篩選與捲動位置。
- **參數**：播放／暫停／重播／循環／速度、16:9／1:1／9:16、強度、尺度、方向、Background／Primary／Secondary／Accent、5 組色彩 presets（POP、COOL、PASTEL、MONO、STREET）、恢復預設、隨機（以 seed 產生，可重現）、自訂多行文字、字體、字距、字重（字體支援時）與每個效果的專屬參數。**只顯示該效果實際使用的控制項。**
- **安全區預覽**：動作安全區、標題安全區、字幕區、中央主體輪廓，可開關、可調透明度；預設不輸出到 PNG。
- **AI 製作 prompt**：依目前設定即時產生兩種版本（獨立實作／整合到既有網站），包含運動機制、文字、4 個色彩 token、比例與建議尺寸、速度／強度／方向／專屬參數、建議 renderer、入場／運動／停留／離場／循環、響應式、reduced motion、資源清理、驗收條件與參數 JSON。剪貼簿不可用時顯示可手動複製的文字框。
- **分享與匯出**：分享連結（只帶與預設不同的值，中文與特殊字元正確編碼）、設定 JSON 匯出／匯入（型別、長度、範圍驗證）、PNG、WebM（Canvas 效果）。

## 安裝與啟動

需求：Node 20+。

```bash
cd motion-atlas
npm install
npm run dev          # http://localhost:5288/
```

## Build

```bash
npm run build        # tsc -b + vite build → ./dist（相對路徑，可放在任何子資料夾）
npm run preview      # http://localhost:5289/
```

`dist/` 會一起提交（與同 repo 的 kinetic-typography 相同做法），讓 repo 的靜態主機可以直接提供 `motion-atlas/dist/`。

## 測試

```bash
npm test                              # 單元測試：設定驗證、URL 來回、隨機可重現、grapheme、prompt 內容
npx playwright install chromium       # 第一次
npm run test:e2e                      # Playwright：搜尋、分類數量、收藏、詳情、調參、分享、prompt、播放、生命週期、減少動態、storage 失敗、匯出、手機
node scripts/smoke.mjs                # 116 個效果：4 個時間點截圖（輸出 2×2 對照圖）、確定性、比例、測試字串、console error
node scripts/checklist.mjs            # 重新產生 EFFECTS_CHECKLIST.md 與 docs/LEGACY_MAPPING.md
```

e2e 與 smoke 會使用執行中的 dev server（5288）。測試掛鉤：`#/…?nofonts=1` 模擬字體載入失敗、`#/…?reduced=1` 模擬減少動態。

## 架構

```
src/
  engine/        共用 runtime
    player.ts      單一全域時鐘（GSAP ticker）驅動所有舞台：play / pause / restart / seek / update / resize / dispose
    types.ts       EffectSpec / EffectDef / EffectContext / EffectRuntime
    settings.ts    預設值、驗證（normalizeSettings）、URL 序列化、可重現隨機
    palette.ts     基本色與 5 組 presets
    text.ts        Intl.Segmenter grapheme 切分（含 fallback）、自動排版與長文字縮放
    canvas.ts dom.ts shapes.ts scenes.ts helpers.ts   繪圖、幾何、A/B 轉場場景、easing、seeded random
  effects/
    registry.ts    import.meta.glob 自動收錄 → 衍生 displayNumber、defaultSettings、parameterSchema、capabilities
    <category>/<code>-<id>.ts   每個效果一個檔案
  components/    ListView、EffectCard、DetailModal、ControlPanel、SafeArea
  state/         store（收藏、路由、偏好）、previewScheduler、prompt、exporter、storage
```

原則：以時間（不是幀數）驅動；暫停後恢復不跳過大量時間（dt 上限 1/15 秒、背景分頁不更新）；所有隨機配置由 `效果 ID + seed` 決定，不在 React render 中隨機；高頻動畫不經過 React state；GSAP timeline 以 `gsap.context` 清理；Canvas pixel ratio 上限 2（卡片 1.5）；卡片與手機以 `ctx.q` 降低粒子／網格／殘影數量。本專案不使用 WebGL／Three.js：需要空間透視的效果（文字走廊、圓柱、滾筒等）用 CSS 3D（`perspective` + `preserve-3d`）或 Canvas 投影完成，因此不會有 WebGL context 數量問題。

## 新增效果

1. 在 `src/effects/<category>/` 新增 `<code>-<id>.ts`，`export default defineEffect({...})`。
2. 填寫 metadata（名稱、描述、標籤、`principle`、`recipe`、`accept`…）、`controls`（只列實際使用的共用控制項）、`params`。
3. `create(ctx)` 回傳 `{ render(t) }`；Canvas 效果用 `canvasRuntime`，GSAP 用 `timelineRuntime`。
4. 執行 `npx tsc -b`、`node scripts/smoke.mjs --ids=<id>`，打開 `test-results/smoke/` 的對照圖確認。

詳細規範見 [docs/AUTHORING.md](docs/AUTHORING.md)。

## 行星逆行單檔範例

獨立檔案：[planet-retrograde.html](planet-retrograde.html)。只需複製這一個檔案，直接用瀏覽器開啟即可；CSS 與 JavaScript 全部內嵌，無需安裝、伺服器或網路連線。這個範例延伸 S02 Orbit Shapes 的 Canvas 軌道技術：左側顯示地球與火星同向公轉及地球視線，右側用同一組位置計算火星相對固定背景恆星的視位置。地球從內側超車時，火星的視黃經暫時減少，逆行段以火星色標出。

- 開啟「手動觀測」並拖動「觀測進度」，可檢查超車前、逆行中、超車後；50% 為衝。
- 把「火星軌道傾角」調到 0°：回環變成水平往返，但逆行仍然存在。
- 支援播放、暫停、速度、比例、POP／COOL／PASTEL／MONO／STREET 預設配色、自訂色彩與 PNG 匯出。

採用圓軌道近似，並非特定日期的星曆；星空圖黃緯放大、背景星為參考點、球體大小不按比例。每 10 秒重播衝前後共 260 日的片段，接點會重設，非無縫公轉循環。
原理參考：[NASA — Retrograde Mars](https://science.nasa.gov/image-article/apod-2010-june-13-retrograde-mars/)。

範例原始碼保存在 `standalone/`，不會出現在動效庫清單。更新後可執行 `node scripts/build-retrograde-html.mjs` 重新產生單檔；`node scripts/check-retrograde-html.mjs` 可驗證離線開啟與互動（需安裝 Playwright 瀏覽器，或以 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定已安裝的 Chrome）。

分享預覽圖為 [planet-retrograde-og.png](planet-retrograde-og.png)（1200×630），並以 data URL 嵌入單檔 HTML 的 Open Graph 與 Twitter 標籤。要讓社群平台讀到預覽圖，需將頁面與 PNG 部署到公開 HTTPS 網址，並在重新產生 HTML 時以 `RETROGRADE_OG_IMAGE_URL` 指定 PNG 的完整 HTTPS 網址；本機 `file://` 頁面無法供社群爬蟲存取。畫面變更時可執行 `node scripts/generate-retrograde-og.mjs` 重新截取預覽圖，再重新產生 HTML。

## 新增 renderer

見 [docs/AUTHORING.md §6](docs/AUTHORING.md)：在 `RendererKind` 新增種類 → `registry.ts` 的 `capabilities()` 決定匯出能力 → `exporter.ts` 加截取策略 → `prompt.ts` 加給 AI 的實作建議。不支援的能力回傳 false，UI 不會顯示按鈕。

## 新增色彩 preset

在 `src/engine/palette.ts` 的 `PRESETS` 新增一筆（必須定義 `background`、`primary`、`secondary`、`accent`），並把 id 加進 `src/engine/types.ts` 的 `PresetId`。面板會自動出現新 preset。

## 匯出限制

| renderer | PNG | 透明 PNG | WebM |
|---|---|---|---|
| Canvas 2D | ✅ 直接複製目前畫面（實際播放中的這一幀） | 效果標記 `transparent` 時：重畫一幀不含背景 | ✅ `canvas.captureStream` + MediaRecorder（瀏覽器支援時，錄一個循環，3–10 秒） |
| SVG | ✅ 序列化目前 SVG 後轉點陣 | 效果標記 `transparent` 時 | — |
| DOM | ⚠️ 實驗性：SVG `foreignObject` 包裝目前 DOM；網頁字體、濾鏡與部分 CSS 可能遺失 | — | — |
| CSS 3D | ❌（foreignObject 無法可靠重現 preserve-3d），不顯示按鈕 | — | — |

- SVG／DOM 轉點陣時瀏覽器不允許載入網頁字體，文字會以系統字體呈現（介面會提示）。
- 安全區輔助線預設不輸出，可在匯出區勾選「PNG 包含安全區輔助線」。
- 影片只提供 WebM，不會以更改副檔名冒充 MP4；不支援的瀏覽器不顯示錄製按鈕。
- SPLIT／WIPE 的 A／B 場景本身就是內容，因此不提供透明背景。

## 授權與字體

程式為本專案原創。字體透過 @fontsource 自架：Noto Sans TC、Noto Serif TC、Oswald、JetBrains Mono（SIL Open Font License）。不使用第三方品牌、logo 或漫畫角色。
