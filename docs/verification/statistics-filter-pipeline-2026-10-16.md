# 行政區統計完整篩選流程驗證

日期：2026-10-16（Asia/Taipei）

## 根本原因與修正範圍

原前端單選器只保存一個科別；固定 columns 渲染所有指標。原 Repository 只接人員、單科及範圍，縣市、數值與排序多在 Java 全量結果後處理。先前正數存在條件修正仍不足以支援多科、呈現與完整條件下推。

此次保留 Controller／Service／Repository 架構，新增 specialties 與 specialtyMatch；選項驗證後將地區、scope、各科 min/max、人員範圍、所得、人口、面積、院所數與排序傳入 Repository。Cypher 本身執行 WHERE、any／all、型別分項與白名單排序；Service 保留正規化及防禦檢查。

前端狀態為複選陣列，已選項目可個別移除；更改條件取消舊請求，保留有效選項與數值界限。完整清除恢復預設。表格／CSV 共用 columns/value，主表不再固定 25 欄。其他數值逐列展開，科別再多也不增加橫向欄數。

## 六個環節的具體證據

### 1. 使用者選擇

臺南市、全部行政區、醫院＋診所、中醫婦科、各科下限 1。未選人員。

### 2. 瀏覽器實際送出的 JSON

```json
{
  "county": "臺南市",
  "districtCode": "",
  "specialties": [
    {
      "category": "中醫婦科",
      "scope": "all",
      "count": {
        "min": 1
      }
    }
  ],
  "specialtyMatch": "or",
  "sort": [
    {
      "field": "income",
      "direction": "desc"
    }
  ]
}
```

### 3. Controller 綁定及 Service 實際接受

MockMvc 合約測試驗證 JSON → StatisticsFilter → Repository 參數映射。實際服務回應 appliedFilters 如下，並非從前端目前可變的 UI 狀態推算：

```json
{
  "county": "臺南市",
  "districtCode": "",
  "scope": "all",
  "specialtySelections": [
    {
      "category": "中醫婦科",
      "position": 0,
      "min": 1,
      "max": null
    }
  ],
  "specialties": [
    "中醫婦科"
  ],
  "specialtyMatch": "or",
  "personnel": "",
  "sort": [
    {
      "field": "income",
      "direction": "desc"
    }
  ],
  "ranges": {
    "income": {
      "min": null,
      "max": null
    },
    "population": {
      "min": null,
      "max": null
    },
    "area": {
      "min": null,
      "max": null
    },
    "hospitalCount": {
      "min": null,
      "max": null
    },
    "clinicCount": {
      "min": null,
      "max": null
    },
    "personnel": {
      "min": null,
      "max": null
    }
  }
}
```

### 4. Repository Cypher

- MATCH 後以 `$county`、`$districtCode` 限縮地區。
- RECORD_DEPARTMENT 的 `r.類型` 分別聚合醫院及診所，使用 `r.數量`；依 `$scope` 得到每科 selected。
- `any(item IN specialtyRows WHERE item.selected>0 AND ...min/max...)` 為 OR；`all(...)` 為 AND。
- RECORD_PERSONNEL 同樣分醫院／診所，套用所選人員正數及範圍。
- income／population／area／hospitalCount／clinicCount min/max 均在 WHERE。
- 使用者值完全參數化，排序只允許服務端白名單欄位及 ASC／DESC，拒絕任意識別字。

StatisticsAuraReadOnlyTest 在真實 Aura 直接呼叫 Repository.search，略過 Controller／Service，核對已知北區與東區、類型差異、OR／AND、地區、人口／所得條件及排序，證明 Cypher 本身已過濾。

### 5. 實際 API 回傳

| 行政區 | 醫院 | 診所 | 合計 |
|---|---:|---:|---:|
| 臺南市中西區 | 0 | 3 | 3 |
| 臺南市北區 | 1 | 4 | 5 |
| 臺南市南區 | 0 | 1 | 1 |
| 臺南市安南區 | 0 | 1 | 1 |
| 臺南市安平區 | 0 | 1 | 1 |
| 臺南市東區 | 0 | 7 | 7 |

已與獨立原始 RECORD_DEPARTMENT 查詢逐列比對，醫院單獨查詢只列北區（1），診所單獨查詢符合的每列 clinic 均大於 0。

### 6. 最終表格與 CSV

主表欄位：行政區、中醫婦科：醫院、中醫婦科：診所、合計，另有不匯出的「更多指標」操作欄。
瀏覽器測試擷取每列四個資料格，下載實際 CSV 後解析 quoted fields／換行並逐格比對，完全一致。未選人員時沒有「所選人員數」欄。

1440px 與 1100px 的 `.table-scroll.scrollWidth <= clientWidth + 1`；未縮小既有 14px 表格字級。390px 無整頁水平溢出。8 科時主表固定 3 欄（行政區、科別分項、更多指標），展開分別顯示全部分項，CSV 同一分項欄保留全部科別，沒有跨科總和。

## 其他實際驗證

- 臺南「中醫婦科＋內科」：OR 23 區，AND 6 區，與獨立原始記錄 oracle 一致；hospital／clinic 的多科 AND 亦有驗證。
- 同時指定北區、科別、人員、人口、面積、所得、院所數與排序，只回符合列；提高人員下限至不可能值回 0。護理師數量另與原始 RECORD_PERSONNEL 核對。
- 切換科別、個別移除、改 OR／AND、切換 scope 都從實際瀏覽器 request 捕捉最新值。
- 切換縣市保留人口／面積數值條件；options 的資料範圍僅為提示，不再造成合法門檻被瀏覽器擋下。
- 清除條件後 request county 為空、specialties 為空，恢復 368 區。
- 原始證據與截圖位於 Git 忽略的 tests/integration/artifacts/statistics-filter-evidence.json、statistics-compact-*、statistics-many-1100.png。

## 資料口徑與未發布項目

全部為 Aura 實際唯讀測試，無寫入、重匯入或 Schema 修改。政府科別統計使用 RECORD_DEPARTMENT，不以 HAS_DEPARTMENT 取代；醫院／診所統計與實際院所名單不混算。AND 僅代表行政區各科符合，不保證同一院所共設各科。不同科別不相加為不重複院所數。

本機預覽已更新，正式 Render／GitHub Pages 尚未發布此版本。正式環境驗證需待部署後進行。本次未進行正式螢幕閱讀器實機評估。

## 最終測試結果

- Java／Controller／Service／Repository／Aura 實查：56 通過、0 失敗、0 錯誤、0 跳過。設定 AURA_READ_TESTS=true，使用 Java 17 執行 Maven offline test，實際執行 StatisticsAuraReadOnlyTest 與 AuraReadOnlyTest。
- 瀏覽器／API／CSV／跨頁回歸：51 通過、0 失敗、0 跳過、0 TODO。使用 Node --test --test-concurrency=1，依序執行 multi-filter、query-ui、positive-selection、frontend、district-ui、cypher/ui、graph 測試，所有 BASE 指向本次預覽 http://127.0.0.1:18091。
- 涵蓋查詢篩選與 CSV、行政區列表及 Leaflet、Cypher、關係圖、資料介紹、手機版與 Snackbar。
- query-visual.test.cjs 本輪未列入上述 51 項；桌面與手機篩選版面檢查由 multi-filter.test.cjs 實際執行。
- Aura 唯讀盤點：醫療院所 23,238、行政區 368、科別 53、HAS_FACILITY 23,238、HAS_DEPARTMENT 28,631、RECORD_DEPARTMENT 6,372。
