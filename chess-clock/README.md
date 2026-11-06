# 棋鐘 Chess Clock

Vue 3 + PWA 的雙人面對面棋鐘，重製自 `_incoming_files/` 中的 CodePen Vue 2 / Pug / Stylus 原始碼。

直接以靜態伺服器開啟 `index.html` 即可使用；第一次載入需要取得 Vue 3 CDN，之後 service worker 會快取 app shell。

計時以瀏覽器的 `performance.now()` 單調高解析度時鐘計算，畫面更新頻率不參與倒數；因此掉幀、切換背景分頁、暫停與恢復都不會累積 JavaScript interval 漂移。瀏覽器完全被系統凍結期間無法執行程式，頁面恢復時會依實際經過時間補正，這是純前端瀏覽器的限制。
