# 行政區統計實作與驗證

> 歷史紀錄：此報告為 Schema 重構前的結果，不代表目前正式查詢或驗收。請以 district-statistics-schema-update-2026-10-13.md、現行 API 文件及測試為準。

日期：2026-10-13。接續使用者授權實作，舊測試報告保留作為修正前紀錄。

## 已實作

- POST `/api/districts/statistics/search`：JSON body、全國／縣市／行政區、所得／人口／面積／院所數、人員／科別數及排序。
- GET `/api/districts/statistics/options`：真實範圍、資料庫類別、22縣市與行政區。
- 新竹市不選行政區、所得下限100：東區、北區、香山區皆回傳。
- 人口／面積input使用資料中的實際min/max，切換縣市重新取得該縣市範圍並清除舊值。
- 人員／科別保留原始名稱，選單分常用、中醫／牙醫／其他。沒有合成會重複計數的父類別。
- 表格、數值排序、CSV、不同資料年度、缺值保留、無地理資料也可查詢。
- 搜尋失敗／逾時清除舊結果，快速連續查詢以最新請求為準。
- CSV文字前置公式符號加上apostrophe，並正確處理引號、逗號及換行；缺值輸出空欄。
- Cypher頁籤僅保留範例，不顯示虛構結果，不開放任意Cypher。

## 測試

| 測試組 | 項數 | 結果 |
|---|---:|---|
| 既有院所／健康回歸 | 7 | 通過 |
| 統計API與可控資料邏輯 | 10 | 通過 |
| 唯讀、指定資料庫與參數化 | 1 | 通過 |
| Neo4j資料快照 | 8 | 通過 |
| 前端模組 | 14 | 通過 |
| 真實API與瀏覽器整合 | 8 | 通過 |

後端乾淨編譯與打包成功。瀏覽器驗證桌面1440x1000及手機390x844，無pageerror及整頁橫向溢出；寬表格在其容器內捲動。
瀏覽器驗證CSV下載、地圖函式庫載入失敗、503錯誤、20秒client逾時及舊請求不覆蓋新結果。
真實API比對TC-01～06及TC-08的已知筆數／首尾或首筆值；沒有把TC-05/06的零值同分最後名次寫死，TC-08仍未固定總筆數及末筆行政區。
資料庫快照保留原始完整欄位數值斷言，不以HTTP200替代數值驗收。

仍有2項TODO：隔離測試資料庫中的多關係交叉乘積fixture，以及完整缺少醫院／診所／人員／科別關係的fixture。
目前真實快照涵蓋368區唯一性及缺少統計的已知區，Cypher各關係族獨立聚合；但這不能取代可控資料庫fixture測試。
沒有為了製造fixture而寫入正式Neo4j。TODO不算通過。
TC-07依規格取消；行政區地圖定位、標記與同步維持Pending。

## 資料與效能

全國options實際人口593～549762；面積0.8803～1641.8555平方公里。這些值來自API讀取資料，不是程式中的固定上下界。
統計在 `neo4j` 讀取368區，各類關係獨立聚合後由Java套用條件／排序。院所查詢的 `medicalfacilities` 不受影響。
此版未加快取或分頁；資料量小，先保持行為單純。未承諾任何固定毫秒數或冷啟動時間。
未修改資料庫、CSV或已核准的院所行政區修正。未新增套件依賴。
READ session、executeRead、固定Cypher、參數化類別；15秒交易逾時及20秒前端逾時。

## 檔案與使用

新增正式類別：DistrictStatisticsController、StatisticsApiErrors、StatisticsFilter、DistrictStatisticsRepository、DistrictStatisticsService。
前端：query頁面與結果更新、新增statistics-filters.js及shared/statistics-api.js；原本filters.js的缺所得比較一併修正。
LocalWebConfig允許本機POST跨來源預檢。
新增／擴充StatisticsApiContractTest、StatisticsReadOnlyTest、frontend.test.cjs、live.test.cjs。
API文件：`docs/specs/district-statistics-api.md`。重跑指令：`tests/statistics/README.md`。
執行紀錄與截圖：`docs/verification/artifacts/statistics-implementation-2026-10-13/`。

預覽：`http://127.0.0.1:18081/pages/query/index.html`。從後端開啟，不使用file協定或未指定API base的Live Server。
資料庫沒有啟動時會顯示明確錯誤，不會退回虛構資料。
此次沒有替使用者commit，也保留原本.gitignore的既有修改。
