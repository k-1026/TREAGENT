import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposeRoute } from '../src/ai/compose_route.js';
import { createRouteCache } from '../src/ai/route_cache.js';

const P = (o) => ({
  id: 'x', name: 'x', district: '중구', type: 'outdoor',
  openHour: null, closeHour: null, closedWeekdays: [], modeAllowed: null, status: 'open',
  zone: 'dongseongro', hoursText: null, caution: null, ...o,
});
// 같은 위도에서 경도만 0.01씩 다른 일직선 위의 5곳
const PLACES = ['a', 'b', 'c', 'd', 'e'].map((id, i) => P({ id, name: id.toUpperCase(), lat: 35.87, lng: 128.6 + i * 0.01 }));
const PREFS = { ageGroup: '20s', theme: 'history', variant: 'B' };
const START = { latitude: 35.87, longitude: 128.599 };
const answer = (ids) => ({ placeIds: ids, keyword: '근대골목', reason: '천천히 걷기 좋아요.' });

function fakeLlm(replies) {
  const calls = [];
  const fn = async (prompt) => {
    calls.push(prompt);
    return replies[Math.min(calls.length - 1, replies.length - 1)];
  };
  fn.calls = calls;
  return fn;
}
const ids = (r) => r.places.map((p) => p.id);

test('AI가 고른 장소를 코드가 최단 순서로 다시 정렬한다', async () => {
  const llm = fakeLlm([answer(['a', 'c', 'b'])]);
  const compose = createComposeRoute({ llm });
  const r = await compose({ mode: 'EXPLORE', places: PLACES, prefs: PREFS, start: START });
  assert.equal(r.ok, true);
  assert.equal(r.picker, 'ai');
  assert.equal(r.title, '맑은날 근대골목길');
  assert.deepEqual(ids(r), ['a', 'b', 'c']);
  assert.equal(r.orderBasis, 'distance');
});

test('응답의 장소에 좌표가 없다', async () => {
  const compose = createComposeRoute({ llm: fakeLlm([answer(['a', 'b', 'c'])]) });
  const r = await compose({ mode: 'EXPLORE', places: PLACES, prefs: PREFS, start: START });
  for (const p of r.places) {
    assert.ok(!('lat' in p) && !('lng' in p));
  }
  assert.ok(!JSON.stringify(r).includes('128.6'));
});

test('AI가 없으면(llm 없음) 규칙 결과', async () => {
  const compose = createComposeRoute({ llm: null });
  const r = await compose({ mode: 'EXPLORE', places: PLACES, prefs: PREFS, start: START });
  assert.equal(r.picker, 'rules');
  assert.equal(r.title, '맑은날 근대골목길');
  assert.deepEqual(ids(r), ['a', 'b', 'c']);
});

test('안전이 걸린 모드(SAFETY)는 AI를 부르지 않는다', async () => {
  const llm = fakeLlm([answer(['a', 'b', 'c'])]);
  const compose = createComposeRoute({ llm });
  const indoor = PLACES.map((p) => ({ ...p, type: 'indoor' }));
  const r = await compose({ mode: 'SAFETY', places: indoor, prefs: PREFS, start: START });
  assert.equal(llm.calls.length, 0);
  assert.equal(r.picker, 'rules');
  assert.equal(r.title, '근대골목길');
});

test('테마가 없으면 AI를 부르지 않는다', async () => {
  const llm = fakeLlm([answer(['a', 'b', 'c'])]);
  const compose = createComposeRoute({ llm });
  const r = await compose({ mode: 'EXPLORE', places: PLACES, prefs: { ageGroup: '20s' }, start: START });
  assert.equal(llm.calls.length, 0);
  assert.equal(r.picker, 'rules');
  assert.equal(r.title, '맑은날 산책길');
});

test('AI가 두 번 모두 거부되면 규칙 결과로 대체한다', async () => {
  const llm = fakeLlm([answer(['a', 'b', 'zzz'])]);
  const compose = createComposeRoute({ llm });
  const r = await compose({ mode: 'EXPLORE', places: PLACES, prefs: PREFS, start: START });
  assert.equal(llm.calls.length, 2);
  assert.equal(r.picker, 'rules');
  assert.equal(r.attempts, 2);
  assert.deepEqual(ids(r), ['a', 'b', 'c']);
});

test('같은 조건이면 AI를 다시 부르지 않고 같은 길을 보여 준다', async () => {
  const llm = fakeLlm([answer(['a', 'c', 'b']), answer(['d', 'e', 'a'])]);
  const compose = createComposeRoute({ llm, cache: createRouteCache() });
  const first = await compose({ mode: 'EXPLORE', places: PLACES, prefs: PREFS, start: START });
  const second = await compose({ mode: 'EXPLORE', places: PLACES, prefs: PREFS, start: START });
  assert.equal(llm.calls.length, 1);
  assert.deepEqual(ids(second), ids(first));
  assert.equal(second.title, first.title);
});

test('다른 조건(나이대)이면 새로 구성한다', async () => {
  const llm = fakeLlm([answer(['a', 'b', 'c'])]);
  const compose = createComposeRoute({ llm, cache: createRouteCache() });
  await compose({ mode: 'EXPLORE', places: PLACES, prefs: PREFS, start: START });
  await compose({ mode: 'EXPLORE', places: PLACES, prefs: { ...PREFS, ageGroup: '40s' }, start: START });
  assert.equal(llm.calls.length, 2);
});

test('기억해 둔 길의 장소가 닫히면 새로 구성한다', async () => {
  const llm = fakeLlm([answer(['a', 'b', 'c']), answer(['a', 'c', 'd'])]);
  const compose = createComposeRoute({ llm, cache: createRouteCache() });
  await compose({ mode: 'EXPLORE', places: PLACES, prefs: PREFS, start: START });
  const closed = PLACES.map((p) => (p.id === 'b' ? { ...p, status: 'paused' } : p));
  const r = await compose({ mode: 'EXPLORE', places: closed, prefs: PREFS, start: START });
  assert.equal(llm.calls.length, 2);
  assert.ok(!ids(r).includes('b'));
});

test('HOLD는 추천하지 않고, 후보가 없으면 NO_CANDIDATE', async () => {
  const compose = createComposeRoute({ llm: fakeLlm([answer(['a', 'b', 'c'])]) });
  const hold = await compose({ mode: 'HOLD', places: PLACES, prefs: PREFS });
  assert.deepEqual([hold.ok, hold.reason], [false, 'MODE_NO_PLACES']);
  const none = await compose({ mode: 'EXPLORE', places: [], prefs: PREFS });
  assert.deepEqual([none.ok, none.reason], [false, 'NO_CANDIDATE']);
});

test('AI에게 보여 주는 후보는 상한(12곳)까지만', async () => {
  const many = Array.from({ length: 20 }, (_, i) => P({ id: `p${i}`, name: `P${i}`, lat: 35.87, lng: 128.6 + i * 0.001 }));
  const llm = fakeLlm([answer(['p0', 'p1', 'p2'])]);
  const compose = createComposeRoute({ llm });
  await compose({ mode: 'EXPLORE', places: many, prefs: PREFS, start: START });
  const lines = llm.calls[0].user.split('\n').filter((l) => l.startsWith('- id='));
  assert.equal(lines.length, 12);
});