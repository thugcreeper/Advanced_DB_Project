# Neo4j Schema 重構後查詢與測試

日期：2026-10-13。已實際連線 `neo4j` 驗證，不只是靜態檢查。
未執行任何資料庫遷移、匯入、刪除或寫入，指定預期值未更動。

## 結果摘要

| 測試 | 通過 | 失敗 | TODO |
|---|---:|---:|---:|
| Java後端及真實資料庫快照 | 28 | 1 | 0 |
| 瀏覽器模組＋真實API／頁面 | 18 | 1 | 2 |

兩項失敗都是同一個TC-08固定數值問題，分別由Neo4j快照及真實API測試揭露。
沒有把失敗改成skip、放寬斷言或修改資料。打包供頁面驗證時使用skipTests，不能解讀為全部測試通過。

## 核心案例

| 案例 | 實際筆數 | 狀態 |
|---|---:|---|
| TC-01 所得>1500、人口>0 | 5 | 通過，五區所有原指定欄位數值及降冪排序 |
| TC-02 0<人口<20000 | 132 | 通過，烏坵／金沙首尾、人力及公式、人口升冪 |
| TC-03 醫院0且診所<5 | 76 | 通過，烏坵／三灣首尾，僅診所ASC、人口DESC |
| TC-04 診所0 | 2 | 通過，南竿／烏坵所有原指定數值、人口DESC |
| TC-05 護理師 | 368／每模式 | 通過，北投5175+218=5393，零值區保留 |
| TC-06 提供內科的院所家數 | 368／每模式 | 通過，鳳山6+47=53，零值區保留 |
| TC-08 三類醫師、西醫師人均值 | 368 | 固定預期失敗；獨立類別加總／公式測試通過 |

所有要求全區的案例都驗證行政區代碼唯一，沒有自動新增名稱次要排序。
TC-07沒有正式測試方法，已移除現行規格中的獨立案例段落，不重新編號TC-08。
額外通過：正式Label數量、關係年度112／114、三類醫師公式、API相容及唯讀參數化。

## TC-08 需要人工確認

鳥松區人口43703，新Schema實際資料：

| 類別 | 醫院 | 診所 | 合計 | 每萬人口 |
|---|---:|---:|---:|---:|
| 西醫師 | 973 | 8 | 981 | 224.47 |
| 中醫師 | 41 | 4 | 45 | — |
| 牙醫師 | 58 | 12 | 70 | — |
| 三類醫師合計 | 1072 | 24 | 1096 | 250.78 |

你指定的「西醫師1072／24／1096／250.78」實際符合三類醫師合計，而非西醫師。
`1072=973+41+58`、`24=8+4+12`、`1096=981+45+70`。
正式查詢不會為符合預期而將中醫師／牙醫師改標成西醫師。
固定斷言仍保留1072、24、1096、250.78，因此整體驗收不是全通過。
需使用者決定修正TC-08固定預期為西醫師數值，或將其指標改回三類合計；本次沒有代替使用者做此變更。

## 查詢更新

正式完整Cypher在 `backend/src/main/java/tw/advanceddb/medical/repository/DistrictStatisticsRepository.java`。
獨立快照参考Cypher在 `backend/src/test/java/tw/advanceddb/medical/StatisticsSnapshotTest.java`。

- 所得：行政區→RECORD_INCOME（關係統計年112）→綜合所得。
- 人口／面積／密度：行政區→RECORD_POPULATION_AND_AREA（關係統計年114）→人口與土地。
- 院所總數／總人力：行政區→RECORD_MEDICAL_FACILITIES（114）→醫療院所統計，以節點類型醫院／診所分別加總院所家數及醫事人員總計。
- 所選人員及三類醫師：行政區→RECORD_PERSONNEL→醫事人員類別，以關係類型、類別名稱及關係數量條件聚合。
- 所選科別：行政區→PROVIDE_DEPARTMENT→科別，以關係類型及關係數量加總提供該科別的院所家數。

院所、人員及科別分成三個獨立子查詢聚合，不做跨類別的一對多乘積。
不把科別家數加總成醫院／診所總家數。外層篩選在聚合後WITH，保留零值行政區。
年度取自關係，無醫療統計記錄時medicalYear可為null，不虛構該記錄。

## API與前端

路徑、body、舊欄位保持相容。doctors／doctorRate仍為三類醫師合計及其人均值。
新增hospitalWesternDoctors、clinicWesternDoctors、westernDoctors、westernDoctorRate；
hospitalChineseDoctors、clinicChineseDoctors、chineseDoctors；hospitalDentists、clinicDentists、dentists；medicalYear。
新增排序欄位與表格／CSV三類明細，科別標示為「提供該科別的院所家數」。
人口及醫療114年、所得112年分開標示。
Cypher範例已改正式Schema；仍未開放任意Cypher执行。
新竹三區、CSV、手機／桌面、無地圖函式庫、503、逾時、重設及最新請求優先皆通過。

## 測試盤點

保留並更新：StatisticsSnapshotTest內七核心案例、年度；StatisticsApiContractTest與StatisticsReadOnlyTest；live.test.cjs核心API及互動；frontend.test.cjs表格／CSV八項。
新增：三類醫師獨立公式測試、正式Label數量、三類API相容測試、現行伺服器篩選重設測試。
保留不變：DistrictSearchTest（5）、HealthEndpointTest（2），屬另一院所查詢／健康功能。
刪除：未被現行頁面使用的pages/query/filters.js，以及依賴它的六個前端篩選Legacy測試和測試helper。
這六項不再代表現行伺服器篩選，相關行為改由控制資料API測試及真實頁面測試驗證。
保留2項TODO：隔離Neo4j中多關係fixture、缺統計／人員／科別fixture；不能污染正式資料庫來建立它們。

## 舊名稱稽核與文件

正式統計Java、現行測試、Cypher範例及現行spec已無已淘汰Schema引用。
唯一正式程式同名HAS_DEPARTMENT位於FacilityImportRepository：它連MedicalFacility→Department、寫入獨立medicalfacilities資料庫，不是neo4j行政區統計關係，因此刻意保留且未執行。
沒有把另一資料庫同名關係當成應遷移的行政區統計Schema。
舊驗證報告加上歷史／已取代標示，舊執行紀錄保留作歷史證據，不屬正式測試來源。
現行規格：docs/specs/district-statistics-test-spec.md；API說明：docs/specs/district-statistics-api.md。

## 本次檔案

- backend/src/main/java/tw/advanceddb/medical/repository/DistrictStatisticsRepository.java
- backend/src/main/java/tw/advanceddb/medical/service/DistrictStatisticsService.java
- backend/src/test/java/tw/advanceddb/medical/StatisticsSnapshotTest.java
- backend/src/test/java/tw/advanceddb/medical/StatisticsApiContractTest.java
- backend/src/test/java/tw/advanceddb/medical/repository/StatisticsReadOnlyTest.java
- pages/query/app.js、index.html、examples.js；刪除filters.js
- tests/statistics/frontend.test.cjs、live.test.cjs、README.md
- docs/specs/district-statistics-api.md、district-statistics-test-spec.md
- docs/verification/district-statistics-test-results-2026-10-13.md、district-statistics-implementation-2026-10-13.md（歷史標示）
- 本報告與docs/verification/artifacts/schema-update-2026-10-13/（log、XML、TAP及桌面／手機截圖）

預覽：http://127.0.0.1:18081/pages/query/index.html。使用者自行從VS Code執行時，port以其Spring Boot啟動紀錄為準，且需要重啟才能載入新版Java。
沒有替使用者commit，也沒有覆寫README.md及.gitignore的既有修改。
