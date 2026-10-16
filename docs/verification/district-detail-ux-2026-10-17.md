# 行政區院所詳情與地圖 UX 驗證（2026-10-17）

## 實際根因

原程式已使用 fixed 詳情面板，沒有新增 district-grid 欄位。實測開啟前後 map 都是 x=718.390625、y=200.59375、width=696.609375、height=680，zoom=14。造成視覺壓縮的是整個 viewport 右側的 460px 面板（x=980、y=68、height=932），沒有依地圖位置／可見高度調整，也不自動避讓所選 Marker。

舊卡片定位 click 同時呼叫 onSelect 與 onLocate，會開詳情、送出 detail API，且共用 focus 將 zoom 至少提高為 15。因此「查看」與「定位」混在一起，地圖視野會跳變。定位按鈕只有 32px；列表每筆都輸出座標；詳情另有定位按鈕及低權重 Google 文字連結。

## 修改檔案

- pages/district/app.js：分開查看／定位操作，選取狀態同步，Marker 選取只捲清單自身，查詢成功後關閉舊詳情；地圖無法載入時定位提供 Snackbar。
- pages/district/results.js：44px 定位入口、不冒泡、不開詳情；保留名稱／類型／地址／電話，移除例行座標文字，缺座標顯示原因並停用。
- pages/district/map.js：保留 zoom 的平移、必要時避開抽屜、所選 Marker 的加粗／放大／陰影、名稱 tooltip；密集點按名稱與地址選擇，原始經緯度不變。
- pages/district/facility-detail.js：依地圖右緣定位及 viewport 可用高度；移除 onLocate、來源檔名渲染；Google 座標／名稱地址路徑、無效電話隱藏、tel 分機格式；保留取消、序號防過期、重試、Escape、焦點回復。
- pages/district/facility-detail.css：390px 覆蓋抽屜、平板及手機 bottom sheet、獨立捲動、44px 關閉、並列操作、緊湊間距，圖例與版權控制項避讓。
- pages/district/styles.css：縮小搜尋垂直空白、結果數字加粗、44px 按鈕、清單 overscroll containment、Marker 與鄰近院所選單。
- pages/district/index.html：將詳情掛在 map-wrap，刪除 detailLocate，保留新分頁 Google 連結。
- pages/district/clinic-week.js：標題明示診療時間為「資料記載」，不新增即時營業判斷。
- shared/leaflet-map.js：僅在回傳 controller 增加現有 map 實例，既有 update／focus／ResizeObserver 邏輯不改；其他頁面繼續原行為。
- tests/integration/district-interactions.test.cjs：新增本次 UX 驗收；facility-detail.test.cjs、care-detail.test.cjs 改用新操作。更新 care-facility-detail.md、facility-detail-api.md。

## 行為差異

桌面 >1100px 以地圖右緣對齊 390px fixed 抽屜，不重分主欄位；內容長時只捲面板中段。1100px 以下改成底部面板，手機全寬、64dvh，確保關閉與兩個動作可見。面板不使用位移入場動畫，避免標記避讓的座標測量偏差。

卡片點擊開詳情；定位只選卡片／Marker 並平移，若有舊詳情則關閉，不另外送出 detail API；Google 地圖外開。關閉保留已選院所及目前地圖視圖。內部來源檔名只從 UI 隱藏，沒有修改資料庫、API source 或資料介紹來源。

若 Marker 14px 內有多個院所，點擊提供帶名稱與地址的選擇清單。選單最多顯示 60 項且明示其餘可從清單或放大地圖選取，不刪除任何搜尋結果或 Marker，不抖動／偽造座標。鍵盤可直接操作每個具名稱的 Marker。

## 實際驗收證據

基隆市中正區、院所類型 all、院所科別「牙科」：API 實查 15 筆，清單與有效 Marker 數量一致。

佳暉牙醫診所：

- sourceId：69be8f54c92d1a1c8fc5b6da，沿用識別碼查詳情。
- 地址：基隆市中正區祥豐街100號。
- 座標：25.142822、121.765189。
- 電話連結：tel:0224622891。
- Google Maps：query=25.142822,121.765189，api=1。

開啟／關閉前後量測 map bounding box、Leaflet 實例 ID、getSize 及 getZoom；均不因面板重建／改尺寸／縮放。選取 Marker 在面板外；來源標示不被抽屜蓋住。定位後真實座標落在視圖中心 1px 內（Leaflet 平移會取整數像素），同時 Marker 的實際 lat/lng 未改。

定位按鈕量測至少 44×44，title 與 aria-label 正確；不送出 detail API、不觸發卡片開啟。清單到邊界後 wheel 不連鎖捲動頁面。Marker 開詳情同步卡片狀態，Escape／關閉回原按鈕或 Marker。

Google 按鈕實際觸發新分頁並核對完整 query；測試攔截 Google 第一個文件請求，避免依賴外部地圖服務。電話檢查有效 tel 及 ;ext=123 格式，未實際撥號。缺座標／待複核時停用定位；Google 以編碼後的名稱＋地址搜尋，沒有地址與位置則隱藏。缺電話或不合法電話隱藏動作，時段缺少／格式異常有明確文字，無假營業狀態。

1440×768、1024×768、820×1180、390×844、320×700 檢查無水平溢出、關閉鈕在 viewport 內、標題與動作列不隨內容捲動；原週曆鍵盤、時段、科別網格、重試／404／取消與過期回應均保留。

## 範圍及產物

沒有修改後端 Java、Cypher、查詢條件、資料庫 Schema 或資料；沒有重新匯入。共用地圖只增加必要的實例存取，Cypher 頁另做回歸。未 commit／push／部署。

原始證據與截圖在 Git 忽略的 tests/integration/artifacts/district-interactions-evidence.json、district-drawer-*.png、district-actions-1440.png；正式來源 api-base 保留 Render，18091 預覽同來源。

實體手機、實際撥通電話及 Google 完整網站服務未做端到端驗證；已以瀏覽器手機尺寸、原始 API、標準導航 URL、新分頁及 tel 語法驗證。

## 最終執行結果

2026-10-17：Node 測試以 --test-concurrency=1 依序執行 district-interactions（10）、facility-detail（3）、care-detail（3）、district-ui（1）、Cypher UI（5），共 22 通過、0 失敗、0 skip、0 TODO。INTEGRATION_BASE 與 CYPHER_BASE 明確指定 http://127.0.0.1:18091。

Maven 離線 package -DskipTests：BUILD SUCCESS，確認前端資源打包成功；此步驟跳過 Java 測試，不列為 Java 測試通過。
