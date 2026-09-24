import { spotsForDay, defaultDay, seedToSpots } from './util.js';
import { renderHeader, renderTabs, renderDay } from './render.js';
import { createMap } from './map.js';

const $ = id => document.getElementById(id);

const state = { seed: null, spots: [], activeDay: null, map: null };

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderAll() {
  renderTabs($('tabs'), state.seed.days, state.activeDay, date => { state.activeDay = date; renderAll(); });
  const dayInfo = state.seed.days.find(d => d.date === state.activeDay);
  const spots = spotsForDay(state.spots, state.activeDay);
  renderDay($('day'), dayInfo, spots, state.seed.meta.hotel, { onMenu: spot => console.log('menu', spot) });
  state.map.showDay(spots, id => {
    const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('flash');
    setTimeout(() => card.classList.remove('flash'), 1500);
  });
}

async function main() {
  state.seed = await (await fetch('data/itinerary.json')).json();
  state.spots = seedToSpots(state.seed);
  state.activeDay = defaultDay(state.seed.days, todayIso());
  state.map = createMap($('map'));
  renderHeader($('header'), state.seed.meta);
  renderAll();
}

main();
