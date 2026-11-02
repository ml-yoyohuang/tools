# PURI CLUB 2000

平成風拍貼機網站。原始碼在 `src/`，`npm run build` 會產出這個資料夾裡的 `index.html`（JS、CSS 都內嵌），部署網址是 `/tools/puri-club/`。圖片放在 `assets/`，執行時用相對路徑讀取，不會被打包。

```bash
nvm use          # Node 24（.nvmrc）
npm install
npm run dev      # 開發伺服器，改 CSS 會即時更新
npm run build    # 產出 index.html，和原始碼一起 commit
npm run format   # 用 Prettier 排版 src/
```

- `src/index.html`：頁面結構與 meta 標籤。
- `src/styles/`：依畫面拆開的 CSS，由 `index.css` 依序匯入，後面的檔案會覆蓋前面的設定。
- `src/main.js`：入口，依序呼叫各模組的 `init…()` 綁定事件，再啟動計時器和相機預覽。
- `src/state.js`：共用狀態 `state`（目前畫面、機台、照片、裝飾、計時……），以及秒數設定和 DOM 參照。跨模組會改到的變數都放這裡。
- `src/data/`：純資料：`themes.js`（三台機台）、`stamps.js`（印章清單）、`magic-sets.js`（一鍵魔法套組）。
- 功能模組：
  - `util.js`：DOM 與 canvas 小工具、SVG 圖示
  - `lobby.js`：大廳與進入機台
  - `app.js`：切換畫面、照片方向、機台主題、再玩一次
  - `camera.js`：開始畫面、相機、拍攝倒數
  - `photo.js`：復古／柔亮照片處理
  - `review.js`：檢查重拍、匯入照片
  - `editor.js`：裝飾頁、印章、筆刷、復原、快捷鍵
  - `adjust.js`：調整工具（移動、縮放、旋轉印章）
  - `stamps.js`、`decorations.js`：印章圖片與塗鴉繪製
  - `magic.js`：一鍵魔法與 `?magic-dev`
  - `sheet.js`：相紙版型、貼紙形狀、底紙
  - `film.js`：膜的圖樣
  - `print.js`：選版型、印刷過場、完成頁（上膜、傾斜、存圖、分享）
- 開發伺服器上，`window.__puri` 會帶著所有模組的匯出和 `state`，方便在主控台檢查；正式版會移除。
