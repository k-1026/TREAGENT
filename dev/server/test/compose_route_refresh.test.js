import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposeRoute } from '../src/ai/compose_route.js';
import { createRouteCache } from '../src/ai/route_cache.js';

const P = (o) => ({
  id: 'x', name: 'x', district: '중구', type: 'outdoor',
  openHour: null, closeHour: null, closedWeekdays: [], modeAllowed: null, status: 'open',
  zone: 'dongseongro', hoursText: null, caution: null, ...o,
});
const PLACES = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => P({ id, name: id.toUpperCase(), lat: 35.87, lng: 128.6 + i * 0.01 }));
const PREFS = { ageGroup: '20s', theme: 'history', variant: 'B' };
const START = { latitude: 35.87, longitude: 128.599 };
const answer = (ids) => ({ placeIds: ids, keyword: '근대골목', reason: '천천히 걷기 좋아요.' });

function fakeLlm(...replies) {
  const calls = [];
  const fn = async (prompt) => {
    calls.push(prompt);
    return replies[Math.min(calls.length - 1, replies.length - 1)];
  };
  fn.calls = calls;
  return fn;
}
const ids = (r) => r.places.map((p) => p.id);
const base = { mode: 'EXPLORE', places: PLACES, prefs: PREFS, start: START };

test('exclude: 이미 본 장소를 뺀 후보로 AI에게 구성하게 한다', async () => {
  const llm = fakeLlm(answer(['d', 'e', 'f']));
  const r = await createComposeRoute({ llm })({ ...base, refresh: true, exclude: ['a', 'b', 'c'] });
  assert.deepEqual(ids(r), ['d', 'e', 'f']);
  assert.ok(!llm.calls[0].user.includes('id=a') && llm.calls[0].user.includes('id=d'));
  assert.equal(r.isNew, true);
});

test('exclude를 빼고 나면 후보가 모자라면 빼지 않고 전체에서 고른다', async () => {
  const llm = fakeLlm(answer(['a', 'b', 'c']));
  const four = PLACES.slice(0, 4);
  const r = await createComposeRoute({ llm })({ ...base, places: four, refresh: true, exclude: ['a', 'b', 'c'] });
  assert.ok(llm.calls[0].user.includes('id=a'));
  assert.equal(r.isNew, false); // 이미 본 장소로만 이뤄져 새 조합이 아니다
});

test('규칙 폴백(AI 없음)도 exclude를 지킨다', async () => {
  const r = await createComposeRoute({ llm: null })({ ...base, refresh: true, exclude: ['a', 'b', 'c'] });
  assert.equal(r.picker, 'rules');
  assert.deepEqual(ids(r), ['d', 'e', 'f']);
});

test('새로고침은 기억해 둔 길을 건너뛰고, 새 결과가 기본 길이 된다', async () => {
  const llm = fakeLlm(answer(['a', 'b', 'c']), answer(['d', 'e', 'f']));
  const compose = createComposeRoute({ llm, cache: createRouteCache() });
  const first = await compose({ ...base });
  const cached = await compose({ ...base });
  assert.equal(llm.calls.length, 1);
  assert.deepEqual(ids(cached), ids(first));
  const refreshed = await compose({ ...base, refresh: true, exclude: ids(first) });
  assert.equal(llm.calls.length, 2);
  assert.deepEqual(ids(refreshed), ['d', 'e', 'f']);
  const after = await compose({ ...base });
  assert.equal(llm.calls.length, 2);
  assert.deepEqual(ids(after), ['d', 'e', 'f']);
});

test('refresh만 true이고 exclude가 없어도 기억해 둔 길을 건너뛰고 새로 구성한다', async () => {
  const llm = fakeLlm(answer(['a', 'b', 'c']));
  const compose = createComposeRoute({ llm, cache: createRouteCache() });
  await compose({ ...base });
  await compose({ ...base, refresh: true });
  assert.equal(llm.calls.length, 2);
});

test('소요시간: 좌표가 있으면 약 N분, 없으면 null', async () => {
  const withCoords = await createComposeRoute({ llm: null })({ ...base });
  assert.equal(withCoords.durationMin, 100);
  assert.equal(withCoords.durationBasis, 'distance');
  const noCoords = PLACES.map(({ lat, lng, ...rest }) => rest);
  const without = await createComposeRoute({ llm: null })({ ...base, places: noCoords });
  assert.equal(without.durationMin, null);
  assert.equal(without.durationBasis, 'none');
});

test('exclude에 모르는 id가 섞여 있어도 문제없다', async () => {
  const r = await createComposeRoute({ llm: null })({ ...base, refresh: true, exclude: ['zzz', 'a'] });
  assert.equal(r.ok, true);
  assert.ok(!ids(r).includes('a'));
});