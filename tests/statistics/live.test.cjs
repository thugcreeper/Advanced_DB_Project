const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.STATISTICS_BASE || 'http://127.0.0.1:18080';
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined }); });
after(async () => { await browser?.close(); });
async function search(body) {
  const response = await fetch(base + '/api/districts/statistics/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
test('doctor category totals and per-population rates are internally consistent', async () => {
  const doctors = await search({sort:[{field:'westernDoctorRate',direction:'desc'}]});
  assert.equal(doctors.total,368); assert.equal(new Set(doctors.districts.map(row=>row.code)).size,368);
  for(const row of doctors.districts) {
    for(const category of ['WesternDoctors','ChineseDoctors','Dentists']) {
      const total=category[0].toLowerCase()+category.slice(1);
      assert.equal(row[total],row['hospital'+category]+row['clinic'+category]);
    }
    assert.equal(row.doctors,row.westernDoctors+row.chineseDoctors+row.dentists);
    assert.equal(row.westernDoctorRate,row.population>0 ? Math.round(10000*row.westernDoctors/row.population*100)/100 : null);
  }
});
test('production options contain real bounds and database categories', async () => {
  const response = await fetch(base + '/api/districts/statistics/options'); assert.equal(response.status,200);
  const data = await response.json();
  assert.deepEqual(data.bounds.population,{min:593,max:549762}); assert.deepEqual(data.bounds.area,{min:0.8803,max:1641.8555});
  assert.ok(data.personnel.includes('護理師')); assert.ok(data.specialties.includes('內科')); assert.equal(data.counties.length,22);
});
test('real page searches all Hsinchu districts, exports CSV and fits desktop/mobile', async () => {
  const page = await browser.newPage({ viewport:{width:1440,height:1000}, acceptDownloads:true });
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(base+'/pages/query/index.html');
    await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
    await page.selectOption('#county','新竹市');
    await page.waitForFunction(()=>!document.getElementById('searchButton').disabled);
    await page.locator('#advancedFilters > summary').click();
    await page.fill('#minIncome','100'); await page.click('#searchButton');
    await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='3');
    const names = await page.locator('#resultRows tr td:nth-child(2)').allTextContents();
    assert.deepEqual([...names].sort(),['新竹市北區','新竹市東區','新竹市香山區'].sort());
    const downloadPromise=page.waitForEvent('download'); await page.click('#downloadCsv');
    const download=await downloadPromise; const csv=fs.readFileSync(await download.path(),'utf8');
    for (const name of names) assert.ok(csv.includes(name)); assert.ok(csv.includes('所得年度')); assert.ok(csv.includes('114'));
    assert.ok(csv.includes('西醫師合計')); assert.ok(csv.includes('每萬人口西醫師數')); assert.ok(csv.includes('中醫師合計')); assert.ok(csv.includes('牙醫師合計'));
    const directory=path.resolve(__dirname,'../../docs/verification/artifacts/query-ui-2026-10-13'); fs.mkdirSync(directory,{recursive:true});
    await page.screenshot({path:path.join(directory,'desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    await page.screenshot({path:path.join(directory,'mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
  } finally { await page.close(); }
});
test('table and CSV still work if the map library fails to load', async () => {
  const page=await browser.newPage();
  try {
    await page.route('**/leaflet.js',route=>route.abort()); await page.goto(base+'/pages/query/index.html');
    await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
    assert.equal(await page.locator('#downloadCsv').isEnabled(),true);
  } finally { await page.close(); }
});
test('failed requests clear previous results and show an error, not empty results', async () => {
  const page=await browser.newPage();
  try {
    await page.goto(base+'/pages/query/index.html'); await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
    await page.route('**/statistics/search',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'TEST_DATABASE_FAILURE'})}));
    await page.click('#searchButton'); await page.getByText('TEST_DATABASE_FAILURE').waitFor();
    assert.equal(await page.locator('#resultRows tr').count(),0); assert.equal(await page.locator('#downloadCsv').isDisabled(),true);
    assert.equal(await page.locator('#resultsEmpty').isVisible(),false);
  } finally { await page.close(); }
});
test('late response cannot overwrite the newest query', async () => {
  const page=await browser.newPage();
  try {
    await page.goto(base+'/pages/query/index.html'); await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
    let count=0;
    await page.route('**/statistics/search',async route=>{
      count++; const current=count; if(current===1) await new Promise(resolve=>setTimeout(resolve,400));
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({total:1,districts:[{county:'測試',name:current===1?'舊結果':'新結果',averageIncome:100,hospitalCount:0,clinicCount:0}]})}).catch(()=>{});
    });
    await page.click('#searchButton'); await page.waitForFunction(()=>document.getElementById('builderPane').getAttribute('aria-busy')==='true');
    await page.click('#searchButton'); await page.getByText('測試新結果',{exact:true}).waitFor();
    await new Promise(resolve=>setTimeout(resolve,500)); assert.equal(await page.getByText('測試舊結果',{exact:true}).count(),0);
  } finally { await page.close(); }
});
test('timeout has a visible message and clears rows', async () => {
  const page=await browser.newPage();
  try {
    await page.goto(base+'/pages/query/index.html'); await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
    await page.clock.install();
    await page.route('**/statistics/search',()=>{});
    await page.click('#searchButton');
    await page.clock.fastForward(21000);
    await page.getByText('查詢逾時，請稍後重試。',{exact:true}).waitFor();
    assert.equal(await page.locator('#resultRows tr').count(),0);
  } finally { await page.close(); }
});
test('current server-side filters reset and do not retain county or income', async () => {
  const page=await browser.newPage();
  try {
    await page.goto(base+'/pages/query/index.html'); await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
    await page.selectOption('#county','新竹市'); await page.waitForFunction(()=>!document.getElementById('searchButton').disabled);
    await page.locator('#advancedFilters > summary').click();
    await page.fill('#minIncome','1500'); await page.click('#searchButton');
    await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='1');
    await page.locator('#builderPane button[type="reset"]').click();
    await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
    assert.equal(await page.locator('#county').inputValue(),''); assert.equal(await page.locator('#minIncome').inputValue(),'');
  } finally { await page.close(); }
});
