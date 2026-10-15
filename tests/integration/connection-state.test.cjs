const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
let browser;
before(async () => { browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_EXECUTABLE}); });
after(async () => { await browser?.close(); });
async function fixture({down=false, status=200, code, viewport, slowApi=false, hang=false, networkOnce=false}={}) {
  const page = await browser.newPage({viewport:viewport||{width:1440,height:900}});
  const state={down, health:0, calls:0, status, code};
  await page.route('**/*', async route => {
    const url=new URL(route.request().url());
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><main><select id="county"><option selected>新竹市</option></select><div id="map">既有地圖與結果</div></main>'});
    if(url.pathname.startsWith('/shared/')){
      const name=path.basename(url.pathname);
      let body=fs.readFileSync(path.join(__dirname,'../../shared',name),'utf8');
      // Test-only time scaling; production values remain 4s / 5s / 90s.
      if(name==='api-connection.js')body=body.replace('90000','900').replace('4000);','40);').replace('Math.min(5000,','Math.min(50,').replace('[2000, 4000, 8000, 10000]','[20, 40, 80, 100]');
      return route.fulfill({contentType:name.endsWith('.css')?'text/css':'text/javascript',body});
    }
    if(url.pathname==='/api/health'){
      state.health++;
      if(state.down)return route.abort('connectionrefused');
      return route.fulfill({contentType:'application/json',body:'{"status":"UP"}'});
    }
    state.calls++;
    if(hang)return;
    if(networkOnce && state.calls===1)return route.abort('connectionrefused');
    if(slowApi)await new Promise(resolve=>setTimeout(resolve,200));
    if(state.status===0)return route.abort('connectionrefused');
    return route.fulfill({status:state.status,contentType:'application/json',body:JSON.stringify(state.code?{code:state.code,message:'error'}:{ok:true})});
  });
  await page.goto('http://frontend.test/');
  await page.evaluate(async()=>{window.api=await import('/shared/api-connection.js');});
  return {page,state};
}
test('normal load stays quiet; concurrent initial requests share one health check', async()=>{
  const {page,state}=await fixture();
  try{
    await page.evaluate(()=>Promise.all(Array.from({length:10},()=>api.apiRequest('/api/test'))));
    assert.equal(state.health,1);assert.equal(state.calls,10);
    assert.equal(await page.locator('.api-connection:visible').count(),0);
  }finally{await page.close();}
});
test('slow query on a healthy HTTP server does not claim startup',async()=>{
  const {page,state}=await fixture({slowApi:true});
  try{await page.evaluate(()=>api.apiRequest('/api/test'));assert.equal(state.health,1);assert.equal(await page.locator('.api-connection:visible').count(),0);}finally{await page.close();}
});
for(const width of [1440,390,320])test('waiting and recovery preserve selections/map at width '+width,async()=>{
  const {page,state}=await fixture({down:true,viewport:{width,height:844}});
  try{
    await page.evaluate(()=>{window.done=false;Promise.all([api.apiRequest('/api/one'),api.apiRequest('/api/two')]).then(()=>window.done=true);});
    await page.locator('.api-connection[data-state=checking]').waitFor();
    assert.match(await page.locator('[role=status]').textContent(),/可能/);
    assert.equal(state.calls,0);
    const box=await page.locator('.api-connection').boundingBox();assert.ok(box.width<=width && box.height<844/2);
    fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'artifacts/connection-'+width+'.png')});
    state.down=false;
    await page.waitForFunction(()=>window.done);
    assert.equal(state.calls,2);
    assert.equal(await page.locator('#county').inputValue(),'新竹市');
    assert.equal(await page.locator('#map').textContent(),'既有地圖與結果');
    assert.equal(await page.locator('.api-connection:visible').count(),0);
  }finally{await page.close();}
});
test('bounded outage stops polling; manual reconnect resumes the pending initial load',async()=>{
  const {page,state}=await fixture({down:true});
  try{
    await page.evaluate(()=>{window.done=false;api.apiRequest('/api/test').then(()=>window.done=true);});
    await page.locator('.api-connection[data-state=failed]').waitFor();
    const count=state.health;assert.ok(count<16);
    await page.waitForTimeout(250);assert.equal(state.health,count);
    state.down=false;await page.getByRole('button',{name:'重新連線'}).click();
    await page.waitForFunction(()=>window.done);assert.equal(state.calls,1);
  }finally{await page.close();}
});
for(const [status,code] of [[503,'DATABASE_UNAVAILABLE'],[500,'QUERY_FAILED'],[401,'AUTH'],[403,'READ_ONLY'],[400,'INVALID_FILTER']])test('application error '+status+'/'+code+' is not a cold start',async()=>{
  const {page,state}=await fixture({status,code});
  try{
    const error=await page.evaluate(()=>api.apiRequest('/api/test').catch(e=>e.message));
    assert.equal(state.health,1);assert.equal(state.calls,1);
    if(code==='DATABASE_UNAVAILABLE'||code==='QUERY_FAILED')assert.match(error,/資料服務異常/);
    assert.equal(await page.locator('.api-connection:visible').count(),0);
  }finally{await page.close();}
});
test('cancel all callers stops shared retry work',async()=>{
  const {page,state}=await fixture({down:true});
  try{
    await page.evaluate(()=>{window.ctrl=new AbortController();window.error='';api.apiRequest('/api/test',{signal:ctrl.signal}).catch(e=>window.error=e.name);});
    await page.locator('.api-connection[data-state=checking]').waitFor();
    await page.evaluate(()=>ctrl.abort());await page.waitForFunction(()=>window.error==='AbortError');
    const count=state.health;await page.waitForTimeout(150);assert.equal(state.health,count);assert.equal(state.calls,0);
  }finally{await page.close();}
});
test('POST network failure is never replayed',async()=>{
  const {page,state}=await fixture({status:0});
  try{
    await page.evaluate(()=>api.apiRequest('/api/write',{method:'POST',body:{value:1}}).catch(()=>{}));
    assert.equal(state.calls,1);assert.equal(state.health,1);
  }finally{await page.close();}
});

test('healthy server query timeout has a normal error and is not replayed',async()=>{
  const {page,state}=await fixture({hang:true});
  try{
    await page.clock.install();
    await Promise.all([page.waitForRequest('**/api/test'),page.evaluate(()=>{window.failure='';api.apiRequest('/api/test').catch(e=>window.failure=e.message);})]);
    await page.clock.fastForward(21000);
    await page.waitForFunction(()=>window.failure!== '');
    assert.equal(await page.evaluate(()=>window.failure),'查詢逾時，請稍後重試。');
    assert.equal(state.calls,1);assert.equal(state.health,2);
    assert.equal(await page.locator('.api-connection:visible').count(),0);
  }finally{await page.close();}
});
test('safe GET transport failure may be retried once after liveness confirmation',async()=>{
  const {page,state}=await fixture({networkOnce:true});
  try{
    const result=await page.evaluate(()=>api.apiRequest('/api/test'));
    assert.equal(result.ok,true);assert.equal(state.calls,2);assert.equal(state.health,2);
  }finally{await page.close();}
});
