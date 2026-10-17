const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.INTEGRATION_BASE||'http://127.0.0.1:18080';
let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});});
after(async()=>{await browser?.close();});
test('department search, source labeling and real markers work on desktop/mobile',async()=>{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:700}]){
    const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    try{
      await page.goto(base+'/pages/district/index.html');await page.waitForFunction(()=>!document.getElementById('county').disabled&&!document.getElementById('facilityDepartment').disabled);
      await page.selectOption('#county','新竹市');await page.selectOption('#district','1205');await page.selectOption('#facilityDepartment','內科');await page.click('#searchButton');
      await page.waitForFunction(()=>document.getElementById('totalCount').textContent==='共 2 筆');
      assert.equal(await page.locator('#facilityResults li').count(),2);assert.match(await page.locator('#searchStatus').textContent(),/香山區.*內科/);
      assert.match(await page.locator('#markerCount').textContent(),/2/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(__dirname,`artifacts/district-department-${viewport.width}.png`),fullPage:true});
      assert.deepEqual(errors,[]);
      await page.selectOption('#facilityDepartment','');assert.equal(await page.locator('#facilityResults li').count(),0);
      await page.click('#searchButton');await page.waitForFunction(()=>document.getElementById('totalCount').textContent==='共 14 筆');
      await page.locator('.sidebar a[href="../data/index.html"]').click();
      assert.equal(await page.locator('code').filter({hasText:'RECORD_DEPARTMENT'}).count(),1);
      assert.equal(await page.locator('code').filter({hasText:'HAS_MEDICAL_FACILITIES'}).count(),1);
    }finally{await page.close();}
  }
});
