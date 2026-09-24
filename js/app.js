import { spotsForDay, defaultDay, computeOrder, parseMapsUrl, isShortMapsUrl, nominatimUrl, nominatimToChoices } from './util.js';
import { renderHeader, renderTabs, renderDay, esc } from './render.js';
import { createMap } from './map.js';
import { createStore } from './store.js';
import { firebaseConfig, TRIP_ID, EDIT_PIN } from '../firebase-config.js';

const $ = id => document.getElementById(id);

const state = { seed: null, spots: [], activeDay: null, map: null, store: null, status: 'connecting' };

const STATUS_TEXT = {
  local: '尚未設定 Firebase：新增或修改只會存在這支手機，不會同步給別人（設定方式見 SETUP.md）',
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
  renderDay($('day'), dayInfo, spots, state.seed.meta.hotel, { onMenu: openMenu });
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

// ---------- PIN ----------
const PIN_KEY = 'japan-trip-pin-ok';

function ensurePin() {
  return new Promise(resolve => {
    if (!EDIT_PIN || localStorage.getItem(PIN_KEY) === '1') return resolve(true);
    const dlg = $('pin'); const input = $('pin-input'); const err = $('pin-error');
    input.value = ''; err.hidden = true;
    const form = dlg.querySelector('form');
    const onSubmit = e => {
      e.preventDefault();
      if (input.value.trim() === String(EDIT_PIN)) { localStorage.setItem(PIN_KEY, '1'); cleanup(); dlg.close(); resolve(true); }
      else { err.hidden = false; input.select(); }
    };
    const onCancel = () => { cleanup(); dlg.close(); resolve(false); };
    function cleanup() { form.removeEventListener('submit', onSubmit); $('pin-cancel').removeEventListener('click', onCancel); }
    form.addEventListener('submit', onSubmit);
    $('pin-cancel').addEventListener('click', onCancel);
    dlg.showModal();
  });
}

// ---------- 表單 ----------
let editing = null;   // 正在編輯的 spot，或 null 表示新增
let coords = null;    // { lat, lng }

function fillDayOptions(selectedDay) {
  $('form-day').innerHTML = state.seed.days.map(d =>
    `<option value="${d.date}"${d.date === selectedDay ? ' selected' : ''}>${d.label}（${d.weekday}）${d.title}</option>`).join('');
}
function fillAfterOptions(day, selectedAfter) {
  const list = spotsForDay(state.spots, day).filter(s => !editing || s.id !== editing.id);
  const opts = ['<option value="first">當天第一站</option>']
    .concat(list.map((s, i) => `<option value="${esc(s.id)}">${i + 1}. ${esc(s.name)}</option>`));
  $('form-after').innerHTML = opts.join('');
  const valid = selectedAfter && (selectedAfter === 'first' || list.some(s => s.id === selectedAfter));
  $('form-after').value = valid ? selectedAfter : (list.length ? list[list.length - 1].id : 'first');
}
function setCoords(c, msg) {
  coords = c;
  const f = $('spot-form');
  f.lat.value = c ? c.lat : ''; f.lng.value = c ? c.lng : '';
  $('coord-status').textContent = c ? `座標 ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` : (msg || '尚未取得座標');
}

function openForm(spot) {
  editing = spot;
  const f = $('spot-form');
  f.reset();
  $('search-results').innerHTML = '';
  $('parse-status').textContent = '';
  $('form-error').hidden = true;
  $('sheet-title').textContent = spot ? '編輯景點' : '新增景點';
  const day = spot ? spot.day : state.activeDay;
  fillDayOptions(day);
  let after = 'first';
  if (spot) {
    const list = spotsForDay(state.spots, day);
    const idx = list.findIndex(s => s.id === spot.id);
    after = idx > 0 ? list[idx - 1].id : 'first';
    f.name.value = spot.name; f.mapsUrl.value = spot.mapsUrl || ''; f.category.value = spot.category;
    f.timeHint.value = spot.timeHint || ''; f.station.value = spot.station || '';
    f.legFromPrev.value = spot.legFromPrev || ''; f.note.value = spot.note || '';
  }
  fillAfterOptions(day, after);
  setCoords(spot ? { lat: spot.lat, lng: spot.lng } : null);
  $('sheet').showModal();
}

$('form-day').addEventListener('change', e => fillAfterOptions(e.target.value, 'first'));

$('btn-search').addEventListener('click', async () => {
  const q = $('spot-form').name.value.trim();
  const ul = $('search-results');
  if (!q) { ul.innerHTML = '<li>請先輸入名稱</li>'; return; }
  ul.innerHTML = '<li>搜尋中…</li>';
  try {
    const res = await fetch(nominatimUrl(q), { headers: { 'Accept': 'application/json' } });
    const choices = nominatimToChoices(await res.json());
    if (!choices.length) { ul.innerHTML = '<li>找不到，請改貼 Google Maps 連結</li>'; return; }
    ul.innerHTML = choices.map((c, i) => `<li data-i="${i}">${esc(c.name)}<span class="addr">${esc(c.address)}</span></li>`).join('');
    ul.querySelectorAll('li').forEach(li => li.addEventListener('click', () => {
      ul.querySelectorAll('li').forEach(x => x.classList.remove('selected'));
      li.classList.add('selected');
      const c = choices[Number(li.dataset.i)];
      setCoords({ lat: c.lat, lng: c.lng });
    }));
  } catch (e) {
    ul.innerHTML = '<li>搜尋失敗（網路或服務暫時無法使用），請改貼連結</li>';
  }
});

$('btn-parse').addEventListener('click', () => {
  const url = $('spot-form').mapsUrl.value.trim();
  const c = parseMapsUrl(url);
  if (c) { setCoords(c); $('parse-status').textContent = '已從連結取得座標'; return; }
  $('parse-status').textContent = isShortMapsUrl(url)
    ? '短連結無法解析：請在 Google Maps 開啟後複製網址列的完整網址，或改用上面的搜尋'
    : '連結裡沒有座標，請改用搜尋，或在 Google Maps 長按地點複製座標貼到連結欄（例：35.71,139.79）';
});

$('btn-cancel').addEventListener('click', () => $('sheet').close());

$('spot-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const errEl = $('form-error');
  const rawUrl = f.mapsUrl.value.trim();
  let c = coords;
  if (!c) {
    const m = rawUrl.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (m) c = { lat: Number(m[1]), lng: Number(m[2]) };
  }
  if (!c) { errEl.textContent = '請先用「搜尋座標」或「從連結取座標」取得位置'; errEl.hidden = false; return; }
  const day = f.day.value;
  const list = spotsForDay(state.spots, day).filter(s => !editing || s.id !== editing.id);
  const { order, reorder } = computeOrder(list, f.after.value);
  const data = {
    day, order, lat: c.lat, lng: c.lng,
    name: f.name.value.trim(), category: f.category.value,
    timeHint: f.timeHint.value.trim(), station: f.station.value.trim(),
    legFromPrev: f.legFromPrev.value.trim(), note: f.note.value.trim(),
    mapsUrl: /^https?:\/\//.test(rawUrl) ? rawUrl : '',
  };
  if (reorder) state.store.reorder(reorder);
  if (editing) state.store.updateSpot(editing.id, data);
  else state.store.addSpot(data);
  state.activeDay = day;
  $('sheet').close();
});

// ---------- 選單與 FAB ----------
let menuSpot = null;

function openMenu(spot) {
  menuSpot = spot;
  $('menu-title').textContent = spot.name;
  $('menu').showModal();
}

$('menu').addEventListener('click', async e => {
  const act = e.target.dataset.act;
  if (!act) return;
  $('menu').close();
  if (act === 'close') return;
  if (!state.store.isReady()) { alert('尚未連線到資料庫，無法編輯'); return; }
  if (!(await ensurePin())) return;
  if (act === 'edit') openForm(menuSpot);
  if (act === 'delete' && confirm(`確定刪除「${menuSpot.name}」？`)) state.store.deleteSpot(menuSpot.id);
  if (act === 'restore' && confirm('補回所有被刪掉的原始景點？（不會覆蓋你改過的內容）')) state.store.restoreSeed();
});

$('fab').addEventListener('click', async () => {
  if (!state.store.isReady()) return;
  if (await ensurePin()) openForm(null);
});

main();
