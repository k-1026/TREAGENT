import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateDurationMin, WALK_KMH, DETOUR_FACTOR, STAY_MIN_PER_PLACE } from '../src/ai/estimate_duration.js';

// 같은 위도에서 경도만 0.01도 다른 일직선 위의 장소들 (이웃 사이 약 0.9km)
const at = (i) => ({ id: `p${i}`, lat: 35.87, lng: 128.6 + i * 0.01 });

test('장소 3곳: 걷는 시간 + 장소마다 머무는 시간을 5분 단위로 올린다', () => {
  // 걷기: 약 1.8km × 1.3 ÷ 4km/h = 약 35분, 머물기: 3 × 20 = 60분 → 약 95분 → 100분
  const r = estimateDurationMin([at(0), at(1), at(2)]);
  assert.deepEqual(r, { minutes: 100, basis: 'distance' });
});

test('60대 이상은 더 느리게 걷는 것으로 본다', () => {
  const normal = estimateDurationMin([at(0), at(1), at(2)], { ageGroup: '30s' });
  const senior = estimateDurationMin([at(0), at(1), at(2)], { ageGroup: '60s' });
  assert.equal(normal.minutes, 100);
  assert.equal(senior.minutes, 110);
  assert.ok(WALK_KMH['60s'] < WALK_KMH.default);
});

test('장소 1곳이면 머무는 시간만', () => {
  assert.deepEqual(estimateDurationMin([at(0)]), { minutes: STAY_MIN_PER_PLACE, basis: 'distance' });
});

test('좌표가 하나라도 없으면 추측하지 않고 null', () => {
  assert.deepEqual(estimateDurationMin([at(0), { id: 'x' }]), { minutes: null, basis: 'none' });
  assert.deepEqual(estimateDurationMin([]), { minutes: null, basis: 'none' });
  assert.deepEqual(estimateDurationMin(null), { minutes: null, basis: 'none' });
});

test('모르는 나이대나 특수 문자열은 기본 속도를 쓴다', () => {
  assert.equal(estimateDurationMin([at(0), at(1), at(2)], { ageGroup: '__proto__' }).minutes, 100);
  assert.equal(estimateDurationMin([at(0), at(1), at(2)], { ageGroup: 'x' }).minutes, 100);
});

test('먼 장소일수록 시간이 늘고, 결과는 항상 5의 배수', () => {
  const near = estimateDurationMin([at(0), at(1)]).minutes;
  const far = estimateDurationMin([at(0), at(10)]).minutes;
  assert.ok(far > near);
  assert.equal(near % 5, 0);
  assert.equal(far % 5, 0);
  assert.ok(DETOUR_FACTOR >= 1);
});

test('입력 배열을 바꾸지 않는다', () => {
  const input = [at(0), at(1), at(2)];
  estimateDurationMin(input, { ageGroup: '60s' });
  assert.deepEqual(input.map((p) => p.id), ['p0', 'p1', 'p2']);
});