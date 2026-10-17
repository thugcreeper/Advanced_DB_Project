const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'fixtures/core-queries.txt'), 'utf8').replace(/\r\n/g, '\n');
const parts = source.split(/^([1-9])\.(.+)\n/m).slice(1);
exports.originals = Array.from({length: 9}, (_, n) => ({label: parts[n*3+1].trim(), query: parts[n*3+2].trim()}));
exports.columns = [
 ['行政區','平均所得','人口數','醫事人員總數','每萬人口醫事人員數'],
 ['行政區','平均所得','人口數','院所數','人員數','每萬人口醫事人員數'],
 ['行政區','人口數','醫院數','診所數'],
 ['行政區','護理師總數'],
 ['行政區','人口數','平均所得','醫事人員數','每萬人口醫事人員數'],
 ['行政區','土地面積','醫療院所數'],
 ['行政區','人口密度','人口數','醫院數','診所數'],
 ['行政區','人口密度','人口數','平均所得','醫師數','每萬人口醫師數'],
 ['行政區','人口數','人口密度','診所數']
];
exports.orders = ['平均所得 DESC','平均所得','診所數','護理師總數 DESC','每萬人口醫事人員數 DESC','土地面積 DESC','人口密度 DESC','每萬人口醫師數','人口數 DESC'];
