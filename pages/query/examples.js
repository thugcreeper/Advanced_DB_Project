// 使用者提供的九題核心查詢；保留原始 Cypher 與題目順序。
export const examples = Object.freeze([
  {
    id: "income-high",
    label: "高收入地區的醫療資源如何",
    description: "顯示行政區、平均所得（千元）、人口數、醫事人員總數與每萬人口醫事人員數，依平均所得降冪排列。",
    threshold: "平均所得 > 1,500 千元。",
    years: "所得 112 年；人口及院所統計 114 年（本題明確限定）。",
    query: `MATCH (d:鄉鎮區碼與名稱)-[:RECORD_INCOME {統計年:112}]->(i:綜合所得)
MATCH (d)-[:RECORD_POPULATION_AND_AREA {統計年:114}]->(p:人口與土地)
MATCH (d)-[:RECORD_MEDICAL_FACILITIES {統計年:114}]->(m:醫療院所統計)
WHERE i.平均數 > 1500

WITH d, i, p,sum(m.醫事人員總計) AS 醫事人員總數

RETURN
    d.鄉鎮市區名稱 AS 行政區,
    i.平均數 AS 平均所得,
    p.年底人口數 AS 人口數,
    醫事人員總數,
    round(10000.0 * 醫事人員總數 / p.年底人口數, 2)
        AS 每萬人口醫事人員數
ORDER BY 平均所得 DESC;`
  },
  {
    id: "income-low",
    label: "低收入地區的醫療資源如何",
    description: "顯示行政區、平均所得（千元）、人口數、院所數、人員數與每萬人口醫事人員數，依平均所得升冪排列。",
    threshold: "平均所得 ≤ 動態 P20（第 20 百分位門檻）；目前觀察值為 583 千元。",
    years: "資料目標年度：所得 112 年；人口與院所統計 114 年。本題未限定統計年，跨年度或重複統計列可能影響結果。",
    query: `MATCH (:鄉鎮區碼與名稱)-[:RECORD_INCOME]->(i:綜合所得)
WITH percentileCont(i.平均數, 0.2) AS P20
MATCH (d:鄉鎮區碼與名稱)-[:RECORD_INCOME]->(i:綜合所得)
MATCH (d)-[:RECORD_POPULATION_AND_AREA]->(p:人口與土地)
MATCH (d)-[:RECORD_MEDICAL_FACILITIES]->(m:醫療院所統計)
WHERE i.平均數 <= P20
WITH d, i, p, sum(m.院所家數) AS 院所數,
     sum(m.醫事人員總計) AS 人員數
RETURN d.鄉鎮市區名稱 AS 行政區, i.平均數 AS 平均所得,
       p.年底人口數 AS 人口數, 院所數, 人員數,
       round(10000.0*人員數/p.年底人口數, 2) AS 每萬人口醫事人員數
ORDER BY 平均所得;`
  },
  {
    id: "few-facilities",
    label: "哪些地區沒有醫院且診所也很少",
    description: "顯示行政區、人口數、醫院數與診所數，依診所數升冪排列。缺失院所統計列暫計 0，須核對原始資料，不能據此確定沒有院所。",
    threshold: "醫院 0 家，且診所 < 5 家。",
    years: "資料目標年度：所得 112 年；人口與院所統計 114 年。本題未限定統計年，跨年度或重複統計列可能影響結果。",
    query: `MATCH (d:鄉鎮區碼與名稱)-[:RECORD_POPULATION_AND_AREA]->(p:人口與土地)
OPTIONAL MATCH (d)-[:RECORD_MEDICAL_FACILITIES]->(m:醫療院所統計)
WITH d, p,
     sum(CASE WHEN m.類型='醫院' THEN m.院所家數 ELSE 0 END) AS 醫院數,
     sum(CASE WHEN m.類型='診所' THEN m.院所家數 ELSE 0 END) AS 診所數
WHERE 醫院數=0 AND 診所數<5
RETURN d.鄉鎮市區名稱 AS 行政區, p.年底人口數 AS 人口數,
       醫院數, 診所數
ORDER BY 診所數;`
  },
  {
    id: "nurses",
    label: "哪些地區的護理師最多",
    description: "彙總 RECORD_PERSONNEL 中人員類別為「護理師」的數量，顯示行政區與護理師總數，依護理師總數降冪排列。",
    threshold: "人員類別 = 護理師。",
    years: "RECORD_PERSONNEL 年度屬性尚未確認，本題未限定統計年。",
    query: `MATCH (d:鄉鎮區碼與名稱)-[r:RECORD_PERSONNEL]->(p:醫事人員類別)
WHERE p.人員類別 = '護理師'
RETURN d.鄉鎮市區名稱 AS 行政區,
       sum(r.數量) AS 護理師總數
ORDER BY 護理師總數 DESC;`
  },
  {
    id: "staff-rate",
    label: "哪些地區每萬人口醫事人員數最多",
    description: "以醫事人員總數／年底人口數 × 10,000 計算，排除人口數 ≤ 0。顯示行政區、人口數、平均所得（千元）、醫事人員數與每萬人口醫事人員數，依比率降冪排列。",
    threshold: "年底人口數 > 0；依每萬人口醫事人員數排名。",
    years: "資料目標年度：所得 112 年；人口與院所統計 114 年。本題未限定統計年，跨年度或重複統計列可能影響結果。",
    query: `MATCH (d:鄉鎮區碼與名稱)-[:RECORD_MEDICAL_FACILITIES]->(m:醫療院所統計)
MATCH (d)-[:RECORD_POPULATION_AND_AREA]->(p:人口與土地)
MATCH (d)-[:RECORD_INCOME]->(i:綜合所得)
WHERE p.年底人口數 > 0
WITH d, p, i, sum(m.醫事人員總計) AS 醫事人員數
RETURN d.鄉鎮市區名稱 AS 行政區,
       p.年底人口數 AS 人口數,
       i.平均數 AS 平均所得,
       醫事人員數,
       round(10000.0*醫事人員數/p.年底人口數, 2) AS 每萬人口醫事人員數
ORDER BY 每萬人口醫事人員數 DESC;`
  },
  {
    id: "large-many",
    label: "哪些面積大的地區醫療院所也多",
    description: "土地面積與醫療院所總數須同時達到各自的全臺 P80。顯示行政區、土地面積（平方公里）、醫療院所數，依土地面積降冪排列。",
    threshold: "土地面積 ≥ 動態 P80（第 80 百分位門檻；目前 107.59 平方公里），且醫療院所總數 ≥ 其動態 P80（目前約 95 家）；分別以全臺行政區計算。",
    years: "資料目標年度：所得 112 年；人口與院所統計 114 年。本題未限定統計年，跨年度或重複統計列可能影響結果。",
    query: `MATCH (d:鄉鎮區碼與名稱)-[:RECORD_POPULATION_AND_AREA]->(p:人口與土地)
OPTIONAL MATCH (d)-[:RECORD_MEDICAL_FACILITIES]->(m:醫療院所統計)
WITH d, p, sum(m.院所家數) AS 院所數
WITH percentileCont(p.土地面積, 0.8) AS 面積P80,
     percentileCont(院所數, 0.8) AS 院所P80

MATCH (d:鄉鎮區碼與名稱)-[:RECORD_POPULATION_AND_AREA]->(p:人口與土地)
OPTIONAL MATCH (d)-[:RECORD_MEDICAL_FACILITIES]->(m:醫療院所統計)
WITH d, p, 面積P80, 院所P80, sum(m.院所家數) AS 院所數
WHERE p.土地面積 >= 面積P80 AND 院所數 >= 院所P80

RETURN d.鄉鎮市區名稱 AS 行政區,
       p.土地面積 AS 土地面積, 院所數 AS 醫療院所數
ORDER BY 土地面積 DESC;`
  },
  {
    id: "dense-few",
    label: "哪些人口密集地區醫療院所卻少",
    description: "顯示行政區、人口密度（人／平方公里）、人口數、醫院數與診所數，依人口密度降冪排列。缺失院所統計列暫計 0，須核對原始資料，不能據此確定沒有院所。",
    threshold: "人口密度 ≥ 動態 P80（第 80 百分位門檻；目前 2,943.36 人／平方公里，原始值 2,943.364868），且醫院 0 家、診所 < 5 家。",
    years: "資料目標年度：所得 112 年；人口與院所統計 114 年。本題未限定統計年，跨年度或重複統計列可能影響結果。",
    query: `MATCH (d:鄉鎮區碼與名稱)-[:RECORD_POPULATION_AND_AREA]->(p:人口與土地)
WITH percentileCont(p.人口密度, 0.8) AS 密度P80
MATCH (d:鄉鎮區碼與名稱)-[:RECORD_POPULATION_AND_AREA]->(p:人口與土地)
WHERE p.人口密度 >= 密度P80
OPTIONAL MATCH (d)-[:RECORD_MEDICAL_FACILITIES]->(m:醫療院所統計)
WITH d, p,
     sum(CASE WHEN m.類型='醫院' THEN m.院所家數 ELSE 0 END) AS 醫院數,
     sum(CASE WHEN m.類型='診所' THEN m.院所家數 ELSE 0 END) AS 診所數
WHERE 醫院數=0 AND 診所數<5
RETURN d.鄉鎮市區名稱 AS 行政區, p.人口密度 AS 人口密度,
       p.年底人口數 AS 人口數, 醫院數, 診所數
ORDER BY 人口密度 DESC;`
  },
  {
    id: "sparse-low",
    label: "哪些人口稀疏地區每萬人口醫師數也少",
    description: "人口密度與三類醫師每萬人口比率均須低於或等於各自的全臺 P20；三類醫師為西醫師、中醫師、牙醫師。依序顯示行政區、人口密度（人／平方公里）、人口數、平均所得（千元）、醫師數、每萬人口醫師數，依比率升冪排列。所得可為空；完全沒有三類醫師人力紀錄的行政區不納入，不視為 0 人。",
    threshold: "人口密度 ≤ 動態 P20（第 20 百分位門檻；目前 143.19 人／平方公里），且每萬人口醫師數 ≤ 其動態 P20（目前 4.55 人／每萬人口）；兩個門檻分別以全臺有效資料計算。",
    years: "資料目標年度：所得 112 年；人口與院所統計 114 年。本題未限定統計年，跨年度或重複統計列可能影響結果。 RECORD_PERSONNEL 年度屬性尚未確認。",
    query: `MATCH (d:鄉鎮區碼與名稱)-[:RECORD_POPULATION_AND_AREA]->(p:人口與土地)
WITH percentileCont(p.人口密度, 0.2) AS 密度P20

MATCH (d:鄉鎮區碼與名稱)-[:RECORD_POPULATION_AND_AREA]->(p:人口與土地)
MATCH (d)-[r:RECORD_PERSONNEL]->(c:醫事人員類別)
WHERE c.人員類別 IN ['西醫師', '中醫師', '牙醫師'] AND p.年底人口數 > 0
WITH 密度P20, p, sum(r.數量) AS 醫師數
WITH 密度P20, percentileCont(10000.0*醫師數/p.年底人口數, 0.2) AS 醫師P20

MATCH (d:鄉鎮區碼與名稱)-[:RECORD_POPULATION_AND_AREA]->(p:人口與土地)
MATCH (d)-[r:RECORD_PERSONNEL]->(c:醫事人員類別)
WHERE c.人員類別 IN ['西醫師', '中醫師', '牙醫師']
  AND p.年底人口數 > 0 AND p.人口密度 <= 密度P20
WITH d, p, 醫師P20, sum(r.數量) AS 醫師數
WHERE 10000.0*醫師數/p.年底人口數 <= 醫師P20

OPTIONAL MATCH (d)-[:RECORD_INCOME]->(i:綜合所得)
RETURN d.鄉鎮市區名稱 AS 行政區,
       p.人口密度 AS 人口密度,
       p.年底人口數 AS 人口數,
       i.平均數 AS 平均所得,
       醫師數,
       round(10000.0*醫師數/p.年底人口數, 2) AS 每萬人口醫師數
ORDER BY 每萬人口醫師數;`
  },
  {
    id: "no-clinics",
    label: "哪些地區完全沒有診所",
    description: "顯示行政區、人口數、人口密度（人／平方公里）與診所數，依人口數降冪排列。缺失院所統計列暫計 0，須核對原始資料，不能據此確定沒有診所。",
    threshold: "診所家數 = 0。",
    years: "資料目標年度：所得 112 年；人口與院所統計 114 年。本題未限定統計年，跨年度或重複統計列可能影響結果。",
    query: `MATCH (d:鄉鎮區碼與名稱)-[:RECORD_POPULATION_AND_AREA]->(p:人口與土地)
OPTIONAL MATCH (d)-[:RECORD_MEDICAL_FACILITIES]->(m:醫療院所統計)
WITH d, p,
     sum(CASE WHEN m.類型='診所' THEN m.院所家數 ELSE 0 END) AS 診所數
WHERE 診所數 = 0
RETURN d.鄉鎮市區名稱 AS 行政區,
       p.年底人口數 AS 人口數,
       p.人口密度 AS 人口密度, 診所數
ORDER BY 人口數 DESC;`
  }
]);
