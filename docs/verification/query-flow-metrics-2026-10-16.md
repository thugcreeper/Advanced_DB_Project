# 查詢分析：流動式指標與字級調整驗證（2026-10-16）

> 歷史紀錄：本文的表格內展開已由 [置中 Modal](statistics-modal-2026-10-16.md) 取代；字級與 Flexbox 指標樣式沿用。舊 metrics-layout 測試已改為 statistics-modal.test.cjs。

## 修改範圍

- pages/query/results.js：展開按鈕改為 SVG Chevron；明細插入對應行政區下方的獨立 tr，td colspan 涵蓋全表。每筆、每種展開狀態以行政區識別保留，排序後仍維持；新查詢重設。button 提供 aria-expanded、aria-controls 與行政區名稱，內容為具名稱的 region、dl/dt/dd，可用 Enter／Space 操作。
- pages/query/columns.js：統計欄位沿用既有動態欄位設定，增加結構化指標描述；「更多指標」排除主表及其他分項已包含的指標。沒有改 API 資料；多科分項仍分別呈現，不相加為不重複院所數。
- pages/query/styles.css：既有排版內採 Flexbox；flex-wrap:wrap、justify-content:flex-start、align-items:flex-start、gap:4px。各指標 flex:0 0 auto、width:max-content、max-width:100%、min-width:0，內距 6px 10px；細框 #91a9c1，交錯底色 #dcecfb／#cdd6e3。無固定三欄、等寬或強制撐滿。表格依內容寬度，數值靠右，資料列白／淺灰交錯，展開列藍色並與明細左側藍線連結。
- pages/query/index.html：查詢頁樣式置於共用選擇器樣式之後，更新樣式版本。
- tests/statistics/metrics-layout.test.cjs、fixtures/query-font-baseline.json：原預覽 computed style 基準與新驗收測試。
- tests/statistics/multi-filter.test.cjs、query-visual.test.cjs：沿用原功能驗證，改用新跨列展開控制及放大後的控制項高度；移除舊測試對清除人員會自動清除 scope 的過時預期，驗證 scope 保留及手動還原。
- docs/specs/district-statistics-api.md：補充展開列、排版及格式規則。

## 字級基準

先以原本 18091 預覽實際量測，再調整每一種既有字級，並量測修改後 computed style。1440、1100、390px 的全套取樣逐項比對 1.5 倍，涵蓋標題、導覽、篩選器、選項、說明、表格、CSV、Cypher、地圖與 Snackbar；隱藏的選單文字也納入。

| 項目 | 原本 | 修改後 |
|---|---:|---:|
| 桌面頁面標題 | 34px | 51px |
| 區塊標題 | 20px | 30px |
| 篩選標籤 | 13px | 19.5px |
| 篩選輸入／選項 | 14px | 21px |
| 表頭／CSV | 13px | 19.5px |
| 表格數值／展開操作 | 14px | 21px |
| 說明文字 | 12px | 18px |
| 手機頁面標題 | 28px | 42px |

明細名稱 21px，數值另外以 27px、700 字重強調。控制項移除固定 44px 高度，改為至少 55px 與自然高度；必要的 px 行高也依 1.5 倍調整。原有 18px SVG 圖示防護保留。

## 實際資料與畫面

查詢新竹縣，展開新竹縣竹北市：主表為平均所得 2,059 千元、醫院 5、診所 284；明細不再重複上述三個指標。

- 人口 220,973 人。
- 面積 46.8341 平方公里。
- 醫事人員 3,948 人；每萬人口醫事人員 178.66。
- 醫師 957 人；每萬人口醫師 43.31。
- 西醫師 619、中醫師 94、牙醫師 244。
- 人口與醫療統計年度 114，所得年度 112。

以上由實際 API 取得，測試再與實際 DOM 比對；沒有硬編碼資料進網站。整數千分位、面積最多 4 位、比率最多 2 位；缺值顯示「未提供」、0 顯示「0」，原始物件不變。

1440／1100px 主表不需水平捲動，指標有多種自然寬度；390／320px 無整頁水平溢出，手機主表必要時在表格內捲動，避免文字逐字斷行，明細仍限制於螢幕可用寬度自然換行，並以 sticky 隨表格可視範圍保持可見，避免按下右側展開後明細落在畫面外。展開列涵蓋整張表格，兩筆同時展開、排序後保留狀態、鍵盤收合均有驗證。CSV 不包含展開控制列或更多指標，維持原主要欄位與排序。

本機截圖與字級量測位於 Git 忽略的 tests/integration/artifacts/metrics-flow-*.png、query-fonts-*.json。

## 發布與限制

本次未改 Java／Cypher、未寫入資料庫，未 commit／push／部署。預覽使用 18091；正式來源的 api-base 仍為既有 Render URL。手機主表允許容器內橫向捲動，沒有藉由縮小字級塞入欄位。已驗證瀏覽器鍵盤與 ARIA 屬性，未進行實體手機或正式螢幕閱讀器測試。

## 測試結果

1. 完整前端回歸：41 通過、0 失敗、0 跳過、0 TODO（220 秒）。Node --test --test-concurrency=1 執行 tests/cypher/ui.test.cjs，以及 tests/statistics 下的 frontend、metrics-layout、multi-filter、query-ui、query-visual。STATISTICS_BASE／CYPHER_BASE 明確設定為 http://127.0.0.1:18091。包含 Aura 實際唯讀查詢及原始 RECORD_DEPARTMENT 比對。
2. 最後補上手機明細 sticky 後，再執行 metrics-layout.test.cjs：8 通過、0 失敗、0 跳過、0 TODO（56 秒）；新增檢查按下右側展開後，每個指標的左右邊界仍位於可視容器內。這 8 項為重跑，不另計為 49 個不同測試。
3. Maven offline package -DskipTests：BUILD SUCCESS，最終 JAR 包含最新 HTML／CSS／JavaScript。本步為資源封裝，沒有將略過 Java 測試算為通過；本次沒有重跑 Java 單元測試。
4. git diff --check 通過。預覽 JAR、截圖與字級實測產物均不在 Git 追蹤清單。

第一輪曾發現舊 query-visual 測試假設清除人員會清除 scope；實際既有功能為保留 scope。本次修正測試以驗證保留 hospital，接著明確切回 all 並確認條件清除；未為通過測試修改篩選語意。
