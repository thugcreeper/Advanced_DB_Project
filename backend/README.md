# Spring Boot 後端

Java 17、Spring Boot 3.5.16，使用 Neo4j Java Driver 5.28.13。
以 VS Code 開啟 `pom.xml`，等待 Maven 依賴載入，再執行
`src/main/java/tw/advanceddb/medical/MedicalResourceApplication.java`。
預設為 `http://127.0.0.1:18080/`，健康檢查為 `/api/health`。
此健康檢查只代表 HTTP 程式存活，不查資料庫，也不再回傳 databaseConnected 占位。
完整連線、重連與部署說明見 [AuraDB / Render 設定](../docs/specs/auradb-render.md)。

## 設定與服務

在 `.env` 設定 `AURA_CONNECTION_URI`、`AURA_PASSWD`、`NEO4J_USERNAME=<實際登入帳號>`、`NEO4J_DATABASE=<實際資料庫名稱>`。
URI 使用 `neo4j+s://`。程序環境可提供 NEO4J_URI／NEO4J_PASSWORD；dotenv 中 Aura 設定優先於舊本機值。
統計、院所搜尋／詳情與 Cypher 全部由同一份 `Neo4jConnection` 取得資料庫名稱，不再各自硬編碼或忽略舊值。這個設定會真正決定查詢的資料庫，正式環境請填入 Aura 實際資料庫名稱。
`NEO4J_DATABASE` 必須明確設定；缺少時回報設定錯誤。修改 `.env` 後須重啟 Spring Boot。
密碼與完整 `.env` 不放入文件、終端輸出或 Git。

Spring Boot 提供 `/pages/query/index.html`、`/pages/district/index.html`、`/pages/data/index.html`。
前端資源由 Maven 複製至 `target/classes/static`。更新前端後可執行：

```powershell
.\mvnw.cmd '-Dmaven.repo.local=.maven-cache/repository' -o resources:resources
```

Java 變更需重新建置並重新啟動，瀏覽器頁面也需重新載入。
前端預設使用網頁同來源的 API，沒有特殊連接埠轉送。若另行分離部署，請明確設定頁面的 `meta[name="api-base"]`。

## API

- `GET /api/districts`：原 CSV 的 22 縣市、368 行政區。
- `GET /api/facilities?county=新竹市&districtCode=1205&type=all&department=內科`：經 `HAS_FACILITY` 與實際 `HAS_DEPARTMENT` 查詢。
- `GET /api/facilities/departments`：實際院所的標準化科別。
- `GET /api/districts/statistics/options` 與統計 search：官方統計資料，不混入院所獨有科別。
- `POST /api/cypher/query`：唯讀查詢、參數、15 秒逾時、1000 列及約 2 MB 限制。

院所結果回傳 department、total、unlocatedCount、unassignedTotal 及完整列表。
四筆已知座標衝突仍計入列表，不繪製地圖點。病理中心保存於目標，但不列入醫院／診所分類。

## 整合完成狀態

一次性搬移工具、管理 launcher 與專用測試已移除，網站只使用整合後的查詢程式。
舊來源 JSON 匯入程式、批次入口與 VS Code 專用執行設定亦已移除；正常啟動入口仍是 MedicalResourceApplication。
備份、稽核快照與驗證紀錄保留；歷史整合與資料庫還原說明見 [管理文件](../docs/specs/neo4j-integration-operations.md)。
