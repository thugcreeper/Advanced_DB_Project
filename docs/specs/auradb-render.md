# AuraDB 與 Render 執行設定

更新：2026-10-15（Asia/Taipei）

## 連線

專案使用原生 Neo4j Java Driver，不引入 Spring Data Neo4j 或第二個 Driver。
所有網站查詢經由 Neo4jConnection，以 NEO4J_DATABASE 指定 session database，沒有本機 Bolt fallback。
URI 必須為 neo4j+s://，使用受信任憑證 TLS。

|用途|變數|
|---|---|
|Aura URI|AURA_CONNECTION_URI（亦支援 NEO4J_URI）|
|Aura 密碼|AURA_PASSWD（亦支援 NEO4J_PASSWORD）|
|登入帳號|NEO4J_USERNAME，使用 Driver 實際驗證成功的資料庫帳號；不直接沿用工具登入身分|
|查詢資料庫|NEO4J_DATABASE，依 CALL db.info() 的 name 結果，必填|
|僅 instance metadata|AURA_DB_NAME、AURA_DB_ID，不參與連線或 database 選擇|

不得假定帳號或資料庫名稱一定為 neo4j。Query 工具可以用 Aura 帳戶無縫登入，SHOW CURRENT USER 可能顯示不同身分；Driver 的 basic authentication 必須使用可搭配資料庫密碼的帳號。資料庫名稱即使與 Instance ID 相同，也必須由實際查詢確認，不能直接以 ID 推算。

每個連線欄位優先取程序環境；同時提供兩組時，程序的 NEO4J_* 優先於 AURA_*。
若程序沒有設定，讀本機 .env；其中 Aura URI／密碼優先於舊本機 NEO4J_URI／NEO4J_PASSWORD。
部署時提供完整且一致的一組設定。不得將 URI、密碼、ID 或 .env 寫入前端或 Git。
.env 只在 repo root（backend/.env）或 backend 執行目錄讀取；獨立 JAR 可完全只用程序環境。
修改設定後重啟 Java。Driver 延遲建立，啟動不等待資料庫，HTTP 健康與資料庫錯誤分離。
連線逾時 5 秒、取得連線 8 秒、交易重試上限 5 秒、pool 20、連線壽命 30 分鐘。
交易重試時間不是所有查詢的硬性總時限，唯讀 Cypher 另有原本 15 秒交易限制。

## HTTP 健康

GET /api/health 回傳 status=UP 與 application。
不查 Neo4j、不需登入、不回傳 URI 或 credentials。
移除舊 databaseConnected=false 占位，避免將未檢查誤認為斷線。
此端點只表示 HTTP liveness，不作為 Aura readiness 證明。

## 共用前端連線流程

shared/api-connection.js 供三個 API helper 共用。
初始請求先經健康 gate：4 秒內保持各頁正常載入狀態，超過後顯示非模態右下提示。
健康每次上限 5 秒，退避 2、4、8、10 秒（之後維持 10 秒），總自動等待 90 秒。
同時請求共用一輪健康流程；成功快取 15 秒，沒有閒置輪詢或防休眠 ping。
90 秒後停止自動網路請求，顯示錯誤與「重新連線」。
原本等待的載入 promise 暫停，按鈕啟動新一輪，成功後繼續原始載入，無須重設條件或刷新。
最後一位等待者取消時中止健康流程；pagehide 中止所有連線。
bfcache 回復會重新載入以重建取消狀態。

GET 網路錯誤、無應用程式錯誤碼的 502/503/504 可再經健康 gate，最多重送一次。
統計 POST 只有明確的 /api/districts/statistics/search 視為安全讀取。
一般 POST 與使用者 Cypher POST 不自動重送；初次送出前仍等待 HTTP 恢復。
401、403、400、業務錯誤與有 code 的資料庫錯誤不自動重試。
DATABASE_UNAVAILABLE／QUERY_FAILED 顯示「資料服務異常」，不宣稱 Render 啟動。
每次查詢含讀取 body 的上限為 20 秒；逾時後若 HTTP 健康仍正常，回報一般查詢逾時、不自動重送。只有確認服務曾無法回應且已恢復時，才續送必要的安全讀取。健康正常但慢查詢不會直接顯示啟動提示。
提示有 role=status、polite live region、可鍵盤操作按鈕與 reduced-motion。
既有院所搜尋等待期間保留列表與地圖；使用者主動變更條件時維持原本清除失效結果的語意。

## Render 部署前

- 必要的 368 筆行政區目錄已納入 backend/src/main/resources/districts；建置不再依賴 Git 忽略的本機 data CSV。
- Java 17；在 repo root 執行 backend/mvnw -f backend/pom.xml package（Windows 使用 mvnw.cmd）。
- 啟動 java -jar backend/target/medical-resource-backend-0.0.1-SNAPSHOT.jar。
- 環境設定：AURA_CONNECTION_URI、AURA_PASSWD、NEO4J_USERNAME、NEO4J_DATABASE，或完整 NEO4J_*。
- PORT 使用 Render 注入值，本機預設 18080；SERVER_ADDRESS 預設 0.0.0.0。
- Health check path 設 /api/health。
- 同來源前後端不需 CORS；分離部署設定程序 CORS_ALLOWED_ORIGINS，逗號分隔明確來源（含協定與埠，不含路徑）。
- CORS 預設不開放跨域，拒絕 wildcard；此 Spring 設定由程序環境注入，不由 dotenv 載入。
- 分離部署在 pages/district/index.html 與 pages/query/index.html 加上或設定 meta name=api-base content=https://YOUR-BACKEND.onrender.com。
- 不要在正式前端填本機網址，不把任何 Neo4j 憑證放入 meta。
- 同一個會休眠的後端若也提供 HTML，首次導覽需等 Render 傳回頁面後 JavaScript 才能執行；如需在這段期間也顯示本專案提示，前端須另行靜態部署。
- Render Free web service 的閒置與喚醒行為依實際方案核對；目前官方說明為閒置 15 分鐘後休眠，喚醒約一分鐘，不代表所有方案都休眠。
- 本次沒有部署 Render，也沒有執行資料移轉、匯入、清空或 Schema 操作。

官方資料：[Render Free](https://render.com/docs/free)、[Render Web Services](https://render.com/docs/web-services)、[Neo4j Java Driver](https://neo4j.com/docs/java-manual/current/connect/)。

## 驗證命令

Java 單元與合約：backend/mvnw.cmd -f backend/pom.xml test
Aura opt-in 唯讀測試：在 backend 目錄設定 AURA_READ_TESTS=true，再執行 mvnw.cmd -Dtest=AuraReadOnlyTest test。
瀏覽器：node --test tests/integration/connection-state.test.cjs tests/integration/api-origin.test.cjs。
真實 stop/start：node --test tests/integration/connection-live.test.cjs（需已打包 JAR、Java 17，使用測試埠 18090、19190）。
測試需 NODE_PATH 指向有 playwright 的安裝，PLAYWRIGHT_EXECUTABLE 可指定現有 Chromium。
狀態測試縮短時間以覆蓋 90 秒停止邏輯；真實 stop/start 測試使用正式時間設定。
