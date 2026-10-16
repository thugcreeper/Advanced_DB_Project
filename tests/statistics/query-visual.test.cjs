const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.STATISTICS_BASE || 'http://127.0.0.1:18080';
const directory = path.resolve(__dirname, '../../docs/verification/artifacts/query-visual-2026-10-13');
let browser;
before(async () => { browser = await chromium.launch({ headless:true, executablePath:process.env.PLAYWRIGHT_EXECUTABLE || undefined }); fs.mkdirSync(directory,{recursive:true}); });
after(async () => { await browser?.close(); });
test('default, expanded and picker layout is aligned and non-overflowing on desktop and narrow screens', async () => {
  for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:700}]) {
    const page = await browser.newPage({viewport}); const errors=[]; const failedAssets=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.url().includes('/shared/vendor/lucide/') && response.status()>=400) failedAssets.push(response.url());});
    try {
      await page.goto(base+'/pages/query/index.html'); await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
      assert.equal(await page.locator('#basicTitle').textContent(),'基本條件'); assert.equal(await page.locator('#sortTitle').textContent(),'結果排序');
      const basic = await page.locator('.basic-filter-fields').boundingBox();
      const county = await page.locator('#county').boundingBox(); const district = await page.locator('#districtCode').boundingBox();
      const sort = await page.locator('#sortField').boundingBox(); const direction = await page.locator('#sortDirection').boundingBox();
      for(const box of [county,district,sort,direction]) assert.ok(box.height>=55);
      if(viewport.width>600) { assert.equal(county.y,district.y); assert.equal(sort.y,direction.y); assert.ok(county.width+district.width>basic.width*.9); }
      else { assert.ok(district.y>county.y); assert.ok(direction.y>sort.y); }
      assert.ok(sort.y>district.y+district.height);
      assert.equal(await page.locator('#advancedFilters .disclosure-chevron').count(),0);
      for(const icon of await page.locator('#builderPane svg.ui-icon').all()) {
        if(!await icon.isVisible()) continue;
        assert.equal(await icon.getAttribute('width'),'18'); assert.equal(await icon.getAttribute('height'),'18');
        const box=await icon.boundingBox(); assert.ok(box.width<=20 && box.height<=20);
      }
      assert.equal(await page.locator('#advancedFilters > summary').evaluate(element=>getComputedStyle(element).listStyleType),'none');
      await page.screenshot({path:path.join(directory,`default-${viewport.width}.png`),fullPage:true,animations:'disabled'});
      await page.locator('#advancedFilters > summary').click();
      assert.equal(await page.locator('#advancedFilters > summary .when-open').isVisible(),true);
      for(const group of await page.locator('.filter-group').all()) await group.evaluate(element=>{element.open=true;});
      assert.equal(await page.locator('#minIncome').isVisible(),true); assert.equal(await page.locator('#populationMin').isVisible(),true);
      assert.equal(await page.locator('#maxHospitals').isVisible(),true); assert.equal(await page.locator('#personnelTrigger').isVisible(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(directory,`expanded-${viewport.width}.png`),fullPage:true,animations:'disabled'});
      await page.locator('#specialtyTrigger').click();
      for(const summary of await page.locator('#specialtyPopup .selector-category summary').all()) {
        assert.equal(await summary.evaluate(element=>getComputedStyle(element).listStyleType),'none');
        assert.equal(await summary.locator('svg').count(),0);
      }
      const popup=await page.locator('#specialtyPopup').boundingBox();
      assert.ok(popup.x>=0 && popup.y>=0 && popup.x+popup.width<=viewport.width && popup.y+popup.height<=viewport.height);
      await page.screenshot({path:path.join(directory,`picker-${viewport.width}.png`),fullPage:true,animations:'disabled'});
      assert.deepEqual(errors,[]); assert.deepEqual(failedAssets,[]);
    } finally { await page.close(); }
  }
});


test('icons remain bounded and native disclosure markers stay absent when page CSS fails', async()=>{
  const page=await browser.newPage({viewport:{width:1918,height:970}});
  try {
    await page.route('**/pages/query/styles.css*',route=>route.abort());
    await page.goto(base+'/pages/query/index.html');
    await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
    for(const icon of await page.locator('#builderPane svg.ui-icon').all()) {
      if(!await icon.isVisible()) continue;
      const rect=await icon.boundingBox(); assert.ok(rect.width<=20 && rect.height<=20);
    }
    for(const summary of await page.locator('#builderPane summary').all()) {
      assert.equal(await summary.evaluate(e=>getComputedStyle(e).listStyleType),'none');
    }
    await page.screenshot({path:path.join(directory,'css-failure-safe.png'),fullPage:true});
  } finally {await page.close();}
});
test('scope remains editable and retains its value when personnel is cleared', async()=>{
  const page=await browser.newPage();
  try {
    await page.goto(base+'/pages/query/index.html'); await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
    await page.locator('#advancedFilters > summary').click(); await page.locator('[data-condition-group="categories"] > summary').click();
    assert.equal(await page.locator('#scope').isDisabled(),false);
    await page.locator('#personnelTrigger').click(); await page.locator('#personnelSearch').fill('護理師');
    await page.locator('#personnelPopup').getByRole('option',{name:'護理師',exact:true}).click();
    assert.equal(await page.locator('#scope').isEnabled(),true);
    assert.equal(await page.locator('#queryModeLabel').getAttribute('role'),'status');
    await page.selectOption('#scope','hospital');
    await page.getByRole('button',{name:'清除醫事人員',exact:true}).click();
    assert.equal(await page.locator('#scope').isDisabled(),false);
    assert.equal(await page.locator('#scope').inputValue(),'hospital');
    assert.equal(await page.locator('#advancedCount').textContent(),'已設定 1 項條件');
    await page.selectOption('#scope','all');
    assert.equal(await page.locator('#advancedCount').textContent(),'尚未設定條件');
    await page.click('#searchButton'); await page.waitForFunction(()=>document.getElementById('resultCount').textContent==='368');
    assert.match(await page.locator('#queryModeLabel').textContent(),/醫院＋診所/);
  } finally {await page.close();}
});
