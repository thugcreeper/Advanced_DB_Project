const scopeName = {all:'合計', total:'合計', hospital:'醫院', clinic:'診所'};
const metrics = [['averageIncome','平均所得（千元）'],['population','人口（人）'],['area','面積（平方公里）'],['hospitalCount','醫院家數'],['clinicCount','診所家數'],['staff','醫事人員總數（人）'],['staffRate','每萬人口醫事人員數'],['doctors','醫師總數（人）'],['doctorRate','每萬人口醫師數'],['westernDoctors','西醫師合計'],['chineseDoctors','中醫師合計'],['dentists','牙醫師合計'],['medicalYear','醫療統計年度'],['incomeYear','所得年度'],['populationYear','人口年度']];
const plain = value => typeof value === 'number' && Number.isFinite(value) || typeof value === 'string' && !['undefined','null','[object Object]'].includes(value) ? value : null;
const text = value => plain(value) ?? '未提供';

const overviewGroups=[
  {title:'人口與土地',items:[['population','人口','人'],['area','土地面積','平方公里'],['density','人口密度','人／平方公里']]},
  {title:'醫療資源',items:[['hospitalCount','醫院家數','家'],['clinicCount','診所家數','家']]},
  {title:'醫事人員',items:[['staff','醫事人員總數','人'],['staffRate','每萬人口醫事人員數','人'],['doctors','醫師總數','人'],['doctorRate','每萬人口醫師數','人'],['westernDoctors','西醫師合計','人'],['westernDoctorRate','每萬人口西醫師數','人'],['chineseDoctors','中醫師合計','人'],['dentists','牙醫師合計','人']]},
  {title:'所得與統計年度',items:[['averageIncome','平均所得','千元'],['medianIncome','所得中位數','千元'],['medicalYear','醫療統計年度','年'],['incomeYear','所得年度','年'],['populationYear','人口年度','年']]}
];

export function statisticsColumns(body={}, applied={}) {
  const scope = applied.scope || body.personnel?.scope || body.specialties?.[0]?.scope || 'all';
  const chosen = applied.specialties || body.specialties?.map(s=>s.category) || [];
  const person = applied.personnel || body.personnel?.category || '';
  const columns = [{key:'name',label:'行政區'}];
  const stats=(row,category)=>row.specialties?.find(s=>s.category===category)||{};
  if (chosen.length===1) {
    const name=chosen[0];
    for (const part of scope==='all'?['hospital','clinic','total']:[scope]) columns.push({key:'department:'+part,label:part==='total'?'合計':`${name}：${scopeName[part]}`,value:row=>stats(row,name)[part]});
  } else if (chosen.length>1) {
    columns.push({key:'departmentDetails',label:`所選科別（${chosen.length} 科，分別計數）`,sortable:false,
      display:row=>`${chosen.filter(name=>Number(stats(row,name).selected)>0).length}／${chosen.length} 科有統計`,
      value:row=>chosen.map(name=>{const s=stats(row,name);return scope==='all'?`${name}：醫院 ${text(s.hospital)}／診所 ${text(s.clinic)}／合計 ${text(s.total)}`:`${name}：${scopeName[scope]} ${text(s[scope])}`;}).join('\n')});
  }
  if (person) columns.push({key:'personnel',label:`${person}：${scope==='all'?'已知人數':scopeName[scope]}`,value:row=>row.personnel});
  const conditions=[['income','averageIncome'],['population','population'],['area','area'],['hospitals','hospitalCount'],['clinics','clinicCount']]
    .filter(([name])=>body[name]).map(([,key])=>metrics.find(m=>m[0]===key));
  if (!chosen.length&&!person&&!conditions.length) columns.push(...metrics.filter(([key])=>['averageIncome','hospitalCount','clinicCount'].includes(key)).map(([key,label])=>({key,label})));
  else if (conditions.length===1) {const [key,label]=conditions[0];columns.push({key,label});}
  else if (conditions.length>1) columns.push({key:'conditionDetails',label:'其他篩選數值',sortable:false,display:()=>`${conditions.length} 項條件符合`,value:row=>conditions.map(([key,label])=>`${label}：${text(row[key])}`).join('\n')});
  columns.push({key:'details',label:'詳細資料',export:false,details:row=>({
    name:row.county+row.name, scope,
    departments:chosen.map(category=>{const s=stats(row,category);return {category,hospital:plain(s.hospital),clinic:plain(s.clinic),total:plain(s.total)};}),
    personnel:person?[{category:person,...Object.fromEntries(['hospital','clinic','total'].map(key=>[key,plain(row.personnelStatistics?.find(s=>s.category===person)?.[key])]))}]:[],
    overview:overviewGroups.map(group=>({...group,items:group.items.map(([key,label,unit])=>({key,label,unit,value:plain(row[key])}))}))
  })});
  return columns;
}
