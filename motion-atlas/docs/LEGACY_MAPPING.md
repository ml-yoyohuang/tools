# 與既有文字庫（kinetic-typography）對照

自動產生：`node scripts/checklist.mjs`。

- 既有文字庫：80 個效果（`kinetic-typography/`，全部已實作）。
- MOTION ATLAS：120 個效果。
- 重複並合併：**15** 個（atlas 沿用舊實作的運動機制移植並擴充 4 色、方向、seed 等設定；舊 ID 列在 `legacyIds`）。
- 兩個庫合計的唯一效果數：80 + 120 − 15 = **185**（不是 200）。

## Migration

- 收藏：首次載入 atlas 時讀取同網域舊庫的 `kt:favorites`，可對應的 ID 轉成 atlas ID 寫入 `ma:favorites`（只做一次，旗標 `ma:migrated`）；不在 atlas 內的舊 ID 忽略。
- 分享連結：`#/e/<舊 ID>` 會自動導向對應的 atlas ID（例如 `#/e/karaoke-ball` → `#/e/karaoke-text`）。舊連結的 query 參數名稱不同（例如 fontScale `fs` → scale `sc`），無法辨識的參數會被忽略並回到預設值。

## 重複對照（已合併）

| 舊 ID | 舊名稱 | → atlas | atlas 名稱 |
|---|---|---|---|
| `word-burst` | 文字爆開 Word Burst | T08 `word-burst` | 單字爆發 Word Burst |
| `letter-sequence` | 逐字敲擊 Letter Sequence | T16 `letter-sequence` | 逐字重擊 Letter Sequence |
| `zoom-through` | 穿越放大 Text Zoom Through | T01 `zoom-through` | 穿越放大 Text Zoom Through |
| `diagonal-bands` | 斜線帶 Diagonal Text Bands | T13 `diagonal-bands` | 斜向文字帶 Diagonal Text Bands |
| `text-ribbon` | 緞帶 Text Ribbon | T14 `text-ribbon` | 文字緞帶 Text Ribbon |
| `text-corridor` | 文字走廊 Text Corridor | T02 `text-corridor` | 文字走廊 Text Corridor |
| `text-cylinder` | 圓柱 Text Cylinder | T03 `text-cylinder` | 文字圓柱 Text Cylinder |
| `text-vortex` | 漩渦 Text Vortex | T06 `text-vortex` | 文字漩渦 Text Vortex |
| `flip-cards` | 翻卡 Flip Cards | T09 `flip-cards` | 翻字卡 Flip Cards |
| `typewriter` | 打字機 Typewriter | T10 `typewriter` | 打字機 Typewriter |
| `slot-text` | 拉霸 Slot Text | T11 `slot-text` | 拉霸文字 Slot Text |
| `text-flag` | 文字旗幟 Text Flag | T04 `text-flag` | 文字旗幟 Text Flag |
| `pulse-grid` | 文字脈衝網格 Word Pulse Grid | T12 `word-surge-grid` | 文字波浪網格 Word Surge Grid |
| `text-fan` | 文字扇形 Text Fan | T15 `text-fan` | 文字扇形 Text Fan |
| `karaoke-ball` | 卡拉 OK 球 Karaoke Ball | T21 `karaoke-text` | 卡拉 OK 文字 Karaoke Text |

## atlas 新增（不在舊文字庫）

T05 文字回聲、T07 文字螺旋、T17 文字滾筒、T18 引言卡、T19 下三分之一字幕、T20 標籤雲、T22 字元軌道、T23 字形點陣重組、T24 編輯式標題、H01 半色調掃掠、H02 點矩陣、H03 螺旋圓點、H04 點雨、H05 半色調圓環、H06 半色調液團、H07 點陣漸層、H08 點陣曝光、H09 波紋點場、H10 點陣視差、H11 印刷套色偏移、H12 點陣翻面、G01 等角網格、G02 磁力網格、G03 網格填滿、G04 六角網格、G05 編織網格、G06 傾斜網格、G07 棋盤翻轉、G08 網格透鏡、G09 網格呼吸、G10 網格瓦解、G11 像素城市、G12 波浪表面、L01 聲波、L02 線條隧道、L03 流動線、L04 萬花尺、L05 條碼、L06 交叉線網、L07 折線競賽、L08 李沙育曲線、L09 扭動條紋、L10 線條繪圖、L11 雷達掃描、L12 地形等高線、S01 彈跳圖形、S02 軌道圖形、S03 圖形變形、S04 幾何萬花筒、S05 圖形接力、S06 幾何堆疊、S07 液態融合、S08 切角圖形、S09 圖形快門、S10 軌跡留影、S11 圖形磁吸、S12 幾何拼圖、P01 左右分割、P02 上下分割、P03 四象限、P04 對角切分、P05 百葉分片、P06 棋盤切片、P07 圓環分裂、P08 拼圖分片、P09 錯位切片、P10 扇形切分、P11 摺頁切分、P12 雙畫面交換、W01 線性擦拭、W02 圓形揭露、W03 虹膜開合、W04 斜角擦拭、W05 波浪擦拭、W06 墨跡揭露、W07 刷痕擦拭、W08 格塊揭露、W09 螺旋揭露、W10 拉鍊揭露、W11 紙張撕開、W12 光帶擦拭、C01 漫畫爆炸框、C02 集中速度線、C03 擬聲字重擊、C04 對話氣泡、C05 思考氣泡、C06 漫畫分鏡、C07 星芒閃光、C08 動感震動、C09 漫畫陰影掃過、C10 貼紙彈出、C11 漫畫翻頁、C12 漫畫暫停格、M01 極簡色塊、M02 極簡圓、M03 呼吸圓環、M04 點線接力、M05 進度弧、M06 平衡天秤、M07 邊角框線、M08 細線折疊、M09 留白滑塊、M10 軌道點、M11 極簡載入、M12 極簡標記揭露

## 僅存在於舊文字庫（未併入 atlas，仍可在 kinetic-typography 使用）

`text-stamp` 印章、`punch-zoom` 衝擊放大、`kinetic-stack` 動態堆疊、`stretch-text` 伸縮字、`text-squeeze` 擠壓彈跳、`huge-scroll` 巨字滑過、`vertical-typography` 直書逆走、`repeating-wave` 重複波浪、`marquee` 跑馬燈、`parallax-columns` 直書三層、`tape-cross` 封鎖膠帶、`text-tunnel` 文字隧道、`ring-tunnel` 圓環隧道、`text-orbit` 軌道、`text-cube` 方塊、`extruded-text` 立體字、`split-flap` 翻牌、`odometer` 計數器、`headline-swap` 標題切換、`led-text` LED 看板、`split-halves` 上下裂開、`lightning-strike` 雷擊、`laser-cut` 雷射切割、`coin-flip` 硬幣翻轉、`explode-out` 爆炸四散、`disintegrate` 粒子消散、`heartbeat-zoom` 心跳縮放、`text-kaleido` 文字萬花筒、`number-slam` 數字重擊、`wave-letters` 波浪字、`stop-motion` 停格動畫、`letter-rain` 文字雨、`magnifier-lens` 放大鏡、`scramble-decode` 亂碼解碼、`domino-letters` 多米諾文字、`gradient-flow` 漸層流動、`circle-text` 圓環文字、`water-reflection` 水面倒影、`letter-bounce` 逐字彈跳、`gravity-flip` 重力反轉、`magnet-pull` 磁力吸附、`weight-grow` 字重生長、`swing-letters` 搖擺文字、`pixel-dissolve` 像素溶解、`rotating-words` 旋轉詞盤、`blur-trail` 模糊拖尾、`checker-words` 棋盤文字、`roller-path` 雲霄飛車路徑、`shuffle-letters` 字母洗牌、`cursor-repel` 游標排斥、`spotlight-reveal` 聚光燈顯字、`breathing-tracking` 呼吸字距、`spring-chain` 彈簧字串、`scanline-reveal` 掃描線顯字、`outline-draw` 描邊成字、`ink-bleed` 墨水暈染、`paper-peel` 紙片揭露、`text-blinds` 百葉窗文字、`glass-refraction` 玻璃折射、`eclipse-text` 日蝕文字、`topographic-text` 等高線文字、`shard-assemble` 文字碎片拼合、`audio-reactive` 音頻節奏字、`scroll-story` 滾動敘事字、`metaball-type` 距離場變形
