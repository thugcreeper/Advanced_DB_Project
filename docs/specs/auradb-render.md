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

## Docker 建置與本機驗證

Dockerfile 與建置 context 都位於 repo 根目錄。Maven 以 Java 17 編譯正式程式、前端與 368 筆行政區資源，再將 JAR 複製至 Java 17 JRE 執行階段。
容器使用非 root 帳號；最終映像不含 Maven、原始碼或本機憑證。
.dockerignore 採允許清單，只傳送 pom.xml、backend/src/main、pages、shared，並額外排除環境檔與私鑰。
建置不查詢 Aura，也不需要任何資料庫密碼。映像建置會略過測試，應先在本機或 CI 執行本文下方的 Java／瀏覽器測試；略過不計入通過。

在 repo 根目錄執行：

```powershell
docker build -t advanced-db-medical:local .
```

先驗證不依賴資料庫的 HTTP 啟動：

```powershell
docker run --rm -d --name advanced-db-medical -p 127.0.0.1:18089:18080 advanced-db-medical:local
Invoke-RestMethod http://127.0.0.1:18089/api/health
docker stop advanced-db-medical
```

健康檢查應回傳 UP。未提供資料庫設定時，資料 API 回報資料服務異常是預期結果。
前端入口為 /pages/district/index.html 或 /pages/query/index.html；根路徑 / 沒有首頁，不用它判斷部署是否成功。

要測試 Aura，在本機另外建立 Git 忽略的 .env.render，只填以下四個欄位，值以已驗證成功的本機設定為準：

```dotenv
AURA_CONNECTION_URI=neo4j+s://YOUR-INSTANCE.databases.neo4j.io
AURA_PASSWD=YOUR_DATABASE_PASSWORD
NEO4J_USERNAME=YOUR_DATABASE_USER
NEO4J_DATABASE=YOUR_DATABASE_NAME
```

此檔使用 Docker env-file 格式：每行 KEY=value，值不加引號、不加入行尾註解。
不要直接將整份 backend/.env 傳給 --env-file；該檔可能保留舊本機 NEO4J_URI／NEO4J_PASSWORD，轉成程序環境後會優先於 Aura 變數。
部署專用檔不包含這些舊值，也不將密碼放入 Dockerfile、build arguments 或前端。

```powershell
docker run --rm -d --name advanced-db-medical --env-file .env.render -p 127.0.0.1:18089:18080 advanced-db-medical:local
Invoke-RestMethod http://127.0.0.1:18089/api/facilities/departments
docker stop advanced-db-medical
```

可另用 -e PORT=10000 與 -p 127.0.0.1:18089:10000 驗證平台注入埠。
EXPOSE 18080 只是本機預設埠說明，不會覆蓋 PORT。
JAVA_TOOL_OPTIONS 預設限制 heap 為容器記憶體的 65%，並在記憶體耗盡時結束程序；可依實際方案在執行環境覆寫。

## Render 部署設定

1. 將包含 Dockerfile 的版本 push 至 GitHub，再於 Render 建立 Web Service 並連接此 repo。
2. Runtime / Language 選 Docker；Root Directory 留空，Dockerfile Path 設 ./Dockerfile，Docker Build Context 設 .。
3. Docker Command 留空，使用映像的 ENTRYPOINT；不需另外填 Maven Build Command 或 Java Start Command。
4. 在 Environment 個別設定下表變數，勿上傳本機完整 .env，也勿設成建置參數。
5. Health Check Path 設 /api/health。Render 注入 PORT，SERVER_ADDRESS 預設為 0.0.0.0。
6. 部署完成後，先開 https://YOUR-BACKEND.onrender.com/api/health，再測試 /api/facilities/departments 與前端頁面。

|環境變數|設定方式|
|---|---|
|AURA_CONNECTION_URI|目前已驗證的 neo4j+s:// URI|
|AURA_PASSWD|目前資料庫密碼，僅填 Render Environment|
|NEO4J_USERNAME|已實測可搭配該密碼的資料庫登入帳號|
|NEO4J_DATABASE|已確認的實際資料庫名稱|
|CORS_ALLOWED_ORIGINS|GitHub Pages 前端來源，例如 https://YOUR-ACCOUNT.github.io；無專案路徑或尾斜線|
|PORT|使用 Render 注入值，不需自行固定|
|SERVER_ADDRESS|可省略；預設 0.0.0.0|
|JAVA_TOOL_OPTIONS|可省略，使用 Dockerfile 的記憶體設定；需要時完整覆寫|

同來源前後端不需 CORS；分離部署可用逗號列出數個明確來源（含協定與必要埠，不含路徑）。
CORS 預設不開放跨域，拒絕 wildcard；此 Spring 設定由程序環境注入，不由 dotenv 載入。

## GitHub Pages 接到 Render

取得 Render 的 HTTPS 網址後，分別在 pages/district/index.html 與 pages/query/index.html 的 head 設定或加入：

```html
<meta name="api-base" content="https://YOUR-BACKEND.onrender.com">
```

重新發布 GitHub Pages，並確認 Render 的 CORS_ALLOWED_ORIGINS 與實際 Pages 來源一致。
前端設定只放後端 HTTP 網址，不放任何 Neo4j URI、帳號或密碼；目前尚未有正式 Render 網址，因此本次不修改前端 api-base。
若直接使用 Render 提供的前端頁面，api-base 留空即可使用同來源 API。

Render 若採會休眠的方案，首次 HTML 尚未送達時無法執行 JavaScript 提示；GitHub Pages 與後端分離後，頁面可先顯示，再透過共用連線 gate 等待後端恢復。
方案閒置與喚醒行為應以實際方案確認；Free web service 官方目前說明為閒置 15 分鐘後休眠、喚醒約一分鐘。
本次只新增容器設定與本機驗證，不部署 Render，不執行任何資料移轉、匯入、清空或 Schema 操作。

官方資料：[Render Docker](https://render.com/docs/docker)、[Render Web Services](https://render.com/docs/web-services)、[Render Environment](https://render.com/docs/configure-environment-variables)、[Render Free](https://render.com/docs/free)、[Docker 多階段建置](https://docs.docker.com/build/building/multi-stage/)。

## Docker 本機驗證紀錄（2026-10-15）

- Docker 官方 build check 通過，無警告；Linux 多階段映像實際建置成功。
- 依 Dockerfile 相同來源布局進行隔離 Maven 編譯與 JAR 資源檢查通過；建置時略過測試，不計作單元測試通過。
- 實際匯出 Docker context 驗證允許清單：必要來源檔存在，.env、原始資料、備份、Git、target、Maven 快取及測試未納入。
- 未注入資料庫設定的容器可回應 /api/health=UP；資料 API 回傳 DATABASE_UNAVAILABLE，與 HTTP 健康分離。
- 非 root UID=999；runtime 沒有 Maven、build 原始碼目錄或 .env。
- 前端三頁及共用連線模組回傳 200；22 縣市、368 行政區資源載入正確。
- 執行時只注入四個 Aura 設定及 PORT=10000，成功查詢：實際院所科別 42、院所條件結果 2、官方統計科別 45、人員 27、Cypher 醫療院所總數 23,238。
- 明確允許來源的 CORS preflight 通過，未列來源回傳 403。
- 容器上限 512MiB；單次驗證觀察約 195MiB 使用量，並非所有查詢負載的上限保證。
- 兩個驗證容器與隔離檢查產物均已清理；映像保留為 advanced-db-medical:local。
- 尚未部署 Render；本次沒有執行資料庫寫入或 Schema 操作。

## 驗證命令

Java 單元與合約：backend/mvnw.cmd -f backend/pom.xml test
Aura opt-in 唯讀測試：在 backend 目錄設定 AURA_READ_TESTS=true，再執行 mvnw.cmd -Dtest=AuraReadOnlyTest test。
瀏覽器：node --test tests/integration/connection-state.test.cjs tests/integration/api-origin.test.cjs。
真實 stop/start：node --test tests/integration/connection-live.test.cjs（需已打包 JAR、Java 17，使用測試埠 18090、19190）。
測試需 NODE_PATH 指向有 playwright 的安裝，PLAYWRIGHT_EXECUTABLE 可指定現有 Chromium。
狀態測試縮短時間以覆蓋 90 秒停止邏輯；真實 stop/start 測試使用正式時間設定。
