# AuraDB / Render 冷啟動驗證

日期：2026-10-15（Asia/Taipei）。基準 a08914d，正式 repo Advanced_DB_Project。未 push、未部署 Render。

## 最終結果

Aura 已以現有密碼成功登入，網站資料查詢已改用 Aura。
本次確認實際資料庫名稱不為 neo4j，Driver 的密碼登入帳號也不為 neo4j。
Query 工具顯示的 UUID 身分無法直接搭配本次密碼；已用臨時程序設定驗證正確資料庫帳號成功後，才保存至本機 .env。
本實例的 Driver 帳號與資料庫名稱恰好相同，但程式沒有從 Instance ID 推導兩者，仍分別讀取 NEO4J_USERNAME、NEO4J_DATABASE。
原密碼沒有改動。帳號與資料庫值只保留在 Git 忽略的 .env，文件／範例／程式碼不包含實際憑證。

所有網站查詢共用 Neo4jConnection。連線 URI 必須 neo4j+s://，測試確認設定主機為 Aura、實際查詢伺服器不是 loopback，且回報 database 與明確設定一致。
不以路由伺服器必須回報特定網域為判準，因雲端路由可以回報不同主機格式。
HTTP 與資料服務錯誤已分離。共用前端 gate、有限重試、手動續載、取消與桌面／手機提示已實作。

本次沒有執行 Neo4j Schema 修改、資料匯入、清空、覆蓋、密碼重設或使用者管理。
唯讀防護回歸向 API 提交的寫入語句會在 EXPLAIN／唯讀檢查階段拒絕，交易不提交，Schema 前後比對保持一致。

## Aura 唯讀實測

|節點／關係|數量|
|---|---:|
|醫療院所|23,238|
|鄉鎮區碼與名稱|368|
|科別|53|
|HAS_FACILITY|23,238|
|HAS_DEPARTMENT|28,631|
|RECORD_DEPARTMENT|6,372|

後端 API 實測：/api/health=UP、實際院所科別選項 42、官方統計科別 45、人員類別 27。
全 368 行政區院所與本機唯讀稽核快照逐筆比對通過：23,225 間醫院／診所、sourceId 唯一、屬性及關係一致。
分類總數為醫院 483、診所 22,742；另 13 間病理中心保留於 Aura，不列入搜尋分類。

## 執行結果

|驗證|結果|
|---|---|
|Java 完整測試與 package（AURA_READ_TESTS=true）|42 通過、0 失敗、10 舊快照未啟用；含 Aura 實際唯讀測試；BUILD SUCCESS|
|Aura 網站回歸，共 41 案|最終 40 通過、1 既有快照差異|
|共用連線狀態 Playwright|15 通過|
|三個 helper 的 API 來源|9 通過|
|真實 Java stop/start + 獨立靜態前端|1 通過；正式時間設定，兩輪停止／恢復，保留縣市與行政區|
|離線表格／CSV|8 通過、2 既有 TODO|
|敏感值比較|Git 檔案與打包應用內容無命中；.env 未追蹤|
|Git diff --check|通過|

41 案包含院所全量比對／科別、詳情／CARE、Leaflet、Cypher 九範例與唯讀防護、統計 API／篩選器／表格／CSV／桌面與手機。
首次 41 案回歸為 39 通過、2 失敗；其中慢查詢逾時已修正（健康正常時不重送慢查詢），重新打包後單獨重跑該案通過。
唯一未修正的失敗是原統計 TC-08：鳥松醫院西醫師實際 973，舊預期 1072；診所西醫師實際 8，舊預期 24。此為交接已有口徑差異，未改資料或斷言。
清除未使用程式後已重新編譯全部正式／測試 class 並執行完整 Java 與 Aura 唯讀測試，42 通過、10 舊快照未啟用。

Playwright 使用既有 Chromium 1217。
狀態測試縮短時程驗證 90 秒停止分支；真實 stop/start 使用正式 4 秒提示與退避時間。
一般載入保持靜默；10 個並發初始請求共用 1 次健康檢查。
401、403、400、DATABASE_UNAVAILABLE、QUERY_FAILED 均不觸發無條件重試。
一般 POST 網路失敗只送出一次；最後等待者取消後不再檢查。
健康正常時的查詢逾時會回報一般查詢錯誤，不自動重送；安全 GET 暫時性傳輸錯誤最多在確認健康後重送一次。
提示於 1440、390、320px 測試，並目視檢查實際手機頁面。
stop/start 專用測試服務已自動清理；本次新版 Aura 預覽保留在 18088。

## 驗收對照

|案例|狀態與證據|
|---|---|
|TC-01 Aura 成功|通過；原密碼登入、明確帳號／database、雲端 TLS 及六類節點／關係查詢|
|TC-02 既有功能|行政區、院所、科別、Cypher、統計與 Leaflet 回歸通過；單一既有鳥松快照失敗保持揭露|
|TC-03 健康|通過；GET /api/health，mock 驗證無 Driver 呼叫，實際故障 DB 下仍回應 UP|
|TC-04 後端未啟動|通過；實際獨立靜態頁面 + 停止 Java，顯示可能正在啟動|
|TC-05 後端恢復|通過；實際重啟 Java 自動續載，不重新整理、不丟選擇|
|TC-06 持續失敗|通過；縮短時間測試停止自動重試，手動 reconnect 後續載|
|TC-07 DB 故障|通過；真實無效 DB hostname 回傳 DATABASE_UNAVAILABLE，HTTP health 保持 UP；前端不顯示啟動提示|
|TC-08 避免重複|通過；並發共用健康 gate，一般 POST 不自動重送|
|TC-09 跨裝置|通過；1440／390／320px，動畫、ARIA、保留地圖|
|TC-10 安全|通過；已比較本機敏感值，無程式碼／JAR 洩漏，.env 被忽略|

注意：本次任務 TC-08 是避免重複健康檢查；前述舊統計 TC-08 是不同測試編號，不可混淆。

## 連線與部署設定

使用 AURA_CONNECTION_URI、AURA_PASSWD、NEO4J_USERNAME、NEO4J_DATABASE。
AURA_DB_NAME／AURA_DB_ID 只保留 metadata，不直接選 database 或 username。
程序也支援 NEO4J_URI／NEO4J_PASSWORD；完整優先序見部署文件。
Render 注入 PORT；SERVER_ADDRESS 預設 0.0.0.0。
分離前端需設定 HTML meta api-base 與程序 CORS_ALLOWED_ORIGINS 明確來源。
HTTP health path 為 /api/health。沒有防休眠定時 ping。
368 筆行政區目錄已納入 backend/src/main/resources/districts，避免從 Git 建置時缺少被忽略的 data CSV。

完整流程與命令：[部署設定](../specs/auradb-render.md)。

## 修改／新增檔案

- `README.md`
- `backend/.env.example`
- `backend/README.md`
- `backend/pom.xml`
- `backend/src/main/java/tw/advanceddb/medical/config/LocalWebConfig.java`
- `backend/src/main/java/tw/advanceddb/medical/config/Neo4jConnection.java`
- `backend/src/main/java/tw/advanceddb/medical/controller/CypherApiErrors.java`
- `backend/src/main/java/tw/advanceddb/medical/controller/DistrictApiErrors.java`
- `backend/src/main/java/tw/advanceddb/medical/model/HealthResponse.java`
- `backend/src/main/java/tw/advanceddb/medical/service/HealthService.java`
- `backend/src/main/resources/application.properties`
- `backend/src/main/resources/districts/行政區與代碼.csv`
- `backend/src/test/java/tw/advanceddb/medical/HealthEndpointTest.java`
- `backend/src/test/java/tw/advanceddb/medical/StatisticsApiContractTest.java`
- `backend/src/test/java/tw/advanceddb/medical/config/AuraReadOnlyTest.java`
- `backend/src/test/java/tw/advanceddb/medical/config/Neo4jConnectionTest.java`
- `backend/src/test/java/tw/advanceddb/medical/controller/CypherApiErrorsTest.java`
- `docs/specs/auradb-render.md`
- `pages/district/app.js`
- `shared/api-connection.css`
- `shared/api-connection.js`
- `shared/api.js`
- `shared/cypher-api.js`
- `shared/statistics-api.js`
- `tests/integration/api-origin.test.cjs`
- `tests/integration/connection-live.test.cjs`
- `tests/integration/connection-state.test.cjs`

本報告另新增於 docs/verification/auradb-render-2026-10-15.md。
.env 的帳號與資料庫名稱已對齊實際登入成功設定；密碼未改，仍受 Git 忽略。
本機截圖保留於 tests/integration/artifacts（忽略，不提交）。

## 待完成／保留限制

- 正式 Render 設定、跨網域實際部署與方案休眠／喚醒測試尚未進行；本次任務不要求部署。
- 若前後端同在會休眠的 Render 服務，首次 HTML 尚未送達時無法執行 JavaScript 提示；需靜態分離部署才能涵蓋該段等待。
- 既有鳥松快照差異、10 個未啟用舊快照、2 個 fixture TODO 保持原狀。
- HTTP health 僅表示 HTTP liveness，不代表 Aura readiness。
## 一次性工具與無引用程式清理（2026-10-15）

- 已刪除工具工作區 aura-work 整個目錄，共 16 個一次性檔案：align-aura.py、verified-aura.py、query-timeout.py、install.py、scan-secrets.py、finalize-report.py、9 份 files JSON 清單與暫存 report.md。
- 正式 repo 已刪除 backend/src/main/java/tw/advanceddb/medical/config/ProjectFiles.java。全正式 source／tests 已無引用，新的環境設定讀取也不依賴此目錄搜尋器。
- 正式 Aura 連線、冷啟動模組、有效測試、部署文件與驗證報告保留。
- 初次 Maven clean 被歷史預覽持有的日誌鎖定；未停止該歷史預覽。改為清除已確認範圍的 target/classes、target/test-classes 後重新編譯及打包成功。
- 重建驗證：Java 42 通過、0 失敗、10 舊快照未啟用；Aura 六類節點／關係數量不變。新 JAR 的 ProjectFiles 項目為 0。
- 本次清理未修改 .env、密碼、Neo4j 資料或 Schema，未 push。
