# 任務：相機風格濾鏡網頁（暫名：相機風格濾鏡實驗室）

> 給 Claude Code 的任務規格。請完整讀完再動工。

## 0. 開工前

1. 先檢查專案根目錄是否有 `CLAUDE.md`。若有，先讀取並遵守；若沒有或讀取失敗，回報後再繼續。
2. 讀完本文件後，先用 5 行以內回報你的實作計畫（技術架構、檔案結構、Phase 1 範圍），等我確認再寫程式。

## 1. 專案目標

做一個網頁：使用者上傳照片 → 選擇一台相機 → 選擇該相機的任一內建濾鏡 → 即時預覽 → 微調 → 下載。

定位是**趣味致敬**，不是官方色彩科學的複製。目標是「一眼看得出是那個味道」，不追求數值精準。

## 2. 硬性限制（MUST / NEVER）

- MUST：純前端，WebGL2 fragment shader 做影像處理。不做後端、不上傳照片到任何伺服器。
- MUST：技術棧用 Vite + 原生 JavaScript（ES modules），不用 React/Vue 等框架。
- MUST：所有濾鏡用**資料驅動**：一個通用調色管線（第 4 節）＋每個濾鏡一份參數設定（JSON/JS 物件）。NEVER 為每個濾鏡各寫一支 shader。
- MUST：相機與濾鏡名稱可用文字顯示；NEVER 使用任何品牌 Logo、商標圖形、官方樣張或官方 UI 圖示。
- MUST：頁尾顯示免責聲明：「本站為非官方趣味致敬作品，與各相機品牌無關，濾鏡效果為模擬詮釋。」
- MUST：桌面優先，並支援手機 RWD（觸控滑桿、上下排列）。
- MUST：下載時以**原始解析度**輸出（大圖用 tile 或離屏 framebuffer 處理），預覽可用縮圖加速。
- NEVER：使用 localStorage 以外的持久化；不需要帳號系統。

## 3. 功能需求

1. **上傳**：拖放或點選，支援 JPG/PNG/HEIC（HEIC 若瀏覽器不支援就提示轉檔）。讀取 EXIF 方向並自動轉正。
2. **選相機**：相機清單以文字卡片呈現（名稱＋一句風格描述＋等效焦距標示）。
3. **選濾鏡**：選定相機後，顯示該相機全部濾鏡的縮圖預覽格（用目前照片的小縮圖即時算出）。
4. **微調面板**：每台相機顯示它「實機有的調整項」（見第 5 節各相機的「可調參數」），外加通用的「濾鏡強度 0–100%」。
5. **前後對比**：拖曳分割線或長按看原圖。
6. **下載**：JPG（品質 0.92），檔名格式 `原檔名_相機_濾鏡.jpg`。
7. **自訂 LUT**：允許上傳 `.cube` 檔套用（對應 Lumix L10 的 REAL TIME LUT 功能）。
8. **測試頁** `/test.html`：程式生成一張測試圖（灰階漸層、色塊、膚色色塊、高光光源點），並把**所有相機的所有濾鏡**排成格狀一次渲染，方便目視檢查。NEVER 使用網路上的照片當測試素材。

## 4. 通用調色管線（依序執行）

每個參數都要有「中性預設值」，濾鏡只覆寫需要的參數。

| 順序 | 處理 | 參數 |
|---|---|---|
| 1 | 線性化 | sRGB → linear |
| 2 | 曝光／白平衡 | exposure、temperature、tint |
| 3 | 色階曲線 | RGB 主曲線＋R/G/B 個別曲線（控制點陣列，烘成 1D LUT 貼圖） |
| 4 | 亮部／暗部 | highlights、shadows、blacks lift（褪色感）、whites |
| 5 | HSL 8 色調整 | 紅橙黃綠青藍紫洋紅各自 hue/sat/lum |
| 6 | 分離色調 | shadowTint、highlightTint（色相＋強度）、balance |
| 7 | 飽和度 | saturation、vibrance |
| 8 | 色彩濃度效果 | colorChrome（壓深高飽和色）、colorChromeBlue |
| 9 | 黑白轉換 | monochrome 開關、channelMixer（R/G/B 權重，用來做黃/紅/綠濾鏡效果）、toning（棕褐、硒、藍等色調） |
| 10 | 局部對比 | clarity（大半徑 unsharp）、hdrTone（強局部色調映射） |
| 11 | 銳利度／柔化 | sharpness（負值＝柔化） |
| 12 | 高光擴散 | diffusion（亮部門檻 → 模糊 → screen 疊回，用於 HDF） |
| 13 | 低傳真處理 | downscale 解析度、posterize 階數、pixelate 尺寸、JPEG 壓縮感 |
| 14 | 暗角 | vignette 強度、半徑、羽化 |
| 15 | 顆粒 | grain 強度、顆粒大小（要隨輸出解析度等比例縮放，預覽與下載觀感一致） |
| 16 | 回到 sRGB | 輸出 |

另外支援 **3D LUT（.cube）** 作為選用的第 3.5 步：濾鏡設定若帶 LUT 檔就套用。

## 5. 相機與濾鏡清單（全部都要做）

每個濾鏡請依「風格描述」調出參數。描述是給你的調色方向，不是精確規格。

### 5.1 Ricoh GR IV（28mm）

可調參數：飽和度、色相、高調/低調、對比、銳利度、顆粒大小與強度（黑白、Film、Cinema 類才有顆粒）、HDF 開關。

| 濾鏡 | 風格描述 |
|---|---|
| Standard | 中性、略高對比，GR 典型的清楚銳利 |
| Vivid | 提高飽和、對比與銳利度 |
| Monotone | 標準黑白 |
| Soft Monotone | 低對比黑白，灰階柔和，亮部微抬 |
| Hard Monotone | 硬調黑白，高對比、強銳化 |
| Hi-Contrast B&W | GR 招牌：極端對比、暗部死黑、粗顆粒、明顯暗角 |
| Negative Film | 負片感：微褪色、低對比、暗部抬起偏青、亮部偏暖，但色彩仍清楚 |
| Positive Film | 正片感：高飽和、黃綠偏色、暗部偏青、對比強 |
| Cinema (Yellow) | 琥珀黃調、端莊的電影感、柔和對比 |
| Cinema (Green) | 青綠冷調、冷靜的電影感 |
| Bleach Bypass | 低飽和、高對比、帶銀色金屬感 |
| Retro | 舊照片感：褪色泛黃、低飽和、暗角 |
| Cross Processing | 交叉沖洗：強烈色偏與高對比。提供 基本／洋紅／黃／綠 四種變體＋「隨機」按鈕 |
| HDR Tone | 局部對比極強，帶繪畫感 |

### 5.2 Ricoh GR IV HDF

與 GR IV 相同的 14 個濾鏡，但 HDF（高光擴散）預設開啟：亮部柔和暈開、整體夢幻。HDF 強度可調。

### 5.3 Ricoh GR IIIx（40mm）

12 個濾鏡，與 GR IV 同名者共用設定：Standard、Vivid、Monotone、Soft Monotone、Hard Monotone、Hi-Contrast B&W、Positive Film、Negative Film、Bleach Bypass、Retro、Cross Processing、HDR Tone。（沒有 Cinema 兩款。）提供 HDF 開關（對應 GR IIIx HDF）。

### 5.4 Ricoh GR IV Monochrome

全部為黑白。可調參數：對比、陰影、清晰度、色調（toning）、顆粒、**紅色濾鏡開關**（開啟時：藍天變暗、膚色與紅色物體變亮，用 channelMixer 實作）。

| 濾鏡 | 風格描述 |
|---|---|
| Standard | 灰階細膩、層次豐富 |
| Solid | 對比俐落、邊緣清晰紮實 |
| Soft | 柔和低對比 |
| Hi-Contrast | 高對比黑白 |
| Grainy | 銀鹽相紙感：高光受控、暗部深、顆粒明顯 |
| HDR Tone | 局部對比極強的黑白 |

### 5.5 Fujifilm X100VI（35mm）

可調參數（富士「底片配方」文化的核心，全部要做）：顆粒效果（弱/強 × 小/大）、Color Chrome Effect（關/弱/強）、Color Chrome FX Blue（關/弱/強）、白平衡偏移（R/B 各 ±9）、亮部色調、暗部色調、色彩、銳利度、清晰度。

| 濾鏡 | 風格描述 |
|---|---|
| PROVIA / 標準 | 中性自然、飽和適中 |
| Velvia / 鮮豔 | 高飽和高對比，風景向 |
| ASTIA / 柔和 | 對比柔和、膚色好看，藍天仍鮮 |
| Classic Chrome | 低飽和、藍綠壓暗偏青、紅色偏磚紅、暗部硬、高光柔，紀實感 |
| REALA ACE | 色彩忠實、對比偏硬、乾淨清楚 |
| PRO Neg. Hi | 人像向，比 Std 對比稍高 |
| PRO Neg. Std | 低對比、柔和、膚色自然 |
| Classic Neg. | 硬對比、暗部青綠、亮部偏洋紅暖、低飽和，濃濃日系底片感 |
| Nostalgic Neg. | 高光琥珀暖調、暗部細節保留、柔和懷舊 |
| ETERNA / 電影 | 低飽和、低對比、陰影平而深，電影感 |
| ETERNA Bleach Bypass | 極低飽和、高對比 |
| ACROS | 細緻高解像黑白、暗部深、顆粒細緻 |
| ACROS + Ye | ACROS＋黃濾鏡（藍天稍暗） |
| ACROS + R | ACROS＋紅濾鏡（藍天很暗、對比強） |
| ACROS + G | ACROS＋綠濾鏡（膚色與唇色較深） |
| Monochrome | 標準黑白 |
| Monochrome + Ye | 黑白＋黃濾鏡 |
| Monochrome + R | 黑白＋紅濾鏡 |
| Monochrome + G | 黑白＋綠濾鏡 |
| Sepia | 棕褐單色 |

### 5.6 Fujifilm GFX100RF（28mm，中片幅）

與 X100VI 相同的 20 個底片模擬與可調參數，共用設定。差異：
- 加一個「中片幅質感」微調：顆粒更細、色階過渡更平滑（例如曲線更柔、銳化半徑更大）。
- 提供多種畫面比例裁切，例如 3:2、4:3、1:1、16:9、65:24。

### 5.7 Leica Q3（28mm，全片幅）

可調參數（僅 Film Style 可調；Leica Looks 為固定效果，只開放強度）：對比、亮部、暗部、銳利度、飽和度。

**Film Style（5 種）**

| 濾鏡 | 風格描述 |
|---|---|
| Standard | 通透、對比適中，經典「徠卡味」：暗部深沉、色彩內斂 |
| Vivid | 飽和與對比提高，色彩濃郁 |
| Natural | 最忠實、低調的色彩 |
| B&W Natural | 自然層次的黑白 |
| B&W High Contrast | 高對比黑白，戲劇性強 |

**Leica Looks（需注意：實機一次只能載入部分 Looks，本站全部列出）**

| 濾鏡 | 風格描述 |
|---|---|
| Classic | 高對比、柔和飽和、暖色微褪，經典電影感 |
| Contemporary | 現代數位電影感，乾淨偏冷 ※依名稱推測 |
| Eternal | 對比強烈、飽和大膽、帶洋紅色調的現代感 |
| Pure | 自然、對比細微、輕盈平衡 |
| Cine | 暖調、底片質感、高光柔順、對比溫和 |
| Chrome | 正片感、色彩濃厚 ※依名稱推測 |
| Teal | 青橙色調 ※依名稱推測 |
| Brass | 黃銅暖金色調 ※依名稱推測 |
| Bleach | 漂白效果：低飽和高對比 ※依名稱推測 |
| Greg Williams | 攝影師聯名風格，高對比暖調紀實 ※依名稱推測 |
| Selenium | 硒調黑白（偏冷紫灰） ※依名稱推測 |
| Sepia | 棕褐黑白 |
| Blue | 藍調黑白 ※依名稱推測 |
| Silver | 銀灰調黑白 ※依名稱推測 |

標 ※ 的請照描述做出合理詮釋即可。

### 5.8 Sony RX1R III（35mm，全片幅）

Creative Look 12 種。可調參數：對比、亮部、暗部、褪色（fade）、飽和度、銳利度、清晰度。BW/SE 不可調飽和度。

| 濾鏡 | 風格描述 |
|---|---|
| ST（Standard） | 標準，適用各種場景 |
| PT（Portrait） | 降低銳利度，膚色柔和 |
| NT（Neutral） | 低飽和、低銳利，中性底色 |
| VV（Vivid） | 飽和與對比提高，花草藍天鮮明 |
| VV2（Vivid 2） | 明亮鮮豔、清透度高 |
| FL（Film） | 冷靜色彩配上銳利對比，天空與綠色有氛圍 |
| FL2（Film 2） | 對比略升、色彩收斂，懷舊感 |
| FL3（Film 3） | 對比強烈、色彩鮮明的正片感 |
| IN（Instant） | 壓低對比與飽和，霧面拍立得質感 |
| SH（Soft Highkey） | 明亮、通透、柔和又鮮豔 |
| BW（Black & White） | 黑白 |
| SE（Sepia） | 棕褐單色 |

### 5.9 Sony ZV-1 II

Creative Look 10 種，與 RX1R III 同名者共用設定：ST、PT、NT、VV、VV2、FL、IN、SH、BW、SE。

### 5.10 Sony RX100 VII（24–200mm）

可調參數：對比、飽和度、銳利度。

**Creative Style（13 種）**：Standard、Vivid、Neutral、Clear（清透亮部）、Deep（深沉濃厚）、Light（明亮輕盈）、Portrait（膚色柔和）、Landscape（藍綠鮮明、銳利）、Sunset（強調夕陽暖紅）、Night Scene（壓暗、降低對比）、Autumn Leaves（強調紅黃）、Black & White、Sepia。

**Picture Effect**：
- Toy Camera（Normal／Cool／Warm／Green／Magenta 五種變體：強暗角＋色偏＋高對比）
- Pop Color（極高飽和）
- Posterization（Color／B&W：色階分離）
- Retro Photo（褪色泛黃）
- Soft High-key（明亮柔和）
- Partial Color（Red／Green／Blue／Yellow：只保留單一色相，其餘黑白）
- High Contrast Mono（高對比黑白）
- Soft Focus（柔焦光暈）
- HDR Painting（繪畫感局部對比）
- Rich-tone Mono（豐富階調黑白）
- Miniature（上下模糊的移軸效果，可調清晰區位置）
- Watercolor（水彩暈染）
- Illustration（描邊插畫感）

### 5.11 Canon PowerShot G7X Mark III（24–100mm）

可調參數：銳利度、對比、飽和度、色調。

**Picture Style**：Auto、Standard、Portrait（膚色明亮甜美）、Landscape（藍綠鮮明）、Fine Detail（細節銳利）、Neutral（低飽和平實）、Faithful（忠實色彩）、Monochrome（附濾鏡效果：無／黃／橙／紅／綠；附色調效果：無／棕褐／藍／紫／綠）。

**Creative Filter** ⚠️ 此清單由規格撰寫者依記憶整理，請以「合理的趣味效果」實作即可：Grainy B/W（粗顆粒黑白）、Soft Focus（柔焦）、Fish-eye（魚眼變形）、Art Bold（濃烈油畫感）、Water Painting（水彩）、Toy Camera（玩具相機）、Miniature（移軸）。

### 5.12 Panasonic Lumix L10

可調參數：對比、亮部、暗部、飽和度、色調、銳利度、顆粒；外加柔膚效果開關。

**彩色 Photo Style**

| 濾鏡 | 風格描述 |
|---|---|
| Standard | 平衡的記憶色與忠實重現 |
| Vivid | 鮮豔 |
| Natural | 自然柔和 |
| L.Classic | 柔和低飽和、色階平滑，突顯綠色與光影細節，輕盈細膩 |
| L.ClassicNeo | 底片感：清爽的青色調、對比柔和、藍色微壓，通透 |
| L.ClassicGold | 琥珀暖調、對比平衡，懷舊光暈 |
| Flat | 低對比低飽和的平淡底色 |
| Landscape | 藍綠鮮明 |
| Portrait | 膚色好看 |
| Cinelike D2 | 電影感、寬動態、低對比 |
| Cinelike V2 | 電影感、對比較高 |
| Cinelike A2 | 電影感、介於兩者之間的柔和調性 |

**黑白 Photo Style（5 種）**

| 濾鏡 | 風格描述 |
|---|---|
| Monochrome | 標準黑白 |
| L.Monochrome | 豐富灰階、黑色俐落 |
| L.Monochrome D | 亮部與暗部強化，動態戲劇感 |
| L.Monochrome S | 溫和黑白，適合人像 |
| LEICA Monochrome | 黑白深邃對比 |

（V-Log、Like709、HLG 類為錄影用，不實作。）

**REAL TIME LUT**：放一個入口連到第 3 節第 7 點的 `.cube` 上傳功能。

### 5.13 Kodak Charmera（鑰匙圈相機）

這台的重點是「機身本身就很爛」：**所有濾鏡都先經過 lo-fi 機身處理**——縮到約 1440×1080、輕微柔化、雜訊、JPEG 壓縮感、略偏色、暗角。

| 濾鏡 | 風格描述 |
|---|---|
| 原色 | 只有 lo-fi 機身處理 |
| Black & White | 低階調黑白 |
| Cool Tone | 偏藍冷調 |
| Warm Tone | 琥珀暖調復古 |
| Pixel Yellow | 像素化＋色階分離，黃色單色調 |
| Pixel Red | 同上，紅色 |
| Pixel Blue | 同上，藍色 |
| Pixel Gray | 同上，灰色 |

另外：
- **4 款相框**：自行設計原創的復古底片風邊框。NEVER 使用 Kodak 字樣、Logo 或官方圖示。
- **日期戳記**：開關選項，橘紅色七段顯示器字體風格，放右下角。

## 6. 濾鏡設定資料格式（範例）

```js
{
  id: "gr4-positive-film",
  camera: "ricoh-gr-iv",
  name: "Positive Film",
  params: { saturation: 0.35, curve: [[0,0],[0.25,0.18],[0.75,0.85],[1,1]],
            shadowTint: { hue: 190, amount: 0.15 }, grain: { amount: 0, size: 1 } },
  adjustable: ["saturation","hue","key","contrast","sharpness","grain"]
}
```

相機也用同樣方式定義：`id`、名稱、等效焦距、一句描述、可調參數清單、共用濾鏡的引用（例如 GR IIIx 引用 GR IV 的同名濾鏡）。

## 7. 分階段執行與檢查點

**Phase 1：引擎**
完成上傳、WebGL2 管線全部 16 步、前後對比、原解析度下載，只先做 3 個濾鏡驗證（GR IV Hi-Contrast B&W、X100VI Classic Chrome、Charmera Pixel Blue）。
→ **停下來回報並等我確認。**

**Phase 2：全部濾鏡**
依第 5 節逐台相機補齊所有濾鏡與可調參數，完成 `/test.html` 總覽格。
→ 回報每台相機完成的濾鏡數量（應與本文件一致），**停下來等我確認。**

**Phase 3：介面與收尾**
UI 美化、手機 RWD、自訂 LUT、Charmera 相框與日期戳記、免責聲明。

每完成一個步驟輸出：`✅ [完成項目]`。

## 8. 驗收標準

- [ ] 第 5 節列出的每台相機、每個濾鏡都能選到並正確渲染（以 `/test.html` 逐一確認）
- [ ] 濾鏡間差異肉眼可辨，同相機內沒有兩個濾鏡看起來一樣
- [ ] 4000 萬畫素照片可以下載原解析度，且不當掉
- [ ] 預覽調整滑桿時維持流暢（目標 30fps 以上）
- [ ] 手機寬度 375px 可正常操作
- [ ] 全站沒有品牌 Logo，頁尾有免責聲明
- [ ] 照片全程不離開使用者裝置

## 9. 執行界線

- 只在本專案資料夾內建立與修改檔案。
- 安裝 npm 套件前先列出套件名稱與用途，等我確認。
- 刪除檔案、改動專案外任何東西之前，先問我。
- 遇到規格不清楚的地方，先照最合理的方式做並在回報中註明假設，不要卡住。
