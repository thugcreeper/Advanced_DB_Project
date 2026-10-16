const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {chromium}=require('playwright');
const base=process.env.STATISTICS_BASE||'http://127.0.0.1:18080';const directory=path.resolve(__dirname,'../integration/artifacts');let browser,raw,all,evidence={};
const dept=(category,scope='all',min=1)=>({category,scope,count:{min}});
const codes=r=>r.districts.map(d=>d.county+d.name).sort();
async function post(url,body){const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
const search=body=>post('/api/districts/statistics/search',body);
before(async()=>{
 await require('../cypher/ready.cjs')(base);fs.mkdirSync(directory,{recursive:true});browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
 const result=await post('/api/cypher/query',{query:'MATCH (a:鄉鎮區碼與名稱)-[r:RECORD_DEPARTMENT]->(s:科別) WHERE a.鄉鎮市區名稱 STARTS WITH $county AND s.科別名稱 IN $categories AND r.類型 IN ["醫院","診所"] RETURN a.鄉鎮市區名稱 AS district,s.科別名稱 AS category,r.類型 AS type,sum(r.數量) AS count',parameters:{county:'臺南市',categories:['中醫婦科','內科']}});
 raw=result.rows.map(row=>Object.fromEntries(result.columns.map((key,i)=>[key,row[i]])));all=await search({county:'臺南市'});
});
after(async()=>{fs.writeFileSync(path.join(directory,'statistics-filter-evidence.json'),JSON.stringify(evidence,null,2));await browser?.close();});
function expected(names,scope,match){return all.districts.filter(d=>{const values=names.map(category=>raw.filter(r=>r.district===d.county+d.name&&r.category===category&&(scope==='all'||r.type===(scope==='hospital'?'醫院':'診所'))).reduce((n,r)=>n+r.count,0)>0);return match==='and'?values.every(Boolean):values.some(Boolean);}).map(d=>d.county+d.name).sort();}
test('Aura confirmed cases and hospital/clinic scope equal raw RECORD_DEPARTMENT',async()=>{
 for(const scope of ['all','hospital','clinic']){
  const body={county:'臺南市',specialties:[dept('中醫婦科',scope)]};const result=await search(body);assert.deepEqual(codes(result),expected(['中醫婦科'],scope,'or'));
  for(const row of result.districts){const s=row.specialties[0];const name=row.county+row.name;assert.equal(s.hospital,raw.find(r=>r.district===name&&r.category==='中醫婦科'&&r.type==='醫院')?.count??null);assert.equal(s.clinic,raw.find(r=>r.district===name&&r.category==='中醫婦科'&&r.type==='診所')?.count??null);assert.equal(s.total,s.hospital==null||s.clinic==null?null:s.hospital+s.clinic);assert.ok(s.selected>0);}
  if(scope==='all'){const north=result.districts.find(r=>r.name==='北區').specialties[0];assert.deepEqual([north.hospital,north.clinic,north.total],[1,4,5]);assert.equal(result.districts.find(r=>r.name==='東區').specialties[0].clinic,7);evidence.single={request:body,accepted:result.appliedFilters,rows:result.districts.map(r=>({district:r.county+r.name,specialties:r.specialties})),source:result.source};}
 }
});
test('OR and AND match independent raw-record oracle without a cross-department sum',async()=>{
 const selections=[dept('中醫婦科'),dept('內科')];const or=await search({county:'臺南市',specialties:selections,specialtyMatch:'or'});const and=await search({county:'臺南市',specialties:selections,specialtyMatch:'and'});
 assert.deepEqual(codes(or),expected(['中醫婦科','內科'],'all','or'));assert.deepEqual(codes(and),expected(['中醫婦科','內科'],'all','and'));for(const scope of ['hospital','clinic']){const r=await search({county:'臺南市',specialties:[dept('中醫婦科',scope),dept('內科',scope)],specialtyMatch:'and'});assert.deepEqual(codes(r),expected(['中醫婦科','內科'],scope,'and'));}assert.ok(or.total>and.total);assert.ok(and.districts.every(r=>r.specialties.every(s=>s.selected>0)));
 evidence.multiple={or:or.total,and:and.total,categories:selections.map(s=>s.category)};
});
test('district/personnel/all numeric conditions/sort are accepted and applied together',async()=>{
 const north=all.districts.find(r=>r.name==='北區');const body={county:'臺南市',districtCode:north.code,income:{min:1},population:{min:1,max:200000},area:{min:1,max:100},hospitals:{min:1,max:10},clinics:{min:1,max:500},specialties:[dept('中醫婦科')],personnel:{category:'護理師',scope:'all',count:{min:1}},sort:[{field:'population',direction:'asc'}]};
 const result=await search(body);assert.equal(result.total,1);assert.equal(result.districts[0].name,'北區');assert.ok(result.districts[0].personnel>0);const nursing=await post('/api/cypher/query',{query:'MATCH (a:鄉鎮區碼與名稱)-[r:RECORD_PERSONNEL]->(p:醫事人員類別) WHERE a.鄉鎮市區名稱=$district AND p.人員類別=$category AND r.類型 IN ["醫院","診所"] RETURN sum(r.數量) AS count',parameters:{district:'臺南市北區',category:'護理師'}});assert.equal(result.districts[0].personnel,nursing.rows[0][0]);assert.equal(result.appliedFilters.districtCode,north.code);assert.equal(result.appliedFilters.ranges.population.max,200000);
 assert.equal((await search({...body,personnel:{category:'護理師',scope:'all',count:{min:1000000}}})).total,0);
 const sorted=await search({county:'臺南市',sort:[{field:'population',direction:'asc'}]});assert.deepEqual(sorted.districts.map(r=>r.population),sorted.districts.map(r=>r.population).sort((a,b)=>a-b));evidence.combined={request:body,accepted:result.appliedFilters,total:result.total};
});
async function ready(viewport){const page=await browser.newPage({viewport});page.on('pageerror',e=>{throw e;});await page.goto(base+'/pages/query/index.html');await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');await page.selectOption('#county','臺南市');await page.locator('#searchButton:not([disabled])').waitFor();await page.locator('#advancedFilters > summary').click();await page.locator('[data-condition-group="categories"] > summary').click();return page;}
async function add(page,name){await page.click('#specialtyTrigger');await page.fill('#specialtySearch',name);await page.locator('#specialtyPopup [data-value="'+name+'"]').click();await page.getByRole('button',{name:'關閉醫療科別選單',exact:true}).click();}
async function submit(page){const promise=page.waitForResponse(r=>r.url().endsWith('/statistics/search')&&r.request().method()==='POST');await page.click('#searchButton');const response=await promise,data=await response.json();assert.equal(response.status(),200);await page.waitForFunction(n=>document.getElementById('resultRows').children.length===n,data.total);return {request:response.request().postDataJSON(),data};}
function csvRows(text){const rows=[];let row=[],field='',quoted=false;text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}row.push(field);rows.push(row);return rows;}
for(const viewport of [{width:1440,height:1000},{width:1100,height:900},{width:390,height:844}])test(`single department compact table and CSV align at ${viewport.width}px`,async()=>{
 const page=await ready(viewport);try{
  await add(page,'中醫婦科');assert.equal(await page.locator('#specialtyMin').inputValue(),'1');const {request,data}=await submit(page);
  assert.deepEqual(request.specialties,[dept('中醫婦科')]);assert.equal(request.districtCode,'');assert.deepEqual(data.appliedFilters.specialties,['中醫婦科']);
  const headers=await page.locator('#statisticsHead th').allTextContents();assert.equal(headers.length,5);assert.ok(headers[1].includes('中醫婦科：醫院'));assert.ok(!headers.some(s=>s.includes('西醫師')||s.includes('所選人員')));
  const display=await page.locator('#resultRows tr').evaluateAll(rows=>rows.map(r=>[...r.cells].slice(0,4).map(c=>c.textContent)));
  const downloadPromise=page.waitForEvent('download');await page.click('#downloadCsv');const download=await downloadPromise;const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const csv=csvRows(Buffer.concat(chunks).toString('utf8'));assert.equal(csv[0].length,4);assert.deepEqual(csv.slice(1),display.map(row=>row.map(value=>value==='未提供'?'':value)));
  if(viewport.width>=1100)assert.ok(await page.locator('#statisticsHead').evaluate(n=>{const box=n.closest('.table-scroll');return box.scrollWidth<=box.clientWidth+1;}),'desktop table must not require horizontal scrolling');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('.results-panel').screenshot({path:path.join(directory,`statistics-compact-${viewport.width}.png`)});
  if(viewport.width===1440)evidence.presentation={request,accepted:data.appliedFilters,headers,display,csv};
  await page.selectOption('#scope','clinic');const clinic=await submit(page);assert.equal(clinic.request.specialties[0].scope,'clinic');assert.equal(await page.locator('#statisticsHead th').count(),3);
 }finally{await page.close();}
});
test('multi-select add/remove AND/OR latest state, personnel and reset reach API',async()=>{
 const page=await ready({width:1440,height:1000});try{
  await add(page,'中醫婦科');await add(page,'內科');assert.equal(await page.locator('.selector-chip').count(),2);await page.selectOption('#specialtyMatch','or');const or=await submit(page);await page.selectOption('#specialtyMatch','and');const and=await submit(page);assert.ok(or.data.total>and.data.total);assert.equal(and.request.specialtyMatch,'and');assert.equal(await page.locator('#statisticsHead th').count(),3);
  await page.locator('#resultRows .result-data-row').first().locator('.result-details-button').click();await page.getByRole('tab',{name:'科別統計',exact:true}).click();assert.match(await page.locator('.statistics-dialog [data-panel=departments] .category-statistics').textContent(),/醫院.*中醫婦科/s);assert.ok(await page.locator('#statisticsHead').evaluate(n=>{const box=n.closest('.table-scroll');return box.scrollWidth<=box.clientWidth+1;}));
  await page.keyboard.press('Escape');await page.click('#personnelTrigger');await page.fill('#personnelSearch','護理師');await page.locator('#personnelPopup [data-value="護理師"]').click();const combined=await submit(page);assert.equal(combined.request.personnel.category,'護理師');assert.equal(combined.request.specialties.length,2);assert.ok(combined.data.districts.every(r=>r.personnel>0));assert.equal(await page.locator('#statisticsHead th').count(),4);
  await page.getByRole('button',{name:'移除內科',exact:true}).click();const changed=await submit(page);assert.deepEqual(changed.request.specialties.map(s=>s.category),['中醫婦科']);
  const resetPromise=page.waitForResponse(r=>r.url().endsWith('/statistics/search')&&r.request().method()==='POST');await page.locator('#builderPane button[type=reset]').click();const reset=await resetPromise;const resetData=await reset.json();assert.equal(reset.request().postDataJSON().county,'');assert.deepEqual(reset.request().postDataJSON().specialties,[]);assert.equal(resetData.total,368);assert.equal(await page.locator('.selector-chip').count(),0);
 }finally{await page.close();}
});

test('many departments keep the main table bounded and CSV retains every selected department',async()=>{
 const page=await ready({width:1100,height:900});try{
  const options=await (await fetch(base+'/api/districts/statistics/options')).json();const names=options.specialties.slice(0,8);for(const name of names)await add(page,name);const result=await submit(page);assert.equal(result.request.specialties.length,8);assert.equal(await page.locator('#statisticsHead th').count(),3);
  await page.locator('#resultRows .result-data-row').first().locator('.result-details-button').click();await page.getByRole('tab',{name:'科別統計',exact:true}).click();assert.ok(await page.locator('#statisticsHead').evaluate(n=>{const box=n.closest('.table-scroll');return box.scrollWidth<=box.clientWidth+1;}));
  const text=await page.locator('.statistics-dialog [data-panel=departments] .category-statistics').textContent();for(const name of names)assert.ok(text.includes(name));
  await page.keyboard.press('Escape');const event=page.waitForEvent('download');await page.click('#downloadCsv');const stream=await (await event).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const csv=csvRows(Buffer.concat(chunks).toString('utf8'));assert.equal(csv[0].length,2);for(const name of names)assert.ok(csv[1][1].includes(name));
  await page.locator('.results-panel').screenshot({path:path.join(directory,'statistics-many-1100.png')});
 }finally{await page.close();}
});

test('changing county preserves numeric conditions and matching categories',async()=>{
 const page=await ready({width:1440,height:1000});try{
  await add(page,'中醫婦科');await page.locator('[data-condition-group="population"] > summary').click();await page.fill('#populationMin','1');await page.fill('#populationMax','300000');await page.fill('#areaMin','1');await page.fill('#areaMax','100');
  await page.selectOption('#county','新竹市');await page.locator('#searchButton:not([disabled])').waitFor();assert.equal(await page.locator('#populationMin').inputValue(),'1');assert.equal(await page.locator('#areaMax').inputValue(),'100');assert.deepEqual(JSON.parse(await page.locator('#specialty').inputValue()),['中醫婦科']);const result=await submit(page);assert.deepEqual(result.request.population,{min:1,max:300000});assert.deepEqual(result.request.area,{min:1,max:100});assert.equal(result.request.county,'新竹市');
 }finally{await page.close();}
});

test('doctor subtotals and population rates remain consistent without obsolete full-column UI assumptions',async()=>{
 const data=await search({sort:[{field:'westernDoctorRate',direction:'desc'}]});assert.equal(data.total,368);
 for(const row of data.districts){assert.equal(row.doctors,row.westernDoctors+row.chineseDoctors+row.dentists);assert.equal(row.westernDoctors,row.hospitalWesternDoctors+row.clinicWesternDoctors);assert.equal(row.westernDoctorRate,row.population>0?Math.round(10000*row.westernDoctors/row.population*100)/100:null);}
});
