import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPlaces } from '../src/places/select_places.js';
import { MODES, MODE_ALLOWED_TYPES } from '../src/rules/rule_config.js';

const P = (o) => ({
  id: 'x', name: 'x', district: '중구', type: 'outdoor', role: 'visit', permissionState: 'not_needed',
  openHour: null, closeHour: null, closedWeekdays: [], modeAllowed: null, status: 'open', fit: {}, ...o,
});
const fit = (value, estimated = false) => ({ fit: value, estimated });
const ids = (r) => r.places.map((p) => p.id);

test('이동 허브와 쉼터는 일반 추천에서 제외한다 (role이 없으면 방문 장소로 본다)', () => {
  const set = [
    P({ id: 'a' }), P({ id: 'b', role: 'hub' }), P({ id: 'c', role: 'shelter' }), P({ id: 'd', role: undefined }),
  ];
  assert.deepEqual(ids(selectPlaces(MODES.EXPLORE, set)), ['a', 'd']);
});

test('확인된 적합도 good·mostly는 유형 규칙으로 빠질 장소도 통과시킨다', () => {
  const set = [
    P({ id: 'a', type: 'outdoor', fit: { SHADE: fit('mostly') } }), // 야외지만 그늘 대체로 적합
    P({ id: 'b', type: 'outdoor', fit: { SHADE: fit('good') } }),
    P({ id: 'c', type: 'outdoor' }), // 적합도 없음 → 유형 규칙으로 빠짐
  ];
  assert.deepEqual(ids(selectPlaces(MODES.SHADE, set)), ['a', 'b']);
});

test('확인된 적합도 bad는 유형 규칙으로 통과할 장소도 제외한다', () => {
  const set = [
    P({ id: 'a', type: 'indoor', fit: { INDOOR: fit('bad') } }),
    P({ id: 'b', type: 'indoor' }),
  ];
  assert.deepEqual(ids(selectPlaces(MODES.INDOOR, set)), ['b']);
});

test('조건부(conditional)는 나오되 뒤로 정렬된다', () => {
  const set = [
    P({ id: 'a', type: 'indoor', fit: { SHADE: fit('conditional') } }),
    P({ id: 'b', type: 'indoor', fit: { SHADE: fit('good') } }),
    P({ id: 'c', type: 'indoor' }),
  ];
  assert.deepEqual(ids(selectPlaces(MODES.SHADE, set)), ['b', 'c', 'a']);
});

test('추정 적합도는 거르기에 쓰지 않고 유형 규칙을 따른다', () => {
  const set = [
    P({ id: 'a', type: 'exhibit', fit: { EXPLORE: fit('conditional', true) } }), // 추정 조건부 → 뒤로 가지 않음
    P({ id: 'b', type: 'exhibit', fit: { EXPLORE: fit('bad', true) } }), // 추정 부적합 → 제외하지 않음
    P({ id: 'c', type: 'outdoor', fit: { EXPLORE: fit('good') } }),
  ];
  assert.deepEqual(ids(selectPlaces(MODES.EXPLORE, set)), ['a', 'b', 'c']);
});

test('SAFETY와 UNKNOWN은 INDOOR 적합도를 쓴다', () => {
  const set = [
    P({ id: 'a', type: 'outdoor', fit: { INDOOR: fit('good') } }), // 야외지만 실내 적합
    P({ id: 'b', type: 'indoor', fit: { INDOOR: fit('bad') } }), // 실내지만 실내 부적합
    P({ id: 'c', type: 'indoor' }), // 적합도 없음 → 유형 규칙
  ];
  assert.deepEqual(ids(selectPlaces(MODES.SAFETY, set)), ['a', 'c']);
  assert.deepEqual(ids(selectPlaces(MODES.UNKNOWN, set)), ['a', 'c']);
});

test('장소의 modeAllowed가 적합도보다 우선한다', () => {
  const set = [
    P({ id: 'a', type: 'outdoor', modeAllowed: ['SHADE'], fit: { SHADE: fit('bad') } }), // 직접 지정이 이김
    P({ id: 'b', type: 'indoor', modeAllowed: ['EXPLORE'], fit: { INDOOR: fit('good') } }), // INDOOR에서는 숨김
  ];
  assert.deepEqual(ids(selectPlaces(MODES.SHADE, set)), ['a']);
  assert.deepEqual(ids(selectPlaces(MODES.INDOOR, set)), []);
});

test('허가 상태로 거르는 것은 설정을 켰을 때만이다', () => {
  const set = [
    P({ id: 'a', permissionState: 'not_needed' }), P({ id: 'b', permissionState: 'granted' }),
    P({ id: 'c', permissionState: 'unknown' }), P({ id: 'd', permissionState: 'denied' }),
    P({ id: 'e', permissionState: undefined }),
  ];
  // 기본(꺼짐): 전부 보인다
  assert.deepEqual(ids(selectPlaces(MODES.EXPLORE, set)), ['a', 'b', 'c', 'd', 'e']);
  // 켜짐: 해당 없음·허가만
  const on = selectPlaces(MODES.EXPLORE, set, {}, MODE_ALLOWED_TYPES, { requirePermission: true });
  assert.deepEqual(ids(on), ['a', 'b']);
});

test('정렬: 조건부 뒤로가 구·군 앞으로보다 먼저 적용된다', () => {
  const set = [
    P({ id: 'a', district: '수성구', type: 'indoor' }),
    P({ id: 'b', district: '중구', type: 'indoor', fit: { SHADE: fit('conditional') } }),
    P({ id: 'c', district: '중구', type: 'indoor' }),
  ];
  assert.deepEqual(ids(selectPlaces(MODES.SHADE, set, { district: '중구' })), ['c', 'a', 'b']);
});

test('HOLD는 적합도가 있어도 아무것도 추천하지 않고, 입력은 바뀌지 않는다', () => {
  const set = Object.freeze([Object.freeze(P({ id: 'a', fit: { EXPLORE: fit('good') } }))]);
  assert.deepEqual(selectPlaces(MODES.HOLD, set), { places: [], reason: 'MODE_NO_PLACES' });
  assert.equal(set.length, 1);
});