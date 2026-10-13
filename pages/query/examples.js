// Aggregate each relationship family before combining district metrics.
const districtMetrics = `MATCH (d:\`鄉鎮區碼與名稱\`)
CALL {
  WITH d
  OPTIONAL MATCH (d)-[:RECORD_INCOME {統計年:112}]->(i:\`綜合所得\`)
  RETURN max(toFloat(i.平均數)) AS income, count(i) AS incomeRecords
}
CALL {
  WITH d
  OPTIONAL MATCH (d)-[:RECORD_POPULATION_AND_AREA {統計年:114}]->(p:\`人口與土地\`)
  RETURN max(toInteger(p.年底人口數)) AS population,
         max(toFloat(p.土地面積)) AS area, max(toFloat(p.人口密度)) AS density,
         count(p) AS populationRecords
}
CALL {
  WITH d
  OPTIONAL MATCH (d)-[:RECORD_MEDICAL_FACILITIES {統計年:114}]->(m:\`醫療院所統計\`)
  WHERE m.類型 IN ['醫院','診所']
  RETURN sum(CASE WHEN m.類型='醫院' THEN coalesce(toInteger(m.院所家數),0) ELSE 0 END) AS hospitals,
         sum(CASE WHEN m.類型='診所' THEN coalesce(toInteger(m.院所家數),0) ELSE 0 END) AS clinics,
         sum(coalesce(toInteger(m.醫事人員總計),0)) AS staff,
         count(CASE WHEN m.類型='醫院' THEN m END) AS hospitalRecords,
         count(CASE WHEN m.類型='診所' THEN m END) AS clinicRecords,
         count(CASE WHEN m IS NOT NULL AND (toInteger(m.院所家數) IS NULL OR toInteger(m.醫事人員總計) IS NULL) THEN m END) AS invalidMedical
}
CALL {
  WITH d
  OPTIONAL MATCH (d)-[r:RECORD_PERSONNEL]->(c:\`醫事人員類別\`)
  WHERE r.類型 IN ['醫院','診所']
  RETURN sum(CASE WHEN c.人員類別='西醫師' THEN coalesce(toInteger(r.數量),0) ELSE 0 END) AS western,
         sum(CASE WHEN c.人員類別='中醫師' THEN coalesce(toInteger(r.數量),0) ELSE 0 END) AS chinese,
         sum(CASE WHEN c.人員類別='牙醫師' THEN coalesce(toInteger(r.數量),0) ELSE 0 END) AS dentists,
         sum(CASE WHEN c.人員類別='護理師' AND r.類型='醫院' THEN coalesce(toInteger(r.數量),0) ELSE 0 END) AS hospitalNurses,
         sum(CASE WHEN c.人員類別='護理師' AND r.類型='診所' THEN coalesce(toInteger(r.數量),0) ELSE 0 END) AS clinicNurses,
         count(CASE WHEN r IS NOT NULL AND toInteger(r.數量) IS NULL THEN r END) AS invalidPersonnel
}
WITH d, income, population, area, density, hospitals, clinics, staff,
     western, chinese, dentists, hospitalNurses, clinicNurses,
     western+chinese+dentists AS doctors, hospitals+clinics AS facilities,
     CASE WHEN population>0 THEN 10000.0*staff/population END AS staffRate,
     CASE WHEN population>0 THEN 10000.0*(western+chinese+dentists)/population END AS doctorRate,
     CASE WHEN hospitalRecords=0 THEN '缺少醫院統計列（以0計）；' ELSE '' END +
     CASE WHEN clinicRecords=0 THEN '缺少診所統計列（以0計）；' ELSE '' END +
     CASE WHEN hospitalRecords>1 OR clinicRecords>1 OR incomeRecords>1 OR populationRecords>1 THEN '存在重複統計列需核對；' ELSE '' END +
     CASE WHEN invalidMedical>0 OR invalidPersonnel>0 THEN '存在無效醫療數值（以0計）需核對；' ELSE '' END +
     CASE WHEN population IS NULL OR population<=0 THEN '缺少有效人口；' ELSE '' END AS note`;

export const examples = Object.freeze([
  {
    id: "income-high",
    label: "高收入地區的醫療資源如何",
    description: "找出平均綜合所得超過 150 萬元的行政區，觀察當地人口數、醫事人員總數，以及每萬人口醫事人員數，分析高所得地區的醫療人力配置。",
    threshold: "平均所得 > 1500 千元（固定門檻）。",
    years: "所得 112 年；人口及醫療 114 年（跨年度比較）。",
    query: districtMetrics + `
WHERE income>1500
RETURN d.鄉鎮市區名稱 AS 行政區, income AS 平均所得, population AS 人口數, staff AS 醫事人員總數, round(staffRate,2) AS 每萬人口醫事人員數, d.鄉鎮市區碼 AS 行政區碼, note AS 資料註記
ORDER BY 平均所得 DESC`
  },
  {
    id: "income-low",
    label: "低收入地區的醫療資源如何",
    description: "找出平均綜合所得位於全臺行政區最低 20% 的地區，觀察當地人口數、醫院與診所家數、醫事人員總數，以及每萬人口醫事人員數，分析低所得地區的醫療資源現況。",
    threshold: "全臺有效平均所得 <= percentileCont(平均所得, 0.2)。",
    years: "所得 112 年；人口及醫療 114 年（跨年度比較）。",
    query: districtMetrics + `
WITH collect({d:d, income:income, population:population, area:area, density:density, hospitals:hospitals, clinics:clinics, staff:staff, western:western, chinese:chinese, dentists:dentists, hospitalNurses:hospitalNurses, clinicNurses:clinicNurses, doctors:doctors, facilities:facilities, staffRate:staffRate, doctorRate:doctorRate, note:note}) AS allRows,
     percentileCont(CASE WHEN income>=0 THEN income END,0.2) AS incomeP20, count(CASE WHEN income>=0 THEN income END) AS incomeP20Samples
UNWIND allRows AS row
WITH row.d AS d, row.income AS income, row.population AS population, row.area AS area, row.density AS density, row.hospitals AS hospitals, row.clinics AS clinics, row.staff AS staff, row.western AS western, row.chinese AS chinese, row.dentists AS dentists, row.hospitalNurses AS hospitalNurses, row.clinicNurses AS clinicNurses, row.doctors AS doctors, row.facilities AS facilities, row.staffRate AS staffRate, row.doctorRate AS doctorRate, row.note AS note, incomeP20, incomeP20Samples
WHERE income>=0 AND income<=incomeP20
RETURN d.鄉鎮市區名稱 AS 行政區, income AS 平均所得, population AS 人口數, hospitals AS 醫院數, clinics AS 診所數, staff AS 醫事人員總數, round(staffRate,2) AS 每萬人口醫事人員數, incomeP20 AS 所得P20門檻, incomeP20Samples AS 所得有效樣本數, d.鄉鎮市區碼 AS 行政區碼, note AS 資料註記
ORDER BY 平均所得 ASC`
  },
  {
    id: "few-facilities",
    label: "哪些地區沒有醫院診所也很少",
    description: "找出沒有醫院，且診所少於 5 家的行政區，觀察當地人口規模與醫療院所數量，作為辨識醫療資源相對不足地區的初步參考。",
    threshold: "醫院數 = 0 且診所數 < 5。",
    years: "人口及醫療統計 114 年。",
    query: districtMetrics + `
WHERE hospitals=0 AND clinics<5
RETURN d.鄉鎮市區名稱 AS 行政區, population AS 人口數, hospitals AS 醫院數, clinics AS 診所數, d.鄉鎮市區碼 AS 行政區碼, note AS 資料註記
ORDER BY 診所數 ASC, 人口數 DESC`
  },
  {
    id: "nurses",
    label: "哪些地區的護理師最多",
    description: "統計各行政區醫院及診所的護理師人數，並計算合計，觀察護理人力在不同地區的分布情況。",
    threshold: "人員類別 = 護理師；分別加總醫院與診所人數，依合計由高至低排序。",
    years: "人口及醫療統計 114 年。",
    query: districtMetrics + `
RETURN d.鄉鎮市區名稱 AS 行政區, hospitalNurses AS 醫院護理師, clinicNurses AS 診所護理師, hospitalNurses+clinicNurses AS 護理師總數, d.鄉鎮市區碼 AS 行政區碼, note AS 資料註記
ORDER BY 護理師總數 DESC`
  },
  {
    id: "doctor-rate",
    label: "哪些地區每萬人口醫師數最多",
    description: "統計各行政區醫院與診所的西醫師、中醫師及牙醫師人數，換算成每萬人口醫師數，觀察不同人口規模地區的醫師人力配置。",
    threshold: "（西醫師 + 中醫師 + 牙醫師）/ 年底人口數 × 10000；零人口不計比率並排最後。",
    years: "人口及醫療統計 114 年。",
    query: districtMetrics + `
RETURN d.鄉鎮市區名稱 AS 行政區, population AS 人口數, western AS 西醫師數, chinese AS 中醫師數, dentists AS 牙醫師數, doctors AS 醫師合計, round(doctorRate,2) AS 每萬人口醫師數, d.鄉鎮市區碼 AS 行政區碼, note AS 資料註記
ORDER BY CASE WHEN doctorRate IS NULL THEN 1 ELSE 0 END ASC, doctorRate DESC`
  },
  {
    id: "large-many",
    label: "哪些面積大的地區醫療院所也多",
    description: "找出土地面積位於全臺前 20%，且醫療院所總數也位於全臺前 20% 的行政區，觀察大型行政區中醫療院所數量相對較多的地區。",
    threshold: "面積 >= 全臺面積 P80 且醫院＋診所總數 >= 全臺院所數 P80；兩項分別計算全臺門檻。",
    years: "人口及醫療統計 114 年。",
    query: districtMetrics + `
WITH collect({d:d, income:income, population:population, area:area, density:density, hospitals:hospitals, clinics:clinics, staff:staff, western:western, chinese:chinese, dentists:dentists, hospitalNurses:hospitalNurses, clinicNurses:clinicNurses, doctors:doctors, facilities:facilities, staffRate:staffRate, doctorRate:doctorRate, note:note}) AS allRows,
     percentileCont(CASE WHEN area>=0 THEN area END,0.8) AS areaP80, count(CASE WHEN area>=0 THEN area END) AS areaP80Samples,
     percentileCont(CASE WHEN facilities>=0 THEN facilities END,0.8) AS facilitiesP80, count(CASE WHEN facilities>=0 THEN facilities END) AS facilitiesP80Samples
UNWIND allRows AS row
WITH row.d AS d, row.income AS income, row.population AS population, row.area AS area, row.density AS density, row.hospitals AS hospitals, row.clinics AS clinics, row.staff AS staff, row.western AS western, row.chinese AS chinese, row.dentists AS dentists, row.hospitalNurses AS hospitalNurses, row.clinicNurses AS clinicNurses, row.doctors AS doctors, row.facilities AS facilities, row.staffRate AS staffRate, row.doctorRate AS doctorRate, row.note AS note, areaP80, areaP80Samples, facilitiesP80, facilitiesP80Samples
WHERE area>=areaP80 AND facilities>=facilitiesP80
RETURN d.鄉鎮市區名稱 AS 行政區, area AS 土地面積, population AS 人口數, density AS 人口密度, hospitals AS 醫院數, clinics AS 診所數, facilities AS 院所總數, areaP80 AS 面積P80門檻, facilitiesP80 AS 院所P80門檻, areaP80Samples AS 面積有效樣本數, facilitiesP80Samples AS 院所有效樣本數, d.鄉鎮市區碼 AS 行政區碼, note AS 資料註記
ORDER BY 院所總數 DESC, 土地面積 DESC`
  },
  {
    id: "dense-few",
    label: "哪些人口密集地區醫療院所卻少",
    description: "找出人口密度位於全臺最高 20%，卻沒有醫院且診所少於 5 家的行政區，觀察人口密集地區是否存在醫療院所數量偏少的情況。",
    threshold: "人口密度 >= 全臺有效人口密度 P80；醫院數 = 0 且診所數 < 5。",
    years: "人口及醫療統計 114 年。",
    query: districtMetrics + `
WITH collect({d:d, income:income, population:population, area:area, density:density, hospitals:hospitals, clinics:clinics, staff:staff, western:western, chinese:chinese, dentists:dentists, hospitalNurses:hospitalNurses, clinicNurses:clinicNurses, doctors:doctors, facilities:facilities, staffRate:staffRate, doctorRate:doctorRate, note:note}) AS allRows,
     percentileCont(CASE WHEN density>=0 THEN density END,0.8) AS densityP80, count(CASE WHEN density>=0 THEN density END) AS densityP80Samples
UNWIND allRows AS row
WITH row.d AS d, row.income AS income, row.population AS population, row.area AS area, row.density AS density, row.hospitals AS hospitals, row.clinics AS clinics, row.staff AS staff, row.western AS western, row.chinese AS chinese, row.dentists AS dentists, row.hospitalNurses AS hospitalNurses, row.clinicNurses AS clinicNurses, row.doctors AS doctors, row.facilities AS facilities, row.staffRate AS staffRate, row.doctorRate AS doctorRate, row.note AS note, densityP80, densityP80Samples
WHERE density>=densityP80 AND hospitals=0 AND clinics<5
RETURN d.鄉鎮市區名稱 AS 行政區, population AS 人口數, density AS 人口密度, hospitals AS 醫院數, clinics AS 診所數, densityP80 AS 密度P80門檻, densityP80Samples AS 密度有效樣本數, d.鄉鎮市區碼 AS 行政區碼, note AS 資料註記
ORDER BY 人口密度 DESC`
  },
  {
    id: "sparse-low",
    label: "哪些人口稀疏地區每萬人口醫師數也少",
    description: "找出人口密度位於全臺最低 20%，且每萬人口醫師數也位於全臺最低 20% 的行政區，觀察人口稀疏地區的醫師人力配置。",
    threshold: "人口密度 <= 全臺有效密度 P20 且三類醫師每萬人口比率 <= 全臺有效比率 P20；兩項分別計算。",
    years: "人口及醫療統計 114 年。",
    query: districtMetrics + `
WITH collect({d:d, income:income, population:population, area:area, density:density, hospitals:hospitals, clinics:clinics, staff:staff, western:western, chinese:chinese, dentists:dentists, hospitalNurses:hospitalNurses, clinicNurses:clinicNurses, doctors:doctors, facilities:facilities, staffRate:staffRate, doctorRate:doctorRate, note:note}) AS allRows,
     percentileCont(CASE WHEN density>=0 THEN density END,0.2) AS densityP20, count(CASE WHEN density>=0 THEN density END) AS densityP20Samples,
     percentileCont(CASE WHEN doctorRate>=0 THEN doctorRate END,0.2) AS doctorRateP20, count(CASE WHEN doctorRate>=0 THEN doctorRate END) AS doctorRateP20Samples
UNWIND allRows AS row
WITH row.d AS d, row.income AS income, row.population AS population, row.area AS area, row.density AS density, row.hospitals AS hospitals, row.clinics AS clinics, row.staff AS staff, row.western AS western, row.chinese AS chinese, row.dentists AS dentists, row.hospitalNurses AS hospitalNurses, row.clinicNurses AS clinicNurses, row.doctors AS doctors, row.facilities AS facilities, row.staffRate AS staffRate, row.doctorRate AS doctorRate, row.note AS note, densityP20, densityP20Samples, doctorRateP20, doctorRateP20Samples
WHERE density>=0 AND density<=densityP20 AND doctorRate>=0 AND doctorRate<=doctorRateP20
RETURN d.鄉鎮市區名稱 AS 行政區, population AS 人口數, density AS 人口密度, doctors AS 醫師總數, round(doctorRate,2) AS 每萬人口醫師數, densityP20 AS 密度P20門檻, doctorRateP20 AS 醫師比率P20門檻, densityP20Samples AS 密度有效樣本數, doctorRateP20Samples AS 醫師比率有效樣本數, d.鄉鎮市區碼 AS 行政區碼, note AS 資料註記
ORDER BY doctorRate ASC`
  },
  {
    id: "no-clinics",
    label: "哪些地區完全沒有診所",
    description: "找出完全沒有診所的行政區，觀察當地人口數與醫院家數，了解診所資源缺乏的地區。",
    threshold: "診所數 = 0。",
    years: "人口及醫療統計 114 年。",
    query: districtMetrics + `
WHERE clinics=0
RETURN d.鄉鎮市區名稱 AS 行政區, population AS 人口數, hospitals AS 醫院數, clinics AS 診所數, d.鄉鎮市區碼 AS 行政區碼, note AS 資料註記
ORDER BY 人口數 DESC`
  }
]);
