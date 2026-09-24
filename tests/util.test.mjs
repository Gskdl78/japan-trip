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

import { normalizeAddress, gsiUrl, gsiToChoices } from '../js/util.js';

test('normalizeAddress 去掉國名、郵遞區號並轉半形', () => {
  assert.equal(normalizeAddress('日本、〒101-0021 東京都千代田区外神田４丁目３−２'), '東京都千代田区外神田4丁目3-2');
  assert.equal(normalizeAddress('〒110-0005 東京都台東区上野４丁目９−８'), '東京都台東区上野4丁目9-8');
  assert.equal(normalizeAddress('東京都渋谷区神宮前1丁目6-15 ジュネスビル 1F'), '東京都渋谷区神宮前1丁目6-15 ジュネスビル 1F');
  assert.equal(normalizeAddress('東京タワー'), '東京タワー');
});

test('gsiUrl 帶入查詢字串', () => {
  assert.equal(gsiUrl('東京都台東区上野4-9-8'), 'https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + encodeURIComponent('東京都台東区上野4-9-8'));
});

test('gsiToChoices 轉換 GeoJSON', () => {
  const raw = [{ geometry: { coordinates: [139.773987, 35.710426] }, properties: { title: '東京都台東区上野四丁目９番８号' } }];
  assert.deepEqual(gsiToChoices(raw), [{ name: '東京都台東区上野四丁目９番８号', lat: 35.710426, lng: 139.773987, address: '東京都台東区上野四丁目９番８号', kind: 'address' }]);
  assert.deepEqual(gsiToChoices(null), []);
});
