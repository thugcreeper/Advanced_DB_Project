const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.CYPHER_BASE || 'http://127.0.0.1:18082';
let browser;
before(async () => { await require('./ready.cjs')(base); browser = await chromium.launch({ headless:true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined }); });
after(async () => { await browser?.close(); });
async function ready(viewport={width:1440,height:1000}) {
  const page = await browser.newPage({viewport});
  await page.goto(base+'/pages/query/index.html'); await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
  await page.click('#cypherTab'); return page;
}
test('example selection is editable and never executes automatically', async () => {
  const page = await ready(); let requests=0;
  page.on('request',r=>{ if(r.url().endsWith('/api/cypher/query')) requests++; });
  try {
    assert.equal(await page.locator('#exampleQuery option').count(),9);
    const titles=await page.locator('#exampleQuery option').allTextContents(); assert.ok(titles.every(t=>!/[，,?？]/.test(t)));
    await page.selectOption('#exampleQuery','large-many'); assert.match(await page.locator('#exampleDescription').textContent(),/前 20%/);
    assert.equal(requests,0);
    await page.fill('#cypherInput','RETURN 42 AS answer'); await page.click('#executeCypher');
    await page.waitForFunction(()=>document.getElementById('cypherStatus').textContent.includes('查詢完成'));
    assert.equal(await page.locator('#cypherRows td').last().textContent(),'42'); assert.equal(requests,1);
    assert.equal(await page.locator('#cypherInput').inputValue(),'RETURN 42 AS answer');
  } finally { await page.close(); }
});
test('success, empty and error clear stale rows and CSV exports actual values', async () => {
  const page=await ready();
  try {
    await page.fill('#cypherInput',"RETURN 'a,b\"c' AS text, 'line1\\nline2' AS newline"); await page.click('#executeCypher');
    await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='1');
    const promise=page.waitForEvent('download'); await page.click('#downloadCypherCsv'); const download=await promise;
    const content=fs.readFileSync(await download.path(),'utf8'); assert.equal(content.charCodeAt(0),0xFEFF); assert.ok(content.includes('"a,b""c"')); assert.ok(content.includes('"line1\nline2"'));
    await page.fill('#cypherInput','UNWIND [] AS n RETURN n'); await page.click('#executeCypher');
    await page.waitForFunction(()=>document.getElementById('cypherStatus').textContent.includes('查詢完成'));
    assert.equal(await page.locator('#resultsEmpty').isVisible(),true); assert.equal(await page.locator('#downloadCypherCsv').isDisabled(),true);
    await page.fill('#cypherInput','INVALID QUERY'); await page.click('#executeCypher');
    await page.waitForFunction(()=>document.getElementById('cypherStatus').getAttribute('role')==='alert');
    assert.equal(await page.locator('#cypherRows tr').count(),0);
    await page.click('#builderTab'); await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
    assert.equal(await page.locator('#cypherTable').isVisible(),false); assert.equal(await page.locator('#statisticsHead').isVisible(),true);
  } finally { await page.close(); }
});
test('loading prevents duplicate requests and late response cannot replace changed query', async () => {
  const page=await ready(); let calls=0;
  await page.route('**/api/cypher/query',async route=>{ calls++; await new Promise(resolve=>setTimeout(resolve,500)); await route.fulfill({json:{columns:['answer'],rows:[[42]],rowCount:1,truncated:false}}); });
  try {
    await page.click('#executeCypher'); assert.equal(await page.locator('#executeCypher').isDisabled(),true);
    await page.fill('#cypherInput','RETURN 99 AS answer'); await page.waitForTimeout(700);
    assert.equal(calls,1); assert.equal(await page.locator('#cypherRows tr').count(),0);
  } finally { await page.close(); }
});
test('district results load real facilities and unmappable rows retain table', async () => {
  const page=await ready();
  try {
    await page.fill('#cypherInput',"RETURN '臺北市大安區' AS 行政區, '63000030' AS 行政區碼"); await page.click('#executeCypher');
    await page.waitForFunction(()=>!document.getElementById('mapDistrict').disabled);
    await page.waitForFunction(()=>document.getElementById('mapStatus').textContent.includes('實際院所位置') || document.getElementById('mapStatus').textContent.includes('暫時無法'));
    assert.equal(await page.locator('#cypherRows tr').count(),1);
    await page.selectOption('#exampleQuery','large-many'); await page.click('#executeCypher');
    await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='3');
    await page.waitForFunction(()=>!document.getElementById('mapStatus').textContent.includes('載入所選'));
    fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'artifacts/cypher-results-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(__dirname,'artifacts/cypher-results-mobile.png'),fullPage:true});
    await page.fill('#cypherInput','RETURN 1 AS arbitrary'); await page.click('#executeCypher');
    await page.waitForFunction(()=>document.getElementById('cypherStatus').textContent.includes('查詢完成'));
    assert.equal(await page.locator('#cypherRows tr').count(),1);
  } finally { await page.close(); }
});
test('desktop and mobile Cypher layouts have no overflow or page errors',async()=>{
  fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
  for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:700}]) {
    const page=await ready(viewport); const errors=[];page.on('pageerror',error=>errors.push(error.message));
    try {
      await page.selectOption('#exampleQuery','sparse-low');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(__dirname,`artifacts/cypher-${viewport.width}.png`),fullPage:true});
      assert.deepEqual(errors,[]);
    } finally {await page.close();}
  }
});
