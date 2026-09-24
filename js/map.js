export function createMap(el) {
  const map = L.map(el, { zoomControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  map.setView([35.70, 139.77], 12);

  function showDay(spots, onMarkerClick) {
    layer.clearLayers();
    const pts = [];
    spots.forEach((s, i) => {
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return;
      const icon = L.divIcon({ className: '', html: `<div class="pin pin-${s.category}">${i + 1}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
      L.marker([s.lat, s.lng], { icon, title: s.name }).on('click', () => onMarkerClick(s.id)).addTo(layer);
      pts.push([s.lat, s.lng]);
    });
    if (pts.length > 1) L.polyline(pts, { color: '#1f5fbf', weight: 3, dashArray: '6 6', opacity: 0.7 }).addTo(layer);
    if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
  }

  return { showDay, invalidate: () => map.invalidateSize() };
}
