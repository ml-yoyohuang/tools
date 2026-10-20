# EFFECTS_CHECKLIST

自動產生：`node scripts/checklist.mjs`（資料來源：執行中的 registry + `scripts/smoke.mjs` 的結果）。

- 效果總數：**120**（目前圖鑑）
- 驗收欄：smoke = 4 個時間點畫面不同（確有時間變化）、seek 可重現、16:9／1:1／9:16、測試字串（「動效圖鑑」「MOTION PLAY」「你好！Hello 🙂」、空字串、長字串＋多行）無錯誤、無 console error。
- 目視：120 張 smoke 對照圖（每個效果 4 個時間點）已依分類拼圖人工檢視過，確認主要機制可辨、16:9 無溢出；這是抽樣幀檢查，不是逐幀的完整動畫審查。
- 已知：C01、M01 的 seek 以截圖雜湊比對時偶有差異（SVG 文字反鋸齒／版面量測時機），以 DOM 狀態比對則完全一致。
- 所有效果皆支援：播放、暫停、重播、速度、背景／主色、色彩 presets、恢復預設、隨機（可重現）、16:9／1:1／9:16、分享連結、AI prompt、JSON 匯入匯出。


## TYPOGRAPHY（24）

| ID | 名稱 | renderer | 來源 | 狀態 | 支援控制項（共用＋專屬） | 匯出 | 驗收 | 已知限制 |
|---|---|---|---|---|---|---|---|---|
| T01 `zoom-through` | 穿越放大 Text Zoom Through | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、Secondary、Accent、seed、放大幅度、停留時間、穿越秒數、速度線 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T02 `text-corridor` | 文字走廊 Text Corridor | CSS 3D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、Secondary、Accent、透視深度、走廊節數、每節停頓、鏡頭晃動 | 無 PNG | ✅ smoke（4/4 幀不同） | CSS 3D：不支援 PNG / WebM 匯出；極舊瀏覽器若不支援 preserve-3d 會變平面。 |
| T03 `text-cylinder` | 文字圓柱 Text Cylinder | CSS 3D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、方向、Secondary、Accent、層數、每層卡片數、相鄰層反向旋轉、俯仰角 | 無 PNG | ✅ smoke（4/4 幀不同） | 使用 CSS 3D，不支援 PNG 截取；極舊瀏覽器若不支援 preserve-3d 會變平面。 |
| T04 `text-flag` | 文字旗幟 Text Flag | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、方向、Secondary、Accent、振幅、風速、文字密度（列）、旗桿 | PNG、WebM | ✅ smoke（4/4 幀不同） | 以 2D 切條近似 3D 布料，沒有真正的自我遮擋；極大振幅時條與條之間可能出現細縫。 |
| T05 `text-echo` | 文字回聲 Text Echo | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、方向、Secondary、Accent、副本數量、延遲間隔、縮小幅度、停留時間 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T06 `text-vortex` | 文字漩渦 Text Vortex | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、方向、Secondary、Accent、seed、旋轉圈數、收縮程度、殘影層數、碎片數量、循環秒數 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T07 `text-spiral` | 文字螺旋 Text Spiral | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、方向、Secondary、Accent、圈距、中心字級、閱讀停頓、每拍秒數 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T08 `word-burst` | 單字爆發 Word Burst | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、Secondary、Accent、seed、周邊小詞數、飛散距離、放射線數、停留秒數 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T09 `flip-cards` | 翻字卡 Flip Cards | CSS 3D | [R] 參考重建 | 已實作 | 文字、字體、字重、強度、尺度、方向、Secondary、Accent、翻轉軸、停留秒數、波動間隔、翻起高度 | 無 PNG | ✅ smoke（3/4 幀不同） | CSS 3D：不支援 PNG / WebM 匯出。 |
| T10 `typewriter` | 打字機 Typewriter | DOM | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、尺度、Secondary、seed、輸入速度（字／秒）、刪除速度（字／秒）、停留時間、游標樣式 | PNG（實驗性 DOM） | ✅ smoke（4/4 幀不同） | DOM renderer：PNG 以 SVG foreignObject 實驗性截取，網頁字體可能以系統字替代。 |
| T11 `slot-text` | 拉霸文字 Slot Text | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、強度、尺度、Secondary、Accent、seed、轉動秒數、依序停止間隔、停留秒數、動態模糊 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T12 `word-surge-grid` | 文字波浪網格 Word Surge Grid | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、方向、Secondary、Accent、列數、每列字數、傳播速度、波間隔、波的作用、顯示波前線 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T13 `diagonal-bands` | 斜向文字帶 Diagonal Text Bands | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、方向、Secondary、色帶數、傾斜角度、色帶間距 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T14 `text-ribbon` | 文字緞帶 Text Ribbon | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、方向、Secondary、Accent、緞帶數、起伏幅度、波長、文字流速、顯示緞帶底色 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T15 `text-fan` | 文字扇形 Text Fan | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、方向、Secondary、Accent、扇骨數、展開角度、展開節奏（每片間隔）、展開停留 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T16 `letter-sequence` | 逐字重擊 Letter Sequence | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、Secondary、Accent、節拍間隔、入場放大倍率、壓扁程度、停留秒數 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T17 `word-drum` | 文字滾筒 Word Drum | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、方向、Secondary、Accent、滾筒面數、停留時間、翻轉時間、透視距離 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T18 `quote-card` | 引言卡 Quote Card | Canvas 2D | [R] 參考重建 | 已實作 | 字體、字重、字距、尺度、Secondary、Accent、引言（quote）、署名（author）、對齊、行間隔、停留時間 | PNG、透明 PNG、WebM | ✅ smoke（3/4 幀不同） | — |
| T19 `lower-third` | 下三分之一字幕 Lower Third | Canvas 2D | [R] 參考重建 | 已實作 | 字體、字重、字距、尺度、Secondary、Accent、姓名、職稱、位置、安全邊距、停留時間、顯示安全框 | PNG、透明 PNG、WebM | ✅ smoke（3/4 幀不同） | — |
| T20 `hashtag-cloud` | 標籤雲 Hashtag Cloud | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、Secondary、Accent、seed、標籤數量、字卡比例、漂浮幅度、大小差異 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T21 `karaoke-text` | 卡拉 OK 文字 Karaoke Text | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、Secondary、Accent、節拍速度、節奏型、高亮方式、跳躍小球 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T22 `letter-orbit` | 字元軌道 Letter Orbit | Canvas 2D | [R] 參考重建 | 已實作 | 文字、字體、字重、字距、強度、尺度、方向、Secondary、Accent、繞行時間、返回間隔、停留時間、軌道半徑 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T23 `glyph-dot-assemble` | 字形點陣重組 Glyph Dot Assemble | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、強度、尺度、Accent、seed、粒子密度、聚集速度、漂移量、停留時間 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| T24 `editorial-title` | 編輯式標題 Editorial Title | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、字距、尺度、Secondary、Accent、編號、眉標、副標、分段節奏、停留時間 | PNG、透明 PNG、WebM | ✅ smoke（3/4 幀不同） | — |

## HALFTONE（12）

| ID | 名稱 | renderer | 來源 | 狀態 | 支援控制項（共用＋專屬） | 匯出 | 驗收 | 已知限制 |
|---|---|---|---|---|---|---|---|---|
| H01 `halftone-sweep` | 半色調掃掠 Halftone Sweep | Canvas 2D | [P] 部分參考 | 已實作 | 方向、強度、Secondary、點距、影響寬度、餘暉、單次掃描時間 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| H02 `dot-matrix` | 點矩陣 Dot Matrix | Canvas 2D | [P] 部分參考 | 已實作 | 強度、Secondary、seed、點距、區塊大小（點）、圖樣 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| H03 `spiral-dots` | 螺旋圓點 Spiral Dots | Canvas 2D | [R] 參考重建 | 已實作 | 方向、強度、尺度、Secondary、圈數、點尺寸、螺旋臂數、流入速度 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| H04 `dot-rain` | 點雨 Dot Rain | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、Secondary、Accent、seed、雨滴數量、落下速度、落點高度、落點景深分布、波紋大小、雨滴混入強調色 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| H05 `halftone-rings` | 半色調圓環 Halftone Rings | Canvas 2D | [R] 參考重建 | 已實作 | 強度、尺度、Secondary、Accent、圓環數、脈衝週期、圈間延遲、傳遞方向 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| H06 `halftone-blob` | 半色調液團 Halftone Blob | Canvas 2D | [R] 參考重建 | 已實作 | 強度、尺度、Secondary、seed、網點間距、液團數量、邊緣柔和度、外圍網點大小 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| H07 `dot-gradient` | 點陣漸層 Dot Gradient | Canvas 2D | [E] 延伸設計 | 已實作 | 方向、強度、頻率（漸層週期數）、最小點、最大點、網點間距、網屏角度、漸層形狀 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| H08 `dot-exposure` | 點陣曝光 Dot Exposure | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、尺度、Secondary、seed、網點解析度（每字高點數）、遮罩來源、背景雜點 | PNG、透明 PNG、WebM | ✅ smoke（3/4 幀不同） | — |
| H09 `ripple-dots` | 波紋點場 Ripple Dots | Canvas 2D | [E] 延伸設計 | 已實作 | 強度、Secondary、seed、點距、同時波源上限、波速、自動觸發間隔、自動觸發 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| H10 `parallax-dots` | 點陣視差 Parallax Dots | Canvas 2D | [E] 延伸設計 | 已實作 | 強度、尺度、Secondary、Accent、seed、層數、視差強度、自動漂移速度 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| H11 `print-misregister` | 印刷套色偏移 Print Misregister | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、尺度、Secondary、Accent、seed、色版數、最大錯位、網點間距 | PNG、透明 PNG、WebM | ✅ smoke（3/4 幀不同） | — |
| H12 `dot-flip` | 點陣翻面 Dot Flip | Canvas 2D | [E] 延伸設計 | 已實作 | 方向、強度、Secondary、seed、圓片間距、波形、波的跨度、翻面間隔 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |

## GRID（12）

| ID | 名稱 | renderer | 來源 | 狀態 | 支援控制項（共用＋專屬） | 匯出 | 驗收 | 已知限制 |
|---|---|---|---|---|---|---|---|---|
| G01 `isometric-grid` | 等角網格 Isometric Grid | Canvas 2D | [R] 參考重建 | 已實作 | 強度、尺度、Secondary、Accent、seed、網格大小、每格移動時間、移動方式、浮起立方體數、全畫面線網 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| G02 `grid-magnet` | 磁力網格 Grid Magnet | Canvas 2D | [R] 參考重建 | 已實作 | 強度、Secondary、seed、網格尺寸（列數）、影響半徑、線寬、磁力模式 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| G03 `grid-fill` | 網格填滿 Grid Fill | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、方向、Secondary、Accent、seed、填入順序、填入間隔、格子大小、格距 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| G04 `hex-grid` | 六角網格 Hex Grid | Canvas 2D | [R] 參考重建 | 已實作 | 強度、尺度、Secondary、Accent、seed、六角大小、傳播速度、波尾長度、脈衝間隔、傳播內容 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| G05 `weave-grid` | 編織網格 Weave Grid | Canvas 2D | [R] 參考重建 | 已實作 | 強度、尺度、Secondary、seed、編織規則、帶距、帶寬比例、穿梭時間 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| G06 `tilt-grid` | 傾斜網格 Tilt Grid | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、強度、Accent、seed、最大傾角、透視強度、格線數、點亮節點數 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| G07 `checker-flip` | 棋盤翻轉 Checker Flip | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、強度、Secondary、翻轉順序、奇偶相位差、單格翻轉時間、行列間隔、格子大小 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| G08 `grid-lens` | 網格透鏡 Grid Lens | Canvas 2D | [E] 延伸設計 | 已實作 | 強度、尺度、Secondary、seed、透鏡半徑、透鏡類型、格距、透鏡數量 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| G09 `grid-breathing` | 網格呼吸 Grid Breathing | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、Secondary、Accent、基準格距、呼吸深度、外圈延遲、呼吸週期、交點圓點 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| G10 `grid-break` | 網格瓦解 Grid Break | Canvas 2D | [E] 延伸設計 | 已實作 | 強度、尺度、Secondary、Accent、seed、瓦解順序、散開距離、批次數、批次間隔、格子大小 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| G11 `pixel-skyline` | 像素城市 Pixel Skyline | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、Secondary、Accent、seed、像素格大小、最高樓層、升起順序、後排建築、窗戶亮燈 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| G12 `grid-wave-surface` | 波浪表面 Grid Wave Surface | Canvas 2D | [E] 延伸設計 | 已實作 | 強度、尺度、Secondary、seed、網格解析度、起伏高度、波長密度、俯視角、表現方式 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | ctx.q < 0.7（卡片 / 手機）時解析度約減半並省略格線描邊。 |

## LINES（12）

| ID | 名稱 | renderer | 來源 | 狀態 | 支援控制項（共用＋專屬） | 匯出 | 驗收 | 已知限制 |
|---|---|---|---|---|---|---|---|---|
| L01 `sound-wave` | 聲波 Sound Wave | Canvas 2D | [R] 參考重建 | 已實作 | 強度、尺度、Secondary、Accent、seed、訊號模式、線條數量、節拍 BPM、線條粗細、上下對稱、峰值帽、顯示「模擬訊號」標記 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | 目前只有模擬訊號模式：高度由時間與 seed 計算，不分析真實音訊。；未實作本機音檔／麥克風輸入；若日後加入必須手動啟動、不可自動播放，並明確切換標記。 |
| L02 `line-tunnel` | 線條隧道 Line Tunnel | Canvas 2D | [R] 參考重建 | 已實作 | 強度、尺度、Secondary、方向、層數、邊數（4 = 畫面比例矩形）、前進速度、深度扭轉、旋轉速度、導軌連線 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| L03 `flow-lines` | 流動線 Flow Lines | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、Secondary、方向、seed、密度、速度、場曲率、線段長度、線寬 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| L04 `spirograph` | 萬花尺 Spirograph | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、Secondary、Accent、方向、小齒輪齒數、筆尖偏移、線寬、描繪時間、顯示齒輪 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| L05 `barcode` | 條碼 Barcode | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、Secondary、seed、號碼停留、切換時間、由左至右延遲、掃描紅線、顯示數字 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | 此為視覺圖樣，條紋依 EAN-13 規則排列但不保證可被掃描器讀取；切換中的中間狀態不是有效條碼。 |
| L06 `crosshatch` | 交叉線網 Crosshatch | Canvas 2D | [R] 參考重建 | 已實作 | 強度、尺度、Secondary、交叉角度、線距、線寬比例、平移速度、重疊處互相抵消（XOR）、角度呼吸 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | 摩爾紋依賴實際像素密度，不同螢幕縮放下條紋大小略有差異。 |
| L07 `line-chart-race` | 折線競賽 Line Chart Race | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、Secondary、Accent、資料（名稱:數值,數值;…）、繪製時間、結尾停留、Y 軸隨數據擴張、格線與刻度 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | 資料以文字參數輸入，不支援匯入 CSV 檔；標籤避讓為一維推擠，數據線很多且數值接近時仍可能擁擠。 |
| L08 `lissajous` | 李沙育曲線 Lissajous | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、Secondary、Accent、方向、X 頻率 a、Y 頻率 b、相位變化速度、光點速度、殘影長度、顯示完整曲線 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| L09 `stripe-twist` | 扭動條紋 Stripe Twist | Canvas 2D | [R] 參考重建 | 已實作 | 強度、尺度、Secondary、方向、色帶數、扭轉次數、扭轉速度、緞帶數、明暗 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| L10 `line-draw` | 線條繪圖 Line Draw | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、Secondary、seed、長度處理、圖形數量、繪製時間、停留、線寬、顯示淡色導引 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| L11 `radar-sweep` | 雷達掃描 Radar Sweep | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、Secondary、Accent、方向、seed、旋轉一圈、目標數量、衰減時間、扇形寬度、目標標籤 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| L12 `topo-lines` | 地形等高線 Topo Lines | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、Secondary、seed、等高線層數、地形細碎度、變形速度、線寬、計曲線（每 5 條加粗） | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |

## SHAPES（12）

| ID | 名稱 | renderer | 來源 | 狀態 | 支援控制項（共用＋專屬） | 匯出 | 驗收 | 已知限制 |
|---|---|---|---|---|---|---|---|---|
| S01 `bouncing-shapes` | 彈跳圖形 Bouncing Shapes | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、Secondary、Accent、seed、圖形數量、彈性（恢復係數）、壓扁程度、重力 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | 圖形之間的碰撞以圓形近似，方形與三角形的角可能略為重疊。 |
| S02 `orbit-shapes` | 軌道圖形 Orbit Shapes | Canvas 2D | [R] 參考重建 | 已實作 | 尺度、方向、Secondary、Accent、seed、軌道數量、軌道仰角、透視強度、顯示軌道線 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| S03 `shape-morph` | 圖形變形 Shape Morph | SVG | [R] 參考重建 | 已實作 | 尺度、Secondary、方向、變形時間、停留時間、變形時旋轉、顯示下一個形狀輪廓 | PNG（SVG 轉點陣）、透明 PNG | ✅ smoke（4/4 幀不同） | — |
| S04 `kaleidoscope` | 幾何萬花筒 Kaleidoscope | Canvas 2D | [R] 參考重建 | 已實作 | 強度、尺度、方向、Secondary、Accent、seed、鏡射軸數、來源圖形數、圓形視窗、顯示鏡射軸 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| S05 `shape-relay` | 圖形接力 Shape Relay | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、方向、Secondary、Accent、圖形數量、接力間隔、跳躍高度、顯示時間軸 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| S06 `shape-stack` | 幾何堆疊 Shape Stack | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、Secondary、Accent、seed、積木數量、落下間隔、落地壓縮、顯示目標位置虛線 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| S07 `liquid-merge` | 液態融合 Liquid Merge | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、方向、Secondary、seed、黏稠度（gooey）、小圓團數量、顯示內層等值線 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| S08 `corner-cut` | 切角圖形 Corner Cut | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、方向、Secondary、Accent、切削深度、切法、顯示頂點數 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| S09 `shape-shutter` | 圖形快門 Shape Shutter | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、字距、尺度、方向、Secondary、Accent、扇葉數、開合扭轉角、最大開口、開啟停留 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| S10 `shape-trail` | 軌跡留影 Shape Trail | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、方向、Secondary、Accent、副本數、副本延遲、衰減、路徑、主圖形、副本只畫外框 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| S11 `shape-magnet` | 圖形磁吸 Shape Magnet | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、Secondary、seed、圖形數量、吸附陣列、吸附輕震、顯示吸力線 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| S12 `geometry-puzzle` | 幾何拼圖 Geometry Puzzle | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、Secondary、Accent、seed、散開距離、散落旋轉、飛入間隔、顯示目標輪廓 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |

## SPLIT（12）

| ID | 名稱 | renderer | 來源 | 狀態 | 支援控制項（共用＋專屬） | 匯出 | 驗收 | 已知限制 |
|---|---|---|---|---|---|---|---|---|
| P01 `vertical-split` | 左右分割 Vertical Split | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、Secondary、Accent、轉場時間、停留時間、手動進度、進度、切線位置、切線傾角、後景推近 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| P02 `horizontal-split` | 上下分割 Horizontal Split | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、Secondary、Accent、轉場時間、停留時間、手動進度、進度、切線位置、合攏距離、合攏回彈 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| P03 `quadrant-split` | 四象限 Quadrant Split | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、旋轉角度、依序間隔、中央顯露 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| P04 `diagonal-split` | 對角切分 Diagonal Split | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、垂直撐開、下片延遲 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| P05 `venetian-split` | 百葉分片 Venetian Split | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、分片數、錯開程度 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| P06 `checker-split` | 棋盤切片 Checker Split | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、欄數、同組錯開、掉落距離 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| P07 `ring-split` | 圓環分裂 Ring Split | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、圓環數、由內而外錯開、相鄰反向 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| P08 `puzzle-split` | 拼圖分片 Puzzle Split | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、強度、seed、Secondary、Accent、轉場時間、停留時間、手動進度、進度、欄數、形狀不規則、錯開距離 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| P09 `offset-slices` | 錯位切片 Offset Slices | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、強度、Secondary、Accent、轉場時間、停留時間、手動進度、進度、切片數、錯位方式、時間錯開 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| P10 `radial-split` | 扇形切分 Radial Split | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、扇形數、依序掃過、扭轉 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| P11 `fold-panels` | 摺頁切分 Fold Panels | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、面板數、透視強度、依序間隔 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| P12 `panel-swap` | 雙畫面交換 Panel Swap | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、主區比例、分區間距、交錯弧度 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |

## WIPE（12）

| ID | 名稱 | renderer | 來源 | 狀態 | 支援控制項（共用＋專屬） | 匯出 | 驗收 | 已知限制 |
|---|---|---|---|---|---|---|---|---|
| W01 `linear-wipe` | 線性擦拭 Linear Wipe | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、邊界線粗細、速度曲線 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| W02 `circle-reveal` | 圓形揭露 Circle Reveal | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、Secondary、Accent、轉場時間、停留時間、手動進度、進度、中心 X、中心 Y、環線粗細、反轉（舊場景縮小） | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| W03 `iris-wipe` | 虹膜開合 Iris Wipe | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、葉片數、旋轉量、開合模式 | PNG、WebM | ✅ smoke（3/4 幀不同） | — |
| W04 `diagonal-wipe` | 斜角擦拭 Diagonal Wipe | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、傾斜角度、導引細線 | PNG、WebM | ✅ smoke（2/4 幀不同） | — |
| W05 `wave-wipe` | 波浪擦拭 Wave Wipe | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、強度、Secondary、Accent、轉場時間、停留時間、手動進度、進度、波幅、波數、邊界線 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| W06 `ink-reveal` | 墨跡揭露 Ink Reveal | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、Secondary、Accent、seed、轉場時間、停留時間、手動進度、進度、墨跡數、邊緣不規則度、濕墨邊 | PNG、WebM | ✅ smoke（3/4 幀不同） | — |
| W07 `brush-wipe` | 刷痕擦拭 Brush Wipe | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、seed、轉場時間、停留時間、手動進度、進度、刷痕數、刷毛參差、顏料刷頭 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| W08 `tile-wipe` | 格塊揭露 Tile Wipe | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、Secondary、Accent、seed、轉場時間、停留時間、手動進度、進度、切換順序、欄數、同時切換量 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| W09 `spiral-wipe` | 螺旋揭露 Spiral Wipe | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、圈數、螺旋描邊 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| W10 `zipper-wipe` | 拉鍊揭露 Zipper Wipe | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、開口長度、拉鍊齒 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| W11 `paper-tear` | 紙張撕開 Paper Tear | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、seed、轉場時間、停留時間、手動進度、進度、裂口起伏、紙纖維寬度、撕開角度 | PNG、WebM | ✅ smoke（4/4 幀不同） | 紙片為平面剛體旋轉＋位移，不模擬紙張捲曲。 |
| W12 `light-sweep-wipe` | 光帶擦拭 Light Sweep Wipe | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、方向、Secondary、Accent、轉場時間、停留時間、手動進度、進度、光帶寬度、光帶亮度、傾斜角度 | PNG、WebM | ✅ smoke（4/4 幀不同） | — |

## COMIC（12）

| ID | 名稱 | renderer | 來源 | 狀態 | 支援控制項（共用＋專屬） | 匯出 | 驗收 | 已知限制 |
|---|---|---|---|---|---|---|---|---|
| C01 `comic-burst` | 漫畫爆炸框 Comic Burst | SVG | [E] 延伸設計 | 已實作 | 文字、字體、字重、強度、尺度、Secondary、Accent、seed、尖角數、鋸齒深度、停留時間、偏移陰影 | PNG（SVG 轉點陣）、透明 PNG | ✅ smoke（4/4 幀不同） | — |
| C02 `speed-lines` | 集中速度線 Speed Lines | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、強度、尺度、Secondary、seed、流動方向、線條數量、中央留白、流速 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| C03 `onomatopoeia-slam` | 擬聲字重擊 Onomatopoeia Slam | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、強度、尺度、Secondary、Accent、seed、最大傾角、立體厚度、停留時間、衝擊線 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| C04 `speech-bubble` | 對話氣泡 Speech Bubble | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、字距、尺度、方向、Secondary、Accent、氣泡圓潤度、尾角長度、停留時間、偏移陰影 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| C05 `thought-bubble` | 思考氣泡 Thought Bubble | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、字距、尺度、方向、Secondary、Accent、雲朵團數、小圓泡數、漂浮幅度、停留時間 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| C06 `comic-panels` | 漫畫分鏡 Comic Panels | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、尺度、方向、Secondary、Accent、seed、格間距、斜切程度、揭露間隔、整頁停留 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| C07 `star-spark` | 星芒閃光 Star Spark | Canvas 2D | [E] 延伸設計 | 已實作 | 強度、尺度、方向、Secondary、Accent、seed、星芒角數、星芒數量、銳利度、單顆時長 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| C08 `impact-shake` | 動感震動 Impact Shake | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、強度、尺度、方向、Secondary、Accent、主圖形、衰減速度、震動頻率、衝擊星與放射線 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| C09 `comic-shadow` | 漫畫陰影掃過 Comic Shadow | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、尺度、方向、Secondary、陰影樣式、主體、陰影角度、線／點密度 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| C10 `sticker-pop` | 貼紙彈出 Sticker Pop | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、尺度、Secondary、Accent、seed、彈出節奏、貼紙數量、白邊厚度、歪斜角度 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| C11 `comic-page-turn` | 漫畫翻頁 Comic Page Turn | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、尺度、Secondary、seed、翻頁時間、每頁停留、頁角抬起、背面明暗 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| C12 `freeze-frame` | 漫畫暫停格 Freeze Frame | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、尺度、方向、Secondary、Accent、定格位置、速度線樣式、定格停留、殘影 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |

## MINIMAL（12）

| ID | 名稱 | renderer | 來源 | 狀態 | 支援控制項（共用＋專屬） | 匯出 | 驗收 | 已知限制 |
|---|---|---|---|---|---|---|---|---|
| M01 `minimal-blocks` | 極簡色塊 Minimal Blocks | DOM | [P] 部分參考 | 已實作 | Secondary、Accent、強度、色塊數量、間距、停頓時間、圓角 | PNG（實驗性 DOM） | ✅ smoke（4/4 幀不同） | DOM renderer：PNG 以 SVG foreignObject 實驗性截取。 |
| M02 `minimal-circle` | 極簡圓 Minimal Circle | Canvas 2D | [P] 部分參考 | 已實作 | 強度、尺度、Secondary、Accent、seed、輪廓數量、移動時間、停留時間、輪廓延遲 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| M03 `breathing-ring` | 呼吸圓環 Breathing Ring | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、Secondary、一次呼吸、呼吸深度、線寬、最小半徑導引環 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| M04 `dot-line-relay` | 點線接力 Dot Line Relay | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、方向、Secondary、Accent、站點數、前進時間、站間停頓、站點刻度透明度 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| M05 `progress-arc` | 進度弧 Progress Arc | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、方向、Secondary、每段角度、延長時間、線寬、底軌 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| M06 `balance` | 平衡天秤 Balance | Canvas 2D | [E] 延伸設計 | 已實作 | 強度、尺度、Secondary、Accent、阻尼、擺盪頻率、平衡停留 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| M07 `corner-frame` | 邊角框線 Corner Frame | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、方向、Accent、邊角長度、內縮、停留時間、中心標記 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| M08 `line-fold` | 細線折疊 Line Fold | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、Accent、折出形狀、摺疊時間、停留時間、線寬、顯示折點 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| M09 `negative-space-slider` | 留白滑塊 Negative Space Slider | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、方向、Secondary、seed、步數、停頓倍率、方塊大小、水平線位置 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| M10 `orbit-dot` | 軌道點 Orbit Dot | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、方向、Secondary、一圈時間、快慢節奏、點大小、速度殘影 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
| M11 `minimal-loader` | 極簡載入 Minimal Loader | Canvas 2D | [E] 延伸設計 | 已實作 | 尺度、強度、樣式、週期、相位差 | PNG、透明 PNG、WebM | ✅ smoke（3/4 幀不同） | — |
| M12 `minimal-mark-reveal` | 極簡標記揭露 Minimal Mark Reveal | Canvas 2D | [E] 延伸設計 | 已實作 | 文字、字體、字重、字距、尺度、Secondary、標記形狀、描線時間、停留時間 | PNG、透明 PNG、WebM | ✅ smoke（4/4 幀不同） | — |
