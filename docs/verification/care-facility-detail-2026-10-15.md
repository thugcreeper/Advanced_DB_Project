# CARE 參考風格詳情驗證

## 範圍與參考

已閱讀使用者指定兩張實際 CARE LINE 卡片，採用資訊層次、週曆與科別網格概念，沒有複製 LINE 介面或手機等比例版型。
只修改院所詳情，不改左側搜尋、地圖布局、Java API、Neo4j Schema 或資料；沒有重新匯入。
本輪預覽更新原有 `http://127.0.0.1:18087/pages/district/index.html`，僅重啟本工具建立的預覽程序，原有 18080 未停止。
正式 repo 已同步並重新打包；使用者的 18080 服務需重新啟動以載入新版靜態資源。

## 修改檔案

- `pages/district/index.html`：名稱與類型移入固定頂部；底部增加電話操作。
- `pages/district/facility-detail.js`：重排聯絡→週曆→科別→補充資訊；去重科別網格、電話有效性與缺值操作提示。
- `pages/district/facility-detail.css`：局部綠色、固定頭尾、單一中間捲動、桌面三欄／手機兩欄科別網格。
- `pages/district/clinic-week.js`（新增）：七日摘要、每日完整時段、鍵盤操作與跨日時段標示。
- `tests/integration/facility-detail.test.cjs`：調整改版後的缺值文案與順序斷言，保留既有功能驗證。
- `tests/integration/care-detail.test.cjs`（新增）：週曆、真實多科別醫院、五種尺寸、電話／缺值／安全文字測試。
- `docs/specs/care-facility-detail.md`（新增）：實際 JSON 範例、解析與視覺轉譯規則。
- 本驗證文件（新增）。

## 資料與呈現

沿用 GET /api/facilities/detail 與 Java ClinicHoursParser，來源只有每天 slots／isClosed，以及相容的 open／close，沒有早午晚分類。
七日摘要只顯示資料所載段數、休診、未提供，選取日後顯示完整 HH:mm 區間。
沒有推算營業中、急診能力、醫師或評價；明確休診與缺資料區分，無有效資料不建立空七日週曆。
無科別、電話或時間、異常格式與錯誤重試均沿用原有安全處理；舊回應不覆蓋新選取。
電話保留聯絡區可選取文字與 tel 連結；底部僅在有效時啟用。
科別方塊非按鈕，採統一底色，不暗示分類。座標不再預設佔用主視覺，原定位安全規則不變。

## 實際執行結果

- Maven package：Java 34 通過、0 失敗、10 舊快照測試未啟用；最後僅調整 CSS 留白後以 skipTests 重新打包，沒有改 Java。
- CARE 與原院所詳情／行政區 UI：9 通過。
- 原有院所 API／368 區集合、Cypher 編輯器與統計 UI／視覺回歸：20 通過。
- 1440×1000、1024×768、820×1180、390×844、320×700：無整頁或面板水平溢出，時間文字 nowrap 且不超出容器。
- 固定名稱區與底部操作列在內容捲動前後位置一致，面板外層無額外捲動。
- 真實案例「東基醫療財團法人臺東基督教醫院」：20 個去重科別逐一與 API 比對一致；家庭醫學科使用標準名稱。
- 多段、休診、缺資料、跨日區間、方向鍵／Home／End、單一 Tab 日期入口、切換院所日期重置均通過。
- 無資料停用操作、格式異常不畫空週曆、不產生虛構狀態、備註 HTML 只當文字顯示，均通過。
- 首輪醫院測試錯取可為空的原始 county／districtCode；已改為依 HAS_FACILITY 的中心行政區與現行 catalog 取得測試搜尋條件。沒有修改資料或鬆綁科別／名稱斷言。

## 截圖與限制

本機圖片位於 Git 忽略的 `tests/integration/artifacts/`：

- `care-hospital-desktop.png`：真實多科別醫院，桌面三欄網格。
- `care-detail-1440.png`、`care-detail-1024.png`、`care-detail-820.png`：診所桌面／平板。
- `care-detail-390.png`、`care-detail-320.png`：窄螢幕週曆、固定操作列。

截圖已實際檢視，原統計鳥松區快照差異與兩項 fixture TODO 不在本次修正範圍，未宣稱解決。
外部 Google 地圖僅驗證 URL 與安全屬性，未執行電話撥號；OSM 圖磚仍受網路影響。
無未完成的本次 UI 項目；沒有 commit 或 push。
