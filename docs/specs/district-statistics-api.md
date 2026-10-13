# 行政區統計 API

## 路徑

- `GET /api/districts/statistics/options`：實際數值範圍、資料庫類別及縣市／行政區。可用 `?county=新竹市` 取得該縣市範圍。GET 不使用 body。
- `POST /api/districts/statistics/search`：JSON 條件查詢。省略縣市及行政區查全國；僅選縣市查全部行政區。

## Request

```json
{
  "county": "新竹市",
  "income": { "min": 100 },
  "population": { "min": 1000, "max": 300000 },
  "area": { "min": 1.5, "max": 100 },
  "hospitals": { "max": 5 },
  "clinics": { "min": 0 },
  "personnel": { "category": "護理師", "scope": "all", "count": { "min": 0 } },
  "specialty": { "category": "內科", "scope": "all", "count": { "min": 0 } },
  "sort": [{ "field": "income", "direction": "desc" }]
}
```

`districtCode` 可指定單區，但必須同時指定該區所屬縣市。代碼為字串。
所有 range 的 min/max 皆可省略，上下界包含等號；不同條件採 AND。`0` 是條件，不是未填。
人口、院所、人員及科別數條件必須非負整數；所得／面積可用非負小數。
下限不得大於上限，非數字／非有限數值會回400。超出資料範圍但合法的條件可回空結果。
scope 為 `hospital`、`clinic`、`all`；若同時選人員和科別，兩者使用相同scope。
未選人員／科別時所選數值為null，不假裝為0。

排序最多三欄，允許 `name,income,population,area,hospitalCount,clinicCount,staff,staffRate,doctors,doctorRate,westernDoctors,chineseDoctors,dentists,westernDoctorRate,personnel,specialty`。
方向只接受asc/desc。缺值在升降冪皆排最後；沒有自動加入次要排序。

## Response

```json
{
  "total": 3,
  "scope": "all",
  "districts": [
    {
      "code": "1205", "county": "新竹市", "name": "香山區",
      "income": 1006, "averageIncome": 1006,
      "population": 79606, "area": 54.8491,
      "hospitalCount": 0, "clinicCount": 16,
      "staff": 56, "staffRate": 7.03,
      "doctors": 23, "doctorRate": 2.89,
      "incomeYear": 112, "populationYear": 114
    }
  ]
}
```

以上只展示其中一筆及部分欄位，並非完整陣列。另保留密度、所得中位數、醫院／診所人力與所選人員／科別各自數值。
每萬人口值四捨五入至兩位，零／缺人口回null。醫師僅含西醫師、中醫師、牙醫師。
缺所得、人口、面積不改成0；缺醫院／診所統計或所選關係按已確認規則視為0。

options 回傳 `bounds`（income/population/area/hospitalCount/clinicCount，各有min/max）、`personnel`、`specialties`、`counties`。
人口／所得年度分別保留，不合併成年份。科別數不能解讀為醫師人數或無醫療服務。

## 錯誤與安全

- 400 `INVALID_FILTER`：輸入或選項無效。
- 503 `DATABASE_UNAVAILABLE`：連線失敗、設定或資料問題、資料庫查詢逾時。
- 500 `QUERY_FAILED`：其他查詢錯誤。不回傳連線密碼或內部例外。

統計查詢指定 `neo4j`，院所查詢仍使用 `medicalfacilities`。共用既有連線設定，`.env` 的 `NEO4J_DATABASE` 仍為medicalfacilities，不需為統計改設定。
統計Cypher為固定、參數化唯讀查詢，各關係族分開聚合，交易逾時15秒。
目前368區全量聚合後，在Java套用條件與排序，total為實際符合筆數；不分頁、不將顯示筆數假充總數。
未開放任意Cypher或SQL字串。人口／面積範圍每次讀取真實統計，不使用硬編碼上下界。
Neo4j資料沒有寫入。地圖不使用假行政區座標，定位功能維持暫緩。

## 測試頁面

推薦由後端開啟 `/pages/query/index.html`。不要直接以file協定開HTML。
本次預覽服務為 `http://127.0.0.1:18081/pages/query/index.html`。
原有API base設定仍可用於分離前後端部署；普通Live Server若沒有指定API base會向自己的port查詢，不能取代後端。


## 正式 Schema（重構後）

```cypher
(行政區:鄉鎮區碼與名稱)-[所得年度:RECORD_INCOME {統計年:112}]->(:綜合所得)
(行政區)-[人口年度:RECORD_POPULATION_AND_AREA {統計年:114}]->(:人口與土地)
(行政區)-[醫療年度:RECORD_MEDICAL_FACILITIES {統計年:114}]->(:醫療院所統計)
(行政區)-[:RECORD_PERSONNEL {類型:'醫院',數量:人數}]->(:醫事人員類別)
(行政區)-[:PROVIDE_DEPARTMENT {類型:'醫院',數量:院所家數}]->(:科別)
```

上圖人員／科別也有診所類型。統計年度取自關係。medicalYear取自醫療統計關係，無院所統計記錄時可為null。
院所總數只取醫療院所統計.院所家數，不能加總科別院所家數。
API路徑、原欄位及JSON條件保持相容；新增欄位如下：

- hospitalWesternDoctors、clinicWesternDoctors、westernDoctors：醫院／診所／合計西醫師。
- hospitalChineseDoctors、clinicChineseDoctors、chineseDoctors：醫院／診所／合計中醫師。
- hospitalDentists、clinicDentists、dentists：醫院／診所／合計牙醫師。
- westernDoctorRate：每萬人口西醫師數（round(10000.0 * westernDoctors / population, 2)），零／缺人口為null。
- medicalYear：醫療資源統計年度。

原 doctors/hospitalDoctors/clinicDoctors/doctorRate 仍為三類醫師合計，不改成只含西醫師。
TC-08使用新增西醫師欄位驗證鳥松1072+24=1096、250.78，而非誤用三類合計。
醫事人員總數仍取醫療院所統計.醫事人員總計，不以人員或科別數冒充。
medicalfacilities是獨立院所明細資料庫，其MedicalFacility→Department匯入關係不屬於本次統計Schema；匯入功能未執行或更動。
