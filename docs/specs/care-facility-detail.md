# CARE 參考風格的院所詳情

## 實際資料格式與呈現規則

沿用已驗證的 Java ClinicHoursParser 與 GET /api/facilities/detail，無需新增或改動後端。
資料庫 clinicTimeJson 實際形式如下；沒有早午晚診次欄位，不能自行依時間推算診次或營業狀態。

```json
{
  "monday": {"isClosed": false, "slots": [{"open": "09:00", "close": "12:00"}, {"open": "18:30", "close": "21:00"}], "open": null, "close": null},
  "sunday": {"isClosed": true, "slots": [], "open": null, "close": null}
}
```

Java API 回傳 clinicHours.status（available／partial／missing／invalid），days 按週一至週日排序，每日有 day、status（scheduled／closed／missing）與 slots。
週曆僅摘要「N 段」「休診」「未提供」，選取日期後列出該日完整時間區間，不拆成假造的早／午／晚診次。
未提供與休診明確區分；整週無有效時間時只顯示簡短提示，不畫空白七日表。
跨夜如 18:00–00:30 保留來源區間，附「跨日至次日」文字；24:00 是該日結束，非營業狀態。
第一個已有時段的日子預設選取；若整週只有休診紀錄則選第一日。不標示今天，避免把週表誤認成即時服務狀態。
週曆採七日 tablist，支援左右鍵、Home／End 及單一 Tab 入口；每日詳情以 tabpanel 呈現。

## 視覺轉譯

參考使用者提供的兩張 CARE LINE 卡片：保留類型→大字名稱→聯絡資訊→週曆→科別網格→操作的資訊層次，而非複製尺寸或 LINE 視覺。
保留原站搜尋、清單與 Leaflet 地圖；僅詳情使用局部低飽和綠色、細線與中性灰。
頂部類型與名稱固定；中間內容單一捲動；底部固定電話、定位與外部地圖。
科別依 API 順序去除空值與重複，使用不暗示分類的統一灰綠網格，非按鈕。桌面三欄、手機兩欄，長科別換行。
經緯度不預設顯示；來源保留於補充資訊，以低權重文字呈現。
沒有可靠資料的營業中、急診、評價、醫師與照片一律不顯示。
