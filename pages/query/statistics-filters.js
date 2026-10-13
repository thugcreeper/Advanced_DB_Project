export function initializeStatisticsFilters({ form, options, request, onStart, onSuccess, onError }) {
  const get = id => form.querySelector('#' + id);
  let counties = [], controller, generation = 0;
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
  function categories(select, values, common) {
    select.replaceChildren(new Option('不限', ''));
    const dental = ['口腔病理科','口腔顎面外科','植牙科','牙周病科','牙髓病科','牙體復形科','特殊需求者口腔醫學科','贋復補綴牙科','齒顎矯正科'];
    const remaining = values.filter(value => !common.includes(value));
    const family = value => value.includes('中醫') ? '中醫' : value.includes('牙') || dental.includes(value) ? '牙醫' : '其他';
    const groups = [['常用', values.filter(value => common.includes(value))], ...['中醫','牙醫','其他'].map(label => [label + '・其他', remaining.filter(value => family(value) === label)])];
    for (const [label, names] of groups) {
      if (!names.length) continue;
      const group = document.createElement('optgroup'); group.label = label;
      names.forEach(value => group.append(new Option(value, value))); select.append(group);
    }
  }
  function bounds(data) {
    for (const [field, ids] of Object.entries({ population: ['populationMin','populationMax'], area: ['areaMin','areaMax'] })) {
      const limit = data.bounds[field];
      ids.forEach(id => { get(id).min = limit.min ?? 0; get(id).max = limit.max ?? ''; get(id).placeholder = limit.min == null ? '不限' : `${limit.min}～${limit.max}`; });
    }
  }
  function cancel() { generation++; controller?.abort(); }
  async function execute() {
    if (!initial) { onError(new Error('統計選單尚未載入，請稍後再試。')); return; }
    cancel(); const current = generation;
    onStart();
    if (!form.reportValidity()) { onError(new Error('請確認數值範圍。')); return; }
    try {
      const scope = get('scope').value;
      const body = { county: get('county').value, districtCode: get('districtCode').value,
        income: range('minIncome'), population: range('populationMin','populationMax'), area: range('areaMin','areaMax'),
        hospitals: get('maxHospitals').value === '' ? undefined : { max: Number(get('maxHospitals').value) },
        clinics: range('minClinics'),
        personnel: get('personnel').value ? { category: get('personnel').value, scope, count: range('personnelMin') } : undefined,
        specialty: get('specialty').value ? { category: get('specialty').value, scope, count: range('specialtyMin') } : undefined,
        sort: [{ field: get('sortField').value, direction: get('sortDirection').value }] };
      controller = new AbortController();
      const data = await request('/api/districts/statistics/search', { body, signal: controller.signal });
      if (current === generation) onSuccess(data);
    } catch (error) { if (current === generation && error.name !== 'AbortError') onError(error); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); execute(); });
  let countyGeneration = 0;
  get('county').addEventListener('change', async () => {
    cancel(); onError(new Error('條件已變更，請重新查詢。')); districtOptions();
    ['populationMin','populationMax','areaMin','areaMax'].forEach(id => { get(id).value = ''; });
    const token = ++countyGeneration; get('searchButton').disabled = true;
    try {
      const data = await options(get('county').value);
      if (token === countyGeneration) { bounds(data); get('searchButton').disabled = false; }
    } catch (error) { if (token === countyGeneration) onError(error); }
  });
  form.addEventListener('reset', () => { cancel(); countyGeneration++; setTimeout(() => { if (!initial) return; districtOptions(); bounds(initial); get('personnelMin').disabled = true; get('specialtyMin').disabled = true; get('searchButton').disabled = false; execute(); }, 0); });
  form.addEventListener('input', () => { cancel(); onError(new Error('條件已變更，請重新查詢。')); });
  get('personnel').addEventListener('change', () => { get('personnelMin').value = ''; get('personnelMin').disabled = !get('personnel').value; });
  get('specialty').addEventListener('change', () => { get('specialtyMin').value = ''; get('specialtyMin').disabled = !get('specialty').value; });
  let initial;
  async function load() {
    try {
      initial = await options(''); counties = initial.counties;
      counties.forEach(county => get('county').append(new Option(county.name, county.name)));
      categories(get('personnel'), initial.personnel, ['西醫師','中醫師','牙醫師','護理師','護士','藥師']);
      categories(get('specialty'), initial.specialties, ['內科','外科','兒科','婦產科','家庭醫學科','牙醫一般科','中醫一般科']);
      bounds(initial); districtOptions(); get('searchButton').disabled = false; execute();
    } catch (error) { onError(error); }
  }
  load();
  return { execute, cancel };
}
