# 行政區查詢驗收報告

驗收日期：2026-10-12（Asia/Taipei）。規格：[行政區醫療院所查詢 SPEC](../specs/district-medical-search.md)。

## 結果

15 項功能驗收通過。仍有 4 筆已知座標與核准行政區衝突的院所，計入搜尋總數，但標示「座標待複核」並暫不繪製標記；本次未變更原始座標。

| 項目 | 實測結果 |
| --- | --- |
| CSV | 22 縣市、368 行政區、368 個唯一代碼；API 與原 CSV 逐筆相符 |
| Neo4j 全國分類 | 診所 22,742、醫院 483、合計 23,225；13 筆病理中心未納入 |
| 全國行政區 API | 逐一查詢 368 區，與獨立 Java 分區結果比對總數及完整 sourceId 集合 |
| 完整性 | 23,225 筆不重複 ID，沒有跨區重複或漏筆 |
| 核准修正 | 94 筆全部出現在核准行政區；全國無法歸屬 0 筆 |
| 香山區獨立 Cypher | 全部 14、醫院 0、診所 14；API 三種結果均一致 |
| 同名東區 | 新竹市 299、嘉義市 194、臺南市 316；各區 ID 集合獨立核對 |
| 地圖座標待複核 | 芎林鄉 1 筆、中西區 3 筆；列入總數但不顯示錯位標記 |
| 自動化測試 | Maven 6 項測試通過；Playwright 12 項功能檢查通過 |
| 圖磚與畫面 | 桌面 1440×960：16/16 圖磚載入；手機 390×844：6/6 載入，無頁面橫向溢出 |

## 驗收逐項結果

| 編號 | 結果 | 實際執行與證據 |
| --- | --- | --- |
| AT-01 | 通過 | 從原 CSV 建立選單；獨立程式逐筆核對 API 的縣市、行政區名稱、代碼 |
| AT-02 | 通過 | Playwright 切換新竹市到嘉義市，原行政區清空，僅顯示嘉義市代碼 2201/2202 |
| AT-03 | 通過 | medicalfacilities 獨立 Cypher 實測診所 22,742 |
| AT-04 | 通過 | medicalfacilities 獨立 Cypher 實測醫院 483 |
| AT-05 | 通過 | 全國分類 23,225；API 全區總和及唯一 ID 集合均為 23,225，未包含病理中心 |
| AT-06 | 通過 | 香山區獨立 Cypher 與 API：all=14、hospital=0、clinic=14 |
| AT-07 | 通過 | 368 區完整 ID 集合比對；新竹市、嘉義市、臺南市東區不同 ID 集合，錯配縣市與代碼另有 400 測試 |
| AT-08 | 通過 | 368 區逐筆比對來源資料，API total 等於符合條件紀錄數及回傳長度，不依標記數計總數 |
| AT-09 | 通過 | Playwright 實測有效座標標記數等於有效院所數；桌面及手機圖磚全數載入；4 筆已知衝突明確提示並不繪製 |
| AT-10 | 通過 | 點擊真實標記與列表定位按鈕，資訊窗名稱、類型、地址、電話與 API 對照相符 |
| AT-11 | 通過 | 香山、嘉義東區、芎林、中西區連續搜尋，標記數與每次結果一致，清除舊標記 |
| AT-12 | 通過 | MockMvc 使用 1 筆有效、1 筆無座標、1 筆超界、1 筆待複核資料，total=4、unlocatedCount=3；真實 4 筆待複核亦計總數且不繪製 |
| AT-13 | 通過 | 必填條件禁用、真實烏坵鄉醫院空結果、MockMvc 400/503、瀏覽器隔離模擬 503 與網路失敗及選單重試；錯誤不顯示為 0 筆 |
| AT-14 | 通過 | 三種範例 Cypher、拒絕自訂 Cypher、結果排序、條件篩選與重設、CSV UTF-8 BOM/行數、地圖標記及側邊欄導覽皆實測 |
| AT-15 | 通過 | 沿用原生 HTML/CSS/JS、Leaflet、Spring Boot、Neo4j Java Driver；本功能未新增執行期依賴、首頁或額外產品功能 |

測試資料只用於隔離的 MockMvc/瀏覽器錯誤案例，不寫入正式 Neo4j。全國及行政區正常搜尋驗收使用真實 Neo4j 資料；未為測試停止 Neo4j。

## API

- `GET /api/districts`：由原 CSV 產生 22 縣市及 368 行政區；代碼保留原字串。
- `GET /api/facilities?county=新竹市&districtCode=1205&type=all`：county 與 districtCode 必須屬於同一行政區；type 支援 all、hospital、clinic。
- 回應含 `total`、`unlocatedCount`、`unassignedTotal` 及完整 `facilities`。院所含原始名稱、地址、類型、電話、經緯度和 `locationReviewRequired`。
- 無效條件回傳 400，資料庫或設定不可用回傳 503，一般查詢失敗回傳 500；不洩漏帳密或 Driver 原始例外。

## Neo4j 查詢規則

所有搜尋只使用 medicalfacilities，限定 MedicalFacility label，採參數化 Cypher、READ session 與 executeRead，不新增索引、不更新資料或關係。

1. 醫院使用 `type CONTAINS '醫院'`，診所使用 `type CONTAINS '診所'`，all 使用兩者聯集。
2. 非空 districtCode 優先：比對正規化後的 county 與 districtCode。行政區代碼有值但縣市不符或未知時，列為未歸屬，不用地址強行重新分配。
3. 沒有代碼才用原始地址：統一台/臺、移除空白，允許開頭 3–6 位郵遞區號，再比對完整「縣市＋行政區」前綴。
4. 未歸屬計數同樣優先檢查 CSV 的已知「縣市＋代碼」組合；沒有代碼則比對全行政區地址前綴。
5. 資料庫實際 count 計總數；collect 回傳全部符合條件院所，不使用 LIMIT 截斷。
6. 缺少或超界座標，以及 districtCoordinateConflict=true，均計入總數但不繪製。核准行政區不代表原座標已修正。

香山區使用獨立 Cypher 核對，未直接呼叫 production Repository：

```cypher
MATCH (n:MedicalFacility)
WHERE (($type = 'all' AND (n.type CONTAINS '醫院' OR n.type CONTAINS '診所'))
   OR ($type = 'hospital' AND n.type CONTAINS '醫院')
   OR ($type = 'clinic' AND n.type CONTAINS '診所'))
  AND n.address =~ $area
RETURN count(n) AS total;
```

`$area` 為允許空白及郵遞區號的「新竹市香山區」完整地址前綴。這 94 筆核准資料不包含香山區；另以 368 區完整 ID 集合比對核准欄位優先邏輯。

## 交付檔案

本輪修改：

- `backend/src/main/java/tw/advanceddb/medical/repository/DistrictFacilityRepository.java`：行政區欄位優先、未歸屬計數及座標複核欄位。
- `backend/src/main/java/tw/advanceddb/medical/service/DistrictCatalog.java`：CSV 已知行政區識別組合。
- `backend/src/main/java/tw/advanceddb/medical/service/DistrictFacilityService.java`：傳遞縣市/代碼、計算可定位資料。
- `backend/src/main/java/tw/advanceddb/medical/model/FacilitySearchResponse.java`：locationReviewRequired 及定位判斷。
- `backend/src/test/java/tw/advanceddb/medical/DistrictSearchTest.java`：缺座標、超界及待複核總數測試。
- `pages/district/app.js`、`map.js`、`results.js`：提示、暫停錯位標記及列表座標狀態。
- `backend/README.md`、`docs/specs/district-medical-search.md` 及本報告：啟動說明、勾選及驗收結果。

原功能新增的 Controller、Service、Repository、共用連線、CSV catalog、pages/district 與 shared 地圖/API 模組仍沿用；沒有新增替代架構。

驗收附件：[全區 API 結果](artifacts/district-api-2026-10-12.json)、[瀏覽器檢查](artifacts/district-ui-2026-10-12.json)、[圖磚檢查](artifacts/district-map-2026-10-12.json)、[桌面截圖](artifacts/district-desktop.png)、[手機截圖](artifacts/district-mobile.png)。

## 已知限制

- 平安診所、陳英洲外科診所、永安聯牙醫診所、永安診所的既有座標待複核。芎林鄉 5 筆中 1 筆暫不繪製，中西區 174 筆中 3 筆暫不繪製；原地址和座標保持不變。
- 94 筆行政區歸屬由使用者核准；其餘地址比對不代表已逐一核實院所現址。
- 圖磚依賴外部 OpenStreetMap 網路服務。早期快速切換查詢曾中止未完成的圖磚請求；最終桌面/手機完整載入檢查均通過。
- 此次未測負載壓力、全裝置相容性或非本機部署。未新增資料庫索引，資料量增加時需要再評估效能。
- 預覽服務為 http://127.0.0.1:18081/pages/district/index.html；日常啟動預設 18080。Live Server 的預設 port 不提供後端 API，建議由 Spring Boot 同時提供頁面與 API。

沒有未通過的功能驗收項目；4 筆座標品質問題仍保留為資料限制，不能宣稱所有院所座標都已核實。
