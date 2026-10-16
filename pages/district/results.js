import { hasLocation } from "./map.js";
import { createIcon } from "../../shared/ui-icons.js";

export function renderResults(container, facilities, onSelect, onLocate) {
  const fragment = document.createDocumentFragment();
  facilities.forEach((row,index) => {
    const item = document.createElement("li");
    item.dataset.sourceId = row.sourceId;
    const heading = document.createElement("div");
    heading.className = "facility-title";
    const title = document.createElement("h3");
    const detail = document.createElement("button");
    detail.type = "button"; detail.className = "facility-open"; detail.textContent = row.name;
    detail.setAttribute("aria-controls", "facilityDetail"); detail.setAttribute("aria-expanded", "false"); detail.setAttribute("aria-pressed", "false");
    detail.addEventListener("click", () => onSelect(row, detail));
    title.append(detail);
    item.addEventListener("click", event => { if (!event.target.closest("button, a")) onSelect(row, detail); });
    const locate = document.createElement("button");
    locate.type = "button";
    locate.className = "locate-button";
    locate.disabled = !hasLocation(row);
    locate.title = row.locationReviewRequired ? "院所座標待複核" : locate.disabled ? "院所缺少有效座標" : "在地圖上定位";
    locate.setAttribute("aria-label", `${locate.title}：${row.name}`);
    locate.append(createIcon("map-pin"));
    locate.addEventListener("click", event => { event.stopPropagation(); if(!locate.disabled) onLocate(row,locate); });
    heading.append(title, locate);
    item.append(heading);
    [["facility-type",row.type],["facility-address",row.address||"地址：未提供"],["facility-phone",row.phone?`電話：${row.phone}`:"電話：未提供"]].forEach(([className,value])=>{
      const p=document.createElement('p');p.className=className;p.textContent=value;item.append(p);
    });
    if(locate.disabled){const note=document.createElement('p');note.className='facility-location-note';note.id=`facility-location-note-${index}`;note.textContent=row.locationReviewRequired?'座標待複核，暫無法定位。':'缺少有效座標，暫無法定位。';locate.setAttribute('aria-describedby',note.id);item.append(note);}
    fragment.append(item);
  });
  container.replaceChildren(fragment);
}
