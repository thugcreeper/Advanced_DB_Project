import { initializeMap } from "../../shared/leaflet-map.js";

export function hasLocation(row) {
  return !row.locationReviewRequired && Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
    && row.latitude >= -90 && row.latitude <= 90 && row.longitude >= -180 && row.longitude <= 180;
}

function popup(row) {
  const content = document.createElement("div");
  content.className = "facility-popup";
  const title = document.createElement("strong");
  title.textContent = row.name;
  content.append(title);
  [row.type, row.address, row.phone ? `電話：${row.phone}` : "電話：未提供"].forEach(value => {
    const p = document.createElement("p");
    p.textContent = value;
    content.append(p);
  });
  return content;
}

export function initializeFacilityMap(elements) {
  return initializeMap({ ...elements, maxZoom: 15, createMarker(row, leaflet) {
    return leaflet.circleMarker([row.latitude, row.longitude], {
      radius: 7, color: "#fff", weight: 1.5, fillOpacity: .95,
      fillColor: row.type.includes("醫院") ? "#bf3446" : "#178779",
    }).bindPopup(popup(row));
  } });
}
