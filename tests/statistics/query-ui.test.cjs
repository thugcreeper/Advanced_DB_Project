const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.STATISTICS_BASE || 'http://127.0.0.1:18080';
const artifacts = path.resolve(__dirname, '../../docs/verification/artifacts/query-ui-2026-10-13');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined }); fs.mkdirSync(artifacts, { recursive: true }); });
after(async () => { await browser?.close(); });
async function ready(viewport = { width: 1440, height: 1000 }) {
  const page = await browser.newPage({ viewport });
  await page.goto(base + '/pages/query/index.html');
  await page.waitForFunction(() => document.getElementById('resultCount').textContent === '368');
  return page;
}
async function categories(page) {
  await page.locator('#advancedFilters > summary').click();
  await page.locator('[data-condition-group="categories"] > summary').click();
}
async function choose(page, id, name) {
  await page.locator('#' + id + 'Trigger').click();
  await page.locator('#' + id + 'Search').fill(name);
  await page.locator('#' + id + 'Popup').getByRole('option', { name, exact: true }).click();if(id==='specialty')await page.getByRole('button',{name:'關閉醫療科別選單',exact:true}).click();
}
test('initial page only shows basic criteria; advanced fields are collapsed', async () => {
  const page = await ready();
  try {
    assert.equal(await page.locator('#county').isVisible(), true);
    assert.equal(await page.locator('#districtCode').isVisible(), true);
    assert.equal(await page.locator('#minIncome').isVisible(), false);
    assert.equal(await page.locator('#scope').isVisible(), false);
    assert.equal(await page.locator('#sortField').isVisible(), true);
    assert.equal(await page.locator('#searchButton').isVisible(), true);
    await page.screenshot({ path: path.join(artifacts, 'desktop-default.png'), fullPage: true });
  } finally { await page.close(); }
});
test('all 45 specialties and 27 personnel appear exactly once in the requested group order', async () => {
  const page = await ready();
  try {
    await categories(page);
    for (const [id, labels, counts] of [['specialty', ['常用','牙醫','中醫','其他'], [16,11,8,10]], ['personnel', ['常用','牙醫','其他'], [12,2,13]]]) {
      await page.locator('#' + id + 'Trigger').click();
      const groups = await page.locator('#' + id + 'Popup .selector-category').evaluateAll(elements => elements.map(element => ({ label: element.querySelector('summary span').textContent, open: element.open, values: [...element.querySelectorAll('[role=option]')].map(option => option.dataset.value) })));
      assert.deepEqual(groups.map(group => group.label), labels);
      assert.deepEqual(groups.map(group => group.values.length), counts);
      assert.deepEqual(groups.map(group => group.open), labels.map((_, index) => index === 0));
      const values = groups.flatMap(group => group.values); assert.equal(new Set(values).size, counts.reduce((a,b) => a+b));
      const common = groups[0].values;
      for (const value of id === 'specialty' ? ['牙醫一般科','中醫一般科','西醫一般科'] : ['牙醫師']) assert.ok(common.includes(value));
      const collapsed = page.locator('#' + id + 'Popup .selector-category').nth(1);
      assert.equal(await collapsed.getByRole('option').first().isVisible(), false);
      await collapsed.locator('summary').click(); assert.equal(await collapsed.getByRole('option').first().isVisible(), true);
      await collapsed.locator('summary').click(); assert.equal(await collapsed.getByRole('option').first().isVisible(), false);
      await page.locator('#' + id + 'Search').press('Escape');
    }
    assert.equal(await page.locator('.selector-notice:not([hidden])').count(), 0);
  } finally { await page.close(); }
});
test('cross-category search restores expansion, preserves query results and submits exact API names', async () => {
  const page = await ready();
  try {
    await categories(page); await page.locator('#specialtyTrigger').click();
    await page.locator('#specialtySearch').fill('贋復');
    assert.equal(await page.locator('#resultCount').textContent(), '368');
    const dental = page.locator('#specialtyPopup .selector-category').nth(1);
    assert.equal(await dental.evaluate(element => element.open), true);
    await page.locator('#specialtySearch').fill('');
    assert.equal(await dental.evaluate(element => element.open), false);
    await page.locator('#specialtySearch').fill('贋復'); await page.locator('#specialtySearch').press('Enter');
    assert.deepEqual(JSON.parse(await page.locator('#specialty').inputValue()), ['贋復補綴牙科']);await page.getByRole('button',{name:'關閉醫療科別選單',exact:true}).click();
    assert.equal(await page.locator('#specialtyValue').textContent(), '已選 1 科');
    assert.equal(await page.locator('#specialtyPopup').isVisible(), false);
    assert.equal(await page.locator('#specialtyMin').isEnabled(), true);
  } finally { await page.close(); }
});
test('collapsing advanced criteria retains every field and exactly preserves request semantics', async () => {
  const page = await ready(); const bodies = [];
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/statistics/search')) bodies.push(request.postDataJSON()); });
  try {
    await page.selectOption('#county', '新竹市'); await page.waitForFunction(() => !document.getElementById('searchButton').disabled);
    await page.selectOption('#districtCode', '1205'); await categories(page);
    await page.fill('#minIncome', '1');
    await page.locator('[data-condition-group="population"] > summary').click();
    await page.fill('#populationMin', '79606'); await page.fill('#populationMax', '222219');
    await page.fill('#areaMin', '15.7267'); await page.fill('#areaMax', '54.8491');
    await page.locator('[data-condition-group="facilities"] > summary').click();
    await page.fill('#maxHospitals', '0'); await page.fill('#minClinics', '0');
    await choose(page, 'specialty', '內科'); await page.fill('#specialtyMin', '1');
    await choose(page, 'personnel', '護理師'); await page.fill('#personnelMin', '1');
    await page.selectOption('#scope', 'hospital'); await page.selectOption('#sortField', 'population'); await page.selectOption('#sortDirection', 'asc');
    await page.locator('#advancedFilters > summary').click();
    assert.match(await page.locator('#advancedCount').textContent(), /已設定 12 項/);
    const responsePromise=page.waitForResponse(r=>r.url().endsWith('/statistics/search')&&r.request().method()==='POST');await page.click('#searchButton');const result=await (await responsePromise).json();await page.waitForFunction(total=>document.getElementById('resultCount').textContent===String(total),result.total);assert.ok(result.districts.every(row=>row.personnel>0&&row.specialty>0));
    assert.deepEqual(bodies.at(-1), { county:'新竹市',districtCode:'1205',income:{min:1},population:{min:79606,max:222219},area:{min:15.7267,max:54.8491},hospitals:{max:0},clinics:{min:0},personnel:{category:'護理師',scope:'hospital',count:{min:1}},specialties:[{category:'內科',scope:'hospital',count:{min:1}}],specialtyMatch:'or',sort:[{field:'population',direction:'asc'}] });
    await page.locator('#advancedFilters > summary').click(); assert.equal(await page.locator('#personnel').inputValue(), '護理師');
  } finally { await page.close(); }
});
test('keyboard, escape, unlimited, clear and form reset work for both pickers', async () => {
  const page = await ready();
  try {
    await categories(page);
    await page.locator('#personnelTrigger').focus(); await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#personnelSearch').evaluate(element => element === document.activeElement), true);
    await page.keyboard.type('助產'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#personnel').inputValue(), '助產師');
    await page.locator('#personnelTrigger').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#personnelTrigger').evaluate(element => element === document.activeElement), true);
    await page.getByRole('button', { name:'清除醫事人員', exact:true }).click();
    assert.equal(await page.locator('#personnel').inputValue(), ''); assert.equal(await page.locator('#personnelMin').isDisabled(), true);
    await choose(page, 'personnel', '牙醫師'); await choose(page, 'specialty', '植牙科');
    await page.locator('#specialtyTrigger').click(); await page.getByRole('button', { name:'醫療科別不限', exact:true }).click();
    assert.equal(await page.locator('#specialty').inputValue(), '');
    await choose(page, 'specialty', '中醫內科'); await page.fill('#specialtyMin','1');
    await page.locator('#builderPane button[type=reset]').click();
    await page.waitForFunction(() => document.getElementById('resultCount').textContent === '368');
    assert.equal(await page.locator('#personnelValue').textContent(), '不限'); assert.equal(await page.locator('#specialtyValue').textContent(), '不限');
    assert.equal(await page.locator('#advancedCount').textContent(), '尚未設定條件');
  } finally { await page.close(); }
});
test('unknown API options are retained under fallback group and duplicates reported', async () => {
  const page = await browser.newPage();
  try {
    await page.route('**/statistics/options*', async route => {
      const response = await route.fetch(); const data = await response.json(); data.specialties.push('測試新增科別','內科');
      await route.fulfill({ response, json:data });
    });
    await page.goto(base + '/pages/query/index.html'); await page.waitForFunction(() => document.getElementById('resultCount').textContent === '368');
    await categories(page); await choose(page, 'specialty', '測試新增科別');
    assert.deepEqual(JSON.parse(await page.locator('#specialty').inputValue()), ['測試新增科別']);
    assert.match(await page.locator('#specialtyPicker .selector-notice').textContent(), /測試新增科別/);
    const values = await page.locator('#specialtyPopup .selector-category').last().locator('[role=option]').evaluateAll(options => options.map(option => option.dataset.value));
    assert.ok(values.includes('測試新增科別')); assert.equal(await page.locator('#specialtyPopup [data-value="內科"]').count(), 1);
  } finally { await page.close(); }
});
test('invalid criteria in collapsed groups are revealed instead of silently blocking submit', async () => {
  const page=await ready();
  try {
    await page.locator('#advancedFilters > summary').click();
    await page.locator('[data-condition-group="facilities"] > summary').click();
    await page.fill('#maxHospitals','-1');
    await page.locator('#advancedFilters > summary').click();
    await page.click('#searchButton');
    assert.equal(await page.locator('#advancedFilters').evaluate(element=>element.open),true);
    assert.equal(await page.locator('#maxHospitals').isVisible(),true);
    assert.equal(await page.locator('#maxHospitals').evaluate(element=>element.validity.valid),false);
    await page.locator('#queryModeLabel').filter({hasText:'請確認數值範圍。'}).waitFor();
  } finally { await page.close(); }
});
test('desktop/mobile popup remains within viewport with scrolling and no page errors', async () => {
  for (const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:700}]) {
    const page = await ready(viewport); const errors=[]; page.on('pageerror', error=>errors.push(error.message));
    try {
      await categories(page); await page.locator('#specialtyTrigger').click();
      const rect = await page.locator('#specialtyPopup').boundingBox();
      assert.ok(rect.x>=0 && rect.y>=0 && rect.x+rect.width<=viewport.width && rect.y+rect.height<=viewport.height);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('#specialtyPopup .selector-groups').evaluate(element => getComputedStyle(element).overflowY), 'auto');
      await page.screenshot({path:path.join(artifacts,`picker-${viewport.width}.png`),fullPage:true});
      await page.keyboard.press('Escape');
      if (viewport.width===390) { await page.locator('#advancedFilters > summary').click(); await page.screenshot({path:path.join(artifacts,'mobile-default.png'),fullPage:true}); }
      assert.deepEqual(errors,[]);
    } finally { await page.close(); }
  }
});
