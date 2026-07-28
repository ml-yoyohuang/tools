# 專案交接文件 — DevToolbox（純前端工具集）

## 專案是什麼

這是一個**個人用純前端工具集合**，部署在 GitHub Pages（`ml-yoyohuang.github.io/tools/`）。使用者是一位前端工程師，把工作上常用、但以前要上網找別人做的小工具，通通自己刻一份放這裡當「隨手工具箱」使用。

**入口是 [index.html](../index.html)**，一個工具目錄頁，用卡片 grid + 搜尋 + 分類篩選導向各個獨立頁面。

## ⚠️ 最重要的地雷：這不是單一技術棧的專案

repo 裡混了三種完全不同性質的內容，**先分清楚，不要用同一套邏輯處理**：

1. **絕大多數檔案**：單一 `.html` 檔案，內嵌 `<style>` + `<script>`，**沒有 build step，沒有 npm，直接改完存檔就是成品**，例如 `bpm.html`、`clock.html`、`json-ld-gen.html`。改這類檔案時，Edit 完直接就是部署狀態，不需要任何編譯動作。
2. **`/jlpt` 資料夾**：這是**完全獨立的 Vite + TypeScript 專案**，有自己的 `package.json`、`node_modules`、`src/`、`vite.config.ts`。**這個資料夾要用 npm/vite 的方式維護，不能套用其他 html 檔案的「直接改存檔」邏輯**。如果被交派任務時看到 `jlpt/` 相關需求，先當成獨立子專案處理，不要跟外層混在一起想。
3. **`/doc` 資料夾**：純筆記/規劃文件（例如 `clock-app-prompt.md` 是拿去給另一個 AI agent 寫 iOS App 用的完整需求書），不是網站內容，不會被部署。

## 目錄結構速覽

```
index.html              ← 工具目錄首頁（入口）
ura.html                ← 隱藏頁面「非工作用工具」，首頁最下面一個 🍄 連結進去
bpm.html, clock.html... ← 各獨立工具頁，全部同層放，無子目錄
jlpt/                   ← 獨立 Vite/TS 專案，日文檢定相關，不要跟其他 html 混著改
doc/                    ← 規劃筆記，非網站內容
sw-clock.js, sw-pikmin.js ← 對應 clock.html / pikmin_timer.html 的 Service Worker
*.svg, *-manifest.json  ← PWA 用的圖示與 manifest，只有 clock.html、pikmin_timer.html 有做 PWA
```

## 首頁（index.html）的運作邏輯

- 卡片用 `data-cat` 屬性分類（`refactor` / `converter` / `generator` / `svg` / `design-ops` / `image`），篩選用 JS 比對這個屬性 + 搜尋文字（AND 邏輯）
- **卡片排列位置是使用者手動排的**，之前明確要求過「新增分類篩選功能時完全不要動卡片位置」——之後如果要重新排版分類，記得先問過使用者，不要自己覺得「這樣分類比較合理」就重排
- 最下面有一個不起眼的 🍄 連結（`.ura-tail`），通向 `ura.html`，裡面放的是使用者自己私人用、不想公開在首頁展示的工具（節奏練習器、抽獎系統、家庭計算機等）

## ⚠️ 已知的壞掉連結

`ura.html` 裡有一個連到 `stock4.html` 的連結，但這個檔案**不存在於 repo 裡**。不確定是使用者忘記建立、還是本機開發中還沒 commit。如果被交派任務時剛好經過這裡，可以順便跟使用者確認一下這個連結的狀態，但不要自己嘗試「猜測著補一個 stock4.html 出來」。

## 各工具頁共用的程式碼慣例（很重要，仿造這些寫新工具）

1. **返回首頁連結**：幾乎每個工具頁最上方都有 `<a href="index.html" class="nav-back">← 返回首頁</a>`，樣式在各檔案內各自定義但視覺一致（淺色系工具用靛藍色連結、深色系工具如 clock.html/bpm.html 用灰階）。新增工具頁記得加這個。

2. **複製到剪貼簿的 fallback pattern**：這個 repo 很多工具是用 `file://` 本機開啟測試，`navigator.clipboard` 在非安全上下文會靜默失敗。所有複製功能都要用這個 pattern（已經在 base64.html、json-ld-gen.html、ticket-practice.html 重複出現過，是標準寫法）：
   ```js
   function fallbackCopy(text, onCopied) {
       const ta = document.createElement('textarea')
       ta.value = text
       ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
       document.body.appendChild(ta)
       ta.focus(); ta.select()
       try { document.execCommand('copy'); onCopied() } catch (_) {}
       document.body.removeChild(ta)
   }
   // 呼叫時：
   if (navigator.clipboard && window.isSecureContext) {
       navigator.clipboard.writeText(text).then(onCopied).catch(() => fallbackCopy(text, onCopied))
   } else {
       fallbackCopy(text, onCopied)
   }
   ```
   看到「複製按鈕沒反應」的 bug report，先檢查這個 pattern 有沒有漏做。

3. **iOS Safari 的 `100vh` 陷阱**：全螢幕沉浸式工具（clock.html、bpm.html）都踩過這個坑——iOS Safari 的 `100vh` 是以工具列收起時的最大高度計算，跟實際可視區域有落差，搭配 `overflow:hidden` + 垂直置中會裁切掉部分內容。修法是雙寫：
   ```css
   height: 100vh;   /* 舊瀏覽器 fallback */
   height: 100dvh;  /* 支援的瀏覽器覆蓋上面這行 */
   ```
   還會搭配 `env(safe-area-inset-top/bottom)` 處理瀏海與 Home Indicator。新的沉浸式全螢幕工具都應該比照辦理。

4. **PWA 只做在 clock.html 和 pikmin_timer.html**：不是每個工具都要做離線支援，只有使用者明確説要「可以離線用、加到主畫面」的才做。Service Worker 快取策略是 cache-first，版本號用 `CACHE = 'xxx-v1'` 這種命名，**改動 Service Worker 快取邏輯時記得同步升版本號**（`v1` → `v2`），否則使用者裝置上的舊 SW 不會更新。

5. **深色系工具 vs 淺色系工具是兩套視覺語言**：`clock.html`、`bpm.html`、`ticket-practice.html` 這類「全螢幕沉浸式、單一功能」工具走深色主題（`#0f172a` / `#080808` 背景 + 螢光色強調）；其他大多數「表單型」工具（json-ld-gen.html、base64.html、wcag-contrast.html）走淺色卡片式版面（`#f8fafc` 背景 + 靛藍 `#4f46e5` 主色）。新增工具先判斷屬於哪一類，套用對應的視覺語言，不要混搭。

## bpm.html 特別筆記（目前功能最複雜的工具之一）

- `registerBeat(timestamp)` 是 TAP 敲擊和麥克風偵測共用的核心邏輯（算 BPM、觸發視覺回饋），未來如果要延伸節奏遊戲或其他偵測拍子的功能，應該延用這個函式，不要重新寫一套
- 麥克風偵測是陽春版 onset detection（RMS 能量 + 動態閾值 + 250ms refractory period），**不是** FFT 精準節拍分析，準確度有限，這是刻意的取捨（純前端、不用函式庫）
- 手機瀏覽器（尤其 iOS）麥克風權限有兩層：作業系統層級（設定 → App → 麥克風）+ 網頁層級（`getUserMedia` 的 prompt）。使用者遇過「Safari 有跳出權限詢問，Chrome 沒有」的狀況，根源是 iOS 系統層級的 App 權限沒開，不是程式碼問題——遇到類似 bug report 先請使用者檢查系統設定，不要急著改程式碼
- `.bpm-display` 曾經因為寫死 `height` 導致 RWD 間距跑掉，使用者自己抓出問題並拿掉了固定高度改成自然撐開——**這類固定寫死尺寸、又要跨裝置置中的排版，是這個 repo 最常見的踩雷模式**，之後遇到「手機上間距怪怪的」，優先懷疑是不是有寫死 height/width 卡住彈性排版

## json-ld-gen.html 特別筆記

- 裡面有一個「❓ 使用說明」按鈕會彈出 Modal，說明每種 schema 類型適合什麼情境。**這份說明內容有經過 Google 官方文件查證**（用 deep-research 工具查證過 Google Search Central 支援清單），所以像 `RealEstateListing`、`Car/Vehicle`、`Park`、`TouristAttraction`、`SportsActivityLocation` 這些類型故意沒有做，是因為**確認過 Google 不支援或已棄用**，不是漏做，不要自己覺得「應該要補上」就加。
- repo 裡還有一個 `json-ld.html`（沒有 `-gen`），是完全不同、看起來是舊版或另一份文件性質的頁面，**沒有被 index.html 連結，也跟 json-ld-gen.html 無關**，容易被檔名搞混，改東西前務必看清楚是哪一個檔案。

## 使用者的特殊用語 / 溝通習慣

- **「隱藏工具」**：指故意不放在 index.html 首頁卡片、但檔案存在、可以直接用網址開啟的頁面（ticket-practice.html、bpm.html 等）。這些通常會連結在 `ura.html`。
- 使用者說「這個間距在手機上看不到」時，**先懷疑是 CSS 寫死高度或 `100vh` 造成的裁切問題**，這是本 repo 最常見的一類 bug，不要一開始就假設是瀏覽器快取或程式邏輯錯誤（雖然快取問題也發生過，但寫死尺寸的頻率更高）。
- 溝通語言是台灣正體中文，技術名詞習慣中英夾雜（例如「RWD」「PWA」「pull」這些直接用英文，其餘用中文）。
- 使用者會自己動手改 CSS/JS 小地方（不是完全不會寫程式），交接時不用把他當純小白，可以講技術原因，但解釋要淺顯，他自己抓過至少一次 bug 根因（`.bpm-display` 高度問題）。

## 部署方式

- Git repo，`main` branch，推上去 GitHub Pages 會自動部署到 `https://ml-yoyohuang.github.io/tools/`
- 沒有 CI、沒有 build step（`jlpt/` 子專案除外），**commit 即部署**，改完 `.html` 檔案 push 上去幾分鐘內就會反映在正式站
- 目前 commit message 習慣：`feat: xxx.`、`fix: xxx.`，中文為主、簡短、句尾常加句號
