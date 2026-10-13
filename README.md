# 臺灣醫療資源分析系統
前端URL:https://thugcreeper.github.io/Advanced_DB_Project/pages/query/index.html

原生 HTML、CSS、JavaScript ES Modules 前端雛形，僅實作查詢分析。
前端仍使用示範查詢；後端提供健康檢查及雙擊執行的院所 JSON／Neo4j 匯入腳本，尚未串接院所查詢 API。
## 前端本地端測試環境
http://127.0.0.1:18080/pages/district/index.html
## 後端

`backend/` 使用 Spring Boot、Java 17、Maven Wrapper，採 `model / service / controller`
分層。啟動與 API 說明見 [backend/README.md](backend/README.md)。
院所 JSON 結構檢查記錄見 [data/README.md](data/README.md)。
兩份原始 JSON、秘密設定及建置產物均已加入 `.gitignore`。

## 本地啟動
在專案根目錄執行 `python -m http.server 8010 --bind 127.0.0.1`，
開啟 http://127.0.0.1:8010/pages/query/ 。這只是靜態檔案伺服器。
ES Modules 需透過 HTTP 開啟，不使用 file://。
若 Windows 將 JavaScript 回傳為 text/plain，改用以下命令指定正確 MIME 類型：

```powershell
python -c "import mimetypes,runpy,sys; mimetypes.init(); mimetypes.add_type('text/javascript','.js'); mimetypes.add_type('text/css','.css'); sys.argv=['http.server','8010','--bind','127.0.0.1']; runpy.run_module('http.server',run_name='__main__')"
```

重新啟動後使用 http://localhost:8010/pages/query/ ，避免先前錯誤 MIME 的快取。
Leaflet 1.9.4 從專案本地載入，OSM 圖磚需要網路連線。

## 檔案用途
| 檔案 | 用途 |
| --- | --- |
| index.html | 唯一入口，導向查詢頁 |
| shared/styles.css | 共用標題列、導覽、按鈕樣式 |
| shared/vendor/leaflet/ | Leaflet 1.9.4 官方套件 JS、CSS 與 LICENSE，避免依賴 CDN 載入 |
| shared/data/districts.js | 12 筆固定行政區展示資料與限制 |
| pages/query/index.html | 查詢頁結構 |
| pages/query/styles.css | 查詢、表格、地圖布局，桌面左右 45：55 |
| pages/query/app.js | 模組組裝、共用結果更新入口 |
| pages/query/modes.js | 頁籤、鍵盤、面板可見性 |
| pages/query/editor.js | 範例選擇、清除、自訂查詢拒絕提示 |
| pages/query/examples.js | 三種 Cypher 展示範例及篩選條件 |
| pages/query/filters.js | 縣市、數值條件篩選及重設 |
| pages/query/results.js | 表格、排序、空狀態、CSV |
| pages/query/map.js | Leaflet、OSM 圖磚、圓點、範圍及尺寸更新 |

## 展示限制
- 依參考圖配置頂部標題、左側導覽、中間查詢與表格、右側互動地圖。
  桌面並列，手機上下排列。其他導覽明確標示尚未開放。
- 切換 Cypher／條件篩選不執行查詢、不改變已有結果。
- 三種範例：所得 > 1500 千元、醫院 < 2 家、中醫師 = 0 人。
  Cypher 文字為示意，非真實資料庫結構；不解析語法。
  修改（含空白）不視為所選範例，自訂及空白查詢保留原結果並提示。
- 選範例不自動執行；清除只清空文字。重設表單顯示全部示範資料。
- 表格與地圖共用結果，每筆一個圓點，不群聚、不加入點擊資訊視窗。
  查詢清空舊標記並調整範圍；零筆清空標記、顯示提示。
- 數值均為虛構，非政府統計；座標為概略展示位置。
  縣市選單只有展示資料涵蓋縣市，尚非全臺行政區清單。
- CSV 匯出目前排序後結果，使用 UTF-8 BOM，檔名標示示範資料。
- OSM 圖磚使用 https://tile.openstreetmap.org/{z}/{x}/{y}.png ，保留來源標示，
  使用瀏覽器快取與預設 Referer，不批次下載、不離線預載。
  使用政策：https://operations.osmfoundation.org/policies/tiles/ 。
- 地圖恢復按鈕返回臺灣全圖，ResizeObserver 處理尺寸改變。
  外部服務載入失敗時顯示提示。

## 待辦：正式行政區與經緯度資料
- 使用者已準備「全台鄉鎮市區人口密度.csv」，尚未匯入。
  包含 22 縣市、368 鄉鎮市區及東沙、南沙，需排除中文說明列並處理缺值。
- 已提供含經緯度的院所 JSON，可雙擊 `import-medical-facilities.cmd` 匯入 `medicalfacilities`；
  行政區代表座標與院所地址對應仍待處理，不連線或修改 MongoDB。
