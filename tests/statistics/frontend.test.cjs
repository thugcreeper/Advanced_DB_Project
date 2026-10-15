const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const moduleUrl = (file) => 'data:text/javascript;base64,' + fs.readFileSync(path.join(root, 'pages/query', file)).toString('base64');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined }); });
after(async () => { await browser?.close(); });

const fixtures = [
  { county: 'A', name: 'East', averageIncome: 100, hospitalCount: 0, clinicCount: 2 },
  { county: 'A', name: 'West', averageIncome: 200, hospitalCount: 1, clinicCount: 5 },
  { county: 'B', name: 'East', averageIncome: 10, hospitalCount: 0, clinicCount: 1 },
  { county: 'A', name: 'Missing', averageIncome: null, hospitalCount: 0, clinicCount: 0 },
];
async function results(rows, sort = false, csv = false) {
  const page = await browser.newPage();
  try {
    await page.setContent('<table><thead><tr><th><button data-sort="averageIncome" id="sort">Income</button></th></tr></thead><tbody id="body"></tbody></table><span id="count"></span><p id="empty"></p><button id="download">CSV</button>');
    return await page.evaluate(async ({ url, rows, sort, csv }) => {
      const { initializeResults } = await import(url);
      let captured;
      URL.createObjectURL = blob => { captured = blob; return 'blob:test'; };
      HTMLAnchorElement.prototype.click = function () {};
      const api = initializeResults({ body: document.getElementById('body'), count: document.getElementById('count'), empty: document.getElementById('empty'), download: document.getElementById('download'), sortButtons: [document.getElementById('sort')], onSort: () => {} });
      api.update(rows);
      if (sort) document.getElementById('sort').click();
      if (csv) document.getElementById('download').click();
      return { cells: [...document.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(td => td.textContent)), count: document.getElementById('count').textContent, empty: !document.getElementById('empty').hidden, disabled: document.getElementById('download').disabled, csv: captured ? await captured.text() : null };
    }, { url: moduleUrl('results.js'), rows, sort, csv });
  } finally { await page.close(); }
}
test('numeric sort uses 10, 100, 200 rather than string order', async () => {
  assert.deepEqual((await results(fixtures.slice(0, 3), true)).cells.map(row => row[2]), ['10', '100', '200']);
});
test('empty results have a visible message and disabled export', async () => {
  const state = await results([]); assert.equal(state.count, '0'); assert.equal(state.empty, true); assert.equal(state.disabled, true);
});
test('missing income must not display as numeric zero', async () => { assert.notEqual((await results([fixtures[3]])).cells[0][2], '0'); });
test('CSV exports only supplied results with quote/comma/newline escaping, without coordinates', async () => {
  const row = { ...fixtures[0], county: '', name: 'A,"B"\nC' };
  const state = await results([row], false, true);
  assert.equal(state.count, '1');
  assert.ok(state.csv.endsWith('"A,""B""\nC","100","0","2"'));
  assert.equal(state.csv.split('"100","0","2"').length, 2);
});
for (const prefix of ['=', '+', '-', '@']) {
  test('CSV neutralizes formula-leading ' + prefix, async () => {
    const state = await results([{ ...fixtures[0], county: '', name: prefix + '1+1' }], false, true);
    const field = state.csv.split('\r\n')[1].split(',')[0];
    assert.ok(!/^[=+\-@]/.test(field.slice(1)), 'quoted CSV text still starts with a spreadsheet formula trigger');
  });
}
