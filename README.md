# 臺灣醫療資源分析系統

Java 17、Spring Boot 與 Neo4j 的本機醫療資源查詢專案。

## 啟動

以 VS Code 開啟本 repo 的 `backend/pom.xml`，啟動
`backend/src/main/java/tw/advanceddb/medical/MedicalResourceApplication.java`。
預設入口：[查詢分析](http://127.0.0.1:18080/pages/query/index.html)、
[行政區查詢](http://127.0.0.1:18080/pages/district/index.html)、
[資料介紹](http://127.0.0.1:18080/pages/data/index.html)。

Spring Boot 同時提供 HTML、CSS、JavaScript 及 API，不需另開前端服務。
在 `backend/.env` 明確設定 `NEO4J_DATABASE=neo4j`，統計、院所與 Cypher 共用此設定；修改設定後重啟服務。
前端 API 預設同來源；分離部署須明確設定 `api-base`，不再有 8010 連接埠特例。
前端修改後執行 Maven `resources:resources`；Java 修改後重新建置並重新啟動程式。
不要以 `file://` 開 HTML。靜態網站部署不會執行 Java API，完整查詢使用本機 Spring Boot。

## 目前功能

- 行政區條件篩選、階層式科別／人員選擇器、排序及 UTF-8 BOM CSV。
- 可編輯的唯讀 Cypher 與九個政府統計範例；切換範例不自動執行。
- 依縣市、行政區、醫院／診所類型及實際科別搜尋院所，顯示列表與真實地圖位置。
- 資料來源、年度、公式、Schema 與使用限制介紹。

所得採 112 年，人口及政府醫療統計採 114 年；不宣稱同年度因果關係。
政府統計家數、人力與目前院所清單為不同口徑，不能互相回填。
四筆原始座標待複核的院所保留在清單中，暫不繪製地圖標記。

## 本機資料庫整合

網站現在統一讀取 `neo4j`：保留政府統計，新增 `醫療院所`、`HAS_FACILITY`、`HAS_DEPARTMENT`，共用 `科別`。
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

整合 TC-01～TC-12 與舊統計快照案例分開記錄。
原統計 TC-08 的鳥松區西醫師預期差異保持未解決，不修改預期或資料。
其餘 frontend／live／Playwright 測試見 `tests/`；整合測試依賴本機保留的歷史稽核快照，不隨 Git 提供。

地圖使用 Leaflet 與 OpenStreetMap，保留圖磚來源標示；圖磚受網路與服務可用性影響。
