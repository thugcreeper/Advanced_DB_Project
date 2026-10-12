# 本地原始資料

`medicalFacilities.json` 與 `pharmacy.json` 保留在本地，已加入根目錄 `.gitignore`。
不會作為 Spring Boot 靜態資源，也不應隨前端發布。Git 忽略不等於阻擋 HTTP 存取；
目前在專案根目錄啟動的 Python 靜態伺服器仍可提供此資料夾，僅供本機開發。

## 院所 JSON 結構

2026-10-11 檢查：根節點為陣列，共 23,238 筆；每筆均有以下欄位。

| 欄位 | JSON 型別 | 說明 |
| --- | --- | --- |
| `_id` | object | MongoDB Extended JSON，內含 `$oid` 字串；不是 Neo4j 節點 ID |
| `name` | string | 院所名稱 |
| `address` | string | 地址，目前沒有獨立縣市／行政區欄位 |
| `type` | string | 原始院所分類，共 15 種；不應直接猜測醫院／診所對應 |
| `departments` | array | 科別字串列表 |
| `latitude` | number | 緯度 |
| `longitude` | number | 經度 |
| `location` | object | GeoJSON `Point`，`coordinates` 為 `[longitude, latitude]` |
| `clinicTime` | object | 以英文星期為 key，包含 `isClosed` 與 `slots` 時段列表 |
| `notes` | string | 備註，可為空字串 |
| `phone` | string | 電話 |

本次未發現缺失經緯度、超出全球合法範圍的座標、GeoJSON 與經緯度不一致、
來源 ID 重複、名稱或地址空白。這些檢查不代表已驗證實際地理位置、營業時段
或資料內容正確，也尚未將院所地址對應行政區。

藥局 JSON 本階段不解析或匯入。後續須確認院所 JSON 的來源授權、
行政區對應規則及 Neo4j schema，再實作匯入與查詢。
