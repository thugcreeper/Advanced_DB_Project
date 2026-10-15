import { request } from "../../shared/api.js";
import { initializeFacilityMap, hasLocation } from "./map.js";
import { renderResults } from "./results.js";
import { createFacilityDetail } from "./facility-detail.js";

const get = id => document.getElementById(id);
const county = get("county"), district = get("district"), type = get("facilityType");
const department = get('facilityDepartment');
const form = get("districtForm"), search = get("searchButton"), status = get("searchStatus");
const map = initializeFacilityMap({ container: get("map"), status: get("mapStatus"), homeButton: get("resetMap"), count: get("markerCount") }, selectFacility);
const detail = createFacilityDetail({ onLocate: locateFacility, onClose: () => highlight(null) });
function highlight(id) {
  map.select(id);
  for (const item of get("facilityResults").children) {
    const selected = item.dataset.sourceId === id;
    item.classList.toggle("is-selected", selected);
    item.querySelector(".facility-open")?.setAttribute("aria-pressed", String(selected));
  }
}
function selectFacility(row, opener) { highlight(row.sourceId); detail.open(row, opener); }
function locateFacility(id) {
  map.focusById(id);
  if (window.matchMedia("(max-width: 760px)").matches) get("mapTitle").scrollIntoView({ behavior: "smooth", block: "start" });
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
    department.replaceChildren(new Option('不限',''),...values.map(value=>new Option(value,value)));
    department.disabled=false;
  } catch { get('departmentCatalogStatus').hidden=false; get('departmentCatalogStatus').textContent='院所科別暫時無法載入，仍可依行政區搜尋。'; }
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!county.value) { status.textContent = "請先選擇縣市。"; return; }
  currentRequest?.abort();
  currentRequest = new AbortController();
  const version = ++requestNumber;
  clearResults("搜尋中…");
  search.disabled = true;
  search.textContent = "搜尋中…";
  get("totalCount").textContent = "—";
  get("resultsTitle").closest("section").setAttribute("aria-busy", "true");
  try {
    const parameters = new URLSearchParams({ county: county.value, districtCode: district.value, type: type.value, department: department.value });
    const result = await request(`/api/facilities?${parameters}`, { signal: currentRequest.signal });
    if (version !== requestNumber) return;
    if (!Array.isArray(result.facilities) || result.total !== result.facilities.length) throw new Error("API 回傳資料不完整，請重新搜尋。");
    const located = result.facilities.filter(hasLocation);
    map.update(located);
    renderResults(get("facilityResults"), result.facilities, selectFacility, locateFacility);
    get("totalCount").textContent = `共 ${result.total.toLocaleString()} 筆`;
    status.textContent = result.total ? `${result.county}${result.district || '・全部行政區'}・${type.selectedOptions[0].textContent}${result.department ? '・'+result.department : ''}`
      : result.districtCode ? "此行政區沒有符合條件的醫療院所" : "此縣市沒有符合條件的醫療院所";
    get("locationNotice").textContent = `無法定位 ${result.unlocatedCount} 筆院所（缺少有效座標或座標待複核），仍計入結果總數。`;
    get("locationNotice").hidden = result.unlocatedCount === 0;
    get("assignmentNotice").textContent = `全國有 ${result.unassignedTotal} 筆醫院或診所無法確定行政區歸屬，未分配至搜尋地區。`;
    get("assignmentNotice").hidden = result.unassignedTotal === 0;
  } catch (error) {
    if (error.name === "AbortError" || version !== requestNumber) return;
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
loadCatalog();
loadDepartments();
