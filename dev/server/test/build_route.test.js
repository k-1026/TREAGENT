import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoute } from '../src/courses/build_route.js';
import { MODES } from '../src/rules/rule_config.js';

const P = (o) => ({
  id: 'x', name: 'x', district: '중구', type: 'outdoor', openHour: null, closeHour: null,
  closedWeekdays: [], status: 'open', hoursText: null, closedText: null, caution: null, ...o,
});
const PLACES = [
  P({ id: 'J03', name: '동성로' }),
  P({ id: 'J04', name: '근대골목', caution: '민감 역사' }),
  P({ id: 'J01', name: '약령시', type: 'exhibit', openHour: 9, closeHour: 18, closedWeekdays: [1] }),
  P({ id: 'J21', name: '향토역사관', type: 'exhibit', openHour: 9, closeHour: 18 }),
  P({ id: 'J09', name: '기념관', type: 'exhibit', openHour: 9, closeHour: 17 }),
];
const COURSE = {
  id: 'C01', title: '제목', durationMin: 60,
  routes: { explore: ['J03', 'J04', 'J01'], indoor: ['J01', 'J21', 'J09'] },
};
const TUE = { hour: 14, dayOfWeek: 2 };
const ids = (r) => r.stations.map((s) => s.id);

test('EXPLORE는 explore 경로를 순서대로', () => {
  const r = buildRoute(COURSE, MODES.EXPLORE, PLACES, TUE);
  assert.equal(r.routeType, 'explore');
  assert.deepEqual(ids(r), ['J03', 'J04', 'J01']);
  assert.deepEqual(r.stations.map((s) => s.order), [1, 2, 3]);
  assert.equal(r.available, true);
  assert.equal(r.reason, 'OK');
});

test('INDOOR는 indoor 경로', () => {
  const r = buildRoute(COURSE, MODES.INDOOR, PLACES, TUE);
  assert.equal(r.routeType, 'indoor');
  assert.deepEqual(ids(r), ['J01', 'J21', 'J09']);
});

test('SHADE는 shade 경로가 없으면 indoor로 대신한다', () => {
  assert.equal(buildRoute(COURSE, MODES.SHADE, PLACES, TUE).routeType, 'indoor');
});

test('SHADE는 shade 경로가 있으면 그것을 쓴다', () => {
  const course = { ...COURSE, routes: { ...COURSE.routes, shade: ['J04', 'J21', 'J09'] } };
  const r = buildRoute(course, MODES.SHADE, PLACES, TUE);
  assert.equal(r.routeType, 'shade');
  assert.deepEqual(ids(r), ['J04', 'J21', 'J09']);
});

test('SAFETY, HOLD, UNKNOWN은 경로 없이 사유만 (날씨 확인 불가는 추측하지 않는다)', () => {
  for (const [mode, reason] of [
    [MODES.SAFETY, 'SAFETY'], [MODES.HOLD, 'HOLD'], [MODES.UNKNOWN, 'WEATHER_UNAVAILABLE'],
  ]) {
    const r = buildRoute(COURSE, mode, PLACES, TUE);
    assert.equal(r.available, false);
    assert.equal(r.reason, reason);
    assert.deepEqual(r.stations, []);
  }
});

test('월요 휴관 장소가 있으면 PLACE_CLOSED, 장소는 그대로 보여 준다', () => {
  const r = buildRoute(COURSE, MODES.EXPLORE, PLACES, { hour: 14, dayOfWeek: 1 });
  assert.equal(r.available, false);
  assert.equal(r.reason, 'PLACE_CLOSED');
  assert.deepEqual(r.closedPlaceIds, ['J01']);
  assert.equal(r.stations.length, 3);
  assert.equal(r.stations[2].open, false);
});

test('마감 시각에는 닫힌 것으로 본다 (17시에 J09)', () => {
  const r = buildRoute(COURSE, MODES.INDOOR, PLACES, { hour: 17, dayOfWeek: 2 });
  assert.deepEqual(r.closedPlaceIds, ['J09']);
});

test('DB에 없는 장소 id는 PLACE_MISSING', () => {
  const course = { ...COURSE, routes: { explore: ['J03', 'ZZZ'] } };
  const r = buildRoute(course, MODES.EXPLORE, PLACES, TUE);
  assert.equal(r.reason, 'PLACE_MISSING');
  assert.equal(r.available, false);
  assert.deepEqual(ids(r), ['J03']);
});

test('필요한 필드만 내보내고 좌표는 없다', () => {
  const r = buildRoute(COURSE, MODES.EXPLORE, PLACES, TUE);
  assert.deepEqual(Object.keys(r.stations[1]), [
    'order', 'id', 'name', 'district', 'type', 'open', 'hoursText', 'closedText', 'caution',
  ]);
  assert.equal(r.stations[1].caution, '민감 역사');
});

test('해당 모드의 경로가 없으면 NO_ROUTE', () => {
  const course = { ...COURSE, routes: { indoor: ['J01'] } };
  const r = buildRoute(course, MODES.EXPLORE, PLACES, TUE);
  assert.equal(r.reason, 'NO_ROUTE');
  assert.equal(r.available, false);
});