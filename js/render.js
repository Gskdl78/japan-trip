import { CATEGORY_LABEL, placeUrl, directionsUrl } from './util.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderHeader(el, meta) {
  el.innerHTML = `
    <h1>${esc(meta.title)}</h1>
    <div class="meta">
      <div>🏨 <a href="${esc(meta.hotel.mapsUrl)}" target="_blank" rel="noopener">${esc(meta.hotel.name)}</a></div>
      <div>✈️ ${esc(meta.flights.out)}</div>
      <div>✈️ ${esc(meta.flights.back)}</div>
      <div>⏰ ${esc(meta.meet)}</div>
    </div>`;
}

export function renderTabs(el, days, activeDate, onSelect) {
  el.innerHTML = days.map(d =>
    `<button class="tab${d.date === activeDate ? ' active' : ''}" data-date="${esc(d.date)}">${esc(d.label)}（${esc(d.weekday)}）</button>`
  ).join('');
  el.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => onSelect(b.dataset.date)));
}

function cardHtml(spot, index, prevPoint) {
  const cat = CATEGORY_LABEL[spot.category] || spot.category;
  const nav = directionsUrl(prevPoint, spot);
  return `
    ${spot.legFromPrev ? `<div class="leg">🚶 ${esc(spot.legFromPrev)}</div>` : ''}
    <article class="card cat-${esc(spot.category)}" data-id="${esc(spot.id)}">
      <div class="num">${index + 1}</div>
      <div class="body">
        <div class="top">
          <span class="chip cat">${esc(cat)}</span>
          ${spot.timeHint ? `<span class="time">${esc(spot.timeHint)}</span>` : ''}
          ${spot.source === 'user' ? '<span class="chip user">新增</span>' : ''}
        </div>
        <h3>${esc(spot.name)}</h3>
        ${spot.station ? `<div class="station">🚉 ${esc(spot.station)}</div>` : ''}
        ${spot.address ? `<div class="station">📍 ${esc(spot.address)}</div>` : ''}
        ${spot.note ? `<p class="note">${esc(spot.note)}</p>` : ''}
        <div class="actions">
          <a class="btn" href="${esc(placeUrl(spot))}" target="_blank" rel="noopener">開地圖</a>
          <a class="btn" href="${esc(nav)}" target="_blank" rel="noopener">從上一站導航</a>
          <button class="more" data-act="menu" aria-label="更多">⋯</button>
        </div>
      </div>
    </article>`;
}

export function renderDay(el, dayInfo, spots, hotel, handlers) {
  const parts = [`<h2>${esc(dayInfo.label)}（${esc(dayInfo.weekday)}）${esc(dayInfo.title)}</h2>`];
  if (!spots.length) parts.push('<div class="empty">這天還沒有景點，按右下角 ＋ 新增。</div>');
  let prev = hotel;
  spots.forEach((s, i) => { parts.push(cardHtml(s, i, prev)); prev = s; });
  el.innerHTML = parts.join('');
  el.querySelectorAll('.card .more').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.card').dataset.id;
      handlers.onMenu(spots.find(s => s.id === id));
    });
  });
}
