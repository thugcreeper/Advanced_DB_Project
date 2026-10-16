import { statisticsColumns } from './columns.js';
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
const results=initializeResults({body:get('resultRows'),count:get('resultCount'),empty:get('resultsEmpty'),download:get('downloadCsv'),head:get('statisticsHead'),numbered:false,columns:[]});
function status(text, error = false) { get('queryModeLabel').textContent = text; get('queryModeLabel').setAttribute('role', error ? 'alert' : 'status'); }
const cypherResults = initializeCypherResults({ head: get('cypherHead'), body: get('cypherRows'), count: get('resultCount'), empty: get('resultsEmpty') });
let filters, editor, map, mode = 'builder', lastStatisticsStatus = '';
function clear() {
  lastStatisticsStatus = '';
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
  onStart: () => { get('builderPane').setAttribute('aria-busy','true'); status(lastStatisticsStatus ? lastStatisticsStatus+'・正在查詢新條件…' : '查詢中…'); },
  onSuccess: (data,body) => {
    results.setColumns(statisticsColumns(body,data.appliedFilters));
    showSnackbar(data.districts.length?`查詢完成，找到 ${data.districts.length} 個行政區。`:'沒有符合條件的行政區，請調整篩選條件。');get('builderPane').setAttribute('aria-busy','false'); results.update(data.districts, { resetSort: true });
    const selected=[...(data.appliedFilters?.specialties||body.specialties?.map(s=>s.category)||[]),data.appliedFilters?.personnel||body.personnel?.category||''].filter(Boolean).join('、');
    lastStatisticsStatus = `政府行政區統計（非院所名單）・${({ all: '醫院＋診所', hospital: '醫院', clinic: '診所' })[data.scope || 'all']}${selected ? '・' + selected : ''}${(body.specialties?.length||0)>1?'・'+(body.specialtyMatch==='and'?'每科都符合 AND':'任一科符合 OR'):''}`; status(lastStatisticsStatus);
  },
  onChange: () => { get('builderPane').setAttribute('aria-busy','false'); status(lastStatisticsStatus ? lastStatisticsStatus+'・條件已變更，顯示上次查詢結果。' : '條件已變更，請執行查詢。'); },
  onError: error => { showSnackbar(error.message,{error:true});get('builderPane').setAttribute('aria-busy','false'); status(error.message+(lastStatisticsStatus?'（保留上次查詢結果）':''), true); },
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
