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
頂部關閉按鈕、類型與名稱固定；中間內容單一捲動；底部並列撥打電話與 Google 地圖。定位移至清單的 44×44px 圖示，定位不開詳情。
科別依 API 順序去除空值與重複，使用不暗示分類的統一灰綠網格，非按鈕。寬桌面三欄、平板／手機兩欄，長科別換行。
清單不固定顯示經緯度；詳情保留有效座標與待複核提示。內部來源檔名不呈現於詳情，API source 與資料介紹來源說明保留。
沒有可靠資料的營業中、急診、評價、醫師與照片一律不顯示。


## 2026-10-17 地圖與抽屜互動

詳情 DOM 位於 map-wrap，寬桌面為依地圖右緣與可見 viewport 定位的 fixed 覆蓋抽屜，寬 390px，不增加 Grid 欄位或調整左右欄寬。高度限制在可見區域，頁面捲動時維持關閉按鈕可用；只捲 detailScroll。1100px 以下改為底部面板，手機全寬且約 64dvh。沒有入場位移造成的測量誤差。

卡片／名稱開詳情；定位圖示只選取卡片與 Marker、平移到真實位置，保留當前 zoom；Google 地圖為外部導航連結按鈕。點 Marker 開詳情並只調整清單本身 scrollTop；密集標記先顯示名稱／地址選擇，不更改原始座標。14px 內的鄰近點共用選擇清單，最多列 60 個選項並明示可放大或從清單選其餘；原搜尋資料與所有有效 Marker 均不截斷。

詳情開啟時只在需要時 panInside，避開抽屜與地圖控制項，從不以開關詳情強迫 zoom 或重建地圖。圖例與 OpenStreetMap 來源標示亦避開面板。關閉保留最後選取院所及視圖，回復觸發元素焦點。

電話無效即隱藏撥號連結，tel 分機使用 ;ext=。Google 優先採用可用且無待複核旗標的經緯度；否則以名稱＋完整地址搜尋，沒有有效位置或地址則隱藏。URLSearchParams 編碼、target=_blank、rel=noopener noreferrer。
