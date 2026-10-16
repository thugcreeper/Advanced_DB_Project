# 行政區統計篩選 API

更新：2026-10-16（Asia/Taipei）

## 路徑與完整流程

- GET `/api/districts/statistics/options?county=臺南市`：類別、地區與資料範圍提示。
- POST `/api/districts/statistics/search`：完整 JSON 篩選。

Controller 綁定 StatisticsFilter → Service 驗證地區、類別、scope、數值及排序 → Repository.search(parameters) → 參數化 Cypher 篩選 → Service 正規化／防禦檢查 → 前端依已套用條件產生表格與 CSV。
結果查詢已不再先取得 368 區全量資料再只靠 Java 篩選；options 的範圍計算另行處理。

```json
{
  "county": "臺南市",
  "districtCode": "",
  "specialties": [
    {"category": "中醫婦科", "scope": "all", "count": {"min": 1}},
    {"category": "內科", "scope": "all", "count": {"min": 1}}
  ],
  "specialtyMatch": "or",
  "personnel": {"category": "護理師", "scope": "all", "count": {"min": 1}},
  "income": {"min": 0},
  "population": {"min": 1, "max": 300000},
  "area": {"min": 0, "max": 100},
  "hospitals": {"max": 10},
  "clinics": {"min": 0},
  "sort": [{"field": "income", "direction": "desc"}]
}
```

範例展示可用欄位，不代表預設同時套用這些條件。縣市／行政區省略表示不限制；行政區代碼必須屬於指定縣市。地區代碼為字串。

## 科別與人員規則

specialties 最多 45 個不同的有效政府統計科別；每項提供 category、scope 及可選 count.min/max。拒絕 null、重複、未知類別及不一致的 scope。
舊單科 specialty 仍接受，但不能與非空 specialties 同時提供。前端統一送 specialties。

scope 為 hospital／clinic／all。all 是同一科別的醫院＋診所合計，不要求行政區同時有兩種院所。
所選科別／人員的所選範圍數量必須大於 0，即使未填 min 或填 min=0 仍會排除零值；更高下限繼續生效。

- specialtyMatch=or：任一科別符合數量條件即列出；未符合的其他已選科別仍回傳自己的 0／分項值。
- specialtyMatch=and：同一行政區每個所選科別都符合。
- 人員條件與科別條件採 AND；人員未選不套用，也不顯示所選人員欄。
- AND 不表示同一家院所提供所有科別；不同科別不相加為不重複院所數。

科別只讀 RECORD_DEPARTMENT 的 r.類型、r.數量；人員只讀 RECORD_PERSONNEL 的人員類別、r.類型、r.數量。HAS_DEPARTMENT 不參與政府科別統計。

## Cypher 篩選與排序

地區先在 MATCH 後以 $county、$districtCode 篩選。各統計關係族分開聚合，避免交叉相乘。
每個已選科別分別聚合醫院與診所數，依 $scope 得到 selected，再用 any/all 判斷 $specialtyMatch。人員及所得、人口、面積、院所數範圍也在 Cypher WHERE 套用。

所有使用者值均為參數；ORDER BY 僅由服務端白名單的欄位與 asc/desc 組成，最多三項，缺值置後，最後以行政區名稱穩定排序。多科別的 specialty 排序以首個所選科別 selected 為準，前端明示該名稱，不使用跨科別總和。
範圍 min/max 均包含等號；人口、家數、人數須非負整數，所得／面積可為非負小數。合法但超出資料範圍的條件可回空結果，不以目前資料 min/max 限制可輸入的合法值。

查詢使用 Neo4jConnection 的 NEO4J_DATABASE、唯讀 session、15 秒交易逾時。沒有資料寫入、Schema 變動或重新匯入。

## Response

回傳 total、districts、scope、appliedFilters 與 source。total 為實際結果筆數，未分頁。

每列 specialties 為分項陣列，例如：

```json
{"category":"中醫婦科","hospital":1,"clinic":4,"total":5,"selected":5}
```

每科保留 hospital、clinic、total 與所選 scope 的 selected，沒有跨科別合計欄。分項無數量記錄為 null，實際 0 記錄為 0；任一分項缺少時 total 為 null，不從已知分項推測完整合計。selected 沿用所選範圍內已知正數匹配，OR／AND、門檻及排序規則保持不變。舊 specialty、hospitalSpecialty、clinicSpecialty 數值代表首個所選科別，供既有單科呼叫及明確的首科排序使用。
appliedFilters 回傳後端實際接受的地區、scope、科別、匹配、人員、範圍及排序，供查證及呈現；不含任何連線設定。

personnelStatistics 回傳本次所選人員 category、hospital、clinic、total，直接由 RECORD_PERSONNEL 的類型／數量聚合；無數量記錄維持 null，實際 0 不變，兩類均已知才有完整 total。personnel 仍為所選範圍的已知紀錄數，用於原有匹配與排序；它不替代完整分項合計。

完整指標位於 Modal 的「行政區概況」，主要表格不固定顯示全套指標。缺所得／人口／面積不填 0。

## 前端與 CSV

科別使用真正複選、已選標籤可個別移除，支援搜尋、鍵盤與完成選擇。範圍可先選；切換縣市保留科別、人員與使用者數值界限，僅更新範圍提示及重建有效行政區選單。修改條件取消舊請求，避免舊回應覆蓋。表單暫存狀態與成功結果分開；未重新執行、執行中或執行失敗，都保留上次成功結果與 CSV。只有新查詢成功，才替換 columns、列資料及 appliedFilters 快照。

單科 all：行政區、該科醫院、該科診所、合計。單科單類型：行政區、該科所選類型。
多科：固定一欄顯示「有統計科數／所選科數」摘要，不跨科相加；人員、其他數值條件依需要顯示精簡摘要。每列只有一個「查看詳細資料」按鈕，沒有表格內新增明細列的流程。

詳細資料使用 document.body 下的原生 dialog.showModal()，固定相對 viewport 置中、桌面 82vw／最大 1180px、最大 85dvh。提供半透明遮罩、右上關閉、Escape、遮罩關閉、背景捲動鎖定、明確 Tab／Shift+Tab 焦點循環及關閉後回原按鈕。內容只在 Modal 內捲動；手機保留 12px 邊距。

分頁透過條件式定義建立，每次開啟重建適用的分頁及面板，預設「行政區概況」。固定顯示概況；成功查詢選取至少一科才建立「科別統計」，選取人員才建立「醫事人員統計」。未適用的分頁不留下隱藏 DOM／selected 狀態，不建立「本次未選擇」空面板。左右鍵、Home／End 依目前分頁數循環。

概況分為人口與土地、醫療資源、醫事人員、所得與統計年度；每項為名稱／數值／單位，分類標題有左側強調線。桌面兩個自然寬度資料項目一列，手機單欄；交錯背景與細框線，名稱 21px、數值 27px，不再使用獨立指標卡片。字級維持前次放大，整數千分位、面積最多 4 位、比率最多 2 位，缺值為「未提供」。

科別及人員皆以名稱／醫院／診所／合計表格呈現，分別讀取 specialties、personnelStatistics。單一 scope 篩選仍保留完整分項並標示範圍。沒有關係記錄的分項及無法確認的總數顯示「未提供」，不推算、不反推、不把缺值當 0。

Modal 使用已完成查詢及 appliedFilters 的快照，不讀取表單暫存值，開關／分頁不發送 API；開不同區重建內容並回概況。成功新查詢才替換舊資料、清除不再適用的分頁。

CSV 沿用 columns/value 與目前排序，不匯出操作欄。主表的多科摘要已縮短，CSV 同一欄仍完整保留所有所選科別的醫院／診所／合計及換行，不退化為只匯出科數；多項數值條件也保留實值。沒有提供混淆的完整 25 欄匯出。

## 錯誤及資料口徑

400 INVALID_FILTER：無效地區、選項、範圍、匹配或排序。
503 DATABASE_UNAVAILABLE：資料服務無法連線／執行；500 QUERY_FAILED：其他非預期錯誤。伺服器安全診斷不輸出密碼或 URI。
人口及相關醫療統計 114 年、所得 112 年；科別關係本身不補造年度，依原始來源說明。
政府統計不是已確認的個別院所名單，不能用此 API 推論哪家院所目前提供某科。
