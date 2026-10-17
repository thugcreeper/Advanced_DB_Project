const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { originals, columns, orders } = require('./core-contract.cjs');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'pages/query/examples.js'), 'utf8');
const load = () => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('exactly nine examples retain the user titles, Cypher, RETURN order and sorting', async () => {
  const { examples } = await load();
  assert.equal(examples.length, 9); assert.equal(new Set(examples.map(x => x.id)).size, 9);
  examples.forEach((example, index) => {
    assert.equal(example.label, index === 1 ? '低收入地區的醫療資源如何' : originals[index].label);
    assert.equal(example.query, originals[index].query);
    assert.doesNotMatch(example.query, /\bCALL\b|\bUNWIND\b|\bcollect\s*\(/i);
    const returned = example.query.slice(example.query.lastIndexOf('RETURN') + 6, example.query.lastIndexOf('ORDER BY'));
    const names = returned.match(/AS\s+[^\s,]+|(?<=,)\s*醫事人員總數\s*(?=,)|(?<=,)\s*(?:院所數|人員數|醫院數|診所數|醫事人員數|醫師數)\s*(?=,|$)/g)
      .map(x => x.replace(/^AS\s+/, '').trim());
    assert.deepEqual(names, columns[index]);
    assert.ok(example.query.endsWith('ORDER BY ' + orders[index] + ';'));
  });
});

test('descriptions distinguish observations, missing data and unconfirmed personnel years', async () => {
  const { examples } = await load();
  for (const index of [2, 6, 8]) assert.match(examples[index].description, /缺失.*暫計 0.*核對原始資料/);
  assert.match(examples[7].description, /所得可為空.*完全沒有三類醫師人力紀錄.*不納入/);
  for (const index of [3, 7]) assert.match(examples[index].years, /RECORD_PERSONNEL 年度屬性尚未確認/);
  for (const threshold of ['107.59', '95', '2,943.36', '143.19', '583', '4.55']) assert.ok(examples.some(x => x.threshold.includes(threshold)));
  assert.match(examples[1].threshold, /第 20 百分位門檻/);
  assert.match(examples[5].threshold, /第 80 百分位門檻/);
});

test('editor loads all nine exact queries without execution, remains editable and submits explicitly', async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined});
  const page = await browser.newPage();
  try {
    await page.route('http://editor.test/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><form id="form"><select id="examples"></select><div id="description"></div><textarea id="input"></textarea><button type="submit">執行查詢</button><button id="copy" type="button">複製</button><button id="clear" type="button">清除</button><p id="status"></p></form><script type="module">
      import { initializeEditor } from '/pages/query/editor.js';
      const get = id => document.getElementById(id);
      document.body.dataset.calls = '0';
      initializeEditor({input:get('input'),form:get('form'),exampleSelect:get('examples'),description:get('description'),status:get('status'),copyButton:get('copy'),clearButton:get('clear'),onExecute:async query => {document.body.dataset.calls=String(Number(document.body.dataset.calls)+1);document.body.dataset.query=query;return {rowCount:1,truncated:false};}});
      </script>`});
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({status:404,body:''});
      return route.fulfill({contentType: file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8', body:fs.readFileSync(file)});
    });
    await page.goto('http://editor.test/');
    await page.waitForFunction(() => document.querySelectorAll('#examples option').length === 9);
    const { examples } = await load();
    for (const example of examples) {
      await page.selectOption('#examples', example.id);
      assert.equal(await page.inputValue('#input'), example.query);
      assert.match(await page.textContent('#description'), /不直接等同就醫可近性/);
      assert.doesNotMatch(await page.textContent('#description'), /於結果註記/);
    }
    assert.equal(await page.locator('body').getAttribute('data-calls'), '0');
    await page.fill('#input', 'RETURN 42 AS answer');
    await page.click('[type=submit]');
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('查詢完成'));
    assert.equal(await page.locator('body').getAttribute('data-query'), 'RETURN 42 AS answer');
    assert.equal(await page.locator('body').getAttribute('data-calls'), '1');
    await page.click('#clear'); assert.equal(await page.inputValue('#input'), '');
  } finally { await browser.close(); }
});
