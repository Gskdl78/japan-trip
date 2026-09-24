import { spotsForDay, defaultDay } from './util.js';
import { renderHeader, renderTabs, renderDay } from './render.js';
import { createMap } from './map.js';
import { createStore } from './store.js';
import { firebaseConfig, TRIP_ID, EDIT_PIN } from '../firebase-config.js';

const $ = id => document.getElementById(id);

const state = { seed: null, spots: [], activeDay: null, map: null, store: null, status: 'connecting' };

const STATUS_TEXT = {
  unconfigured: '尚未設定 Firebase，目前只顯示原始行程，無法新增（見 SETUP.md）',
  connecting: '連線中…',
  online: '已同步',
  offline: '離線中，顯示上次資料；恢復連線後自動同步',
  error: '資料庫連線失敗，顯示上次資料',
};
function setStatus(s) {
  state.status = s;
  const el = $('status');
  el.textContent = STATUS_TEXT[s] || s;
  el.className = 'status' + (s === 'online' ? ' online' : '');
  el.hidden = s === 'online';
  $('fab').disabled = !state.store.isReady();
}

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
  state.activeDay = defaultDay(state.seed.days, todayIso());
  state.map = createMap($('map'));
  renderHeader($('header'), state.seed.meta);
  state.store = createStore({
    config: firebaseConfig, tripId: TRIP_ID, seed: state.seed,
    onChange: spots => { state.spots = spots; renderAll(); },
    onStatus: setStatus,
  });
  setStatus('connecting');
  await state.store.connect();
}

main();
