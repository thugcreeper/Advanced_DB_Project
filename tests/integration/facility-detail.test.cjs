const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.INTEGRATION_BASE||'http://127.0.0.1:18080';
let browser;
before(async()=>{await require('../cypher/ready.cjs')(base);browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});});
after(async()=>{await browser?.close();});
async function get(url){const response=await fetch(base+url);assert.equal(response.status,200);return response.json();}
async function ready(viewport={width:1440,height:1000}){
  const page=await browser.newPage({viewport});
  await page.goto(base+'/pages/district/index.html');
  await page.waitForFunction(()=>!document.getElementById('county').disabled);
  await page.selectOption('#county','新竹市');await page.selectOption('#district','1205');
  await page.click('#searchButton');await page.waitForFunction(()=>document.getElementById('totalCount').textContent==='共 14 筆');
  return page;
}
test('marker and result open the same nonmodal detail, focus returns and map stays usable',async()=>{
  const page=await ready();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    const row=page.locator('#facilityResults li').first();const id=await row.getAttribute('data-source-id');
    await page.locator(`path[data-source-id="${id}"]`).click({force:true});
    await page.locator('#detailContent').waitFor({state:'visible'});
    const name=await page.locator('#detailTitle').textContent();
    await page.click('#detailClose');await page.locator('#facilityDetail').waitFor({state:'hidden'});
    await page.locator(`path[data-source-id="${id}"]`).press('Enter');
    await page.locator('#detailContent').waitFor({state:'visible'});assert.equal(await page.locator('#detailTitle').textContent(),name);
    await page.keyboard.press('Escape');
    await row.locator('.facility-open').click();await page.locator('#detailContent').waitFor({state:'visible'});
    assert.equal(await page.locator('#detailTitle').textContent(),name);
    assert.equal(await row.locator('.facility-open').getAttribute('aria-pressed'),'true');
    await page.click('#resetMap');assert.equal(await page.locator('#facilityDetail').isVisible(),true);
    await page.click('#detailLocate');
    const markerBounds=await page.locator(`path[data-source-id="${id}"]`).boundingBox();
    const drawerBounds=await page.locator('#facilityDetail').boundingBox();
    assert.ok(markerBounds.x+markerBounds.width<drawerBounds.x);
    assert.equal(await page.locator('#map .leaflet-popup').count(),0);
    await page.keyboard.press('Escape');assert.equal(await row.locator('.facility-open').evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.locator('#facilityResults li').count(),14);assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
test('desktop and narrow mobile detail scrolls internally without overflow or raw JSON',async()=>{
  fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
  for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:700}]){
    const page=await ready(viewport);
    try{
      await page.locator('.facility-open').first().click();await page.locator('#detailContent').waitFor({state:'visible'});
      await page.locator('#facilityDetail').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await page.locator('#facilityDetail').evaluate(el=>el.scrollWidth>el.clientWidth),false);
      assert.ok(!/"isClosed"|"slots"|clinicTimeJson/.test(await page.locator('#detailContent').textContent()));
      const bounds=await page.locator('#facilityDetail').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewport.width+1);
      assert.equal(await page.locator('#facilityDetail').evaluate(el=>getComputedStyle(el).opacity),'1');
      await page.screenshot({path:path.join(__dirname,`artifacts/facility-detail-${viewport.width}.png`),animations:'disabled'});
      await page.locator('#detailScroll').evaluate(el=>el.scrollTop=el.scrollHeight);
      await page.click('#detailClose');await page.locator('.facility-open').first().press('Enter');
      await page.locator('#detailContent').waitFor({state:'visible'});
    }finally{await page.close();}
  }
});
test('missing fields, malformed hours, loading, errors and late responses never corrupt selection',async()=>{
  const page=await ready();
  try{
    const buttons=page.locator('.facility-open');const ids=await page.locator('#facilityResults li').evaluateAll(rows=>rows.map(row=>row.dataset.sourceId));
    let mode='race';
    await page.route('**/api/facilities/detail?*',async route=>{
      const id=new URL(route.request().url()).searchParams.get('sourceId');
      if(mode==='error')return route.fulfill({status:503,json:{message:'測試連線失敗'}});
      if(mode==='missing')return route.fulfill({status:404,json:{message:'查無此院所，請重新搜尋。'}});
      if(mode==='race'&&id===ids[0])await new Promise(resolve=>setTimeout(resolve,500));
      return route.fulfill({json:{sourceId:id,name:id===ids[0]?'較早院所':'目前院所',type:'診所',address:'',phone:'',departments:[],clinicHours:{status:mode==='invalid'?'invalid':'missing',days:[]},notes:'',source:'',latitude:null,longitude:null,locationReviewRequired:false}});
    });
    await buttons.nth(0).click();await page.locator('#detailStatus').filter({hasText:'載入院所資料中'}).waitFor();
    await buttons.nth(1).click();await page.locator('#detailContent').waitFor({state:'visible'});
    await page.waitForTimeout(650);assert.equal(await page.locator('#detailTitle').textContent(),'目前院所');
    assert.match(await page.locator('#detailContent').textContent(),/尚無科別資料/);
    assert.match(await page.locator('#detailContent').textContent(),/暫無診療時間資料/);
    assert.equal(await page.locator('#detailLocate').isDisabled(),true);assert.equal(await page.locator('#detailGoogle').isVisible(),false);
    mode='error';await buttons.nth(1).click();await page.locator('#detailRetry').waitFor({state:'visible'});
    assert.match(await page.locator('#detailStatus').textContent(),/測試連線失敗/);
    mode='missing';await page.click('#detailRetry');await page.waitForFunction(()=>document.getElementById('detailStatus').textContent.includes('查無此院所'));
    mode='invalid';await page.click('#detailRetry');await page.locator('#detailContent').waitFor({state:'visible'});
    assert.match(await page.locator('#detailContent').textContent(),/診療時間資料格式異常/);
    await page.click('#detailClose');mode='race';await buttons.nth(0).click();await page.click('#detailClose');
    await page.waitForTimeout(650);assert.equal(await page.locator('#facilityDetail').isVisible(),false);
  }finally{await page.close();}
});
