# 行政區院所詳情 Modal／CARE 門診表

## 完成範圍

行政區查詢的單一詳情改為原生 dialog，移至地圖容器之外，使用 showModal 置中、深色 backdrop、920px 桌面寬度及最大 90dvh 高度。
桌面與手機均由內容區捲動，標題與電話／Google 地圖操作固定於視窗內；表格自行橫向捲動。
支援 X、Esc、遮罩關閉，背景捲動鎖定、鍵盤焦點循環與關閉後焦點還原。
背景頁面的捲軸空間預先保留，開關不重新調整地圖鏡頭；搜尋條件、結果及標記保留。
重用原有清單與 Marker 詳情載入，不額外增加 API 請求。快速關閉重開與延遲回應均受版本與取消機制保護。

圖形探索頁共用既有詳情載入模組，但其抽屜介面與原有日期切換維持，修改僅對行政區的 dialog 啟用。

## 時間資料與 CARE 表格

後端既有 ClinicHoursParser 將 clinicTimeJson 解析為 clinicHours（status、days、slots），已支援舊版單一 open／close。
這次新增前端 clinic-table.js，驗證 API 的每日 slots，建立週一至週日七欄。
列數為七天最大有效時段數（至少一列顯示狀態），列名為「第 N 時段」，不推定早／午／晚診、不拆分連續時間。
每個有效區間顯示綠點及完整時間；跨日結束另標「跨日至次日」。無該列時段顯示 —；明確休診顯示 — 與休診；未知日期顯示未提供資料。
全域格式錯誤與可讀的部分資料以固定安全文字提示，不展示原始 JSON。

今天的星期以 Intl.DateTimeFormat 指定 Asia/Taipei 計算，整個星期欄淡黃標示，包含 rowspan 的休診／未知格。
計時器安排至下一個臺灣午夜，頁面恢復可見時再更新；關閉或重新載入即清理計時器與事件。
測試將瀏覽器時區設為 America/Los_Angeles，再跨過臺灣午夜，確認 Sunday 切至 Monday。

## 科別

先 trim、排除空值並去重，標題動態顯示實際 N。空資料顯示「暫無科別資料」。
以 CSS Grid 明確斷點設定每列 3／2／1 個，對每組 6／4／2 項設定整列淺藍、下一列淺綠。
縮放視窗後按當前列數重新套用 CSS，不以單一科別奇偶交錯。全部項目保留且長名稱自然換行。

## 實際修改檔案

- pages/district/index.html：將單一詳情從地圖內 aside 改為頂層 dialog，更新樣式版本。
- pages/district/app.js：開啟詳情時保留原地圖位置，停止原抽屜的避讓平移。
- pages/district/facility-detail.js：Modal 生命週期、焦點／背景鎖定、聯絡圖示、時間表切換及資料清理。
- pages/district/facility-detail.css：Modal、CARE 表、整列科別配色與響應式樣式；保留圖形頁既有樣式。
- pages/district/clinic-table.js：新七日時間資料正規化、動態表格與臺灣午夜更新。
- tests/integration/care-detail.test.cjs：離線實際頁面測試、視窗寬度、資料異常、臺灣跨日與可選正式唯讀 API 測試。
- tests/integration/facility-detail.test.cjs：同步 Modal 背景不可操作及新提示的驗收。
- tests/integration/district-interactions.test.cjs：將舊抽屜尺寸／靠右斷言改為置中 Modal，保留搜尋、地圖與電話測試。
- backend/src/test/java/tw/advanceddb/medical/service/ClinicHoursParserTest.java：追加五個時段與連續 08:00–17:30 的解析測試。
- tests/integration/README.md：測試執行方式。
- docs/verification/district-modal-2026-10-17.md：本報告。

## 驗證結果

- 最終瀏覽器組合：30 項，27 通過、3 項原有條件式跨頁／本機服務測試跳過，0 失敗。
- 最後快速重開修正後：重新驗證 Modal 互動與延遲回應兩項，2/2 通過。
- ClinicHoursParserTest：5/5 通過，包含多時段、舊格式、24:00、錯誤資料、連續與跨日時段。
- 檢查 1440×1000、820×1180、600×900、390×844、320×700；頁面無水平溢出，標題與操作固定、表格可橫向捲動。
- 測試 1／2／3／5 個時段、各日不同段數、週末／全週休診、未知與異常資料、XSS、跨日黃欄、不同欄數下整列配色。
- 以本機前端攔截靜態檔案，搭配線上實際唯讀 API：新竹市香山區、診所、內科，取得 2 間院所與 2 個標記；所選院所的 6 個實際時段與 API 完全一致。
- 截圖已人工檢視：artifacts/care-modal-live.png、care-modal-{width}.png、care-modal-departments-{width}.png。
- git diff --check 與 JavaScript 語法檢查通過。

## API、資料庫與尚待驗收

沒有修改後端生產程式、API 契約、中文資料庫屬性映射或 Neo4j Schema；既有中文屬性與 HAS_MEDICAL_FACILITIES 已於前次修正並部署。
正式 API 僅執行既有 GET 查詢；沒有遷移、寫入、刪除或重建資料。
既有 clinicTimeJson JSON 欄位與後端解析邏輯維持。只新增一項後端解析回歸測試。

本次修改已整理為本機提交，分支 codex/district-detail-modal；尚未 push 或部署，GitHub Pages 線上 UI 尚未包含本次 Modal。
兩份依賴完整本機服務的既有 live suite 已更新預期，但未整組執行；其核心流程由新的離線組合與正式唯讀 API 測試覆蓋。
原生 dialog 在本次 Chromium 已驗證；Safari、Firefox 與實體觸控裝置仍待人工驗收。
