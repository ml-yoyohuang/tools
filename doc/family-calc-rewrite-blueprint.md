# 重寫計畫：台灣親戚稱謂計算機 v2.0

> 撰寫日期：2026-06-21

## TL;DR

現有程式的核心邏輯缺陷導致無法正確計算台灣親戚稱謂：單一狀態標量無法表達多維家族分支，規則表不完整導致眾多邊界情況落後，性別與年齡資訊在計算中遺失。重寫方案建立在**結構化資料模型 + 路徑正規化 + 決策樹規則引擎**，分三個模組層次（核心邏輯、規則字典、UI 互動），並配合完整測試矩陣確保正確性。預期交付一個可擴展、可測試、結果透明的研究級計算機。

---

## 一、現有程式的六大根本缺陷

### 缺陷 1：單標量狀態無法表達多維分支

現有程式以單一字串 `coreState = 'me'` 追蹤計算狀態。這個設計根本上無法同時記錄**父系 / 母系 / 姻親**的分化。

**舉例**：
- 「媽媽的兄」和「爸爸的兄」輸入序列相似，但前者是「舅舅」，後者是「伯/叔」
- 在目前程式中兩者都坍縮為同一個狀態，導致結果混淆

---

### 缺陷 2：堂表邏輯不完整

堂/表前綴的偵測只在 `f_ob` / `m_ob` 兩個節點觸發（程式碼第 91-93 行），無法遞推。

**舉例**：
```
路徑：爸爸 → 爸爸 → 兄弟 → 兒子
期望：堂兄弟（父系）
實際：邏輯無法追蹤到這個深度，結果為「關係較遠」
```

---

### 缺陷 3：複合狀態規則表缺口

規則表是平面的 key-value，只定義了簡單組合。當狀態是複合字串（如 `f_os`）時，後續計算找不到對應規則，就拼接為 `f_os,s` 這樣的字串，進而顯示「關係較遠」。

**舉例**：
```
路徑：父 → 姊 → 子
狀態演變：me → f → f_os → f_os,s（規則表無此 key）
實際輸出：關係較遠 ❌
正確輸出：姑表兄弟（需正確追蹤父系+姑姑的子女）
```

---

### 缺陷 4：性別資訊收斂後無法復原

按鈕輸入時有性別資訊（兄 `ob` 與弟 `yb` 分開），但進入規則計算後，所有兄/弟統一轉為 `ob`，性別資訊被丟棄。後續步驟再也無法區分「爸爸的兄」（伯/叔，取決於年齡序）。

**舉例**：
```
路徑：父 → 兄（ob） 
路徑：父 → 弟（yb）
兩者在規則表都被映射為 f_ob，完全相同
→ 無法區分「伯父」vs「叔父」
```

---

### 缺陷 5：平輩年齡順序崩潰

`ob+yb = 'yb'` 這條規則把「兄的弟」壓縮為「弟」，丟失了路徑資訊。當路徑繼續延伸時，年齡序資訊已無法追蹤。

---

### 缺陷 6：姻親關係短路（邏輯錯誤）

部分規則將姻親路徑直接等價為直系路徑：

```javascript
'osh+f': 'f'  // 姊夫的父親 → 爸爸 ❌（應為遠親）
'obw+f': 'f'  // 嫂嫂的父親 → 爸爸 ❌（應為遠親）
```

這讓「姊夫的父親」等於「自己的父親」，是明確的邏輯錯誤。

---

## 二、具體 Bug 案例（已驗證）

| 輸入路徑 | 現有程式輸出 | 正確輸出 | 問題根因 |
|---------|-----------|--------|--------|
| 姊 → 夫 → 父 | 爸爸 ❌ | 妹婿的爸爸（遠親）| 姻親短路規則 |
| 父 → 父 → 兄弟 | 關係較遠 ❌ | 伯祖父 / 叔祖父 | 複合狀態缺規則 |
| 父 → 兄 → 子 | 不穩定（運氣決定）| 堂哥 / 堂弟（視性別）| 堂表邏輯不完整 |
| 父 → 姊 → 子 | 關係較遠 ❌ | 表哥（姑表）| 複合狀態 f_os+s 無規則 |
| 母 → 兄弟 → 子 | 不穩定 | 表哥（舅表）| 母系分支計算錯誤 |

---

## 三、重寫架構設計

### 核心理念

> 把「按鈕序列」轉換為「結構化路徑物件」，再由「決策樹引擎」轉換為「稱謂結果」，永遠不丟失任何資訊。

### 資料流

```
使用者按鈕序列
    ↓
[path-normalizer.js]  ← 路徑正規化（保留性別、年齡序、家系線）
    ↓
CanonicalPath[]
    ↓
[calculator-core.js]  ← 折疊為單一 CanonicalState
    ↓
CanonicalState: { gen, side, role, gender, ageOrder, ... }
    ↓
[kinship-rules.js]    ← 決策樹規則引擎
    ↓
KinshipResult: { primary, alternatives, confidence, reasoning }
    ↓
[ui-renderer.js]      ← 渲染主稱謂 + 候選稱謂
```

---

### 核心資料型別（`kinship-types.js`）

```javascript
// 路徑中每一步的結構化節點
Ancestor = {
  relationType: 'parent' | 'sibling' | 'child' | 'spouse' | 'spouse_kin',
  gender:       'M' | 'F' | 'unknown',
  ageOrder:     'older' | 'younger' | 'unknown',  // 相對於路徑前一步
  lineageSide:  'paternal' | 'maternal' | 'affinal' | 'mixed',
  marriedIn:    boolean
}

// 折疊後的正規化計算狀態
CanonicalState = {
  generation:   number,           // 正數=長輩，負數=晚輩，0=平輩
  lineageSide:  string,
  coreRole:     string,           // 'parent' | 'uncle' | 'cousin' | ...
  gender:       'M' | 'F' | 'unknown',
  ageOrder:     'older' | 'younger' | 'unknown',
  affinalType:  null | 'spouse' | 'via_spouse' | 'spouse_kin'
}

// 最終輸出
KinshipResult = {
  primary:      string,           // 主稱謂
  alternatives: string[],         // 候選稱謂（曖昧時）
  confidence:   number,           // 0-100
  reasoning:    string            // 推理過程說明
}
```

---

### 決策樹規則引擎（`kinship-rules.js`）

取代目前的平面 key-value 表，改為級聯函數：

```javascript
RuleEngine.evaluate(canonicalState) {
  const { gen, side, role, gender, ageOrder } = canonicalState;

  // 直系長輩
  if (gen === 1 && role === 'parent' && gender === 'M') 
    return { primary: '爸爸', confidence: 100 }
  if (gen === 2 && side === 'paternal' && role === 'parent' && gender === 'M') 
    return { primary: '阿公', confidence: 100 }

  // 旁系長輩（伯/叔的曖昧處理）
  if (gen === 1 && side === 'paternal' && role === 'sibling' && gender === 'M' && ageOrder === 'older')
    return { primary: '伯父', alternatives: ['伯伯'], confidence: 95 }
  if (gen === 1 && side === 'paternal' && role === 'sibling' && gender === 'M' && ageOrder === 'younger')
    return { primary: '叔父', alternatives: ['叔叔'], confidence: 95 }
  if (gen === 1 && side === 'paternal' && role === 'sibling' && gender === 'M' && ageOrder === 'unknown')
    return { primary: '伯父', alternatives: ['叔父'], confidence: 50 }  // 明確標示曖昧

  // 堂表親（世代 0，帶前綴）
  if (gen === 0 && side === 'paternal' && role === 'sibling' && gender === 'M' && ageOrder === 'older')
    return { primary: '堂哥', confidence: 90 }
  if (gen === 0 && side === 'maternal' && role === 'sibling' && gender === 'F' && ageOrder === 'younger')
    return { primary: '表妹', confidence: 90 }

  // ... 以此類推，共 100+ 條規則
}
```

### 信心度分級

| 等級 | 範圍 | 意義 | UI 顯示 |
|-----|------|------|--------|
| 🟢 確定 | 95-100% | 所有維度已知，規則完全匹配 | 只顯示主稱謂 |
| 🟡 可能 | 70-94% | 年齡序不明確，有候選 | 主稱謂 + 候選 |
| 🟠 曖昧 | 40-69% | 多個維度不明確 | 候選清單 + 說明 |
| 🔴 描述 | < 40% | 太遠或太罕見 | 描述性文字 |

---

## 四、檔案結構

```
family-calc/
├── index.html                     # 主頁（UI 結構，載入模組）
├── src/
│   ├── kinship-types.js           # 型別定義（Ancestor, CanonicalState, KinshipResult）
│   ├── path-normalizer.js         # 路徑正規化（保留性別、年齡序、家系線）
│   ├── kinship-rules.js           # 決策樹規則引擎 + 稱謂字典（100+ 條）
│   ├── alias-resolver.js          # 地區變體與同義詞（台灣標準、客家、閩南）
│   ├── reciprocal-calculator.js   # 雙向稱謂計算（伯父 ↔ 姪子）
│   ├── calculator-core.js         # 核心計算（正規化 → 折疊 → 查詢 → 結果）
│   ├── ui-controller.js           # 事件驅動與狀態管理
│   └── ui-renderer.js             # DOM 渲染（主稱謂 + 候選稱謂 + 信心度）
├── test/
│   ├── normalizer.test.js         # 路徑正規化測試
│   ├── rules.test.js              # 規則引擎測試
│   ├── reciprocal.test.js         # 雙向驗證測試
│   ├── calculator.test.js         # 核心計算整合測試
│   └── ui.test.js                 # UI 層測試
└── data/
    ├── kinship-terms.json         # 稱謂字典（查詢用）
    └── test-cases.json            # 測試用例參考清單（121 條）
```

---

## 五、實作階段

### Phase 1：資料模型與路徑正規化（關鍵路徑）

**目標**：建立結構化路徑表達，絕不遺失性別、年齡、家系線資訊。

**任務**：
1. 定義 `Ancestor`, `CanonicalState`, `KinshipResult` 型別
2. 實作 `PathNormalizer`：
   - 每個按鈕輸入 → 附加 `{relationType, gender, ageOrder, lineageSide}` 屬性
   - 偵測並標記 `lineageSide` 分化（父系 / 母系 / 姻親）
   - 偵測無效路徑（循環、倒序世代）
3. 建立 30 個正規化測試，驗證資訊不遺失

**成功標準**：所有測試通過；無任何性別或年齡資訊在正規化步驟中被丟棄

---

### Phase 2：決策樹規則引擎（可與 Phase 1 並行）

**目標**：以完整規則集取代現有的殘缺平面表。

**任務**：
1. 列舉 50 個 `CanonicalState` 原型，對應台灣稱謂
2. 撰寫決策樹（`kinship-rules.js`），每個節點有 `confidence` 與 `alternatives`
3. 建立 `alias-resolver.js`，支援地區變體查詢
4. 建立 120 個規則測試

**成功標準**：50 個原型全部匹配；6 個已知 Bug 全部修復

---

### Phase 3：雙向稱謂驗證（依賴 Phase 1+2）

**目標**：確保正反稱謂邏輯自洽。

**任務**：
1. 建立雙向映射表（parent↔child, uncle↔nephew 等）
2. 函數 `getReverseKinship(path)` 計算反向稱謂
3. 30 個雙向驗證測試

**成功標準**：若 A→B 是「伯父」，則 B→A 必須是「侄子」

---

### Phase 4：UI 重構（依賴 Phase 1-3）

**目標**：顯示主稱謂 + 候選稱謂，保持現有外觀設計。

**任務**：
1. `ui-controller.js`：替換全域狀態為 `KinshipResult` 物件
2. `ui-renderer.js`：
   - 主稱謂大字顯示
   - 信心度 < 95% 時顯示候選稱謂選單
   - 信心度指示器（色彩）
3. HTML 新增候選稱謂 `<div>` 區塊，保留原設計

**成功標準**：UI 反應 < 50ms；候選稱謂正確出現/隱藏

---

### Phase 5：整合測試與驗收

**測試矩陣**（121 個測試用例）：

| 類型 | 數量 | 驗證項 |
|-----|------|--------|
| 單按鈕 | 8 | 基礎稱謂正確 |
| 二按鈕（平輩/上一代） | 40 | 性別/年齡/家系線保留 |
| 三按鈕（堂表/遠親） | 25 | 堂/表分化、罕見稱謂 |
| 姻親鏈 | 12 | 姻親不崩潰為直系 |
| 無效路徑 | 6 | 適當錯誤提示 |
| 雙向驗證 | 30 | 正反稱謂自洽 |
| **總計** | **121** | — |

---

## 六、實作順序與並行關係

```
Phase 1（關鍵路徑）
  ├─ kinship-types.js ──────┐
  │                          ├→ path-normalizer.js → test/normalizer.test.js
  └─ test 環境設定 ──────────┘

Phase 2（與 Phase 1 並行）
  kinship-rules.js + alias-resolver.js → test/rules.test.js

Phase 3（依賴 Phase 1+2）
  reciprocal-calculator.js → test/reciprocal.test.js

Phase 4（依賴 Phase 1-3）
  calculator-core.js + ui-controller.js + ui-renderer.js → index.html

Phase 5（依賴 Phase 4）
  整合測試 + 驗收
```

---

## 七、現有程式 → 新方案對照表

| 現有問題 | 舊程式位置 | 新方案位置 | 解決方式 |
|---------|----------|----------|--------|
| 單標量狀態 | `let coreState = 'me'` | `kinship-types.js` | `CanonicalState` 多維物件 |
| 堂表邏輯不完整 | 程式碼 91-93 行 | `path-normalizer.js` | 路徑正規化時持續追蹤家系線 |
| 複合狀態缺規則 | 程式碼 57-76 行規則表 | `kinship-rules.js` 決策樹 | 級聯函數取代平面表 |
| 性別資訊遺失 | `add('ob', '兄')` → `ob` | `path-normalizer.js` | 保留 `{gender: 'M', ageOrder: 'older'}` |
| 年齡順序崩潰 | `ob+yb='yb'` | `path-normalizer.js` | 追蹤序列，不簡化 |
| 姻親短路錯誤 | `osh+f: 'f'` 等規則 | `kinship-rules.js` | 姻親路徑獨立分支，不合併直系 |

---

## 八、風險與緩解

| 風險 | 發生率 | 影響 | 緩解策略 |
|-----|--------|------|--------|
| 規則表仍有缺口 | 中 | 中 | Phase 2 建立參考書目，逐項驗證；信心度低時顯示描述性後備 |
| 路徑正規化引入迴歸 | 低 | 高 | 快照測試 + 對比舊程式輸出 |
| UI 整合困難 | 低 | 中 | 核心邏輯與 UI 完全分離；Phase 4 前先確認 API 穩定 |
| 地區變體需求爆炸 | 高 | 低 | `alias-resolver.js` 設計為易擴展；建立回饋機制 |

---

## 九、驗收標準

- ✅ 121 個測試用例全部通過
- ✅ 現有 6 大 Bug 全部修復（可對照「具體 Bug 案例」表格）
- ✅ 候選稱謂正確出現（信心度 < 95% 時）
- ✅ 單次計算 < 10ms
- ✅ UI 反應流暢 < 50ms
- ✅ 代碼模組化，各層可獨立測試
- ✅ 稱謂字典 100+ 項（含罕見稱謂與地區變體）

---

## 十、預計工時

| 階段 | 工時 |
|-----|------|
| Phase 1：資料模型 + 正規化 | 2-3 小時 |
| Phase 2：規則引擎 + 字典 | 2-3 小時 |
| Phase 3：雙向稱謂 | 1 小時 |
| Phase 4：UI 重構 | 1-2 小時 |
| Phase 5：整合測試 | 1 小時 |
| **總計** | **7-10 小時** |
