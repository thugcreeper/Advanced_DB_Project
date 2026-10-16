# 查詢分析 Modal 重構驗證（2026-10-16）

> 歷史紀錄：現行分頁、缺值與查詢快照行為見 [條件式 Modal 驗證](conditional-modal-2026-10-16.md)；舊固定分頁／完整 25 欄及初版正數篩選測試已退休。

## undefined 根本原因與 API 證據

舊 columns.js 以 hospital／clinic／total 三個欄位建立科別指標標籤，但 scopeName 僅包含 all／hospital／clinic，缺少 total；因此 scopeName[total] 變成 undefined。這是前端標籤對照錯誤，API 的 total 存在且正確，並非資料庫缺漏。

實際唯讀 POST /api/districts/statistics/search：county=新竹縣，specialties=[內科、外科]，兩科 scope=all、count.min=1。竹北市回傳：

```json
[
  {"category":"內科","hospital":5,"clinic":12,"total":17,"selected":17},
  {"category":"外科","hospital":4,"clinic":11,"total":15,"selected":15}
]
```

新前端補齊 total 對照；Modal 使用固定且具語意的科別／醫院／診所／合計表頭，直接讀取各科 hospital／clinic／total，沒有以字串取代掩蓋，也沒有依假設重新計算 total。數值渲染及 CSV 保護非有限數字、缺值、物件和內部值字串，缺值顯示「未提供」、0 顯示「0」。單科舊純量回應仍僅用於單科；多科缺少資料時不拿首科純量冒充其他科。

## 修改檔案與行為

- pages/query/results.js：真正刪除 expanded Set、detailRow、colspan 明細列、展開／收合事件；每列僅一個查看按鈕。單一惰性建立原生 dialog 掛在 body，使用 top layer，固定相對 viewport 置中。showModal 的 inert 背景搭配 Tab／Shift+Tab 循環、Escape、右上關閉、遮罩點擊及 focus 回復。鎖定並還原 html／body overflow，只有內容區捲動。左右鍵及 Home／End 操作兩個分頁。新結果關閉舊視窗。
- pages/query/columns.js：補正 total 語意，科別多選主表改顯示科數摘要；多項數值條件亦只占一欄，詳細實值置於 Modal。每筆按鈕取得該次查詢快照，Modal 不查 API。
- pages/query/styles.css：刪除舊 inline／選取展開列／sticky 規則，保留 21px／27px、Flexbox 自然寬度、4px 間距、交錯背景。Modal 桌面 82vw、最大 1180px、最大 85dvh；手機 viewport 左右各 12px，無水平溢出。
- pages/query/index.html：更新樣式版本。
- tests/statistics/statistics-modal.test.cjs：取代不再適用的 metrics-layout.test.cjs，保留原實測字級基準，新增資料、生命週期、焦點與版面驗收。
- tests/statistics/multi-filter.test.cjs：原 API／OR／AND／CSV 測試維持，改用查看 Modal 操作。
- docs/specs/district-statistics-api.md：更新目前行為；query-flow-metrics 歷史報告註明已取代。

## 驗收證據

- 1440、1100、390、320px 都用實際篩選器選內科、外科，開竹北市，表格逐格與 API 相同；桌面寬度與上限、viewport 中心及高度上限皆有量測。
- 「更多指標」人口 220,973、面積 46.8341 等與 API 比對，指標有多種自然寬度、背景交錯，名稱 21px、數值 27px。原預覽字級全套取樣在 1440／1100／390px 保持 1.5 倍。
- 每次開啟均驗證 main tbody 筆數和列高不變，沒有 result-detail-row；Modal parent 為 body。
- 連續切換其他行政區，標題及逐科資料與該筆 API 相同。初始分頁重設，不保留前筆內容。
- 開關 Modal、切換分頁及行政區視窗期間 API 請求增加 0；不改縣市、篩選條件或資料庫。
- Escape、右上按鈕、遮罩三種關閉均回復觸發按鈕焦點；Tab 循環保持在視窗、分頁 Home／End 正確。背景 wheel 不改頁面 scrollY；8 科＋護理師在 500px 高視窗只捲內容，不捲背景。
- 多科＋人員、scope=clinic、排序與 CSV 維持正確。主表固定 4 欄（地區、科別摘要、人員、操作），CSV 保留全部 8 科分項，沒有操作文字／內部值。
- 缺值／0／物件測試不修改原始物件，渲染為「未提供」或 0，沒有 undefined、null、[object Object]。

原始 JSON 與截圖保留在 Git 忽略的 tests/integration/artifacts/statistics-modal-evidence.json、statistics-modal-departments-*.png、statistics-modal-metrics-*.png。

## 限制與發布狀態

沒有修改 Java／Cypher／Neo4j 資料、沒有新增查詢，不自動 commit／push／部署。18091 本機預覽已更新。瀏覽器手機 viewport 與鍵盤有實測，實體手機、正式螢幕閱讀器與部署後環境未實測。

第一輪驗收發現原生 Tab 循環可短暫落在 body，已補明確首尾循環並重測；多科測試使用 schema 的正式「兒科」名稱，沒有為測試加入假選項。

## 最終測試結果

- statistics-modal.test.cjs：9 通過、0 失敗、0 跳過、0 TODO（63 秒），涵蓋 4 種寬度、原字級基準、實際科別資料、關閉／焦點、背景及內容捲動、8 科＋人員、CSV、scope、缺值／0。
- 其餘回歸：33 通過、0 失敗、0 跳過、0 TODO（150 秒），執行 frontend、multi-filter、query-ui、query-visual 與 cypher/ui。包含 Aura 唯讀科別／人員及 OR／AND、原始 RECORD_DEPARTMENT oracle、CSV、篩選條件保存、排序、手機選單、Cypher 與 Leaflet。
- 以上為 42 個不同測試，使用 Node --test --test-concurrency=1，STATISTICS_BASE／CYPHER_BASE=http://127.0.0.1:18091；沒有把第一輪失敗或重跑重複計數。
- Maven offline package -DskipTests：BUILD SUCCESS，最終 JAR 包含新 Modal 前端資源。本步跳過 Java 測試，沒有算為通過；本次未修改 Java，也未重跑 Java 單元測試。
- git diff --check 通過；預覽 JAR／截圖／實測證據留在 Git 忽略的本機產物中。
