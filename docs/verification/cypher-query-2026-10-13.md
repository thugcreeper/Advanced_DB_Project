# Cypher 實際查詢與九個範例驗證

日期：2026-10-13（Asia/Taipei）

## 實作與啟動

正式 repo：`C:\Users\User\Desktop\git-repos\Advanced_DB_Project`。
本次工作副本：`C:\Users\User\OneDrive\文件\ChatGPT\高等資料庫專案\cypher-work`。
預覽服務：`http://127.0.0.1:18082/pages/query/index.html`。
18082 是工作副本的本機預覽；正式 repo 在 VS Code 重新執行
`tw.advanceddb.medical.MedicalResourceApplication` 後可使用 18080。
Java 為 JDK 17，前端由 Spring Boot 提供，不需另開前端伺服器。
沒有 commit、push、Schema 遷移、資料刪除或匯入。

新增 `POST /api/cypher/query`，接受：

```json
{"query":"WITH $value AS value RETURN value","parameters":{"value":42}}
```

回傳有順序的 `columns`、對應的二維 `rows`、`rowCount`、`truncated`、
`rowLimit`、`timeoutSeconds`。自訂查詢不需要回傳行政區欄位。
節點、關係、路徑、集合及時間值會轉成可顯示的 JSON。

範例選單保留九個固定標題與順序，切換只載入查詢及說明。
使用者可修改、複製及明確執行查詢。變更查詢、範例或模式會取消前端等待並清除過期結果；
後端仍受交易逾時限制。執行期間停用重複送出。
結果欄位動態呈現，CSV 包含 UTF-8 BOM、逗號／引號／換行跳脫與公式字串防護。
失敗時清除舊結果並停用匯出，頁內訊息不使用 alert。

每個關係家族先用子查詢聚合，避免交叉乘積。
分位數以全臺有效數值各自計算後篩選，不先在子集合計算。
零／缺失人口不除，無效數值排除於分位數母體。
缺少院所統計列以 0 計，但回傳資料註記；重複統計列及無效醫療數值也有註記，
不把缺資料默認為已確認的零。所得為 112 年，人口及醫療為 114 年。

## 唯讀與輸出限制

- 指定資料庫 `neo4j`，READ session／交易，交易逾時 15 秒。
- 先以 `EXPLAIN` 編譯，只有 Neo4j 判定的 `READ_ONLY` 可執行。
- 檢查執行計畫，拒絕寫入、管理操作、外部 CSV 載入及未允許的程序。
- 程序只允許 `db.labels`、`db.relationshipTypes`、`db.propertyKeys`、`db.schema.visualization`。
- 查詢內的唯讀 `CALL { ... }` 子查詢與 `WITH` 正常支援。
- 透過 `SHOW FUNCTIONS` 取得自訂函式名單並禁止呼叫，避免函式內另開交易或外部存取；
  辨識時處理字串、註解及反引號名稱。
- 使用明確交易，成功及截斷後皆 rollback；例外關閉時不提交。
- 查詢最多 30000 字元，參數 64000 bytes，欄位 100 個，結果最多 1000 筆、約 2 MB；
  深度最多 20 層，過大單列會拒絕，達總列數／位元組上限回傳截斷旗標。
- 400 表示格式／語法／型別錯誤，403 表示唯讀限制／權限不足，408 表示查詢逾時，503 表示服務失敗。
  對外訊息不含原始 driver 訊息、堆疊、路徑或連線資訊。

沿用既有連線設定，沒有建立帳號或更動 Neo4j 權限；不可宣稱既有帳號已是唯讀角色。
READ access mode 本身不是存取控制，因此本實作還有查詢分類、計畫限制及自訂函式限制。
參考：[Neo4j Java Driver transactions](https://neo4j.com/docs/java-manual/current/transactions/)。
若日後公開部署，資料庫帳號的唯讀角色應由部署設定另外確認。

## 九題實測

全部九個完整 Cypher 已透過本次 API 成功執行，未截斷。

| 題目 | 固定標題 | 筆數 | 驗證與門檻 |
| --- | --- | ---: | --- |
| 01 | 高收入地區的醫療資源如何 | 5 | 平均所得 > 1500；2059、1973、1653、1558、1505，符合 TC-01 |
| 02 | 低收入地區的醫療資源如何 | 76 | 所得 P20 = 583 千元；有效樣本 368；含門檻同值行政區 |
| 03 | 哪些地區沒有醫院診所也很少 | 76 | 醫院 0、診所 < 5；診所 ASC／人口 DESC，符合 TC-03 |
| 04 | 哪些地區的護理師最多 | 368 | 北投 5175＋218＝5393，符合 TC-05 |
| 05 | 哪些地區每萬人口醫師數最多 | 368 | 三類醫師合計／人口 × 10000；TC-08 西醫師預期仍有差異 |
| 06 | 哪些面積大的地區醫療院所也多 | 3 | 面積 P80 = 107.58980000000003；院所 P80 = 94.60000000000002；兩項樣本均 368 |
| 07 | 哪些人口密集地區醫療院所卻少 | 0 | 密度 P80 = 2943.3648680000006；樣本 368；保留原門檻 |
| 08 | 哪些人口稀疏地區每萬人口醫師數也少 | 26 | 密度 P20 = 143.18975182；醫師比率 P20 = 4.407143421473342；兩項樣本均 368 |
| 09 | 哪些地區完全沒有診所 | 2 | 連江縣南竿鄉、金門縣烏坵鄉，符合 TC-04 |

第 06 題實測：

| 行政區 | 面積 km² | 人口 | 人口密度 | 醫院 | 診所 | 合計 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 新北市新店區 | 120.2255 | 306884 | 2552.569962 | 7 | 250 | 257 |
| 臺中市太平區 | 120.7473 | 201536 | 1669.072518 | 4 | 189 | 193 |
| 臺東縣臺東市 | 109.7691 | 102681 | 935.4271831 | 5 | 104 | 109 |

第 07 題零筆是目前資料與原條件的結果，沒有放寬門檻。
建議另行檢視密度前 20% 地區的院所家數分布，以理解條件交集為何為零；本範例保持原樣。
零筆時 UI 說明保留百分位数定義；驗證程式另外執行唯讀門檻查詢記錄實際 P80。

## TC-08 未解決差異

本次重新查詢鳥松區：人口 43703；西醫師 973＋8＝981，中醫師 41＋4＝45，
牙醫師 58＋12＝70；三類合計 1096，每萬人口三類醫師 250.78。
西醫師單一類別每萬人口為 224.47。
文件指定西醫師 1072＋24＝1096，與實際資料不同；1072／24 實際對應三類醫師的醫院／診所合計。
本實作依題目公式顯示三類合計，原 `tests/statistics/live.test.cjs` TC-08 仍維持失敗。
沒有修改預期、放寬斷言、重新編號或改資料。

## 地圖與測試

結果保留行政區碼；完整行政區名稱、代碼或回傳節點的行政區屬性可用來辨識。
沿用 Leaflet 與既有 `/api/districts`、`/api/facilities`，以行政區選單載入真實院所點位。
不產生行政區中心座標，不引用示範統計。位置缺失／待核對的院所不畫圖，最多畫 1000 點。
新店區本次定位 251 個實際院所點位；位置資料與 114 年統計彙總為不同來源，不能直接當成同一數量。
無法定位或地圖失敗不影響表格與 CSV；圖磚依賴 OpenStreetMap 網路服務。

- 最終 Maven package 成功：25 通過、0 失敗、10 快照測試未啟用（非通過）。
- 新增 live／Playwright：9 通過，涵蓋九題執行、參數、唯讀 CALL、寫入攔截、
  語法與程序錯誤、列數與輸出大小、切換範例、CSV、取消與防重送、地圖、響應式畫面。
- 既有前端／live／UI／visual：29 通過、1 失敗（原 TC-08）、2 TODO（隔離 Neo4j fixture）。
- 1440×1000、390×844、320×700：無頁面水平溢出或 pageerror。
- 已查看桌面及手機範例／結果截圖；表格在自己的捲動區內水平捲動。
- 啟動期間曾先送出測試造成連線拒絕，已增加服務就緒等待；最終重跑通過。
- sandbox 內 Mockito attach 曾停滯，改在獲准的 sandbox 外執行後通過。
- Windows 預覽程序曾鎖住 JAR，停止本次預覽後重新打包成功。

截圖與完整結果 JSON 位於工作副本 `tests/cypher/artifacts/`，不複製到正式 repo、也不提交。
主要畫面：`cypher-results-desktop.png`、`cypher-results-mobile.png`、`cypher-320.png`。

## 修改檔案

- `.gitignore`
- `pages/query/index.html`、`styles.css`、`app.js`、`editor.js`、`examples.js`、`modes.js`
- `pages/query/cypher-results.js`、`cypher-map.js`
- `shared/cypher-api.js`
- `backend/src/main/java/tw/advanceddb/medical/service/CypherQueryService.java`
- `backend/src/main/java/tw/advanceddb/medical/controller/CypherController.java`、`CypherApiErrors.java`
- `backend/src/test/java/tw/advanceddb/medical/service/CypherQueryServiceTest.java`
- `backend/src/test/java/tw/advanceddb/medical/controller/CypherApiErrorsTest.java`
- `tests/cypher/live.test.cjs`、`ui.test.cjs`、`ready.cjs`、`README.md`
- 本驗證文件

既有統計 API、篩選條件語意、Neo4j 連線與匯入程式沒有變更。
