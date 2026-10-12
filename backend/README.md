# Spring Boot 後端

Java 17、Spring Boot 3.5.16。用 IDE 開啟 Maven 專案 `backend/pom.xml`，等待依賴載入完成。

## 啟動後端

開啟 `src/main/java/tw/advanceddb/medical/MedicalResourceApplication.java`，按 main 上方的 Run。

健康檢查：http://127.0.0.1:18080/api/health

```json
{"status":"UP","application":"medical-resource-backend","databaseConnected":false}
```

目前健康檢查只確認 HTTP 服務啟動，尚未檢查 Neo4j 連線；查詢分析頁仍使用示範統計資料，行政區查詢使用真實 Neo4j 院所。
預設 port 是 18080，可在 `src/main/resources/application.properties` 修改。
本機 Windows 保留了 8015–8114，因此 8080–8088 無法使用。

neo4j瀏覽器:http://localhost:7474/browser/

## 行政區查詢

後端啟動後直接開啟 http://127.0.0.1:18080/pages/district/index.html 。由 Spring Boot 同時提供前端及 API，不必另開 Live Server，也不要直接以 file:// 開啟 HTML。

`GET /api/districts` 提供原 CSV 的縣市/行政區選單；`GET /api/facilities?county=新竹市&districtCode=1205&type=all` 提供完整院所資料，type 可為 all、hospital、clinic。
請啟動 Neo4j medicalfacilities 並填好 backend/.env。查詢優先使用已核准的 county/districtCode，沒有代碼才比對地址；搜尋 API 只讀取資料庫。

已核准的 94 筆行政區歸屬可正常查詢。4 筆座標衝突仍計入總數，但顯示「座標待複核」且不放置地圖標記。
詳細結果見 [驗收報告](../docs/verification/district-medical-search-2026-10-12.md)。
