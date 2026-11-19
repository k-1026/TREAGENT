import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarangiTools } from '../src/ai/harangi_tools.js';

const PLACES = [
  {
    id: 'a', name: '약령시박물관', type: 'exhibit', hoursText: '09:00~18:00', closedText: null,
    caution: '', stairs: 'few', lat: 35.8712345, lng: 128.6012345,
  },
];
const make = (extra = {}) => createHarangiTools({ places: PLACES, mode: 'EXPLORE', hour: 14, temperatureC: 24.5, ...extra });
const byName = (tools, name) => tools.find((t) => t.name === name);

test('도구는 조회 전용 2개뿐이다', () => {
  assert.deepEqual(make().map((t) => t.name).sort(), ['get_place_info', 'get_today_context']);
});

test('장소 정보: 값이 있는 항목만, 좌표는 없다', async () => {
  const out = JSON.parse(await byName(make(), 'get_place_info').invoke({ placeId: 'a' }));
  assert.deepEqual(out, { name: '약령시박물관', type: 'exhibit', hoursText: '09:00~18:00', stairs: 'few' });
  assert.ok(!('lat' in out) && !('lng' in out));
});

test('길에 없는 장소는 조회할 수 없다', async () => {
  const out = JSON.parse(await byName(make(), 'get_place_info').invoke({ placeId: 'zzz' }));
  assert.deepEqual(out, { error: 'NOT_IN_ROUTE' });
});

test('오늘 상황: 모드, 시각, 기온', async () => {
  const out = JSON.parse(await byName(make(), 'get_today_context').invoke({}));
  assert.deepEqual(out, { mode: 'EXPLORE', hour: 14, temperatureC: 24.5 });
});

test('오늘 상황: 값이 없으면 null', async () => {
  const out = JSON.parse(await byName(make({ hour: undefined, temperatureC: undefined }), 'get_today_context').invoke({}));
  assert.deepEqual(out, { mode: 'EXPLORE', hour: null, temperatureC: null });
});