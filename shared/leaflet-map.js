export function initializeMap({ container, status, homeButton, count, createMarker, maxZoom = 11, leaflet = window.L }) {
  if (!leaflet) {
    status.hidden = false;
    status.textContent = "地圖函式庫載入失敗，請重新整理。";
    homeButton.disabled = true;
    return { update(rows) { count.textContent = `${rows.length} 筆資料・地圖未載入`; }, focus() {} };
  }
  const taiwanBounds = [[21.85, 119.8], [25.4, 122.05]];
  const map = leaflet.map(container, { zoomControl: false, zoomSnap: 0.25, fadeAnimation: false, zoomAnimation: false });
  leaflet.control.zoom({ zoomInTitle: "放大", zoomOutTitle: "縮小" }).addTo(map);
  const tiles = leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 貢獻者',
  }).addTo(map);
  tiles.on("tileerror", () => { status.hidden = false; status.textContent = "部分地圖圖磚無法載入，請確認網路連線。"; });
  leaflet.control.scale({ imperial: false, position: "bottomright" }).addTo(map);
  const layers = leaflet.layerGroup().addTo(map);
  let currentRows = [];
  let markers = [];
  let showWholeTaiwan = true;
  function fitView() {
    map.invalidateSize({ pan: false });
    const bounds = !showWholeTaiwan && currentRows.length
      ? leaflet.latLngBounds(currentRows.map(row => [row.latitude, row.longitude])) : taiwanBounds;
    map.fitBounds(bounds, { padding: [35, 35], maxZoom, animate: false });
  }
  homeButton.addEventListener("click", () => { showWholeTaiwan = true; fitView(); });
  const observer = new ResizeObserver(fitView);
  observer.observe(container);
  fitView();
  return {
    update(rows, { fit = true } = {}) {
      currentRows = rows;
      layers.clearLayers();
      markers = rows.map(row => createMarker(row, leaflet).addTo(layers));
      count.textContent = `${rows.length} 個標記`;
      if (fit) { showWholeTaiwan = rows.length === 0; fitView(); }
    },
    focus(index, { offset = [0, 0] } = {}) {
      if (!markers[index]) return;
      map.setView(markers[index].getLatLng(), Math.max(map.getZoom(), 15), { animate: false });
      if (offset.some(value => value !== 0)) map.panBy(offset, { animate: false });
      markers[index].openPopup();
    },
  };
}
