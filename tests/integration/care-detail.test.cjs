const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),artifacts=path.join(__dirname,'artifacts');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});fs.mkdirSync(artifacts,{recursive:true});});
after(async()=>{await browser?.close();});
const slot=(open,close)=>({open,close});
const schedule=()=>({status:'available',days:[
 {day:'monday',status:'scheduled',slots:[slot('08:00','17:30')]},
 {day:'tuesday',status:'scheduled',slots:[slot('08:30','12:00'),slot('14:00','18:00')]},
 {day:'wednesday',status:'scheduled',slots:[slot('08:00','10:00'),slot('12:00','15:00'),slot('18:00','21:00')]},
 {day:'thursday',status:'scheduled',slots:[slot('06:00','07:00'),slot('08:00','09:00'),slot('10:00','11:00'),slot('13:00','14:00'),slot('18:00','00:30')]},
 {day:'saturday',status:'closed',slots:[]},{day:'sunday',status:'closed',slots:[]},
]});
const names=['家庭醫學科','內科','外科','復健科','急診醫學科','泌尿科','精神科','骨科','小兒科','具有很長名稱但必須完整顯示且自然換行的特殊診療科別'];
const facility={sourceId:'id-1',name:'衛生福利部測試醫院',type:'綜合醫院',address:'新竹市香山區測試路10號',phone:'(03)12345678',latitude:24.75,longitude:120.9,locationReviewRequired:false};
async function ready(width=1440,height=1000){
 const page=await browser.newPage({viewport:{width,height},timezoneId:"America/Los_Angeles"}),state={detail:{...facility,departments:[...names,' 內科 ',''],clinicHours:schedule(),notes:'資料依院所公布為準。',source:'測試.json'},calls:0,status:200,delay:0};const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());let data;
  if(url.pathname==='/api/health')data={status:'UP'};
  else if(url.pathname==='/api/districts')data=[{name:'新竹市',districts:[{code:'1205',name:'香山區'}]}];
  else if(url.pathname==='/api/facilities/departments')data=['內科','外科'];
  else if(url.pathname==='/api/facilities')data={county:'新竹市',districtCode:'1205',district:'香山區',type:'all',department:url.searchParams.get('department')||'',total:1,unlocatedCount:0,unassignedTotal:0,facilities:[facility]};
  else if(url.pathname==='/api/facilities/detail'){
   state.calls++;const body=state.detail,status=state.status;if(state.delay)await new Promise(resolve=>setTimeout(resolve,state.delay));
   return route.fulfill({status,json:body,headers:{'access-control-allow-origin':'*'}}).catch(()=>{});
  }else if(url.hostname==='frontend.test'){
   const file=path.resolve(root,'.'+url.pathname);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
   const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
   let body=fs.readFileSync(file);
   return route.fulfill({contentType:type+'; charset=utf-8',body});
  }else return route.abort();
  return route.fulfill({json:data,headers:{'access-control-allow-origin':'*'}});
 });
 await page.goto('http://frontend.test/pages/district/index.html');
 await page.waitForFunction(()=>!document.getElementById('county').disabled&&!document.getElementById('facilityDepartment').disabled);
 await page.selectOption('#county','新竹市');await page.selectOption('#district','1205');await page.selectOption('#facilityDepartment','內科');await page.click('#searchButton');
 await page.waitForFunction(()=>document.querySelector('#totalCount').textContent==='共 1 筆');
 return {page,state,errors};
}
async function open(page,marker=false){await page.locator(marker?'path[data-source-id="id-1"]':'.facility-open').first().click({force:marker});await page.locator('#facilityDetail[open] #detailContent:not([hidden])').waitFor();}
async function colors(page){return page.locator('.detail-departments li').evaluateAll(items=>items.map(n=>({y:n.offsetTop,color:getComputedStyle(n).backgroundColor,text:n.textContent})));}

test('one centered modal supports list/marker, all close methods, focus trap and preserves search/map',async()=>{
 const {page,state,errors}=await ready();try{
  const before=await page.evaluate(()=>({y:scrollY,transform:document.querySelector('.leaflet-map-pane').style.transform}));
  await open(page);assert.equal(await page.locator('#facilityDetail').count(),1);assert.equal(await page.locator('.map-wrap #facilityDetail').count(),0);
  const box=await page.locator('#facilityDetail').boundingBox();assert.ok(box.width>=850&&box.width<=950);assert.ok(Math.abs(box.x+box.width/2-720)<2);assert.ok(Math.abs(box.y+box.height/2-500)<2);
  assert.equal(await page.evaluate(()=>document.querySelector('#facilityDetail').matches(':modal')),true);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden');
  assert.match(await page.textContent('#detailContent'),/新竹市香山區測試路10號/);assert.equal(await page.getAttribute('#detailCall','href'),'tel:0312345678');
  assert.match(await page.getAttribute('#detailGoogle','href'),/24.75%2C120.9/);
  await page.locator('#detailClose').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.querySelector('#facilityDetail').contains(document.activeElement)),true);
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#facilityDetail').contains(document.activeElement)),true);}
  await page.click('#detailTitle');assert.equal(await page.locator('#facilityDetail').isVisible(),true);
  await page.click('#detailClose');assert.equal(await page.locator('.facility-open').evaluate(n=>n===document.activeElement),true);
  await open(page,true);await page.keyboard.press('Escape');assert.equal(await page.locator('path[data-source-id="id-1"]').evaluate(n=>n===document.activeElement),true);
  await open(page);await page.mouse.click(20,20);assert.equal(await page.locator('#facilityDetail').isVisible(),false);
  assert.equal(await page.inputValue('#county'),'新竹市');assert.equal(await page.inputValue('#district'),'1205');assert.equal(await page.inputValue('#facilityDepartment'),'內科');
  assert.deepEqual(await page.evaluate(()=>({y:scrollY,transform:document.querySelector('.leaflet-map-pane').style.transform})),before);
  assert.equal(state.calls,3);assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

test('CARE table shows 1/2/3/5 intervals without splitting continuous sessions, with closure/missing/overnight',async()=>{
 const {page}=await ready();try{
  await open(page);assert.equal(await page.locator('.clinic-table thead [data-weekday]').count(),7);assert.equal(await page.locator('.clinic-table tbody tr').count(),5);
  assert.equal(await page.locator('.clinic-session-dot').count(),11);assert.equal(await page.locator('.clinic-day,.clinic-week-tabs').count(),0);
  assert.deepEqual(await page.locator('td[data-weekday=monday] .clinic-interval').allTextContents(),['08:00–17:30']);
  assert.equal(await page.locator('td[data-weekday=tuesday] .clinic-interval').count(),2);assert.equal(await page.locator('td[data-weekday=wednesday] .clinic-interval').count(),3);assert.equal(await page.locator('td[data-weekday=thursday] .clinic-interval').count(),5);
  assert.match(await page.locator('td[data-weekday=thursday]').last().textContent(),/18:00–00:30.*跨日至次日/);
  assert.match(await page.locator('td[data-weekday=friday]').textContent(),/未提供資料/);assert.match(await page.locator('td[data-weekday=sunday]').textContent(),/休診/);
  assert.doesNotMatch(await page.textContent('.clinic-table'),/早診|午診|晚診/);
 }finally{await page.close();}
});

for(const [width,height] of [[1440,1000],[820,1180],[600,900],[390,844],[320,700]])test(`responsive ${width}px keeps internal scroll, header/actions and entire-row department colors`,async()=>{
 const {page,errors}=await ready(width,height);try{
  await open(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('.detail-departments li').count(),10);assert.match(await page.locator('#detailContent h3').allTextContents().then(x=>x.join(' ')),/診療科別（共 10 項）/);
  const rows=new Map();for(const item of await colors(page)){if(!rows.has(item.y))rows.set(item.y,new Set());rows.get(item.y).add(item.color);}
  let prior;for(const row of rows.values()){assert.equal(row.size,1);const color=[...row][0];if(prior)assert.notEqual(color,prior);prior=color;}
  const header=await page.locator('.detail-header').boundingBox(),footer=await page.locator('#detailActions').boundingBox();
  await page.screenshot({path:path.join(artifacts,`care-modal-${width}.png`)});
  await page.locator('#detailScroll').evaluate(n=>n.scrollTop=n.scrollHeight);assert.deepEqual(await page.locator('.detail-header').boundingBox(),header);assert.deepEqual(await page.locator('#detailActions').boundingBox(),footer);
  await page.screenshot({path:path.join(artifacts,`care-modal-departments-${width}.png`)});
  assert.equal(await page.locator('#facilityDetail').evaluate(n=>n.scrollWidth>n.clientWidth),false);
  if(width<800)assert.equal(await page.locator('.clinic-table-scroll').evaluate(n=>n.scrollWidth>n.clientWidth),true);
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

test('resizing an open modal keeps department rows uniformly blue/green',async()=>{
 const {page}=await ready();try{await open(page);for(const width of [1440,600,320,820]){await page.setViewportSize({width,height:900});const rows=new Map();for(const item of await colors(page)){if(!rows.has(item.y))rows.set(item.y,new Set());rows.get(item.y).add(item.color);}let previous;for(const values of rows.values()){assert.equal(values.size,1);const color=[...values][0];if(previous)assert.notEqual(color,previous);previous=color;}}}finally{await page.close();}
});

test('all-closed, absent, invalid and partial schedules never invent hours or execute HTML',async()=>{
 const {page,state,errors}=await ready();try{
  const days=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  for(const hours of [{status:'available',days:days.map(day=>({day,status:'closed',slots:[]}))},{status:'missing',days:[]},null,{status:'invalid',days:[]},{status:'partial',days:[{day:'monday',status:'scheduled',slots:[slot('08:00','12:00'),slot('99:00','21:00')]}]}]){
   state.detail={...state.detail,clinicHours:hours,departments:[],notes:'<img src=x onerror="window.attacked=1">'};await open(page);
   if(hours?.days?.every(d=>d.status==='closed')&&hours.days.length)assert.equal(await page.locator('.clinic-closed-label').count(),7);
   if(hours?.status==='invalid')assert.match(await page.textContent('#detailContent'),/格式異常/);
   if(!hours||hours.status==='missing')assert.equal(await page.locator('.clinic-cell-state').filter({hasText:'未提供資料'}).count(),7);
   if(hours?.status==='partial'){assert.equal(await page.locator('.clinic-interval').count(),1);assert.match(await page.textContent('#detailContent'),/部分診療時間資料格式異常/);}
   assert.match(await page.textContent('#detailContent'),/暫無科別資料/);assert.equal(await page.locator('#detailContent img').count(),0);assert.equal(await page.evaluate(()=>window.attacked),undefined);
   await page.click('#detailClose');
  }assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

test('Taipei weekday ignores browser timezone and updates the whole column at midnight',async()=>{
 const {page}=await ready();try{
  await page.clock.install({time:new Date('2026-10-18T15:59:59Z')});await open(page);
  assert.equal(await page.locator('th[aria-current=date]').getAttribute('data-weekday'),'sunday');
  await page.clock.runFor(1100);
  assert.equal(await page.locator('th[aria-current=date]').getAttribute('data-weekday'),'monday');
  assert.equal(await page.locator('[data-weekday=monday]').evaluateAll(nodes=>nodes.every(n=>n.classList.contains('is-today'))),true);
  assert.equal(await page.locator('[data-weekday=sunday].is-today').count(),0);
 }finally{await page.close();}
});

test('loading/errors/retry/late response remain contained and issue one detail request per open',async()=>{
 const {page,state}=await ready();try{
  state.status=503;state.detail={code:'DATABASE_UNAVAILABLE',message:'測試服務暫時無法使用'};
  await page.locator('.facility-open').click();await page.locator('#detailRetry').waitFor({state:'visible'});assert.equal(state.calls,1);
  state.status=200;state.detail={...facility,clinicHours:schedule(),departments:[]};await page.click('#detailRetry');await page.locator('#detailContent:not([hidden])').waitFor();assert.equal(state.calls,2);
  await page.click('#detailClose');state.delay=300;
  await page.locator('.facility-open').click();await page.locator('#detailStatus').filter({hasText:'載入院所資料中'}).waitFor();await page.keyboard.press('Escape');
  await page.waitForTimeout(400);assert.equal(await page.locator('#facilityDetail').isVisible(),false);assert.equal(await page.locator('#detailContent').textContent(),'');
  state.delay=0;await open(page);
  await page.evaluate(()=>{document.getElementById('detailClose').click();document.querySelector('.facility-open').click();});
  await page.locator('#facilityDetail[open] #detailContent:not([hidden])').waitFor();
  assert.equal(await page.locator('#facilityDetail').isVisible(),true);
 }finally{await page.close();}
});

test('local modal with live readonly Aura API preserves real facility/search/map data',{skip:!process.env.FACILITY_LIVE_CHECK},async()=>{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.route('https://thugcreeper.github.io/Advanced_DB_Project/**',async route=>{
  const pathname=new URL(route.request().url()).pathname.replace('/Advanced_DB_Project/','');const file=path.resolve(root,pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
  const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
  return route.fulfill({contentType:type+'; charset=utf-8',body:fs.readFileSync(file)});
 });
 await page.route('https://*.tile.openstreetmap.org/**',route=>route.abort());
 try{
  await page.goto('https://thugcreeper.github.io/Advanced_DB_Project/pages/district/index.html');
  await page.waitForFunction(()=>!document.querySelector('#county').disabled&&!document.querySelector('#facilityDepartment').disabled);
  await page.selectOption('#county','新竹市');await page.selectOption('#district','1205');await page.selectOption('#facilityType','clinic');await page.selectOption('#facilityDepartment','內科');
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/facilities');await page.click('#searchButton');const search=await (await response).json();
  await page.locator('.facility-open').first().waitFor();assert.ok(search.total>0);assert.equal(await page.locator('#facilityResults > li').count(),search.total);
  const expected=search.facilities[0];const details=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/facilities/detail');
  await page.locator('.facility-open').first().click();const actual=await (await details).json();await page.locator('#detailContent:not([hidden])').waitFor();
  assert.equal(await page.textContent('#detailTitle'),actual.name);assert.ok(actual.departments.includes('內科'));assert.equal(actual.sourceId,expected.sourceId);
  assert.equal(await page.locator('.clinic-table thead [data-weekday]').count(),7);
  const actualSlots=(actual.clinicHours.days||[]).flatMap(day=>day.slots||[]).map(slot=>`${slot.open}–${slot.close}`).sort();
  assert.deepEqual((await page.locator('.clinic-interval').allTextContents()).sort(),actualSlots);
  const countsBefore=await page.locator('#map path[data-source-id]').count();await page.screenshot({path:path.join(artifacts,'care-modal-live.png')});
  await page.keyboard.press('Escape');assert.equal(await page.locator('#map path[data-source-id]').count(),countsBefore);
  assert.equal(await page.inputValue('#facilityDepartment'),'內科');
  console.log(JSON.stringify({liveSearchCount:search.total,markers:countsBefore,slots:actualSlots.length,departments:actual.departments.length}));
 }finally{await page.close();}
});
