import { initializeMap } from "../../shared/leaflet-map.js";

export function hasLocation(row) {
  return !row.locationReviewRequired && Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
    && row.latitude >= -90 && row.latitude <= 90 && row.longitude >= -180 && row.longitude <= 180;
}

export function initializeFacilityMap(elements, onSelect) {
  const markers = new Map();
  let rows = [];
  const controller = initializeMap({ ...elements, maxZoom: 15, createMarker(row, leaflet) {
    const marker = leaflet.circleMarker([row.latitude, row.longitude], {
      radius: 7, color: "#fff", weight: 1.5, fillOpacity: .95,
      fillColor: row.type.includes("醫院") ? "#bf3446" : "#178779",
    });
    markers.set(row.sourceId, marker);
    marker.on("click", () => onSelect?.(row, marker.getElement()));
    marker.on("add", () => {
      const path = marker.getElement();
      if (!path) return;
      path.setAttribute("tabindex", "0");
      path.setAttribute("role", "button");
      path.setAttribute("aria-label", `查看院所詳情：${row.name}`);
      path.setAttribute("aria-pressed", "false");
      path.dataset.sourceId = row.sourceId;
      path.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault(); event.stopPropagation(); onSelect?.(row, path);
        }
      });
    });
    return marker;
  } });
  return {
    update(values) { rows = values; markers.clear(); controller.update(values); },
    focusById(id) {
      const bounds = elements.container.getBoundingClientRect();
      const drawer = document.getElementById("facilityDetail");
      const panel = drawer?.hidden ? null : drawer?.getBoundingClientRect();
      const mobile = window.matchMedia("(max-width: 760px)").matches;
      const overlap = panel ? mobile ? Math.max(0, bounds.bottom - panel.top) : Math.max(0, bounds.right - panel.left) : 0;
      controller.focus(rows.findIndex(row => row.sourceId === id), { offset: mobile ? [0, Math.min(overlap, bounds.height) / 2] : [Math.min(overlap, bounds.width) / 2, 0] });
    },
    select(id) {
      for (const [key, marker] of markers) {
        const selected = key === id;
        marker.setStyle({ radius: selected ? 10 : 7, color: selected ? "#124fa3" : "#fff", weight: selected ? 3 : 1.5 });
        marker.getElement()?.setAttribute("aria-pressed", String(selected));
        if (selected) marker.bringToFront();
      }
    },
  };
}
