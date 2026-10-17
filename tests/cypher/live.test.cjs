const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.CYPHER_BASE || 'http://127.0.0.1:18080';
let examples;
const { columns } = require('./core-contract.cjs');
before(async () => {
  await require('./ready.cjs')(base);
  const source = fs.readFileSync(path.resolve(__dirname, '../../pages/query/examples.js'), 'utf8');
  examples = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).examples;
});
async function query(query, parameters = {}) {
  const response = await fetch(base + '/api/cypher/query', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ query, parameters }) });
  return { status: response.status, data: await response.json() };
}
test('nine user core examples execute with the exact requested columns', async () => {
  const records = [];
  for (const [index, example] of examples.entries()) {
    const { status, data } = await query(example.query);
    assert.equal(status, 200, example.label + ': ' + JSON.stringify(data));
    assert.equal(data.truncated, false); assert.deepEqual(data.columns, columns[index]);
    const objectRows = data.rows.map(row => Object.fromEntries(data.columns.map((column, i) => [column,row[i]])));
    records.push({ number: index + 1, label: example.label, count: data.rowCount, rows: objectRows });
  }
  fs.mkdirSync(path.join(__dirname,'artifacts'), { recursive:true });
  fs.writeFileSync(path.join(__dirname,'artifacts/examples.json'), JSON.stringify(records,null,2));
  for(const record of records) {
    assert.equal(record.count,record.rows.length);
  }
  console.log(JSON.stringify(records.map(({ number,count })=>({ number,count }))));
});
test('parameterized custom query and read procedure execute', async () => {
  const result = await query('WITH $text AS text RETURN text, [1,2] AS list', { text: '可編輯查詢' });
  assert.equal(result.status,200); assert.deepEqual(result.data.rows,[['可編輯查詢',[1,2]]]);
  assert.equal((await query('CALL db.labels() YIELD label RETURN label')).status,200);
});
test('EXPLAIN rejects writes before any execution and schema stays unchanged', async () => {
  const fingerprint = 'MATCH (n) RETURN count(n) AS nodes';
  const before = await query(fingerprint);
  for (const text of ['CREATE (:CypherWriteMustNeverExecute) RETURN 1','MATCH (d:鄉鎮區碼與名稱) SET d.cypherWriteMustNeverExecute=true RETURN d','CREATE INDEX cypherWriteMustNeverExecute FOR (n:CypherWriteMustNeverExecute) ON (n.test)']) {
    const result = await query(text); assert.equal(result.status,403, JSON.stringify(result));
  }
  assert.deepEqual((await query(fingerprint)).data.rows,before.data.rows);
});
test('syntax, unsafe procedures, external loads and size bounds return safe errors', async () => {
  for (const [text,status] of [['THIS IS INVALID',400],["CALL dbms.listConfig() YIELD name RETURN name",403],["LOAD CSV FROM 'https://example.com/data.csv' AS row RETURN row",403]]) {
    const result = await query(text);
    // Removed/unknown procedures are rejected during EXPLAIN as syntax errors.
    assert.ok(result.status === status || (text.includes('dbms') && result.status===400), JSON.stringify(result));
    assert.doesNotMatch(result.data.message,/bolt:|password|java\.|C:\\/);
  }
  const limited = await query('UNWIND range(1,1001) AS n RETURN n');
  assert.equal(limited.data.rowCount,1000); assert.equal(limited.data.truncated,true);
  const bytes = await query("UNWIND range(1,1000) AS n RETURN reduce(s='',i IN range(1,3000)|s+'a') AS text");
  assert.equal(bytes.status,200); assert.equal(bytes.data.truncated,true); assert.ok(bytes.data.rowCount<1000);
});
