import { hasLocation } from "./map.js";

export function renderResults(container, facilities, onLocate) {
  const fragment = document.createDocumentFragment();
  let markerIndex = 0;
  facilities.forEach(row => {
    const item = document.createElement("li");
    const heading = document.createElement("div");
    heading.className = "facility-title";
    const title = document.createElement("h3");
    title.textContent = row.name;
    const locate = document.createElement("button");
    locate.type = "button";
    locate.className = "locate-button";
    locate.disabled = !hasLocation(row);
    locate.title = row.locationReviewRequired ? "院所座標待複核" : locate.disabled ? "院所缺少有效座標" : "在地圖顯示院所";
    locate.setAttribute("aria-label", `${locate.title}：${row.name}`);
    // Lucide map-pin icon, rendered locally without introducing an icon package.
    locate.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
    if (!locate.disabled) { const index = markerIndex++; locate.addEventListener("click", () => onLocate(index)); }
    heading.append(title, locate);
    item.append(heading);
    [["facility-type", row.type], ["facility-address", row.address], ["facility-phone", row.phone ? `電話：${row.phone}` : "電話：未提供"],
      ["facility-coordinates", row.locationReviewRequired ? "座標待複核，暫不顯示地圖標記" : hasLocation(row) ? `緯度 ${row.latitude}・經度 ${row.longitude}` : "無有效座標"]].forEach(([className, value]) => {
        const p = document.createElement("p"); p.className = className; p.textContent = value; item.append(p);
      });
    fragment.append(item);
  });
  container.replaceChildren(fragment);
}
