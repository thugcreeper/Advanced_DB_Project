import { showSnackbar } from '../../shared/snackbar.js';
import { initializeEditor } from "./editor.js";
import { initializeModes } from "./modes.js";
import { initializeResults } from "./results.js";
import { initializeStatisticsFilters } from "./statistics-filters.js?v=20261013-ui-fix";
import { statisticsRequest } from "../../shared/statistics-api.js";
import { queryCypher } from "../../shared/cypher-api.js";
import { initializeCypherResults } from "./cypher-results.js";
import { initializeCypherMap } from "./cypher-map.js";

const get = id => document.getElementById(id);
const columns = [
  ['name','地區'], ['averageIncome','平均所得（千元）'], ['population','人口（114年）'], ['area','面積（平方公里）'],
  ['hospitalCount','醫院家數'], ['clinicCount','診所家數'], ['staff','醫事人員總數'], ['staffRate','每萬人口醫事人員數'],
  ['doctors','醫師總數'], ['doctorRate','每萬人口醫師數'], ['personnel','所選人員數'], ['specialty','所選科別院所家數'],
  ['hospitalWesternDoctors','醫院西醫師'], ['clinicWesternDoctors','診所西醫師'], ['westernDoctors','西醫師合計'], ['westernDoctorRate','每萬人口西醫師數'],
  ['hospitalChineseDoctors','醫院中醫師'], ['clinicChineseDoctors','診所中醫師'], ['chineseDoctors','中醫師合計'],
  ['hospitalDentists','醫院牙醫師'], ['clinicDentists','診所牙醫師'], ['dentists','牙醫師合計'], ['medicalYear','醫療統計年度'],
  ['incomeYear','所得年度'], ['populationYear','人口年度'],
].map(([key,label]) => ({ key,label }));
const header = document.createElement('tr'); const first = document.createElement('th'); first.textContent = '#'; header.append(first);
columns.forEach(column => { const th = document.createElement('th'), button = document.createElement('button'); button.type = 'button'; button.dataset.sort = column.key; button.textContent = column.label + ' ↕'; th.append(button); header.append(th); });
get('statisticsHead').replaceChildren(header);
const results = initializeResults({ body: get('resultRows'), count: get('resultCount'), empty: get('resultsEmpty'), download: get('downloadCsv'), sortButtons: [...header.querySelectorAll('button')], onSort: () => {}, columns });
function status(text, error = false) { get('queryModeLabel').textContent = text; get('queryModeLabel').setAttribute('role', error ? 'alert' : 'status'); }
const cypherResults = initializeCypherResults({ head: get('cypherHead'), body: get('cypherRows'), count: get('resultCount'), empty: get('resultsEmpty') });
let filters, editor, map, mode = 'builder';
function clear() {
  results.update([], { resetSort: true }); cypherResults.update(); get('downloadCypherCsv').disabled = true;
  get('resultsEmpty').hidden = true; map?.clear();
}
editor = initializeEditor({ input: get('cypherInput'), clearButton: get('clearCypher'), copyButton: get('copyCypher'), form: get('cypherPane'), status: get('cypherStatus'), exampleSelect: get('exampleQuery'), description: get('exampleDescription'),
  onExecute: queryCypher,
  onStart: () => { filters?.cancel(); clear(); status('Cypher 查詢中…'); },
  onChange: () => { if (mode === 'cypher') { clear(); status('查詢已變更，請執行查詢。'); } },
  onSuccess: data => { showSnackbar(data.rows.length?`Cypher 查詢完成，共 ${data.rows.length} 筆${data.truncated?'（結果已截斷）':''}。`:'查詢已完成，沒有符合的資料。');cypherResults.update(data); get('downloadCypherCsv').disabled = data.rows.length === 0; status(`Neo4j Cypher・${data.columns.length} 欄${data.truncated ? '・結果已截斷，CSV 僅含顯示資料' : ''}`); map?.update(data); },
  onError: error => { showSnackbar(error.message,{error:true});clear(); status(error.message, true); },
});
get('downloadCypherCsv').addEventListener('click', () => {cypherResults.download();showSnackbar('已開始下載 Cypher CSV。');});get('downloadCsv').addEventListener('click',()=>showSnackbar('已開始下載統計 CSV。'));
filters = initializeStatisticsFilters({ form: get('builderPane'),
  options: county => statisticsRequest('/api/districts/statistics/options' + (county ? '?county=' + encodeURIComponent(county) : '')),
  request: statisticsRequest,
  onStart: () => { clear(); get('builderPane').setAttribute('aria-busy','true'); status('查詢中…'); },
  onSuccess: data => {
    showSnackbar(data.districts.length?`查詢完成，找到 ${data.districts.length} 個行政區。`:'沒有符合條件的行政區，請調整篩選條件。');get('builderPane').setAttribute('aria-busy','false'); results.update(data.districts, { resetSort: true });
    const selected = ['personnel','specialty'].map(id => get(id).value).filter(Boolean).join('、');
    status(`Neo4j 統計・${({ all: '醫院＋診所', hospital: '醫院', clinic: '診所' })[data.scope || 'all']}${selected ? '・' + selected : ''}`);
  },
  onChange: () => { get('builderPane').setAttribute('aria-busy','false'); clear(); status('條件已變更，請重新查詢。'); },
  onError: error => { showSnackbar(error.message,{error:true});get('builderPane').setAttribute('aria-busy','false'); clear(); status(error.message, true); },
});
get('aboutButton').addEventListener('click', () => get('aboutDialog').showModal());
initializeModes({ tabs: [...document.querySelectorAll('.mode-tab')], panes: [...document.querySelectorAll('.mode-pane')], onChange: next => {
  if (next === mode) return;
  mode = next; filters.cancel(); editor.cancel(); clear();
  get('statisticsHead').closest('.table-scroll').hidden = mode === 'cypher';
  get('cypherTable').hidden = mode !== 'cypher'; get('downloadCsv').hidden = mode === 'cypher';
  get('downloadCypherCsv').hidden = mode !== 'cypher'; get('mapDistrictLabel').hidden = mode !== 'cypher';
  status(mode === 'cypher' ? '尚未執行 Cypher 查詢。' : 'Neo4j 統計');
  if (mode === 'builder') filters.execute();
} });
// Map failure must never affect statistics or CSV. No administrative coordinates are fabricated.
try {
  map = initializeCypherMap({ container: get('map'), status: get('mapStatus'), homeButton: get('resetMap'), count: get('markerCount'), select: get('mapDistrict') });
  get('markerCount').textContent = '行政區定位暫緩';
} catch { get('mapStatus').hidden = false; get('mapStatus').textContent = '地圖無法載入。'; }
