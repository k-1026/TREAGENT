import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPlaces } from '../src/places/select_places.js';
import { MODES } from '../src/rules/rule_config.js';

const P = (o) => ({
  id: 'x', name: 'x', district: '중구', type: 'outdoor',
  openHour: null, closeHour: null, closedWeekdays: [], modeAllowed: null, status: 'open', ...o,
});
const SET = [
  P({ id: 'a', type: 'outdoor' }), P({ id: 'b', type: 'shade' }),
  P({ id: 'c', type: 'indoor' }), P({ id: 'd', type: 'exhibit' }),
];
const ids = (r) => r.places.map((p) => p.id);

test('EXPLORE는 모든 유형을 보여 준다', () => {
  assert.deepEqual(ids(selectPlaces(MODES.EXPLORE, SET)), ['a', 'b', 'c', 'd']);
});

test('SHADE는 야외를 뺀다', () => {
  assert.deepEqual(ids(selectPlaces(MODES.SHADE, SET)), ['b', 'c', 'd']);
});

test('INDOOR는 실내와 전시만', () => {
  assert.deepEqual(ids(selectPlaces(MODES.INDOOR, SET)), ['c', 'd']);
});

test('SAFETY와 UNKNOWN은 실내·전시만, HOLD는 아무것도 없다', () => {
  assert.deepEqual(ids(selectPlaces(MODES.SAFETY, SET)), ['c', 'd']);
  assert.deepEqual(ids(selectPlaces(MODES.UNKNOWN, SET)), ['c', 'd']);
  assert.deepEqual(selectPlaces(MODES.HOLD, SET), { places: [], reason: 'MODE_NO_PLACES' });
});

test('장소의 modeAllowed가 있으면 유형 규칙보다 우선한다', () => {
  const set = [
    P({ id: 'a', type: 'outdoor', modeAllowed: ['INDOOR'] }), // 야외지만 INDOOR에 노출
    P({ id: 'b', type: 'indoor', modeAllowed: ['EXPLORE'] }), // 실내지만 INDOOR에서는 숨김
    P({ id: 'c', type: 'indoor', modeAllowed: null }), // 값이 없으면 유형 규칙
  ];
  assert.deepEqual(ids(selectPlaces(MODES.INDOOR, set)), ['a', 'c']);
});

test('운영 중단·미확인 상태는 제외한다', () => {
  const set = [P({ id: 'a' }), P({ id: 'b', status: 'paused' }), P({ id: 'c', status: 'unknown' })];
  assert.deepEqual(ids(selectPlaces(MODES.EXPLORE, set)), ['a']);
});

test('운영시간: 9시 이상 18시 미만', () => {
  const set = [P({ id: 'a', openHour: 9, closeHour: 18 })];
  const at = (hour) => ids(selectPlaces(MODES.EXPLORE, set, { hour }));
  assert.deepEqual(at(8), []);
  assert.deepEqual(at(9), ['a']);
  assert.deepEqual(at(17), ['a']);
  assert.deepEqual(at(18), []);
});

test('휴관 요일은 제외한다 (1=월요일)', () => {
  const set = [P({ id: 'a', closedWeekdays: [1] })];
  assert.deepEqual(ids(selectPlaces(MODES.EXPLORE, set, { dayOfWeek: 1 })), []);
  assert.deepEqual(ids(selectPlaces(MODES.EXPLORE, set, { dayOfWeek: 2 })), ['a']);
});

test('시간을 아는 장소는 현재 시각이 없으면 제외, 시간을 모르는 장소는 포함', () => {
  const set = [P({ id: 'a', openHour: 9, closeHour: 18 }), P({ id: 'b' })];
  assert.deepEqual(ids(selectPlaces(MODES.EXPLORE, set, {})), ['b']);
});

test('선택한 구·군을 앞에 두고 나머지 순서는 유지한다', () => {
  const set = [P({ id: 'a', district: '수성구' }), P({ id: 'b', district: '중구' }),
    P({ id: 'c', district: '수성구' }), P({ id: 'd', district: '중구' })];
  assert.deepEqual(ids(selectPlaces(MODES.EXPLORE, set, { district: '중구' })), ['b', 'd', 'a', 'c']);
});

test('후보가 없으면 NO_CANDIDATE, 입력은 바뀌지 않는다', () => {
  const set = Object.freeze([Object.freeze(P({ id: 'a', type: 'outdoor' }))]);
  assert.deepEqual(selectPlaces(MODES.INDOOR, set), { places: [], reason: 'NO_CANDIDATE' });
  assert.equal(set.length, 1);
});

test('모르는 모드는 추천하지 않는다', () => {
  assert.deepEqual(selectPlaces('WHATEVER', SET), { places: [], reason: 'MODE_NO_PLACES' });
});