const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.INTEGRATION_BASE||'http://127.0.0.1:18084';
const local=path.resolve(__dirname,'../../backend/migration-local');
const plan=JSON.parse(fs.readFileSync(path.join(local,'dry-run.json'),'utf8'));
async function get(url){const response=await fetch(base+url);assert.equal(response.status,200);return response.json();}
const medical=row=>row.properties.type.includes('醫院')||row.properties.type.includes('診所');
test('all 368 districts preserve source facility membership and exact properties',async()=>{
  const counties=await get('/api/districts');let total=0;const unique=new Set();
  const districts=counties.flatMap(county=>county.districts);
  for(let offset=0;offset<districts.length;offset+=10){
    await Promise.all(districts.slice(offset,offset+10).map(async district=>{
      const result=await get('/api/facilities?'+new URLSearchParams({county:district.county,districtCode:district.code,type:'all'}));
      const expected=plan.facilities.filter(row=>row.area.code===district.code&&medical(row));
      assert.equal(result.total,expected.length);assert.equal(result.unassignedTotal,0);
      assert.deepEqual(result.facilities.map(row=>row.sourceId).sort(),expected.map(row=>row.sourceId).sort());
      const byId=new Map(expected.map(row=>[row.sourceId,row.properties]));
      for(const row of result.facilities){assert.ok(!unique.has(row.sourceId));unique.add(row.sourceId);
        for(const field of ['name','address','type','latitude','longitude','phone'])assert.equal(row[field],byId.get(row.sourceId)[field]??(field==='phone'?'':null));
        assert.equal(row.locationReviewRequired,byId.get(row.sourceId).districtCoordinateConflict??false);
      }
      total+=result.total;
    }));
  }
  assert.equal(total,23225);assert.equal(unique.size,23225);
  console.log('Full district membership: '+total+' distinct hospitals/clinics; 13 pathology centers excluded from this view');
});
test('explicit hospital and clinic categories match source totals in all counties',async()=>{
  const counties=await get('/api/districts');const totals={hospital:0,clinic:0};
  for(const county of counties)for(const type of ['hospital','clinic']){
    const codes=new Set(county.districts.map(row=>row.code));
    const expected=plan.facilities.filter(row=>codes.has(row.area.code)&&row.properties.type.includes(type==='hospital'?'醫院':'診所'));
    const result=await get('/api/facilities?'+new URLSearchParams({county:county.name,type}));
    assert.deepEqual(result.facilities.map(row=>row.sourceId).sort(),expected.map(row=>row.sourceId).sort());totals[type]+=result.total;
  }
  assert.deepEqual(totals,{hospital:483,clinic:22742});
});
test('real department filtering uses facility edges and retains distinct institutions',async()=>{
  const result=await get('/api/facilities?'+new URLSearchParams({county:'新竹市',districtCode:'1205',type:'all',department:'內科'}));
  const ids=new Set(plan.relationships.filter(row=>row.standard==='內科').map(row=>row.sourceId));
  const expected=plan.facilities.filter(row=>row.area.code==='1205'&&medical(row)&&ids.has(row.sourceId));
  assert.equal(result.total,2);assert.equal(new Set(result.facilities.map(row=>row.sourceId)).size,2);
  assert.deepEqual(result.facilities.map(row=>row.sourceId).sort(),expected.map(row=>row.sourceId).sort());
});
test('facility-only departments do not expand the official statistics selector',async()=>{
  const facilities=await get('/api/facilities/departments');assert.equal(facilities.length,42);
  assert.ok(facilities.includes('牙科'));assert.ok(facilities.includes('一般精神科'));assert.ok(facilities.includes('洗腎科'));
  const statistics=await get('/api/districts/statistics/options');assert.equal(statistics.specialties.length,45);assert.equal(statistics.personnel.length,27);
  assert.ok(!statistics.specialties.includes('洗腎科'));assert.ok(statistics.specialties.includes('中醫針灸科'));
});
