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
