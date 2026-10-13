# 查詢分析視覺重構驗證

日期：2026-10-13。延續階層篩選功能，這次集中改版面與樣式。

## 主要變更

- 條件面板分為基本條件、進階篩選、結果排序、底部操作四區，加入清楚的區塊標題及留白。
- 移除舊280px固定欄寬及疊加布局；基本條件與排序在桌面共用等寬兩欄，窄螢幕單欄。
- 欄位44px高度、標籤置頂、6px圓角、統一14px輸入字體及一致對齊。
- 進階區以輕邊框、內距與低對比藍色標題列呈現，整列可點擊；左側篩選圖示，右側展開／收合及箭頭。
- 無條件顯示「尚未設定條件」，有值保留「已設定N項條件」：尚未查詢的草稿不誤稱已套用。
- 進階展開時依網格安排所得、人口與土地、院所、科別與人員，不建立四張嵌套卡片。
- 操作區獨立於排序下方，桌面按鈕靠右，窄螢幕兩個等寬按鈕。
- 表單及共用選擇器分類均移除原生summary marker，包含::marker及WebKit的::-webkit-details-marker。
- 改用本地Lucide線條SVG，展開箭頭以CSS旋轉，支援減少動態效果偏好。

## 修改檔案

- `pages/query/index.html`：區塊語意、標題、操作列及SVG。
- `pages/query/styles.css`：整理舊布局、兩欄、進階網格、控制項及手機樣式。
- `pages/query/statistics-filters.js`：只更新未設定條件的顯示文字，查詢／篩選邏輯不變。
- `shared/hierarchical-selector.js`：分類標題加入共用SVG圖示。
- `shared/hierarchical-selector.css`：分類箭頭及marker重設。
- `shared/ui-icons.js`：建立可重用的裝飾性SVG，aria-hidden、不接收焦點。
- `shared/vendor/lucide/`：6個本地SVG與完整上游LICENSE；來源為https://github.com/lucide-icons/lucide。
- `tests/statistics/query-ui.test.cjs`：只同步指定的「尚未設定條件」文案斷言。
- `tests/statistics/query-visual.test.cjs`：新視覺版面驗收。
- 本報告及 `docs/verification/artifacts/query-visual-2026-10-13/`。

## 驗證

UI及視覺9組測試全部通過。Chromium檢查1440x1000、390x844、320x700三種尺寸，含初始、全部進階展開與階層選單畫面。
基本／排序欄位高度44px、桌面同列且使用90%以上的欄位容器寬度；窄螢幕為單欄。
原生marker已移除；SVG圖示非空白、無404；箭頭在展開後旋轉180度，選擇器沒有越界，整頁沒有橫向溢出或pageerror。
保留45科別、27人員的分類數量、單選、搜尋、鍵盤、重設、收合保留條件與完整JSON比對。
查詢／CSV等回歸18通過、1失敗、2 TODO：失敗仍為既有TC-08預期定義差異，沒有修改或放寬數值斷言。
未宣稱所有測試全綠，也未宣稱已完成所有瀏覽器與螢幕閱讀器驗證。

## 未改動與開啟方式

後端Java、API、Cypher、Neo4j資料、結果表格及CSV程式均未改。保留原有README.md與.gitignore修改，本次尚未commit。
已確認18080及18081回傳新版基本／排序區塊；使用者的18080服務未停止。
http://127.0.0.1:18080/pages/query/index.html 可用Ctrl+F5重新載入。
18081仍為既有預覽，沿用原後端JAR與公開靜態資源目錄。
