import { showSnackbar } from '../../shared/snackbar.js';
import { request } from "../../shared/api.js";
import { initializeFacilityMap, hasLocation } from "./map.js";
import { renderResults } from "./results.js";
import { createFacilityDetail } from "./facility-detail.js";

const get = id => document.getElementById(id);
const county = get("county"), district = get("district"), type = get("facilityType");
const department = get('facilityDepartment');
const form = get("districtForm"), search = get("searchButton"), status = get("searchStatus");
const map = initializeFacilityMap({ container: get("map"), status: get("mapStatus"), homeButton: get("resetMap"), count: get("markerCount") }, selectFacility);
const detail = createFacilityDetail({ onClose: () => {
  get('facilityResults').querySelectorAll('.facility-open').forEach(button=>button.setAttribute('aria-expanded','false'));
} });
function highlight(id, reveal = false) {
  map.select(id);
  for (const item of get("facilityResults").children) {
    const selected = item.dataset.sourceId === id;
    item.classList.toggle("is-selected", selected);
    item.querySelector(".facility-open")?.setAttribute("aria-pressed", String(selected));
    if(selected&&reveal){const list=get('facilityResults'),box=list.getBoundingClientRect(),row=item.getBoundingClientRect();if(row.top<box.top)list.scrollTop+=row.top-box.top;else if(row.bottom>box.bottom)list.scrollTop+=row.bottom-box.bottom;}
  }
}
function selectFacility(row,opener) {
  highlight(row.sourceId,true);
  get('facilityResults').querySelectorAll('.facility-open').forEach(button=>button.setAttribute('aria-expanded',String(button.closest('li').dataset.sourceId===row.sourceId)));
  detail.open(row,opener);
}
function locateFacility(row) {
  if(!map.available){showSnackbar('地圖暫時無法使用，仍可查看院所詳情。',{error:true});return;}
  detail.close({restoreFocus:false});highlight(row.sourceId);map.focusById(row.sourceId);
  if(matchMedia('(max-width:760px)').matches)get('mapTitle').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
}
let counties = [], currentRequest, requestNumber = 0;
let typeWasChosen = false;

function clearResults(message) {
  detail.close({ restoreFocus: false });
  get("facilityResults").replaceChildren();
  get("totalCount").textContent = "尚未搜尋";
  get("locationNotice").hidden = true;
  get("assignmentNotice").hidden = true;
  status.classList.remove("is-error");
  status.textContent = message;
  map.update([]);
}
function updateButton() { search.disabled = !county.value; }
function invalidate() {
  requestNumber++;
  currentRequest?.abort();
  get("resultsTitle").closest("section").setAttribute("aria-busy", "false");
  search.textContent = "搜尋";
  clearResults("條件已更新，請按搜尋。");
  updateButton();
}
async function loadCatalog() {
  county.disabled = true;
  get("catalogError").hidden = true;
  get("retryCatalog").hidden = true;
  try {
    counties = await request("/api/districts");
    county.replaceChildren(new Option("請選擇縣市", ""), ...counties.map(row => new Option(row.name, row.name)));
    county.disabled = false;
  } catch (error) {
    county.replaceChildren(new Option("縣市載入失敗", ""));
    showSnackbar("行政區選項載入失敗，請按重新載入。", {error:true});
    get("catalogError").textContent = error.message;
    get("catalogError").hidden = false;
    get("retryCatalog").hidden = false;
  }
}
county.addEventListener("change", () => {
  const selected = counties.find(row => row.name === county.value);
  district.replaceChildren(new Option(selected ? "全部行政區" : "請先選擇縣市", ""),
    ...(selected?.districts || []).map(row => new Option(row.name, row.code)));
  district.disabled = !selected;
  typeWasChosen = false;
  type.value = "hospital";
  invalidate();
});
district.addEventListener("change", () => {
  if (!typeWasChosen) type.value = district.value ? "all" : "hospital";
  invalidate();
});
type.addEventListener("change", () => { typeWasChosen = true; invalidate(); });
department.addEventListener('change',invalidate);
async function loadDepartments() {
  try {
    const values=await request('/api/facilities/departments');
    const selected=department.value;department.replaceChildren(new Option('不限',''),...values.map(value=>new Option(value,value)));department.value=values.includes(selected)?selected:'';get('departmentCatalogStatus').hidden=true;retryDepartments.hidden=true;
    department.disabled=false;
  } catch { retryDepartments.hidden=false;showSnackbar('科別選項載入失敗，仍可依行政區搜尋。',{error:true});get('departmentCatalogStatus').hidden=false; get('departmentCatalogStatus').textContent='院所科別暫時無法載入，仍可依行政區搜尋。'; }
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!county.value) { status.textContent = "請先選擇縣市。"; return; }
  currentRequest?.abort();
  currentRequest = new AbortController();
  const version = ++requestNumber;
  status.textContent = "搜尋中…";
  status.classList.remove("is-error");
  search.disabled = true;
  search.textContent = "搜尋中…";
  // Preserve the map and previous results while reconnecting.
  get("resultsTitle").closest("section").setAttribute("aria-busy", "true");
  try {
    const parameters = new URLSearchParams({ county: county.value, districtCode: district.value, type: type.value, department: department.value });
    const result = await request(`/api/facilities?${parameters}`, { signal: currentRequest.signal });
    if (version !== requestNumber) return;
    if (!Array.isArray(result.facilities) || result.total !== result.facilities.length) throw new Error("API 回傳資料不完整，請重新搜尋。");
    const located = result.facilities.filter(hasLocation);
    detail.close({restoreFocus:false});
    map.update(located);
    renderResults(get("facilityResults"), result.facilities, selectFacility, locateFacility);
    get("totalCount").textContent = `共 ${result.total.toLocaleString()} 筆`;
    status.textContent = result.total ? `${result.county}${result.district || '・全部行政區'}・${type.selectedOptions[0].textContent}${result.department ? '・'+result.department : ''}`
      : result.districtCode ? "此行政區沒有符合條件的醫療院所" : "此縣市沒有符合條件的醫療院所";
    const area=result.county+(result.district||'全部行政區');
    showSnackbar(result.total?`${area}：找到 ${result.total} 間符合院所。`:`目前資料中，${area}沒有符合條件的${type.value==='hospital'?'醫院':type.value==='clinic'?'診所':'院所'}。`);
    get("locationNotice").textContent = `無法定位 ${result.unlocatedCount} 筆院所（缺少有效座標或座標待複核），仍計入結果總數。`;
    get("locationNotice").hidden = result.unlocatedCount === 0;
    get("assignmentNotice").textContent = `全國有 ${result.unassignedTotal} 筆醫院或診所無法確定行政區歸屬，未分配至搜尋地區。`;
    get("assignmentNotice").hidden = result.unassignedTotal === 0;
  } catch (error) {
    if (error.name === "AbortError" || version !== requestNumber) return;
    showSnackbar("院所查詢失敗，請按搜尋重試。", {error:true});
    get("totalCount").textContent = "查詢失敗";
    status.textContent = error.message;
    status.classList.add("is-error");
  } finally {
    if (version === requestNumber) {
      search.textContent = "搜尋";
      get("resultsTitle").closest("section").setAttribute("aria-busy", "false");
      updateButton();
    }
  }
});
get("retryCatalog").addEventListener("click", loadCatalog);
get("aboutButton").addEventListener("click", () => get("aboutDialog").showModal());
const retryDepartments=document.createElement('button');retryDepartments.className='secondary';retryDepartments.type='button';retryDepartments.textContent='重新載入科別';retryDepartments.hidden=true;get('departmentCatalogStatus').after(retryDepartments);retryDepartments.addEventListener('click',()=>{retryDepartments.hidden=true;loadDepartments();});
loadCatalog();
loadDepartments();
