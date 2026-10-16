import { initializeHierarchicalSelector } from "../../shared/hierarchical-selector.js?v=20261013-ui-fix";
import { specialtyGroups, personnelGroups } from "../../shared/medical-categories.js";

export function initializeStatisticsFilters({ form, options, request, onStart, onSuccess, onError, onChange = () => {} }) {
  const get = id => form.querySelector('#' + id);
  let counties = [], controller, generation = 0;
  const pickers = {
    personnel: initializeHierarchicalSelector({ root: get('personnelPicker'), input: get('personnel'), label: '醫事人員', groups: personnelGroups }),
    specialty: initializeHierarchicalSelector({ root: get('specialtyPicker'), input: get('specialty'), label: '醫療科別', groups: specialtyGroups, multiple: true }),
  };
  const filterIds = new Set(['county','districtCode','minIncome','maxHospitals','minClinics','populationMin','populationMax','areaMin','areaMax','personnel','personnelMin','specialty','specialtyMin','specialtyMatch','scope','sortField','sortDirection']);
  function conditionCount() {
    let total = 0;
    form.querySelectorAll('[data-condition-group]').forEach(group => {
      const count = [...group.querySelectorAll('input, select')].filter(input => filterIds.has(input.id) && !input.disabled && input.value !== '' && (input.id !== 'scope' || input.value !== 'all') && (input.id!=='specialtyMatch'||pickers.specialty.values().length>1&&input.value==='and')).length;
      group.querySelector('.group-condition-count').textContent = count ? count + ' 項' : '';
      total += count;
    });
    const chosen=pickers.specialty.values();get('sortField').querySelector('[value=specialty]').textContent=chosen.length>1?`${chosen[0]}數量（首個所選科別）`:'所選科別院所家數';
    get('advancedCount').textContent = total ? '已設定 ' + total + ' 項條件' : '尚未設定條件';
  }
  get('advancedFilters').addEventListener('toggle', () => { if (!get('advancedFilters').open) Object.values(pickers).forEach(picker => picker.close()); });
  form.querySelector('[data-condition-group="categories"]').addEventListener('toggle', event => { if (!event.target.open) Object.values(pickers).forEach(picker => picker.close()); });
  function range(min, max) {
    const low = get(min).value, high = max ? get(max).value : "";
    if (low === "" && high === "") return undefined;
    if (low !== "" && high !== "" && Number(low) > Number(high)) throw new Error("下限不得大於上限。");
    return { ...(low === "" ? {} : { min: Number(low) }), ...(high === "" ? {} : { max: Number(high) }) };
  }
  function districtOptions() {
    get('districtCode').replaceChildren(new Option('全部行政區', ''));
    const county = counties.find(c => c.name === get('county').value);
    for (const district of county?.districts || []) get('districtCode').append(new Option(district.name, district.code));
    get('districtCode').disabled = !county;
  }
  function bounds(data) {
    for (const [field, ids] of Object.entries({ population: ['populationMin','populationMax'], area: ['areaMin','areaMax'] })) {
      const limit = data.bounds[field];
      ids.forEach(id => { get(id).min = 0; get(id).removeAttribute('max'); get(id).placeholder = limit.min == null ? '不限' : `${limit.min}～${limit.max}`; });
    }
  }
  function cancel() { generation++; controller?.abort(); }
  async function execute() {
    if (!initial) { onError(new Error('統計選單尚未載入，請稍後再試。')); return; }
    cancel(); const current = generation;
    onStart();
    const invalid = [...form.querySelectorAll('input, select')].find(input => !input.checkValidity());
    if (invalid) for (let parent = invalid.parentElement; parent && parent !== form; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    if (!form.reportValidity()) { onError(new Error('請確認數值範圍。')); return; }
    try {
      const scope = get('scope').value;
      const body = { county: get('county').value, districtCode: get('districtCode').value,
        income: range('minIncome'), population: range('populationMin','populationMax'), area: range('areaMin','areaMax'),
        hospitals: get('maxHospitals').value === '' ? undefined : { max: Number(get('maxHospitals').value) },
        clinics: range('minClinics'),
        personnel: get('personnel').value ? { category: get('personnel').value, scope, count: range('personnelMin') || { min: 1 } } : undefined,
        specialties: pickers.specialty.values().map(category=>({category,scope,count:range('specialtyMin')||{min:1}})),
        specialtyMatch:get('specialtyMatch').value,
        sort: [{ field: get('sortField').value, direction: get('sortDirection').value }] };
      controller = new AbortController();
      const data = await request('/api/districts/statistics/search', { body, signal: controller.signal });
      if (current === generation) onSuccess(data,body);
    } catch (error) { if (current === generation && error.name !== 'AbortError') onError(error); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); execute(); });
  let countyGeneration = 0;
  get('county').addEventListener('change', async () => {
    cancel(); onChange(); districtOptions();
    const token = ++countyGeneration; get('searchButton').disabled = true;
    try {
      const data = await options(get('county').value);
      if (token === countyGeneration) { retryOptions.hidden=true;bounds(data); conditionCount(); get('searchButton').disabled = false; }
    } catch (error) { if (token === countyGeneration) {retryOptions.hidden=false;onError(error);} }
  });
  form.addEventListener('reset', () => { cancel(); countyGeneration++; setTimeout(() => { Object.values(pickers).forEach(picker => picker.reset()); conditionCount(); if (!initial) return; districtOptions(); bounds(initial); get('personnelMin').disabled = true; get('specialtyMin').disabled = true;get('specialtyMatch').disabled=true; get('searchButton').disabled = false; execute(); }, 0); });
  form.addEventListener('input', event => { if (!filterIds.has(event.target.id)) return; conditionCount(); cancel(); onChange(); });
  form.addEventListener('change', event => { if (filterIds.has(event.target.id)) conditionCount(); });
  get('personnel').addEventListener('change', () => { get('personnelMin').value = get('personnel').value ? '1' : ''; get('personnelMin').disabled = !get('personnel').value; conditionCount(); });
  get('specialty').addEventListener('change', () => { get('specialtyMin').value = get('specialty').value ? get('specialtyMin').value||'1' : ''; get('specialtyMin').disabled = !get('specialty').value;get('specialtyMatch').disabled=pickers.specialty.values().length<2;conditionCount(); });
  let initial;
  const retryOptions = document.createElement('button');retryOptions.type='button';retryOptions.className='secondary';retryOptions.textContent='重新載入篩選選項';retryOptions.hidden=true;form.prepend(retryOptions);
  retryOptions.addEventListener('click',()=>{retryOptions.hidden=true;if(initial)get('county').dispatchEvent(new Event('change'));else load();});
  async function load() {
    try {
      initial = await options(''); counties = initial.counties;
      get('county').replaceChildren(new Option('全國',''),...counties.map(county=>new Option(county.name,county.name)));retryOptions.hidden=true;
      pickers.personnel.setOptions(initial.personnel);
      pickers.specialty.setOptions(initial.specialties);
      bounds(initial); districtOptions(); conditionCount(); get('searchButton').disabled = false; execute();
    } catch (error) { retryOptions.hidden=false;onError(error); }
  }
  load();
  return { execute, cancel };
}
