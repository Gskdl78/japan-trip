export const CATEGORY_LABEL = { sight: '景點', food: '餐廳', shop: '購物', transit: '交通', hotel: '住宿' };
export const ORDER_GAP = 1000;

export function parseMapsUrl(url) {
  if (typeof url !== 'string') return null;
  let s = url;
  try { s = decodeURIComponent(url); } catch { /* keep raw */ }
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /[?&](?:query|q|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /\/search\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

export function isShortMapsUrl(url) {
  return /maps\.app\.goo\.gl|goo\.gl\/maps/.test(url || '');
}

export function midOrder(prev, next) {
  if (prev == null && next == null) return ORDER_GAP;
  if (prev == null) return next - ORDER_GAP;
  if (next == null) return prev + ORDER_GAP;
  return (prev + next) / 2;
}

export function needsReorder(prev, next) {
  return prev != null && next != null && next - prev < 0.001;
}

export function sortByOrder(spots) {
  return [...spots].sort((a, b) => (a.order - b.order) || String(a.name).localeCompare(String(b.name)));
}

export function spotsForDay(spots, day) {
  return sortByOrder(spots.filter(s => s.day === day));
}

export function reassignOrders(daySpots) {
  return sortByOrder(daySpots).map((s, i) => ({ id: s.id, order: (i + 1) * ORDER_GAP }));
}

export function computeOrder(daySpots, afterId) {
  const list = sortByOrder(daySpots);
  const idx = afterId === 'first' ? -1 : list.findIndex(s => s.id === afterId);
  const prev = idx >= 0 ? list[idx].order : null;
  const next = list[idx + 1] ? list[idx + 1].order : null;
  if (needsReorder(prev, next)) {
    return { order: (idx + 1) * ORDER_GAP + ORDER_GAP / 2, reorder: reassignOrders(list) };
  }
  return { order: midOrder(prev, next), reorder: null };
}

export function placeUrl(spot) {
  if (spot.mapsUrl) return spot.mapsUrl;
  return `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`;
}

export function directionsUrl(from, to) {
  const p = new URLSearchParams({
    api: '1',
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: 'transit',
  });
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

export function nominatimUrl(q) {
  const p = new URLSearchParams({
    q, format: 'json', limit: '5', 'accept-language': 'zh-TW,ja',
    viewbox: '139.40,35.90,140.45,35.45', bounded: '1',
  });
  return `https://nominatim.openstreetmap.org/search?${p.toString()}`;
}

export function nominatimToChoices(results) {
  return (results || []).slice(0, 5).map(r => ({
    name: String(r.name || String(r.display_name || '').split(',')[0]).trim(),
    lat: Number(r.lat),
    lng: Number(r.lon),
    address: r.display_name || '',
  }));
}

export function defaultDay(days, today) {
  const hit = days.find(d => d.date === today);
  return (hit || days[0]).date;
}

export function seedToSpots(seed) {
  return seed.spots.map(s => ({ ...s, source: 'seed' }));
}
