const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
let browser,server,base;
before(async()=>{
  server=http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
    const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]||'text/plain';
    res.setHeader('Content-Type',type+'; charset=utf-8');res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server.close(resolve));});
async function setup(viewport={width:1440,height:1000}){
  const page=await browser.newPage({viewport});const requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const all=Array.from({length:30},(_,i)=>({sourceId:'id-'+i,name:i<2?'同名測試院所':`測試院所 ${i+1}`,type:'西醫診所',departments:i===2?[]:['內科','家庭醫學科']}));
  await page.route('https://advanced-db-project-s6bd.onrender.com/**',async route=>{
    const url=new URL(route.request().url());requests.push(url);let body;
    if(url.pathname==='/api/health')body={status:'UP'};
    else if(url.pathname==='/api/districts')body=[{name:'新竹市',districts:[{code:'1205',name:'香山區'},{code:'1201',name:'東區'}]},{name:'苗栗縣',districts:[{code:'3510',name:'銅鑼鄉'}]}];
    else if(url.pathname==='/api/facilities/departments')body=['內科','家庭醫學科'];
    else if(url.pathname==='/api/facilities/detail')body={...all.find(r=>r.sourceId===url.searchParams.get('sourceId')),address:'測試地址',phone:'',clinicHours:{status:'missing',days:[]}};
    else if(url.pathname==='/api/graph/facilities'){
      const start=Number(url.searchParams.get('offset'));body={county:'新竹市',districtCode:url.searchParams.get('districtCode'),district:'香山區',type:url.searchParams.get('type'),department:url.searchParams.get('department'),total:30,facilities:all.slice(start,start+12)};
    }else return route.fulfill({status:404,body:'unknown'});
    await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  });
  await page.goto(base+'/pages/graph/index.html');
  await page.locator('#county:not([disabled])').waitFor();await page.selectOption('#county','新竹市');await page.selectOption('#district','1205');
  return {page,requests,errors};
}
async function search(page){await page.click('#searchButton');await page.locator('#facilityList li').nth(11).waitFor();}
test('desktop graph: expansion, shared departments, opaque IDs, pagination and schema',async()=>{
  const {page,requests,errors}=await setup();try{
    await search(page);assert.equal(await page.locator('.node.facility').count(),12);
    await page.locator('.facility-expand').first().click();assert.equal(await page.locator('.node.department').count(),2);
    await page.locator('.facility-expand').nth(1).click();assert.equal(await page.locator('.node.department').count(),2);
    await page.locator('[data-node-id="d:內科"]').press('Enter');assert.match(await page.locator('#selectionText').textContent(),/目前已載入/);
    await page.locator('.node.facility').nth(1).click();await page.locator('#detailContent:not([hidden])').waitFor();
    assert.equal(requests.filter(u=>u.pathname.endsWith('/detail')).at(-1).searchParams.get('sourceId'),'id-1');
    await page.click('#detailClose');await page.click('#loadMore');await page.locator('#facilityList li').nth(23).waitFor();
    assert.equal(await page.locator('.node.facility').count(),24);assert.equal(requests.filter(u=>u.pathname==='/api/graph/facilities').at(-1).searchParams.get('offset'),'12');
    const before=await page.locator('#graph').getAttribute('viewBox');await page.click('#zoomIn');assert.notEqual(await page.locator('#graph').getAttribute('viewBox'),before);
    await page.click('#schemaButton');await page.locator('#schemaDialog[open] img').waitFor();await page.waitForFunction(()=>document.querySelector('#schemaDialog img').naturalWidth>0);
    fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.screenshot({path:path.join(__dirname,'artifacts/graph-schema.png')});await page.keyboard.press('Escape');
    await page.screenshot({path:path.join(__dirname,'artifacts/graph-desktop.png'),fullPage:true});assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
test('mobile: keyboard exploration, schema and no horizontal page overflow',async()=>{
  const {page,errors}=await setup({width:390,height:844});try{
    await search(page);await page.locator('.node.facility').first().press('Enter');await page.locator('#detailContent:not([hidden])').waitFor();await page.click('#detailClose');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.click('#schemaButton');assert.equal(await page.locator('#schemaDialog[open]').count(),1);await page.keyboard.press('Escape');
    await page.screenshot({path:path.join(__dirname,'artifacts/graph-mobile.png'),fullPage:true});assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
test('condition changes cancel stale loads and database failure preserves previous graph',async()=>{
  const {page,errors}=await setup();try{
    await search(page);
    await page.route('**/api/graph/facilities?**',route=>route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({code:'DATABASE_UNAVAILABLE',message:'資料服務異常'})}));
    await page.click('#loadMore');await page.locator('#retrySearch:not([hidden])').waitFor();
    assert.equal(await page.locator('.node.facility').count(),12);assert.match(await page.locator('#graphStatus').textContent(),/資料服務異常/);
    await page.selectOption('#district','1201');assert.equal(await page.locator('#loadMore:not([hidden])').count(),0);assert.match(await page.locator('#graphStatus').textContent(),/條件已變更/);assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('cancelled requests cannot replace an existing graph',async()=>{
  const {page}=await setup();try{
    await search(page);let release;const held=new Promise(resolve=>release=resolve);
    await page.route('**/api/graph/facilities?**',async route=>{await held;try{await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({total:0,facilities:[]})});}catch{}});
    await page.click('#loadMore');await page.locator('#cancelLoad:not([hidden])').waitFor();await page.click('#cancelLoad');release();
    await page.waitForTimeout(150);assert.equal(await page.locator('.node.facility').count(),12);assert.match(await page.locator('#graphStatus').textContent(),/已取消/);
  }finally{await page.close();}
});
test('actual Aura graph and detail through local backend',{skip:!process.env.GRAPH_BASE},async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.route('https://advanced-db-project-s6bd.onrender.com/**',async route=>{
      const u=new URL(route.request().url());const response=await fetch(process.env.GRAPH_BASE+u.pathname+u.search);
      await route.fulfill({status:response.status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:await response.text()});
    });
    await page.goto(base+'/pages/graph/index.html');await page.locator('#county:not([disabled])').waitFor();await page.selectOption('#county','新竹市');await page.selectOption('#district','1205');await search(page);
    await page.locator('.facility-expand:not([disabled])').first().click();assert.ok(await page.locator('.node.department').count()>0);
    await page.click('#fitGraph');await page.screenshot({path:path.join(__dirname,'artifacts/graph-aura-desktop.png'),fullPage:true});
    await page.locator('.facility-title').first().click();await page.locator('#detailContent:not([hidden])').waitFor();await page.click('#detailClose');
    await page.click('#loadMore');await page.locator('#facilityList li').nth(13).waitFor();assert.equal(await page.locator('#facilityList li').count(),14);
    await page.setViewportSize({width:390,height:844});await page.click('#fitGraph');await page.screenshot({path:path.join(__dirname,'artifacts/graph-aura-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
    await page.selectOption('#county','苗栗縣');await page.selectOption('#district','3510');await page.selectOption('#facilityType','hospital');await page.click('#searchButton');await page.locator('#queryFeedback[data-state="empty"]').waitFor();
    assert.match(await page.locator('#feedbackTitle').textContent(),/苗栗縣銅鑼鄉沒有符合條件的醫院/);
    await page.screenshot({path:path.join(__dirname,'artifacts/graph-aura-tongluo-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(__dirname,'artifacts/graph-aura-tongluo-desktop.png'),fullPage:true});
    await page.click('#showAllTypes');await page.locator('#queryFeedback[data-state="ready"]').waitFor({state:"attached"});assert.ok(await page.locator('.node.facility').count()>0);
    assert.equal(await page.locator('#district').inputValue(),'3510');

  }finally{await page.close();}
});

for(const viewport of [{width:1440,height:1000},{width:390,height:844}])test(`empty hospital result gives context and actionable recovery at ${viewport.width}px`,async()=>{
  const {page,errors}=await setup(viewport);try{
    await page.selectOption('#county','苗栗縣');await page.selectOption('#district','3510');await page.selectOption('#facilityType','hospital');
    await page.route('**/api/graph/facilities?**',route=>{
      const u=new URL(route.request().url());if(u.searchParams.get('type')!=='hospital')return route.fallback();
      return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({county:'苗栗縣',district:'銅鑼鄉',districtCode:'3510',type:'hospital',department:'',total:0,facilities:[]})});
    });
    await page.click('#searchButton');await page.locator('#queryFeedback[data-state="empty"]').waitFor();
    assert.match(await page.locator('#feedbackTitle').textContent(),/苗栗縣銅鑼鄉.*醫院/);
    assert.match(await page.locator('#emptyTitle').textContent(),/苗栗縣銅鑼鄉.*醫院/);
    assert.equal(await page.locator('#zoomIn').isDisabled(),true);assert.equal(await page.locator('#nodeSearch').isDisabled(),true);
    assert.equal(await page.locator('#graph').isVisible(),false);assert.match(await page.locator('#selectionTitle').textContent(),/沒有可選取/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(__dirname,`artifacts/graph-empty-${viewport.width}.png`),fullPage:true});
    await page.click('#showAllTypes');await page.locator('#queryFeedback[data-state="ready"]').waitFor({state:"attached"});
    assert.equal(await page.locator('#facilityType').inputValue(),'all');assert.equal(await page.locator('#county').inputValue(),'苗栗縣');assert.equal(await page.locator('#district').inputValue(),'3510');assert.equal(await page.locator('.node.facility').count(),12);assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
test('node search exposes no match and clear highlight restores readable graph',async()=>{
  const {page}=await setup();try{
    await search(page);await page.fill('#nodeSearch','完全不存在的名字');assert.match(await page.locator('#nodeSearchStatus').textContent(),/沒有符合名稱/);
    await page.click('#clearSelection');assert.equal(await page.locator('.node.dimmed').count(),0);assert.equal(await page.locator('#nodeSearch').inputValue(),'');
    await page.selectOption('#facilityType','hospital');assert.equal(await page.locator('#queryFeedback').getAttribute('data-state'),'stale');assert.match(await page.locator('#resultScope').textContent(),/新竹市香山區/);
  }finally{await page.close();}
});
test('empty department result can remove only department filter',async()=>{
  const {page}=await setup();try{
    await page.selectOption('#facilityType','clinic');await page.selectOption('#department','內科');
    await page.route('**/api/graph/facilities?**',route=>{
      const u=new URL(route.request().url());if(!u.searchParams.get('department'))return route.fallback();
      return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({county:'新竹市',district:'香山區',districtCode:'1205',type:'clinic',department:'內科',total:0,facilities:[]})});
    });
    await page.click('#searchButton');await page.locator('#queryFeedback[data-state="empty"]').waitFor();assert.match(await page.locator('#feedbackTitle').textContent(),/內科.*診所/);
    await page.click('#clearDepartment');await page.locator('#queryFeedback[data-state="ready"]').waitFor({state:"attached"});assert.equal(await page.locator('#department').inputValue(),'');assert.equal(await page.locator('#facilityType').inputValue(),'clinic');assert.equal(await page.locator('#district').inputValue(),'1205');
  }finally{await page.close();}
});
test('initial database failure is not presented as zero results',async()=>{
  const {page}=await setup();try{
    await page.route('**/api/graph/facilities?**',route=>route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({code:'DATABASE_UNAVAILABLE',message:'資料服務異常'})}));
    await page.click('#searchButton');await page.locator('#queryFeedback[data-state="error"]').waitFor();assert.match(await page.locator('#emptyText').textContent(),/不是沒有院所/);assert.equal(await page.locator('#showAllTypes').isVisible(),false);assert.equal(await page.locator('#retrySearch').isVisible(),true);
  }finally{await page.close();}
});

for(const viewport of [{width:1440,height:1000},{width:390,height:844}])test(`snackbar stays viewport-visible without scrolling and hides after 3 seconds at ${viewport.width}px`,async()=>{
  const {page}=await setup(viewport);try{
    await search(page);await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
    await page.evaluate(async()=>{const {showSnackbar}=await import('/shared/snackbar.js');showSnackbar('測試可見提示');});
    const toast=page.locator('.snackbar');assert.equal(await toast.isVisible(),true);
    const box=await toast.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=viewport.height);assert.ok(box.x>=0&&box.x+box.width<=viewport.width+1);
    assert.ok(await toast.evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=16));
    await page.waitForTimeout(2600);assert.equal(await toast.isVisible(),true);await page.waitForTimeout(550);assert.equal(await toast.isVisible(),false);
  }finally{await page.close();}
});
test('district empty result gets viewport snackbar and safe persistent explanation',async()=>{
  const {page}=await setup({width:390,height:844});try{
    await page.route('**/api/facilities?**',route=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({county:'苗栗縣',district:'銅鑼鄉',districtCode:'3510',type:'hospital',department:'',total:0,facilities:[],unlocatedCount:0,unassignedTotal:0})}));
    await page.goto(base+'/pages/district/index.html');await page.locator('#county:not([disabled])').waitFor();await page.selectOption('#county','苗栗縣');await page.selectOption('#district','3510');await page.selectOption('#facilityType','hospital');await page.click('#searchButton');
    await page.locator('.snackbar:not([hidden])').waitFor();assert.match(await page.locator('.snackbar').textContent(),/銅鑼鄉.*醫院/);assert.match(await page.locator('#searchStatus').textContent(),/沒有符合條件/);
  }finally{await page.close();}
});
test('statistics and Cypher empty/error/copy feedback is visible; data page stays usable',{skip:!process.env.GRAPH_BASE},async()=>{
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.route('https://advanced-db-project-s6bd.onrender.com/**',async route=>{
      const u=new URL(route.request().url());let body;
      if(u.pathname==='/api/districts/statistics/search')body={total:0,districts:[],scope:'all'};
      else if(u.pathname==='/api/cypher/query')body={columns:['結果'],rows:[],rowCount:0,truncated:false};
      else {const r=await fetch(process.env.GRAPH_BASE+u.pathname+u.search);body=await r.json();}
      await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
    });
    await page.goto(base+'/pages/query/index.html');await page.locator('.snackbar:not([hidden])').waitFor();assert.match(await page.locator('.snackbar').textContent(),/沒有符合條件的行政區/);
    await page.click('#cypherTab');await page.click('#executeCypher');await page.waitForFunction(()=>document.querySelector('.snackbar')?.textContent.includes('沒有符合的資料'));
    await page.fill('#cypherInput','');await page.click('#executeCypher');await page.waitForFunction(()=>document.querySelector('.snackbar')?.textContent.includes('請輸入 Cypher'));
    await page.goto(base+'/pages/data/index.html');assert.ok(await page.locator('#sourceRows tr').count()>0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.click('#aboutButton');await page.locator('#aboutDialog[open]').waitFor();await page.keyboard.press('Escape');assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(__dirname,'artifacts/ux-data-mobile.png'),fullPage:true});
  }finally{await page.close();}
});

test('department options retry preserves selected area',async()=>{
  const {page}=await setup();let attempts=0;try{
    await page.route('**/api/facilities/departments',route=>{attempts++;return route.fulfill({status:attempts===1?503:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(attempts===1?{code:'DATABASE_UNAVAILABLE',message:'資料服務異常'}:['內科'])});});
    await page.goto(base+'/pages/district/index.html');await page.locator('#county:not([disabled])').waitFor();await page.selectOption('#county','苗栗縣');await page.selectOption('#district','3510');
    await page.getByRole('button',{name:'重新載入科別',exact:true}).click();await page.locator('#facilityDepartment:not([disabled])').waitFor();assert.equal(await page.locator('#county').inputValue(),'苗栗縣');assert.equal(await page.locator('#district').inputValue(),'3510');assert.equal(attempts,2);
  }finally{await page.close();}
});
test('statistics option failure has a retry path',{skip:!process.env.GRAPH_BASE},async()=>{
  const page=await browser.newPage();let attempts=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    const r=await fetch(process.env.GRAPH_BASE+'/api/districts/statistics/options');const options=await r.json();
    await page.route('https://advanced-db-project-s6bd.onrender.com/**',async route=>{
      const u=new URL(route.request().url());let body={status:'UP'},status=200;
      if(u.pathname==='/api/districts/statistics/options'){attempts++;status=attempts===1?503:200;body=attempts===1?{code:'DATABASE_UNAVAILABLE',message:'資料服務異常'}:options;}
      else if(u.pathname==='/api/districts/statistics/search')body={total:0,districts:[],scope:'all'};
      await route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
    });
    await page.goto(base+'/pages/query/index.html');await page.getByRole('button',{name:'重新載入篩選選項',exact:true}).click();await page.locator('#searchButton:not([disabled])').waitFor();assert.equal(attempts,2);assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
