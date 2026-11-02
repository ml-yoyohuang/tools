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
- `src/main.js`：所有互動邏輯（下一階段會再拆成模組）。開發伺服器上可以用 `window.__puri.eval("…")` 在模組內執行程式，正式版會移除。
