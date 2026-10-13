import { initializeMap } from '../../shared/leaflet-map.js';
import { request } from '../../shared/api.js';

export function initializeCypherMap({ container, status, homeButton, count, select }) {
  const map = initializeMap({ container, status, homeButton, count, createMarker(row, leaflet) {
    const content = document.createElement('span'); content.textContent = `${row.name}・${row.address}`;
    return leaflet.circleMarker([row.latitude, row.longitude], { radius: 5, color: '#fff', weight: 1, fillColor: '#0862dc', fillOpacity: 0.85 }).bindPopup(content);
  } });
  let revision = 0, controller, catalog;
  async function locate() {
    controller?.abort(); controller = new AbortController(); const current = ++revision;
    map.update([]); if (!select.value) return;
    status.hidden = false; status.textContent = '載入所選行政區的實際院所位置…';
    try {
      const [county, code] = select.value.split('|');
      const data = await request(`/api/facilities?county=${encodeURIComponent(county)}&districtCode=${encodeURIComponent(code)}&type=all`, { signal: controller.signal });
      if (current !== revision) return;
      const rows = data.facilities.filter(row => !row.locationReviewRequired && Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && row.latitude >= -90 && row.latitude <= 90 && row.longitude >= -180 && row.longitude <= 180);
      map.update(rows.slice(0,1000));
      status.textContent = `${select.selectedOptions[0].textContent}：顯示 ${Math.min(rows.length,1000)} 個實際院所位置，非行政區中心。${data.facilities.length - rows.length} 筆位置未提供或待核對。`;
    } catch (error) {
      if (current !== revision || error.name === 'AbortError') return;
      status.textContent = '院所位置暫時無法載入，查詢表格與 CSV 仍可使用。';
    }
  }
  select.addEventListener('change', locate);
  function clear() {
    revision++; controller?.abort(); map.update([]); select.replaceChildren(); select.disabled = true;
    status.hidden = false; status.textContent = '尚無可定位的查詢結果。';
  }
  return { clear, async update(data) {
    clear(); const current = revision;
    try {
      catalog ||= await request('/api/districts');
      if (current !== revision) return;
      const districts = catalog.flatMap(county => county.districts);
      const codeIndex = data.columns.findIndex(name => ['行政區碼','鄉鎮市區碼','districtCode','code'].includes(name));
      const nameIndex = data.columns.findIndex(name => ['行政區','鄉鎮市區名稱','地區'].includes(name));
      const selected = new Map();
      data.rows.forEach(row => {
        const node = row.find(value => value?.properties?.鄉鎮市區碼 != null || value?.properties?.鄉鎮市區名稱 != null);
        const district = districts.find(item => (codeIndex >= 0 && String(row[codeIndex]) === item.code) || (nameIndex >= 0 && row[nameIndex] === item.county + item.name)
          || (node && (String(node.properties.鄉鎮市區碼) === item.code || node.properties.鄉鎮市區名稱 === item.county + item.name)));
        if (district) selected.set(district.code, district);
      });
      selected.forEach(district => { const option = document.createElement('option'); option.value = district.county + '|' + district.code; option.textContent = district.county + district.name; select.append(option); });
      select.disabled = selected.size === 0;
      if (selected.size) await locate();
      else status.textContent = '結果沒有可辨識的完整行政區名稱或代碼，僅顯示表格。';
    } catch { if (current === revision) status.textContent = '行政區定位服務暫時無法使用，表格與 CSV 仍可使用。'; }
  } };
}
