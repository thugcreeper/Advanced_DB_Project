# 院所詳情 API

`GET /api/facilities/detail?sourceId=<URL 編碼的院所識別碼>`

沿用 Spring Boot 的 DistrictFacilityController → DistrictFacilityService → DistrictFacilityRepository。
Session 明確使用 `neo4j`、READ 存取與參數化 Cypher，不寫入資料。

## 識別與來源

本次唯讀盤點確認醫療院所 23,238 筆，sourceId 非空且不重複亦為 23,238 筆，目標已有 sourceId 唯一約束。
以 sourceId 精確比對，不以名稱比對，也不從類型或名稱推測科別。
科別來自 `(:醫療院所)-[:HAS_DEPARTMENT]->(:科別)` 的 `科別名稱`，去重並依名稱排序。
不讀取或修改 `RECORD_DEPARTMENT`。查詢零筆回 404；若未來意外出現重複識別碼則拒絕回傳任意一筆。

## 回應欄位

- `sourceId`、`name`、`type`、`address`、`phone`、`notes`、`source`：原資料庫屬性，缺少字串為空字串。
- `latitude`、`longitude`：數值或 null。
- `locationReviewRequired`：沿用資料庫座標衝突標記。
- `departments`：標準科別字串陣列；沒有科別為空陣列。
- `clinicHours`：Java 解析後的週表，不回傳原始 clinicTimeJson。

clinicHours.status 為 `available`、`missing`、`partial` 或 `invalid`。
可解析時按星期一至星期日排列 days，每日含 day、status（scheduled／closed／missing）、slots（open／close）。
只有明確 isClosed=true 才顯示休診；缺少該日資料不能當成休診。
支援實際資料的 slots 多段時段與舊 open／close 單段形式，時間需為有效 HH:mm；結束時間亦接受 24:00。
不推算即時營業狀態或把跨夜時段改成其他時間。異常時段略過並標示 partial；完全無法解析時顯示格式異常，不顯示 JSON。

## 錯誤與互動

400：缺少、空白、過長或控制字元識別碼；404：查無院所；503：資料庫無法使用；500：其他查詢錯誤。
回應不包含連線資訊或原始例外。
前端採非模態詳情抽屜，背景地圖仍可操作；手機為底部面板。Escape／關閉鈕可關閉並回復原觸發元素焦點。
每次載入取消先前請求並以序號比對，關閉或重新搜尋亦使舊回應失效。
缺少科別、電話、時段顯示簡短缺值提示；空白備註隱藏；內部來源檔名不顯示於詳情 UI，API source 欄位保留。
座標無效或待複核時定位停用；Google 地圖只使用有效座標或資料庫名稱與地址，不採用待複核座標。
