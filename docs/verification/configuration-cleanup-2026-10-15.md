# 設定與舊匯入工具清理

## 已完成的三項要求

1. 移除舊 JSON 匯入鏈與 VS Code 專用執行入口。
2. 以必填的 NEO4J_DATABASE 作為所有網站查詢唯一的資料庫設定，正式值 neo4j。
3. 移除前端 8010→18080 特例；預設同來源，分離部署保留明確 api-base。

沒有寫入資料庫、修改 Schema、刪除資料集或備份。沒有 commit 或 push。

## 刪除範圍

- root `import-medical-facilities.cmd`
- `backend/src/main/java/tw/advanceddb/medical/scripts/ImportMedicalFacilities.java`
- `backend/src/main/java/tw/advanceddb/medical/service/FacilityImportService.java`
- `backend/src/main/java/tw/advanceddb/medical/repository/FacilityImportRepository.java`
- `backend/src/main/java/tw/advanceddb/medical/model/MedicalFacility.java`
- `backend/src/main/java/tw/advanceddb/medical/model/FacilityImportPlan.java`
- `.vscode/settings.json` 的匯入專用 executorMapByGlob，保留一般 runInTerminal 偏好。
- Neo4jConnection 的舊固定資料庫常數、SOURCE_DATABASE、舊值例外與僅供匯入使用的靜態 open。
- target/classes 中上述類別及其匿名／巢狀類別；重新打包後確認沒有殘留。
- pom.xml 的匯入入口切換用 app.main-class 屬性；正常 Spring Boot 入口固定為 MedicalResourceApplication。

原 JSON、來源資料庫 medicalfacilities、目標 neo4j 與備份完全保留。

## 單一連線設定

Neo4jConnection 快取同一份 dotenv 設定，Driver 與 database() 共用；不再讓不同 Repository 使用不同來源或硬編碼資料庫。
DistrictStatisticsRepository（資料及選項）、DistrictFacilityRepository（搜尋／科別／詳情）、CypherQueryService 的 Session 都讀取 connection.database()，READ 模式及唯讀查詢限制不變。
NEO4J_DATABASE 無缺省回退值，未設定或空白為明確設定錯誤；非空值作為真正的資料庫名稱，不再把舊值視為可以忽略的相容標記。
目前本機 backend/.env 的資料庫名稱與 .env.example 已統一為 neo4j；實際 .env 僅變更該鍵，URI、使用者名稱與密碼未變更、未輸出且未加入 Git。
設定載入後快取，修改 .env 須重啟 Spring Boot。若外部環境變數有同名設定，仍遵循 dotenv 的正常環境變數優先規則。

## 前端路由

shared/api.js、statistics-api.js、cypher-api.js 統一規則：明確 meta api-base 優先，否則 window.location.origin。
因此在 8010 開啟頁面時，沒有 api-base 就向 8010 發 API 請求，不會暗中轉向 18080。
Spring Boot 預設在 18080 同時提供網站與 API；不需要另開前端服務。

## 修改與新增

- Neo4jConnection、兩個 Repository、CypherQueryService：統一設定。
- .env.example、本機忽略的 .env、pom.xml、.vscode/settings.json：設定與入口收斂。
- 三個 shared API helper：刪除特例。
- 新增 Neo4jConnectionTest 與 FacilityDatabaseTest；補強 StatisticsReadOnlyTest、CypherQueryServiceTest，使用不同於 neo4j 的測試名稱驗證確實讀取設定而非仍用常數。
- 新增 tests/integration/api-origin.test.cjs：三個 helper 的一般同來源、8010 同來源與明確分離 API base。
- README、backend README、統計 API 契約與歷史文件狀態註記同步更新。

## 驗證結果

- Maven package：38 通過、0 失敗、10 個舊快照測試未啟用（48 總計，skip 不算通過）。
- API 來源／路由測試：9 通過，不連線實際資料庫或撥號。
- 新版服務實際院所科別預檢：42 項，確認 .env 已能正常連線。
- 院所 API／368 區集合、CARE 詳情、地圖、Cypher UI 與統計 UI／視覺回歸：29 通過。
- 正式 JAR 與更新後 18087 預覽 JAR 均無已退休匯入類別。
- 主程式與前端不再引用舊匯入類別、SOURCE_DATABASE、app.main-class 或 8010 特例。

測試啟動的是本工具的 18087 預覽；原有使用者 18080 服務沒有被停止，使用者需重啟以載入新版 Java 與靜態資源。
歷史驗證文件保留當時的結果與命令，已標示後續清理，不代表程式仍存在。
HealthService 的占位 databaseConnected=false、歷史測試預設埠、鳥松統計快照差異與既有 fixture TODO 不屬本輪三項要求，沒有擅改或宣稱解決。
