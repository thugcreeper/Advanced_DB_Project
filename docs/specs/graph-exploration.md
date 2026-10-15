# 圖形關係探索

更新：2026-10-15（Asia/Taipei）

入口 `pages/graph/index.html`，延續現有側邊導覽、API 連線 gate 及院所詳情。原生 SVG 繪圖，沒有新增圖形套件、CDN 或前端資料庫憑證。

## 資料與互動

僅呈現 `鄉鎮區碼與名稱 -[HAS_FACILITY]-> 醫療院所 -[HAS_DEPARTMENT]-> 科別`。院所以 sourceId 識別，科別共用標準名稱節點。官方 RECORD_* 統計不加入院所家數計算。

先選縣市與行政區，再依類型、科別查詢。每批 12 間，累加最多 36 間；顯示已載入數與符合總數，超過上限時需縮小條件。符合科別的院所仍回傳完整登錄科別。

點院所展開科別並沿用詳情面板；清單另有獨立展開／收合操作。點科別高亮已載入的相連院所，可一鍵重新查詢同區同科別院所。科別摘要明示只計算目前已載入範圍。

可拖曳節點與背景、按鈕縮放、完整顯示、收合科別、名稱尋找。SVG 節點可用 Tab、Enter／Space；文字清單提供相同選取與展開操作。手機保留文字清單及既有底部詳情。圖形頁不提供內嵌地圖定位，保留詳情的 Google 地圖操作。

切換條件會取消未完成請求並防止過期回應覆蓋；原圖保留並標示條件已變更。載入失敗保留原圖，可重試或取消；pagehide 取消查詢。

## 唯讀 API

`GET /api/graph/facilities?county=新竹市&districtCode=1205&type=all&department=&offset=0&limit=12`

行政區必填且驗證縣市歸屬；type 為 all／hospital／clinic。offset 介於 0～100000，limit 介於 1～24；前端固定每批 12。資料以名稱、sourceId 排序。每次在一個唯讀交易內查總數及分頁關係，交易逾時 10 秒；無逐院所請求，無 Schema 或資料寫入。

分頁不是跨請求的固定快照；若資料同時變更，總數與分頁可能變動。前端以 sourceId 去除重複顯示。此頁為實際院所清單，不提供轉診、合作關係或醫療能力推論。

## Schema 圖

`pages/graph/aura-schema.svg` 為使用者提供的 visualisation1015.svg 原檔，未改圖形內容。作為 img 載入，提供替代文字、完整關係文字說明與原 SVG 連結。原圖部分關係名稱截短，文字說明補足。

## 部署與驗證

圖形頁 meta api-base 指向正式 Render。新增 API 須先部署後端，再發布 GitHub Pages；僅發布前端會使 /api/graph/facilities 回傳 404。Maven 與既有 Dockerfile 已自動納入 pages/graph，無需新增 Docker COPY。

本機 Java：在 backend 執行 `./mvnw.cmd -Dmaven.repo.local=.maven-cache/repository -o package`。
瀏覽器：`node --test tests/integration/graph.test.cjs`；需 Playwright Chromium，可指定 PLAYWRIGHT_EXECUTABLE。
設定 GRAPH_BASE 為運行新版後端的本機 URL，可額外執行實際 Aura 的唯讀互動測試；未設定時該案例略過，不算通過。測試使用暫存靜態 HTTP 服務及受控路由，截圖位於 Git 忽略的 tests/integration/artifacts。

## 查詢狀態與空結果 UX

篩選區下方保留可見的狀態區，分別處理初始、載入、成功、0 筆、失敗、條件未套用與取消；以 polite live region 宣告，不使用原生 alert 或強制彈窗。

0 筆時明示縣市、行政區、院所類型與科別條件，中央以空結果卡片替代 SVG，停用圖形工具，右側與清單同步說明。提供「改查全部院所」與條件式「取消科別限制」，只更動相應條件後重新查詢，保留縣市與行政區。文案限定「目前資料中」，不推論當地實際醫療資源不存在。

失敗不視為 0 筆；保留舊圖並顯示原查詢範圍。篩選變更會標示尚未套用並關閉舊院所詳情；載入與錯誤狀態在上方可直接取消或重試。

節點名稱搜尋只對已載入節點運作，顯示可見命中數／無命中說明，並可清除高亮。高亮時其他節點保留 40% 不透明度。無登錄科別的院所清單明示「尚無科別資料」。載入更多不再強制重設視角。

即時通知改為共用 snackbar，固定視窗上方顯示三秒；不必捲到圖底部。頁內狀態與恢復操作保留作為持續說明。全站審視與測試清理見 [UX 審視](../verification/site-ux-review-2026-10-15.md)。
