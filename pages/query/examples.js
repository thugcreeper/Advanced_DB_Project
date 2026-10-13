export const examples = Object.freeze([
  { id: "income", label: "平均所得 > 1500 千元", query: "MATCH (d:鄉鎮區碼與名稱)-[r:RECORD_INCOME {統計年:112}]->(i:綜合所得)\nWHERE i.平均數 > 1500\nRETURN d.鄉鎮市區名稱 AS 地區, i.平均數 AS 平均所得\nORDER BY 平均所得 DESC" },
  { id: "hospitals", label: "醫院家數 < 2", query: "MATCH (d:鄉鎮區碼與名稱)\nOPTIONAL MATCH (d)-[:RECORD_MEDICAL_FACILITIES {統計年:114}]->(m:醫療院所統計 {類型:'醫院'})\nWITH d, coalesce(sum(m.院所家數),0) AS 醫院家數\nWHERE 醫院家數 < 2\nRETURN d.鄉鎮市區名稱 AS 地區, 醫院家數" },
  { id: "doctors", label: "中醫師人數 = 0", query: "MATCH (d:鄉鎮區碼與名稱)\nOPTIONAL MATCH (d)-[r:RECORD_PERSONNEL]->(p:醫事人員類別 {人員類別:'中醫師'})\nWHERE r.類型 IN ['醫院','診所']\nWITH d, coalesce(sum(r.數量),0) AS 中醫師人數\nWHERE 中醫師人數 = 0\nRETURN d.鄉鎮市區名稱 AS 地區, 中醫師人數" },
]);
