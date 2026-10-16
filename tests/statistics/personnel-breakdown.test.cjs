const {test,before}=require('node:test');const assert=require('node:assert/strict');
const base=process.env.STATISTICS_BASE||'http://127.0.0.1:18080';let records;
async function post(url,body){const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
before(async()=>{await require('../cypher/ready.cjs')(base);const data=await post('/api/cypher/query',{query:'MATCH (d:鄉鎮區碼與名稱)-[r:RECORD_PERSONNEL]->(p:醫事人員類別) WHERE d.鄉鎮市區名稱 STARTS WITH $county AND p.人員類別=$person RETURN d.鄉鎮市區名稱 AS district,r.類型 AS type,sum(r.數量) AS count',parameters:{county:'新竹縣',person:'護理師'}});records=data.rows.map(row=>Object.fromEntries(data.columns.map((key,i)=>[key,row[i]])));});
for(const scope of ['all','hospital','clinic'])test(`personnel ${scope} breakdown equals raw RECORD_PERSONNEL, without replacing missing records with zero`,async()=>{
 const result=await post('/api/districts/statistics/search',{county:'新竹縣',personnel:{category:'護理師',scope,count:{min:1}}});assert.ok(result.total>0);let missing=false;
 for(const row of result.districts){const name=row.county+row.name,hospital=records.find(r=>r.district===name&&r.type==='醫院')?.count??null,clinic=records.find(r=>r.district===name&&r.type==='診所')?.count??null,total=hospital==null||clinic==null?null:hospital+clinic;
  assert.deepEqual(row.personnelStatistics,[{category:'護理師',hospital,clinic,total}]);assert.equal(row.personnel,scope==='hospital'?(hospital??0):scope==='clinic'?(clinic??0):(hospital??0)+(clinic??0));assert.ok(row.personnel>0);missing ||=hospital==null||clinic==null;
 }
 if(scope!=='hospital')assert.ok(missing,'real data includes a district without a hospital record');
});
