# 日本快樂玩 手機行程網站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建一個手機直式的靜態行程網站（GitHub Pages 託管），內含 2026/9/30–10/5 東京行程、每日地圖與導航按鈕，並可透過 Firebase Firestore 多人同步新增、編輯、刪除景點。

**Architecture:** 純靜態網頁，無建置工具。`index.html` 載入 Leaflet（CDN）與 ESM 模組 `js/app.js`；`js/util.js` 放純函式（可用 Node 測試），`js/store.js` 包 Firestore 與 localStorage 快取，`js/render.js` 產生 DOM，`js/map.js` 包 Leaflet。原始行程放 `data/itinerary.json`，第一次連上 Firestore 時自動寫入。

**Tech Stack:** HTML/CSS/vanilla JS (ES modules)、Leaflet 1.9.4 + OpenStreetMap tiles、Firebase JS SDK 10.12.2 (Firestore, CDN ESM)、Nominatim 地理編碼、Node 24 內建 `node:test`。

## Global Constraints

- 不用任何前端框架或建置工具；瀏覽器直接執行 `type="module"` 的 JS。
- 手機直式優先，主要寬度 360–430px，字級不小於 15px，底部留安全區。
- 分類固定五種：`sight` 景點藍、`food` 餐廳橘、`shop` 購物綠、`transit` 交通灰、`hotel` 住宿紫。
- Firestore 路徑固定 `trips/{tripId}/spots/{spotId}`，`trips/{tripId}` 文件有 `seeded: true`。
- `order` 以 1000 為間隔；插入取中點；間隔小於 0.001 時重排當天。
- 所有外部資源皆免金鑰：Leaflet 與 Firebase 走 CDN，圖磚 `https://tile.openstreetmap.org/{z}/{x}/{y}.png`，地理編碼 `https://nominatim.openstreetmap.org/search`。
- 語言：介面文字繁體中文；程式註解可省略。
- 每個 Task 結束都 commit。

## File Structure

| 檔案 | 責任 |
|---|---|
| `package.json` | `"type": "module"` 與 `npm test` 指令 |
| `.gitignore` | 忽略 `node_modules` 與暫存 |
| `js/util.js` | 純函式：連結解析、排序、order 計算、URL 產生、Nominatim 轉換 |
| `tests/util.test.mjs` | `js/util.js` 的單元測試 |
| `data/itinerary.json` | 種子資料：meta、days、spots |
| `tests/seed.test.mjs` | 種子資料完整性測試 |
| `index.html` | 頁面骨架、三個 dialog、載入 CDN |
| `style.css` | 全部樣式（含深色模式） |
| `js/render.js` | 頁首、日期分頁、每日時間軸的 DOM 產生 |
| `js/map.js` | Leaflet 地圖包裝 |
| `js/store.js` | Firestore 連線、種子寫入、快取、CRUD |
| `firebase-config.example.js` | 設定範本 |
| `firebase-config.js` | 實際設定（初始為空值，使用者填入） |
| `firestore.rules` | 安全規則 |
| `js/app.js` | 狀態、事件、表單、PIN、把以上組起來 |
| `SETUP.md` | 使用者的 Firebase 與 GitHub Pages 設定步驟與手動測試清單 |

---

### Task 1: 專案骨架與純函式模組 `js/util.js`

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `js/util.js`
- Test: `tests/util.test.mjs`

**Interfaces:**
- Produces（後續 Task 都會用）:
  - `CATEGORY_LABEL: Record<string,string>`、`ORDER_GAP = 1000`
  - `parseMapsUrl(url: string): {lat:number,lng:number} | null`
  - `isShortMapsUrl(url: string): boolean`
  - `midOrder(prev: number|null, next: number|null): number`
  - `needsReorder(prev: number|null, next: number|null): boolean`
  - `sortByOrder(spots: Spot[]): Spot[]`
  - `spotsForDay(spots: Spot[], day: string): Spot[]`
  - `reassignOrders(daySpots: Spot[]): {id:string, order:number}[]`
  - `computeOrder(daySpots: Spot[], afterId: string|'first'): {order:number, reorder: {id,order}[]|null}`
  - `placeUrl(spot: Spot): string`
  - `directionsUrl(from: {lat,lng}, to: {lat,lng}): string`
  - `nominatimUrl(q: string): string`
  - `nominatimToChoices(results: any[]): {name,lat,lng,address}[]`
  - `defaultDay(days: {date:string}[], today: string): string`
  - `seedToSpots(seed: {spots: Spot[]}): Spot[]`（加上 `source:'seed'`）

- [ ] **Step 1: 建 package.json 與 .gitignore**

`package.json`:
```json
{
  "name": "japan-trip",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "serve": "python -m http.server 8080"
  }
}
```

`.gitignore`:
```
node_modules/
.DS_Store
Thumbs.db
```

- [ ] **Step 2: 寫失敗的測試 `tests/util.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMapsUrl, isShortMapsUrl, midOrder, needsReorder, sortByOrder, spotsForDay,
  reassignOrders, computeOrder, placeUrl, directionsUrl, nominatimUrl,
  nominatimToChoices, defaultDay, seedToSpots, ORDER_GAP,
} from '../js/util.js';

test('parseMapsUrl 優先讀 !3d!4d', () => {
  const u = 'https://www.google.com/maps/place/X/@35.72,139.71,17z/data=!3m1!4b1!4m6!3m5!1s0x1:0x2!8m2!3d35.7276362!4d139.7137833';
  assert.deepEqual(parseMapsUrl(u), { lat: 35.7276362, lng: 139.7137833 });
});

test('parseMapsUrl 讀 @lat,lng', () => {
  assert.deepEqual(parseMapsUrl('https://www.google.com/maps/@35.6616064,139.6694506,19z'), { lat: 35.6616064, lng: 139.6694506 });
});

test('parseMapsUrl 讀 query=lat,lng 與 q=', () => {
  assert.deepEqual(parseMapsUrl('https://www.google.com/maps/search/?api=1&query=35.71,139.79'), { lat: 35.71, lng: 139.79 });
  assert.deepEqual(parseMapsUrl('https://maps.google.com/?q=35.71,139.79'), { lat: 35.71, lng: 139.79 });
});

test('parseMapsUrl 無座標回傳 null', () => {
  assert.equal(parseMapsUrl('https://maps.app.goo.gl/abc123'), null);
  assert.equal(parseMapsUrl('hello'), null);
  assert.equal(parseMapsUrl(null), null);
});

test('isShortMapsUrl', () => {
  assert.equal(isShortMapsUrl('https://maps.app.goo.gl/abc'), true);
  assert.equal(isShortMapsUrl('https://www.google.com/maps/place/x'), false);
});

test('midOrder', () => {
  assert.equal(midOrder(null, null), ORDER_GAP);
  assert.equal(midOrder(null, 1000), 0);
  assert.equal(midOrder(3000, null), 4000);
  assert.equal(midOrder(1000, 2000), 1500);
});

test('needsReorder 只在間隔太小時為真', () => {
  assert.equal(needsReorder(1000, 2000), false);
  assert.equal(needsReorder(null, 1000), false);
  assert.equal(needsReorder(1000, 1000.0005), true);
});

const spots = [
  { id: 'b', day: 'd1', order: 2000, name: 'B' },
  { id: 'a', day: 'd1', order: 1000, name: 'A' },
  { id: 'c', day: 'd2', order: 1000, name: 'C' },
];

test('sortByOrder 與 spotsForDay', () => {
  assert.deepEqual(sortByOrder(spots).map(s => s.id), ['a', 'c', 'b']);
  assert.deepEqual(spotsForDay(spots, 'd1').map(s => s.id), ['a', 'b']);
});

test('reassignOrders 依序給 1000,2000…', () => {
  assert.deepEqual(reassignOrders(spotsForDay(spots, 'd1')), [{ id: 'a', order: 1000 }, { id: 'b', order: 2000 }]);
});

test('computeOrder 放在第一站', () => {
  assert.deepEqual(computeOrder(spotsForDay(spots, 'd1'), 'first'), { order: 0, reorder: null });
});

test('computeOrder 放在 a 之後', () => {
  assert.deepEqual(computeOrder(spotsForDay(spots, 'd1'), 'a'), { order: 1500, reorder: null });
});

test('computeOrder 放在最後', () => {
  assert.deepEqual(computeOrder(spotsForDay(spots, 'd1'), 'b'), { order: 3000, reorder: null });
});

test('computeOrder 間隔太小時重排', () => {
  const tight = [{ id: 'x', day: 'd', order: 1 }, { id: 'y', day: 'd', order: 1.0001 }];
  const r = computeOrder(tight, 'x');
  assert.deepEqual(r.reorder, [{ id: 'x', order: 1000 }, { id: 'y', order: 2000 }]);
  assert.equal(r.order, 1500);
});

test('placeUrl 用原連結，否則用座標', () => {
  assert.equal(placeUrl({ mapsUrl: 'https://x', lat: 1, lng: 2 }), 'https://x');
  assert.equal(placeUrl({ lat: 35.7, lng: 139.7 }), 'https://www.google.com/maps/search/?api=1&query=35.7,139.7');
});

test('directionsUrl 為大眾運輸模式', () => {
  const u = directionsUrl({ lat: 1, lng: 2 }, { lat: 3, lng: 4 });
  assert.ok(u.startsWith('https://www.google.com/maps/dir/?'));
  assert.ok(u.includes('origin=1%2C2'));
  assert.ok(u.includes('destination=3%2C4'));
  assert.ok(u.includes('travelmode=transit'));
});

test('nominatimUrl 帶東京範圍', () => {
  const u = nominatimUrl('雷門');
  assert.ok(u.startsWith('https://nominatim.openstreetmap.org/search?'));
  assert.ok(u.includes('format=json'));
  assert.ok(u.includes('viewbox='));
  assert.ok(u.includes('bounded=1'));
});

test('nominatimToChoices 轉換前 5 筆', () => {
  const raw = Array.from({ length: 7 }, (_, i) => ({ name: 'N' + i, lat: '35.1', lon: '139.2', display_name: 'N' + i + ', 東京都' }));
  const c = nominatimToChoices(raw);
  assert.equal(c.length, 5);
  assert.deepEqual(c[0], { name: 'N0', lat: 35.1, lng: 139.2, address: 'N0, 東京都' });
});

test('nominatimToChoices 無 name 時取 display_name 第一段', () => {
  const c = nominatimToChoices([{ lat: '1', lon: '2', display_name: '花月堂, 浅草' }]);
  assert.equal(c[0].name, '花月堂');
});

test('defaultDay', () => {
  const days = [{ date: '2026-09-30' }, { date: '2026-10-01' }];
  assert.equal(defaultDay(days, '2026-10-01'), '2026-10-01');
  assert.equal(defaultDay(days, '2026-12-25'), '2026-09-30');
});

test('seedToSpots 標記 source seed', () => {
  assert.deepEqual(seedToSpots({ spots: [{ id: 'a' }] }), [{ id: 'a', source: 'seed' }]);
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npm test`
Expected: 失敗，訊息含 `Cannot find module` 或 `ERR_MODULE_NOT_FOUND`（`js/util.js` 不存在）。

- [ ] **Step 4: 實作 `js/util.js`**

```js
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
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npm test`
Expected: 全部 PASS，`# fail 0`。

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore js/util.js tests/util.test.mjs
git commit -m "feat: 純函式模組 util.js 與測試"
```

---

### Task 2: 種子資料 `data/itinerary.json` 與完整性測試

**Files:**
- Create: `data/itinerary.json`
- Test: `tests/seed.test.mjs`

**Interfaces:**
- Produces: JSON 結構
  ```
  { meta: { title, meet, flights: { out, back }, hotel: { name, lat, lng, mapsUrl } },
    days: [{ date: 'YYYY-MM-DD', label: 'M/D', weekday: '三', title }],
    spots: [{ id, day, order, name, category, timeHint, lat, lng, station, legFromPrev, note, mapsUrl }] }
  ```
- 所有 Spot 都有全部欄位（可為空字串）。座標為估計者在 `note` 註明「座標為估計」。

- [ ] **Step 1: 寫失敗的測試 `tests/seed.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync(new URL('../data/itinerary.json', import.meta.url), 'utf8'));
const CATS = ['sight', 'food', 'shop', 'transit', 'hotel'];
const FIELDS = ['id', 'day', 'order', 'name', 'category', 'timeHint', 'lat', 'lng', 'station', 'legFromPrev', 'note', 'mapsUrl'];

test('有 6 天，日期連續', () => {
  assert.equal(seed.days.length, 6);
  assert.deepEqual(seed.days.map(d => d.date), ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
});

test('meta 有飯店座標', () => {
  assert.equal(typeof seed.meta.hotel.lat, 'number');
  assert.equal(typeof seed.meta.hotel.lng, 'number');
  assert.ok(seed.meta.hotel.name.includes('KOKO'));
});

test('每個 spot 欄位齊全、分類合法、座標在東京圈', () => {
  const dayset = new Set(seed.days.map(d => d.date));
  for (const s of seed.spots) {
    for (const f of FIELDS) assert.ok(f in s, `${s.id} 缺 ${f}`);
    assert.ok(dayset.has(s.day), `${s.id} day 不合法`);
    assert.ok(CATS.includes(s.category), `${s.id} category 不合法`);
    assert.ok(s.lat > 35.4 && s.lat < 35.9, `${s.id} lat`);
    assert.ok(s.lng > 139.4 && s.lng < 140.5, `${s.id} lng`);
    assert.ok(s.name.length > 0);
  }
});

test('id 唯一，同一天 order 唯一且為 1000 倍數', () => {
  const ids = new Set();
  const perDay = {};
  for (const s of seed.spots) {
    assert.ok(!ids.has(s.id), `重複 id ${s.id}`);
    ids.add(s.id);
    perDay[s.day] ??= new Set();
    assert.ok(!perDay[s.day].has(s.order), `${s.day} 重複 order ${s.order}`);
    perDay[s.day].add(s.order);
    assert.equal(s.order % 1000, 0);
  }
});

test('HackMD 上的所有景點都在', () => {
  const names = seed.spots.map(s => s.name).join('\n');
  for (const n of ['OS Drug', '阿美橫町', '上野之森', '二木', '唐吉軻德', 'とんかつ山家', '雷門', '淺草炸肉餅', '花月堂', '壽壽喜園', 'Animate', '晴空塔', 'だるま', 'あぶる', '吉伊卡哇', '藍瓶', '四文錢', 'KIDDYLAND', 'LUMINE', '46ma', 'Shelter', 'Marché', '@cosme', 'Tower Records', 'SWEET PALACE', '阿夫利', '東京鐵塔', '地瓜球']) {
    assert.ok(names.includes(n), `缺少 ${n}`);
  }
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: `tests/seed.test.mjs` 失敗（找不到 `data/itinerary.json`）。

- [ ] **Step 3: 建立 `data/itinerary.json`**

```json
{
  "meta": {
    "title": "日本快樂玩",
    "meet": "9/30 07:00 桃園機場第二航廈集合",
    "flights": {
      "out": "9/30 桃園 09:00 → 成田 13:25",
      "back": "10/5 成田 20:40 → 桃園 23:20"
    },
    "hotel": {
      "name": "KOKO HOTEL 上野駅前",
      "lat": 35.7099558,
      "lng": 139.7768379,
      "mapsUrl": "https://www.google.com/maps/search/?api=1&query=KOKO+HOTEL+%E4%B8%8A%E9%87%8E%E9%A7%85%E5%89%8D"
    }
  },
  "days": [
    { "date": "2026-09-30", "label": "9/30", "weekday": "三", "title": "上野入住與晚餐" },
    { "date": "2026-10-01", "label": "10/1", "weekday": "四", "title": "淺草、秋葉原、晴空塔" },
    { "date": "2026-10-02", "label": "10/2", "weekday": "五", "title": "池袋、吉伊卡哇樂園、新宿" },
    { "date": "2026-10-03", "label": "10/3", "weekday": "六", "title": "下北澤、澀谷、原宿" },
    { "date": "2026-10-04", "label": "10/4", "weekday": "日", "title": "東京鐵塔、港區" },
    { "date": "2026-10-05", "label": "10/5", "weekday": "一", "title": "回程" }
  ],
  "spots": [
    { "id": "s0930-01", "day": "2026-09-30", "order": 1000, "name": "成田機場 第2航廈 → Skyliner", "category": "transit", "timeHint": "13:25 抵達", "lat": 35.7732544, "lng": 140.3875885, "station": "京成 空港第2ビル站（B1）搭 Skyliner → 京成上野 約 45 分", "legFromPrev": "", "note": "Skyliner 票已買、eSIM 已買。出關後跟指標往 B1 京成線。", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E6%88%90%E7%94%B0%E5%9C%8B%E9%9A%9B%E6%A9%9F%E5%A0%B4%E7%AC%AC2%E8%88%AA%E5%BB%88" },
    { "id": "s0930-02", "day": "2026-09-30", "order": 2000, "name": "KOKO HOTEL 上野駅前（放行李）", "category": "hotel", "timeHint": "約 14:30", "lat": 35.7099558, "lng": 139.7768379, "station": "京成上野站 / JR 上野站 淺草口", "legFromPrev": "Skyliner 約 45 分到京成上野，出站步行約 6 分", "note": "正式入住通常 15:00 後，先寄放行李。", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=KOKO+HOTEL+%E4%B8%8A%E9%87%8E%E9%A7%85%E5%89%8D" },
    { "id": "s0930-03", "day": "2026-09-30", "order": 3000, "name": "上野之森櫻花台 4F 觀景", "category": "sight", "timeHint": "", "lat": 35.7121254, "lng": 139.7744994, "station": "JR 上野站 不忍口 正對面", "legFromPrev": "步行約 6 分", "note": "拍照點，4F 露台可看上野站與中央通。", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E4%B8%8A%E9%87%8E%E3%81%AE%E6%A3%AE%E3%81%95%E3%81%8F%E3%82%89%E3%83%86%E3%83%A9%E3%82%B9" },
    { "id": "s0930-04", "day": "2026-09-30", "order": 4000, "name": "阿美橫町", "category": "shop", "timeHint": "午餐 + 逛街", "lat": 35.7100241, "lng": 139.7745414, "station": "JR 上野站 不忍口", "legFromPrev": "步行 2 分，過馬路即入口", "note": "由上野端往御徒町端一路逛，下面幾家店都在這條街上。", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E3%82%A2%E3%83%A1%E6%A8%AA" },
    { "id": "s0930-05", "day": "2026-09-30", "order": 5000, "name": "OS Drug 上野店", "category": "shop", "timeHint": "", "lat": 35.7093, "lng": 139.7742, "station": "阿美橫町內", "legFromPrev": "阿美橫町內 步行 2 分", "note": "藥妝，價格便宜但不能刷卡、無免稅，記得帶現金。座標為估計，開地圖以搜尋結果為準。", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=OS+Drug+%E4%B8%8A%E9%87%8E%E5%BA%97" },
    { "id": "s0930-06", "day": "2026-09-30", "order": 6000, "name": "唐吉軻德 上野店", "category": "shop", "timeHint": "", "lat": 35.7081871, "lng": 139.7744446, "station": "阿美橫町內", "legFromPrev": "步行 2 分", "note": "", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E3%83%89%E3%83%B3%E3%83%BB%E3%82%AD%E3%83%9B%E3%83%BC%E3%83%86+%E4%B8%8A%E9%87%8E%E5%BA%97" },
    { "id": "s0930-07", "day": "2026-09-30", "order": 7000, "name": "二木の菓子 第一営業所", "category": "shop", "timeHint": "", "lat": 35.7083752, "lng": 139.7744702, "station": "阿美橫町內", "legFromPrev": "步行 1 分", "note": "零食伴手禮。", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E4%BA%8C%E6%9C%A8%E3%81%AE%E8%8F%93%E5%AD%90+%E7%AC%AC%E4%B8%80%E5%96%B6%E6%A5%AD%E6%89%80" },
    { "id": "s0930-08", "day": "2026-09-30", "order": 8000, "name": "とんかつ山家 御徒町店", "category": "food", "timeHint": "晚餐", "lat": 35.7082781, "lng": 139.7754465, "station": "JR 御徒町站 北口 步行 2 分", "legFromPrev": "步行 2 分", "note": "炸豬排。吃完步行約 10 分回飯店，或 JR 御徒町 → 上野 1 站。", "mapsUrl": "https://www.google.com/maps/place/%E3%81%A8%E3%82%93%E3%81%8B%E3%81%A4%E5%B1%B1%E5%AE%B6+%E5%BE%A1%E5%BE%92%E7%94%BA%E5%BA%97/data=!4m2!3m1!1s0x60188e9f78788d15:0x99613d7cc180c7f2" },

    { "id": "s1001-01", "day": "2026-10-01", "order": 1000, "name": "雷門", "category": "sight", "timeHint": "上午", "lat": 35.7111333, "lng": 139.7963683, "station": "銀座線 淺草站 1 號出口", "legFromPrev": "上野站 銀座線（往淺草）→ 淺草 約 5 分", "note": "", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E9%9B%B7%E9%96%80" },
    { "id": "s1001-02", "day": "2026-10-01", "order": 2000, "name": "淺草炸肉餅", "category": "food", "timeHint": "", "lat": 35.7128930, "lng": 139.7960619, "station": "", "legFromPrev": "穿過仲見世通，步行 4 分（傳法院通）", "note": "", "mapsUrl": "https://www.google.com/maps/place/%E6%B7%BA%E8%8D%89%E7%82%B8%E8%82%89%E9%A4%85/data=!4m2!3m1!1s0x60188ec121f3c5d5:0x9fe1c9087625b6c6" },
    { "id": "s1001-03", "day": "2026-10-01", "order": 3000, "name": "淺草 花月堂 本店", "category": "food", "timeHint": "", "lat": 35.7146089, "lng": 139.7951894, "station": "", "legFromPrev": "步行 3 分（西參道）", "note": "波蘿麵包。", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E8%8A%B1%E6%9C%88%E5%A0%82%E6%9C%AC%E5%BA%97+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%892-7-13" },
    { "id": "s1001-04", "day": "2026-10-01", "order": 4000, "name": "淺草寺", "category": "sight", "timeHint": "", "lat": 35.7134032, "lng": 139.7955265, "station": "", "legFromPrev": "步行 2 分", "note": "", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E5%AF%BA" },
    { "id": "s1001-05", "day": "2026-10-01", "order": 5000, "name": "壽壽喜園 淺草本店", "category": "food", "timeHint": "", "lat": 35.7163788, "lng": 139.7969350, "station": "", "legFromPrev": "步行 5 分", "note": "抹茶冰淇淋。", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E5%A3%BD%E3%80%85%E5%96%9C%E5%9C%92%E6%B5%85%E8%8D%89%E6%9C%AC%E5%BA%97+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%893-4-3" },
    { "id": "s1001-06", "day": "2026-10-01", "order": 6000, "name": "Animate Akihabara", "category": "shop", "timeHint": "下午", "lat": 35.7010, "lng": 139.7717, "station": "TX 秋葉原站 A3 出口 步行 5 分 / 銀座線 末廣町站 步行 3 分", "legFromPrev": "步行 8 分到 TX 淺草站 → つくばエクスプレス → 秋葉原 約 5 分", "note": "座標為估計，開地圖以連結為準。", "mapsUrl": "https://www.google.com/maps/place/Animate+Akihabara/data=!4m2!3m1!1s0x0:0x9276f70f9d512927" },
    { "id": "s1001-07", "day": "2026-10-01", "order": 7000, "name": "東京晴空塔", "category": "sight", "timeHint": "傍晚", "lat": 35.7100543, "lng": 139.8107141, "station": "押上（晴空塔前）站", "legFromPrev": "JR 秋葉原 總武線 → 錦糸町 轉 半藏門線 → 押上 約 20 分", "note": "", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E3%82%B9%E3%82%AB%E3%82%A4%E3%83%84%E3%83%AA%E3%83%BC" },
    { "id": "s1001-08", "day": "2026-10-01", "order": 8000, "name": "文字燒 だるま", "category": "food", "timeHint": "晚餐", "lat": 35.7101381, "lng": 139.8122049, "station": "押上站 步行 3 分", "legFromPrev": "步行 3 分", "note": "", "mapsUrl": "https://maps.app.goo.gl/awQofCorxQpi29Yk9" },
    { "id": "s1001-09", "day": "2026-10-01", "order": 9000, "name": "回上野飯店", "category": "transit", "timeHint": "", "lat": 35.7099558, "lng": 139.7768379, "station": "押上 都營淺草線 → 淺草 轉 銀座線 → 上野 約 20 分", "legFromPrev": "", "note": "", "mapsUrl": "" },

    { "id": "s1002-01", "day": "2026-10-02", "order": 1000, "name": "焼肉あぶる。池袋店（前男友燒肉）", "category": "food", "timeHint": "午餐", "lat": 35.7305, "lng": 139.7100, "station": "JR 池袋站", "legFromPrev": "上野站 JR 山手線（往池袋方向）→ 池袋 約 17 分", "note": "座標為估計，開地圖以連結為準。", "mapsUrl": "https://www.google.com/maps?ftid=0x60188d60a88c3d57:0xab3e495a730dad11" },
    { "id": "s1002-02", "day": "2026-10-02", "order": 2000, "name": "吉伊卡哇樂園（ちいかわパーク）", "category": "sight", "timeHint": "14:00 場次", "lat": 35.7302409, "lng": 139.7173053, "station": "池袋站 東口 步行 10 分 / 有樂町線 東池袋站", "legFromPrev": "步行約 10 分（Sunshine 60 通）", "note": "14:00 場次，建議提早 15 分到。", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E3%81%A1%E3%81%84%E3%81%8B%E3%82%8F%E3%83%91%E3%83%BC%E3%82%AF+%E6%B1%A0%E8%A2%8B" },
    { "id": "s1002-03", "day": "2026-10-02", "order": 3000, "name": "藍瓶咖啡 池袋店", "category": "food", "timeHint": "下午", "lat": 35.7276406, "lng": 139.7137615, "station": "池袋站 東口 步行 5 分", "legFromPrev": "步行約 6 分", "note": "", "mapsUrl": "https://www.google.com/maps/place/%E8%97%8D%E7%93%B6%E5%92%96%E5%95%A1+%E6%B1%A0%E8%A2%8B%E5%BA%97/@35.7276362,139.7137833,17z/data=!4m6!3m5!1s0x60188d040861bbe3:0xd83d45207762f5d2!8m2!3d35.7276362!4d139.7137833" },
    { "id": "s1002-04", "day": "2026-10-02", "order": 4000, "name": "LUMINE Shinjuku 1", "category": "shop", "timeHint": "傍晚", "lat": 35.6892039, "lng": 139.699147, "station": "JR 新宿站 南口 直結", "legFromPrev": "步行回池袋站 → JR 山手線 / 埼京線 → 新宿 約 9 分", "note": "逛衣服。", "mapsUrl": "https://maps.app.goo.gl/E8uHqvUcmSXp1XNN9" },
    { "id": "s1002-05", "day": "2026-10-02", "order": 5000, "name": "KIDDYLAND Shinjuku", "category": "shop", "timeHint": "", "lat": 35.6929851, "lng": 139.7009716, "station": "丸之內線 新宿三丁目站", "legFromPrev": "步行約 8 分", "note": "", "mapsUrl": "https://www.google.com/maps/place/KIDDYLAND+Shinjuku/@35.6932838,139.6938535,16.5z/data=!4m10!1m2!2m1!1sKiddy+Land!3m6!1s0x60188d00684788d9:0xd0b22ab61771810a!8m2!3d35.6929851!4d139.7009716" },
    { "id": "s1002-06", "day": "2026-10-02", "order": 6000, "name": "四文錢 新宿東口店", "category": "food", "timeHint": "晚餐", "lat": 35.6925, "lng": 139.7030, "station": "JR 新宿站 東口", "legFromPrev": "步行 3 分", "note": "九州料理與博多高湯關東煮。座標為估計，開地圖以連結為準。", "mapsUrl": "https://www.google.com/maps/place/Shimonsen+Shinjuku/data=!4m2!3m1!1s0x0:0x6d4e86e8fdda01ee" },
    { "id": "s1002-07", "day": "2026-10-02", "order": 7000, "name": "回上野飯店", "category": "transit", "timeHint": "", "lat": 35.7099558, "lng": 139.7768379, "station": "JR 新宿 山手線（往池袋方向）→ 上野 約 25 分", "legFromPrev": "", "note": "", "mapsUrl": "" },

    { "id": "s1003-01", "day": "2026-10-03", "order": 1000, "name": "46ma", "category": "food", "timeHint": "午餐", "lat": 35.6620, "lng": 139.6680, "station": "下北澤站", "legFromPrev": "上野 JR 山手線 → 澀谷 轉 京王井之頭線 → 下北澤 約 45 分", "note": "座標為估計，開地圖以連結為準。", "mapsUrl": "https://www.google.com/maps/place/46ma/data=!4m2!3m1!1s0x0:0x4bc03d8aa3019f2f" },
    { "id": "s1003-02", "day": "2026-10-03", "order": 2000, "name": "Shelter Shimokitazawa（孤獨搖滾）", "category": "sight", "timeHint": "", "lat": 35.661482, "lng": 139.6694661, "station": "下北澤站 南西口", "legFromPrev": "步行 2 分", "note": "孤獨搖滾 STARRY 原型 live house。", "mapsUrl": "https://www.google.com/maps/place/Shelter+Shimokitazawa/@35.6616064,139.6694506,19.25z/data=!4m6!3m5!1s0x6018f36a1800c2b1:0x8441942493bd853a!8m2!3d35.661482!4d139.6694661" },
    { "id": "s1003-03", "day": "2026-10-03", "order": 3000, "name": "Marché 下北澤（孤獨搖滾）", "category": "sight", "timeHint": "", "lat": 35.6615693, "lng": 139.6682855, "station": "下北澤站 南西口", "legFromPrev": "步行 1 分", "note": "孤獨搖滾取景地。", "mapsUrl": "https://www.google.com/maps/place/March%C3%A9%E4%B8%8B%E5%8C%97%E6%BE%A4/@35.6611942,139.6681276,19.25z/data=!4m6!3m5!1s0x6018f36a35c0ad85:0x59a987fd3ecbd4e2!8m2!3d35.6615693!4d139.6682855" },
    { "id": "s1003-04", "day": "2026-10-03", "order": 4000, "name": "Tower Records 澀谷店", "category": "shop", "timeHint": "下午", "lat": 35.6619049, "lng": 139.7010906, "station": "澀谷站 ハチ公口 步行 5 分", "legFromPrev": "下北澤 京王井之頭線（急行）→ 澀谷 約 5 分", "note": "", "mapsUrl": "https://maps.app.goo.gl/gWLnNPUr5XbzJps28" },
    { "id": "s1003-05", "day": "2026-10-03", "order": 5000, "name": "SWEET PALACE Crepes 竹下通", "category": "food", "timeHint": "", "lat": 35.6714, "lng": 139.7042, "station": "JR 原宿站 竹下口", "legFromPrev": "步行回澀谷站 → JR 山手線 1 站 → 原宿 竹下口（或沿明治通步行 20 分）", "note": "可麗餅。座標為估計，開地圖以連結為準。", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=SWEET+PALACE+Crepes+Harajuku+Takeshita+Street" },
    { "id": "s1003-06", "day": "2026-10-03", "order": 6000, "name": "@cosme TOKYO 原宿旗艦店", "category": "shop", "timeHint": "", "lat": 35.6701642, "lng": 139.7031325, "station": "JR 原宿站 竹下口 正對面", "legFromPrev": "步行 3 分", "note": "", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%40cosme+TOKYO+%E5%8E%9F%E5%AE%BF" },
    { "id": "s1003-07", "day": "2026-10-03", "order": 7000, "name": "阿夫利 原宿", "category": "food", "timeHint": "晚餐", "lat": 35.6730053, "lng": 139.7038019, "station": "JR 原宿站 竹下口 步行 4 分", "legFromPrev": "步行 5 分", "note": "柚子鹽拉麵。", "mapsUrl": "https://maps.app.goo.gl/5pxqaAtsywj5xe4G6" },
    { "id": "s1003-08", "day": "2026-10-03", "order": 8000, "name": "回上野飯店", "category": "transit", "timeHint": "", "lat": 35.7099558, "lng": 139.7768379, "station": "JR 原宿 山手線（往新宿方向）→ 上野 約 30 分", "legFromPrev": "", "note": "", "mapsUrl": "" },

    { "id": "s1004-01", "day": "2026-10-04", "order": 1000, "name": "東京鐵塔", "category": "sight", "timeHint": "", "lat": 35.6584491, "lng": 139.7455360, "station": "日比谷線 神谷町站 步行 7 分 / 大江戶線 赤羽橋站 步行 5 分", "legFromPrev": "上野 日比谷線（往中目黑）→ 神谷町 約 25 分", "note": "港區其他景點請用 + 新增。", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E3%82%BF%E3%83%AF%E3%83%BC" },

    { "id": "s1005-01", "day": "2026-10-05", "order": 1000, "name": "地瓜球（澀谷）", "category": "food", "timeHint": "上午", "lat": 35.662804, "lng": 139.6994737, "station": "JR 澀谷站 ハチ公口 步行 5 分", "legFromPrev": "上野 JR 山手線 → 澀谷 約 30 分", "note": "原連結指向 LINE FRIENDS Square Shibuya 位置。", "mapsUrl": "https://maps.app.goo.gl/2yrWsYx81hKVnJRY7" },
    { "id": "s1005-02", "day": "2026-10-05", "order": 2000, "name": "京成上野 → Skyliner → 成田機場", "category": "transit", "timeHint": "17:00 前出發", "lat": 35.7111363, "lng": 139.7739137, "station": "京成上野站 搭 Skyliner 約 45 分 → 空港第2ビル", "legFromPrev": "澀谷 山手線 → 上野 回飯店取行李，步行到京成上野", "note": "20:40 起飛，建議 18:00 前抵達機場。", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=%E4%BA%AC%E6%88%90%E4%B8%8A%E9%87%8E%E9%A7%85" }
  ]
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add data/itinerary.json tests/seed.test.mjs
git commit -m "feat: 種子行程資料（含座標與交通指引）"
```

---

### Task 3: 頁面骨架、樣式與靜態渲染（無 Firebase）

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `js/render.js`
- Create: `js/app.js`（本 Task 只做讀 JSON 與渲染；後續 Task 擴充）

**Interfaces:**
- Consumes: `js/util.js` 的 `CATEGORY_LABEL, placeUrl, directionsUrl, spotsForDay, defaultDay, seedToSpots`
- Produces（`js/render.js`）:
  - `esc(s: any): string`
  - `renderHeader(el: HTMLElement, meta): void`
  - `renderTabs(el: HTMLElement, days, activeDate: string, onSelect: (date)=>void): void`
  - `renderDay(el: HTMLElement, dayInfo, spots: Spot[], hotel: {lat,lng}, handlers: { onMenu: (spot)=>void }): void`
    - 卡片有 `data-id`，圖釘點擊時 app 會 `querySelector('[data-id="…"]')` 捲動並加 `.flash`
- `index.html` 內固定 id：`header`、`tabs`、`status`、`day`、`map`、`fab`、`sheet`、`menu`、`pin`

- [ ] **Step 1: 建立 `index.html`**

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1f5fbf">
<title>日本快樂玩</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<link rel="stylesheet" href="style.css">
</head>
<body>
<header id="header" class="header"></header>
<nav id="tabs" class="tabs" aria-label="日期"></nav>
<div id="status" class="status" hidden></div>
<main id="day" class="day"></main>
<section class="map-wrap">
  <div class="map-title">當天地圖</div>
  <div id="map" class="map"></div>
</section>
<button id="fab" class="fab" aria-label="新增景點">＋</button>

<dialog id="sheet" class="sheet">
  <form id="spot-form" method="dialog" class="form">
    <h2 id="sheet-title">新增景點</h2>
    <label>名稱 <input name="name" required autocomplete="off"></label>
    <div class="row">
      <button type="button" id="btn-search" class="btn small">搜尋座標</button>
      <span id="coord-status" class="muted">尚未取得座標</span>
    </div>
    <ul id="search-results" class="results"></ul>
    <label>或貼 Google Maps 連結
      <input name="mapsUrl" inputmode="url" placeholder="https://www.google.com/maps/…">
    </label>
    <div class="row">
      <button type="button" id="btn-parse" class="btn small">從連結取座標</button>
      <span id="parse-status" class="muted"></span>
    </div>
    <input type="hidden" name="lat"><input type="hidden" name="lng">
    <label>分類
      <select name="category">
        <option value="sight">景點</option><option value="food">餐廳</option>
        <option value="shop">購物</option><option value="transit">交通</option><option value="hotel">住宿</option>
      </select>
    </label>
    <label>時段（例：午餐、14:00）<input name="timeHint"></label>
    <label>最近車站 / 出口<input name="station"></label>
    <label>怎麼從上一站過來（例：步行 5 分、銀座線 淺草→上野）<input name="legFromPrev"></label>
    <label>備註<textarea name="note" rows="2"></textarea></label>
    <label>日期<select name="day" id="form-day"></select></label>
    <label>放在哪一站之後<select name="after" id="form-after"></select></label>
    <p id="form-error" class="error" hidden></p>
    <div class="row end">
      <button type="button" id="btn-cancel" class="btn ghost">取消</button>
      <button type="submit" class="btn primary">儲存</button>
    </div>
  </form>
</dialog>

<dialog id="menu" class="menu">
  <div class="menu-title" id="menu-title"></div>
  <button class="menu-item" data-act="edit">編輯</button>
  <button class="menu-item danger" data-act="delete">刪除</button>
  <button class="menu-item" data-act="restore">還原原始行程（補回被刪的原始景點）</button>
  <button class="menu-item" data-act="close">關閉</button>
</dialog>

<dialog id="pin" class="pin-dialog">
  <form method="dialog" class="form">
    <h2>輸入編輯 PIN 碼</h2>
    <p class="muted">只需在這支手機輸入一次。</p>
    <input id="pin-input" inputmode="numeric" autocomplete="off" placeholder="PIN">
    <p id="pin-error" class="error" hidden>PIN 不正確</p>
    <div class="row end">
      <button type="button" id="pin-cancel" class="btn ghost">取消</button>
      <button type="submit" class="btn primary">確認</button>
    </div>
  </form>
</dialog>

<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 建立 `style.css`**

```css
:root {
  --bg: #f6f7fb; --card: #ffffff; --text: #1a1d23; --muted: #6b7280; --line: #e5e7eb;
  --primary: #1f5fbf; --primary-text: #ffffff;
  --sight: #2f6fdb; --food: #e8842a; --shop: #2a9d5c; --transit: #6b7280; --hotel: #7c4dcc;
  --flash: #fff3b0; --danger: #d33;
  --radius: 14px; --safe-b: env(safe-area-inset-bottom, 0px);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0f1218; --card: #1a1f2a; --text: #eef1f6; --muted: #9aa3b2; --line: #2a3140;
    --flash: #4a4320;
  }
}
:root[data-theme="dark"] {
  --bg: #0f1218; --card: #1a1f2a; --text: #eef1f6; --muted: #9aa3b2; --line: #2a3140; --flash: #4a4320;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--text);
  font: 15px/1.5 -apple-system, "PingFang TC", "Noto Sans TC", "Segoe UI", sans-serif; }
body { padding-bottom: calc(96px + var(--safe-b)); }
a { color: inherit; }

.header { position: sticky; top: 0; z-index: 20; background: var(--primary); color: var(--primary-text); padding: 12px 16px 8px; }
.header h1 { margin: 0 0 4px; font-size: 20px; }
.header .meta { font-size: 13px; opacity: .92; display: grid; gap: 2px; }
.header .meta a { text-decoration: underline; }

.tabs { position: sticky; top: 0; z-index: 19; display: flex; gap: 8px; overflow-x: auto; padding: 10px 16px; background: var(--bg); border-bottom: 1px solid var(--line); scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tab { flex: 0 0 auto; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--card); font-size: 15px; }
.tab.active { background: var(--primary); color: var(--primary-text); border-color: var(--primary); }

.status { margin: 8px 16px 0; padding: 8px 12px; border-radius: 10px; font-size: 13px; background: #fff3cd; color: #6b4e00; }
.status.online { background: #e6f7ec; color: #1e6b3a; }

.day { padding: 12px 16px 0; }
.day h2 { font-size: 18px; margin: 4px 0 12px; }
.day .empty { color: var(--muted); padding: 24px 0; text-align: center; }

.leg { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 13px; padding: 4px 0 4px 16px; border-left: 2px dashed var(--line); margin-left: 15px; }

.card { display: flex; gap: 12px; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px; margin: 6px 0; transition: background .6s; }
.card.flash { background: var(--flash); }
.card .num { flex: 0 0 32px; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 700; }
.card.cat-sight .num { background: var(--sight); } .card.cat-food .num { background: var(--food); }
.card.cat-shop .num { background: var(--shop); } .card.cat-transit .num { background: var(--transit); }
.card.cat-hotel .num { background: var(--hotel); }
.card .body { flex: 1; min-width: 0; }
.card .top { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 2px; }
.chip { font-size: 12px; padding: 1px 8px; border-radius: 999px; color: #fff; }
.cat-sight .chip.cat { background: var(--sight); } .cat-food .chip.cat { background: var(--food); }
.cat-shop .chip.cat { background: var(--shop); } .cat-transit .chip.cat { background: var(--transit); }
.cat-hotel .chip.cat { background: var(--hotel); }
.chip.user { background: #c2410c; }
.card .time { font-size: 13px; color: var(--muted); }
.card h3 { margin: 2px 0 4px; font-size: 17px; line-height: 1.3; overflow-wrap: anywhere; }
.card .station { font-size: 14px; color: var(--text); margin: 2px 0; }
.card .note { margin: 4px 0; font-size: 14px; color: var(--muted); white-space: pre-wrap; }
.card .actions { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
.btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text); font-size: 14px; text-decoration: none; cursor: pointer; }
.btn.primary { background: var(--primary); color: var(--primary-text); border-color: var(--primary); }
.btn.ghost { background: transparent; }
.btn.small { padding: 6px 10px; font-size: 13px; }
.card .actions .more { margin-left: auto; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); background: var(--card); color: var(--text); font-size: 18px; }

.map-wrap { padding: 16px 16px 0; }
.map-title { font-weight: 600; margin-bottom: 8px; }
.map { height: 55vh; min-height: 280px; border-radius: var(--radius); border: 1px solid var(--line); overflow: hidden; }
.pin { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; color: #fff; font-weight: 700; font-size: 13px; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
.pin-sight { background: var(--sight); } .pin-food { background: var(--food); } .pin-shop { background: var(--shop); }
.pin-transit { background: var(--transit); } .pin-hotel { background: var(--hotel); }

.fab { position: fixed; right: 16px; bottom: calc(20px + var(--safe-b)); width: 56px; height: 56px; border-radius: 50%; border: 0; background: var(--primary); color: #fff; font-size: 30px; line-height: 1; box-shadow: 0 4px 12px rgba(0,0,0,.3); z-index: 30; }
.fab:disabled { opacity: .45; }

dialog { border: 0; padding: 0; background: var(--card); color: var(--text); }
dialog::backdrop { background: rgba(0,0,0,.45); }
.sheet { width: 100%; max-width: 100%; margin: auto 0 0; border-radius: 18px 18px 0 0; max-height: 92vh; overflow: auto; padding-bottom: var(--safe-b); }
.form { padding: 16px; display: grid; gap: 10px; }
.form h2 { margin: 0 0 4px; font-size: 18px; }
.form label { display: grid; gap: 4px; font-size: 14px; color: var(--muted); }
.form input, .form select, .form textarea { font: inherit; font-size: 16px; padding: 9px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--text); }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.row.end { justify-content: flex-end; margin-top: 4px; }
.muted { color: var(--muted); font-size: 13px; }
.error { color: var(--danger); font-size: 14px; margin: 0; }
.results { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.results li { padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; }
.results li.selected { border-color: var(--primary); background: var(--flash); }
.results .addr { display: block; color: var(--muted); font-size: 12px; }

.menu { width: min(92vw, 360px); border-radius: 14px; padding: 8px; }
.menu-title { padding: 8px 12px; font-weight: 600; }
.menu-item { display: block; width: 100%; text-align: left; padding: 12px; border: 0; background: transparent; color: var(--text); font-size: 16px; border-radius: 10px; }
.menu-item:active { background: var(--bg); }
.menu-item.danger { color: var(--danger); }
.pin-dialog { width: min(92vw, 360px); border-radius: 14px; }
```

- [ ] **Step 3: 建立 `js/render.js`**

```js
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
```

- [ ] **Step 4: 建立第一版 `js/app.js`（只讀 JSON、渲染分頁與時間軸）**

```js
import { spotsForDay, defaultDay, seedToSpots } from './util.js';
import { renderHeader, renderTabs, renderDay } from './render.js';

const $ = id => document.getElementById(id);

const state = { seed: null, spots: [], activeDay: null };

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderAll() {
  renderTabs($('tabs'), state.seed.days, state.activeDay, date => { state.activeDay = date; renderAll(); });
  const dayInfo = state.seed.days.find(d => d.date === state.activeDay);
  const spots = spotsForDay(state.spots, state.activeDay);
  renderDay($('day'), dayInfo, spots, state.seed.meta.hotel, { onMenu: spot => console.log('menu', spot) });
}

async function main() {
  state.seed = await (await fetch('data/itinerary.json')).json();
  state.spots = seedToSpots(state.seed);
  state.activeDay = defaultDay(state.seed.days, todayIso());
  renderHeader($('header'), state.seed.meta);
  renderAll();
}

main();
```

- [ ] **Step 5: 本機開啟驗證**

Run（背景）: `python -m http.server 8080` 於專案根目錄。
在瀏覽器開 `http://localhost:8080`，用開發者工具切成手機寬度 390px。
Expected: 藍色頁首含飯店與航班；六個日期分頁可切換；9/30 顯示 8 張卡片，卡片間有「🚶 …」交通指引；「開地圖」與「從上一站導航」為可點連結；Console 無錯誤（Leaflet 尚未初始化，`#map` 為空框）。

- [ ] **Step 6: Commit**

```bash
git add index.html style.css js/render.js js/app.js
git commit -m "feat: 手機直式頁面骨架與每日時間軸渲染"
```

---

### Task 4: 地圖模組 `js/map.js`

**Files:**
- Create: `js/map.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: 全域 `L`（Leaflet，由 `index.html` 的 script 載入）
- Produces: `createMap(el: HTMLElement): { showDay(spots: Spot[], onMarkerClick: (id: string) => void): void, invalidate(): void }`

- [ ] **Step 1: 建立 `js/map.js`**

```js
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
```

- [ ] **Step 2: 在 `js/app.js` 接上地圖**

在 import 區加入：
```js
import { createMap } from './map.js';
```
`state` 加入 `map: null`。`renderAll()` 的最後加入：
```js
  state.map.showDay(spots, id => {
    const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('flash');
    setTimeout(() => card.classList.remove('flash'), 1500);
  });
```
`main()` 在 `renderHeader(...)` 之前加入：
```js
  state.map = createMap($('map'));
```

- [ ] **Step 3: 本機驗證**

重新整理 `http://localhost:8080`。
Expected: 下方地圖顯示 OpenStreetMap 圖磚，9/30 有 8 個編號圓點（1 號在成田機場，其餘在上野）與虛線連線；切到 10/1 地圖自動縮放到淺草到押上範圍；點圖釘後上方對應卡片捲入畫面並短暫變黃。

- [ ] **Step 4: Commit**

```bash
git add js/map.js js/app.js
git commit -m "feat: 每日地圖與編號圖釘"
```

---

### Task 5: 資料層 `js/store.js`（快取、Firestore、種子寫入、CRUD）

**Files:**
- Create: `js/store.js`
- Create: `firebase-config.example.js`
- Create: `firebase-config.js`
- Create: `firestore.rules`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `seedToSpots` from `js/util.js`；`firebase-config.js` 匯出 `firebaseConfig`, `TRIP_ID`, `EDIT_PIN`
- Produces: `createStore({ config, tripId, seed, onChange: (spots)=>void, onStatus: (status)=>void })` 回傳
  ```
  { connect(): Promise<void>, isReady(): boolean,
    addSpot(data): Promise<string>, updateSpot(id, data): Promise<void>,
    deleteSpot(id): Promise<void>, reorder(pairs: {id,order}[]): Promise<void>,
    restoreSeed(): Promise<void>, getSpots(): Spot[] }
  ```
  status ∈ `'unconfigured' | 'connecting' | 'online' | 'offline' | 'error'`

- [ ] **Step 1: 建立設定檔與規則**

`firebase-config.example.js`:
```js
// 複製成 firebase-config.js 後填入 Firebase Console → 專案設定 → 你的應用程式 → SDK 設定 的值
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};
// 任意一串隨機英數（建議 20 字元），所有同行者用同一個網址就會共用這份資料
export const TRIP_ID = '';
// 編輯用 PIN，例如 '2026'
export const EDIT_PIN = '';
```

`firebase-config.js`：內容與範本相同（全部空字串）。空值時網站以「未設定」模式顯示原始行程。

`firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripId} {
      allow read, write: if true;
      match /spots/{spotId} {
        allow read, write: if true;
      }
    }
  }
}
```

- [ ] **Step 2: 建立 `js/store.js`**

```js
import { seedToSpots } from './util.js';

const CACHE_KEY = 'japan-trip-spots-v1';
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export function createStore({ config, tripId, seed, onChange, onStatus }) {
  let spots = [];
  let db = null;
  let fs = null;

  const emit = () => onChange(spots);
  const col = () => fs.collection(db, 'trips', tripId, 'spots');
  const docRef = id => fs.doc(db, 'trips', tripId, 'spots', id);

  function loadCache() {
    try { const j = localStorage.getItem(CACHE_KEY); if (j) spots = JSON.parse(j); } catch { /* ignore */ }
  }
  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(spots)); } catch { /* ignore */ }
  }
  function ready() { if (!db) throw new Error('尚未連線到資料庫'); }

  async function writeSeed(list) {
    const batch = fs.writeBatch(db);
    for (const s of list) batch.set(docRef(s.id), { ...s, updatedAt: fs.serverTimestamp() }, { merge: true });
    await batch.commit();
  }

  async function ensureSeeded() {
    const tripRef = fs.doc(db, 'trips', tripId);
    try {
      const won = await fs.runTransaction(db, async tx => {
        const snap = await tx.get(tripRef);
        if (snap.exists() && snap.data().seeded) return false;
        tx.set(tripRef, { seeded: true, seededAt: fs.serverTimestamp() }, { merge: true });
        return true;
      });
      if (won) await writeSeed(seedToSpots(seed));
    } catch (e) {
      console.warn('seed skipped (offline?)', e);
    }
  }

  async function connect() {
    loadCache();
    if (!spots.length) spots = seedToSpots(seed);
    emit();
    if (!config || !config.apiKey || !tripId) { onStatus('unconfigured'); return; }
    onStatus('connecting');
    try {
      const { initializeApp } = await import(FB + 'firebase-app.js');
      fs = await import(FB + 'firebase-firestore.js');
      const app = initializeApp(config);
      db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });
    } catch (e) {
      console.error(e); onStatus('error'); return;
    }
    await ensureSeeded();
    fs.onSnapshot(col(), { includeMetadataChanges: true }, snap => {
      spots = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      saveCache(); emit();
      onStatus(snap.metadata.fromCache ? 'offline' : 'online');
    }, err => { console.error(err); onStatus('error'); });
  }

  async function addSpot(data) {
    ready();
    const ref = fs.doc(col());
    fs.setDoc(ref, { ...data, id: ref.id, source: 'user', updatedAt: fs.serverTimestamp() }).catch(console.error);
    return ref.id;
  }
  async function updateSpot(id, data) {
    ready();
    fs.updateDoc(docRef(id), { ...data, updatedAt: fs.serverTimestamp() }).catch(console.error);
  }
  async function deleteSpot(id) {
    ready();
    fs.deleteDoc(docRef(id)).catch(console.error);
  }
  async function reorder(pairs) {
    ready();
    const batch = fs.writeBatch(db);
    for (const p of pairs) batch.update(docRef(p.id), { order: p.order });
    batch.commit().catch(console.error);
  }
  async function restoreSeed() {
    ready();
    const have = new Set(spots.map(s => s.id));
    await writeSeed(seedToSpots(seed).filter(s => !have.has(s.id)));
  }

  return { connect, isReady: () => !!db, addSpot, updateSpot, deleteSpot, reorder, restoreSeed, getSpots: () => spots };
}
```

說明：寫入不 `await` Firestore 的 promise，因為離線時 promise 要等伺服器確認才 resolve；畫面更新由 `onSnapshot` 回流（本機寫入會立刻觸發 snapshot）。

- [ ] **Step 3: 修改 `js/app.js` 改用 store 與狀態列**

把 import 換成：
```js
import { spotsForDay, defaultDay } from './util.js';
import { renderHeader, renderTabs, renderDay } from './render.js';
import { createMap } from './map.js';
import { createStore } from './store.js';
import { firebaseConfig, TRIP_ID, EDIT_PIN } from '../firebase-config.js';
```
`state` 加入 `store: null, status: 'connecting'`。

新增函式：
```js
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
```
`main()` 改為：
```js
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
```
並移除原本對 `seedToSpots` 的 import 與呼叫（現在由 store 負責）。

- [ ] **Step 4: 本機驗證（未設定模式）**

重新整理 `http://localhost:8080`。
Expected: 頁首下方出現黃色提示「尚未設定 Firebase…」，行程正常顯示，右下角「＋」呈半透明停用。Console 無錯誤。

- [ ] **Step 5: Commit**

```bash
git add js/store.js js/app.js firebase-config.example.js firebase-config.js firestore.rules
git commit -m "feat: Firestore 資料層、快取與未設定模式"
```

---

### Task 6: 新增 / 編輯 / 刪除表單、選單、PIN

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `computeOrder, parseMapsUrl, isShortMapsUrl, nominatimUrl, nominatimToChoices, spotsForDay` from `js/util.js`；store 的 `addSpot, updateSpot, deleteSpot, reorder, restoreSeed, isReady`；`EDIT_PIN`
- DOM：`index.html` 的 `#sheet`、`#spot-form`、`#menu`、`#pin`、`#fab`

- [ ] **Step 1: 在 `js/app.js` 補 import**

```js
import { spotsForDay, defaultDay, computeOrder, parseMapsUrl, isShortMapsUrl, nominatimUrl, nominatimToChoices } from './util.js';
```

- [ ] **Step 2: PIN 檢查**

```js
const PIN_KEY = 'japan-trip-pin-ok';

function ensurePin() {
  return new Promise(resolve => {
    if (!EDIT_PIN || localStorage.getItem(PIN_KEY) === '1') return resolve(true);
    const dlg = $('pin'); const input = $('pin-input'); const err = $('pin-error');
    input.value = ''; err.hidden = true;
    const onSubmit = e => {
      e.preventDefault();
      if (input.value.trim() === String(EDIT_PIN)) { localStorage.setItem(PIN_KEY, '1'); cleanup(); dlg.close(); resolve(true); }
      else { err.hidden = false; input.select(); }
    };
    const onCancel = () => { cleanup(); dlg.close(); resolve(false); };
    const form = dlg.querySelector('form');
    function cleanup() { form.removeEventListener('submit', onSubmit); $('pin-cancel').removeEventListener('click', onCancel); }
    form.addEventListener('submit', onSubmit);
    $('pin-cancel').addEventListener('click', onCancel);
    dlg.showModal();
  });
}
```

- [ ] **Step 3: 表單開啟、座標搜尋、連結解析、儲存**

```js
let editing = null;   // 正在編輯的 spot，或 null 表示新增
let coords = null;    // { lat, lng }

function fillDayOptions(selectedDay) {
  $('form-day').innerHTML = state.seed.days.map(d =>
    `<option value="${d.date}"${d.date === selectedDay ? ' selected' : ''}>${d.label}（${d.weekday}）${d.title}</option>`).join('');
}
function fillAfterOptions(day, selectedAfter) {
  const list = spotsForDay(state.spots, day).filter(s => !editing || s.id !== editing.id);
  const opts = [`<option value="first">當天第一站</option>`]
    .concat(list.map((s, i) => `<option value="${s.id}">${i + 1}. ${s.name}</option>`));
  $('form-after').innerHTML = opts.join('');
  $('form-after').value = selectedAfter && (selectedAfter === 'first' || list.some(s => s.id === selectedAfter)) ? selectedAfter : (list.length ? list[list.length - 1].id : 'first');
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
    ul.innerHTML = choices.map((c, i) => `<li data-i="${i}">${c.name}<span class="addr">${c.address}</span></li>`).join('');
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
    ? '短連結無法解析：請在 Google Maps 開啟後按「分享 → 複製連結」的完整網址，或改用上面的搜尋'
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
```

- [ ] **Step 4: 選單與 FAB**

```js
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
```

並把 `renderAll()` 裡的 `onMenu: spot => console.log('menu', spot)` 改成 `onMenu: openMenu`。

- [ ] **Step 5: 本機驗證（未設定模式下的 UI）**

重新整理。因為未設定 Firebase，FAB 停用；點卡片「⋯」→ 選單出現 → 點「編輯」→ 出現「尚未連線到資料庫」提示。Console 無錯誤。

- [ ] **Step 6: 用暫時的 Firebase 設定做完整驗證（若可取得）**

若手邊有 Firebase 專案，填入 `firebase-config.js` 後：新增一個景點（搜尋「上野動物園」）放在 9/30 第一站之後 → 卡片出現且帶「新增」標籤、地圖多一個圖釘；編輯改名 → 即時更新；刪除 → 消失；在第二個瀏覽器視窗開同網址 → 看到相同變更。
若無法取得，跳過並在 commit 訊息註明「Firebase 端到端待使用者設定後驗證」。

- [ ] **Step 7: Commit**

```bash
git add js/app.js
git commit -m "feat: 新增/編輯/刪除景點表單、選單與 PIN"
```

---

### Task 7: SETUP.md 與 README

**Files:**
- Create: `SETUP.md`
- Create: `README.md`

- [ ] **Step 1: 建立 `SETUP.md`**

```markdown
# 設定步驟（約 15 分鐘）

## A. 建立 Firebase 專案（存放大家共用的景點資料）

1. 用 Google 帳號開 https://console.firebase.google.com → 「建立專案」→ 名稱隨意（例如 japan-trip）→ Google Analytics 可關閉 → 建立。
2. 左側「建構」→「Firestore Database」→「建立資料庫」→ 位置選 `asia-northeast1`（東京）→ 選「以正式版模式啟動」→ 啟用。
3. 進入 Firestore 的「規則」分頁，把內容全部換成本專案 `firestore.rules` 的內容 → 「發布」。
4. 回到專案總覽，點「</>」（新增網頁應用程式）→ 暱稱隨意 → 不勾選 Hosting → 註冊 → 會看到一段 `const firebaseConfig = { apiKey: "...", ... }`，把大括號裡的六個值複製下來。
5. 打開本專案的 `firebase-config.js`，把六個值貼進對應欄位；`TRIP_ID` 填一串隨機英數（例如 `k8z2m4q9v1x7c3b6n5p0`）；`EDIT_PIN` 填你要的 PIN（例如 `2026`）。存檔。

## B. 放上 GitHub Pages（讓大家用網址打開）

1. 到 https://github.com → 右上「+」→「New repository」→ 名稱例如 `japan-trip` → Public → Create。
2. 把本專案資料夾的所有檔案上傳（網頁上「uploading an existing file」拖曳整個資料夾內容即可；或用 git push）。`firebase-config.js` 要一起上傳。
3. Repo 的「Settings」→ 左側「Pages」→ Source 選「Deploy from a branch」→ Branch 選 `main`、資料夾 `/ (root)` → Save。
4. 約 1 分鐘後同頁會顯示網址 `https://<你的帳號>.github.io/japan-trip/`，用手機打開即可。把網址與 PIN 傳給同行的人。

## C. 之後要改東西

- 現場新增或修改景點：直接在網站上按「＋」或卡片的「⋯」，輸入一次 PIN 即可，所有人同步。
- 改原始行程文字（例如交通指引）：改 `data/itinerary.json` 後重新上傳。已經寫進 Firebase 的資料不會自動更新；要套用新內容，可在卡片「⋯」→「還原原始行程」補回缺少的項目，或在 Firebase Console 刪掉 `trips/<TRIP_ID>` 文件後重新打開網站（會重新匯入）。

## D. 手動測試清單

- [ ] 手機 Safari 與 Chrome 打開網址，頁首、分頁、卡片顯示正常，無橫向捲動。
- [ ] 切換六個日期，地圖自動縮放到當天範圍，圖釘編號與卡片編號一致，點圖釘卡片會高亮。
- [ ] 「開地圖」開啟 Google Maps 到正確地點；「從上一站導航」開啟 Google Maps 且為大眾運輸模式。
- [ ] 按「＋」→ 輸入 PIN → 搜尋座標 → 儲存，卡片出現「新增」標籤，另一支手機幾秒內看到。
- [ ] 編輯與刪除後另一支手機同步。
- [ ] 開飛航模式重新打開網站，仍能看到行程；恢復網路後狀態列消失。

## E. 安全性說明

資料庫對知道 `TRIP_ID` 的人開放讀寫，`TRIP_ID` 與 PIN 都在公開的 repo 裡看得到。這只是防誤觸與防隨機掃描，不是防有心人的機制，對旅遊行程來說足夠。旅程結束後可到 Firebase Console 把專案刪除。
```

- [ ] **Step 2: 建立 `README.md`**

```markdown
# 日本快樂玩（2026/9/30–10/5）

手機直式的行程網站：每日路線、車站與導航、地圖、多人同步新增景點。

- 設定與部署：見 `SETUP.md`
- 原始行程資料：`data/itinerary.json`
- 測試：`npm test`
- 本機預覽：`npm run serve` 後開 http://localhost:8080
```

- [ ] **Step 3: 跑全部測試，確認仍通過**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 4: Commit**

```bash
git add SETUP.md README.md
git commit -m "docs: 設定步驟與 README"
```
