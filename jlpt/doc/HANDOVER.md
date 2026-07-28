# N1 PassMaster 專案交接文件

> 交接對象：接手維運/開發此專案的另一個 AI agent
> 撰寫時間：2026-07-28
> 專案路徑：`E:/projects/tools/jlpt`

---

## 1. 這個專案是什麼

**N1 PassMaster** 是一個 JLPT N1（日檢最高等級）備考用的 PWA（漸進式網頁應用），核心賣點是「真實掌握度追蹤」與「倒數天數動態排程」——不是傳統的刷題App（看過就算完成），而是要求連續答對2次才算真正掌握。

這個專案位在 `E:/projects/tools`（monorepo，git remote 是 `ml-yoyohuang/tools`）底下的 `jlpt/` 子目錄。**這裡有個重要的架構背景需要知道**：

這個monorepo裡其他約50個工具**全部都是單一自包含的HTML檔案**（例如 `clock.html`、`bpm.html`、`pikmin_timer.html`），沒有build流程、沒有node_modules，直接用瀏覽器打開就能跑。`jlpt/` 是**唯一的例外**——使用者的原始需求明確要求要有 Pinia store 做排程演算法、Dexie.js 做離線進度儲存，所以我們一開始就跟使用者確認過，刻意選擇打破monorepo慣例、建立完整的 Vite 專案。**不要「修正」jlpt去配合其他工具的單檔案風格，這個差異是刻意的決定。**

目前monorepo首頁 `tools/index.html` **完全沒有連結到jlpt**——這個工具做完了但使用者從入口網站點不到，是已知但目前未處理的缺口。

---

## 2. 技術棧與環境地雷

### 2.1 技術選型
Vite 5 + Vue 3（`<script setup lang="ts">`）+ Pinia + Dexie.js（IndexedDB封裝）+ vue-router 4 + Tailwind CSS v4（`@tailwindcss/vite`）+ `vite-plugin-pwa` + lucide-vue-next（圖示）。

### 2.2 版本地雷（非常重要）
這台機器的 Node 版本是用 **nvm-windows（nvm4w）** 管理的，**會在session之間甚至同一個session內悄悄改變**（我遇過從 v20.0.0 被切到 v16.14.2，導致 `npm run build` 因為 Tailwind v4 工具鏈需要的 `module.isBuiltin`（Node 16.17+才有）而整個報錯，錯誤訊息長得很像程式碼壞掉，但其實跟程式碼一點關係都沒有）。

**如果build突然報一堆莫名其妙的ESM/module錯誤，先跑 `node -v` 確認版本，不是先懷疑自己改壞了程式碼。** 修正方式：
```powershell
nvm use 20.0.0
```
（要用PowerShell工具跑這行，不是Bash——nvm4w是Windows工具，Bash環境下的node可能對不上。）

也因為這個原因，`create-vite@latest`、最新版 `vite-plugin-pwa`、最新版 `vue-router` 都跟這台機器的舊Node版本不相容，目前鎖定的版本是：
- `create-vite@5`（scaffold時用的，之後不會再用到）
- `vite-plugin-pwa@1.3.0`
- `vue-router@4`（v5要求Vite 7/8，這裡是Vite 5）

**不要隨手升級這些套件版本**，除非你先確認過Node版本相容性。

### 2.3 package.json裡沒有的東西
`tsconfig.app.json` 裡有 `resolveJsonModule: true`——這是題庫還是用static import時期留下的設定，現在題庫改成fetch了理論上用不到，但留著無害，沒必要特地移除。

---

## 3. 檔案地圖

```
jlpt/
├── public/
│   ├── data/n1-questions.json    ← 題庫本體（2007題，1.6MB+），fetch時期讀這裡
│   └── icons/icon.svg            ← PWA圖示
├── src/
│   ├── types/question.ts         ← Question介面定義（唯一的schema來源）
│   ├── db/db.ts                  ← Dexie schema：questions / user_progress / exam_config / daily_stats 四張表
│   ├── utils/date.ts             ← todayKey()、daysBetween()
│   ├── utils/srs.ts              ← SRS間隔複習演算法、紅黃燈風險分級
│   ├── stores/
│   │   ├── useQuizStore.ts       ← 題庫載入、掌握度計算、答題記錄、書籤/不確定/筆記
│   │   └── useSchedulerStore.ts  ← 倒數天數三階段判斷、每日排程目標題數
│   ├── composables/useDarkMode.ts
│   ├── router/index.ts           ← 3條路由：/ /quiz /bookmarks
│   ├── views/
│   │   ├── HomeView.vue          ← 首頁儀表板（倒數卡片、雙軌進度條、分類掌握度、快刷入口）
│   │   ├── QuizView.vue          ← 答題頁（支援 daily/mock/micro/wrong/bookmark/uncertain/note 七種mode）
│   │   └── BookmarkView.vue      ← 錯題本（全部錯題/紅燈/黃燈/收藏/不確定/筆記六個分頁）
│   └── components/
│       ├── AppNav.vue            ← 底部導覽列 + 深色模式切換
│       ├── DualProgressBar.vue / CategoryMasteryList.vue / RiskBadge.vue
│       └── quiz/QuizCard.vue     ← 答題卡片本體（發音/不確定/收藏/筆記按鈕、選項、即時解析、滑動切換）
└── vite.config.ts                ← PWA manifest、workbox設定（含maximumFileSizeToCacheInBytes）
```

**沒有測試檔案**，這個專案目前的「驗證」全部靠：`vue-tsc` 型別檢查 + `vite build` + 瀏覽器手動跑一輪。詳見第10節。

---

## 4. 題庫資料模型與現況

### 4.1 Schema（`src/types/question.ts`）
```ts
type QuestionCategory = 'vocabulary' | 'grammar' | 'reading'
interface Question {
  id: string                              // 例："n1_vocab_1206"
  category: QuestionCategory
  subCategory: string                     // 自由字串，見4.3
  readingText: string | null              // 短文/長文/文章文法用，其餘為null
  question: string
  options: [string, string, string, string]
  answer: 0 | 1 | 2 | 3
  explanation: { translation, detail, keyPoint }  // 皆為繁體中文
}
```

### 4.2 題庫現況（2026-07-28夜間，總計 **2007題**）
| category | 題數 | 說明 |
|---|---|---|
| vocabulary | 1475 | 5題seed + 200題慣用句/四字熟語/複合動詞 + 1200題動詞/副詞/擬態語/抽象名詞（單字庫segment 1-6）+ 70題模擬考單字 |
| grammar | 258 | 5題seed + 198題（100核心句型×~2）+ 60題模擬考文法（30新句型） |
| reading | 274 | 5題seed + 200題讀解題庫 + 69題模擬考讀解 |

### 4.3 subCategory 分類慣例（**不是schema強制，是純字串慣例，之後加題要照這個規則**）
- vocabulary：`動詞`／`副詞`／`擬態語`／`抽象名詞`（單字庫segment用）；`慣用句（身体部位）`／`四字熟語`／`複合動詞`（片語庫用）；還有5題seed用的`漢字読み`／`文脈規定`／`類義語`／`語彙用法`／`漢字表記`（這是題型分類，不是詞性分類，是兩套不同邏輯並存，因為seed是先做的）
- grammar：`文法接続（〜句型〜）` 或 `文章文法（接続表現）`／`文章文法（接続表現：〜句型〜）`
- reading：`内容理解（短文）`／`内容理解（中文）`／`内容理解（長文）`／`統合理解`／`主張理解（長文）`／`情報検索`／`長句挿入（文脈把握）`

**已知的小資料瑕疵**：`n1_grammar_172` 的 subCategory 打成了「文法接**續**」（用了繁體字的續，其他所有題目都是用日文原字「続」），導致這個bucket被拆成兩筆統計。無傷大雅但如果你要做「依subCategory統計」的功能，會看到這個異常，順手改成`続`就好，不用大驚小怪。

### 4.4 讀解的「一篇文章多題共用readingText」設計
讀解題庫大量使用「一篇長文對應2-3個question物件、readingText內容完全相同」的模式（例如一篇1000字長文配3道不同問題）。**這是刻意設計、不是bug**，QuizCard.vue本來就是每題各自獨立渲染readingText，不需要為了「去重複」而合併它們。跑資料品管腳本時，去重複的key要用 `question + readingText` 的組合（不能只看readingText，否則會誤刪同一篇文章底下的不同題目）。

---

## 5. 核心邏輯

### 5.1 useSchedulerStore.ts — 倒數天數三階段
```
remainingDays = daysBetween(today, targetExamDate)
phase:
  > 60天  → foundation（溫和打底期）：每日15題新題 + SRS到期複習題
  30~60天 → sprint（衝刺強化期）：每日目標 = ceil((未掌握總題數+高危錯題數) / 剩餘天數)
  < 30天  → rescue（考前急救期）：強制只出錯題池，不再派新題，isMockExamMode=true
```
`dailyTargetCount` 是「微觀進度」進度條的分母。`todayQuestionPool` 是依phase決定的當日題目池。

### 5.2 useQuizStore.ts — 掌握度與答題記錄
- **掌握定義**：`correctStreak >= 2`（連續答對2次），答錯會把 `correctStreak` 歸零、`wrongCount+1`
- **紅黃燈**（`src/utils/srs.ts` 的 `riskLevel()`）：`wrongCount>=3`紅燈、`wrongCount>=1`黃燈
- **SRS複習間隔**：`[1,2,4,7,15,30]`天，依 `correctStreak` 對應到interval index（封頂在陣列長度）
- **`wrongQuestions`** computed 的過濾條件是 `wrongCount>0 && correctStreak<2`——**這是修過的bug**，最早版本只看wrongCount>0，會導致已經連續答對2次「應該消除錯題標籤」的題目還留在錯題本裡，見第6節
- **`init()`** 會 `await fetch('/data/n1-questions.json')` 然後對Dexie做**無條件**的 `bulkPut`（不是「資料庫是空的才寫入」），這也是修過的bug，見第6節

### 5.3 QuizView.vue 的七種mode
`daily`（今日排程）／`mock`（模擬考，重用錯題池+有倒數計時）／`micro`（3分鐘隨機10題）／`wrong`（錯題重測，可加`risk=red/yellow`篩選）／`bookmark`（收藏重測）／`uncertain`（不確定題重測）／`note`（筆記題重測）

---

## 6. 已經踩過並修好的坑（不要走回頭路）

1. **Dexie種子資料不會同步新題**：最早`quizStore.init()`寫成「`db.questions.count()===0`才`bulkPut`」，導致題庫檔案增加後，舊使用者的IndexedDB永遠不會拿到新題目（因為count早就不是0了）。**已改成無條件bulkPut**（`db.questions.bulkPut`每次都跑，靠id當primary key做upsert）。**不要把它改回「只在空的時候寫入」**。

2. **QuizView直接網址進入會拿到空題目池**：原本 `queue = ref(buildQueue())` 是在store可能還沒`init()`完成時就先算好，如果使用者是直接reload `/quiz` 網址（不是從首頁點連結過去），store資料還沒載入完，會拿到空陣列。**已改成 `onMounted` 裡 `await quiz.init()` + `await scheduler.init()` 之後才 `buildQueue()`**。

3. **錯題不會消失**：`wrongQuestions` computed 原本只濾 `wrongCount>0`，沒有排除已經達到 `correctStreak>=2`消除門檻的題目，導致答對兩次後題目還賴在錯題本。**已加上 `correctStreak<2` 條件**。

4. **主程式bundle因為題庫變大而膨脹到818KB**：題庫原本是 `import questionsData from '@/data/n1-questions.json'` 靜態引入，題庫越做越大、bundle跟著變大。**已改成把json搬到 `public/data/`、在`quizStore.init()`裡用`fetch()`在執行時讀取**，bundle固定維持在206KB，題庫再大也不影響。同時把 `vite.config.ts` 裡 workbox 的 `maximumFileSizeToCacheInBytes` 從預設2MB調高到8MB（題庫已經1.6MB+，超過2MB會導致PWA離線快取悄悄失敗）。**如果你看到有人把題庫改回static import，那是在開倒車，不要這樣做。**

5. **AI生成題目的答案位置嚴重偏向索引0**：不管是文法題、單字題還是讀解題，只要是AI一次生成4個選項+標記答案，答案幾乎都會被放在選項0（觀察到最高94%集中在索引0的案例）。**每次合併新題目時都要跑決定性洗牌（mulberry32 seeded PRNG，不是`Math.random()`，這樣結果可重現）把四個選項打散、同步更新answer索引**，不要只做去重複跳過這一步。

6. **中文說明裡的半形雙引號會弄壞JSON**：早期批次曾發生agent在繁體中文解析文字裡直接打半形雙引號 `"` 當引號用（例如寫成 `"以某種方式穿"`），這樣字串會提前結束，整個JSON檔案解析失敗。**現在每個生成題目的prompt都必須明確要求「所有JSON字串值內部絕對不可以出現半形雙引號，中文說明要用「」全形引號」，並要求agent自己用JSON.parse驗證過再回報完成**。這條規則不要省略。

---

## 7. 如果要繼續擴充題庫：標準作業流程（SOP）

這是這幾天實際跑了8輪之後穩定下來的流程（文法題庫100句型、片語題庫、單字庫segment 1~6、讀解題庫、模擬考題庫都是這樣做的）：

1. **手動curate內容清單**（單字表/文法句型表/文章主題），對照 `public/data/n1-questions.json` 現有的subCategory內容，確認不重複。單字庫做到segment 6之後，高頻常見詞已經用得差不多，會越來越花時間才能找到夠格的新詞，這是正常現象不是你做錯。
2. **用 `Agent` tool 開 ≤10 個並行agent**（見第8節「使用者的特殊規則」，這是硬性約定，超過10個一定要先問使用者）。每個agent的prompt裡要包含：
   - 完整的schema欄位說明（照第4.1節）
   - 明確的subCategory命名規則
   - 「所有JSON字串值內部絕對不可以出現半形雙引號」的警告（見第6節第5點）
   - **要求agent完成後直接用Write工具把JSON陣列寫入指定的暫存檔路徑**（不要讓agent把內容原封不動回傳到對話裡再由你重新輸出一次——那樣等於把同樣的內容輸出兩遍，浪費token）
   - 要求agent自己跑一次JSON.parse驗證再回報done
3. **自己驗證每個batch檔案**能被JSON.parse解析（一行node指令掃過去就好，不需要另開agent）
4. **寫一個Node合併腳本**，依序做：
   - junk偵測（`options`裡出現單一英文字母如`"a"`、question等於`placeholder`/`test`等字樣，直接判定為假資料濾掉）
   - 去重複（用 `question + readingText` 組合當key，同時比對batch內部重複與現有題庫重複）
   - 用mulberry32決定性洗牌打散四個選項、同步更新answer索引
   - 依序指派唯一id（**先查現有題庫裡該category的最大數字id**，例如 `n1_vocab_1275` 之後接 `1276`——**注意id字串排序跟數字排序不一樣，`n1_vocab_999` 字串排序會排在 `n1_vocab_1006` 前面，一定要用 `parseInt(id.replace(prefix,''))` 取數字比大小，不要直接對id字串排序找最大值**）
   - 寫回 `public/data/n1-questions.json`
5. **跑 `npx vue-tsc -b` 和 `npm run build`**，確認main JS chunk維持在~206KB（沒有變大代表題庫還是用fetch而不是被打包進去）
6. **開發伺服器 + 瀏覽器實測**：檢查IndexedDB的`db.questions.count()`等於預期新總數、`/quiz?mode=micro`隨機抽題幾次確認能抽到新內容、答題流程與解析顯示正常、console沒有錯誤
7. 清掉 `dist/`、停掉preview server

**注意**：所有合併腳本、批次JSON檔案都是寫在系統暫存目錄（scratchpad），**不是這個repo的一部分**，你接手後不會在專案裡找到這些腳本檔案——每次要擴充題庫都要重新寫一份（或請上一個agent交接時把腳本樣板留給你，但目前它們只存在於對話session的暫存區）。

---

## 8. 使用者的特殊用語與工作習慣

- **「≤10個agent不用先問，超過要先問」**：這是使用者明確定下的硬性規則（原話：「以後你想要派出超過10個agent請先詢問我。我很窮。請盡量規劃不用太傷token的開發方式」）。背景是曾經跑過一次210個agent的Workflow（10生成+200個別驗證），花費超出預期。**預設不要用Workflow工具**，改用Agent tool分批（每批≤10個），品質把關靠自動化腳本（去重複/去假資料/洗牌）+ 你自己的抽查，不要再開額外的「驗證agent」。
- 使用者很在意token/成本效率，會直接說「這樣會不會太傷token」，回答時可以主動提出省token的替代方案。
- 使用者的溝通風格：會給出明確的分階段指示（例如「先列計畫，等我確認OK後才開始」），也會中途打斷確認進度（「Task B是什麼?完成了嗎?」），習慣用繁體中文＋台灣用語溝通。
- 使用者用「XX段」指單字庫的批次（segment 1~6），每段=100個新詞×2題=200題。
- 使用者用「Task A/B/C」指某一輪計畫裡的子任務，這只是當次對話裡的臨時代號，不是專案裡的正式術語，不要以為程式碼裡會找到對應命名。
- **回覆一律使用繁體中文及台灣在地用語**（這是組織層級設定，不是使用者個人偏好，但同樣適用）。

---

## 9. 目前明確尚未完成的項目

1. **PWA離線安裝與測試指引文件**——使用者原始5步驟計畫裡的第5步，一直沒做，使用者說「之後有空再做」，明確排除在目前範圍外。
2. **Monorepo首頁 `tools/index.html` 沒有連結到jlpt**——工具做完了但入口網站找不到，目前沒人處理。
3. 單字庫理論上可以無限做下去（原始研究抓的方向是「動詞/副詞/擬態語/抽象名詞」核心1200題，目前已經1200題+70題模擬考=1270題左右，早就超過原訂目標，是否要繼續完全看使用者意願，不要自己主動假設要繼續）。
4. 沒有任何自動化測試（unit test / e2e test），驗證完全依賴手動flow（見第7節第5-6步），如果要加測試框架是全新的工作，不是「補完」既有東西。

---

## 10. 開發時的驗證清單（每次改動後都要跑）

```bash
cd E:/projects/tools/jlpt
npx vue-tsc -b        # 型別檢查，應該無輸出（無錯誤）
npm run build          # 應該成功，注意main chunk是否還在~206KB
rm -rf dist             # 清掉build產物（build只是用來驗證，不需要留著）
```

瀏覽器驗證（用 `preview_start` 起 `jlpt-dev` 這個launch.json設定跑起來，見 `.claude/launch.json`）：
- 開 `/` 確認首頁儀表板正常
- 開 `/quiz?mode=micro` 隨機抽題，確認能正常作答、看到解析
- 開 `/bookmarks` 確認錯題/收藏/筆記分頁正常
- 檢查瀏覽器console沒有錯誤（`read_console_messages` with `onlyErrors: true`）
- 如果改了題庫資料，額外用這段JS確認IndexedDB題數對得上：
```js
new Promise((resolve) => {
  const req = indexedDB.open('N1PassMasterDB');
  req.onsuccess = (e) => {
    const db = e.target.result;
    const tx = db.transaction('questions', 'readonly');
    db.transaction('questions').objectStore('questions').count().onsuccess = (ev) => resolve(ev.target.result);
  };
})
```

驗證完務必 `preview_stop` 停掉伺服器、`rm -rf dist` 清產物，不要留著佔用資源。
