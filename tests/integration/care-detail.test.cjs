const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.INTEGRATION_BASE||'http://127.0.0.1:18088';
const artifacts=path.join(__dirname,'artifacts');
let browser;
before(async()=>{await require('../cypher/ready.cjs')(base);browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});fs.mkdirSync(artifacts,{recursive:true});});
after(async()=>{await browser?.close();});
async function ready(viewport={width:1440,height:1000},county='新竹市',code='1205'){
  const page=await browser.newPage({viewport});
  await page.goto(base+'/pages/district/index.html');await page.waitForFunction(()=>!document.getElementById('county').disabled);
  await page.selectOption('#county',county);await page.selectOption('#district',code);await page.click('#searchButton');
  await page.locator('.facility-open').first().waitFor();return page;
}
async function open(page,index=0){await page.locator('.facility-open').nth(index).click();await page.locator('#detailContent').waitFor({state:'visible'});await page.locator('#facilityDetail').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));}
const fixture=id=>({sourceId:id,name:'測試院所',type:'診所',address:'測試地址',phone:'(02)12345678',departments:['家庭醫學科','內科','內科','', '耳鼻喉科'],clinicHours:{status:'available',days:[{day:'monday',status:'scheduled',slots:[{open:'09:00',close:'12:00'},{open:'18:30',close:'21:00'}]},{day:'tuesday',status:'closed',slots:[]},{day:'wednesday',status:'missing',slots:[]},{day:'thursday',status:'scheduled',slots:[{open:'18:00',close:'00:30'}]}]},notes:'',source:'來源.json',latitude:24.790549,longitude:120.926885,locationReviewRequired:false});
test('weekly summary exposes exact intervals, closed and unknown days with keyboard tabs',async()=>{
  const page=await ready();
  try{
    await page.route('**/api/facilities/detail?*',route=>route.fulfill({json:fixture(new URL(route.request().url()).searchParams.get('sourceId'))}));
    await open(page);
    assert.equal(await page.locator('.clinic-day').count(),7);
    assert.equal(await page.locator('.clinic-day[tabindex="0"]').count(),1);
    assert.deepEqual(await page.locator('.clinic-time').allTextContents(),['09:00–12:00','18:30–21:00']);
    await page.locator('#clinic-tab-monday').focus();await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('#clinicDayPanel').textContent(),/休診/);
    await page.keyboard.press('ArrowRight');assert.match(await page.locator('#clinicDayPanel').textContent(),/暫無診療時間資料/);
    await page.keyboard.press('ArrowRight');assert.match(await page.locator('#clinicDayPanel').textContent(),/18:00–00:30.*跨日至次日/);
    await page.keyboard.press('End');assert.equal(await page.locator('#clinic-tab-sunday').getAttribute('aria-selected'),'true');
    await page.keyboard.press('Home');assert.equal(await page.locator('#clinic-tab-monday').getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('.detail-departments li').count(),3);
    assert.equal(await page.locator('.detail-departments button').count(),0);
    assert.match(await page.locator('#detailContent h3').allTextContents().then(a=>a.join(' ')),/診療科別（共 3 項）/);
    assert.equal(await page.locator('#detailCall').getAttribute('href'),'tel:0212345678');
    assert.match(await page.locator('#detailGoogle').getAttribute('href'),/query=24.790549%2C120.926885/);
    await page.locator('#clinic-tab-thursday').click();await page.locator('.facility-open').nth(1).click();await page.locator('#detailContent').waitFor({state:'visible'});
    assert.equal(await page.locator('#clinic-tab-monday').getAttribute('aria-selected'),'true');
  }finally{await page.close();}
});
test('CARE detail fits desktop, tablet and narrow mobile with intact time strings and one scroll area',async()=>{
  for(const viewport of [{width:1440,height:1000},{width:1024,height:768},{width:820,height:1180},{width:390,height:844},{width:320,height:700}]){
    const page=await ready(viewport);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await open(page);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await page.locator('#facilityDetail').evaluate(el=>el.scrollWidth>el.clientWidth),false);
      assert.equal(await page.locator('.clinic-week-tabs').evaluate(el=>el.scrollWidth>el.clientWidth),false);
      assert.equal(await page.locator('.clinic-time').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).whiteSpace==='nowrap'&&n.scrollWidth<=n.clientWidth+1)),true);
      await page.screenshot({path:path.join(artifacts,`care-detail-${viewport.width}.png`),animations:'disabled'});
      const header=await page.locator('.detail-header').boundingBox(),footer=await page.locator('#detailActions').boundingBox();
      await page.locator('#detailScroll').evaluate(el=>el.scrollTop=el.scrollHeight);
      assert.deepEqual(await page.locator('.detail-header').boundingBox(),header);assert.deepEqual(await page.locator('#detailActions').boundingBox(),footer);
      assert.equal(await page.locator('#facilityDetail').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true);
      assert.deepEqual(errors,[]);
    }finally{await page.close();}
  }
});
test('missing data disables actions, no empty calendar or fabricated statuses, and safe text stays text',async()=>{
  const page=await ready();
  try{
    let mode='missing';
    await page.route('**/api/facilities/detail?*',route=>{
      const data=fixture(new URL(route.request().url()).searchParams.get('sourceId'));
      Object.assign(data,{name:'長名稱醫療財團法人'.repeat(8),phone:'---',latitude:null,longitude:null,address:'',departments:[],clinicHours:{status:mode,days:[]},notes:'<img src=x onerror=alert(1)>',source:''});
      return route.fulfill({json:data});
    });
    await open(page);assert.equal(await page.locator('.clinic-day').count(),0);
    assert.match(await page.locator('#detailContent').textContent(),/暫無診療時間資料/);
    assert.equal(await page.locator('#detailCall').getAttribute('aria-disabled'),'true');assert.equal(await page.locator('#detailCall').getAttribute('href'),null);
    assert.equal(await page.locator('#detailLocate').count(),0);assert.equal(await page.locator('#detailGoogle').isVisible(),false);
    assert.equal(await page.locator('#detailContent img').count(),0);assert.match(await page.locator('.detail-notes').textContent(),/<img/);
    assert.ok(!/營業中|設有急診|評價|undefined|null/.test(await page.locator('#facilityDetail').textContent()));
    mode='invalid';await page.locator('.facility-open').nth(1).click();await page.locator('#detailContent').waitFor({state:'visible'});
    assert.equal(await page.locator('.clinic-day').count(),0);assert.match(await page.locator('#detailContent').textContent(),/格式異常/);
  }finally{await page.close();}
});
