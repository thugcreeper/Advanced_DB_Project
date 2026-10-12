export const examples = Object.freeze([
  { id: "income", label: "平均所得 > 1500 千元", query: "MATCH (d:District)-[:HAS_INCOME_DATA]->(i:Income)\nWHERE i.averageIncome > 1500\nRETURN d.name AS 地區, i.averageIncome AS 平均所得", matches: (d) => d.averageIncome > 1500 },
  { id: "hospitals", label: "醫院家數 < 2", query: "MATCH (d:District)-[:HAS_MEDICAL_DATA]->(m:Medical)\nWHERE m.hospitalCount < 2\nRETURN d.name AS 地區, m.hospitalCount AS 醫院家數", matches: (d) => d.hospitalCount < 2 },
  { id: "doctors", label: "中醫師人數 = 0", query: "MATCH (d:District)-[:HAS_MEDICAL_DATA]->(m:Medical)\nWHERE m.chineseDoctorCount = 0\nRETURN d.name AS 地區, m.chineseDoctorCount AS 中醫師人數", matches: (d) => d.chineseDoctorCount === 0 },
]);
