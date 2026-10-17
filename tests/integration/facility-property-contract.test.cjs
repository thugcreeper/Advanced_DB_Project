const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});});
after(async()=>{await browser?.close();});
for(const width of [1440,390])test(`English API contract still renders mapped facility at ${width}px`,async()=>{
  const page=await browser.newPage({viewport:{width,height:950}});const errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  const facility={sourceId:'opaque-id',name:'測試院所',type:'西醫診所',address:'新竹市測試地址',phone:'02-12345678',latitude:24.75,longitude:120.9,locationReviewRequired:false};
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());let body;
    if(url.pathname==='/api/health')body={status:'UP'};
    else if(url.pathname==='/api/districts')body=[{name:'新竹市',districts:[{code:'1205',name:'香山區'}]}];
    else if(url.pathname==='/api/facilities/departments')body=['內科','家庭醫學科'];
    else if(url.pathname==='/api/facilities/detail')body={...facility,departments:['內科'],notes:'測試備註',source:'來源.json',clinicHours:{status:'available',days:[{day:'monday',status:'closed',slots:[]}]}};
    else if(url.pathname==='/api/facilities'){
      requests.push(url);body={county:'新竹市',districtCode:'1205',district:'香山區',type:url.searchParams.get('type'),department:url.searchParams.get('department'),total:1,unlocatedCount:0,unassignedTotal:0,facilities:[facility]};
    }else if(url.hostname==='frontend.test'){
      const file=path.resolve(root,'.'+url.pathname);
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
      const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
      return route.fulfill({contentType:type+'; charset=utf-8',body:fs.readFileSync(file)});
    }else return route.abort();
    return route.fulfill({json:body,headers:{'access-control-allow-origin':'*'}});
  });
  try{
    await page.goto('http://frontend.test/pages/district/index.html');
    await page.waitForFunction(()=>!document.getElementById('county').disabled&&!document.getElementById('facilityDepartment').disabled);
    await page.selectOption('#county','新竹市');await page.selectOption('#district','1205');await page.selectOption('#facilityDepartment','內科');
    await page.click('#searchButton');await page.waitForFunction(()=>document.getElementById('totalCount').textContent==='共 1 筆');
    assert.match(await page.locator('#facilityResults').textContent(),/測試院所/);
    assert.equal(requests.at(-1).searchParams.get('department'),'內科');
    const marker=page.locator('path[data-source-id="opaque-id"]');await marker.waitFor();
    await marker.click({force:true});await page.locator('#detailContent:not([hidden])').waitFor();
    assert.equal(await page.textContent('#detailTitle'),'測試院所');
    assert.match(await page.textContent('#detailContent'),/新竹市測試地址/);
    assert.match(await page.textContent('#detailContent'),/測試備註/);
    assert.match(await page.textContent('#detailContent'),/內科/);
    assert.equal(await page.getAttribute('#detailCall','href'),'tel:0212345678');
    assert.match(await page.getAttribute('#detailGoogle','href'),/24.75%2C120.9/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
