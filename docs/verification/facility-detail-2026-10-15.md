# 院所詳情驗證

## 實作範圍

只擴充行政區院所查詢的詳情互動與唯讀 API，不改 Schema、統計節點或關係，不匯入資料。
正式 repo：`C:\Users\User\Desktop\git-repos\Advanced_DB_Project`。
本輪獨立預覽：`http://127.0.0.1:18087/pages/district/index.html`；原有 18080 程序未停止，須由使用者重啟以載入新版。
完整契約見 [院所詳情 API](../specs/facility-detail-api.md)。

## 修改與新增檔案

- `backend/src/main/java/tw/advanceddb/medical/model/FacilityDetail.java`（新增）：詳情與已解析時段 DTO。
- `backend/src/main/java/tw/advanceddb/medical/service/ClinicHoursParser.java`（新增）：JSON 週表解析。
- `backend/src/main/java/tw/advanceddb/medical/service/DistrictFacilityService.java`：識別碼驗證、404 與組裝。
- `backend/src/main/java/tw/advanceddb/medical/repository/DistrictFacilityRepository.java`：參數化唯讀詳情查詢。
- `backend/src/main/java/tw/advanceddb/medical/controller/DistrictFacilityController.java`：新增 GET /api/facilities/detail。
- `backend/src/main/java/tw/advanceddb/medical/controller/DistrictApiErrors.java`：404 與無效識別碼回應。
- `backend/src/test/java/tw/advanceddb/medical/DistrictSearchTest.java`：詳情、缺值、404、400、503 測試。
- `backend/src/test/java/tw/advanceddb/medical/service/ClinicHoursParserTest.java`（新增）：多段、休診、缺值、舊格式、午夜與異常格式。
- `pages/district/index.html`：詳情面板骨架。
- `pages/district/app.js`：清單與地圖共用選取及搜尋重置。
- `pages/district/map.js`：標記選取、鍵盤入口與定位避開抽屜。
- `pages/district/results.js`：清單詳情入口與本機定位圖示。
- `pages/district/facility-detail.js`（新增）：非模態抽屜、可讀內容、安全文字渲染、取消與序號防競態、焦點回復。
- `pages/district/facility-detail.css`（新增）：桌面右側、手機底部、內部捲動與減少動態偏好。
- `shared/leaflet-map.js`：focus 新增可選偏移量；原有呼叫預設不變。
- `shared/vendor/lucide/x.svg`（新增）：本機 Lucide 關閉圖示，沿用既有授權。
- `tests/integration/facility-detail.test.cjs`（新增）：真實資料、同一詳情入口、鍵盤、布局、缺值、錯誤、競態及關閉。
- `docs/specs/facility-detail-api.md`、本驗證報告（新增）。

## 驗證結果

- Maven package：34 通過、0 失敗、10 舊快照測試未啟用（總計 44，不將 skip 計為通過）。
- 院所詳情與既有院所整合測試：9 通過。包含全 368 區的 23,225 間醫院／診所集合；13 間病理中心仍依既有規則排除於搜尋列表。
- 既有 Cypher UI、統計 UI 與視覺回歸：16 通過，包含編輯器、結果表格、CSV、階層選擇器、地圖及窄螢幕。
- 桌面 1440×1000、手機 390×844／320×700 截圖已檢查；無水平溢出，面板內容內部捲動，關閉與重新開啟正常。
- Neo4j 唯讀盤點 sourceId 唯一：23,238／23,238；實際詳情欄位與稽核快照比對，含多科別與家庭醫學科，未出現家醫科原名。
- 時段以真實 JSON 與解析結果比對；無科別／電話／時段、格式錯誤與 API 錯誤另用隔離回應測試，不修改資料庫製造案例。
- 初次測試有服務尚未完成啟動與動畫位置擷取時機問題，已等待服務及進場動畫後重跑；無調整 API 資料或放寬內容斷言。

截圖僅在 Git 忽略的 `tests/integration/artifacts/facility-detail-*.png` 本機留存。
未加入評價、照片、醫師或即時營業狀態。實際診療時間仍以院所為準，OSM 圖磚依賴外部服務。
歷史鳥松區西醫師快照差異與兩項 fixture TODO 未在本輪修正，亦未宣稱通過。
未 commit、push 或執行資料庫寫入。
