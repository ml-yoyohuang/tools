# 效果撰寫指南 Effect authoring guide

每個效果 = `src/effects/catalog.ts` 的一筆 metadata（名稱、描述、分類、renderer…）
＋ `src/effects/impl/eNN-<id>.ts` 的實作（default export 一個 `EffectImpl`）。
`registry.ts` 以 `import.meta.glob` 自動載入 `impl/e*.ts`，不需要手動註冊。

## 1. 生命週期（由 `engine/player.ts` 統一管理）

```
create(ctx) → EffectRuntime { render(t, dt), step?, reset?, settle?, dispose?, canvas? }
```

* **不要**自己開 `requestAnimationFrame`、`setInterval`、或會自行播放的 GSAP tween。
  Player 用一個全域 ticker 呼叫 `render(t, dt)`；`t` 是已乘上速度的「效果時間（秒）」。
  暫停、速度、重播、seek、截圖全部靠這個機制，所以畫面必須是 **t 的函數**。
* `render(t, 0)` 會在 seek 時被呼叫（dt = 0）。
* 需要物理狀態的效果（彈簧、碰撞）實作 `step(t, dt)`（固定步長 1/60）＋ `reset()`；
  `render` 只負責把狀態畫出來。seek 時 Player 會 `reset()` 後重播 `step`。
* `settle`：入場型效果在「循環關閉」時停住的時間點（閱讀停留畫面）。設定 `loopable: true` 才會顯示循環開關。
* `dispose()`：移除監聽器、釋放 Three.js 資源等。`ctx.root` 內的 DOM 會由 Player 自動移除。
* 設定改變（文字、顏色、參數、尺寸、比例）時 Player 會 dispose 並重新 create；速度與循環則即時套用。

### GSAP

用 `timelineRuntime(ctx, (tl) => { ... })`（`engine/helpers.ts`）。它建立 **paused** 的 timeline，
並在 `gsap.context` 中執行，dispose 時自動 revert。timeline 預設 `repeat: -1`。
build 函數可以回傳 `{ settle, render, dispose }`。

### Context 重點

| 欄位 | 說明 |
| --- | --- |
| `ctx.root` | 效果自己的圖層（aria-hidden），已清空、填滿舞台 |
| `ctx.ui` | 可存取的覆蓋層，放效果專屬按鈕 / 檔案選擇 / 可捲動區（子元素有 pointer-events） |
| `ctx.width/height` | 舞台 CSS px（16:9、1:1、9:16 都要能看） |
| `ctx.text` | 已清理、非空的文字（可能含 `／` 或換行） |
| `ctx.s` | 設定：`primary` `secondary` `background` `fontScale` `tracking`(em) `intensity`(0–2) `params` |
| `ctx.mode` | `'card'`（小預覽）或 `'detail'` |
| `ctx.q` | 品質係數 0.3–1：粒子數、網格數、殘影數要乘上它 |
| `ctx.rand` / `ctx.seed` | 穩定 seed 的亂數；或用 `hash2(i, j, ctx.seed)`（`engine/random.ts`）讓結果只取決於索引 |
| `ctx.pointer` | 互動效果用；配合 `pointerOrAuto(ctx, t, autoFn)`，閒置與卡片模式會自動示範 |
| `ctx.font.sans/serif/mono` | 字體堆疊字串（Noto Sans TC Variable、Noto Serif TC Variable、JetBrains Mono） |
| `ctx.dpr` | 已限制的 devicePixelRatio（Canvas 用 `stageCanvas(ctx)` 會自動處理） |

## 2. 文字

* `layoutText(ctx, text, opts)`（`engine/text.ts`）：量測、換行（含中文避頭尾）、`／` 換行、字距、`fontScale`，
  保證不超出 `maxWidth × maxHeight`。回傳每個字的 `cx, cy, x, y, w`、`fontSize`、`font` 字串。
* `phrases(text)`：依 `／`、`/`、換行切成多個詞；`graphemes(str)`：用 `Intl.Segmenter` 切字（emoji 不會壞）。
* `glyphSpans(parent, layout)`：每字一個絕對定位 span（已用 GSAP 設 xPercent/yPercent −50）。
  若自己寫 `style.transform`，開頭要加 `translate(-50%,-50%)`。
* `textBlock(parent, layout)`：整段文字（多行）一個 div。
* **文字只用 textContent 插入**（`el()` helper 已處理），不要用 innerHTML。
* 長文字：靠 `layoutText` 自動縮放；需要固定格數的效果自行限制（`maxChars`）。

## 3. Canvas

* `stageCanvas(ctx)` → `{ canvas, g, clear(fill) }`，以 CSS px 繪圖。
* `sampleLayout(ctx, layout, step, max)`：從字形取樣點（粒子、點陣、磁吸）。
* `textMatrix(text, rows, family)`：N 列高的布林點陣。
* `drawLayout(g, layout, { fill, stroke })`：逐字畫出排版。
* Canvas 效果請回傳 `canvas`，詳情頁會自動提供 PNG 截圖與 WebM 錄製。

## 4. 規則

1. 每個效果的視覺邏輯必須符合 catalog 描述，且與相似效果有明確差異（描述中有寫的差異一定要做到）。
2. 不同效果使用不同 easing／節奏；入場效果要有閱讀停留時間；循環效果要無縫。
3. 物理效果要有阻尼，不可無限震盪。
4. 每個預覽主要 2～3 色：`primary`（主字）、`secondary`（強調）、`background`。用 `defaults: { ...PALETTE.xxx }` 選預設配色。
5. 不適用的共用控制項放進 `hide`（`'text' | 'secondary' | 'fontScale' | 'tracking' | 'intensity'`）。效果專屬參數用 `params`。
6. 閃爍效果不可全屏高亮閃爍；提供低刺激選項。
7. 不要在 render 中建立大量 DOM；在 create 中建好，render 只改 transform / opacity / textContent。
8. 3D：CSS 3D 優先；Three.js 只在 `create` 中 `await import('three')`，並提供 `lite`（卡片與無 WebGL 時使用）＋ `requiresWebGL: true`。
9. 每個效果檔案自給自足，不要修改 `engine/` 共用檔（需要時先在自己的檔案內寫小 helper）。

## 5. 驗證

```
npm run dev                       # http://localhost:5199
npx tsc --noEmit -p .             # 型別檢查
node scripts/snap.mjs <id,id> --times 0.3,1,2.5 --sheet     # 固定時間截圖 → snapshots/
node scripts/snap.mjs <id> --query "t=TYPE%20MOTION%202026" --sheet --size 360x640
```

`#/snap/<id>?at=秒數&w=寬&h=高&mode=card|detail&<設定>` 是測試專用路由。
