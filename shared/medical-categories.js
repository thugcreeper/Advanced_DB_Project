export const specialtyGroups = [
  { label: "常用", values: ["家庭醫學科", "內科", "外科", "兒科", "婦產科", "骨科", "神經科", "泌尿科", "耳鼻喉科", "眼科", "皮膚科", "精神科", "復健科", "牙醫一般科", "中醫一般科", "西醫一般科"] },
  { label: "牙醫", values: ["口腔病理科", "口腔顎面外科", "齒顎矯正科", "牙周病科", "兒童牙科", "牙髓病科", "贋復補綴牙科", "牙體復形科", "家庭牙醫科", "特殊需求者口腔醫學科", "植牙科"] },
  { label: "中醫", values: ["中醫內科", "中醫外科", "中醫眼科", "中醫兒科", "中醫婦科", "中醫傷科", "中醫針灸科", "中醫痔科"] },
  { label: "其他", values: ["神經外科", "麻醉科", "放射診斷科", "放射腫瘤科", "解剖病理科", "臨床病理科", "核子醫學科", "急診醫學科", "整形外科", "職業醫學科"] },
];

export const personnelGroups = [
  { label: "常用", values: ["西醫師", "中醫師", "牙醫師", "護理師", "護士", "藥師", "藥劑生", "醫事檢驗師", "醫事放射師", "物理治療師", "職能治療師", "營養師"] },
  { label: "牙醫", values: ["牙體技術師", "牙體技術生"] },
  { label: "其他", values: ["醫事檢驗生", "醫事放射士", "助產師", "助產士", "物理治療生", "職能治療生", "臨床心理師", "諮商心理師", "呼吸治療師", "語言治療師", "聽力師", "驗光師", "驗光生"] },
];

export function groupApiValues(values, definitions) {
  const actual = [...new Set(values)], available = new Set(actual), assigned = new Set();
  const groups = definitions.map(group => ({ label: group.label, values: group.values.filter(value => {
    if (!available.has(value) || assigned.has(value)) return false;
    assigned.add(value); return true;
  }) }));
  const unknown = actual.filter(value => !assigned.has(value));
  groups.find(group => group.label === "其他").values.push(...unknown);
  return { groups, unknown, missing: definitions.flatMap(group => group.values).filter(value => !available.has(value)), duplicates: values.length - actual.length };
}
