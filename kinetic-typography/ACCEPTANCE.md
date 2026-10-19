# 實作與驗收清單

最後驗證：2026-10-19。執行環境：Windows 11、Node 20.0、Chromium（Playwright 1.61，WebGL 使用 SwiftShader）以及 Claude 桌面版內建瀏覽器（實體 GPU）。

## 摘要

* registry：80 個唯一 ID，0 個缺漏（`tests/app.spec.mjs` 驗證）。
* 80 個效果皆有獨立實作檔 `src/effects/impl/eNN-<id>.ts`，沒有 placeholder。
* `npm run build`（`tsc -b` + `vite build`）通過。
* Playwright：29 個測試全數通過（`npx playwright test`，約 1.5 分鐘）。

## 每個效果

「關鍵特徵」是用固定時間截圖（`scripts/snap.mjs`，多個時間點）人工檢查過的項目；
「狀態」✅ 表示已實作、截圖檢查、並通過自動測試（時間變化、確定性、7 種測試文字、3 種比例、卡片模式、無 console error）。

| # | 效果 | ID | Renderer | 專屬參數 | 關鍵特徵（已截圖確認） | 狀態 |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | 文字爆開 Word Burst | `word-burst` | DOM | 外擴距離、放射線數、停留秒數 | 字元放射錯開後回收原位＋放射線、閃光環 | ✅ |
| 02 | 逐字敲擊 Letter Sequence | `letter-sequence` | DOM | 節拍間隔、壓扁程度、停留秒數 | 逐字落下、觸地底部支點壓扁回彈 | ✅ |
| 03 | 印章 Text Stamp | `text-stamp` | DOM | 蓋章間隔、墨點數量、顯示編號 | 雙框印章以不同角度蓋下、震動、墨點、墨色變淡 | ✅ |
| 04 | 衝擊放大 Punch Zoom | `punch-zoom` | DOM | 殘影數、停留秒數 | expo.in 衝入、過衝 back.out 定格、殘影只在衝擊期間 | ✅ |
| 05 | 動態堆疊 Kinetic Stack | `kinetic-stack` | DOM | 批次間隔、大小對比、補白線條 | 多行由不同方向遮罩滑入、字重與對齊對比 | ✅ |
| 06 | 伸縮字 Stretch Text | `stretch-text` | DOM | 拉長對象、指定第幾個字、拉長倍率、尺寸標示 | 指定字 scaleX 拉伸、鄰字即時讓位、elastic 回彈 | ✅ |
| 07 | 穿越放大 Text Zoom Through | `zoom-through` | DOM | 每詞秒數、閱讀停頓、速度線 | 指數放大、縮放中心在筆畫縫隙、下一詞從縫隙出現 | ✅ |
| 08 | 擠壓彈跳 Text Squeeze | `text-squeeze` | DOM | 壓扁程度、彈跳高度、回彈次數 | squash & stretch 保持體積、衰減彈跳 | ✅ |
| 09 | 巨字滑過 Huge Text Scroll | `huge-scroll` | DOM | 字高倍率、交替鏤空、資訊帶 | 字高約 1.3 倍舞台、無縫循環＋反向資訊帶 | ✅ |
| 10 | 直書逆走 Vertical Typography | `vertical-typography` | DOM | 欄數、欄線、欄速差異 | vertical-rl 直排、奇偶欄反向、無縫 | ✅ |
| 11 | 重複波浪 Repeating Text Wave | `repeating-wave` | Canvas | 列數、波浪方向、波長、波形 | 網格不動不縮放，只有顏色亮度波掃過 | ✅ |
| 12 | 斜線帶 Diagonal Text Bands | `diagonal-bands` | DOM | 色帶數、傾斜角度、色帶間距 | 斜向帶相鄰反向、填色／鏤空交替、無縫 | ✅ |
| 13 | 緞帶 Text Ribbon | `text-ribbon` | SVG | 緞帶數、起伏幅度、文字流速 | SVG textPath 每幀重算波形、文字沿路徑流動 | ✅ |
| 14 | 跑馬燈 Marquee | `marquee` | DOM | 列數、傾斜角度 | 量測單位寬度取餘數，循環點無跳動 | ✅ |
| 15 | 直書三層 Parallax Columns | `parallax-columns` | DOM | 流動方向、景深模糊、鏡頭平移 | 三層景深（大小、透明度、模糊、速度） | ✅ |
| 16 | 封鎖膠帶 Tape Cross | `tape-cross` | DOM | 膠帶數、交叉角度、斜紋邊 | 兩條以上膠帶 X 形交叉、各自方向流動 | ✅ |
| 17 | 文字隧道 Text Tunnel | `text-tunnel` | 3D / WebGL＋Canvas lite | 隧道節數 | Three.js 方形管道四壁文字＋框線；卡片與無 WebGL 用 Canvas 透視版 | ✅ |
| 18 | 文字走廊 Text Corridor | `text-corridor` | 3D | 透視深度、走廊節數、鏡頭晃動 | CSS 3D 長方形走廊（地板、牆、天花板）向前推進 | ✅ |
| 19 | 圓柱 Text Cylinder | `text-cylinder` | 3D | 俯視角度、圓柱半徑、旋轉節奏 | 字元貼在圓柱面、多圓柱反向、背面壓暗鏡像 | ✅ |
| 20 | 漩渦 Text Vortex | `text-vortex` | Canvas | 碎片數量、旋轉圈數、循環秒數 | 小字沿螺旋聚集、衝擊環後主字浮現再放開 | ✅ |
| 21 | 圓環隧道 Ring Text Tunnel | `ring-tunnel` | Canvas | 圓環數、旋轉速度、隧道彎曲 | 面向鏡頭的環形句子以 1/z 迎面而來（與 17 不同） | ✅ |
| 22 | 軌道 Text Orbit | `text-orbit` | DOM | 軌道傾角、公轉秒數、第二軌道 | 橢圓軌道、大小／模糊／層級表現深度、球體遮擋後半段 | ✅ |
| 23 | 方塊 Text Cube | `text-cube` | 3D | 停留秒數、翻轉秒數、側視角度 | CSS 3D 立方體依節奏翻 90°、面光影 | ✅ |
| 24 | 立體字 Extruded Text | `extruded-text` | 3D | 厚度、層數、擺動角度 | 約 36 層 translateZ 分層擠出、側面依深度上色、旋轉可見厚度 | ✅ |
| 25 | 翻牌 Split Flap | `split-flap` | DOM | 翻牌間隔、經過張數 | 上下兩片＋兩個翻片繞中線翻轉、經過隨機字後定位 | ✅ |
| 26 | 翻卡 Flip Cards | `flip-cards` | DOM | 停留秒數、波動間隔、翻起高度 | 整張卡 rotateY 180° 背面換字（與 25 不同） | ✅ |
| 27 | 打字機 Typewriter | `typewriter` | DOM | 每秒字數、停留秒數、游標樣式 | 先排版再逐字顯示、標點停頓、刪除、游標閃爍 | ✅ |
| 28 | 拉霸 Slot Text | `slot-text` | DOM | 轉動秒數、依序停止間隔、動態模糊 | 字帶高速滾動、power4 減速回彈、依序停靠 | ✅ |
| 29 | 計數器 Odometer | `odometer` | DOM | 起始值、目標值、前綴、後綴、滾動秒數、千分位、進位方式 | 機械式進位，已驗證 99→100、95→105 | ✅ |
| 30 | 標題切換 Headline Swap | `headline-swap` | DOM | 停留秒數、進場方向 | 固定標籤＋遮罩內標題滑入滑出、底線同步 | ✅ |
| 31 | LED 看板 LED Text | `led-text` | Canvas | 點陣列數、水平捲動、亮度閃爍 | 文字取樣成布林點陣、圓點 LED 重繪、未亮點可見 | ✅ |
| 32 | 上下裂開 Split Halves | `split-halves` | DOM | 裂開距離、停留秒數 | clip-path 上下兩半反向移開露出下一詞 | ✅ |
| 33 | 雷擊 Lightning Strike | `lightning-strike` | SVG | 低刺激模式、分岔數、電弧數 | 中點位移閃電、局部光暈、無全屏閃白；低刺激模式 | ✅ |
| 34 | 雷射切割 Laser Cut | `laser-cut` | DOM | 切割角度、錯開距離 | 雷射位置與 clip-path 切線一致、兩片沿法線錯開 | ✅ |
| 35 | 硬幣翻轉 Coin Flip | `coin-flip` | DOM | 翻轉圈數、依序間隔、停留秒數 | 多層邊緣硬幣繞 Y 軸旋轉跳起、陰影隨高度縮放 | ✅ |
| 36 | 爆炸四散 Explode Out | `explode-out` | DOM | 飛散距離、旋轉量、停留秒數 | 各字依 seed 方向飛出旋轉淡出（離開畫面） | ✅ |
| 37 | 粒子消散 Disintegrate | `disintegrate` | Canvas | 粒子數量、風向 | 從字形像素取樣粒子、崩解前沿推進、漂移淡出再聚合 | ✅ |
| 38 | 心跳縮放 Heartbeat Zoom | `heartbeat-zoom` | DOM | 心率 BPM、輪廓擴散、顯示心電圖 | 重拍／輕拍／停頓雙脈衝、擴散輪廓 | ✅ |
| 39 | 文字萬花筒 Text Kaleido | `text-kaleido` | Canvas | 鏡面數、旋轉速度、中央顯示原文 | 楔形內繪字，N 等分旋轉並交替鏡像 | ✅ |
| 40 | 數字重擊 Number Slam | `number-slam` | DOM | 每拍秒數、裂紋 | 數字由大砸下、局部震動、衝擊線與裂紋 | ✅ |
| 41 | 波浪字 Wave Letters | `wave-letters` | DOM | 振幅、波長、週期、顯示波浪線 | 依 x 位置相位的正弦波、隨坡度傾斜 | ✅ |
| 42 | 停格動畫 Stop Motion | `stop-motion` | DOM | 每秒格數、抖動量、顯示格數計數 | 量化到 6–15 fps，每格新姿勢（非平滑插值） | ✅ |
| 43 | 文字雨 Letter Rain | `letter-rain` | Canvas | 雨量、風向、顯示完整文字 | 三層深度字雨、落地水花 | ✅ |
| 44 | 放大鏡 Magnifier Lens | `magnifier-lens` | DOM | 放大倍率、鏡片尺寸、顯示細節小字 | 鏡片內為整層副本 translate+scale，真實局部放大 | ✅ |
| 45 | 亂碼解碼 Scramble Decode | `scramble-decode` | DOM | 亂碼頻率、鎖定間隔、鎖定順序 | 亂碼依時間步固定、逐字鎖定，最終文字正確 | ✅ |
| 46 | 多米諾文字 Domino Letters | `domino-letters` | DOM | 骨牌間距、骨牌底塊、起始小球 | 右下角支點依序倒下、靠在下一字上、依序立起 | ✅ |
| 47 | 漸層流動 Gradient Flow | `gradient-flow` | DOM | 流動角度、色帶寬度 | background-clip:text 漸層只在字形內、無縫 | ✅ |
| 48 | 圓環文字 Circle Text | `circle-text` | SVG | 圈數、旋轉速度、中心標誌 | 多圈 textPath 平面環形、內外反向 | ✅ |
| 49 | 水面倒影 Water Reflection | `water-reflection` | Canvas | 波紋強度、倒影長度、水平線位置 | 倒影逐列依疊加正弦偏移、隨距離淡出 | ✅ |
| 50 | 逐字彈跳 Letter Bounce | `letter-bounce` | DOM | 跳躍高度、錯開時間、休息時間 | 逐字起跳、落地壓扁、兩次衰減回彈、循環 | ✅ |
| 51 | 文字旗幟 Text Flag | `text-flag` | 3D / WebGL＋Canvas lite | 風力、波速、旗桿 | Three.js 平面網格行進波＋法線明暗；lite 為切條位移 | ✅ |
| 52 | 重力反轉 Gravity Flip | `gravity-flip` | DOM | 回彈係數、重力、空中翻轉 | 固定步長重力、碰撞回彈、重力週期反轉、字保持可讀 | ✅ |
| 53 | 磁力吸附 Magnet Pull | `magnet-pull` | DOM | 磁力強度、碎點數量、阻尼 | 1/d 吸引＋彈簧歸位，詳情頁指標即磁鐵 | ✅ |
| 54 | 文字脈衝網格 Word Pulse Grid | `pulse-grid` | Canvas | 節拍 BPM、每列字數、顯示波前線 | 縮放脈衝由中心環狀擴散（只改尺寸） | ✅ |
| 55 | 字重生長 Weight Grow | `weight-grow` | DOM | 逐字間隔、生長時間、顯示字重數值 | Noto Sans TC 可變字重 wght 100–900 逐字補間 | ✅ |
| 56 | 文字扇形 Text Fan | `text-fan` | DOM | 扇骨數、展開角度 | 共同支點扇形展開再收攏 | ✅ |
| 57 | 卡拉 OK 球 Karaoke Ball | `karaoke-ball` | DOM | 速度 | 小球拋物線跳到各字、clip-path 由左至右染色 | ✅ |
| 58 | 搖擺文字 Swing Letters | `swing-letters` | DOM | 衰減速度、推動間隔 | 上方吊點鐘擺、交錯相位、指數衰減 | ✅ |
| 59 | 像素溶解 Pixel Dissolve | `pixel-dissolve` | Canvas | 方塊大小、批次數 | 只保留覆蓋字形的方塊、分批消失重建、不位移 | ✅ |
| 60 | 旋轉詞盤 Rotating Words | `rotating-words` | SVG | 停留秒數、旋轉秒數 | SVG 圓盤分段旋轉、中心詞遮罩切換 | ✅ |
| 61 | 模糊拖尾 Blur Trail | `blur-trail` | DOM | 殘影數、殘影間隔 | 延遲副本依速度模糊拉伸，停下時清晰 | ✅ |
| 62 | 棋盤文字 Checker Words | `checker-words` | DOM | 格子密度、波速間隔 | 棋盤奇偶＋對角線順序 rotateX 翻轉換色 | ✅ |
| 63 | 雲霄飛車路徑 Roller Path | `roller-path` | SVG | 下坡加速 | 沿 ∞ 路徑、角度跟隨切線、下坡加速 | ✅ |
| 64 | 字母洗牌 Shuffle Letters | `shuffle-letters` | DOM | 洗牌輪數、移動秒數 | 字元位置多輪交換後歸位（內容不變） | ✅ |
| 65 | 游標排斥 Cursor Repel | `cursor-repel` | DOM | 影響半徑、彈簧強度、阻尼 | 距離衰減 (1−d/R)² 排斥＋阻尼彈簧歸位 | ✅ |
| 66 | 聚光燈顯字 Spotlight Reveal | `spotlight-reveal` | DOM | 光圈半徑、邊緣柔和、暗處亮度 | mask-image 柔邊光圈照亮亮字層，閒置自動掃光 | ✅ |
| 67 | 呼吸字距 Breathing Tracking | `breathing-tracking` | DOM | 呼吸幅度、吸氣秒數、吐氣秒數 | 只改字距（4 秒吸 6 秒吐）＋微幅透明度 | ✅ |
| 68 | 彈簧字串 Spring Chain | `spring-chain` | DOM | 彈簧強度、阻尼、回原位力 | 彈簧質點鏈、延遲傳遞衰減、SVG 線圈 | ✅ |
| 69 | 掃描線顯字 Scanline Reveal | `scanline-reveal` | Canvas | 掃描秒數、每字線條數、顯示框線與讀數 | 掃描線上方以條紋顯字再填實，字形不分裂 | ✅ |
| 70 | 描邊成字 Outline Draw | `outline-draw` | SVG | 描線秒數、線寬、顯示參考線 | SVG <text> stroke-dasharray 沿真實字形輪廓描線後填色 | ✅ |
| 71 | 墨水暈染 Ink Bleed | `ink-bleed` | SVG | 暈染範圍、滲透秒數、落款印章 | SVG 濾鏈 morphology＋turbulence 位移墨暈，核心字形清晰 | ✅ |
| 72 | 紙片揭露 Paper Peel | `paper-peel` | DOM | 揭露停留 | clip-path 折線揭開、鏡像折角帶陰影，文字不動 | ✅ |
| 73 | 百葉窗文字 Text Blinds | `text-blinds` | DOM | 切片數、停留秒數 | 多條 3D 稜柱切片 rotateX 依序翻轉換詞（與 32 不同） | ✅ |
| 74 | 玻璃折射 Glass Refraction | `glass-refraction` | Canvas | 折射強度、色散 | 玻璃範圍內逐像素位移放大＋RGB 色散，範圍外不變 | ✅ |
| 75 | 日蝕文字 Eclipse Text | `eclipse-text` | SVG | 掠過秒數、圓盤大小、日冕強度 | SVG mask 遮蔽＋圓內輪廓光、日冕 | ✅ |
| 76 | 等高線文字 Topographic Text | `topographic-text` | Canvas | 等高線間距、層數、擴張速度、地圖框線 | strokeText 不同線寬產生字形偏移等高線、相位擴張 | ✅ |
| 77 | 文字碎片拼合 Shard Assemble | `shard-assemble` | Canvas | 碎片大小、旋轉圈數、完整停留 | 擾動三角網格切字形，碎片飛入精準拼回 | ✅ |
| 78 | 音頻節奏字 Audio Reactive Type | `audio-reactive` | Canvas | 反應強度、顯示頻譜條 | 預設模擬頻譜；使用者選音檔後才建立 AudioContext | ✅ |
| 79 | 滾動敘事字 Scroll Story Type | `scroll-story` | DOM | 聚焦放大 | 舞台內原生捲動區控制分段顯字；未捲動時自動進度 | ✅ |
| 80 | 距離場變形 Metaball Type | `metaball-type` | SVG | 黏稠度、液態秒數、液面陰影 | gooey 濾鏡液態連接、液態階段有時間上限 | ✅ |

## 已執行的測試

### 自動（Playwright，`tests/`）

| 測試 | 內容 | 結果 |
| --- | --- | --- |
| registry | 80 個唯一 ID、無缺漏 | ✅ |
| list | 80 張卡片、中文／英文搜尋、分類／技術篩選、空狀態與清除篩選 | ✅ |
| favourites | 收藏後重新整理仍保留、只看收藏 | ✅ |
| localStorage 失效 | `localStorage` 存取丟出例外時頁面與收藏仍可運作 | ✅ |
| detail deep link | 網址還原文字、顏色、比例、速度、參數；超出範圍值被限制；不合法顏色被丟棄；修改文字更新網址；播放／暫停／重播；恢復預設 | ✅ |
| 設定保存 | 修改後離開再回來仍保留 | ✅ |
| 生命週期 | 連續切換 12 次（含 3D 效果）後只剩 1 個 Player、≤1 個 canvas；返回圖鑑時焦點回到原卡片 | ✅ |
| 鍵盤 | 空白鍵暫停、→ 切換下一個效果 | ✅ |
| reduced motion | 詳情頁預設暫停並顯示提示、可手動播放；圖鑑自動預覽預設關閉 | ✅ |
| 無 WebGL | `?nowebgl=1` 時 3D 效果改用 2D 版本並顯示說明 | ✅ |
| 響應式 | 375×812 手機 1 欄、768×1024 平板 2 欄，三個頁面皆無水平捲動 | ✅ |
| 卡片並行上限 | 自動預覽同時播放 ≤6 個 | ✅ |
| 80 個效果 × 時間 | t=0.6／1.7／3.1 截圖至少一組不同；同一時間點重複截圖相同（確定性） | ✅ |
| 80 個效果 × 測試文字 | 「文字動態實驗室」「TYPE MOTION 2026」「春／夏／秋／冬」「你好！Hello 🙂」、三行文字、空字串、長字串，皆成功渲染且無 console error | ✅ |
| 80 個效果 × 比例 | 9:16、1:1（字級 160%、字距 0.6em、強度 200%）、卡片模式 | ✅ |

### 手動

* 計數器進位：`p.from=99&p.to=100` 與 95→105 截圖確認進位正確。
* 內建瀏覽器（實體 GPU）：文字旗幟、文字隧道的 Three.js 版本正常；修改文字、網址編碼中文與 emoji、URL 驗證。
* 手機寬度（375px）檢查圖鑑與詳情頁版面。

## 已知限制

* **未實測的項目**：實體手機觸控、Safari / Firefox、螢幕閱讀器朗讀、本機音檔播放路徑（78，只驗證了 UI 與模擬頻譜）、實際 tab 切到背景（程式會在 `document.hidden` 時停止 ticker，但沒有自動測試）。沒有量測 FPS 等效能數字。
* 測試使用 SwiftShader 軟體 WebGL；實體 GPU 只在桌面內建瀏覽器手動檢查過。
* 39 文字萬花筒、71 墨水暈染、80 距離場變形等濾鏡／像素運算較重的效果在低階裝置可能掉幀（已依 `ctx.q` 降低數量，卡片使用較低 dpr）。
* 33 雷擊：系統開啟「減少動態」時強制使用低刺激模式，無法手動關閉。
* 26 翻卡：只有一個詞時，背面顯示同一組字的明體版本；用「／」分隔多個詞才會切換成不同的詞。
* 46 多米諾：立起順序是由第一個字開始（反向會讓躺平的字互相穿插）。
* 63 雲霄飛車：沿 ∞ 路徑時有一半時間字會倒過來（角度跟隨切線的必然結果）。
* 70 描邊成字：Noto 字形的筆畫輪廓本身互相重疊，描線過程中可看到重疊線段；輪廓長度以點陣估算，個別輪廓可能較早描完。
* 75 日蝕：彩色 emoji 在遮蔽區內仍保持彩色，無法變成輪廓。
* 51 文字旗幟：最多 24 字。
* emoji 在 `background-clip: text`（47）與部分染色效果中無法套用顏色，會以原色顯示。
* PNG 截圖與 WebM 錄製只提供給 Canvas / WebGL 效果；DOM / SVG 效果不顯示這兩個按鈕。
