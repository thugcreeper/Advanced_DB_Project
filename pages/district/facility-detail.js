import { request } from "../../shared/api.js";
import { createIcon } from "../../shared/ui-icons.js";
import { hasLocation } from "./map.js";
import { createClinicWeek } from "./clinic-week.js";

function telephone(value) {
  return value && /^[+\d\s()#-]+$/.test(value) && value.replace(/\D/g, "").length >= 5
    ? `tel:${value.replace(/[\s()-]/g, "")}` : "";
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

export function createFacilityDetail({ onLocate, onClose }) {
  const get = id => document.getElementById(id);
  const panel = get("facilityDetail"), content = get("detailContent"), status = get("detailStatus");
  const title = get("detailTitle"), type = get("detailType"), retry = get("detailRetry"), actions = get("detailActions");
  let current, controller, version = 0, opener;
  get("detailClose").append(createIcon("x"));
  get("detailLocate").prepend(createIcon("map-pin"));

  function render(data) {
    title.textContent = data.name || "未提供院所名稱";
    type.textContent = data.type || ""; type.hidden = !data.type;
    const contact = element("section", "detail-contact"), list = element("dl", "detail-facts");
    contact.setAttribute("aria-label", "院所聯絡資訊");
    for (const [label, value] of [["地址", data.address], ["電話", data.phone]]) {
      const dd = element("dd", "", value || "暫無資料");
      if (label === "電話" && telephone(value)) {
        const link = element("a", "", value); link.href = telephone(value);
        dd.replaceChildren(link);
      }
      list.append(element("dt", "", label), dd);
    }
    contact.append(list);
    const names = [...new Set((data.departments || []).filter(name => typeof name === "string" && name.trim()))];
    const departments = section(`診療科別（共 ${names.length} 項）`);
    if (names.length) {
      const tags = element("ul", "detail-departments");
      tags.setAttribute("aria-label", "院所診療科別");
      names.forEach(name => tags.append(element("li", "", name)));
      departments.append(tags);
    } else departments.append(element("p", "detail-muted", "尚無科別資料"));
    content.replaceChildren(contact, createClinicWeek(data.clinicHours), departments);
    if (data.notes?.trim()) {
      const notes = section("備註"); notes.append(element("p", "detail-notes", data.notes)); content.append(notes);
    }
    const location = element("div", "detail-provenance");
    if (data.locationReviewRequired) location.append(element("p", "detail-warning", "座標待複核，暫不顯示地圖標記。"));
    else if (!hasLocation(data)) location.append(element("p", "detail-muted", "暫無有效座標"));
    if (data.source?.trim()) location.append(element("p", "detail-source", `資料來源：${data.source}`));
    content.append(location);
    const call = get("detailCall"), tel = telephone(data.phone);
    call.setAttribute("aria-disabled", String(!tel)); call.tabIndex = tel ? 0 : -1;
    call.title = tel ? "撥打電話" : "未提供有效電話";
    if (tel) call.href = tel; else call.removeAttribute("href");
    get("detailLocate").disabled = !hasLocation(data);
    get("detailLocate").title = hasLocation(data) ? "在地圖上定位" : "院所缺少有效座標或座標待複核";
    const hints = [!tel && "未提供有效電話", !hasLocation(data) && (data.locationReviewRequired ? "座標待複核，無法定位" : "暫無有效座標")].filter(Boolean);
    get("detailActionHint").textContent = hints.join("；"); get("detailActionHint").hidden = !hints.length;
    const google = get("detailGoogle");
    const query = hasLocation(data) ? `${data.latitude},${data.longitude}` : data.address ? `${data.name} ${data.address}` : "";
    google.hidden = !query;
    if (query) google.href = `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query })}`;
    else google.removeAttribute("href");
    actions.hidden = false;
  }
  async function load() {
    controller?.abort(); controller = new AbortController();
    const token = ++version, id = current.sourceId;
    content.hidden = true; content.replaceChildren(); actions.hidden = true; retry.hidden = true;
    status.hidden = false; status.textContent = "載入院所資料中…"; status.classList.remove("is-error");
    panel.setAttribute("aria-busy", "true");
    try {
      const data = await request(`/api/facilities/detail?${new URLSearchParams({ sourceId: id })}`, { signal: controller.signal });
      if (token !== version || panel.hidden) return;
      if (data.sourceId !== id) throw new Error("院所資料不一致，請重新載入。");
      render(data); content.hidden = false; status.textContent = ""; status.hidden = true;
    } catch (error) {
      if (error.name === "AbortError" || token !== version) return;
      status.textContent = error.message; status.classList.add("is-error"); retry.hidden = false;
    } finally {
      if (token === version) panel.setAttribute("aria-busy", "false");
    }
  }
  function close({ restoreFocus = true } = {}) {
    const wasOpen = !panel.hidden;
    ++version; controller?.abort(); panel.hidden = true; panel.setAttribute("aria-busy", "false");
    content.replaceChildren(); current = null;
    if (wasOpen) {
      onClose();
      if (restoreFocus) (opener?.isConnected ? opener : get("searchButton"))?.focus({ preventScroll: true });
    }
  }
  get("detailClose").addEventListener("click", () => close());
  retry.addEventListener("click", load);
  get("detailLocate").addEventListener("click", () => current && onLocate(current.sourceId));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden && !get("aboutDialog").open) { event.preventDefault(); close(); }
  });
  return {
    open(row, trigger) {
      opener = trigger || document.activeElement; current = row; panel.hidden = false;
      title.textContent = row.name || "院所詳情"; type.textContent = row.type || ""; type.hidden = !row.type;
      get("detailScroll").scrollTop = 0; title.focus({ preventScroll: true }); load();
    }, close,
  };
}
