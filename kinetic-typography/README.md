# TYPE / MOTION LAB 文字動態實驗室

把文字變成節奏、情緒與空間。80 個可播放、可調整、可分享的文字動畫範例庫。

所有動態都由 HTML、CSS、SVG、Canvas 或 WebGL 即時產生，沒有影片或靜態圖片。

## 安裝與啟動

需要 Node.js 18 或 20 以上（已在 Node 20.0 測試）。

```bash
cd kinetic-typography
npm install
npm run dev        # http://localhost:5199
```

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 開發伺服器（port 5199） |
| `npm run build` | TypeScript 檢查 + production build，輸出到 `dist/` |
| `npm run preview` | 預覽 build 結果（port 5198） |
| `npm run typecheck` | 只跑型別檢查 |
| `npm run test:e2e` | Playwright 測試（會自動啟動或重用 dev server） |
| `npm run snap -- <id,id> --times 0.5,1.5 --sheet` | 指定效果在固定時間點截圖到 `snapshots/` |

build 使用相對路徑（`base: './'`）與 hash 路由，`dist/` 可以直接放在任何靜態主機的子資料夾。

本 repo 以 GitHub Pages 直接發佈 `main` 分支，因此 `dist/` 有納入版本控制：修改後請執行 `npm run build` 並一併 commit `dist/`。
線上網址：<https://ml-yoyohuang.github.io/tools/kinetic-typography/dist/>

## 功能

* 80 個效果卡片：IntersectionObserver 只在接近視窗時建立舞台，同時播放數有上限（桌面 6、手機 3），離開視窗即暫停／釋放。
* 搜尋（中文、英文、描述、標籤、編號）與分類／難度／技術篩選，收藏（localStorage）。
* 詳情頁（`#/e/<id>`）：大型舞台、16:9 / 1:1 / 9:16、播放／暫停／重播／循環、上一個／下一個、相關效果、原理說明。
* 控制面板：文字、主色、次色、背景、配色組合、字體大小、字距、速度、動作強度，以及每個效果的專屬參數；不適用的控制項會隱藏。
* 分享：網址只記錄與預設不同的設定（`#/e/split-flap?t=你好&c1=%23FF0000&p.spins=3`），讀取時逐欄驗證並限制範圍。
* 設定自動保存在 localStorage；可匯出／匯入 JSON。
* Canvas / WebGL 效果可截取 PNG 與錄製 5 秒 WebM（DOM / SVG 效果不顯示這兩個按鈕）。
* `prefers-reduced-motion`：卡片不自動播放、詳情頁顯示靜態畫面，使用者可主動播放。頁首可切換「自動預覽」。
* 鍵盤：所有控制皆可 Tab 操作；詳情頁 空白鍵 播放／暫停、R 重播、← → 切換效果。

## 目錄結構

```
kinetic-typography/
├─ src/
│  ├─ engine/            共用動畫引擎
│  │  ├─ types.ts        EffectImpl / EffectRuntime / EffectContext / 設定型別
│  │  ├─ player.ts       Player：建立、播放、暫停、seek、resize、dispose，全域 ticker
│  │  ├─ text.ts         Intl.Segmenter 切字、排版（換行、避頭尾、字距、自動縮放）
│  │  ├─ dom.ts          安全建立 DOM（只用 textContent）、逐字 span
│  │  ├─ canvas.ts       舞台 Canvas、字形取樣、點陣、顏色工具
│  │  ├─ helpers.ts      GSAP timelineRuntime、指標／自動路徑、配色
│  │  ├─ settings.ts     預設值、驗證、URL 序列化
│  │  ├─ fonts.ts        字體堆疊與載入等待
│  │  └─ random.ts       seed 亂數、hash noise
│  ├─ effects/
│  │  ├─ catalog.ts      80 個效果的 metadata（名稱、描述、分類、renderer、適用場景、原理）
│  │  ├─ registry.ts     合併 metadata 與實作（import.meta.glob 自動載入）
│  │  └─ impl/eNN-*.ts   每個效果一個檔案
│  ├─ components/        ListView、EffectCard、DetailView、ControlPanel、SnapView、ui
│  ├─ state/             收藏、hash 路由、偏好、localStorage 包裝、卡片播放排程
│  └─ styles/app.css
├─ tests/                Playwright：app.spec.mjs（流程）、effects.spec.mjs（80 個效果）
├─ scripts/snap.mjs      固定時間截圖工具
├─ docs/EFFECT_GUIDE.md  效果撰寫規範
└─ ACCEPTANCE.md         逐項驗收清單
```

## 新增效果

1. 在 `src/effects/catalog.ts` 的清單加入 metadata（id、名稱、描述、分類、難度、renderer、預設文字、適用場景、原理）。
2. 新增 `src/effects/impl/eNN-<id>.ts`，`export default` 一個 `EffectImpl`：

```ts
import { el, glyphSpans } from '../../engine/dom';
import { PALETTE, timelineRuntime } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl } from '../../engine/types';

const impl: EffectImpl = {
  id: 'my-effect',
  defaults: { ...PALETTE.darkLime },
  loopable: true,
  params: [{ key: 'amp', label: '幅度', type: 'range', min: 0, max: 2, step: 0.1, default: 1 }],
  create(ctx) {
    const L = layoutText(ctx, ctx.text);
    const chars = glyphSpans(ctx.root, L, { color: ctx.s.primary }).map((c) => c.el);
    return timelineRuntime(ctx, (tl) => {
      tl.from(chars, { y: -40, opacity: 0, stagger: 0.06, ease: 'back.out(2)' });
      tl.to({}, { duration: 1.5 });
      return { settle: 1.2 };
    });
  },
};
export default impl;
```

3. `npm run snap -- my-effect --sheet` 檢查畫面，`npm run test:e2e` 會自動把新效果納入測試。

完整規範（生命週期、seed、互動、Canvas、Three.js、可存取性）見 [docs/EFFECT_GUIDE.md](docs/EFFECT_GUIDE.md)。

## Renderer 使用策略

| Renderer | 何時使用 | 本專案做法 |
| --- | --- | --- |
| DOM + GSAP | 逐字位移、縮放、遮罩、翻轉等 transform / opacity 動畫 | 暫停的 GSAP timeline，由 Player 以 `totalTime(t)` 驅動；`gsap.context` 清理 |
| DOM（CSS 3D） | 圓柱、方塊、走廊、擠出字等少量 3D 平面 | `preserve-3d` + `perspective`，不佔用 WebGL context |
| SVG | 路徑排字（textPath）、字形描邊、濾鏡（gooey、墨暈）、遮罩 | 每幀改屬性；濾鏡 id 依實例唯一 |
| Canvas 2D | 大量重複元素、粒子、點陣、像素處理 | `stageCanvas` 依 dpr（卡片 ≤1.5、詳情 ≤2）繪製，`ctx.q` 降低數量 |
| WebGL（Three.js） | 真正需要網格變形或深度的效果（文字隧道、文字旗幟） | 只在詳情頁動態 `import('three')`；卡片與無 WebGL 環境使用 Canvas 2D `lite` 版；dispose 時釋放 geometry / material / texture / renderer 並 `forceContextLoss` |

所有效果都是「時間 t 的函數」（或固定步長模擬），因此暫停、速度、重播、seek 與截圖對每種 renderer 行為一致，也讓測試可以用固定時間截圖。

## 字體

自架 Noto Sans TC（可變字重 100–900）、Noto Serif TC、JetBrains Mono，皆為 SIL Open Font License，透過 `@fontsource` 依 unicode-range 分片載入。效果建立前會等待所需字形載入（逾時則使用系統字體 fallback）。
