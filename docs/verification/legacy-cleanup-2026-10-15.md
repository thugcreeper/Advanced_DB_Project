# Legacy 程式盤點與清理

> 本文件為第一階段盤點。下文「仍保留」第 1～3 項已於同日後續依使用者授權移除或統一設定，現況見 [設定與匯入工具清理](configuration-cleanup-2026-10-15.md)。本文件保留當時檢查紀錄。

## 範圍

正式 repo：`C:\Users\User\Desktop\git-repos\Advanced_DB_Project`。
檢查前端入口與模組引用、Java 呼叫與 Spring／Jackson 入口、獨立 CLI、設定、文件、實際建置 JAR 與本工具建立的預覽程序。
沒有執行來源匯入、遷移或資料庫寫入，不改測試預期值，不 commit 或 push。

## 已清除

- `shared/data/districts.js`：無引用的虛構統計與行政區代表座標。
- `pages/query/map.js`：無引用的舊所得分色地圖；現行入口使用 cypher-map.js。
- `pages/district/styles.css`：舊 facility-popup 的三段樣式。
- `pages/district/map.js`：無呼叫的 focus(index) 包裝；保留 focusById 及共用地圖的實際 focus。
- `DistrictFacilityService.java`：無呼叫的三參數 search 相容方法；Controller 的四參數版本保留。
- `DistrictCatalog.java`：無呼叫的 addressPattern、districtKeys、addressPrefixes，及只供它們使用的 Pattern import、正規表示式欄位與建構計算。
- `target/classes/static` 中對應的舊示範資料與舊地圖檔，避免 Maven 複製資源不會刪除舊檔而再次包入 JAR。
- 本工具先前建立的 18085 舊整合預覽程序及 integration-preview-18085.jar；該舊 JAR 原本仍包含退休的 migration 類別。

原始碼已移除的 migration 管理入口及專用測試仍保持移除，沒有重新引入。
工作區封存、來源資料、資料庫備份、Git 歷史與驗證紀錄未刪除。

## 文件修正

`docs/specs/district-statistics-api.md` 已修正：

- 統計、院所搜尋與詳情均使用 neo4j，不再宣稱網站院所查詢走 medicalfacilities。
- NEO4J_DATABASE 舊值僅為相容設定，不決定網站 Session。
- 區分固定統計 API 與獨立唯讀 Cypher 編輯器；說明實際院所定位而非宣稱全站定位暫緩。
- 正式啟動範例使用 18080，不將歷史預覽 18081 當成要求。
- 澄清鳥松西醫師 TC-08 尚未解決的預期差異，不把三類醫師合計誤當西醫師，也沒有修改測試或資料。
- 明確區分實際 HAS_DEPARTMENT 和官方 RECORD_DEPARTMENT 的口徑。

## 仍保留的歷史功能與設定

不能宣稱全專案已零 legacy；以下仍是可被使用的入口或設定，不能只因網站不直接呼叫就當成死碼：

1. 舊來源 JSON 匯入鏈：root import-medical-facilities.cmd、.vscode/settings.json 執行設定、ImportMedicalFacilities、FacilityImportService、FacilityImportRepository、MedicalFacility、FacilityImportPlan。會寫來源 medicalfacilities 並重建來源科別關係；不會更新整合後網站資料。是否永久停用來源庫重建須另作決定，本次未執行或刪除。
2. Neo4jConnection 的 SOURCE_DATABASE 與 NEO4J_DATABASE=medicalfacilities 相容檢查：來源匯入仍使用前者，舊 .env 可使用後者；網站則明確走 neo4j。
3. shared/api.js、statistics-api.js、cypher-api.js 的 8010→18080 fallback：仍可觸發的分離服務相容路徑，本次沒有改變部署行為。
4. HealthService.databaseConnected 固定 false：仍在使用的 HTTP 存活占位回應，不是實際資料庫健康檢查。不能刪除 health endpoint；若要反映連線需另外實作並更新契約和測試。
5. 測試腳本的歷史預覽預設埠：部分仍為 18081／18082／18084／18088。可以用環境變數選服務；本輪全部明確指定 18087，不以舊預覽代表新版。後續可獨立統一測試啟動設定，本次未改行為。

框架反射／註解入口、已用測試、讀寫不同的 API helper、共用 Leaflet、院所類型常數不以文字出現次數少作為刪除依據。
歷史規格與驗證文件的舊 Schema／命令不等於執行中程式碼；已標記歷史狀態的文件保留。

## 檢查與限制

- 靜態模組盤點：目前 22 個非 vendor 前端 JS 模組全數可由三個頁面入口追到引用；無其他孤立的整個模組。語法與本機 HTML 直接引用路徑檢查通過。
- javap 檢查實際 classes：DistrictCatalog 已無上述三個舊方法，DistrictFacilityService 只保留四參數 search。
- 正式 JAR 與更新後 18087 預覽 JAR 均確認不含舊虛構資料、舊 query/map.js 或退休 migration 類別；18085 舊 JAR 已刪除。
- Maven package：34 通過、0 失敗、10 舊快照測試未啟用。
- 離線表格／CSV：8 通過、2 個既有隔離 fixture TODO，未把 TODO 算成通過。
- 首輪網站回歸遇到 Neo4j 已關閉，停止測試；使用者啟動後以實際院所科別 API 完成連線預檢再重跑。
- 重跑網站回歸：29 通過、0 失敗，涵蓋 368 區院所集合、院所詳情／CARE 週曆、地圖定位、Cypher 編輯器、表格／CSV、統計篩選與桌面／窄螢幕。

靜態引用與回歸可驗證目前 repo 入口，不代表能證明外部未提供的腳本、使用者手動工作流程或所有動態行為永遠不會使用某段程式。
