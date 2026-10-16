# 臺灣醫療資源分析系統
URL:https://thugcreeper.github.io/Advanced_DB_Project/pages/query/index.html

Java 17、Spring Boot 與 Neo4j AuraDB 的醫療資源查詢專案。

[AuraDB 連線、共用重連與 Render 部署設定](docs/specs/auradb-render.md)。

## 啟動

以 VS Code 開啟本 repo 的 `backend/pom.xml`，啟動
`backend/src/main/java/tw/advanceddb/medical/MedicalResourceApplication.java`。
預設入口：[查詢分析](http://127.0.0.1:18080/pages/query/index.html)、
[行政區查詢](http://127.0.0.1:18080/pages/district/index.html)、
[資料介紹](http://127.0.0.1:18080/pages/data/index.html)。

Spring Boot 同時提供 HTML、CSS、JavaScript 及 API，不需另開前端服務。
在 `backend/.env` 明確設定 `NEO4J_DATABASE=<實際資料庫名稱>`，統計、院所與 Cypher 共用此設定；修改設定後重啟服務。
前端 API 預設同來源；分離部署須明確設定 `api-base`，不再有 8010 連接埠特例。
前端修改後執行 Maven `resources:resources`；Java 修改後重新建置並重新啟動程式。
不要以 `file://` 開 HTML。靜態網站部署不會執行 Java API，完整查詢需連接本機或 Render 上的 Spring Boot。

## 目前功能

- 行政區條件篩選、科別複選 OR／AND、階層式人員選擇器、動態精簡結果、排序及與主要欄位一致的 UTF-8 BOM CSV。
- 可編輯的唯讀 Cypher 與九個政府統計範例；切換範例不自動執行。
- 依縣市、行政區、醫院／診所類型及實際科別搜尋院所，顯示列表與真實地圖位置。
- 圖形關係：依行政區探索院所與科別，分批載入、展開、高亮、縮放拖曳及院所詳情；內附 Aura Schema 原圖。
- 資料來源、年度、公式、Schema 與使用限制介紹。

所得採 112 年，人口及政府醫療統計採 114 年；不宣稱同年度因果關係。
政府統計家數、人力與目前院所清單為不同口徑，不能互相回填。
四筆原始座標待複核的院所保留在清單中，暫不繪製地圖標記。

## 本機資料庫整合

網站連線至 AuraDB，查詢資料庫由 `NEO4J_DATABASE` 明確指定（以實際資料庫查詢結果為準）：保留政府統計，新增 `醫療院所`、`HAS_FACILITY`、`HAS_DEPARTMENT`，共用 `科別`。
科別統計使用 `RECORD_DEPARTMENT`。來源 `medicalfacilities` 原有資料完全保留，整合不修改來源。
一次性整合已完成，搬移工具與其專用測試已移除；網站不會自動執行遷移。

- [Schema 與科別對照](docs/specs/neo4j-integrated-schema.md)
- [備份、恢復及歷史整合程序](docs/specs/neo4j-integration-operations.md)
- [2026-10-15 整合驗證](docs/verification/neo4j-integration-2026-10-15.md)

舊 JSON 匯入工具及專用 VS Code 執行入口已移除；資料庫與本機原始資料檔保留。
不自動同步或刪除來源快照之外的目標院所。`.env`、完整快照、實體備份、截圖及建置產物不提交 Git。

## 驗證

```powershell
cd backend
.\mvnw.cmd '-Dmaven.repo.local=.maven-cache/repository' -o test
```

目前 API、frontend／live／Playwright 測試見 `tests/`。
舊統計固定快照、一次性搬移比對及未實作 TODO 已依使用者要求移除；歷史差異與備份仍保留於既有文件／本機備份，未修改資料庫。

地圖使用 Leaflet 與 OpenStreetMap，保留圖磚來源標示；圖磚受網路與服務可用性影響。

## 服務健康與 Aura 定期檢查

後端 HTTP 健康檢查：[Render 健康檢查](https://advanced-db-project-s6bd.onrender.com/api/health)，本機為 http://127.0.0.1:18080/api/health。此端點不查詢資料庫；實際資料服務可用 `/api/facilities/departments` 驗證。正式後端：https://advanced-db-project-s6bd.onrender.com。

[每日 Aura 唯讀檢查設定](docs/specs/auradb-render.md#aura-每日唯讀檢查github-actions)：GitHub Actions 每天臺灣時間 12:00 直接查詢 Aura，需先設定四個 repository Secrets 並推送至預設分支。排程不能取代備份，也不保證免費方案不暫停；公開 repo 的排程另有 60 天無 repo 活動自動停用限制。

圖形關係的功能範圍與驗證見 [圖形探索設定](docs/specs/graph-exploration.md)。
