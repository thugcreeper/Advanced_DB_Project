import { showSnackbar } from '../../shared/snackbar.js';
import { request } from "../../shared/api.js";
import { createIcon } from "../../shared/ui-icons.js";
import { hasLocation } from "./map.js";
import { createClinicWeek } from "./clinic-week.js";
import { createClinicTable } from "./clinic-table.js";

function telephone(value) {
  if(typeof value!=='string'||!/^[+\d\s()#-]+$/.test(value))return '';
  const [main,extension,...extra]=value.trim().split('#'),number=main.replace(/[\s()-]/g,'');
  if(extra.length||!/^\+?\d{5,15}$/.test(number)||extension!==undefined&&!/^\d{1,8}$/.test(extension.trim()))return '';
  return `tel:${number}${extension===undefined?'':';ext='+extension.trim()}`;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function section(title) {
  const node = element("section", "detail-section");
  node.append(element("h3", "", title));
  return node;
}

export function createFacilityDetail({ onClose }) {
  const get = id => document.getElementById(id);
  const panel = get("facilityDetail"), content = get("detailContent"), status = get("detailStatus");
  const title = get("detailTitle"), type = get("detailType"), retry = get("detailRetry"), actions = get("detailActions");
  const modal = panel.tagName === "DIALOG";
  let current, controller, version = 0, opener, disposeWeek = () => {};
  get("detailClose").append(createIcon("x"));


  function render(data) {
    title.textContent = data.name || "未提供院所名稱";
    type.textContent = data.type || ""; type.hidden = !data.type;
    const contact = element("section", "detail-contact"), list = element("dl", "detail-facts");
    contact.setAttribute("aria-label", "院所聯絡資訊");
    for (const [label, value] of [["地址", data.address], ["電話", telephone(data.phone)?data.phone:"暫無有效電話"]]) {
      const dd = element("dd", "", value || "暫無資料");
      if (label === "電話" && telephone(value)) {
        const link = element("a", "", value); link.href = telephone(value);
        dd.replaceChildren(link);
      }
      const term = element("dt");
      if (modal) { const icon = label === "地址" ? createIcon("map-pin") : element("span", "detail-contact-symbol", "☎"); icon.setAttribute("aria-hidden", "true"); term.append(icon); }
      term.append(element("span", "", label)); list.append(term, dd);
    }
    contact.append(list);
    const names = [...new Set((Array.isArray(data.departments) ? data.departments : []).filter(name => typeof name === "string").map(name => name.trim()).filter(Boolean))];
    const departments = section(`診療科別（共 ${names.length} 項）`);
    if (names.length) {
      const tags = element("ul", "detail-departments");
      tags.setAttribute("aria-label", "院所診療科別");
      names.forEach(name => tags.append(element("li", "", name)));
      departments.append(tags);
    } else departments.append(element("p", "detail-muted", modal ? "暫無科別資料" : "尚無科別資料"));
    disposeWeek();
    const week = modal ? createClinicTable(data.clinicHours) : { element: createClinicWeek(data.clinicHours), destroy() {} };
    disposeWeek = week.destroy;
    content.replaceChildren(contact, week.element, departments);
    if (data.notes?.trim()) {
      const notes = section("備註"); notes.append(element("p", "detail-notes", data.notes)); content.append(notes);
    }
    const location = element("div", "detail-provenance");
    if (data.locationReviewRequired) location.append(element("p", "detail-warning", "座標待複核，暫不顯示地圖標記。"));
    else if (!hasLocation(data)) location.append(element("p", "detail-muted", "暫無有效座標"));
    content.append(location);
    const call = get("detailCall"), tel = telephone(data.phone);
    call.hidden = !tel; call.setAttribute("aria-disabled", String(!tel)); call.tabIndex = tel ? 0 : -1;
    call.title = tel ? "撥打電話" : "未提供有效電話";
    if (tel) call.href = tel; else call.removeAttribute("href");
    const hints = [!tel&&"未提供有效電話"].filter(Boolean);
    const google = get("detailGoogle");
    const address=typeof data.address==='string'?data.address.trim():'';
    const name=typeof data.name==='string'?data.name.trim():'';
    const query=hasLocation(data)?`${data.latitude},${data.longitude}`:address?[name,address].filter(Boolean).join(' '):'';
    google.hidden = !query;
    if (query) google.href = `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query })}`;
    else google.removeAttribute("href");
    if (modal && query) {
      const link = element("a", "detail-map-link");
      link.append(createIcon("map-pin"), element("span", "", "Google 地圖"));
      link.href = google.href; link.target = "_blank"; link.rel = "noopener noreferrer"; contact.append(link);
    }
    if(!query)hints.push('未提供有效座標或完整地址，無法開啟 Google 地圖');
    get('detailActionHint').textContent=hints.join('；');get('detailActionHint').hidden=!hints.length;
    actions.hidden = !tel&&!query;
  }
  async function load() {
    controller?.abort(); controller = new AbortController();
    const token = ++version, id = current.sourceId;
    disposeWeek(); content.hidden = true; content.replaceChildren(); actions.hidden = true; retry.hidden = true;
    status.hidden = false; status.textContent = "載入院所資料中…"; status.classList.remove("is-error");
    panel.setAttribute("aria-busy", "true");
    try {
      const data = await request(`/api/facilities/detail?${new URLSearchParams({ sourceId: id })}`, { signal: controller.signal });
      if (token !== version || panel.hidden) return;
      if (data.sourceId !== id) throw new Error("院所資料不一致，請重新載入。");
      render(data); content.hidden = false; status.textContent = ""; status.hidden = true;
    } catch (error) {
      if (error.name === "AbortError" || token !== version) return;
      showSnackbar("院所詳情載入失敗，請在詳情視窗重試。",{error:true});status.textContent = error.message; status.classList.add("is-error"); retry.hidden = false;
    } finally {
      if (token === version) panel.setAttribute("aria-busy", "false");
    }
  }
  function close({ restoreFocus = true } = {}) {
    const wasOpen = !panel.hidden;
    ++version; controller?.abort(); disposeWeek();
    if (modal && panel.open) panel.close();
    panel.hidden = true; panel.setAttribute("aria-busy", "false");
    if (modal) document.documentElement.classList.remove("facility-modal-open");
    content.replaceChildren(); current = null; delete panel.dataset.sourceId;
    if (wasOpen) {
      onClose?.();
      if (restoreFocus) (opener?.isConnected ? opener : get("searchButton"))?.focus({ preventScroll: true });
    }
  }
  get("detailClose").addEventListener("click", () => close());
  retry.addEventListener("click", load);
  if (modal) {
    panel.addEventListener('cancel', event => { event.preventDefault(); close(); });
    panel.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const items = [...panel.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter(item => item.getClientRects().length && !item.closest('[hidden]'));
      if (!items.length) { event.preventDefault(); title.focus(); return; }
      const first = items[0], last = items.at(-1), active = document.activeElement;
      if (event.shiftKey && (active === first || !items.includes(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    });
    panel.addEventListener('close', () => { if (!panel.open && !panel.hidden) close(); });
    const outside = event => { const box = panel.getBoundingClientRect(); return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom; };
    let backdropPress = false;
    panel.addEventListener('pointerdown', event => { backdropPress = event.target === panel && outside(event); });
    panel.addEventListener('click', event => { if (backdropPress && event.target === panel && outside(event)) close(); backdropPress = false; });
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden && !get("aboutDialog").open) { event.preventDefault(); close(); }
  });
  function layout() {
    if(panel.hidden || modal)return;
    if(matchMedia('(max-width:1100px)').matches){
      for(const key of ['top','right','width','height'])panel.style.removeProperty(key);
      const box=panel.parentElement.getBoundingClientRect(),sheet=panel.getBoundingClientRect();
      const overlap=sheet.right>box.left&&sheet.left<box.right?Math.max(0,Math.min(box.height-38,box.bottom-sheet.top)):0;
      panel.parentElement.style.setProperty('--detail-bottom-overlap',`${overlap}px`);return;
    }
    const rect=panel.parentElement.getBoundingClientRect(),viewport=window.visualViewport?.height||innerHeight;
    const top=Math.min(Math.max(12,rect.top),Math.max(12,viewport-240));
    const height=Math.min(rect.height,viewport-top-12,Math.max(240,rect.bottom-top));
    panel.style.top=`${top}px`;panel.style.right=`${Math.max(12,innerWidth-rect.right)}px`;panel.style.width=`${Math.min(390,rect.width,innerWidth-24)}px`;panel.style.height=`${Math.max(0,height)}px`;panel.parentElement.style.setProperty('--detail-width',panel.style.width);
  }
  window.addEventListener('resize',layout);window.addEventListener('scroll',layout,{passive:true});
  return {
    open(row, trigger) {
      opener = trigger || document.activeElement; current = row; panel.hidden = false; panel.dataset.sourceId=row.sourceId;
      if (modal) { document.documentElement.classList.add('facility-modal-open'); if (!panel.open) panel.showModal(); } else layout();
      title.textContent = row.name || "院所詳情"; type.textContent = row.type || ""; type.hidden = !row.type;
      get("detailScroll").scrollTop = 0; title.focus({ preventScroll: true }); load();
    }, close,
  };
}
