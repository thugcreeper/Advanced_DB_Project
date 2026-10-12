import { initializeMap as initializeSharedMap } from "../../shared/leaflet-map.js";

export function initializeMap(options) {
  return initializeSharedMap({ ...options, createMarker(row, leaflet) {
    const fillColor = row.averageIncome >= 2000 ? "#bc171e" : row.averageIncome >= 1800 ? "#ec4d52" : row.averageIncome >= 1600 ? "#f3787d" : "#f8a7ad";
    return leaflet.circleMarker([row.latitude, row.longitude], {
      radius: 7, color: "#fff", weight: 1.5, fillColor, fillOpacity: .9, interactive: false,
    });
  } });
}
