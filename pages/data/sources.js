export const sourceReviewDate = '2026-10-14';
export const sources = Object.freeze([
  { id: '103066', title: '綜稅綜合所得總額全國各縣市鄉鎮村里統計分析表', organization: '財政部財政資訊中心', year: '112 年', frequency: '每年', use: '平均數、中位數、綜合所得總額與納稅單位；金額單位為千元。', note: '原始資料含村里層級；本專案以行政區層級進行比較。' },
  { id: '8410', title: '各鄉鎮市區人口密度', organization: '內政部戶政司', year: '114 年', frequency: '不定期', use: '年底人口數、土地面積與人口密度；提供醫療資源比率的分母。', note: '年底人口為統計時點的人口數，並非即時人口。' },
  { id: '6474', title: '醫院人力統計', organization: '衛生福利部統計處', year: '114 年', frequency: '每年', use: '醫院家數、醫事人員總計，以及西醫師、護理師等各類人員數。', note: '依行政區彙總醫院人力，與診所人力分開記錄。' },
  { id: '6476', title: '診所人力統計', organization: '衛生福利部統計處', year: '114 年', frequency: '每年', use: '診所家數、醫事人員總計，以及各類醫事人員數。', note: '查詢選擇醫院＋診所時，加總同一人員類別的兩種院所數值。' },
  { id: '6475', title: '醫院科別統計', organization: '衛生福利部統計處', year: '114 年', frequency: '每年', use: '各行政區提供特定科別的醫院家數。', note: '一間院所可提供多科，不能將科別家數加總當成院所總數。' },
  { id: '6477', title: '診所科別統計', organization: '衛生福利部統計處', year: '114 年', frequency: '每年', use: '各行政區提供特定科別的診所家數。', note: '科別家數是院所數量，不是該科醫師人數。' },
]);
