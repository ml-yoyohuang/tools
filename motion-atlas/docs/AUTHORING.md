# 新增效果（Effect authoring guide）

每個效果是一個檔案：`src/effects/<category>/<code>-<id>.ts`，`export default defineEffect({...})`。
`src/effects/registry.ts` 以 `import.meta.glob('./*/*.ts')` 自動收錄，**不需要修改任何共用檔**。
檔名以 `_` 開頭（例如 `src/effects/split/_util.ts`）的檔案不會被當成效果，可放分類內共用工具。

參考實作（請先閱讀）：

| 類型 | 檔案 |
|---|---|
| Canvas 純時間函數 | `src/effects/halftone/h06-halftone-blob.ts`、`src/effects/lines/l04-spirograph.ts` |
| Canvas + 固定步長模擬 + 指標互動 | `src/effects/grid/g02-grid-magnet.ts` |
| SVG | `src/effects/shapes/s03-shape-morph.ts`、`src/effects/comic/c01-comic-burst.ts` |
| DOM + GSAP timeline | `src/effects/minimal/m01-minimal-blocks.ts` |
| DOM 文字逐字 | `src/effects/typography/t10-typewriter.ts` |
| CSS 3D | `src/effects/typography/t03-text-cylinder.ts` |
| A/B 轉場（SPLIT / WIPE） | `src/effects/split/p05-venetian-split.ts`、`src/effects/wipe/w05-wave-wipe.ts` |

## 1. Spec 欄位（`src/engine/types.ts` → `EffectSpec`）

| 欄位 | 說明 |
|---|---|
| `id` | kebab-case 英文，唯一，作為收藏與分享 ID，**之後不可改** |
| `code` | 規格編號，如 `T01`、`H03`、`P12` |
| `nameZh` / `nameEn` | 中英文名稱（依規格） |
| `category` | `typography` `halftone` `grid` `lines` `shapes` `split` `wipe` `comic` `minimal` |
| `sourceType` | `reference`（[R]）、`partial-reference`（[P]）、`original`（[E]） |
| `difficulty` | `beginner` / `intermediate` / `advanced` |
| `renderer` | `canvas`（可 PNG + WebM）、`svg`（PNG）、`dom`（實驗性 PNG）、`css3d`（無 PNG） |
| `description` | 一句效果描述（卡片上顯示） |
| `tags` | 3–6 個中英文標籤（搜尋用） |
| `suitable` | 2–4 個適用場景 |
| `principle` | 技術原理：具體寫出公式／機制，給人與 AI 看 |
| `defaultText` | 預設文字；不用文字的效果填 `''` |
| `palette` + `colors` | 預設色：preset id（`POP` `COOL` `PASTEL` `MONO` `STREET`），可用 `colors` 個別覆寫。顏色請從 `src/engine/palette.ts` 的 `C` 或 preset 取用，不要彩虹漸層 |
| `controls` | 這個效果**真的會讀取**的共用控制項：`text` `font` `weight` `tracking` `intensity` `scale` `direction` `secondary` `accent` `seed`。沒列出的不顯示；**列出的就必須在程式中產生可見影響** |
| `directions` | 有 `direction` 時必填，例如 `['left','right']`、`['up','down']`、`['cw','ccw']`，第一個為預設 |
| `params` | 專屬參數（range / toggle / select / text），只放有實際影響的。可用 `when: { key, value }` 讓參數只在另一參數為某值時顯示 |
| `recipe` | `{ enter, motion, hold, exit, loop }` 入場／運動／停留／離場／循環的具體描述（含 easing、時間） |
| `accept` | 3–5 條**可觀察**驗收條件 |
| `limits` | 已知限制（選填） |
| `loopable` | 有自然結尾、可關閉循環時設 `true`，並在 runtime 回傳 `settle`（停住的時間） |
| `posterTime` | 靜態首幀時間（減少動態／未播放時顯示），選一個主體清楚的時刻 |
| `cycle` | 一個循環秒數（WebM 錄製長度） |
| `maxChars` / `textHint` | 文字上限（預設 40）與提示 |
| `interactive` | 會讀 `ctx.pointer` 時設 `true`（詳情頁才有真指標，卡片用自動路徑） |
| `transparent` | canvas / svg 效果在不畫背景時仍成立 → `true`（支援透明 PNG） |
| `legacyIds` | 對應到舊 kinetic-typography 目錄的 id（見 `docs/LEGACY_MAPPING.md`） |
| `create(ctx)` | 建立並回傳 runtime |

## 2. Runtime 規則（`EffectRuntime`）

```ts
create(ctx) {
  // 1. 依 ctx.width / ctx.height / ctx.s.* / params 建立全部節點或預算資料（一次）
  // 2. 回傳 { render(t, dt) { ... } }
}
```

- **以時間驅動**：`render(t)` 必須是 `t`（已乘上速度的秒數）的函數。播放器處理播放／暫停／重播／速度／seek；**不要**自己開 `requestAnimationFrame`、`setInterval`、`gsap.ticker` 或 CSS animation。
- 需要物理模擬時實作 `step(t, dt)`（固定 1/60s）＋ `reset()`，seek 會從 reset 重播。
- **隨機一律用 `ctx.rand()`**（由效果 id + seed 決定），只在 `create` 中使用，`render` 內不可重新隨機。可用 `hash2(i, j, ctx.seed)`（`src/engine/random.ts`）做穩定雜訊，`noise1/noise2` 做平滑雜訊。
- 釋放：`dispose()` 中移除你加在 window/document 上的 listener；canvas 用 `canvasRuntime` 會自動處理；GSAP 用 `timelineRuntime` 會自動 revert。
- `ctx.root` 已是 `aria-hidden` 的效果層；所有文字以 `textContent` / canvas `fillText` 插入，**絕不 innerHTML**。
- `ctx.q`（0.33–1）：卡片與手機的品質係數，用來縮減粒子、格子、殘影數量。
- 尺寸以 `minSide(ctx)` 計算，讓 16:9、1:1、9:16 都成立；文字用 `layoutText` / `fitSize` 自動縮放，長文字不可溢出舞台。
- 方向：`ctx.dir`（字串）與 `ctx.dirSign`（right/down/cw = +1）。
- 字體：`ctx.family`（使用者選的字體堆疊）、`ctx.weight`；也可指定 `ctx.font.mono / serif / condensed / sans`。
- 色彩：`ctx.s.background / primary / secondary / accent`。canvas 的背景由 `canvasRuntime` 自動繪製（透明 PNG 擷取時會跳過）。
- 減少動態：播放器會自動顯示 `posterTime` 的靜態畫面，效果本身不用處理。

## 3. 常用工具

- `src/engine/helpers.ts`：`canvasRuntime`、`timelineRuntime`、`phase(t, [durations])`（腳本式時間軸）、`clamp lerp smoothstep mod tri`、`ease('back.out(2)')`、`easeInOut easeOut3 easeIn3 easeOutBack easeOutElastic damp`、`num/bool/str(ctx, key, fallback)`、`pointerOrAuto`、`autoPath`、`minSide`、`rgba(hex, a)`、`mix`、`mixHex`、`TAU`。
- `src/engine/text.ts`：`phrases(text)`（以「／」或換行分段）、`graphemes`、`layoutText(ctx, text, opts)`（回傳每個字的位置）、`fitSize`、`textWidth`。
- `src/engine/canvas.ts`：`stageCanvas`、`offscreen`、`drawLayout`、`layoutMask`、`sampleLayout`（從**實際字形 alpha** 取樣點）、`textMatrix`。
- `src/engine/dom.ts`：`el`、`svgEl`、`stageSvg`、`glyphSpans`、`textBlock`、`layer`。
- `src/engine/shapes.ts`：`regularPoly`、`starPts`、`resample`、`alignStart`、`lerpPts`、`fillPts`、`roundRectPath`。
- `src/engine/scenes.ts`（SPLIT / WIPE）：`makeScenes(ctx)` 產生 A、B 兩個場景離屏畫布；`transition(ctx, t, easing?)` 回傳 `{from, to, p, e, moving}`；`TRANSITION_PARAMS`（轉場時間、停留、手動進度）。

## 4. 品質要求

- 每個效果的主要機制一眼可辨，**不可**用相同動畫換名稱或顏色冒充。
- 文字效果要有閱讀停留；連續背景效果要流暢循環；物理效果要有衰減。
- 不是每個效果都用同一種 easing，也不要到處加 blur / glow / 陰影。
- 拖尾不能一直遮住主體；轉場要同時看見 A 與 B；避免高頻高對比閃爍（> 3Hz 全畫面閃爍禁止）。
- 自訂顏色、文字（中文、英文、emoji、空字串、長字串、多行）後仍合理。
- `params` 的極端值也要能正常顯示。

## 5. 驗證

```bash
npm run dev                                  # 5288
npx tsc -b --pretty false                    # 型別
node scripts/smoke.mjs --cat=<category>      # 每個效果：4 個時間點截圖、確定性、比例、測試字串、console error
```

smoke 會在 `test-results/smoke/<CODE>-<id>.png` 輸出 2×2 對照圖，請實際打開看動態是否符合規格。

## 6. 新增 renderer

renderer 種類定義在 `src/engine/types.ts` 的 `RendererKind`。新增時：
1. 在 `RendererKind` 加入名稱，並在 `src/effects/categories.ts` 的 `RENDERER_LABEL` 補標籤。
2. 在 `src/effects/registry.ts` 的 `capabilities()` 決定 PNG／透明／WebM 能力。
3. 在 `src/state/exporter.ts` 的 `capturePNG` 加入對應的截取策略；不支援就回傳 `png: false`，UI 會自動隱藏按鈕。
4. 在 `src/state/prompt.ts` 的 `RENDERER_HINT` 寫給 AI 的實作建議。

## 7. 新增色彩 preset

在 `src/engine/palette.ts` 的 `PRESETS` 加一筆（必須包含 background / primary / secondary / accent），並把 id 加入 `types.ts` 的 `PresetId`。
