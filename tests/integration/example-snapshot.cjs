const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.INTEGRATION_BASE||'http://127.0.0.1:18080';
const root=path.resolve(__dirname,'../..');
const output=path.join(root,'backend/migration-local');
(async()=>{
  const source=fs.readFileSync(path.join(root,'pages/query/examples.js'),'utf8');
  const {examples}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const records=[];
  for(const example of examples){
    const response=await fetch(base+'/api/cypher/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:example.query})});
    const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.truncated,false);
    records.push({id:example.id,label:example.label,columns:result.columns,rows:result.rows});
  }
  const canonical=value=>value.map(record=>({...record,rows:[...record.rows].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))}));
  if(process.argv.includes('--before')){fs.writeFileSync(path.join(output,'examples-before.json'),JSON.stringify(records,null,2));}
  else {
    const before=JSON.parse(fs.readFileSync(path.join(output,'examples-before.json'),'utf8'));
    assert.deepEqual(canonical(records),canonical(before));
    // Verify the prescribed sort keys independently of tie order.
    for(const [index,keys] of [[0,[['平均所得',-1]]],[1,[['平均所得',1]]],[2,[['診所數',1],['人口數',-1]]],[3,[['護理師總數',-1]]],[4,[['每萬人口醫師數',-1]]],[5,[['院所總數',-1],['土地面積',-1]]]]){
      const record=records[index];
      for(let i=1;i<record.rows.length;i++){
        for(const [column,direction] of keys){const k=record.columns.indexOf(column),left=record.rows[i-1][k],right=record.rows[i][k];if(left==null||right==null)continue;const difference=(left-right)*direction;if(difference!==0){assert.ok(difference<=0,column+' sort');break;}}
      }
    }
    fs.writeFileSync(path.join(output,'examples-after.json'),JSON.stringify(records,null,2));
    fs.writeFileSync(path.join(output,'example-regression.json'),JSON.stringify({passed:true,base,examples:records.map(record=>({id:record.id,label:record.label,count:record.rows.length,columns:record.columns})),comparison:'full values and columns; prescribed sort keys; ties may differ'},null,2));
  }
  console.log(JSON.stringify(records.map(record=>({id:record.id,count:record.rows.length}))));
})().catch(error=>{console.error(error);process.exitCode=1;});
