import test from 'node:test';
import assert from 'node:assert/strict';
import { orderPlaces, distanceKm } from '../src/ai/order_places.js';

// 같은 위도에서 경도만 0.01씩 다른 세 곳 (A - B - C 순으로 일직선)
const A = { id: 'A', lat: 35.87, lng: 128.6 };
const B = { id: 'B', lat: 35.87, lng: 128.61 };
const C = { id: 'C', lat: 35.87, lng: 128.62 };
const ids = (r) => r.places.map((p) => p.id);

test('직선거리: 경도 0.01도는 약 0.9km', () => {
  const d = distanceKm(A, B);
  assert.ok(d > 0.8 && d < 1.0, `distance=${d}`);
});

test('시작점이 A 쪽이면 A → B → C', () => {
  const r = orderPlaces([A, C, B], { start: { latitude: 35.87, longitude: 128.599 } });
  assert.deepEqual(ids(r), ['A', 'B', 'C']);
  assert.equal(r.basis, 'distance');
});

test('시작점이 C 쪽이면 C → B → A', () => {
  const r = orderPlaces([A, B, C], { start: { latitude: 35.87, longitude: 128.621 } });
  assert.deepEqual(ids(r), ['C', 'B', 'A']);
});

test('시작점이 없어도 B가 가운데로 오는 최단 순서', () => {
  const r = orderPlaces([A, C, B]);
  assert.equal(r.basis, 'distance');
  assert.equal(ids(r)[1], 'B');
});

test('AI가 준 순서(A, C, B)가 돌아가는 길이면 바로잡는다', () => {
  const r = orderPlaces([A, C, B], { start: { latitude: 35.87, longitude: 128.6 } });
  assert.deepEqual(ids(r), ['A', 'B', 'C']);
});

test('좌표가 없고 같은 권역이면 임시 순번순', () => {
  const ps = [
    { id: 'x', zone: 'namsan', routeOrder: 2 },
    { id: 'y', zone: 'namsan', routeOrder: 1 },
    { id: 'z', zone: 'namsan', routeOrder: 3 },
  ];
  const r = orderPlaces(ps);
  assert.deepEqual(ids(r), ['y', 'x', 'z']);
  assert.equal(r.basis, 'route_order');
});

test('권역이 다르면 순번을 믿지 않고 받은 순서 그대로', () => {
  const ps = [
    { id: 'x', zone: 'namsan', routeOrder: 2 },
    { id: 'y', zone: 'gyodong', routeOrder: 1 },
  ];
  const r = orderPlaces(ps);
  assert.deepEqual(ids(r), ['x', 'y']);
  assert.equal(r.basis, 'none');
});

test('근거가 없으면 받은 순서 그대로 (순서 미검증)', () => {
  const r = orderPlaces([{ id: 'p' }, { id: 'q' }]);
  assert.deepEqual(ids(r), ['p', 'q']);
  assert.equal(r.basis, 'none');
});

test('좌표가 일부만 있으면 거리 계산을 하지 않는다', () => {
  const r = orderPlaces([A, { id: 'Q' }]);
  assert.equal(r.basis, 'none');
});

test('장소가 너무 많으면 계산하지 않는다', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, lat: 35.87, lng: 128.6 + i * 0.01 }));
  assert.equal(orderPlaces(many).basis, 'none');
});

test('빈 목록, 장소 1곳', () => {
  assert.deepEqual(orderPlaces([]), { places: [], basis: 'none' });
  assert.deepEqual(ids(orderPlaces([A])), ['A']);
});

test('입력 배열을 바꾸지 않는다', () => {
  const input = [A, C, B];
  orderPlaces(input, { start: { latitude: 35.87, longitude: 128.599 } });
  assert.deepEqual(input.map((p) => p.id), ['A', 'C', 'B']);
});